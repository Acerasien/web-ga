'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { ApiResponse } from '@/types';
import { Prisma } from '@prisma/client';

export interface AuditLogWithUser {
  id: number;
  userId: number;
  actionType: string;
  targetTable: string;
  targetId: string;
  description: string;
  createdAt: Date;
  user: {
    fullName: string;
    username: string;
  };
}

export interface AuditLogsResponse {
  logs: AuditLogWithUser[];
  totalCount: number;
  totalPages: number;
}

interface AuditLogData {
  userId: number;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE';
  targetTable: string;
  targetId: string;
  description: string;
}

/**
 * Reusable server function to log an activity.
 * Can be run within an existing Prisma Transaction Client.
 */
export async function createAuditLog(
  data: AuditLogData,
  tx?: Prisma.TransactionClient
) {
  try {
    const db = tx || prisma;
    await db.auditLog.create({
      data: {
        userId: data.userId,
        actionType: data.actionType,
        targetTable: data.targetTable,
        targetId: data.targetId,
        description: data.description,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Fetch paginated and filtered audit logs (Superadmin Only).
 */
export async function getAuditLogs(params: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  userId?: number;
  actionType?: string;
  targetTable?: string;
  search?: string;
}): Promise<ApiResponse<AuditLogsResponse>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan melihat log audit.',
      };
    }

    const page = params.page || 1;
    const limit = params.limit || 25;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (params.userId) {
      where.userId = params.userId;
    }

    if (params.actionType) {
      where.actionType = params.actionType;
    }

    if (params.targetTable) {
      where.targetTable = params.targetTable;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = new Date(`${params.startDate}T00:00:00.000Z`);
      }
      if (params.endDate) {
        where.createdAt.lte = new Date(`${params.endDate}T23:59:59.999Z`);
      }
    }

    if (params.search && params.search.trim() !== '') {
      const cleanSearch = params.search.trim();
      where.OR = [
        {
          description: {
            contains: cleanSearch,
            mode: 'insensitive',
          },
        },
        {
          user: {
            fullName: {
              contains: cleanSearch,
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            username: {
              contains: cleanSearch,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              fullName: true,
              username: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: {
        logs: logs as AuditLogWithUser[],
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error) {
    console.error('Error in getAuditLogs action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat mengambil data log audit.',
    };
  }
}

/**
 * Server Action to delete audit logs older than a specific number of days (Superadmin Only).
 */
export async function purgeAuditLogs(days: number): Promise<ApiResponse<{ count: number }>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan membersihkan log audit.',
      };
    }

    if (days <= 0) {
      return {
        success: false,
        error: 'Jumlah hari harus lebih besar dari 0.',
      };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    // Write a record in audit logs about this purge activity
    await createAuditLog({
      userId: actor.id,
      actionType: 'DELETE',
      targetTable: 'AuditLog',
      targetId: 'ALL',
      description: `Melakukan pembersihan database log audit: menghapus ${result.count} data log yang lebih lama dari ${days} hari`,
    });

    return {
      success: true,
      data: { count: result.count },
      message: `Berhasil menghapus ${result.count} log audit lama yang berusia lebih dari ${days} hari.`,
    };
  } catch (error) {
    console.error('Error in purgeAuditLogs action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat membersihkan data log audit.',
    };
  }
}
