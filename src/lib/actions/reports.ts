'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { ApiResponse } from '@/types';
import {
  getPeriodicMonthAndYear,
  getBoundsForPeriodicMonth,
  getPeriodicBounds,
} from '@/lib/periodicDate';

export interface ReportFilter {
  branchIds?: number[];
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  year: number;
  months?: number[];
}

export interface SubCategoryBreakdown {
  id: number;
  name: string;
  total: number;
  percentage: number;
}

export interface CategoryBreakdown {
  id: number;
  name: string;
  code: string;
  total: number;
  percentage: number;
  subCategories: SubCategoryBreakdown[];
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
  [categoryName: string]: number | string;
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

    const { period, year, months, branchIds } = filters;

    // Enforce role dynamic branch boundaries (Poka-Yoke)
    let branchIdFilter: number[] | undefined = undefined;
    if (user.role === 'SUPERADMIN') {
      if (branchIds && branchIds.length > 0) {
        branchIdFilter = branchIds.map(Number);
      }
    } else {
      // DATA_ENTRY or VIEWER: Restricted strictly to home branch
      if (!user.branchId) {
        return {
          success: false,
          error: 'Gagal memuat laporan: Akun Anda tidak memiliki cabang terdaftar.',
        };
      }
      branchIdFilter = [user.branchId];
    }

    // Determine calendar date ranges based on period scale
    const targetMonth = months && months.length > 0 ? months[0] : getPeriodicMonthAndYear(new Date()).month;
    let startDate: Date;
    let endDate: Date;

    if (period === 'YEARLY') {
      // Show trend for the last 5 periodic years (each starts Dec 21 of prev year and ends Dec 20 of current year)
      startDate = new Date(year - 5, 11, 21, 0, 0, 0, 0);
      endDate = new Date(year, 11, 20, 23, 59, 59, 999);
    } else {
      // Query the entire periodic year so that we have all target months covered (Dec 21 of prev year to Dec 20 of current year)
      startDate = new Date(year - 1, 11, 21, 0, 0, 0, 0);
      endDate = new Date(year, 11, 20, 23, 59, 59, 999);
    }

