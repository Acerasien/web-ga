import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getCategoriesWithSub, getBranches } from '@/lib/actions/categories';
import OngoingHistoryClient from '@/components/ongoing/OngoingHistoryClient';

/**
 * Server page component for the Ongoing Payment History route (/ongoing/riwayat).
 * Resolves active session data, enforces strict role-based access boundaries,
 * and feeds metadata into the history component.
 */
export default async function OngoingHistoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Poka-Yoke Check: DATA_ENTRY and VIEWER roles are restricted from Ongoing Payments.
  if (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  // Load categories and branches in parallel to optimize TTFB
  const [categoriesResponse, branchesResponse] = await Promise.all([
    getCategoriesWithSub(),
    getBranches(),
  ]);

  return (
    <OngoingHistoryClient
      user={user}
      categories={categoriesResponse.data || []}
      branches={branchesResponse.data || []}
    />
  );
}
