import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getUsers } from '@/lib/actions/users';
import AuditLogClient from '@/components/admin/AuditLogClient';

/**
 * Server page routing for system activity audit trail (/admin/audit-log).
 * Secures role-based access limits and passes list of system users.
 */
export default async function AuditLogPage() {
  const actor = await getCurrentUser();

  if (!actor || actor.role !== 'SUPERADMIN') {
    redirect('/dashboard');
  }

  // Pre-seed user list for dropdown filter
  const usersResponse = await getUsers();

  return (
    <AuditLogClient
      users={usersResponse.data || []}
    />
  );
}
