import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/src/session.js';
import { GATE_ROUTE, isGatedPath } from '@/src/site-gate.js';

/**
 * Runs before every matched request (Next.js 16 `proxy` convention — this file
 * was `middleware.ts` until that name was deprecated). Two jobs:
 *
 * 1. The pre-login site gate (PRD §15): a signed-out visitor to any
 *    guest-facing path is rewritten to GATE_ROUTE. A rewrite rather than a
 *    redirect, so the address bar keeps the link the guest opened. This has to
 *    happen here, not in `app/(public)/layout.tsx`: a layout does not stop its
 *    page from rendering into the RSC payload (see "Layouts and auth checks" in
 *    node_modules/next/dist/docs/01-app/02-guides/authentication.md).
 * 2. Security headers on every response.
 */
export function proxy(request: NextRequest) {
  const signedIn = Boolean(verifySession(request.cookies.get('guest_session')?.value));

  const response =
    !signedIn && isGatedPath(request.nextUrl.pathname)
      ? NextResponse.rewrite(new URL(GATE_ROUTE, request.url))
      : NextResponse.next();

  applySecurityHeaders(response);
  return response;
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // React rebuilds server-side error stacks in the browser with eval(), so the dev
  // overlay and its stack traces break without this. React does not use eval() in
  // production, so the relaxation stays out of the production policy.
  const isDev = process.env.NODE_ENV === 'development';

  // 'unsafe-inline' is load-bearing: the alternative is a per-request nonce, which
  // requires dynamic rendering and would cost the public pages their static
  // generation. Revisit only if inline scripts/styles are removed first.
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts).*)'],
};
