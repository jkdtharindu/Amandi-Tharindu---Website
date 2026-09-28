import { NextResponse } from 'next/server';
import { listSeatingTablesByParty } from '@/src/table-arrangement/tableArrangementRepo.js';
import { buildTableArrangementExport, buildTableArrangementSummary } from '@/src/table-arrangement/tableArrangementExport.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

/** Downloads the signed-in side's seating plan (summary + per-seat detail) as a TSV Excel can open (P1-14). */
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();

  const tables = await listSeatingTablesByParty(session.party);
  const summary = buildTableArrangementSummary(tables);
  const arrangements = buildTableArrangementExport(tables);
  const fullExport = summary + '\n' + arrangements;

  return new NextResponse(fullExport, {
    headers: {
      'Content-Type': 'text/tab-separated-values; charset=utf-8',
      'Content-Disposition': 'attachment; filename="table-arrangements.xlsx"',
    },
  });
}
