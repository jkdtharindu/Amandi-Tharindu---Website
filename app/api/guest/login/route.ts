import { NextRequest, NextResponse } from 'next/server';
import { loginGuestByCode, loginGuestByName } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name } = body;

    if (!code && !name) {
      return NextResponse.json(
        { success: false, reason: 'missing_input' },
        { status: 400 }
      );
    }

    let result;
    if (code) {
      result = await loginGuestByCode(code);
    } else {
      result = await loginGuestByName(name);
    }

    if (!result.success && result.type === 'candidates') {
      return NextResponse.json(result, { status: 200 });
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 401 });
    }

    // Set session cookie
    const response = NextResponse.json(result, { status: 200 });
    response.cookies.set('guest_session', result.sessionId?.toString() || '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error' },
      { status: 500 }
    );
  }
}
