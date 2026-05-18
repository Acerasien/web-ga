import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getCategoriesWithSub, getBranches } from '@/lib/actions/categories';
import TransactionForm from '@/components/forms/TransactionForm';

/**
 * Server page component for the transaction input route (/transaksi/input).
 * Resolves active session data and seeds the form dynamically with database records.
 */
export default async function TransactionInputPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Poka-Yoke: Viewer roles have read-only access. Prevent them from ever reaching this page.
  if (user.role === 'VIEWER') {
    redirect('/dashboard');
  }

  // Load database items in parallel to optimize rendering speed (zero layout shifts)
  const [categoriesResponse, branchesResponse] = await Promise.all([
    getCategoriesWithSub(),
    getBranches(),
  ]);

  return (
    <TransactionForm
      user={user}
      categories={categoriesResponse.data || []}
      branches={branchesResponse.data || []}
    />
  );
}
