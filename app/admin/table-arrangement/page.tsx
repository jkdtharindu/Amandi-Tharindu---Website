import AdminNav from '@/components/admin/AdminNav';
import TableArrangement from '@/components/admin/TableArrangement';
import { requireAdminPage } from '@/lib/adminGuard';
import {
  listSeatingTables,
  listUnassignedGuests,
  listAssignedGuests,
  listUnassignedInvitees,
  listUnassignedProbableAttendees,
  getProbableAttendanceSummary,
} from '@/src/table-arrangement/tableArrangementRepo.js';
import { listAllGuests, listAllRsvpResponses } from '@/src/admin/adminRepo.js';
import { computeRsvpStats } from '@/src/admin/guestQueries.js';
import { buildDashboardStats } from '@/src/table-arrangement/dashboardStats.js';

export const dynamic = 'force-dynamic';

export default async function AdminTableArrangementPage() {
  const session = await requireAdminPage();
  const [
    tables,
    unassignedGuests,
    assignedGuests,
    unassignedInvitees,
    unassignedProbableAttendees,
    probableAttendanceSummary,
    guests,
    responses,
  ] = await Promise.all([
    listSeatingTables(),
    listUnassignedGuests(),
    listAssignedGuests(),
    listUnassignedInvitees(),
    listUnassignedProbableAttendees(),
    getProbableAttendanceSummary(),
    listAllGuests(),
    listAllRsvpResponses(),
  ]);

  const dashboardStats = buildDashboardStats({
    tables,
    assignedGuests,
    unassignedGuests,
    unassignedInvitees,
    rsvpStats: computeRsvpStats(guests, responses),
  });

  return (
    <>
      <AdminNav email={session.email} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-1">
          <h1 className="text-2xl font-bold">Table Arrangement</h1>
          {/* File download, not a page navigation — eslint's page-link checker
              misfires here because of the [id] dynamic route sibling under
              the same api/table-arrangement/ folder. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/admin/table-arrangement/export"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            Download spreadsheet
          </a>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Organize guest seating and manage dietary requirements.
        </p>
        <TableArrangement
          initialTables={tables}
          initialUnassignedGuests={unassignedGuests}
          initialUnassignedInvitees={unassignedInvitees}
          initialUnassignedProbableAttendees={unassignedProbableAttendees}
          initialProbableAttendanceSummary={probableAttendanceSummary}
          initialDashboardStats={dashboardStats}
        />
      </main>
    </>
  );
}
