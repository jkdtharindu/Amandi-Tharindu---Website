import { NextRequest, NextResponse } from 'next/server';
import { createGuest, listAllGuests, listAllRsvpResponses } from '@/src/admin/adminRepo.js';
import { computeRsvpStats, filterGuests } from '@/src/admin/guestQueries.js';
import { validateGuestInput } from '@/src/admin/guestValidation.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** Guest list with the dashboard stats for the current filter (P0-07, P0-08). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const [guests, responses] = await Promise.all([
    listAllGuests(),
    listAllRsvpResponses(),
  ]);

  return NextResponse.json({
    success: true,
    guests: filterGuests(guests, {
      status: params.get('status'),
      relationship: params.get('relationship'),
      search: params.get('search'),
    }),
    // Stats always describe the whole guest list, not the current filter.
    stats: computeRsvpStats(guests, responses),
  });
}

/** Creates a guest and auto-generates their invitation code (P0-07). */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const validation = validateGuestInput(body);
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
    const guest = await createGuest(value);
    return NextResponse.json({ success: true, guest }, { status: 201 });
  } catch (error) {
    const reason = (error as Error).message;
    if (reason === 'code_space_exhausted' || reason === 'invalid_name') {
      return NextResponse.json(
        {
          success: false,
          reason,
          message:
            reason === 'invalid_name'
              ? 'That name has no letters to build a code from.'
              : 'All 999 codes for that surname are in use.',
        },
        { status: 400 }
      );
    }
    console.error('createGuest failed:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'Could not create the guest.' },
      { status: 500 }
    );
  }
}
