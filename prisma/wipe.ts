import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Wiping transaction history and related records...');

  // 1. Delete Ongoing Payments (which reference transactions, categories, recurring bills)
  const deletedOngoingPayments = await prisma.ongoingPayment.deleteMany({});
  console.log(`✅ Deleted ${deletedOngoingPayments.count} Ongoing Payments`);

  // 2. Delete Recurring Bills
  const deletedRecurringBills = await prisma.recurringBill.deleteMany({});
  console.log(`✅ Deleted ${deletedRecurringBills.count} Recurring Bills`);

  // 3. Delete Transactions
  const deletedTransactions = await prisma.transaction.deleteMany({});
  console.log(`✅ Deleted ${deletedTransactions.count} Transactions`);

  // 4. Delete Audit Logs
  const deletedAuditLogs = await prisma.auditLog.deleteMany({});
  console.log(`✅ Deleted ${deletedAuditLogs.count} Audit Logs`);

  console.log('🎉 Database wipe complete!');
}

main()
  .catch((e) => {
    console.error('❌ Wipe failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
