import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getBranches } from '@/lib/actions/categories';
import UserListingClient from '@/components/admin/UserListingClient';

/**
 * Server page routing for administrative User Management (/admin/users).
 * Locks security guards and pre-seeds branches master list.
 */
export default async function UserManagementPage() {
  const actor = await getCurrentUser();

  if (!actor || actor.role !== 'SUPERADMIN') {
    redirect('/dashboard');
  }

  // Pre-seed branch master list in parallel
  const branchesResponse = await getBranches();

  return (
    <UserListingClient
      branches={branchesResponse.data || []}
    />
  );
}
