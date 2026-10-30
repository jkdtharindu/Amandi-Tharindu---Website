import { NextResponse } from 'next/server';
import { listSeatingTablesByParty } from '@/src/table-arrangement/tableArrangementRepo.js';
import { buildTableArrangementExport, buildTableArrangementSummary } from '@/src/table-arrangement/tableArrangementExport.js';
import { listGuestsByParty } from '@/src/admin/adminRepo.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** Downloads the signed-in side's seating plan (summary + per-seat detail) as a CSV file Excel opens (P1-14, Action 61). */
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  try {
    const [tables, ownGuests] = await Promise.all([
      listSeatingTablesByParty(session.party),
      listGuestsByParty(session.party),
    ]);
    // Only this side's own guests get a number, so the other side's people at a Common table show none.
    const contactsByGuestId: Record<string, string> = {};
    for (const guest of ownGuests) {
      if (guest.whatsappNumber) contactsByGuestId[guest.id] = guest.whatsappNumber;
    }
    const summary = buildTableArrangementSummary(tables);
    const arrangements = buildTableArrangementExport(tables, { contactsByGuestId });
    // The leading byte-order mark makes Excel read the file as UTF-8.
    const fullExport = '\uFEFF' + summary + '\n' + arrangements;

    return new NextResponse(fullExport, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="table-arrangements.csv"',
      },
    });
  } catch (error) {
    console.error('Failed to build the seating spreadsheet:', error);
    return NextResponse.json(
      { success: false, message: 'Could not build the spreadsheet. Please try again.' },
      { status: 500 }
    );
  }
}
