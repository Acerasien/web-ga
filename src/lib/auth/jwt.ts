import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from '@/types';

// Encode JWT secret for HMAC SHA-256 signature
const SECRET_KEY_STRING = process.env.JWT_SECRET;
if (!SECRET_KEY_STRING && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!');
}
const SECRET = new TextEncoder().encode(
  SECRET_KEY_STRING || 'web_ga_default_fallback_jwt_secret_key_change_in_production'
);

/**
 * Signs a payload and returns a HS256 JWT string.
 * Configured with a 24-hour expiration duration.
 */
export async function signJWT(payload: JWTPayload): Promise<string> {
  try {
    return await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(SECRET);
  } catch (error) {
    console.error('Error signing JWT:', error);
    throw new Error('Gagal menandatangani token sesi');
  }
}

/**
 * Verifies a JWT string using HS256 and retrieves the payload.
 * Returns null if the token is invalid, expired, or tampered with.
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JWTPayload;
  } catch (error) {
    // Gracefully handle verification errors (expired, signature failure) without crashing
    console.warn('JWT Verification warning:', error instanceof Error ? error.message : error);
    return null;
  }
}
