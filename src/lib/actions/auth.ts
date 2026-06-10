'use server';

import { cookies, headers } from 'next/headers';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { signJWT, verifyJWT } from '@/lib/auth/jwt';
import type { LoginRequest, ApiResponse, JWTPayload, AuthUser } from '@/types';
import { createAuditLog } from '@/lib/actions/audit';

interface RateLimitRecord {
  attempts: number;
  lockoutUntil: number;
}

const loginRateLimitMap = new Map<string, RateLimitRecord>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function recordLoginFailure(ip: string) {
  const record = loginRateLimitMap.get(ip) || { attempts: 0, lockoutUntil: 0 };
  record.attempts += 1;
  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockoutUntil = Date.now() + LOGIN_LOCKOUT_DURATION;
  }
  loginRateLimitMap.set(ip, record);
}

/**
 * Server Action to authenticate credentials, sign JWT, and set an HttpOnly cookie.
 */
export async function login(data: LoginRequest): Promise<ApiResponse<void>> {
  try {
    const { username, password } = data;

    if (!username || !password) {
      return {
        success: false,
        error: 'Username dan password wajib diisi',
      };
    }

    // IP-based Rate Limiting (Finding #4)
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown-ip';
    const rateLimitRecord = loginRateLimitMap.get(ip);
    const now = Date.now();
    
    if (rateLimitRecord && rateLimitRecord.lockoutUntil > now) {
      const remainingSeconds = Math.ceil((rateLimitRecord.lockoutUntil - now) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      return {
        success: false,
        error: `Terlalu banyak percobaan masuk salah. IP Anda diblokir sementara. Silakan coba lagi dalam ${remainingMinutes} menit.`,
      };
    }

    // Query user and their branch details
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        branch: true,
      },
    });

    if (!user) {
      recordLoginFailure(ip);
      return {
        success: false,
        error: 'Username atau password salah',
      };
    }

    // Poka-Yoke: Fail-fast if the user account is disabled
    if (!user.isActive) {
      recordLoginFailure(ip);
      return {
        success: false,
        error: 'Akun Anda dinonaktifkan. Silakan hubungi superadmin.',
      };
    }

    // Enforce password hashing comparison
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      recordLoginFailure(ip);
      return {
        success: false,
        error: 'Username atau password salah',
      };
    }

    // Clear rate limit record on success
    loginRateLimitMap.delete(ip);

    // Compile Edge-friendly JWT payload
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branchId,
      branchCode: user.branch?.code || null,
    };

    // Sign the JWT token
    const token = await signJWT(payload);

    // Store in a secure HttpOnly cookie (awaited since Next.js 15+)
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours session duration
    });

    // Record login action in audit log
    await createAuditLog({
      userId: user.id,
      actionType: 'CREATE',
      targetTable: 'User',
      targetId: String(user.id),
      description: `User @${user.username} (${user.fullName}) berhasil masuk ke sistem`,
    });

    return {
      success: true,
      message: 'Login berhasil',
    };
  } catch (error) {
    console.error('Error during login execution:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem internal. Silakan coba beberapa saat lagi.',
    };
  }
}

/**
 * Server Action to clear the authentication cookie and perform a secure logout.
 */
export async function logout(): Promise<ApiResponse<void>> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
    return {
      success: true,
      message: 'Logout berhasil',
    };
  } catch (error) {
    console.error('Error during logout execution:', error);
    return {
      success: false,
      error: 'Gagal keluar dari sesi. Silakan coba lagi.',
    };
  }
}

/**
 * Retrieves the currently authenticated user from the database.
 * Cross-references session claims directly with current DB state to handle deactivations instantly.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;

    // Verify token structure
    const payload = await verifyJWT(token);
    if (!payload) return null;

    // Query database directly to verify active status
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        branch: true,
      },
    });

    // Poka-Yoke: Safeguard against deleted or deactivated sessions
    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId,
      branchName: user.branch?.name || null,
      branchCode: user.branch?.code || null,
    };
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}
