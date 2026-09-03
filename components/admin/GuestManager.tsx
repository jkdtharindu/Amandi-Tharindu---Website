'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type Guest = {
  id: string;
  code: string;
  name: string;
  relationship: string;
  slotCount: number;
  whatsappNumber: string | null;
  rsvpStatus: string;
};

const RELATIONSHIPS = ['Relations', 'Colleagues', 'Neighbours', 'Friends'];
const STATUSES = ['all', 'pending', 'accepted', 'declined'];

const STATUS_STYLES: Record<string, string> = {
  accepted: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-rose-100 text-rose-800',
  pending: 'bg-amber-100 text-amber-800',
};

type FormState = {
  name: string;
  relationship: string;
  slotCount: string;
  whatsappNumber: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  relationship: 'Relations',
  slotCount: '1',
  whatsappNumber: '',
};

/** Guest CRUD, filtering, and search (PRD P0-07). */
export default function GuestManager({ initialGuests }: { initialGuests: Guest[] }) {
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [status, setStatus] = useState('all');
  const [relationship, setRelationship] = useState('all');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<Guest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');

  // Guards against an older in-flight request overwriting a newer result.
  const requestId = useRef(0);

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => setMessage({ kind: 'error', text: 'Could not reach the server.' }));
  }, []);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const params = new URLSearchParams({ status, relationship, search });

    try {
      const res = await fetch('/api/admin/guests?' + params.toString());
      const data = await res.json();
      if (id !== requestId.current) return; // a newer request already answered
      if (data.success) setGuests(data.guests);
    } catch {
      if (id === requestId.current) {
        setMessage({ kind: 'error', text: 'Could not load the guest list.' });
      }
    }
  }, [status, relationship, search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setShowForm(true);
  }

  function openEdit(guest: Guest) {
    setEditing(guest);
    setForm({
      name: guest.name,
      relationship: guest.relationship,
      slotCount: String(guest.slotCount),
      whatsappNumber: guest.whatsappNumber ?? '',
    });
    setFieldErrors({});
    setShowForm(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFieldErrors({});
    setMessage(null);

    const url = editing ? '/api/admin/guests/' + editing.id : '/api/admin/guests';

    try {
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ ...form, slotCount: Number(form.slotCount) }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({
          kind: 'ok',
          text: editing
            ? 'Updated ' + data.guest.name + '.'
            : 'Added ' + data.guest.name + ' with code ' + data.guest.code + '.',
        });
        setShowForm(false);
        setEditing(null);
        await load();
        return;
      }

      if (data.errors) setFieldErrors(data.errors);
      setMessage({ kind: 'error', text: data.message || 'Could not save the guest.' });
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(guest: Guest) {
    const confirmed = window.confirm(
      'Remove ' +
        guest.name +
        ' (' +
        guest.code +
        ') from the guest list?\n\n' +
        'Their RSVP history is kept in the database and can be restored.'
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/guests/' + guest.id, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ kind: 'ok', text: 'Removed ' + guest.name + '.' });
        await load();
      } else {
        setMessage({
          kind: 'error',
          text: data.message || 'Could not remove the guest.',
        });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const filtersActive = status !== 'all' || relationship !== 'all' || search !== '';

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="search"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              Search
            </label>
            <input
              id="search"
              type="search"
              placeholder="Name or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              RSVP status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value === 'all'
                    ? 'All statuses'
                    : value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="relationship"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              Group
            </label>
            <select
              id="relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="all">All groups</option>
              {RELATIONSHIPS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="ml-auto px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            Add guest
          </button>
        </div>
      </div>

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

      {/* Add / edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-4"
        >
          <h2 className="font-semibold mb-4">
            {editing ? 'Edit ' + editing.code : 'Add a guest'}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label
                htmlFor="name"
                className="block text-xs font-semibold text-slate-500 mb-1"
              >
                Full name
              </label>
              <input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="form-relationship"
                className="block text-xs font-semibold text-slate-500 mb-1"
              >
                Group
              </label>
              <select
                id="form-relationship"
                value={form.relationship}
                onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                {RELATIONSHIPS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              {fieldErrors.relationship && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.relationship}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="slotCount"
                className="block text-xs font-semibold text-slate-500 mb-1"
              >
                Seats
              </label>
              <input
                id="slotCount"
                type="number"
                min={1}
                max={99}
                required
                value={form.slotCount}
                onChange={(e) => setForm({ ...form, slotCount: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
              {fieldErrors.slotCount && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.slotCount}</p>
              )}
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor="whatsappNumber"
                className="block text-xs font-semibold text-slate-500 mb-1"
              >
                WhatsApp number <span className="font-normal">(optional)</span>
              </label>
              <input
                id="whatsappNumber"
                value={form.whatsappNumber}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                placeholder="+94 7X XXX XXXX"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          {!editing && (
            <p className="mt-3 text-xs text-slate-500">
              An invitation code is generated automatically from the surname.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={busy || !csrfToken}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add guest'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Guest table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Code
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Group
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Seats
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  RSVP
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  WhatsApp
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {guests.map((guest) => (
                <tr key={guest.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{guest.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{guest.code}</td>
                  <td className="px-4 py-3 text-slate-600">{guest.relationship}</td>
                  <td className="px-4 py-3 tabular-nums">{guest.slotCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        'inline-block px-2 py-0.5 rounded-full text-xs font-semibold ' +
                        (STATUS_STYLES[guest.rsvpStatus] ?? 'bg-slate-100 text-slate-700')
                      }
                    >
                      {guest.rsvpStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {guest.whatsappNumber ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(guest)}
                      className="text-slate-600 hover:text-slate-900 font-semibold mr-3"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(guest)}
                      disabled={busy}
                      className="text-rose-600 hover:text-rose-800 font-semibold disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {guests.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {filtersActive
              ? 'No guests match these filters.'
              : 'No guests yet. Add your first guest to get started.'}
          </p>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Showing {guests.length} guest{guests.length === 1 ? '' : 's'}.
      </p>
    </div>
  );
}
