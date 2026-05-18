import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getCategoriesWithSub, getBranches } from '@/lib/actions/categories';
import HistoryContainer from '@/components/history/HistoryContainer';

/**
 * Server page component for the transaction history route (/transaksi/riwayat).
 * Resolves session permissions and pre-seeds master-dropdown arrays in parallel.
 */
export default async function TransactionHistoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Pre-seed category configurations and branches in parallel to optimize rendering speed
  const [categoriesResponse, branchesResponse] = await Promise.all([
    getCategoriesWithSub(),
    getBranches(),
  ]);

  return (
    <HistoryContainer
      user={user}
      categories={categoriesResponse.data || []}
      branches={branchesResponse.data || []}
    />
  );
}
