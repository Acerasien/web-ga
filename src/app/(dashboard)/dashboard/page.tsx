import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getDashboardStats } from '@/lib/actions/dashboard';
import DashboardClient from '@/components/dashboard/DashboardClient';

/**
 * Main /dashboard home page.
 * Server component that fetches live user details and seeds live aggregated database metrics.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch real, dynamically aggregated database statistics from PostgreSQL
  const response = await getDashboardStats();

  const initialStats = response.success && response.data
    ? response.data
    : {
        monthlyExpense: 0,
        monthlyCount: 0,
        pettyCashExpense: 0,
        recentTransactions: [],
      };

  return (
    <DashboardClient
      user={user}
      initialStats={initialStats}
    />
  );
}
