'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions/auth';
import type { ApiResponse } from '@/types';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { revalidatePath } from 'next/cache';

export interface UserFilters {
  search?: string;
  branchId?: number;
  role?: string;
  isActive?: boolean;
}

export interface UserDetailPayload {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  branchId: number | null;
  isActive: boolean;
  createdAt: Date;
  branch?: {
    id: number;
    name: string;
    code: string;
  } | null;
}

/**
 * Server Action to fetch all users in the system (Superadmin Only).
 * Strips password hashes from payloads for extreme security hygiene.
 */
export async function getUsers(filters: UserFilters = {}): Promise<ApiResponse<UserDetailPayload[]>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan mengakses panel ini.',
      };
    }

    const { search, branchId, role, isActive } = filters;

    // Compile dynamic filters
    const where: any = {};

    if (search && search.trim() !== '') {
      const query = search.trim();
      where.OR = [
        { username: { contains: query, mode: 'insensitive' } },
        { fullName: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (branchId) {
      where.branchId = Number(branchId);
    }

    if (role && role !== '') {
      where.role = role as UserRole;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        username: 'asc',
      },
    });

    // Strip out hashed passwords
    const sanitizedUsers: UserDetailPayload[] = users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      branchId: u.branchId,
      isActive: u.isActive,
      createdAt: u.createdAt,
      branch: u.branch,
    }));

    return {
      success: true,
      data: sanitizedUsers,
    };
  } catch (error) {
    console.error('Error in getUsers action:', error);
    return {
      success: false,
      error: 'Gagal memproses daftar akun pengguna.',
    };
  }
}

/**
 * Server Action to register a new user in the database (Superadmin Only).
 */
export async function createUser(data: {
  username: string;
  fullName: string;
  role: UserRole;
  branchId?: number | null;
  passwordText: string;
}): Promise<ApiResponse<UserDetailPayload>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan menambah akun baru.',
      };
    }

    const { username, fullName, role, branchId, passwordText } = data;

    // 1. Mandatory validations
    if (!username || username.trim() === '') {
      return { success: false, error: 'Username wajib diisi.' };
    }
    if (!fullName || fullName.trim() === '') {
      return { success: false, error: 'Nama Lengkap wajib diisi.' };
    }
    if (!passwordText || passwordText.length < 6) {
      return { success: false, error: 'Password wajib diisi minimal 6 karakter.' };
    }

    // Role-branch mapping constraint (Poka-Yoke)
    // Non-Superadmins MUST have a branch ID mapped
    if (role !== 'SUPERADMIN' && !branchId) {
      return { success: false, error: 'Keamanan: Akun non-Superadmin harus memiliki cabang terdaftar.' };
    }

    // For Superadmin, force branchId to null representing global oversight
    const targetBranchId = role === 'SUPERADMIN' ? null : Number(branchId);

    // 2. Check username uniqueness
    const exists = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });
    if (exists) {
      return { success: false, error: `Username '${username}' telah terdaftar di sistem.` };
    }

    // 3. Cryptographically hash password using bcrypt
    const passwordHash = await bcrypt.hash(passwordText, 10);

    const newUser = await prisma.user.create({
      data: {
        username: username.trim().toLowerCase(),
        fullName: fullName.trim(),
        role,
        branchId: targetBranchId,
        passwordHash,
        isActive: true,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    revalidatePath('/admin/users');

    return {
      success: true,
      data: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        role: newUser.role,
        branchId: newUser.branchId,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt,
        branch: newUser.branch,
      },
    };
  } catch (error) {
    console.error('Error in createUser action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat membuat akun pengguna.',
    };
  }
}

/**
 * Server Action to update an existing user (Superadmin Only).
 * Employs safety interlocks to block lockouts.
 */
export async function updateUser(
  id: number,
  data: {
    fullName?: string;
    role?: UserRole;
    branchId?: number | null;
    isActive?: boolean;
  }
): Promise<ApiResponse<UserDetailPayload>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan memperbarui profil.',
      };
    }

    // Safety constraint (Poka-Yoke): Block demoting or deactivating one's own Superadmin account
    if (actor.id === id) {
      if (data.isActive === false) {
        return {
          success: false,
          error: 'Keamanan: Anda tidak diperbolehkan menonaktifkan akun Superadmin Anda sendiri.',
        };
      }
      if (data.role && data.role !== 'SUPERADMIN') {
        return {
          success: false,
          error: 'Keamanan: Anda tidak diperbolehkan menurunkan peran akun Superadmin Anda sendiri.',
        };
      }
    }

    const { fullName, role, branchId, isActive } = data;

    const updateData: any = {};

    if (fullName !== undefined) {
      if (fullName.trim() === '') {
        return { success: false, error: 'Nama Lengkap tidak boleh kosong.' };
      }
      updateData.fullName = fullName.trim();
    }

    if (role !== undefined) {
      updateData.role = role;
      
      // Enforce role branch mapping
      if (role !== 'SUPERADMIN') {
        if (branchId !== undefined) {
          if (!branchId) {
            return { success: false, error: 'Akun dengan peran selain Superadmin wajib memiliki cabang terdaftar.' };
          }
          updateData.branchId = Number(branchId);
        }
      } else {
        // Force Superadmin to null representing global oversight
        updateData.branchId = null;
      }
    } else if (branchId !== undefined) {
      // If role is unchanged but branchId is modified, only update if it matches role constraints
      const currentUserRecord = await prisma.user.findUnique({ where: { id } });
      const activeRole = currentUserRecord?.role || 'DATA_ENTRY';
      
      if (activeRole !== 'SUPERADMIN') {
        if (!branchId) {
          return { success: false, error: 'Akun non-Superadmin wajib memiliki cabang terdaftar.' };
        }
        updateData.branchId = Number(branchId);
      } else {
        updateData.branchId = null;
      }
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    revalidatePath('/admin/users');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        branchId: updatedUser.branchId,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt,
        branch: updatedUser.branch,
      },
    };
  } catch (error) {
    console.error('Error in updateUser action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memperbarui profil pengguna.',
    };
  }
}

/**
 * Server Action to administratively reset a user's password (Superadmin Only).
 */
export async function adminResetPassword(
  id: number,
  newPasswordText: string
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== 'SUPERADMIN') {
      return {
        success: false,
        error: 'Akses Ditolak: Hanya SUPERADMIN yang diizinkan mereset password.',
      };
    }

    if (!newPasswordText || newPasswordText.length < 6) {
      return {
        success: false,
        error: 'Password baru wajib diisi minimal 6 karakter.',
      };
    }

    // Cryptographically re-hash password
    const passwordHash = await bcrypt.hash(newPasswordText, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return {
      success: true,
      data: { success: true },
    };
  } catch (error) {
    console.error('Error in adminResetPassword action:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat mereset password pengguna.',
    };
  }
}
