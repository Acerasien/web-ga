'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { ApiResponse } from '@/types';
import { Prisma, PaymentMethod } from '@prisma/client';
import type { OngoingPayment, Category, SubCategory, Branch } from '@prisma/client';

// ============================================================
// Types
// ============================================================

export interface OngoingPaymentWithRelations extends Omit<OngoingPayment, 'amountNeeded' | 'actualAmount'> {
  amountNeeded: number;
  actualAmount: number | null;
  category: Category;
  subCategory?: SubCategory | null;
  branch: Branch;
  user: {
    fullName: string;
    username: string;
  };
  transaction?: {
    id: number;
    beritaAcara: string | null;
  } | null;
}

export interface OngoingPaymentFilters {
  status?: string;
  branchId?: number;
  categoryId?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedOngoingPayments {
  payments: OngoingPaymentWithRelations[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// ============================================================
// Helpers
// ============================================================

function getRomanMonth(date: Date): string {
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return roman[date.getMonth()];
}

// ============================================================
// Server Actions
// ============================================================

/**
 * Fetch ongoing payments with paging, filtering, and role-based branch locking.
 */
export async function getOngoingPayments(
  filters: OngoingPaymentFilters
): Promise<ApiResponse<PaginatedOngoingPayments>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    // Role-based access control check (Poka-Yoke)
    if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak. Anda tidak memiliki izin untuk fitur ini.' };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.OngoingPaymentWhereInput = {};

    // Branch locking for ADMIN role
    if (user.role === 'ADMIN') {
      if (!user.branchId) {
        return { success: false, error: 'Akun Admin Anda tidak terikat dengan cabang manapun.' };
      }
      where.branchId = user.branchId;
    } else if (filters.branchId) {
      where.branchId = Number(filters.branchId);
    }

    // Filtering by status
    if (filters.status === 'ACTIVE') {
      where.status = { in: ['BELUM_DIBAYAR', 'SUDAH_DIBAYAR'] };
    } else if (filters.status === 'TER_REALISASI') {
      where.status = 'TER_REALISASI';
      where.transactionId = { not: null }; // Exclude orphaned payments if the transaction was deleted
    } else if (filters.status) {
      where.status = filters.status;
    }

    // Filtering by category
    if (filters.categoryId) {
      where.categoryId = Number(filters.categoryId);
    }

    const [payments, totalCount] = await Promise.all([
      prisma.ongoingPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: true,
          category: true,
          subCategory: true,
          user: {
            select: {
              fullName: true,
              username: true,
            },
          },
          transaction: {
            select: {
              id: true,
              beritaAcara: true,
            },
          },
        },
      }),
      prisma.ongoingPayment.count({ where }),
    ]);

    // Deep clone to strip Prisma proxy objects which crash Next.js RSC streaming
    const plainPayments = JSON.parse(JSON.stringify(payments));

    // Map Prisma Decimal back to standard JS numbers for Client safety
    const serializedPayments: OngoingPaymentWithRelations[] = plainPayments.map((p: any) => ({
      ...p,
      amountNeeded: Number(p.amountNeeded),
      actualAmount: p.actualAmount ? Number(p.actualAmount) : null,
    }));

    return {
      success: true,
      data: {
        payments: serializedPayments,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      },
    };
  } catch (error) {
    console.error('Error fetching ongoing payments:', error);
    return { success: false, error: 'Gagal memuat data pembayaran berjalan.' };
  }
}

/**
 * Create a new payment request in stage 1 (BELUM_DIBAYAR).
 */
export async function createOngoingPayment(data: {
  branchId?: number;
  categoryId: number;
  subCategoryId?: number;
  description: string;
  amountNeeded: number;
  initialReceiptPath?: string;
  requestDate?: string;
  frequency?: string;
}): Promise<ApiResponse<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak. Anda tidak memiliki izin untuk fitur ini.' };
    }

    let targetBranchId = data.branchId;

    if (user.role === 'ADMIN') {
      if (!user.branchId) {
        return { success: false, error: 'Akun Admin Anda tidak terikat dengan cabang manapun.' };
      }
      targetBranchId = user.branchId;
    } else {
      if (!targetBranchId) {
        return { success: false, error: 'Mohon tentukan cabang untuk request ini.' };
      }
    }

    if (!data.categoryId || !data.description.trim() || data.amountNeeded <= 0) {
      return { success: false, error: 'Mohon isi semua bidang wajib dengan benar.' };
    }

    await prisma.ongoingPayment.create({
      data: {
        branchId: targetBranchId,
        categoryId: Number(data.categoryId),
        subCategoryId: data.subCategoryId ? Number(data.subCategoryId) : null,
        userId: user.id,
        description: data.description.trim(),
        amountNeeded: new Prisma.Decimal(data.amountNeeded),
        initialReceiptPath: data.initialReceiptPath || null,
        requestDate: data.requestDate ? new Date(data.requestDate) : new Date(),
        status: 'BELUM_DIBAYAR',
        frequency: data.frequency || null,
      },
    });

    revalidatePath('/ongoing/list');

    return { success: true, message: 'Request pembayaran berhasil dibuat.' };
  } catch (error) {
    console.error('Error creating ongoing payment:', error);
    return { success: false, error: 'Gagal membuat request pembayaran.' };
  }
}

/**
 * Transition status from BELUM_DIBAYAR to SUDAH_DIBAYAR.
 */
