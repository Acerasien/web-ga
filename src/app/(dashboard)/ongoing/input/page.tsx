import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getCategoriesWithSub, getBranches } from '@/lib/actions/categories';
import OngoingInputClient from '@/components/ongoing/OngoingInputClient';

/**
 * Server page component for the Ongoing Payment input route (/ongoing/input).
 * Resolves active session data, enforces strict role-based access boundaries,
 * and feeds metadata into the form.
 */
export default async function OngoingInputPage() {
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
    <OngoingInputClient
      user={user}
      categories={categoriesResponse.data || []}
      branches={branchesResponse.data || []}
    />
  );
}
