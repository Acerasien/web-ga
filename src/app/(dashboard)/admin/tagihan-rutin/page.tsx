import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getRecurringBills } from '@/lib/actions/recurring';
import { getBranches, getCategoriesWithSub } from '@/lib/actions/categories';
import RecurringBillListingClient from '@/components/admin/RecurringBillListingClient';

/**
 * Server page for Recurring Bill management (/admin/tagihan-rutin).
 * Accessible to SUPERADMIN and ADMIN roles.
 */
export default async function TagihanRutinPage() {
  const actor = await getCurrentUser();

  if (!actor || (actor.role !== 'SUPERADMIN' && actor.role !== 'ADMIN')) {
    redirect('/dashboard');
  }

  const [billsResponse, branchesResponse, categoriesResponse] = await Promise.all([
    getRecurringBills({ page: 1, limit: 50 }),
    actor.role === 'SUPERADMIN' ? getBranches() : Promise.resolve({ success: true, data: [] }),
    getCategoriesWithSub(),
  ]);

  const initialBills = billsResponse.success && billsResponse.data ? billsResponse.data.bills : [];
  const branches = branchesResponse.success && branchesResponse.data ? branchesResponse.data : [];
  const categories = categoriesResponse.success && categoriesResponse.data ? categoriesResponse.data : [];


  return (
    <RecurringBillListingClient
      user={actor}
      initialBills={initialBills}
      branches={branches}
      categories={categories}
    />
  );
}
