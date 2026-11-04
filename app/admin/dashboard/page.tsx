import AdminNav from '@/components/admin/AdminNav';
import MessagingChart from '@/components/admin/MessagingChart';
import RsvpActivity from '@/components/admin/RsvpActivity';
import RsvpChart from '@/components/admin/RsvpChart';
import StatCard from '@/components/admin/StatCard';
import { requireAdminPage } from '@/lib/adminGuard';
import { loadDashboardStats, loadMessagingDashboard } from '@/src/admin/loadDashboardStats.js';
import { listRsvpActivity } from '@/src/rsvp/rsvpActivityRepo.js';

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

type AnswerTotals = {
  codes: number;
  complete: number;
  partial: number;
  none: number;
  mixed: number;
};

type WaitingRow = {
  guestId: string;
  code: string;
  name: string;
  invited: number;
  accepted: number;
  declined: number;
  pending: number;
};

type MessagingStats = {
  levels: { key: string; number: number; label: string; sent: number; toSend: number; noNumber: number }[];
  totals: { codes: number; withNumber: number; noNumber: number; fullyMessaged: number };
};

function StatRow({ totals }: { totals: Totals }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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

/** How far each invitation code is through answering, person by person. */
function AnswerRow({ totals }: { totals: AnswerTotals }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCard
        label="Everyone answered"
        value={totals.complete}
        hint="Codes where every person has accepted or declined"
      />
      <StatCard
        label="Partly answered"
        value={totals.partial}
        hint="Codes where some people have answered and others have not"
      />
      <StatCard
        label="Nobody answered"
        value={totals.none}
        hint="Codes where no person has answered yet"
      />
      <StatCard
        label="Mixed answers"
        value={totals.mixed}
        hint="Codes with at least one person accepting and one declining"
      />
    </div>
  );
}

/** The signed-in side's or the other side's messaging progress, one card per step. */
function MessagingRow({ stats }: { stats: MessagingStats }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {stats.levels.map((level) => (
        <StatCard
          key={level.key}
          label={`Step ${level.number} · ${level.label}`}
          value={level.sent}
          sub={`${level.toSend} to send`}
          hint={`Sent to ${level.sent}. Still to send: ${level.toSend}. No WhatsApp number: ${level.noNumber}.`}
        />
      ))}
      <StatCard
        label="All steps sent"
        value={stats.totals.fullyMessaged}
        sub={`of ${stats.totals.withNumber} with a number`}
        hint="Codes that have had every message step sent"
      />
      <StatCard
        label="No WhatsApp number"
        value={stats.totals.noNumber}
        sub="cannot be messaged"
        hint="Codes with no WhatsApp number saved"
      />
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();
  const [{ sideBreakdown, otherBreakdown, overallStats, sideAnswers, otherAnswers }, activity, messaging] =
    await Promise.all([
      loadDashboardStats(session.party),
      listRsvpActivity(session.party),
      loadMessagingDashboard(session.party),
    ]);
  const otherPartyLabel = session.party === 'bride' ? 'Groom' : 'Bride';
  const waiting = sideAnswers.waiting as WaitingRow[];

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

        <RsvpActivity items={activity} />

        <div className="mb-5">
          <h2 className="text-sm font-semibold text-slate-500 mb-2">Your Party</h2>
          <StatRow totals={sideBreakdown.totals} />
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 mb-2">
            {otherPartyLabel} Party
          </h2>
          <StatRow totals={otherBreakdown.totals} />
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-1">Answers by invitation code</h2>
          <p className="text-sm text-slate-500 mb-4">
            One code can hold many people, and they answer one at a time. This shows which codes
            are fully answered and which still have people to reply.
          </p>
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-500 mb-2">Your Party</h3>
            <AnswerRow totals={sideAnswers.totals} />
          </div>
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-500 mb-2">{otherPartyLabel} Party</h3>
            <AnswerRow totals={otherAnswers.totals} />
          </div>

          {waiting.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold mb-1">Your codes with people still to reply</h3>
              <p className="text-sm text-slate-500 mb-4">
                Some people on these codes have answered and others have not. In the Guest list, use
                the <strong>Member answers</strong> filter to work through them.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="py-2 pr-4 font-semibold">Name</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Code</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Accepted</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Declined</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Still to reply</th>
                      <th scope="col" className="py-2 font-semibold">People</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {waiting.map((row) => (
                      <tr key={row.guestId}>
                        <td className="py-2 pr-4 font-medium">{row.name}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{row.code}</td>
                        <td className="py-2 pr-4 font-stat text-emerald-700">{row.accepted}</td>
                        <td className="py-2 pr-4 font-stat text-rose-700">{row.declined}</td>
                        <td className="py-2 pr-4 font-stat text-amber-700">{row.pending}</td>
                        <td className="py-2 font-stat">{row.invited}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Breakdown (Both Parties)</h2>
          <RsvpChart stats={overallStats} />
        </section>

        {messaging && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold mb-1">Messaging status</h2>
            <p className="text-sm text-slate-500 mb-4">
              Each card shows how many codes have been messaged at that step, and how many are
              still to message. Codes with no WhatsApp number cannot be messaged, so they are
              counted separately.
            </p>
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-slate-500 mb-2">Your Party</h3>
              <MessagingRow stats={messaging.side} />
            </div>
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-slate-500 mb-2">{otherPartyLabel} Party</h3>
              <MessagingRow stats={messaging.other} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold mb-4">Messaging progress (Both Parties)</h3>
              <MessagingChart levels={messaging.overall.levels} />
            </div>
          </section>
        )}
      </main>
    </>
  );
}
