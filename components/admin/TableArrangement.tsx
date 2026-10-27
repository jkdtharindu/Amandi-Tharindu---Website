'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { seatOccupantLabel } from '@/src/table-arrangement/seatLabel.js';
import { sideLabel, tableLabel } from '@/src/table-arrangement/tableSides.js';

export type Party = 'bride' | 'groom';
export type TableSide = Party | 'common';

type Seat = {
  id: string;
  seatNumber: number;
  guestId: string | null;
  guestName: string | null;
  probableAttendeeId: string | null;
  probableAttendeeLabel: string | null;
  inviteeId: string | null;
  inviteeName: string | null;
  inviteeGuestName: string | null;
  /** The side of the guest or invitee on the seat; null for a placeholder or an empty seat. */
  occupantSide: Party | null;
  /** The RSVP answer of the guest or invitee on the seat; null for a placeholder or an empty seat. */
  occupantRsvpStatus?: string | null;
};

export type SeatingTable = {
  id: string;
  table_number: number;
  table_name: string | null;
  capacity: number;
  /** Bride, groom or Common (Action 68). The list holds this side's own tables and every Common table. */
  side: TableSide;
  seats: Seat[];
};

type LeftoverSideRow = { unseated: number; freeSeats: number; leftover: number };

export type LeftoverSummary = {
  bride: LeftoverSideRow;
  groom: LeftoverSideRow;
  combinedLeftover: number;
  commonFreeSeats: number;
  seatsPerCommonTable: number;
  commonTablesNeeded: number;
};

export type UnassignedGuest = { id: string; name: string };

export type UnassignedInvitee = { id: string; name: string; guestId: string; guestName: string | null };

export type ProbableBucket = 'declined' | 'pending';

export type UnassignedProbableAttendee = { id: string; bucket: ProbableBucket; slotIndex: number; label: string };

export type ProbableAttendanceSummaryRow = {
  bucket: ProbableBucket;
  bufferCount: number;
  seatedCount: number;
  unseatedCount: number;
};

export type TableArrangementDashboardStats = {
  accepted: number;
  tableArranged: number;
  balanceToArrange: number;
  declined: number;
  pending: number;
};

type RequestedSide = 'own' | 'common';
type NewTableForm = { tableNumber: string; tableName: string; capacity: string; side: RequestedSide };
type AssignChoice = { guestId?: string; probableAttendeeId?: string; inviteeId?: string };

const EMPTY_FORM: NewTableForm = { tableNumber: '', tableName: '', capacity: '10', side: 'own' };
const BUCKET_LABEL: Record<ProbableBucket, string> = { declined: 'Declined', pending: 'Pending feedback' };

// Pending sits above Declined on the Probable attendance panel (Action 64).
const BUCKET_ORDER: ProbableBucket[] = ['pending', 'declined'];

// Header-band colours per table side (Action 64): bride rose, groom sky, common amber.
const SIDE_BAND: Record<string, string> = {
  bride: 'bg-rose-50 text-rose-900 border-rose-200 border-l-rose-500',
  groom: 'bg-sky-50 text-sky-900 border-sky-200 border-l-sky-500',
  common: 'bg-amber-50 text-amber-900 border-amber-200 border-l-amber-500',
};

