'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { TransactionFormData, ApiResponse } from '@/types';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/actions/audit';

/**
 * Helper to convert date month to Roman numeral
 */
function getRomanMonth(date: Date): string {
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return roman[date.getMonth()];
}

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
      discountPerUnit,
      discountTotal,
      taxAmount,
      taxNote,
      paymentMethod,
      location,
      vendor,
      receiptPath,
      notes,
      customFields,
      beritaAcara,
    } = data;

    // Fail-fast on required primary field parameters
    if (!categoryId || !transactionDate || !description.trim() || quantity <= 0 || !unit.trim() || pricePerUnit < 0 || !paymentMethod) {
      return {
        success: false,
        error: 'Mohon lengkapi semua bidang wajib dengan benar.',
      };
    }

    // Input length validation (Finding #10)
    if (description.length > 255) {
      return { success: false, error: 'Keterangan transaksi maksimal 255 karakter.' };
    }
    if (unit.length > 20) {
      return { success: false, error: 'Satuan unit maksimal 20 karakter.' };
    }
    if (taxNote && taxNote.length > 50) {
      return { success: false, error: 'Catatan pajak maksimal 50 karakter.' };
    }
    if (vendor && vendor.length > 100) {
      return { success: false, error: 'Vendor maksimal 100 karakter.' };
    }
    if (receiptPath && receiptPath.length > 500) {
      return { success: false, error: 'Path berkas bukti transaksi terlalu panjang.' };
    }
    if (notes && notes.length > 5000) {
      return { success: false, error: 'Catatan tambahan maksimal 5000 karakter.' };
    }
    if (beritaAcara && beritaAcara.length > 50) {
      return { success: false, error: 'Nomor Berita Acara maksimal 50 karakter.' };
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

    // Compute total using full breakdown formula:
    // total = (qty × price) - (discountPerUnit × qty) - discountTotal + taxAmount
    const qty = new Prisma.Decimal(quantity);
    const price = new Prisma.Decimal(pricePerUnit);
    let totalAmount = qty.mul(price);
    const discountPerUnitDecimal = discountPerUnit ? new Prisma.Decimal(discountPerUnit) : null;
    const discountTotalDecimal = discountTotal ? new Prisma.Decimal(discountTotal) : null;
    const taxAmountDecimal = taxAmount ? new Prisma.Decimal(taxAmount) : null;
    if (discountPerUnitDecimal) totalAmount = totalAmount.sub(discountPerUnitDecimal.mul(qty));
    if (discountTotalDecimal) totalAmount = totalAmount.sub(discountTotalDecimal);
    if (taxAmountDecimal) totalAmount = totalAmount.add(taxAmountDecimal);
    // Guard: total cannot be negative
    if (totalAmount.lessThan(0)) totalAmount = new Prisma.Decimal(0);

    // Save transaction inside database with optional custom Berita Acara (BA)
    const txDate = new Date(transactionDate);

    let finalBeritaAcara: string | null = null;
    if (beritaAcara && beritaAcara.trim() !== '') {
      const trimmedBA = beritaAcara.trim();
      
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

    try {
      if (data.ongoingPaymentId) {
        // Find ongoing payment first
        const ongoingPayment = await prisma.ongoingPayment.findUnique({
          where: { id: data.ongoingPaymentId }
        });
        
        if (!ongoingPayment) {
          return {
            success: false,
            error: 'Tagihan berjalan yang dimaksud tidak ditemukan.',
          };
        }
        
        if (ongoingPayment.transactionId || ongoingPayment.status === 'SUDAH_DIBAYAR') {
           return {
            success: false,
            error: 'Tagihan berjalan ini sudah dibayar sebelumnya.',
          };
        }

        // Use interactive transaction to guarantee consistency
        await prisma.$transaction(async (tx) => {
          const newTx = await tx.transaction.create({
            data: {
              branchId: targetBranchId,
              userId: user.id,
              categoryId: Number(categoryId),
              subCategoryId: subCategoryId ? Number(subCategoryId) : null,
              transactionDate: txDate,
              description: description.trim(),
              quantity: qty,
              unit: unit.trim(),
              pricePerUnit: price,
              discountPerUnit: discountPerUnitDecimal,
              discountTotal: discountTotalDecimal,
              taxAmount: taxAmountDecimal,
              taxNote: taxNote?.trim() || null,
              totalAmount,
              paymentMethod,
              location: location || ongoingPayment.location || null,
              vendor: vendor?.trim() || null,
              receiptPath: receiptPath || null,
              notes: notes?.trim() || null,
              customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.DbNull,
              beritaAcara: finalBeritaAcara,
            },
          });
          
          // Poka-Yoke: Recurring bill payments are fully realized immediately upon transaction input.
          // Standard ongoing payments (if any) transition to SUDAH_DIBAYAR and await realization.
          const isRecurringSpawn = ongoingPayment.recurringBillId !== null;

          await tx.ongoingPayment.update({
            where: { id: ongoingPayment.id },
            data: {
              status: isRecurringSpawn ? 'TER_REALISASI' : 'SUDAH_DIBAYAR',
              transactionId: newTx.id,
              actualAmount: newTx.totalAmount,
              finalReceiptPath: receiptPath || null,
              ...(isRecurringSpawn ? { isMoneyEnough: true } : {}),
            }
          });

          await createAuditLog({
            userId: user.id,
            actionType: 'CREATE',
            targetTable: 'Transaction',
            targetId: String(newTx.id),
            description: `Mencatat transaksi dari tagihan berjalan: "${newTx.description}" senilai Rp ${Number(newTx.totalAmount).toLocaleString('id-ID')}`,
          }, tx);
        });
      } else {
        const newTx = await prisma.transaction.create({
          data: {
            branchId: targetBranchId,
            userId: user.id,
            categoryId: Number(categoryId),
            subCategoryId: subCategoryId ? Number(subCategoryId) : null,
            transactionDate: txDate,
            description: description.trim(),
            quantity: qty,
            unit: unit.trim(),
            pricePerUnit: price,
            discountPerUnit: discountPerUnitDecimal,
            discountTotal: discountTotalDecimal,
            taxAmount: taxAmountDecimal,
            taxNote: taxNote?.trim() || null,
            totalAmount,
            paymentMethod,
            location: location || null,
            vendor: vendor?.trim() || null,
            receiptPath: receiptPath || null,
            notes: notes?.trim() || null,
            customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.DbNull,
            beritaAcara: finalBeritaAcara,
          },
        });

        await createAuditLog({
          userId: user.id,
          actionType: 'CREATE',
          targetTable: 'Transaction',
          targetId: String(newTx.id),
          description: `Mencatat transaksi baru: "${newTx.description}" senilai Rp ${Number(newTx.totalAmount).toLocaleString('id-ID')}`,
        });
      }
    } catch (error) {
      console.error('Error during transaction create:', error);
      return {
        success: false,
        error: 'Terjadi kesalahan sistem saat menyimpan transaksi.',
      };
    }

    // Clear router cache tags to trigger live layout refreshes
    revalidatePath('/dashboard');
    revalidatePath('/transaksi/riwayat');
    revalidatePath('/ongoing/list');

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
  missingReceipt?: boolean;
}

export interface TransactionWithRelations extends Omit<Transaction, 'quantity' | 'pricePerUnit' | 'totalAmount' | 'discountPerUnit' | 'discountTotal' | 'taxAmount'> {
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  discountPerUnit: number | null;
  discountTotal: number | null;
  taxAmount: number | null;
  category: Category;
  subCategory: SubCategory | null;
  branch: Branch;
  user: {
    fullName: string;
    username: string;
  };
  beritaAcara: string | null;
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
      missingReceipt,
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

    if (missingReceipt) {
      where.receiptPath = null;
    }

    if (search && search.trim() !== '') {
      const queryStr = search.trim();
      where.OR = [
        { beritaAcara: { contains: queryStr, mode: 'insensitive' } },
        { description: { contains: queryStr, mode: 'insensitive' } },
        { vendor: { contains: queryStr, mode: 'insensitive' } },
        { notes: { contains: queryStr, mode: 'insensitive' } },
        { unit: { contains: queryStr, mode: 'insensitive' } },
        {
          category: {
            name: { contains: queryStr, mode: 'insensitive' },
          },
        },
        {
          subCategory: {
            name: { contains: queryStr, mode: 'insensitive' },
          },
        },
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

    // Deep clone to strip Prisma proxy objects which crash Next.js RSC streaming
    const plainTransactions = JSON.parse(JSON.stringify(transactions));

    const serializedTransactions: TransactionWithRelations[] = plainTransactions.map((t: any) => ({
      ...t,
      quantity: Number(t.quantity),
      pricePerUnit: Number(t.pricePerUnit),
      totalAmount: Number(t.totalAmount),
      discountPerUnit: t.discountPerUnit ? Number(t.discountPerUnit) : null,
      discountTotal: t.discountTotal ? Number(t.discountTotal) : null,
      taxAmount: t.taxAmount ? Number(t.taxAmount) : null,
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

    // Fetch details before deletion
    const targetTx = await prisma.transaction.findUnique({
      where: { id },
      select: { description: true, totalAmount: true },
    });

    // Delete transaction cleanly from Prisma, including its corresponding ongoing payment request
    await prisma.ongoingPayment.deleteMany({
      where: { transactionId: id },
    });

    await prisma.transaction.delete({
      where: { id },
    });

    if (targetTx) {
      await createAuditLog({
        userId: user.id,
        actionType: 'DELETE',
        targetTable: 'Transaction',
        targetId: String(id),
        description: `Menghapus transaksi ID ${id}: "${targetTx.description}" senilai Rp ${Number(targetTx.totalAmount).toLocaleString('id-ID')}`,
      });
    }

    // Clear router cache tags to trigger live layout refreshes
    revalidatePath('/dashboard');
    revalidatePath('/transaksi/riwayat');
    revalidatePath('/ongoing/list');

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

/**
 * Server Action to fetch a single transaction with all its relations for detail view.
 */
export async function getTransactionById(
  id: number
): Promise<ApiResponse<TransactionWithRelations>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      };
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
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
    });

    if (!transaction) {
      return {
        success: false,
        error: 'Transaksi tidak ditemukan.',
      };
    }

    // Role boundary locking check: ADMIN/DATA_ENTRY/VIEWER are locked to their branch
    if (user.role !== 'SUPERADMIN' && transaction.branchId !== user.branchId) {
      return {
        success: false,
        error: 'Akses ditolak. Anda tidak memiliki izin untuk melihat transaksi cabang lain.',
      };
    }

    const serializedTransaction: TransactionWithRelations = {
      ...transaction,
      quantity: Number(transaction.quantity),
      pricePerUnit: Number(transaction.pricePerUnit),
      totalAmount: Number(transaction.totalAmount),
      discountPerUnit: transaction.discountPerUnit ? Number(transaction.discountPerUnit) : null,
      discountTotal: transaction.discountTotal ? Number(transaction.discountTotal) : null,
      taxAmount: transaction.taxAmount ? Number(transaction.taxAmount) : null,
    };

    return {
      success: true,
      data: serializedTransaction,
    };
  } catch (error) {
    console.error('Error inside getTransactionById Server Action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memuat detail transaksi.',
    };
  }
}

/**
 * Server Action to securely update a transaction's receipt path (and linked ongoing payment final receipt).
 * Enforces role boundaries (deny VIEWER) and revalidates Next.js pages.
 */
export async function updateTransactionReceipt(
  id: number,
  receiptPath: string
): Promise<ApiResponse<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      };
    }

    if (user.role === 'VIEWER') {
      return {
        success: false,
        error: 'Akses ditolak: Viewer tidak diizinkan mengubah berkas.',
      };
    }

    // Input validation
    if (!receiptPath || receiptPath.trim() === '') {
      return {
        success: false,
        error: 'Path bukti kuitansi tidak boleh kosong.',
      };
    }
    if (receiptPath.length > 500) {
      return {
        success: false,
        error: 'Path bukti kuitansi terlalu panjang.',
      };
    }

    // Fetch existing transaction to verify branch ownership/role boundary
    const tx = await prisma.transaction.findUnique({
      where: { id },
      select: { branchId: true, description: true }
    });

    if (!tx) {
      return {
        success: false,
        error: 'Transaksi tidak ditemukan.',
      };
    }

    // Restrict DATA_ENTRY to their own branch
    if (user.role !== 'SUPERADMIN' && tx.branchId !== user.branchId) {
      return {
        success: false,
        error: 'Akses ditolak: Anda tidak memiliki izin untuk mengedit transaksi cabang lain.',
      };
    }

    // Perform database writes in transaction to update receipt on Transaction and sync with OngoingPayment
    await prisma.$transaction(async (db) => {
      await db.transaction.update({
        where: { id },
        data: { receiptPath },
      });

      // Update final receipt path for the linked ongoing payment if it exists
      await db.ongoingPayment.updateMany({
        where: { transactionId: id },
        data: { finalReceiptPath: receiptPath },
      });

      await createAuditLog({
        userId: user.id,
        actionType: 'UPDATE',
        targetTable: 'Transaction',
        targetId: String(id),
        description: `Mengunggah bukti kuitansi untuk transaksi: "${tx.description}"`,
      }, db);
    });

    revalidatePath('/dashboard');
    revalidatePath('/transaksi/riwayat');
    revalidatePath('/ongoing/list');

    return {
      success: true,
      message: 'Bukti kuitansi berhasil diperbarui.',
    };
  } catch (error) {
    console.error('Error inside updateTransactionReceipt Server Action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat menyimpan bukti kuitansi.',
    };
  }
}

