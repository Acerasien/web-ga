'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { ApiResponse } from '@/types';
import { Prisma, RecurringBillFrequency } from '@prisma/client';
import type { RecurringBill, Category, Branch } from '@prisma/client';

// ============================================================
// Types
// ============================================================

export interface RecurringBillWithRelations extends Omit<RecurringBill, 'amountExpected'> {
  amountExpected: number | null;
  category: Category;
  branch: Branch;
  user: {
    fullName: string;
    username: string;
  };
  _count: {
    ongoingPayments: number;
  };
}

export interface RecurringBillFilters {
  branchId?: number;
  isActive?: boolean;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedRecurringBills {
  bills: RecurringBillWithRelations[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface CreateRecurringBillData {
  branchId?: number;
  categoryId: number;
  description: string;
  amountExpected?: number;
  frequency: RecurringBillFrequency;
  nextDueDate: string;
  notes?: string;
}

export interface SpawnResult {
  spawned: number;
  pendingCount: number;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Advance a date by one frequency interval, handling calendar month-end overflows safely.
 */
function advanceDate(date: Date, frequency: RecurringBillFrequency): Date {
  const next = new Date(date);
  const originalDay = date.getDate();

  switch (frequency) {
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      if (next.getDate() !== originalDay) {
        next.setDate(0); // Rolls back to the last day of the intended month
      }
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      if (next.getDate() !== originalDay) {
        next.setDate(0); // Rolls back to the last day of the intended quarter month
      }
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      if (next.getDate() !== originalDay) {
        next.setDate(0); // Safe leap-year boundary handling
      }
      break;
  }
  return next;
}

// ============================================================
// Server Actions
// ============================================================

let isSpawning = false;

/**
 * Check for due recurring bills and spawn OngoingPayment instances.
 * Called on every dashboard load. Idempotent — skips if a BELUM_DIBAYAR
 * OngoingPayment already exists for the bill.
 */
export async function checkAndSpawnRecurringBills(
  branchId?: number | null
): Promise<SpawnResult> {
  if (isSpawning) {
    return { spawned: 0, pendingCount: 0 };
  }
  isSpawning = true;

  try {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999);

    const whereClause: Prisma.RecurringBillWhereInput = {
      isActive: true,
      nextDueDate: { lte: threeDaysFromNow },
    };

    // Branch-scoped for non-superadmin
    if (branchId) {
      whereClause.branchId = branchId;
    }

    const dueBills = await prisma.recurringBill.findMany({
      where: whereClause,
      include: { category: true },
    });

    let spawned = 0;

    for (const bill of dueBills) {
      // Execute check and spawn inside a single transaction to guarantee atomic consistency
      await prisma.$transaction(async (tx) => {
        // 1. Re-fetch current state inside transaction to see any recent updates
        const currentBill = await tx.recurringBill.findUnique({
          where: { id: bill.id },
        });

        if (!currentBill || !currentBill.isActive || currentBill.nextDueDate > threeDaysFromNow) {
          return; // Abort: Already processed/advanced by a parallel thread
        }

        // 2. Check if a pending payment already exists for this template
        const existing = await tx.ongoingPayment.findFirst({
          where: {
            recurringBillId: currentBill.id,
            status: 'BELUM_DIBAYAR',
          },
          select: { id: true },
        });

        if (existing) return; // Abort: Already spawned

        // 3. Spawn new OngoingPayment
        await tx.ongoingPayment.create({
          data: {
            branchId: currentBill.branchId,
            categoryId: currentBill.categoryId,
            userId: currentBill.userId,
            description: currentBill.description,
            amountNeeded: currentBill.amountExpected ?? new Prisma.Decimal(0),
            status: 'BELUM_DIBAYAR',
            recurringBillId: currentBill.id,
            requestDate: currentBill.nextDueDate, // Use exact due date
            location: currentBill.location,
          },
        });

        // 4. Advance nextDueDate by one interval
        await tx.recurringBill.update({
          where: { id: currentBill.id },
          data: { nextDueDate: advanceDate(currentBill.nextDueDate, currentBill.frequency) },
        });

        spawned++;
      });
    }

    // Count total pending recurring-spawned payments for badge
    const pendingCountWhere: Prisma.OngoingPaymentWhereInput = {
      status: 'BELUM_DIBAYAR',
      recurringBillId: { not: null },
    };
    if (branchId) pendingCountWhere.branchId = branchId;

    const pendingCount = await prisma.ongoingPayment.count({
      where: pendingCountWhere,
    });

    return { spawned, pendingCount };
  } catch (error) {
    console.error('Error in checkAndSpawnRecurringBills:', error);
    return { spawned: 0, pendingCount: 0 };
  } finally {
    isSpawning = false;
  }
}

/**
 * Fetch paginated recurring bills with branch-role locking.
 */
export async function getRecurringBills(
  filters: RecurringBillFilters
): Promise<ApiResponse<PaginatedRecurringBills>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak.' };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RecurringBillWhereInput = {};

    if (user.role === 'ADMIN') {
      if (!user.branchId) {
        return { success: false, error: 'Akun Admin Anda tidak terikat dengan cabang manapun.' };
      }
      where.branchId = user.branchId;
    } else if (filters.branchId) {
      where.branchId = Number(filters.branchId);
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
        { category: { name: { contains: filters.search, mode: 'insensitive' } } },
        { branch: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    // Dynamic Sort logic
    const sortBy = filters.sortBy || 'nextDueDate';
    const sortOrder = filters.sortOrder || 'asc';
    let orderBy: Prisma.RecurringBillOrderByWithRelationInput = {};

    if (sortBy === 'category') {
      orderBy = { category: { name: sortOrder } };
    } else if (sortBy === 'branch') {
      orderBy = { branch: { name: sortOrder } };
    } else if (sortBy === 'user') {
      orderBy = { user: { fullName: sortOrder } };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const [bills, totalCount] = await Promise.all([
      prisma.recurringBill.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          branch: true,
          category: true,
          user: { select: { fullName: true, username: true } },
          _count: { select: { ongoingPayments: true } },
        },
      }),
      prisma.recurringBill.count({ where }),
    ]);

    // Deep clone to strip Prisma proxy objects which crash Next.js RSC streaming
    const plainBills = JSON.parse(JSON.stringify(bills));
    
    const serialized: RecurringBillWithRelations[] = plainBills.map((b: any) => ({
      ...b,
      amountExpected: b.amountExpected ? Number(b.amountExpected) : null,
    }));

    return {
      success: true,
      data: {
        bills: serialized,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      },
    };
  } catch (error) {
    console.error('Error fetching recurring bills:', error);
    return { success: false, error: 'Gagal memuat data tagihan berulang.' };
  }
}

/**
 * Create a new recurring bill template.
 */
export async function createRecurringBill(
  data: CreateRecurringBillData
): Promise<ApiResponse<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak.' };
    }

    let targetBranchId = data.branchId;
    if (user.role === 'ADMIN') {
      if (!user.branchId) {
        return { success: false, error: 'Akun Admin Anda tidak terikat dengan cabang manapun.' };
      }
      targetBranchId = user.branchId;
    } else if (!targetBranchId) {
      return { success: false, error: 'Mohon tentukan cabang.' };
    }

    if (!data.description.trim() || !data.categoryId || !data.nextDueDate) {
      return { success: false, error: 'Mohon isi semua bidang wajib.' };
    }

    // Input length validation (Finding #10)
    if (data.description.length > 255) {
      return { success: false, error: 'Deskripsi tagihan maksimal 255 karakter.' };
    }
    if (data.notes && data.notes.length > 5000) {
      return { success: false, error: 'Catatan tambahan maksimal 5000 karakter.' };
    }

    await prisma.recurringBill.create({
      data: {
        branchId: targetBranchId!,
        categoryId: Number(data.categoryId),
        userId: user.id,
        description: data.description.trim(),
        amountExpected: data.amountExpected
          ? new Prisma.Decimal(data.amountExpected)
          : null,
        frequency: data.frequency,
        nextDueDate: new Date(data.nextDueDate),
        notes: data.notes?.trim() || null,
        isActive: true,
      },
    });

    // revalidatePath('/admin/tagihan-rutin');
    // revalidatePath('/dashboard');

    return { success: true, message: 'Tagihan berulang berhasil ditambahkan.' };
  } catch (error) {
    console.error('Error creating recurring bill:', error);
    return { success: false, error: 'Gagal menambahkan tagihan berulang.' };
  }
}

