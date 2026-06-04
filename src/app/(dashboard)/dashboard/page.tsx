import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getDashboardStats } from '@/lib/actions/dashboard';
import { getReportData } from '@/lib/actions/reports';
import { getBranches } from '@/lib/actions/categories';
import DashboardClient from '@/components/dashboard/DashboardClient';

interface PageProps {
  searchParams: Promise<{
    branchId?: string;
  }>;
}

/**
 * Main /dashboard home page.
 * Server component that fetches live user details and seeds live aggregated database metrics.
 */
export default async function DashboardPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { branchId } = await searchParams;
  const selectedBranchId = branchId ? Number(branchId) : undefined;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Execute database queries in parallel to optimize rendering speed (Poka-Yoke)
  const [statsResponse, chartResponse, branchesResponse] = await Promise.all([
    getDashboardStats(selectedBranchId),
    getReportData({
      period: 'DAILY',
      year: currentYear,
      months: [currentMonth],
      branchIds: selectedBranchId ? [selectedBranchId] : undefined,
    }),
    user.role === 'SUPERADMIN' ? getBranches() : Promise.resolve({ success: true, data: [] }),
  ]);

  const initialStats = statsResponse.success && statsResponse.data
    ? statsResponse.data
    : {
        monthlyExpense: 0,
        monthlyCount: 0,
        pettyCashExpense: 0,
        recentTransactions: [],
        activeOngoingPayments: [],
        activePanjarExpense: 0,
        pendingRecurringCount: 0,
        dueRecurringPayments: [],
      };

  const initialChartData = chartResponse.success && chartResponse.data
    ? chartResponse.data
    : {
        totalSpending: 0,
        transactionCount: 0,
        byCategory: [],
        byBranch: [],
        trendData: [],
      };

  const branches = branchesResponse.success && branchesResponse.data
    ? branchesResponse.data
    : [];

  return (
    <DashboardClient
      user={user}
      initialStats={initialStats}
      initialChartData={initialChartData}
      branches={branches}
      selectedBranchId={selectedBranchId}
    />
  );
}

