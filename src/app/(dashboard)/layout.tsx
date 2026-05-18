import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import DashboardShell from '@/components/layout/DashboardShell';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared layout wrapper for all authenticated dashboard pages under (dashboard) route group.
 * Server component that retrieves the dynamic session before client mounting.
 */
export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  // Query active session and database status
  const user = await getCurrentUser();

  // Fail-safe: If the middleware let a request slip through but the session is invalid,
  // redirect immediately to login.
  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  );
}
