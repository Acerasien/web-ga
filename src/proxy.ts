import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth/jwt';

/**
 * Next.js 16 Network Route Guard Proxy.
 * Operates on the lightweight Edge runtime.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract auth token from secure cookie
  const token = request.cookies.get('auth_token')?.value;

  // Verify the JWT token and decode its claims
  const payload = token ? await verifyJWT(token) : null;
  const isAuthenticated = !!payload;

  // Path categorization
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/transaksi') ||
    pathname.startsWith('/laporan') ||
    pathname.startsWith('/admin');

  const isAuthPath = pathname === '/login';

  // 1. Guard: Redirect unauthenticated users to /login
  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Preserve current path so users are redirected back after successful login
    loginUrl.searchParams.set('redirect', pathname);

    const response = NextResponse.redirect(loginUrl);
    // Clean up potentially corrupt or expired session cookies
    response.cookies.delete('auth_token');
    return response;
  }

  // 2. Guard: Redirect authenticated users attempting to access /login or root landing back to dashboard
  if ((isAuthPath || pathname === '/') && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 3. Role Guard: Restrict /admin/* sub-paths exclusively to SUPERADMIN role
  if (pathname.startsWith('/admin') && isAuthenticated) {
    if (payload?.role !== 'SUPERADMIN') {
      console.warn(`Unauthorized access attempt to ${pathname} by user: ${payload?.username} (Role: ${payload?.role})`);
      // Fail-safe: Redirect non-superadmin back to their main dashboard safely
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

/**
 * Route pattern matching configuration.
 * Intercepts all page-routes except next.js static bundles, assets, public folders, and local receipt uploads.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (internal API endpoints)
     * - _next/static (static client bundles)
     * - _next/image (next image loaders)
     * - favicon.ico (site tab favicon)
     * - uploads (local VPS storage for uploaded transaction receipts)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|uploads).*)',
  ],
};
