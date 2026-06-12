import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getBranches } from '@/lib/actions/categories';
import { getBranchAssetStats } from '@/lib/actions/assets';
import InventoryContainer from '@/components/inventory/InventoryContainer';

/**
 * Server page component for the Inventory route (/inventaris).
 * Handles authentication checks and pre-seeds master-branches and stats arrays in parallel.
 */
export default async function InventoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Pre-seed branch configuration list and branch statistics in parallel
  const [branchesResponse, statsResponse] = await Promise.all([
    getBranches(),
    user.role === 'SUPERADMIN' ? getBranchAssetStats() : Promise.resolve({ success: true, data: [] })
  ]);

  return (
    <InventoryContainer
      user={user}
      branches={branchesResponse.data || []}
      branchStats={statsResponse.data || []}
    />
  );
}
