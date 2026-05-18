import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import CategoryListingClient from '@/components/admin/CategoryListingClient';

/**
 * Server page routing for administrative Category and Sub-category manager (/admin/kategori).
 * Enforces security gates.
 */
export default async function CategoryManagementPage() {
  const actor = await getCurrentUser();

  if (!actor || actor.role !== 'SUPERADMIN') {
    redirect('/dashboard');
  }

  return <CategoryListingClient />;
}
