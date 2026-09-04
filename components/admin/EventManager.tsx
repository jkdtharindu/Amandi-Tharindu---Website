'use client';

import { useCallback, useEffect, useState } from 'react';

export type CelebrationEvent = {
  id: string;
  name: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress: string;
  displayOrder: number;
};

type FormState = {
  name: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress: string;
  displayOrder: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  eventDate: '',
  eventTime: '',
  venueName: '',
  venueAddress: '',
  displayOrder: '0',
};

export default function EventManager({ initialEvents }: { initialEvents: CelebrationEvent[] }) {
  const [events, setEvents] = useState<CelebrationEvent[]>(initialEvents);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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
      const res = await fetch('/api/admin/events');
      const data = await res.json();
      if (data.success) setEvents(data.events);
    } catch {
      setMessage({ kind: 'error', text: 'Could not load events.' });
    }
  }, []);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ ...form, displayOrder: Number(form.displayOrder) }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ kind: 'ok', text: 'Event added.' });
        setForm({ ...EMPTY_FORM, displayOrder: String(events.length) });
        await load();
        return;
      }
      setMessage({ kind: 'error', text: data.message || 'Could not add the event.' });
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleFieldSave(event: CelebrationEvent, patch: Partial<CelebrationEvent>) {
    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/events/' + event.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(patch),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setEvents((prev) => prev.map((e) => (e.id === event.id ? data.event : e)));
      } else {
        setMessage({ kind: 'error', text: 'Could not save that change.' });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(event: CelebrationEvent) {
    const confirmed = window.confirm('Remove "' + event.name + '" from the celebration page?');
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/events/' + event.id, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setEvents((prev) => prev.filter((e) => e.id !== event.id));
        setMessage({ kind: 'ok', text: 'Event removed.' });
      } else {
        setMessage({ kind: 'error', text: 'Could not remove the event.' });
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

      <form onSubmit={handleAdd} className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h2 className="font-semibold mb-4">Add an event</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="new-name" className="block text-xs font-semibold text-slate-500 mb-1">
              Name
            </label>
            <input
              id="new-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Ceremony"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label htmlFor="new-date" className="block text-xs font-semibold text-slate-500 mb-1">
              Date
            </label>
            <input
              id="new-date"
              type="date"
              required
              value={form.eventDate}
              onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label htmlFor="new-time" className="block text-xs font-semibold text-slate-500 mb-1">
              Time
            </label>
            <input
              id="new-time"
              required
              value={form.eventTime}
              onChange={(e) => setForm({ ...form, eventTime: e.target.value })}
              placeholder="e.g., 3:00 PM"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label htmlFor="new-venue-name" className="block text-xs font-semibold text-slate-500 mb-1">
              Venue name
            </label>
            <input
              id="new-venue-name"
              required
              value={form.venueName}
              onChange={(e) => setForm({ ...form, venueName: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label htmlFor="new-venue-address" className="block text-xs font-semibold text-slate-500 mb-1">
              Venue address <span className="font-normal">(optional)</span>
            </label>
            <input
              id="new-venue-address"
              value={form.venueAddress}
              onChange={(e) => setForm({ ...form, venueAddress: e.target.value })}
              placeholder="Used for the Google Maps link"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label htmlFor="new-order" className="block text-xs font-semibold text-slate-500 mb-1">
              Display order
            </label>
            <input
              id="new-order"
              type="number"
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !csrfToken}
          className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Add event'}
        </button>
      </form>

      {events.length === 0 ? (
        <p className="text-sm text-slate-500">No events yet.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              busy={busy}
              onSave={(patch) => handleFieldSave(event, patch)}
              onDelete={() => handleDelete(event)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({
  event,
  busy,
  onSave,
  onDelete,
}: {
  event: CelebrationEvent;
  busy: boolean;
  onSave: (patch: Partial<CelebrationEvent>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(event.name);
  const [eventDate, setEventDate] = useState(event.eventDate);
  const [eventTime, setEventTime] = useState(event.eventTime);
  const [venueName, setVenueName] = useState(event.venueName);
  const [venueAddress, setVenueAddress] = useState(event.venueAddress);

  const dirty =
    name !== event.name ||
    eventDate !== event.eventDate ||
    eventTime !== event.eventTime ||
    venueName !== event.venueName ||
    venueAddress !== event.venueAddress;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <input
          value={eventTime}
          onChange={(e) => setEventTime(e.target.value)}
          placeholder="Time"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <input
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          placeholder="Venue name"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <input
          value={venueAddress}
          onChange={(e) => setVenueAddress(e.target.value)}
          placeholder="Venue address (optional)"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
      </div>

      <div className="mt-3 flex gap-2">
        {dirty && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave({ name, eventDate, eventTime, venueName, venueAddress })}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            Save
          </button>
        )}
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
  );
}
