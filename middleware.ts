import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if this is an admin route
  if (pathname.startsWith('/admin')) {
    // Skip protection for /admin/login
    if (pathname === '/admin/login') {
      return NextResponse.next();
    }

    // Check for admin session cookie
    const adminSession = request.cookies.get('admin_session');

    if (!adminSession) {
      // Redirect to admin login
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirected', 'true');
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