    // Build Prisma query condition
    const where: any = {
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (branchIdFilter && branchIdFilter.length > 0) {
      where.branchId = { in: branchIdFilter };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        subCategory: true,
        branch: true,
      },
      orderBy: {
        transactionDate: 'asc',
      },
    });

    // In-memory filter for selected months (if period is not YEARLY)
    const filteredTransactions = (period !== 'YEARLY' && months && months.length > 0)
      ? transactions.filter(tx => {
          const { month: periodicMonth, year: periodicYear } = getPeriodicMonthAndYear(tx.transactionDate);
          return months.includes(periodicMonth) && periodicYear === year;
        })
      : transactions;

    // 1. Calculate overall metrics
    const transactionCount = filteredTransactions.length;
    const totalSpending = filteredTransactions.reduce((sum, tx) => sum + Number(tx.totalAmount), 0);

    // 2. Category Share Breakdown
    const categoryMap: Record<
      number,
      {
        name: string;
        code: string;
        total: number;
        subCategoryMap: Record<number, { name: string; total: number }>;
        uncategorizedTotal: number;
      }
    > = {};

    filteredTransactions.forEach((tx) => {
      const cat = tx.category;
      if (!categoryMap[cat.id]) {
        categoryMap[cat.id] = {
          name: cat.name,
          code: cat.code,
          total: 0,
          subCategoryMap: {},
          uncategorizedTotal: 0,
        };
      }
      const catData = categoryMap[cat.id];
      const amount = Number(tx.totalAmount);
      catData.total += amount;

      if (tx.subCategory) {
        const sub = tx.subCategory;
        if (!catData.subCategoryMap[sub.id]) {
          catData.subCategoryMap[sub.id] = { name: sub.name, total: 0 };
        }
        catData.subCategoryMap[sub.id].total += amount;
      } else {
        catData.uncategorizedTotal += amount;
      }
    });

    const byCategory: CategoryBreakdown[] = Object.entries(categoryMap)
      .map(([idStr, data]) => {
        const total = data.total;
        const percentage = totalSpending > 0 ? (total / totalSpending) * 100 : 0;

        // Map subcategories
        const subCategories: SubCategoryBreakdown[] = Object.entries(data.subCategoryMap).map(
          ([subIdStr, subData]) => {
            const subTotal = subData.total;
            const subPercentage = total > 0 ? (subTotal / total) * 100 : 0;
            return {
              id: Number(subIdStr),
              name: subData.name,
              total: subTotal,
              percentage: Number(subPercentage.toFixed(2)),
            };
          }
        );

        // Include uncategorized if it exists
        if (data.uncategorizedTotal > 0) {
          const subPercentage = total > 0 ? (data.uncategorizedTotal / total) * 100 : 0;
          subCategories.push({
            id: 0,
            name: 'Lain-lain / Tanpa Sub-kategori',
            total: data.uncategorizedTotal,
            percentage: Number(subPercentage.toFixed(2)),
          });
        }

        // Sort subcategories by total descending
        subCategories.sort((a, b) => b.total - a.total);

        return {
          id: Number(idStr),
          name: data.name,
          code: data.code,
          total,
          percentage: Number(percentage.toFixed(2)),
          subCategories,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Collect all active category names for trend initialization
    const categoryNames = byCategory.map((c) => c.name);

    // 3. Branch Spending Breakdown (Considers Superadmin view scopes)
    const branchMap: Record<number, { name: string; code: string; total: number }> = {};
    filteredTransactions.forEach((tx) => {
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
      const { startDate: pStart, endDate: pEnd } = getBoundsForPeriodicMonth(targetMonth, year);
      const currentDate = new Date(pStart);
      const monthsIndo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

      while (currentDate <= pEnd) {
        const d = currentDate.getDate();
        const m = currentDate.getMonth() + 1;
        const y = currentDate.getFullYear();

        const dayTxs = filteredTransactions.filter((tx) => {
          const txDate = new Date(tx.transactionDate);
          return txDate.getDate() === d && txDate.getMonth() + 1 === m && txDate.getFullYear() === y;
        });

        const label = `${d} ${monthsIndo[currentDate.getMonth()]}`;

        const coordinate: TrendCoordinate = {
          label,
          total: dayTxs.reduce((sum, tx) => sum + Number(tx.totalAmount), 0),
        };

        categoryNames.forEach((name) => {
          coordinate[name] = 0;
        });

        dayTxs.forEach((tx) => {
          const name = tx.category.name;
          coordinate[name] = Number(coordinate[name]) + Number(tx.totalAmount);
        });

        trendData.push(coordinate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (period === 'WEEKLY') {
      const { startDate: pStart } = getBoundsForPeriodicMonth(targetMonth, year);
      
      for (let w = 1; w <= 5; w++) {
        const weekTxs = filteredTransactions.filter((tx) => {
          const txDate = new Date(tx.transactionDate);
          const diffTime = txDate.getTime() - pStart.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          const weekIndex = Math.floor(diffDays / 7) + 1;
          
          if (w === 5) {
            return weekIndex >= 5;
          }
          return weekIndex === w;
        });

        const coordinate: TrendCoordinate = {
          label: `Minggu ${w}`,
          total: weekTxs.reduce((sum, tx) => sum + Number(tx.totalAmount), 0),
        };

        categoryNames.forEach((name) => {
          coordinate[name] = 0;
        });

        weekTxs.forEach((tx) => {
          const name = tx.category.name;
          coordinate[name] = Number(coordinate[name]) + Number(tx.totalAmount);
        });

        trendData.push(coordinate);
      }
    } else if (period === 'MONTHLY') {
      const monthsIndo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
      for (let m = 1; m <= 12; m++) {
        const monthTxs = filteredTransactions.filter((tx) => {
          const txDate = new Date(tx.transactionDate);
          const { month: periodicMonth, year: periodicYear } = getPeriodicMonthAndYear(txDate);
          return periodicMonth === m && periodicYear === year;
        });

        const coordinate: TrendCoordinate = {
          label: monthsIndo[m - 1],
          total: monthTxs.reduce((sum, tx) => sum + Number(tx.totalAmount), 0),
        };

        categoryNames.forEach((name) => {
          coordinate[name] = 0;
        });

        monthTxs.forEach((tx) => {
          const name = tx.category.name;
          coordinate[name] = Number(coordinate[name]) + Number(tx.totalAmount);
        });

        trendData.push(coordinate);
      }
    } else if (period === 'YEARLY') {
      for (let y = year - 4; y <= year; y++) {
        const yearTxs = filteredTransactions.filter((tx) => {
          const txDate = new Date(tx.transactionDate);
          const { year: periodicYear } = getPeriodicMonthAndYear(txDate);
          return periodicYear === y;
        });

        const coordinate: TrendCoordinate = {
          label: String(y),
          total: yearTxs.reduce((sum, tx) => sum + Number(tx.totalAmount), 0),
        };

        categoryNames.forEach((name) => {
          coordinate[name] = 0;
        });

        yearTxs.forEach((tx) => {
          const name = tx.category.name;
          coordinate[name] = Number(coordinate[name]) + Number(tx.totalAmount);
        });

        trendData.push(coordinate);
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

export interface ComparisonPeriod {
  year: number;
  month: number; // 1-12
}

export interface ComparisonFilter {
  periods: ComparisonPeriod[]; // Selected year-month combinations
  compareType: 'TOTAL' | 'CATEGORY';
  categoryIds?: number[]; // Required if compareType is 'CATEGORY'
}

export interface ComparisonDataPoint {
  label: string; // e.g. "Des '25", "Jan '26"
  monthIndex: number; // 1-12
  year: number;
  [branchCode: string]: number | string; // Dynamic branch spending
}

export interface ComparisonPayload {
  chartData: ComparisonDataPoint[];
  activeBranches: { code: string; name: string }[];
}

/**
 * Server Action to fetch comparative spending across branches for selected months (Superadmin Only).
 * Employs Option 1: Single database query with in-memory aggregations across years.
 */
export async function getBranchComparisonData(
  filters: ComparisonFilter
): Promise<ApiResponse<ComparisonPayload>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan membandingkan data cabang.',
      };
    }

    const { periods, compareType, categoryIds } = filters;

    if (!periods || periods.length === 0) {
      return {
        success: true,
        data: {
          chartData: [],
          activeBranches: [],
        },
      };
    }

    // 1. Fetch active branches to generate dynamic series mapping
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { code: 'asc' },
    });

    // Sort periods chronologically
    const sortedPeriods = [...periods].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    // 2. Fetch transactions falling in the year-month boundaries
    const boundsList = sortedPeriods.map(p => getBoundsForPeriodicMonth(p.month, p.year));
    const startDate = new Date(Math.min(...boundsList.map(b => b.startDate.getTime())));
    const endDate = new Date(Math.max(...boundsList.map(b => b.endDate.getTime())));

    const where: any = {
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (compareType === 'CATEGORY' && categoryIds && categoryIds.length > 0) {
      where.categoryId = {
        in: categoryIds.map(Number),
      };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        totalAmount: true,
        transactionDate: true,
        branchId: true,
        branch: {
          select: {
            code: true,
          },
        },
      },
    });

    // 3. Aggregate totals in memory by grouping by month-year and branch code
    const monthsIndo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

    const chartData: ComparisonDataPoint[] = sortedPeriods.map((p) => {
      const yearShort = String(p.year).substring(2);
      const dataPoint: ComparisonDataPoint = {
        label: `${monthsIndo[p.month - 1]} '${yearShort}`,
        monthIndex: p.month,
        year: p.year,
      };

      // Pre-fill every active branch with 0
      branches.forEach((b) => {
        dataPoint[b.code] = 0;
      });

      // Filter transactions for this specific periodic month/year
      const matchedTxs = transactions.filter((tx) => {
        const txDate = new Date(tx.transactionDate);
        const { month: periodicMonth, year: periodicYear } = getPeriodicMonthAndYear(txDate);
        return periodicMonth === p.month && periodicYear === p.year;
      });

      // Sum up totals
      matchedTxs.forEach((tx) => {
        const bCode = tx.branch.code;
        if (dataPoint[bCode] !== undefined) {
          dataPoint[bCode] = Number(dataPoint[bCode]) + Number(tx.totalAmount);
        }
      });

      return dataPoint;
    });

    return {
      success: true,
      data: {
        chartData,
        activeBranches: branches.map((b) => ({ code: b.code, name: b.name })),
      },
    };
  } catch (error) {
    console.error('Error in getBranchComparisonData server action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat mengambil data perbandingan cabang.',
    };
  }
}
