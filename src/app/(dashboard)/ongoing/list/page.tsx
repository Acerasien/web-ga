import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getCategoriesWithSub, getBranches } from '@/lib/actions/categories';
import OngoingDashboardClient from '@/components/ongoing/OngoingDashboardClient';

/**
 * Server page component for the Ongoing Payment route (/ongoing/list).
 * Resolves active session data, enforces strict role-based access boundaries (Poka-Yoke),
 * and feeds metadata into the dashboard components.
 */
export default async function OngoingPaymentPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Poka-Yoke Check: DATA_ENTRY and VIEWER roles are completely restricted from Ongoing Payments.
  if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  // Load categories and branches in parallel to optimize TTFB
  const [categoriesResponse, branchesResponse] = await Promise.all([
    getCategoriesWithSub(),
    getBranches(),
  ]);

  return (
    <OngoingDashboardClient
      user={user}
      categories={categoriesResponse.data || []}
      branches={branchesResponse.data || []}
    />
  );
}
