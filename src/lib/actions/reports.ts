'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { ApiResponse } from '@/types';

export interface ReportFilter {
  branchId?: number;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  year: number;
  month?: number; // 1-12
}

export interface CategoryBreakdown {
  id: number;
  name: string;
  code: string;
  total: number;
  percentage: number;
}

export interface BranchBreakdown {
  id: number;
  name: string;
  code: string;
  total: number;
}

export interface TrendCoordinate {
  label: string;
  total: number;
}

export interface ReportPayload {
  totalSpending: number;
  transactionCount: number;
  byCategory: CategoryBreakdown[];
  byBranch: BranchBreakdown[];
  trendData: TrendCoordinate[];
}

/**
 * Server Action to compile GA spending metrics and Recharts coordinates.
 * Isolates scopes based on dynamic role credentials (Poka-Yoke).
 */
export async function getReportData(filters: ReportFilter): Promise<ApiResponse<ReportPayload>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      };
    }

    const { period, year, month: filterMonth, branchId } = filters;

    // Enforce role dynamic branch boundaries (Poka-Yoke)
    let branchIdFilter: number | undefined = undefined;
    if (user.role === 'SUPERADMIN') {
      if (branchId) {
        branchIdFilter = Number(branchId);
      }
    } else {
      // DATA_ENTRY or VIEWER: Restricted strictly to home branch
      if (!user.branchId) {
        return {
          success: false,
          error: 'Gagal memuat laporan: Akun Anda tidak memiliki cabang terdaftar.',
        };
      }
      branchIdFilter = user.branchId;
    }

    // Determine calendar date ranges based on period scale
    const targetMonth = filterMonth ? Number(filterMonth) : new Date().getMonth() + 1;
    let startDate: Date;
    let endDate: Date;

    if (period === 'YEARLY') {
      // Show trend for the last 5 years
      startDate = new Date(year - 4, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    } else {
      // DAILY, WEEKLY, MONTHLY are evaluated inside a target year/month context
      startDate = new Date(year, targetMonth - 1, 1);
      endDate = new Date(year, targetMonth, 0, 23, 59, 59, 999);
    }

    // Build Prisma query condition
    const where: any = {
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (branchIdFilter !== undefined) {
      where.branchId = branchIdFilter;
    }

    // Fetch transactions with full relations
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        branch: true,
      },
      orderBy: {
        transactionDate: 'asc',
      },
    });

    // 1. Calculate overall metrics
    const transactionCount = transactions.length;
    const totalSpending = transactions.reduce((sum, tx) => sum + Number(tx.totalAmount), 0);

    // 2. Category Share Breakdown
    const categoryMap: Record<number, { name: string; code: string; total: number }> = {};
    transactions.forEach((tx) => {
      const cat = tx.category;
      if (!categoryMap[cat.id]) {
        categoryMap[cat.id] = { name: cat.name, code: cat.code, total: 0 };
      }
      categoryMap[cat.id].total += Number(tx.totalAmount);
    });

    const byCategory: CategoryBreakdown[] = Object.entries(categoryMap).map(([idStr, data]) => {
      const total = data.total;
      const percentage = totalSpending > 0 ? (total / totalSpending) * 100 : 0;
      return {
        id: Number(idStr),
        name: data.name,
        code: data.code,
        total,
        percentage: Number(percentage.toFixed(2)),
      };
    }).sort((a, b) => b.total - a.total);

    // 3. Branch Spending Breakdown (Considers Superadmin view scopes)
    const branchMap: Record<number, { name: string; code: string; total: number }> = {};
    transactions.forEach((tx) => {
      const br = tx.branch;
      if (!branchMap[br.id]) {
        branchMap[br.id] = { name: br.name, code: br.code, total: 0 };
      }
      branchMap[br.id].total += Number(tx.totalAmount);
    });

    const byBranch: BranchBreakdown[] = Object.entries(branchMap).map(([idStr, data]) => ({
      id: Number(idStr),
      name: data.name,
      code: data.code,
      total: data.total,
    })).sort((a, b) => b.total - a.total);

    // 4. Generate Trend Coordinates dynamically based on period scale
    const trendData: TrendCoordinate[] = [];

    if (period === 'DAILY') {
      const daysInMonth = new Date(year, targetMonth, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dayTotal = transactions
          .filter((tx) => {
            const txDate = new Date(tx.transactionDate);
            return txDate.getDate() === d && txDate.getMonth() + 1 === targetMonth && txDate.getFullYear() === year;
          })
          .reduce((sum, tx) => sum + Number(tx.totalAmount), 0);

        trendData.push({
          label: `Tgl ${d}`,
          total: dayTotal,
        });
      }
    } else if (period === 'WEEKLY') {
      // Split month into 5 standard weeks
      for (let w = 1; w <= 5; w++) {
        const weekTotal = transactions
          .filter((tx) => {
            const txDate = new Date(tx.transactionDate);
            const dayOfMonth = txDate.getDate();
            const weekIndex = Math.ceil(dayOfMonth / 7);
            return weekIndex === w && txDate.getMonth() + 1 === targetMonth && txDate.getFullYear() === year;
          })
          .reduce((sum, tx) => sum + Number(tx.totalAmount), 0);

        trendData.push({
          label: `Minggu ${w}`,
          total: weekTotal,
        });
      }
    } else if (period === 'MONTHLY') {
      const monthsIndo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
      for (let m = 1; m <= 12; m++) {
        const monthTotal = transactions
          .filter((tx) => {
            const txDate = new Date(tx.transactionDate);
            return txDate.getMonth() + 1 === m && txDate.getFullYear() === year;
          })
          .reduce((sum, tx) => sum + Number(tx.totalAmount), 0);

        trendData.push({
          label: monthsIndo[m - 1],
          total: monthTotal,
        });
      }
    } else if (period === 'YEARLY') {
      for (let y = year - 4; y <= year; y++) {
        const yearTotal = transactions
          .filter((tx) => {
            const txDate = new Date(tx.transactionDate);
            return txDate.getFullYear() === y;
          })
          .reduce((sum, tx) => sum + Number(tx.totalAmount), 0);

        trendData.push({
          label: String(y),
          total: yearTotal,
        });
      }
    }

    return {
      success: true,
      data: {
        totalSpending,
        transactionCount,
        byCategory,
        byBranch,
        trendData,
      },
    };
  } catch (error) {
    console.error('Error inside getReportData Server Action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem internal saat menyusun laporan.',
    };
  }
}