/**
 * Server Action to securely update a transaction's details.
 * Performs strict input validation, re-calculates totalAmount, and checks role boundaries.
 */
export async function updateTransaction(
  id: number,
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

    if (user.role === 'VIEWER') {
      return {
        success: false,
        error: 'Akses ditolak. Peran Viewer tidak diizinkan untuk mengubah data.',
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
      discountPerUnit,
      discountTotal,
      taxAmount,
      taxNote,
      paymentMethod,
      location,
      vendor,
      receiptPath,
      notes,
      customFields,
      beritaAcara,
    } = data;

    // Fetch existing transaction first
    const existingTx = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!existingTx) {
      return {
        success: false,
        error: 'Transaksi tidak ditemukan.',
      };
    }

    // Role boundary check: ADMIN/DATA_ENTRY are locked to their home branch
    if (user.role !== 'SUPERADMIN' && existingTx.branchId !== user.branchId) {
      return {
        success: false,
        error: 'Akses ditolak. Anda tidak memiliki izin untuk mengubah transaksi cabang lain.',
      };
    }

    // Fail-fast on required primary field parameters
    if (!categoryId || !transactionDate || !description.trim() || quantity <= 0 || !unit.trim() || pricePerUnit < 0 || !paymentMethod) {
      return {
        success: false,
        error: 'Mohon lengkapi semua bidang wajib dengan benar.',
      };
    }

    // Input length validation
    if (description.length > 255) {
      return { success: false, error: 'Keterangan transaksi maksimal 255 karakter.' };
    }
    if (unit.length > 20) {
      return { success: false, error: 'Satuan unit maksimal 20 karakter.' };
    }
    if (taxNote && taxNote.length > 50) {
      return { success: false, error: 'Catatan pajak maksimal 50 karakter.' };
    }
    if (vendor && vendor.length > 100) {
      return { success: false, error: 'Vendor maksimal 100 karakter.' };
    }
    if (notes && notes.length > 5000) {
      return { success: false, error: 'Catatan tambahan maksimal 5000 karakter.' };
    }
    if (beritaAcara && beritaAcara.length > 50) {
      return { success: false, error: 'Nomor Berita Acara maksimal 50 karakter.' };
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
      // ADMIN/DATA_ENTRY: cannot change branch, must keep transaction's branch
      targetBranchId = existingTx.branchId;
    }

    // Compute total using full breakdown formula
    const qty = new Prisma.Decimal(quantity);
    const price = new Prisma.Decimal(pricePerUnit);
    let totalAmount = qty.mul(price);
    const discountPerUnitDecimal = discountPerUnit ? new Prisma.Decimal(discountPerUnit) : null;
    const discountTotalDecimal = discountTotal ? new Prisma.Decimal(discountTotal) : null;
    const taxAmountDecimal = taxAmount ? new Prisma.Decimal(taxAmount) : null;
    if (discountPerUnitDecimal) totalAmount = totalAmount.sub(discountPerUnitDecimal.mul(qty));
    if (discountTotalDecimal) totalAmount = totalAmount.sub(discountTotalDecimal);
    if (taxAmountDecimal) totalAmount = totalAmount.add(taxAmountDecimal);
    
    // Guard: total cannot be negative
    if (totalAmount.lessThan(0)) totalAmount = new Prisma.Decimal(0);

    const txDate = new Date(transactionDate);

    // If Berita Acara is modified, check uniqueness
    let finalBeritaAcara: string | null = null;
    if (beritaAcara && beritaAcara.trim() !== '') {
      const trimmedBA = beritaAcara.trim();
      if (trimmedBA !== existingTx.beritaAcara) {
        // Unique check
        const existing = await prisma.transaction.findFirst({
          where: { beritaAcara: trimmedBA },
          select: { id: true },
        });
        
        if (existing) {
          return {
            success: false,
            error: 'Nomor Berita Acara tersebut sudah digunakan oleh transaksi lain.',
          };
        }
      }
      finalBeritaAcara = trimmedBA;
    }

    // Update inside a database transaction to keep OngoingPayment amount in sync if linked
    await prisma.$transaction(async (tx) => {
      const updatedTx = await tx.transaction.update({
        where: { id },
        data: {
          branchId: targetBranchId,
          categoryId: Number(categoryId),
          subCategoryId: subCategoryId ? Number(subCategoryId) : null,
          transactionDate: txDate,
          description: description.trim(),
          quantity: qty,
          unit: unit.trim(),
          pricePerUnit: price,
          discountPerUnit: discountPerUnitDecimal,
          discountTotal: discountTotalDecimal,
          taxAmount: taxAmountDecimal,
          taxNote: taxNote?.trim() || null,
          totalAmount,
          paymentMethod,
          location: location || null,
          vendor: vendor?.trim() || null,
          receiptPath: receiptPath || null,
          notes: notes?.trim() || null,
          customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.DbNull,
          beritaAcara: finalBeritaAcara,
        },
      });

      // Update linked ongoing payment if it exists
      await tx.ongoingPayment.updateMany({
        where: { transactionId: id },
        data: {
          actualAmount: updatedTx.totalAmount,
          finalReceiptPath: receiptPath || null,
        },
      });

      await createAuditLog({
        userId: user.id,
        actionType: 'UPDATE',
        targetTable: 'Transaction',
        targetId: String(id),
        description: `Mengubah transaksi: "${updatedTx.description}" senilai Rp ${Number(updatedTx.totalAmount).toLocaleString('id-ID')}`,
      }, tx);
    });

    // Clear router cache tags to trigger live layout refreshes
    revalidatePath('/dashboard');
    revalidatePath('/transaksi/riwayat');
    revalidatePath('/ongoing/list');

    return {
      success: true,
      message: 'Transaksi berhasil diperbarui.',
    };
  } catch (error) {
    console.error('Error during updateTransaction Server Action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memperbarui transaksi.',
    };
  }
}

