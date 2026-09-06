import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js middleware for security headers (runs on every request).
 * Prevents common web attacks: MIME sniffing, clickjacking, XSS, etc.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Prevent MIME type sniffing (e.g., treating text/html as executable)
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking attacks by disallowing iframe embedding
  response.headers.set('X-Frame-Options', 'DENY');

  // Enable browser's built-in XSS protection (defense-in-depth, CSP is primary)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Control what information is sent in the Referer header
  response.headers.set('Referrer-Policy', 'no-referrer');

  // Restrict browser features (geolocation, camera, microphone, etc.)
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // Content-Security-Policy: restrict where scripts, styles, images can load from.
  // unsafe-inline is needed for inline event handlers (onClick, etc) in React until we refactor.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'", // Allow fetch/XMLHttpRequest only to same origin
    "frame-ancestors 'none'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

  // Strict-Transport-Security: enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Prevent DNS prefetching on external links
  response.headers.set('X-DNS-Prefetch-Control', 'off');

  // Legacy IE: prevent download dialog for certain file types
  response.headers.set('X-Download-Options', 'noopen');

  return response;
}

// Apply middleware to all routes except static assets and Next.js internals
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
