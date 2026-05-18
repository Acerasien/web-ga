'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { TransactionFormData, ApiResponse } from '@/types';
import { Prisma } from '@prisma/client';

/**
 * Server Action to record a new GA activity expense transaction.
 * Performs strict role validations and double-decimal math logic.
 */
export async function createTransaction(
  data: TransactionFormData & { branchId?: number }
): Promise<ApiResponse<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      };
    }

    // Role boundary safeguard (Poka-Yoke)
    if (user.role === 'VIEWER') {
      return {
        success: false,
        error: 'Akses ditolak. Peran Viewer hanya diizinkan untuk melihat laporan.',
      };
    }

    const {
      categoryId,
      subCategoryId,
      transactionDate,
      description,
      quantity,
      unit,
      pricePerUnit,
      paymentMethod,
      vendor,
      receiptPath,
      notes,
      customFields,
    } = data;

    // Fail-fast on required primary field parameters
    if (!categoryId || !transactionDate || !description.trim() || quantity <= 0 || !unit.trim() || pricePerUnit < 0 || !paymentMethod) {
      return {
        success: false,
        error: 'Mohon lengkapi semua bidang wajib dengan benar.',
      };
    }

    // Determine target Branch ID based on role permissions
    let targetBranchId: number;
    if (user.role === 'SUPERADMIN') {
      if (!data.branchId) {
        return {
          success: false,
          error: 'Administrator wajib menentukan cabang penanggung jawab.',
        };
      }
      targetBranchId = data.branchId;
    } else {
      // DATA_ENTRY: Always restrict their postings to their designated home branch
      if (!user.branchId) {
        return {
          success: false,
          error: 'Cabang asal tidak terdeteksi untuk akun Anda. Silakan hubungi admin.',
        };
      }
      targetBranchId = user.branchId;
    }

    // Compute double-precision decimal multiplication safely
    const qty = new Prisma.Decimal(quantity);
    const price = new Prisma.Decimal(pricePerUnit);
    const totalAmount = qty.mul(price);

    // Save transaction inside database
    await prisma.transaction.create({
      data: {
        branchId: targetBranchId,
        userId: user.id,
        categoryId: Number(categoryId),
        subCategoryId: subCategoryId ? Number(subCategoryId) : null,
        transactionDate: new Date(transactionDate),
        description: description.trim(),
        quantity: qty,
        unit: unit.trim(),
        pricePerUnit: price,
        totalAmount,
        paymentMethod,
        vendor: vendor?.trim() || null,
        receiptPath: receiptPath || null,
        notes: notes?.trim() || null,
        customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });

    // Clear router cache tags to trigger live layout refreshes
    revalidatePath('/dashboard');
    revalidatePath('/transaksi/riwayat');

    return {
      success: true,
      message: 'Transaksi berhasil dicatat dan disimpan.',
    };
  } catch (error) {
    console.error('Error during createTransaction Server Action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem internal saat mencatat transaksi.',
    };
  }
}

// ============================================================
// Types for Querying Transaction Records
// ============================================================

import type { Transaction, Category, SubCategory, Branch, PaymentMethod } from '@prisma/client';

export interface TransactionFilter {
  search?: string;
  branchId?: number;
  categoryId?: number;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionWithRelations extends Omit<Transaction, 'quantity' | 'pricePerUnit' | 'totalAmount'> {
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  category: Category;
  subCategory: SubCategory | null;
  branch: Branch;
  user: {
    fullName: string;
    username: string;
  };
}

export interface PaginatedTransactions {
  transactions: TransactionWithRelations[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

/**
 * Server Action to fetch transactions with search, pagination, and multi-criteria filters.
 * Enforces dynamic multi-branch access control rules based on active user credentials.
 */
export async function getTransactions(
  filters: TransactionFilter
): Promise<ApiResponse<PaginatedTransactions>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      };
    }

    const {
      search,
      branchId,
      categoryId,
      paymentMethod,
      startDate,
      endDate,
      page,
      limit,
      sortBy = 'transactionDate',
      sortOrder = 'desc',
    } = filters;

    // Enforce role boundaries (Poka-Yoke)
    let branchIdFilter: number | undefined = undefined;
    if (user.role === 'SUPERADMIN') {
      if (branchId) {
        branchIdFilter = Number(branchId);
      }
    } else {
      // DATA_ENTRY or VIEWER: Restrict entirely to their registered home branch
      if (!user.branchId) {
        return {
          success: false,
          error: 'Gagal memuat data: Akun Anda tidak memiliki cabang terdaftar.',
        };
      }
      branchIdFilter = user.branchId;
    }

    // Build Prisma dynamic filter structure
    const where: Prisma.TransactionWhereInput = {};

    if (branchIdFilter !== undefined) {
      where.branchId = branchIdFilter;
    }

    if (categoryId) {
      where.categoryId = Number(categoryId);
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) {
        where.transactionDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.transactionDate.lte = new Date(endDate);
      }
    }

    if (search && search.trim() !== '') {
      const queryStr = search.trim();
      where.OR = [
        { description: { contains: queryStr, mode: 'insensitive' } },
        { vendor: { contains: queryStr, mode: 'insensitive' } },
        { notes: { contains: queryStr, mode: 'insensitive' } },
        { unit: { contains: queryStr, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const take = limit;

    // Build Prisma dynamic orderBy structure
    let orderBy: Prisma.TransactionOrderByWithRelationInput = {
      transactionDate: 'desc',
    };

    if (sortBy) {
      if (sortBy === 'category') {
        orderBy = {
          category: {
            name: sortOrder,
          },
        };
      } else if (sortBy === 'branch') {
        orderBy = {
          branch: {
            name: sortOrder,
          },
        };
      } else if (
        ['transactionDate', 'totalAmount', 'quantity', 'pricePerUnit', 'description', 'vendor', 'paymentMethod', 'createdAt'].includes(sortBy)
      ) {
        orderBy = {
          [sortBy]: sortOrder,
        };
      }
    }

    // Execute queries in parallel to ensure optimal performance
    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          category: true,
          subCategory: true,
          branch: true,
          user: {
            select: {
              fullName: true,
              username: true,
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.transaction.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const serializedTransactions: TransactionWithRelations[] = transactions.map((t) => ({
      ...t,
      quantity: Number(t.quantity),
      pricePerUnit: Number(t.pricePerUnit),
      totalAmount: Number(t.totalAmount),
    }));

    return {
      success: true,
      data: {
        transactions: serializedTransactions,
        totalCount,
        totalPages,
        currentPage: page,
      },
    };
  } catch (error) {
    console.error('Error inside getTransactions Server Action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memuat daftar transaksi.',
    };
  }
}

/**
 * Server Action to delete an expense transaction permanently (Superadmin Only).
 */
export async function deleteTransaction(id: number): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      };
    }

    if (user.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses ditolak. Hanya administrator yang dapat menghapus data pengeluaran.',
      };
    }

    // Delete transaction cleanly from Prisma
    await prisma.transaction.delete({
      where: { id },
    });

    // Clear router cache tags to trigger live layout refreshes
    revalidatePath('/dashboard');
    revalidatePath('/transaksi/riwayat');

    return {
      success: true,
      message: 'Transaksi berhasil dihapus secara permanen.',
      data: { success: true }
    };
  } catch (error) {
    console.error('Error inside deleteTransaction Server Action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat menghapus transaksi.',
    };
  }
}
