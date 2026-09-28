import AdminNav from '@/components/admin/AdminNav';
import RsvpChart from '@/components/admin/RsvpChart';
import StatCard from '@/components/admin/StatCard';
import { requireAdminPage } from '@/lib/adminGuard';
import { loadDashboardStats } from '@/src/admin/loadDashboardStats.js';

// Always read live numbers; the dashboard must not be cached (PRD P0-08).
export const dynamic = 'force-dynamic';

function StatRow({ stats }: { stats: { totalInvited: number; accepted: number; acceptedHeadcount: number; declined: number; pending: number } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total invited" value={stats.totalInvited} hint="Invitations sent" />
      <StatCard
        label="Accepted"
        value={stats.accepted}
        hint={`${stats.acceptedHeadcount} people attending`}
      />
      <StatCard label="Declined" value={stats.declined} />
      <StatCard label="Awaiting reply" value={stats.pending} />
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();
  const { sideStats, overallStats } = await loadDashboardStats(session.party);

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
          <StatRow stats={sideStats} />
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 mb-3">Overall (Both Parties)</h2>
          <StatRow stats={overallStats} />
        </div>

        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Breakdown (Both Parties)</h2>
          <RsvpChart stats={overallStats} />
        </section>
      </main>
    </>
  );
}
