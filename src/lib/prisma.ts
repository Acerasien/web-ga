import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Safeguard: Intercept console.error globally to redact database credentials in logs (Finding #12)
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const dbUriRegex = /postgresql:\/\/([^:]+):([^@]+)@/g;
  const sanitizedArgs = args.map((arg) => {
    if (typeof arg === 'string') {
      return arg.replace(dbUriRegex, 'postgresql://$1:[REDACTED]@');
    }
    if (arg instanceof Error) {
      arg.message = arg.message.replace(dbUriRegex, 'postgresql://$1:[REDACTED]@');
      if (arg.stack) {
        arg.stack = arg.stack.replace(dbUriRegex, 'postgresql://$1:[REDACTED]@');
      }
    }
    return arg;
  });
  originalConsoleError.apply(console, sanitizedArgs);
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
