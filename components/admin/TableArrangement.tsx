'use client';

import { useCallback, useEffect, useState } from 'react';

type Seat = {
  id: string;
  seatNumber: number;
  guestId: string | null;
  guestName: string | null;
  dietaryRequirements: string | null;
  specialNotes: string | null;
};

export type SeatingTable = {
  id: string;
  table_number: number;
  table_name: string | null;
  capacity: number;
  seats: Seat[];
};

export type UnassignedGuest = { id: string; name: string };

type NewTableForm = { tableNumber: string; tableName: string; capacity: string };

const EMPTY_FORM: NewTableForm = { tableNumber: '', tableName: '', capacity: '10' };

export default function TableArrangement({
  initialTables,
  initialUnassignedGuests,
}: {
  initialTables: SeatingTable[];
  initialUnassignedGuests: UnassignedGuest[];
}) {
  const [tables, setTables] = useState<SeatingTable[]>(initialTables);
  const [unassignedGuests, setUnassignedGuests] = useState<UnassignedGuest[]>(initialUnassignedGuests);
  const [form, setForm] = useState<NewTableForm>(EMPTY_FORM);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => setMessage({ kind: 'error', text: 'Could not reach the server.' }));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/table-arrangement');
      const data = await res.json();
      if (data.success) {
        setTables(data.tables);
        setUnassignedGuests(data.unassignedGuests);
      }
    } catch {
      setMessage({ kind: 'error', text: 'Could not load the seating plan.' });
    }
  }, []);

  async function handleAddTable(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/table-arrangement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          tableNumber: Number(form.tableNumber),
          tableName: form.tableName || undefined,
          capacity: Number(form.capacity),
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ kind: 'ok', text: 'Table added.' });
        setForm(EMPTY_FORM);
        await load();
        return;
      }
      setMessage({ kind: 'error', text: data.message || 'Could not add the table.' });
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTable(table: SeatingTable) {
    const confirmed = window.confirm(
      'Delete Table ' + table.table_number + (table.table_name ? ' (' + table.table_name + ')' : '') + '? Seated guests will become unassigned.'
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/table-arrangement/' + table.id, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ kind: 'ok', text: 'Table removed.' });
        await load();
      } else {
        setMessage({ kind: 'error', text: data.message || 'Could not remove the table.' });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign(
    tableId: string,
    seatId: string,
    guestId: string,
    notes?: { dietaryRequirements?: string; specialNotes?: string }
  ) {
    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/table-arrangement/${tableId}/seats/${seatId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ guestId, ...notes }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await load();
      } else {
        setMessage({ kind: 'error', text: data.message || 'Could not assign that seat.' });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleUnassign(tableId: string, seatId: string) {
    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/table-arrangement/${tableId}/seats/${seatId}/unassign`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await load();
      } else {
        setMessage({ kind: 'error', text: data.message || 'Could not remove that guest.' });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {message && (
        <p
          role="status"
          className={
            'mb-4 text-sm rounded-lg p-3 border ' +
            (message.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200')
          }
        >
          {message.text}
        </p>
      )}

      <div className="mb-6">
        <form onSubmit={handleAddTable} className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold mb-4">Add a table</h2>
          <div className="grid gap-3 sm:grid-cols-3">
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
                Name <span className="font-normal">(optional)</span>
              </label>
              <input
                id="tableName"
                placeholder="e.g., Family"
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
          </div>
          <button
            type="submit"
            disabled={busy || !csrfToken}
            className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Create table'}
          </button>
        </form>
      </div>

      {tables.length === 0 ? (
        <p className="text-sm text-slate-500">No tables created yet.</p>
      ) : (
        <div className="space-y-4">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              unassignedGuests={unassignedGuests}
              busy={busy}
              onDelete={() => handleDeleteTable(table)}
              onAssign={(seatId, guestId, notes) => handleAssign(table.id, seatId, guestId, notes)}
              onUnassign={(seatId) => handleUnassign(table.id, seatId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TableCard({
  table,
  unassignedGuests,
  busy,
  onDelete,
  onAssign,
  onUnassign,
}: {
  table: SeatingTable;
  unassignedGuests: UnassignedGuest[];
  busy: boolean;
  onDelete: () => void;
  onAssign: (seatId: string, guestId: string, notes?: { dietaryRequirements?: string; specialNotes?: string }) => void;
  onUnassign: (seatId: string) => void;
}) {
  const filled = table.seats.filter((seat) => seat.guestId).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold">
          Table {table.table_number}
          {table.table_name ? ` — ${table.table_name}` : ''}
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">
            {filled}/{table.capacity} filled
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {table.seats.map((seat) => (
          <SeatCard
            key={seat.id}
            seat={seat}
            unassignedGuests={unassignedGuests}
            busy={busy}
            onAssign={(guestId, notes) => onAssign(seat.id, guestId, notes)}
            onUnassign={() => onUnassign(seat.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SeatCard({
  seat,
  unassignedGuests,
  busy,
  onAssign,
  onUnassign,
}: {
  seat: Seat;
  unassignedGuests: UnassignedGuest[];
  busy: boolean;
  onAssign: (guestId: string, notes?: { dietaryRequirements?: string; specialNotes?: string }) => void;
  onUnassign: () => void;
}) {
  const [dietary, setDietary] = useState(seat.dietaryRequirements || '');
  const [notes, setNotes] = useState(seat.specialNotes || '');
  const notesDirty = seat.guestId !== null && (dietary !== (seat.dietaryRequirements || '') || notes !== (seat.specialNotes || ''));

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">Seat {seat.seatNumber}</span>
        {seat.guestId && (
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

      {seat.guestId ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">{seat.guestName}</p>
          <input
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
            placeholder="Dietary requirements"
            className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special notes"
            className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs"
          />
          {notesDirty && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onAssign(seat.guestId as string, { dietaryRequirements: dietary, specialNotes: notes })
              }
              className="px-2 py-1 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              Save
            </button>
          )}
        </div>
      ) : (
        <select
          disabled={busy}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onAssign(e.target.value);
          }}
          className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs bg-white disabled:opacity-50"
        >
          <option value="">Unassigned — select guest…</option>
          {unassignedGuests.map((guest) => (
            <option key={guest.id} value={guest.id}>
              {guest.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
