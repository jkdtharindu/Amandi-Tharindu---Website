import { NextResponse } from 'next/server';
import { listAllInvitees, listGuestsByParty, listAllRsvpResponses } from '@/src/admin/adminRepo.js';
import { filterGuests, guestsToCsv } from '@/src/admin/guestQueries.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** CSV export of the signed-in side's guest list with RSVP status (P0-08). */
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  const [guests, responses, invitees] = await Promise.all([
    listGuestsByParty(session.party),
    listAllRsvpResponses(),
    listAllInvitees(),
  ]);

  const csv = guestsToCsv(filterGuests(guests, {}), responses, invitees);
  const filename = `guest-list-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
