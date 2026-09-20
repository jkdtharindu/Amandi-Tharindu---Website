import { NextRequest, NextResponse } from 'next/server';
import { createGuestForParty, listAllGuests, listAllRsvpResponses, listGuestsByParty, getPartyStats } from '@/src/admin/adminRepo.js';
import { computeRsvpStats, filterGuests } from '@/src/admin/guestQueries.js';
import { validateGuestInput } from '@/src/admin/guestValidation.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** Guest list for the logged-in admin's party with stats (P0-07, P0-08, P1-14D).
 *  Updated 2026-09-20: Filtered by party (bride or groom).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const [partyGuests, allGuests, responses] = await Promise.all([
    listGuestsByParty(session.party),
    listAllGuests(),
    listAllRsvpResponses(),
  ]);

  // Compute stats for this party and overall
  const partyStats = await getPartyStats(session.party);
  const overallStats = computeRsvpStats(allGuests.filter((g: { isDeleted?: boolean }) => !g.isDeleted), responses);

  return NextResponse.json({
    success: true,
    guests: filterGuests(partyGuests, {
      status: params.get('status'),
      relationship: params.get('relationship'),
      search: params.get('search'),
    }),
    stats: {
      party: partyStats,
      overall: overallStats,
    },
    party: session.party,
  });
}

/** Creates a guest for the logged-in admin's party (P0-07, P1-14D).
 *  Updated 2026-09-20: Guest is auto-assigned to the requesting admin's party.
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

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const validation = validateGuestInput(body, { requirePeople: true });
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
    // When creating with inviteeNames, the slotCount is derived from inviteeNames.length
    // by validateGuestInput, so the guest will always be consistent from creation.
    const guest = await createGuestForParty(session.party, value);
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
    console.error('createGuestForParty failed:', error);
    return NextResponse.json(
      { success: false, reason: 'server_error', message: 'Could not create the guest.' },
      { status: 500 }
    );
  }
}
