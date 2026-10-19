'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GuestMessageModal, { type MessageTemplate } from './GuestMessageModal';
import { useToast } from '@/components/Toast';

export type Guest = {
  id: string;
  code: string;
  name: string;
  relationship: string;
  slotCount: number;
  whatsappNumber: string | null;
  rsvpStatus: string;
};

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
  inviteeNames: string[];
};

/** Value of the "Add new group…" option in the group pick-list. */
const NEW_GROUP = '__new_group__';

type ExistingInvitee = { id: string; name: string; rsvpStatus: string };

/** Guest CRUD, filtering, and search (PRD P0-07). */
export default function GuestManager({
  initialGuests,
  categories = ['Relations', 'Colleagues', 'Neighbours', 'Friends'],
  siteUrl,
  party,
  templates,
  weddingDate,
  venueName,
}: {
  initialGuests: Guest[];
  categories?: string[];
  siteUrl: string;
  party: 'bride' | 'groom';
  templates: MessageTemplate[];
  weddingDate: string;
  venueName: string;
}) {
  // The pick-list starts from the server's list (built-in groups plus any custom
  // group already in use) and grows when the admin adds a new one (Action 84).
  const [groups, setGroups] = useState<string[]>(categories);
  const [newGroup, setNewGroup] = useState('');
  const EMPTY_FORM: FormState = {
    name: '',
    relationship: categories[0] || 'Relations',
    slotCount: '1',
    whatsappNumber: '',
    inviteeNames: [],
  };
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [reminderGuest, setReminderGuest] = useState<Guest | null>(null);
  const [status, setStatus] = useState('all');
  const [relationship, setRelationship] = useState('all');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<Guest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [existingInvitees, setExistingInvitees] = useState<ExistingInvitee[]>([]);
  const [removingInviteeId, setRemovingInviteeId] = useState<string | null>(null);
  const [newInviteeNames, setNewInviteeNames] = useState<string[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    body: string[];
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const [busy, setBusy] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const showToast = useToast();

  // Guards against an older in-flight request overwriting a newer result.
  const requestId = useRef(0);

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => showToast({ kind: 'error', text: 'Could not reach the server.' }));
  }, [showToast]);

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
        showToast({ kind: 'error', text: 'Could not load the guest list.' });
      }
    }
  }, [status, relationship, search, showToast]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setExistingInvitees([]);
    setNewInviteeNames([]);
    setShowForm(true);
  }

  async function loadExistingInvitees(guestId: string) {
    try {
      const res = await fetch('/api/admin/guests/' + guestId + '/invitees');
      const data = await res.json();
      if (data.success) setExistingInvitees(data.invitees);
    } catch {
      // Non-fatal — the edit form still works without the invitee list.
    }
  }

  function openEdit(guest: Guest) {
    setEditing(guest);
    setForm({
      name: guest.name,
      relationship: guest.relationship,
      slotCount: String(guest.slotCount),
      whatsappNumber: guest.whatsappNumber ?? '',
      inviteeNames: [],
    });
    setFieldErrors({});
    setExistingInvitees([]);
    setNewInviteeNames([]);
    void loadExistingInvitees(guest.id);
    setShowForm(true);
  }

  function handleRemoveInvitee(invitee: ExistingInvitee) {
    if (!editing) return;
    setConfirmDialog({
      title: 'Remove ' + invitee.name + '?',
      body: [
        'This removes them from this party.',
        'If they were already seated, their seat becomes open again.',
      ],
      confirmLabel: 'Yes, remove',
      onConfirm: () => doRemoveInvitee(invitee),
    });
  }

  async function doRemoveInvitee(invitee: ExistingInvitee) {
    if (!editing) return;
    setRemovingInviteeId(invitee.id);

    try {
      const res = await fetch(
        '/api/admin/guests/' + editing.id + '/invitees/' + invitee.id,
        { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } }
      );
      const data = await res.json();

      if (res.ok && data.success) {
        setExistingInvitees(data.invitees);
        showToast({ kind: 'ok', text: 'Removed ' + invitee.name + '.' });
        await load();
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not remove that person.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setRemovingInviteeId(null);
    }
  }

  /**
   * Saves the names typed under "Add more people to this party". Resolves to
   * the party's people afterwards, or null when nothing was saved (an empty
   * row, or the server refused) — the reason is already on screen.
   */
  async function saveNewInvitees(): Promise<ExistingInvitee[] | null> {
    if (!editing) return null;

    const trimmedNames = newInviteeNames.map((n) => n.trim());
    if (trimmedNames.some((n) => !n)) {
      setFieldErrors({
        newInviteeNames: 'Fill in a name for each new person, or remove the empty row.',
      });
      return null;
    }

    try {
      const res = await fetch('/api/admin/guests/' + editing.id + '/invitees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ names: trimmedNames }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setExistingInvitees(data.invitees);
        setNewInviteeNames([]);
        return data.invitees;
      }
      showToast({ kind: 'error', text: data.message || 'Could not add people.' });
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    }
    return null;
  }

  async function handleAddNewInvitees() {
    if (!editing || newInviteeNames.length === 0) return;

    const addedCount = newInviteeNames.length;
    setBusy(true);
    setFieldErrors({});
    try {
      if (await saveNewInvitees()) {
        showToast({
          kind: 'ok',
          text: `Added ${addedCount} person${addedCount === 1 ? '' : 's'}.`,
        });
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFieldErrors({});

    const url = editing ? '/api/admin/guests/' + editing.id : '/api/admin/guests';
    const trimmedInviteeNames = form.inviteeNames.map((n) => n.trim()).filter(Boolean);
    const payload: Record<string, unknown> = {
      name: form.name,
      relationship:
        form.relationship === NEW_GROUP ? newGroup.trim() : form.relationship,
      whatsappNumber: form.whatsappNumber,
    };

    try {
      // Names still sitting in "Add more people" are part of this save. Saving
      // only the guest's details used to close the form and silently drop them,
      // so the party never grew. They go first, so the headcount sent below
      // already includes them.
      let currentInvitees = existingInvitees;
      let addedCount = 0;
      if (editing && newInviteeNames.length > 0) {
        addedCount = newInviteeNames.length;
        const saved = await saveNewInvitees();
        if (!saved) return;
        currentInvitees = saved;
      }

      if (!editing && trimmedInviteeNames.length > 0) {
        payload.inviteeNames = trimmedInviteeNames;
      } else if (editing && currentInvitees.length > 0) {
        // The Seats field is disabled for a party with named invitees and shows
        // the live count, but form.slotCount is frozen at whatever it held when
        // the form opened — so removing someone and then saving an unrelated
        // field submitted the pre-removal number (Next Action 32). Send the live
        // count; the server re-derives it from the invitee list regardless.
        payload.slotCount = currentInvitees.length;
      } else {
        payload.slotCount = Number(form.slotCount);
      }

      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const added = addedCount
          ? ` and added ${addedCount} ${addedCount === 1 ? 'person' : 'people'}`
          : '';
        showToast({
          kind: 'ok',
          text: editing
            ? 'Updated ' + data.guest.name + added + '.'
            : 'Added ' + data.guest.name + ' with code ' + data.guest.code + '.',
        });
        const savedGroup = String(payload.relationship);
        setGroups((current) =>
          current.some((g) => g.toLowerCase() === savedGroup.toLowerCase())
            ? current
            : [...current, savedGroup]
        );
        setNewGroup('');
        setShowForm(false);
        setEditing(null);
        await load();
        return;
      }

      if (data.errors) setFieldErrors(data.errors);
      showToast({ kind: 'error', text: data.message || 'Could not save the guest.' });
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  function handleDelete(guest: Guest) {
    setConfirmDialog({
      title: 'Remove ' + guest.name + ' (' + guest.code + ')?',
      body: [
        'Any table seats they hold become open again.',
        'Their RSVP history is kept in the database and can be restored.',
      ],
      confirmLabel: 'Yes, remove',
      onConfirm: () => doDelete([guest]),
    });
  }

  /** Replaces every guest code on this side (PRD §23). Asks how many will change first. */
  async function handleRegenerateCodes() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/guests/regenerate-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast({ kind: 'error', text: data.message || 'Could not check the codes.' });
        return;
      }
      if (data.count === 0) {
        showToast({ kind: 'ok', text: 'There are no guests to give codes to.' });
        return;
      }
      setConfirmDialog({
        title: `Replace the code of ${data.count} guest${data.count === 1 ? '' : 's'}?`,
        body: [
          'Every guest on your side gets a new 5-character code.',
          'Any card, link or message that already carries an old code will stop working.',
          'Only do this if no codes have been sent out yet.',
        ],
        confirmLabel: 'Yes, replace all codes',
        onConfirm: doRegenerateCodes,
      });
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function doRegenerateCodes() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/guests/regenerate-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast({ kind: 'ok', text: `Replaced ${data.count} guest codes.` });
        await load();
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not replace the codes.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteSelected() {
    const chosen = guests.filter((g) => selectedIds.has(g.id));
    if (chosen.length === 0) return;
    setConfirmDialog({
      title: `Remove ${chosen.length} guest${chosen.length === 1 ? '' : 's'}?`,
      body: [
        chosen.map((g) => g.name).join(', '),
        'Any table seats they hold become open again.',
        'Their RSVP history is kept in the database and can be restored.',
      ],
      confirmLabel: `Yes, remove ${chosen.length}`,
      onConfirm: () => doDelete(chosen),
    });
  }

  async function doDelete(targets: Guest[]) {
    setBusy(true);
    let removed = 0;
    let lastError = '';

    try {
      for (const guest of targets) {
        try {
          const res = await fetch('/api/admin/guests/' + guest.id, {
            method: 'DELETE',
            headers: { 'x-csrf-token': csrfToken },
          });
          const data = await res.json();
          if (res.ok && data.success) removed++;
          else lastError = data.message || 'Could not remove ' + guest.name + '.';
        } catch {
          lastError = 'Something went wrong. Please try again.';
        }
      }

      if (removed > 0) {
        showToast({
          kind: 'ok',
          text:
            targets.length === 1
              ? 'Removed ' + targets[0].name + '.'
              : `Removed ${removed} of ${targets.length} guests.`,
        });
      }
      if (lastError) showToast({ kind: 'error', text: lastError });
      setSelectedIds(new Set());
      await load();
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = guests.length > 0 && guests.every((g) => selectedIds.has(g.id));

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(guests.map((g) => g.id)));
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
              {groups.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleRegenerateCodes}
            disabled={busy || !csrfToken}
            className="ml-auto px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
          >
            Regenerate all codes
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            Add guest
          </button>
        </div>
      </div>

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
                Guest person&apos;s name / Family&apos;s name / Couple name
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
                {groups.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
                <option value={NEW_GROUP}>Add new group…</option>
              </select>
              {form.relationship === NEW_GROUP && (
                <input
                  aria-label="New group name"
                  placeholder="e.g. School mates"
                  required
                  maxLength={30}
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              )}
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
                disabled={
                  (!editing && form.inviteeNames.length > 0) ||
                  (editing !== null && existingInvitees.length > 0)
                }
                value={
                  !editing && form.inviteeNames.length > 0
                    ? String(form.inviteeNames.length)
                    : editing && existingInvitees.length > 0
                      ? String(existingInvitees.length + newInviteeNames.length)
                      : form.slotCount
                }
                onChange={(e) => setForm({ ...form, slotCount: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100 disabled:text-slate-500"
              />
              {fieldErrors.slotCount && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.slotCount}</p>
              )}
              {editing && existingInvitees.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  {newInviteeNames.length > 0
                    ? `Counts ${newInviteeNames.length} new ${newInviteeNames.length === 1 ? 'person' : 'people'} not saved yet — they are saved with Save changes.`
                    : 'Derived from the named people below — remove someone there to reduce it.'}
                </p>
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

          {editing && existingInvitees.length > 0 && (
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                People in this party
              </label>
              <div className="space-y-2">
                {existingInvitees.map((invitee) => (
                  <div
                    key={invitee.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  >
                    <span>
                      {invitee.name}{' '}
                      <span className="text-xs text-slate-500">({invitee.rsvpStatus})</span>
                    </span>
                    <button
                      type="button"
                      disabled={removingInviteeId === invitee.id}
                      onClick={() => handleRemoveInvitee(invitee)}
                      className="px-3 py-1 rounded-lg border border-rose-300 text-rose-600 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Removing someone here deletes their invitation permanently and frees their seat
                if they had one.
              </p>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Add more people to this party
                </label>
                <div className="space-y-2">
                  {newInviteeNames.map((name, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        value={name}
                        onChange={(e) => {
                          const next = [...newInviteeNames];
                          next[index] = e.target.value;
                          setNewInviteeNames(next);
                        }}
                        placeholder={`Person ${existingInvitees.length + index + 1}`}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setNewInviteeNames(newInviteeNames.filter((_, i) => i !== index))
                        }
                        className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-rose-600 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setNewInviteeNames([...newInviteeNames, ''])}
                  className="mt-2 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-100"
                >
                  + Add a person
                </button>
                {fieldErrors.newInviteeNames && (
                  <p className="mt-1 text-xs text-red-700">{fieldErrors.newInviteeNames}</p>
                )}
                {newInviteeNames.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddNewInvitees}
                    disabled={busy}
                    className="mt-2 ml-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? 'Adding...' : 'Add these people'}
                  </button>
                )}
              </div>
            </div>
          )}

          {!editing && (
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                People in this party{' '}
                <span className="font-normal">(required when there is more than one seat)</span>
              </label>
              <div className="space-y-2">
                {form.inviteeNames.map((name, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      value={name}
                      onChange={(e) => {
                        const next = [...form.inviteeNames];
                        next[index] = e.target.value;
                        setForm({ ...form, inviteeNames: next });
                      }}
                      placeholder={`Person ${index + 1}`}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          inviteeNames: form.inviteeNames.filter((_, i) => i !== index),
                        })
                      }
                      className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-rose-600 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, inviteeNames: [...form.inviteeNames, ''] })}
                className="mt-2 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-100"
              >
                + Add a person
              </button>
              {fieldErrors.inviteeNames && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.inviteeNames}</p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Add a name per person. The guest accepts or declines for each one, and each
                person can be given a table. For a single seat you can leave this empty: the
                guest&apos;s own name is saved as that one person.
              </p>
            </div>
          )}

          {!editing && (
            <p className="mt-3 text-xs text-slate-500">
              A 5-character invitation code is generated automatically (group letter, name letter, 3 digits).
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

      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="font-semibold">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
          >
            Remove selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-slate-600 hover:text-slate-900 text-xs font-semibold"
          >
            Clear
          </button>
        </div>
      )}

      {/* Guest table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="pl-4 pr-0 py-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all guests"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>
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
                  <td className="pl-4 pr-0 py-3 w-8">
                    <input
                      type="checkbox"
                      aria-label={'Select ' + guest.name}
                      checked={selectedIds.has(guest.id)}
                      onChange={() => toggleSelected(guest.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
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
                    {guest.whatsappNumber ? (
                      <button
                        type="button"
                        onClick={() => setReminderGuest(guest)}
                        className="text-emerald-700 hover:text-emerald-900 hover:underline"
                        title="Message on WhatsApp"
                      >
                        {guest.whatsappNumber}
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
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

      {confirmDialog && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 id="confirm-title" className="font-semibold text-lg">
              {confirmDialog.title}
            </h2>
            <div className="mt-2 space-y-2 text-sm text-slate-600">
              {confirmDialog.body.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              <p className="font-semibold text-slate-800">Are you sure?</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  void action();
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {reminderGuest && (
        <GuestMessageModal
          guest={reminderGuest}
          party={party}
          siteUrl={siteUrl}
          weddingDate={weddingDate}
          venueName={venueName}
          templates={templates}
          onClose={() => setReminderGuest(null)}
        />
      )}
    </div>
  );
}
