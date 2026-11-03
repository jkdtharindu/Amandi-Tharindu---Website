import { NextResponse } from 'next/server';
import { listSeatingTablesByParty } from '@/src/table-arrangement/tableArrangementRepo.js';
import { declineRequestSeats } from '@/src/table-arrangement/declineRequests.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/**
 * How many seated people have been asked to decline, for the count badge in the admin
 * menu. Counts only: the names are on the Table Arrangement page.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  try {
    const tables = await listSeatingTablesByParty(session.party);
    const count = declineRequestSeats(tables, session.party).length;
    return NextResponse.json({ success: true, count }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to count decline requests:', error);
    return NextResponse.json({ success: false, count: 0 }, { status: 500 });
  }
}
