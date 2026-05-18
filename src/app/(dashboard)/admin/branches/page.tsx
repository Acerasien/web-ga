import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import BranchListingClient from '@/components/admin/BranchListingClient';

/**
 * Server page routing for administrative Branch Management (/admin/branches).
 * Enforces strict role checks.
 */
export default async function BranchManagementPage() {
  const actor = await getCurrentUser();

  if (!actor || actor.role !== 'SUPERADMIN') {
    redirect('/dashboard');
  }

  return <BranchListingClient />;
}
