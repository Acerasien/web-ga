import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import CSVImportClient from '@/components/imports/CSVImportClient';

/**
 * Server page component for the transaction bulk import route (/transaksi/import).
 * Validates active session permissions and locks out read-only Viewer accounts.
 */
export default async function TransactionImportPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Poka-Yoke Safeguard: Viewer roles have read-only access. Prevent them from ever reaching this page.
  if (user.role === 'VIEWER') {
    redirect('/dashboard');
  }

  return <CSVImportClient user={user} />;
}
