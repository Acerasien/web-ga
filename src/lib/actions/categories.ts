'use server';

import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@/types';
import type { Category, SubCategory, Branch } from '@prisma/client';

export type CategoryWithSub = Category & {
  subCategories: SubCategory[];
};

/**
 * Server Action to fetch all categories along with their subcategories.
 * Ordered by sortOrder config parameters.
 */
export async function getCategoriesWithSub(): Promise<ApiResponse<CategoryWithSub[]>> {
  try {
    const categories = await prisma.category.findMany({
      include: {
        subCategories: {
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    return {
      success: true,
      data: categories as CategoryWithSub[],
    };
  } catch (error) {
    console.error('Error fetching categories with sub:', error);
    return {
      success: false,
      error: 'Gagal mengambil daftar kategori dari database.',
    };
  }
}

/**
 * Server Action to fetch all branches for transaction categorization selections.
 * Useful primarily for SUPERADMIN role listings.
 */
export async function getBranches(): Promise<ApiResponse<Branch[]>> {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return {
      success: true,
      data: branches,
    };
  } catch (error) {
    console.error('Error fetching branches:', error);
    return {
      success: false,
      error: 'Gagal mengambil daftar cabang dari database.',
    };
  }
}
