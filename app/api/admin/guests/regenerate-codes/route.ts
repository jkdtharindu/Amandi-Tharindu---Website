import { NextRequest, NextResponse } from 'next/server';
import { regenerateCodesForParty } from '@/src/admin/adminRepo.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** Replaces every live guest's code on the admin's side with a new 5-character
 *  code (PRD §23, Action 84). `{ "dryRun": true }` only returns the count, so the
 *  screen can say how many guests will change before the admin confirms.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' },
      { status: 403 }
    );
  }

  let dryRun = false;
  try {
    const body = await request.json();
    dryRun = body?.dryRun === true;
  } catch {
    // An empty body means a real run.
  }

  try {
    const { count } = await regenerateCodesForParty(session.party, { dryRun });
    return NextResponse.json({ success: true, count, dryRun });
  } catch (error) {
    const reason = (error as Error).message;
    if (reason === 'invalid_name' || reason === 'invalid_relationship' || reason === 'code_space_exhausted') {
      return NextResponse.json(
        {
          success: false,
          reason,
          message:
            'A guest name or group has no letter to build a code from, or a letter pair is full. No codes were changed.',
        },
        { status: 400 }
      );
    }
    console.error('regenerateCodesForParty failed:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'Could not replace the codes. No codes were changed.' },
      { status: 500 }
    );
  }
}
