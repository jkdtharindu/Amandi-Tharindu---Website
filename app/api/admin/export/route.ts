import { NextResponse } from 'next/server';
import { listAllGuests, listAllRsvpResponses } from '@/src/admin/adminRepo.js';
import { filterGuests, guestsToCsv } from '@/src/admin/guestQueries.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** CSV export of the full guest list with RSVP status (P0-08). */
export async function GET(): Promise<NextResponse> {
  if (!(await getAdminSession())) return unauthorizedResponse();

  const [guests, responses] = await Promise.all([
    listAllGuests(),
    listAllRsvpResponses(),
  ]);

  const csv = guestsToCsv(filterGuests(guests, {}), responses);
  const filename = `guest-list-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
