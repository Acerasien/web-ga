import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getCategoriesWithSub, getBranches } from '@/lib/actions/categories';
import TransactionForm from '@/components/forms/TransactionForm';
import { prisma } from '@/lib/prisma';
import type { OngoingPayment } from '@prisma/client';

interface PageProps {
  searchParams: Promise<{ fromRecurring?: string }>;
}

/**
 * Server page component for the transaction input route (/transaksi/input).
 * Resolves active session data and seeds the form dynamically with database records.
 */
export default async function TransactionInputPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Poka-Yoke: Viewer roles have read-only access. Prevent them from ever reaching this page.
  if (user.role === 'VIEWER') {
    redirect('/dashboard');
  }

  const { fromRecurring } = await searchParams;

  // If fromRecurring is provided, fetch the OngoingPayment to prefill
  let ongoingPayment = null;
  if (fromRecurring) {
    const opId = parseInt(fromRecurring, 10);
    if (!isNaN(opId)) {
      const op = await prisma.ongoingPayment.findUnique({
        where: { id: opId }
      });
      if (op) {
        ongoingPayment = {
          id: op.id,
          categoryId: op.categoryId,
          branchId: op.branchId,
          description: op.description,
          amountNeeded: Number(op.amountNeeded),
          actualAmount: op.actualAmount ? Number(op.actualAmount) : null,
          status: op.status,
          recurringBillId: op.recurringBillId,
        };
      }
    }
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
      initialOngoingPayment={ongoingPayment}
    />
  );
}