/**
 * Update a recurring bill template.
 */
export async function updateRecurringBill(
  id: number,
  data: Partial<CreateRecurringBillData> & { isActive?: boolean }
): Promise<ApiResponse<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak.' };
    }

    const bill = await prisma.recurringBill.findUnique({ where: { id } });
    if (!bill) {
      return { success: false, error: 'Tagihan berulang tidak ditemukan.' };
    }

    // Branch lock for ADMIN
    if (user.role === 'ADMIN' && bill.branchId !== user.branchId) {
      return { success: false, error: 'Akses ditolak. Anda hanya dapat mengelola cabang Anda sendiri.' };
    }

    // Input length validation (Finding #10)
    if (data.description && data.description.length > 255) {
      return { success: false, error: 'Deskripsi tagihan maksimal 255 karakter.' };
    }
    if (data.notes && data.notes.length > 5000) {
      return { success: false, error: 'Catatan tambahan maksimal 5000 karakter.' };
    }

    await prisma.recurringBill.update({
      where: { id },
      data: {
        ...(data.description && { description: data.description.trim() }),
        ...(data.categoryId && { categoryId: Number(data.categoryId) }),
        ...(data.frequency && { frequency: data.frequency }),
        ...(data.nextDueDate && { nextDueDate: new Date(data.nextDueDate) }),
        ...(data.amountExpected !== undefined && {
          amountExpected: data.amountExpected
            ? new Prisma.Decimal(data.amountExpected)
            : null,
        }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    // revalidatePath('/admin/tagihan-rutin');
    // revalidatePath('/dashboard');

    return { success: true, message: 'Tagihan berulang berhasil diperbarui.' };
  } catch (error) {
    console.error('Error updating recurring bill:', error);
    return { success: false, error: 'Gagal memperbarui tagihan berulang.' };
  }
}

/**
 * Deactivate (soft-delete) a recurring bill.
 * If no linked OngoingPayments exist, hard-deletes instead.
 */
export async function deleteRecurringBill(id: number): Promise<ApiResponse<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak.' };
    }

    const bill = await prisma.recurringBill.findUnique({
      where: { id },
      include: { _count: { select: { ongoingPayments: true } } },
    });

    if (!bill) {
      return { success: false, error: 'Tagihan berulang tidak ditemukan.' };
    }

    if (user.role === 'ADMIN' && bill.branchId !== user.branchId) {
      return { success: false, error: 'Akses ditolak.' };
    }

    if (bill._count.ongoingPayments > 0) {
      // Soft-delete: deactivate only
      await prisma.recurringBill.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      // Hard-delete if no linked payments
      await prisma.recurringBill.delete({ where: { id } });
    }

    // revalidatePath('/admin/tagihan-rutin');
    // revalidatePath('/dashboard');

    return { success: true, message: 'Tagihan berulang berhasil dihapus.' };
  } catch (error) {
    console.error('Error deleting recurring bill:', error);
    return { success: false, error: 'Gagal menghapus tagihan berulang.' };
  }
}
