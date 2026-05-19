import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getUserById } from '@/lib/actions/users';
import UserAuditDetailClient from '@/components/admin/UserAuditDetailClient';

interface UserAuditPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Server page routing for administrative User Audits (/admin/users/[id]).
 * Locks security guards and resolves params asynchronously to fully align with Next.js 15+ dynamic rules.
 */
export default async function UserAuditPage({ params }: UserAuditPageProps) {
  const actor = await getCurrentUser();

  // Enforce strict SUPERADMIN session lock
  if (!actor || actor.role !== 'SUPERADMIN') {
    redirect('/dashboard');
  }

  // Resolve async dynamic route parameters (Next.js 15+ requirement)
  const resolvedParams = await params;
  const userId = Number(resolvedParams.id);

  if (isNaN(userId)) {
    redirect('/admin/users');
  }

  const response = await getUserById(userId);

  // If target user not found, redirect safely back to users directory
  if (!response.success || !response.data) {
    redirect('/admin/users');
  }

  return (
    <UserAuditDetailClient user={response.data} />
  );
}