export async function updateOngoingStatusToPaid(id: number): Promise<ApiResponse<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak. Anda tidak memiliki izin untuk fitur ini.' };
    }

    const payment = await prisma.ongoingPayment.findUnique({
      where: { id },
    });

    if (!payment) {
      return { success: false, error: 'Data pembayaran berjalan tidak ditemukan.' };
    }

    // Branch locking verification
    if (user.role === 'ADMIN' && payment.branchId !== user.branchId) {
      return { success: false, error: 'Akses ditolak. Anda hanya diizinkan untuk mengelola cabang Anda sendiri.' };
    }

    if (payment.status !== 'BELUM_DIBAYAR') {
      return { success: false, error: 'Pembayaran ini sudah dibayar atau ter-realisasi.' };
    }

    await prisma.ongoingPayment.update({
      where: { id },
      data: { status: 'SUDAH_DIBAYAR' },
    });

    revalidatePath('/ongoing/list');

    return { success: true, message: 'Status pembayaran berhasil diperbarui menjadi Sudah Dibayar.' };
  } catch (error) {
    console.error('Error updating status to paid:', error);
    return { success: false, error: 'Gagal memperbarui status pembayaran.' };
  }
}

/**
 * Transition status to TER_REALISASI, link receipt/PDF, adjust actual cost,
 * and automatically spawn matching transaction inside a single robust db transaction.
 */
export async function realizeOngoingPayment(
  id: number,
  data: {
    isMoneyEnough: boolean;
    actualAmount: number;
    finalReceiptPath: string;
    paymentMethod: PaymentMethod;
    vendor?: string;
    notes?: string;
    transactionDate?: string;
    beritaAcara?: string;
  }
): Promise<ApiResponse<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' };
    }

    if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak. Anda tidak memiliki izin untuk fitur ini.' };
    }

    const payment = await prisma.ongoingPayment.findUnique({
      where: { id },
    });

    if (!payment) {
      return { success: false, error: 'Data pembayaran berjalan tidak ditemukan.' };
    }

    if (user.role === 'ADMIN' && payment.branchId !== user.branchId) {
      return { success: false, error: 'Akses ditolak. Anda hanya diizinkan untuk mengelola cabang Anda sendiri.' };
    }

    if (payment.status !== 'SUDAH_DIBAYAR') {
      return { success: false, error: 'Hanya pembayaran dengan status "Sudah Dibayar" yang dapat direalisasikan.' };
    }

    if (data.actualAmount <= 0) {
      return { success: false, error: 'Kuantitas atau jumlah uang realisasi wajib bernilai positif.' };
    }

    if (!data.finalReceiptPath) {
      return { success: false, error: 'Bukti realisasi (Foto/PDF) wajib dilampirkan.' };
    }

    if (!data.notes || !data.notes.trim()) {
      return { success: false, error: 'Catatan tambahan wajib diisi.' };
    }

    // Save transaction inside database with optional custom Berita Acara (BA)
    const txDate = data.transactionDate ? new Date(data.transactionDate) : new Date();

    let finalBeritaAcara: string | null = null;
    if (data.beritaAcara && data.beritaAcara.trim() !== '') {
      const trimmedBA = data.beritaAcara.trim();
      
      // Perform unique constraint check beforehand to give a clean error message
      const existing = await prisma.transaction.findFirst({
        where: { beritaAcara: trimmedBA },
        select: { id: true },
      });
      
      if (existing) {
        return {
          success: false,
          error: 'Nomor Berita Acara tersebut sudah digunakan. Silakan gunakan nomor lain.',
        };
      }
      finalBeritaAcara = trimmedBA;
    }

    // Run realization inside a transactional container
    await prisma.$transaction(async (tx) => {
      // 1. Create matching historical Transaction record
      const createdTx = await tx.transaction.create({
        data: {
          branchId: payment.branchId,
          userId: payment.userId, // Maintain original creator
          categoryId: payment.categoryId,
          subCategoryId: payment.subCategoryId,
          transactionDate: txDate,
          description: `[Realisasi] ${payment.description.trim()}`,
          quantity: new Prisma.Decimal(1),
          unit: 'Transaksi',
          pricePerUnit: new Prisma.Decimal(data.actualAmount),
          totalAmount: new Prisma.Decimal(data.actualAmount),
          paymentMethod: data.paymentMethod,
          vendor: data.vendor?.trim() || null,
          receiptPath: data.finalReceiptPath,
          notes: data.notes?.trim() || null,
          beritaAcara: finalBeritaAcara,
        },
      });

      // 2. Update OngoingPayment status, link transactionId
      await tx.ongoingPayment.update({
        where: { id },
        data: {
          status: 'TER_REALISASI',
          isMoneyEnough: data.isMoneyEnough,
          actualAmount: new Prisma.Decimal(data.actualAmount),
          finalReceiptPath: data.finalReceiptPath,
          transactionId: createdTx.id,
        },
      });
    });

    revalidatePath('/dashboard');
    revalidatePath('/ongoing/list');
    revalidatePath('/transaksi/riwayat');

    return { success: true, message: 'Pembayaran berhasil direalisasikan dan dicatat di riwayat.' };
  } catch (error) {
    console.error('Error during ongoing payment realization:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Gagal merealisasikan pembayaran.' 
    };
  }
}
