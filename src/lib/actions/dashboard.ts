'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { ApiResponse } from '@/types';
import type { TransactionWithRelations } from '@/lib/actions/transactions';
import { Prisma } from '@prisma/client';
import type { OngoingPaymentWithRelations } from './ongoing';

export interface DashboardStats {
  monthlyExpense: number;
  monthlyCount: number;
  pettyCashExpense: number;
  recentTransactions: TransactionWithRelations[];
  activeOngoingPayments: OngoingPaymentWithRelations[];
  activePanjarExpense: number;
}

/**
 * Server Action to compile live, aggregated dashboard statistics for General Affairs.
 * Restricts query scopes based on logged-in user permissions.
 */
export async function getDashboardStats(selectedBranchId?: number): Promise<ApiResponse<DashboardStats>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      };
    }

    // Role dynamic branch filtering (Poka-Yoke)
    let branchIdFilter: number | undefined = undefined;
    if (user.role === 'SUPERADMIN') {
      if (selectedBranchId) {
        branchIdFilter = Number(selectedBranchId);
      }
    } else {
      // DATA_ENTRY or VIEWER: Hard-bound to their own branch
      if (!user.branchId) {
        return {
          success: false,
          error: 'Cabang asal tidak terdaftar untuk akun Anda.',
        };
      }
      branchIdFilter = user.branchId;
    }

    // Determine current month calendar boundaries in local timezone
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Build the dynamic Prisma where clause
    const baseWhere: Prisma.TransactionWhereInput = {
      transactionDate: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    };

    if (branchIdFilter !== undefined) {
      baseWhere.branchId = branchIdFilter;
    }

    // Execute queries in parallel using Promise.all to maximize database performance
    const [monthlySum, monthlyCount, pettyCashSum, recent, activePayments, activePaymentsSum] = await Promise.all([
      // 1. Sum total amount for current month
      prisma.transaction.aggregate({
        where: baseWhere,
        _sum: {
          totalAmount: true,
        },
      }),

      // 2. Count total transactions in current month
      prisma.transaction.count({
        where: baseWhere,
      }),

      // 3. Sum petty cash expenses in current month
      prisma.transaction.aggregate({
        where: {
          ...baseWhere,
          paymentMethod: 'PETTY_CASH',
        },
        _sum: {
          totalAmount: true,
        },
      }),

      // 4. Fetch the last 5 transactions for recent activity panel
      prisma.transaction.findMany({
        where: branchIdFilter !== undefined ? { branchId: branchIdFilter } : {},
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
        orderBy: [
          { transactionDate: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 5,
      }),

      // 5. Fetch active ongoing payments (BELUM_DIBAYAR or SUDAH_DIBAYAR)
      (user.role === 'SUPERADMIN' || user.role === 'ADMIN')
        ? prisma.ongoingPayment.findMany({
            where: {
              status: { in: ['BELUM_DIBAYAR', 'SUDAH_DIBAYAR'] },
              ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}),
            },
            include: {
              branch: true,
              category: true,
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
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : Promise.resolve([]),

      // 6. Sum outstanding panjar cash advances (SUDAH_DIBAYAR)
      (user.role === 'SUPERADMIN' || user.role === 'ADMIN')
        ? prisma.ongoingPayment.aggregate({
            where: {
              status: 'SUDAH_DIBAYAR',
              ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}),
            },
            _sum: {
              amountNeeded: true,
            },
          })
        : Promise.resolve({ _sum: { amountNeeded: null } }),
    ]);

    // Format Prisma Decimal sums to standard javascript numbers (Poka-Yoke: default nulls to 0)
    const monthlyExpenseValue = Number(monthlySum._sum.totalAmount || 0);
    const pettyCashExpenseValue = Number(pettyCashSum._sum.totalAmount || 0);

    const serializedRecent: TransactionWithRelations[] = recent.map((t) => ({
      ...t,
      quantity: Number(t.quantity),
      pricePerUnit: Number(t.pricePerUnit),
      totalAmount: Number(t.totalAmount),
    }));

    const serializedActivePayments: OngoingPaymentWithRelations[] = activePayments.map((p) => ({
      ...p,
      amountNeeded: Number(p.amountNeeded),
      actualAmount: p.actualAmount ? Number(p.actualAmount) : null,
    }));

    const panjarSum = activePaymentsSum as { _sum: { amountNeeded: Prisma.Decimal | null } };
    const activePanjarExpenseValue = Number(panjarSum._sum.amountNeeded || 0);

    return {
      success: true,
      data: {
        monthlyExpense: monthlyExpenseValue,
        monthlyCount,
        pettyCashExpense: pettyCashExpenseValue,
        recentTransactions: serializedRecent,
        activeOngoingPayments: serializedActivePayments,
        activePanjarExpense: activePanjarExpenseValue,
      },
    };
  } catch (error) {
    console.error('Error in getDashboardStats Server Action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memuat data ringkasan dashboard.',
    };
  }
}
