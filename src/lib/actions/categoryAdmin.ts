'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { ApiResponse } from '@/types';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/lib/actions/audit';

export interface SubCategoryAdminPayload {
  id: number;
  categoryId: number;
  name: string;
  createdAt: Date;
  transactionCount: number;
}

export interface CategoryAdminPayload {
  id: number;
  name: string;
  code: string;
  icon: string | null;
  isSystem: boolean;
  fieldsConfig: any;
  sortOrder: number;
  createdAt: Date;
  subCategories: SubCategoryAdminPayload[];
  transactionCount: number;
}

/**
 * Server Action to list all categories with their subcategories and live transaction counts (Superadmin Only).
 */
export async function getAdminCategories(): Promise<ApiResponse<CategoryAdminPayload[]>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan mengelola kategori.',
      };
    }

    const categories = await prisma.category.findMany({
      include: {
        subCategories: {
          include: {
            _count: {
              select: { transactions: true },
            },
          },
          orderBy: {
            name: 'asc',
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    const payload: CategoryAdminPayload[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      icon: c.icon,
      isSystem: c.isSystem,
      fieldsConfig: c.fieldsConfig,
      sortOrder: c.sortOrder,
      createdAt: c.createdAt,
      transactionCount: c._count.transactions,
      subCategories: c.subCategories.map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        name: s.name,
        createdAt: s.createdAt,
        transactionCount: s._count.transactions,
      })),
    }));

    return {
      success: true,
      data: payload,
    };
  } catch (error) {
    console.error('Error in getAdminCategories action:', error);
    return {
      success: false,
      error: 'Gagal memproses pengaturan kategori.',
    };
  }
}

/**
 * Server Action to append a new subcategory (Superadmin Only).
 * Employs case-insensitive duplicate check to prevent dual records.
 */
export async function addSubCategory(
  categoryId: number,
  name: string
): Promise<ApiResponse<SubCategoryAdminPayload>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan menambah sub-kategori.',
      };
    }

    if (!name || name.trim() === '') {
      return { success: false, error: 'Nama sub-kategori tidak boleh kosong.' };
    }

    const trimmedName = name.trim();

    // 1. Check if category exists
    const categoryExists = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!categoryExists) {
      return { success: false, error: 'Kategori utama tidak ditemukan.' };
    }

    // 2. Case-insensitive duplicate check under the same category
    const duplicate = await prisma.subCategory.findFirst({
      where: {
        categoryId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      return {
        success: false,
        error: `Sub-kategori '${trimmedName}' sudah terdaftar dalam kategori ini.`,
      };
    }

    const newSub = await prisma.subCategory.create({
      data: {
        categoryId,
        name: trimmedName,
      },
    });

    await createAuditLog({
      userId: actor.id,
      actionType: 'CREATE',
      targetTable: 'SubCategory',
      targetId: String(newSub.id),
      description: `Menambahkan sub-kategori baru "${newSub.name}" ke kategori "${categoryExists.name}"`,
    });

    revalidatePath('/admin/kategori');
    revalidatePath('/transaksi/input');

    return {
      success: true,
      data: {
        id: newSub.id,
        categoryId: newSub.categoryId,
        name: newSub.name,
        createdAt: newSub.createdAt,
        transactionCount: 0,
      },
    };
  } catch (error) {
    console.error('Error in addSubCategory action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat membuat sub-kategori.',
    };
  }
}

/**
 * Server Action to delete a subcategory (Superadmin Only).
 * Implements transaction safety boundary checks.
 */
export async function deleteSubCategory(id: number): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan menghapus sub-kategori.',
      };
    }

    // 1. Count linked transactions first (Poka-Yoke Relational Lock)
    const linkedCount = await prisma.transaction.count({
      where: { subCategoryId: id },
    });

    if (linkedCount > 0) {
      return {
        success: false,
        error: `Keamanan Relasional: Sub-kategori ini telah digunakan dalam ${linkedCount} data pengeluaran GA. Anda tidak dapat menghapus sub-kategori ini demi menjaga integritas data laporan.`,
      };
    }

    // 2. Safely perform deletion
    await prisma.subCategory.delete({
      where: { id },
    });

    await createAuditLog({
      userId: actor.id,
      actionType: 'DELETE',
      targetTable: 'SubCategory',
      targetId: String(id),
      description: `Menghapus sub-kategori ID ${id}`,
    });

    revalidatePath('/admin/kategori');
    revalidatePath('/transaksi/input');

    return {
      success: true,
      data: { success: true },
    };
  } catch (error) {
    console.error('Error in deleteSubCategory action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat menghapus sub-kategori.',
    };
  }
}
