import AdminNav from '@/components/admin/AdminNav';
import RsvpChart from '@/components/admin/RsvpChart';
import StatCard from '@/components/admin/StatCard';
import { requireAdminPage } from '@/lib/adminGuard';
import { listAllGuests, listAllRsvpResponses } from '@/src/admin/adminRepo.js';
import { computeRsvpStats } from '@/src/admin/guestQueries.js';

// Always read live numbers; the dashboard must not be cached (PRD P0-08).
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();

  const [guests, responses] = await Promise.all([
    listAllGuests(),
    listAllRsvpResponses(),
  ]);
  const stats = computeRsvpStats(guests, responses);

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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard label="Total invited" value={stats.totalInvited} hint="Invitations sent" />
          <StatCard
            label="Accepted"
            value={stats.accepted}
            hint={`${stats.acceptedHeadcount} people attending`}
          />
          <StatCard label="Declined" value={stats.declined} />
          <StatCard label="Awaiting reply" value={stats.pending} />
        </div>

        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Breakdown</h2>
          <RsvpChart stats={stats} />
        </section>
      </main>
    </>
  );
}
