import { NextResponse } from 'next/server';

/**
 * Security headers for every request (Next.js 16 `proxy` convention — this file
 * was `middleware.ts` until that name was deprecated).
 */
export function proxy() {
  const response = NextResponse.next();

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

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts).*)'],
};