export default function TableArrangement({
  party,
  brideName = '',
  groomName = '',
  initialTables,
  initialUnassignedGuests,
  initialUnassignedInvitees,
  initialUnassignedProbableAttendees,
  initialProbableAttendanceSummary,
  initialDashboardStats,
  initialOverallDashboardStats,
  initialLeftoverSummary,
}: {
  party: Party;
  brideName?: string;
  groomName?: string;
  initialTables: SeatingTable[];
  initialUnassignedGuests: UnassignedGuest[];
  initialUnassignedInvitees: UnassignedInvitee[];
  initialUnassignedProbableAttendees: UnassignedProbableAttendee[];
  initialProbableAttendanceSummary: ProbableAttendanceSummaryRow[];
  initialDashboardStats: TableArrangementDashboardStats;
  initialOverallDashboardStats?: TableArrangementDashboardStats;
  initialLeftoverSummary: LeftoverSummary;
}) {
  // State, not a prop, so load() can refresh it after every action. It was a
  // one-time server prop until Next Action 29, so the stat cards stayed at
  // their page-load values however many guests the admin seated.
  const [dashboardStats, setDashboardStats] =
    useState<TableArrangementDashboardStats>(initialDashboardStats);
  const [overallDashboardStats, setOverallDashboardStats] =
    useState<TableArrangementDashboardStats | undefined>(initialOverallDashboardStats);
  const [leftoverSummary, setLeftoverSummary] = useState<LeftoverSummary>(initialLeftoverSummary);
  const [tables, setTables] = useState<SeatingTable[]>(initialTables);
  const [unassignedGuests, setUnassignedGuests] = useState<UnassignedGuest[]>(initialUnassignedGuests);
  const [unassignedInvitees, setUnassignedInvitees] = useState<UnassignedInvitee[]>(initialUnassignedInvitees);
  const [unassignedProbableAttendees, setUnassignedProbableAttendees] = useState<UnassignedProbableAttendee[]>(
    initialUnassignedProbableAttendees
  );
  const [probableAttendanceSummary, setProbableAttendanceSummary] = useState<ProbableAttendanceSummaryRow[]>(
    initialProbableAttendanceSummary
  );
  const [form, setForm] = useState<NewTableForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const showToast = useToast();

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => showToast({ kind: 'error', text: 'Could not reach the server.' }));
  }, [showToast]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/table-arrangement');
      const data = await res.json();
      if (data.success) {
        setTables(data.tables);
        setUnassignedGuests(data.unassignedGuests);
        setUnassignedInvitees(data.unassignedInvitees);
        setUnassignedProbableAttendees(data.unassignedProbableAttendees);
        setProbableAttendanceSummary(data.probableAttendanceSummary);
        setDashboardStats(data.dashboardStats);
        setOverallDashboardStats(data.overallDashboardStats);
        setLeftoverSummary(data.leftoverSummary);
      }
    } catch {
      showToast({ kind: 'error', text: 'Could not load the seating plan.' });
    }
  }, [showToast]);

  async function handleAddTable(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      const res = await fetch('/api/admin/table-arrangement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          tableNumber: Number(form.tableNumber),
          tableName: form.tableName.trim(),
          capacity: Number(form.capacity),
          side: form.side,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast({ kind: 'ok', text: 'Table added.' });
        setForm(EMPTY_FORM);
        await load();
        return;
      }
      showToast({ kind: 'error', text: data.message || 'Could not add the table.' });
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTable(table: SeatingTable) {
    const confirmed = window.confirm(
      table.side === 'common'
        ? `Delete the Common table "${tableLabel(table)}"?`
        : `Delete "${tableLabel(table)}"? Seated guests will become unassigned.`
    );
    if (!confirmed) return;

    setBusy(true);

    try {
      const res = await fetch('/api/admin/table-arrangement/' + table.id, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast({ kind: 'ok', text: 'Table removed.' });
        await load();
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not remove the table.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  // Own side <-> Common. The server refuses (409) while anyone is seated, so the
  // button is only offered on an empty table (Action 68).
  async function handleChangeSide(table: SeatingTable, side: RequestedSide) {
    setBusy(true);

    try {
      const res = await fetch('/api/admin/table-arrangement/' + table.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ side }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast({
          kind: 'ok',
          text: side === 'common' ? `"${tableLabel(table)}" is now a Common table.` : `"${tableLabel(table)}" is now your side's table.`,
        });
      } else {
        showToast({ kind: 'error', text: data.message || "Could not change the table's side." });
      }
      await load();
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  // Rename a table and/or change how many seats it has. Everyone already seated
  // stays seated: the server only adds seats or removes empty ones, and refuses
  // (409) a seat count below the number of people seated. Resolves true on success.
  async function handleEditTable(
    table: SeatingTable,
    changes: { tableName?: string; capacity?: number }
  ): Promise<boolean> {
    setBusy(true);

    try {
      const res = await fetch('/api/admin/table-arrangement/' + table.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(changes),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast({ kind: 'ok', text: `"${tableLabel(table)}" updated.` });
        await load();
        return true;
      }
      showToast({ kind: 'error', text: data.message || 'Could not update the table.' });
      return false;
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign(tableId: string, seatId: string, choice: AssignChoice) {
    setBusy(true);

    try {
      const res = await fetch(`/api/admin/table-arrangement/${tableId}/seats/${seatId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(choice),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await load();
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not assign that seat.' });
        // A refusal usually means this screen is out of date (the seat was taken
        // from another tab), so show the plan as it is now.
        await load();
      }
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleSetBuffer(bucket: ProbableBucket, count: number) {
    setBusy(true);

    try {
      const res = await fetch('/api/admin/table-arrangement/probable-attendees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ bucket, count }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast({ kind: 'ok', text: `${BUCKET_LABEL[bucket]} probable estimate updated.` });
        await load();
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not update that estimate.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleUnassign(tableId: string, seatId: string) {
    setBusy(true);

    try {
      const res = await fetch(`/api/admin/table-arrangement/${tableId}/seats/${seatId}/unassign`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await load();
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not remove that guest.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  // Short display name for a side: the first word of the name set in the theme
  // editor, or "Bride" / "Groom" when none is set.
  const nameOf = (side: Party) =>
    ((side === 'bride' ? brideName : groomName).trim().split(/s+/)[0] || sideLabel(side));
  const otherParty: Party = party === 'bride' ? 'groom' : 'bride';

  const statRows = [
    { label: 'RSVP Accepted', hint: '', yours: dashboardStats.accepted, overall: overallDashboardStats?.accepted },
    { label: 'Table Arranged', hint: '', yours: dashboardStats.tableArranged, overall: overallDashboardStats?.tableArranged },
    { label: 'Balance to Arrange', hint: 'Accepted, not yet seated', yours: dashboardStats.balanceToArrange, overall: overallDashboardStats?.balanceToArrange },
    {
      label: 'RSVP Not Accepted',
      hint: `${dashboardStats.declined} declined, ${dashboardStats.pending} pending`,
      yours: dashboardStats.declined + dashboardStats.pending,
      overall: overallDashboardStats ? overallDashboardStats.declined + overallDashboardStats.pending : undefined,
    },
  ];

  return (
    <div className="lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* Summary column (Action 79, PRD §21): sticky beside the tables on a wide
          screen; on a narrow one it is a collapsible bar above them. One copy of
          the panels, so the form's ids stay unique. */}
      <aside className="mb-6 lg:mb-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto" data-testid="summary-column">
        <button
          type="button"
          onClick={() => setSummaryOpen((open) => !open)}
          aria-expanded={summaryOpen}
          aria-controls="summary-panels"
          className="lg:hidden w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
        >
          <span>Summary &amp; add a table</span>
          <span aria-hidden="true">{summaryOpen ? '−' : '+'}</span>
        </button>
        <div id="summary-panels" className={`${summaryOpen ? 'mt-4 block' : 'hidden'} lg:mt-0 lg:block`}>
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4" data-testid="stats-table">
        <h2 className="font-semibold mb-3 flex flex-wrap items-center justify-between gap-2" data-testid="side-assigned">
          <span>Guest stats</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            Side assigned: {sideLabel(party)}
          </span>
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th scope="col" className="pb-2 font-semibold">&nbsp;</th>
              <th scope="col" className="pb-2 text-right font-semibold">{nameOf(party)}</th>
              {overallDashboardStats && <th scope="col" className="pb-2 pl-2 text-right font-semibold">
                  Overall - including {nameOf(otherParty)}&apos;s party
                </th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {statRows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="py-2 pr-2 text-left font-normal text-slate-700">
                  {row.label}
                  {row.hint && <span className="block text-xs text-slate-400">{row.hint}</span>}
                </th>
                <td className="py-2 text-right text-lg font-bold tabular-nums">{row.yours}</td>
                {overallDashboardStats && (
                  <td className="py-2 text-right text-lg font-bold tabular-nums">{row.overall}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProbableAttendancePanel summary={probableAttendanceSummary} busy={busy} onSetBuffer={handleSetBuffer} />

      <LeftoverPanel summary={leftoverSummary} party={party} nameOf={nameOf} />

      <div className="mb-4">
        <form onSubmit={handleAddTable} className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-semibold mb-3">Add a table</h2>
          <div className="grid gap-3 grid-cols-2">
            <div>
              <label htmlFor="tableNumber" className="block text-xs font-semibold text-slate-500 mb-1">
                Table number
              </label>
              <input
                id="tableNumber"
                type="number"
                min={1}
                required
                value={form.tableNumber}
                onChange={(e) => setForm({ ...form, tableNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="tableName" className="block text-xs font-semibold text-slate-500 mb-1">
                Name <span className="font-normal">(guests see this)</span>
              </label>
              <input
                id="tableName"
                required
                placeholder="e.g., Rose Table"
                value={form.tableName}
                onChange={(e) => setForm({ ...form, tableName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="capacity" className="block text-xs font-semibold text-slate-500 mb-1">
                Capacity
              </label>
              <input
                id="capacity"
                type="number"
                min={1}
                max={100}
                required
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="tableSide" className="block text-xs font-semibold text-slate-500 mb-1">
                Side
              </label>
              <select
                id="tableSide"
                value={form.side}
                onChange={(e) => setForm({ ...form, side: e.target.value as RequestedSide })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="own">My side ({sideLabel(party)})</option>
                <option value="common">Common (both sides)</option>
              </select>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Numbers start again on each side and for Common tables. Guests see only the name.
          </p>
          <button
            type="submit"
            disabled={busy || !csrfToken}
            className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Create table'}
          </button>
        </form>
      </div>
        </div>
      </aside>

      <div className="min-w-0">
      {tables.length === 0 ? (
        <p className="text-sm text-slate-500">No tables created yet.</p>
      ) : (
        [
          { key: 'own', title: `${sideLabel(party)}'s side tables`, hint: '', list: tables.filter((t) => t.side !== 'common') },
          {
            key: 'common',
            title: 'Common tables',
            hint: "Shared with the other side. Both admins see everyone here; you can seat and remove only your own side's guests.",
            list: tables.filter((t) => t.side === 'common'),
          },
        ]
          .filter((group) => group.list.length > 0)
          .map((group) => (
            <section key={group.key} className="mb-6">
              <h2 className="text-sm font-semibold text-slate-500 mb-1">{group.title}</h2>
              {group.hint && <p className="text-xs text-slate-500 mb-3">{group.hint}</p>}
              <div className="space-y-4">
                {group.list.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    party={party}
                    unassignedGuests={unassignedGuests}
                    unassignedInvitees={unassignedInvitees}
                    unassignedProbableAttendees={unassignedProbableAttendees}
                    busy={busy}
                    onDelete={() => handleDeleteTable(table)}
                    onChangeSide={(side) => handleChangeSide(table, side)}
                    onEdit={(changes) => handleEditTable(table, changes)}
                    onAssign={(seatId, choice) => handleAssign(table.id, seatId, choice)}
                    onUnassign={(seatId) => handleUnassign(table.id, seatId)}
                  />
                ))}
              </div>
            </section>
          ))
      )}
      </div>
    </div>
  );
}

/**
 * Counts only — never the other side's names (PRD §20). Each side's accepted
 * people still without a seat, the empty seats on that side's own tables, and
 * the people who will not fit there; then what the Common tables still need.
 */
function LeftoverPanel({
  summary,
  party,
  nameOf,
}: {
  summary: LeftoverSummary;
  party: Party;
  nameOf: (side: Party) => string;
}) {
  const sides: Party[] = party === 'bride' ? ['bride', 'groom'] : ['groom', 'bride'];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4" data-testid="leftover-summary">
      <h2 className="font-semibold mb-1">Leftover seating</h2>
      <p className="text-xs text-slate-500 mb-3">
        People each side still has to seat, against the empty seats at that side&apos;s own tables.
        Whoever does not fit goes to a Common table.
      </p>
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th scope="col" className="pb-2 font-semibold">&nbsp;</th>
            <th scope="col" className="pb-2 text-right font-semibold">Not seated</th>
            <th scope="col" className="pb-2 pl-2 text-right font-semibold">Free seats</th>
            <th scope="col" className="pb-2 pl-2 text-right font-semibold">Left over</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sides.map((side) => (
            <tr key={side}>
              <th scope="row" className="py-2 pr-2 text-left font-normal text-slate-700">
                {nameOf(side)}
                {side === party && <span className="block text-xs text-slate-400">you</span>}
              </th>
              <td className="py-2 text-right text-lg font-bold tabular-nums">{summary[side].unseated}</td>
              <td className="py-2 pl-2 text-right text-lg font-bold tabular-nums">{summary[side].freeSeats}</td>
              <td className="py-2 pl-2 text-right text-lg font-bold tabular-nums">{summary[side].leftover}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          <tr>
            <th scope="row" className="py-2 pr-2 text-left font-normal text-slate-700">
              Combined leftover
              <span className="block text-xs text-slate-400">Both sides, after their own tables</span>
            </th>
            <td className="py-2 text-right text-lg font-bold tabular-nums">{summary.combinedLeftover}</td>
          </tr>
          <tr>
            <th scope="row" className="py-2 pr-2 text-left font-normal text-slate-700">Free seats at Common tables</th>
            <td className="py-2 text-right text-lg font-bold tabular-nums">{summary.commonFreeSeats}</td>
          </tr>
          <tr>
            <th scope="row" className="py-2 pr-2 text-left font-normal text-slate-700">
              Common tables still needed
              <span className="block text-xs text-slate-400">Roughly, at {summary.seatsPerCommonTable} seats each</span>
            </th>
            <td className="py-2 text-right text-lg font-bold tabular-nums">{summary.commonTablesNeeded}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ProbableAttendancePanel({
  summary,
  busy,
  onSetBuffer,
}: {
  summary: ProbableAttendanceSummaryRow[];
  busy: boolean;
  onSetBuffer: (bucket: ProbableBucket, count: number) => void;
}) {
  // Seeded from props, so a later buffer change from elsewhere won't override
  // text the Admin is mid-typing here.
  const [drafts, setDrafts] = useState<Record<ProbableBucket, string>>({
    declined: String(summary.find((row) => row.bucket === 'declined')?.bufferCount ?? 0),
    pending: String(summary.find((row) => row.bucket === 'pending')?.bufferCount ?? 0),
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <h2 className="font-semibold mb-1">Probable attendance</h2>
      <p className="text-sm text-slate-500 mb-4">
        Anonymous placeholders for Guests who might attend despite declining or not responding —
        just a capacity buffer, never a real name.
      </p>
      <div className="grid gap-3">
        {[...summary]
          .sort((a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket))
          .map((row) => (
          <div key={row.bucket} className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">{BUCKET_LABEL[row.bucket]}</p>
            <p className="text-xs text-slate-500 mb-2">
              {row.seatedCount}/{row.bufferCount} seated · {row.unseatedCount} unseated
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={`buffer-${row.bucket}`} className="text-xs text-slate-500">
                Estimate likely to attend anyway
              </label>
              <input
                id={`buffer-${row.bucket}`}
                type="number"
                min={0}
                value={drafts[row.bucket]}
                onChange={(e) => setDrafts({ ...drafts, [row.bucket]: e.target.value })}
                className="w-20 px-2 py-1 rounded-md border border-slate-300 text-xs"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => onSetBuffer(row.bucket, Number(drafts[row.bucket]))}
                className="px-2 py-1 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableCard({
  table,
  party,
  unassignedGuests,
  unassignedInvitees,
  unassignedProbableAttendees,
  busy,
  onDelete,
  onChangeSide,
  onEdit,
  onAssign,
  onUnassign,
}: {
  onEdit: (changes: { tableName?: string; capacity?: number }) => Promise<boolean>;
  table: SeatingTable;
  party: Party;
  unassignedGuests: UnassignedGuest[];
  unassignedInvitees: UnassignedInvitee[];
  unassignedProbableAttendees: UnassignedProbableAttendee[];
  busy: boolean;
  onDelete: () => void;
  onChangeSide: (side: RequestedSide) => void;
  onAssign: (seatId: string, choice: AssignChoice) => void;
  onUnassign: (seatId: string) => void;
}) {
  const isCommon = table.side === 'common';
  const filled = table.seats.filter((seat) => seat.guestId || seat.probableAttendeeId || seat.inviteeId).length;
  const yours = table.seats.filter((seat) => seat.occupantSide === party).length;
  // A table's side is locked once anyone sits there, and a Common table can be
  // deleted only while empty; the server refuses both (409), so neither is offered.
  const empty = filled === 0;

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [seatsDraft, setSeatsDraft] = useState('');

  function startEdit() {
    setNameDraft(table.table_name ?? '');
    setSeatsDraft(String(table.capacity));
    setEditing(true);
  }

  async function saveEdit() {
    const changes: { tableName?: string; capacity?: number } = {};
    const name = nameDraft.trim();
    const seats = Number(seatsDraft);

    if (name && name !== (table.table_name ?? '')) changes.tableName = name;
    if (Number.isInteger(seats) && seats !== table.capacity) changes.capacity = seats;
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }
    if (await onEdit(changes)) setEditing(false);
  }

  const seatsInvalid = !Number.isInteger(Number(seatsDraft)) || Number(seatsDraft) < Math.max(1, filled) || Number(seatsDraft) > 100;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header band: the table's identity first, coloured by side so the
          page can be scanned by colour (bride / groom / common). */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-4 border-b border-l-8 ${
          SIDE_BAND[table.side] ?? SIDE_BAND.common
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-bold uppercase tracking-wide opacity-70">Table {table.table_number}</span>
          <h3 className="text-xl font-bold">{tableLabel(table)}</h3>
          <span className="inline-block rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-semibold">
            {sideLabel(table.side)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold">
            {filled}/{table.capacity} filled{isCommon ? ` · ${yours} yours` : ''}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={startEdit}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Edit
          </button>
          {empty && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChangeSide(isCommon ? 'own' : 'common')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              {isCommon ? `Move to ${sideLabel(party)}'s side` : 'Make it Common'}
            </button>
          )}
          {(!isCommon || empty) && (
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mx-4 mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <label htmlFor={`edit-name-${table.id}`} className="block text-xs font-semibold text-slate-500 mb-1">
                Table name
              </label>
              <input
                id={`edit-name-${table.id}`}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
            <div>
              <label htmlFor={`edit-seats-${table.id}`} className="block text-xs font-semibold text-slate-500 mb-1">
                Number of seats
              </label>
              <input
                id={`edit-seats-${table.id}`}
                type="number"
                min={Math.max(1, filled)}
                max={100}
                value={seatsDraft}
                onChange={(e) => setSeatsDraft(e.target.value)}
                className="w-28 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !nameDraft.trim() || seatsInvalid}
                onClick={() => void saveEdit()}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {filled} {filled === 1 ? 'person is' : 'people are'} seated here and will stay seated. You can add
            seats any time; you can remove only empty seats, so the lowest number is {Math.max(1, filled)}.
          </p>
        </div>
      )}

      <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
        {table.seats.map((seat) => (
          <SeatCard
            key={seat.id}
            seat={seat}
            removable={!isCommon || seat.occupantSide === null || seat.occupantSide === party}
            unassignedGuests={unassignedGuests}
            unassignedInvitees={unassignedInvitees}
            unassignedProbableAttendees={unassignedProbableAttendees}
            busy={busy}
            onAssign={(choice) => onAssign(seat.id, choice)}
            onUnassign={() => onUnassign(seat.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SeatCard({
  seat,
  removable,
  unassignedGuests,
  unassignedInvitees,
  unassignedProbableAttendees,
  busy,
  onAssign,
  onUnassign,
}: {
  seat: Seat;
  /** False for the other side's person at a Common table: only their admin may move them (the server answers 403). */
  removable: boolean;
  unassignedGuests: UnassignedGuest[];
  unassignedInvitees: UnassignedInvitee[];
  unassignedProbableAttendees: UnassignedProbableAttendee[];
  busy: boolean;
  onAssign: (choice: AssignChoice) => void;
  onUnassign: () => void;
}) {
  const occupied = seat.guestId !== null || seat.probableAttendeeId !== null || seat.inviteeId !== null;

  const byDeclined = unassignedProbableAttendees.filter((p) => p.bucket === 'declined');
  const byPending = unassignedProbableAttendees.filter((p) => p.bucket === 'pending');

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">Seat {seat.seatNumber}</span>
        {occupied && removable && (
          <button
            type="button"
            disabled={busy}
            onClick={onUnassign}
            className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {occupied ? (
        <p className="text-sm font-semibold text-slate-900">
          {seatOccupantLabel(seat)}
          {!removable && seat.occupantSide && (
            <span className="block text-xs font-normal text-slate-500">{sideLabel(seat.occupantSide)}&apos;s side</span>
          )}
          {seat.occupantRsvpStatus === 'declined' && (
            <span className="block text-xs font-semibold text-red-700">
              Declined since seated{removable ? ' — remove them from this seat' : ''}
            </span>
          )}
        </p>
      ) : (
        <select
          disabled={busy}
          defaultValue=""
          onChange={(e) => {
            const [kind, id] = e.target.value.split(':');
            if (!id) return;
            onAssign(
              kind === 'probable' ? { probableAttendeeId: id } : kind === 'invitee' ? { inviteeId: id } : { guestId: id }
            );
          }}
          className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs bg-white disabled:opacity-50"
        >
          <option value="">Unassigned — select…</option>
          <optgroup label="Accepted guests">
            {unassignedGuests.map((guest) => (
              <option key={guest.id} value={`guest:${guest.id}`}>
                {guest.name}
              </option>
            ))}
          </optgroup>
          {unassignedInvitees.length > 0 && (
            <optgroup label="Accepted invitees">
              {unassignedInvitees.map((invitee) => (
                <option key={invitee.id} value={`invitee:${invitee.id}`}>
                  {invitee.name === invitee.guestName ? invitee.name : `${invitee.name} (${invitee.guestName})`}
                </option>
              ))}
            </optgroup>
          )}
          {byDeclined.length > 0 && (
            <optgroup label="Probable (Declined)">
              {byDeclined.map((p) => (
                <option key={p.id} value={`probable:${p.id}`}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          )}
          {byPending.length > 0 && (
            <optgroup label="Probable (Pending)">
              {byPending.map((p) => (
                <option key={p.id} value={`probable:${p.id}`}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      )}
    </div>
  );
}
