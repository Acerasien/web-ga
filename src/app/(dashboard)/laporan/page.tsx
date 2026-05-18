import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getBranches } from '@/lib/actions/categories';
import LaporanClient from '@/components/reports/LaporanClient';

/**
 * Server page component for the GA Reports route (/laporan).
 * Pre-seeds branch context records for role-based administrative queries.
 */
export default async function LaporanPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Pre-seed branch master list in parallel to optimize rendering speed
  const branchesResponse = await getBranches();

  return (
    <LaporanClient
      user={user}
      branches={branchesResponse.data || []}
    />
  );
}
