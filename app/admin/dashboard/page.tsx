import AdminNav from '@/components/admin/AdminNav';
import RsvpChart from '@/components/admin/RsvpChart';
import StatCard from '@/components/admin/StatCard';
import { requireAdminPage } from '@/lib/adminGuard';
import { loadDashboardStats } from '@/src/admin/loadDashboardStats.js';

// Always read live numbers; the dashboard must not be cached (PRD P0-08).
export const dynamic = 'force-dynamic';

type Totals = {
  codes: number;
  invited: number;
  accepted: number;
  declined: number;
  pending: number;
  codesPending: number;
};

function StatRow({ totals }: { totals: Totals }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Invitation codes" value={totals.codes} hint="Total codes issued" />
      <StatCard label="Invitees" value={totals.invited} hint="People across all codes" />
      <StatCard label="Accepted" value={totals.accepted} hint="People attending" />
      <StatCard label="Declined" value={totals.declined} hint="People not attending" />
      <StatCard
        label="Codes pending to accept"
        value={totals.codesPending}
        hint="Codes where nobody has accepted yet"
      />
      <StatCard
        label="Pending feedback"
        value={totals.pending}
        hint="People who have not picked accept or decline"
      />
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();
  const { sideBreakdown, overallBreakdown, overallStats } = await loadDashboardStats(session.party);

  return (
    <>
      <AdminNav email={session.email} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold">RSVP dashboard</h1>
          <a
            href="/api/admin/export"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            Export CSV
          </a>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 mb-3">Your Party</h2>
          <StatRow totals={sideBreakdown.totals} />
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 mb-3">Overall (Both Parties)</h2>
          <StatRow totals={overallBreakdown.totals} />
        </div>

        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Breakdown (Both Parties)</h2>
          <RsvpChart stats={overallStats} />
        </section>
      </main>
    </>
  );
}
