'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { ApiResponse } from '@/types';
import { revalidatePath } from 'next/cache';

export interface BranchAdminPayload {
  id: number;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  userCount: number;
  transactionCount: number;
  totalSpending: number;
}

/**
 * Server Action to list all branches with live aggregated analytics (Superadmin Only).
 */
export async function getAdminBranches(): Promise<ApiResponse<BranchAdminPayload[]>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan mengelola cabang.',
      };
    }

    const branches = await prisma.branch.findMany({
      include: {
        _count: {
          select: {
            users: true,
            transactions: true,
          },
        },
        transactions: {
          select: {
            totalAmount: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });

    const payload: BranchAdminPayload[] = branches.map((b) => {
      const totalSpending = b.transactions.reduce((sum, tx) => sum + Number(tx.totalAmount), 0);
      return {
        id: b.id,
        name: b.name,
        code: b.code,
        address: b.address,
        isActive: b.isActive,
        createdAt: b.createdAt,
        userCount: b._count.users,
        transactionCount: b._count.transactions,
        totalSpending,
      };
    });

    return {
      success: true,
      data: payload,
    };
  } catch (error) {
    console.error('Error in getAdminBranches action:', error);
    return {
      success: false,
      error: 'Gagal menyusun daftar cabang.',
    };
  }
}

/**
 * Server Action to create a new branch site (Superadmin Only).
 */
export async function createBranch(data: {
  name: string;
  code: string;
  address?: string | null;
}): Promise<ApiResponse<BranchAdminPayload>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan menambah cabang.',
      };
    }

    const { name, code, address } = data;

    // 1. Validations
    if (!name || name.trim() === '') {
      return { success: false, error: 'Nama cabang wajib diisi.' };
    }
    if (!code || code.trim() === '') {
      return { success: false, error: 'Kode cabang wajib diisi.' };
    }

    const cleanCode = code.trim().toUpperCase();

    // 2. Validate uniqueness of branch code
    const exists = await prisma.branch.findUnique({
      where: { code: cleanCode },
    });
    if (exists) {
      return { success: false, error: `Kode cabang '${cleanCode}' telah digunakan.` };
    }

    const newBranch = await prisma.branch.create({
      data: {
        name: name.trim(),
        code: cleanCode,
        address: address?.trim() || null,
        isActive: true,
      },
    });

    revalidatePath('/admin/branches');
    revalidatePath('/admin/users');
    revalidatePath('/transaksi/riwayat');

    return {
      success: true,
      data: {
        id: newBranch.id,
        name: newBranch.name,
        code: newBranch.code,
        address: newBranch.address,
        isActive: newBranch.isActive,
        createdAt: newBranch.createdAt,
        userCount: 0,
        transactionCount: 0,
        totalSpending: 0,
      },
    };
  } catch (error) {
    console.error('Error in createBranch action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat membuat data cabang.',
    };
  }
}

/**
 * Server Action to update branch details (Superadmin Only).
 */
export async function updateBranch(
  id: number,
  data: {
    name?: string;
    code?: string;
    address?: string | null;
    isActive?: boolean;
  }
): Promise<ApiResponse<BranchAdminPayload>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan memperbarui cabang.',
      };
    }

    const { name, code, address, isActive } = data;

    const updateData: any = {};

    if (name !== undefined) {
      if (name.trim() === '') {
        return { success: false, error: 'Nama cabang tidak boleh kosong.' };
      }
      updateData.name = name.trim();
    }

    if (code !== undefined) {
      if (code.trim() === '') {
        return { success: false, error: 'Kode cabang tidak boleh kosong.' };
      }
      const cleanCode = code.trim().toUpperCase();

      // Check unique constraints
      const exists = await prisma.branch.findUnique({
        where: { code: cleanCode },
      });
      if (exists && exists.id !== id) {
        return { success: false, error: `Kode cabang '${cleanCode}' telah digunakan cabang lain.` };
      }
      updateData.code = cleanCode;
    }

    if (address !== undefined) {
      updateData.address = address?.trim() || null;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            users: true,
            transactions: true,
          },
        },
        transactions: {
          select: {
            totalAmount: true,
          },
        },
      },
    });

    const totalSpending = updated.transactions.reduce((sum, tx) => sum + Number(tx.totalAmount), 0);

    revalidatePath('/admin/branches');
    revalidatePath('/admin/users');
    revalidatePath('/transaksi/riwayat');
    revalidatePath('/laporan');

    return {
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        address: updated.address,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        userCount: updated._count.users,
        transactionCount: updated._count.transactions,
        totalSpending,
      },
    };
  } catch (error) {
    console.error('Error in updateBranch action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memperbarui data cabang.',
    };
  }
}
