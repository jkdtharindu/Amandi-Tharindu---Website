'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

export type InviteeRequest = {
  id: string;
  name: string;
  createdAt: string;
  guestId: string;
  guestName: string;
  guestCode: string;
};

/**
 * Pending "add another person" requests from guests -- a guest can ask to
 * add someone not on their original invitation, and it doesn't count toward
 * RSVP or seating until an admin approves it here.
 */
export default function InviteeRequests() {
  const [requests, setRequests] = useState<InviteeRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const showToast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/invitee-requests');
      const data = await res.json();
      if (data.success) setRequests(data.requests);
    } catch {
      // Silent -- this is a secondary panel, not worth blocking the page for.
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleDecision(id: string, decision: 'approve' | 'reject') {
    setBusyId(id);
    try {
      const csrfRes = await fetch('/api/csrf');
      const { token: csrfToken } = await csrfRes.json();

      const res = await fetch(`/api/admin/invitee-requests/${id}/${decision}`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast({
          kind: 'ok',
          text: decision === 'approve' ? 'Request approved.' : 'Request rejected.',
        });
        await load();
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not update that request.' });
        // A refusal usually means this list is out of date, so show it as it is now.
        await load();
      }
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
      <h2 className="font-semibold text-amber-900 mb-3">
        {requests.length} pending participant {requests.length === 1 ? 'request' : 'requests'}
      </h2>
      <div className="space-y-2">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2"
          >
            <p className="text-sm">
              <span className="font-semibold">{req.guestName}</span> ({req.guestCode}) wants to add{' '}
              <span className="font-semibold">{req.name}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyId === req.id}
                onClick={() => handleDecision(req.id, 'approve')}
                className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busyId === req.id}
                onClick={() => handleDecision(req.id, 'reject')}
                className="px-3 py-1 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
