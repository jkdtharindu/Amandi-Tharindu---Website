import { NextRequest, NextResponse } from 'next/server';
import { getThemeSettings, updateThemeSettings } from '@/src/theme/themeRepo.js';
import { validateThemeInput } from '@/src/theme/basicThemeValidation.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** Current global theme settings (P1-10). Colors + font only — the simple admin form's slice of the fuller theme_settings schema (see src/theme/themeRepo.js). */
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const settings = await getThemeSettings();
  return NextResponse.json({ success: true, settings });
}

/** Updates the colors + font fields of the single theme_settings row (P1-10). */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const validation = validateThemeInput(body);
  const value = validation.value;
  if (!validation.valid || !value) {
    return NextResponse.json(
      {
        success: false,
        reason: 'validation_failed',
        message: 'Please correct the highlighted fields.',
        errors: validation.errors,
      },
      { status: 400 }
    );
  }

  try {
    const result = await updateThemeSettings(value);
    if (!result.success) {
      const errors = Object.fromEntries(
        (result.errors ?? []).map((err: { field: string; reason: string }) => [
          err.field,
          err.reason,
        ])
      );
      return NextResponse.json(
        {
          success: false,
          reason: 'validation_failed',
          message: 'Please correct the highlighted fields.',
          errors,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, settings: result.settings });
  } catch (error) {
    console.error('updateThemeSettings failed:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'Could not save theme settings.' },
      { status: 500 }
    );
  }
}
