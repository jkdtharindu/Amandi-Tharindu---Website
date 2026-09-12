'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

export interface Invitee {
  id: string;
  name: string;
  rsvpStatus: 'pending' | 'accepted' | 'declined';
  addedBy: 'admin' | 'guest';
  approvalStatus: 'approved' | 'pending_approval' | 'rejected';
  displayOrder: number;
}

interface InvitationClientProps {
  guestCode: string;
  slotCount: number;
  hasResponded: boolean;
  currentRsvpStatus: string;
  coupleNames?: string;
  invitees?: Invitee[];
  weddingDate?: string;
}

export default function InvitationClient({
  guestCode,
  slotCount,
  hasResponded,
  currentRsvpStatus,
  coupleNames = "Amandi & Tharindu",
  invitees = [],
  weddingDate = "",
}: InvitationClientProps) {
  if (invitees.length > 0) {
    return <InviteeChecklist guestCode={guestCode} coupleNames={coupleNames} invitees={invitees} weddingDate={weddingDate} />;
  }

  return (
    <LegacyRsvpForm
      guestCode={guestCode}
      slotCount={slotCount}
      hasResponded={hasResponded}
      currentRsvpStatus={currentRsvpStatus}
      coupleNames={coupleNames}
      weddingDate={weddingDate}
    />
  );
}

function LegacyRsvpForm({
  guestCode,
  slotCount,
  hasResponded,
  currentRsvpStatus,
  coupleNames,
  weddingDate,
}: {
  guestCode: string;
  slotCount: number;
  hasResponded: boolean;
  currentRsvpStatus: string;
  coupleNames: string;
  weddingDate: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [attending, setAttending] = useState(currentRsvpStatus !== 'declined');
  const [participantNames, setParticipantNames] = useState('');
  const [loading, setLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const showToast = useToast();

  useEffect(() => {
    // Fetch CSRF token on component mount
    fetch('/api/csrf')
      .then(res => res.json())
      .then(data => setCsrfToken(data.token))
      .catch(err => console.error('Failed to fetch CSRF token:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (attending && !participantNames.trim()) {
      showToast({ kind: 'error', text: 'Please enter participant names or decline if you are not attending.' });
      return;
    }

    setLoading(true);
    try {
      const names = participantNames
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);

      const res = await fetch('/api/guest/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          code: guestCode,
          attending,
          participantNames: names,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        let msg: string;
        if (attending && weddingDate) {
          msg = `RSVP submitted — see you on ${weddingDate}!`;
        } else if (attending) {
          msg = 'RSVP submitted. We look forward to seeing you!';
        } else {
          msg = 'Thank you for letting us know. We hope to celebrate together another time.';
        }
        showToast({ kind: 'ok', text: msg });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        showToast({ kind: 'error', text: data.message || data.reason || 'Unable to save RSVP. Please try again.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Sticky Bar */}
      {!hasResponded && (
        <div className="fixed bottom-0 left-0 right-0 bg-amber-50 border-t border-amber-200 px-4 py-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-gray-800 font-semibold">
              {coupleNames} are waiting for your response 💍 — Will you join us?
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAttending(true);
                  setShowForm(true);
                }}
                className="py-2 px-6 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => {
                  setAttending(false);
                  setShowForm(true);
                }}
                className="py-2 px-6 rounded-full bg-gray-500 text-white font-semibold hover:bg-gray-600 transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RSVP Form - shown when user clicks Accept/Decline or wants to change */}
      {(showForm || hasResponded) && (
        <div className="bg-white rounded-3xl shadow-lg p-8 mb-20 md:mb-0">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">
            {hasResponded && !showForm ? 'Your RSVP Response' : 'Respond to Invitation'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Attendance Radio */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="attending"
                  value="yes"
                  checked={attending}
                  onChange={(e) => setAttending(e.target.value === 'yes')}
                  className="w-4 h-4 text-green-600 cursor-pointer"
                />
                <span className="text-gray-900 font-semibold">I will attend and celebrate with you</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="attending"
                  value="no"
                  checked={!attending}
                  onChange={(e) => setAttending(e.target.value === 'yes')}
                  className="w-4 h-4 text-red-600 cursor-pointer"
                />
                <span className="text-gray-900 font-semibold">I will not be able to attend</span>
              </label>
            </div>

            {/* Participant Names - shown only if attending */}
            {attending && (
              <div>
                <label htmlFor="participants" className="block text-sm font-semibold text-gray-700 mb-3">
                  Participant Names (comma-separated, {slotCount} available)
                </label>
                <textarea
                  id="participants"
                  value={participantNames}
                  onChange={(e) => setParticipantNames(e.target.value)}
                  placeholder={`e.g., ${['Nimal Silva', 'Anu Silva', 'Ravi Silva'].slice(0, slotCount).join(', ')}`}
                  disabled={!attending || loading}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  rows={3}
                />
                <p className="text-sm text-gray-600 mt-2">
                  Please list all attendees from your party (up to {slotCount} people).
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-full bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : 'Submit RSVP'}
            </button>

            {/* Change Response Button - shown if already responded */}
            {hasResponded && !showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="w-full py-2 px-6 rounded-full border-2 border-blue-600 text-blue-600 font-bold hover:bg-blue-50 transition-colors"
              >
                Change Your Response
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * Per-person accept/decline for a multi-person invitation with named
 * invitees (2026-09), instead of one accept/decline for the whole party.
 */
function InviteeChecklist({
  guestCode,
  coupleNames,
  invitees,
  weddingDate,
}: {
  guestCode: string;
  coupleNames: string;
  invitees: Invitee[];
  weddingDate: string;
}) {
  const approved = invitees
    .filter((invitee) => invitee.approvalStatus === 'approved')
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const pendingRequests = invitees.filter((invitee) => invitee.approvalStatus === 'pending_approval');

  const [responses, setResponses] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(
      approved.map((invitee) => [
        invitee.id,
        invitee.rsvpStatus === 'accepted' ? true : invitee.rsvpStatus === 'declined' ? false : null,
      ])
    )
  );
  const [newPersonName, setNewPersonName] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch((err) => console.error('Failed to fetch CSRF token:', err));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const unanswered = approved.filter((invitee) => responses[invitee.id] === null || responses[invitee.id] === undefined);
    if (unanswered.length > 0) {
      showToast({ kind: 'error', text: 'Please accept or decline for everyone in the list.' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/guest/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          code: guestCode,
          inviteeResponses: approved.map((invitee) => ({ id: invitee.id, attending: responses[invitee.id] })),
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const anyAccepted = approved.some((invitee) => responses[invitee.id] === true);
        let text: string;
        if (anyAccepted && weddingDate) {
          text = `RSVP submitted — see you on ${weddingDate}!`;
        } else if (anyAccepted) {
          text = 'RSVP submitted. We look forward to seeing you!';
        } else {
          text = 'Thank you for letting us know. We hope to celebrate together another time.';
        }
        showToast({ kind: 'ok', text });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast({ kind: 'error', text: data.message || data.reason || 'Unable to save RSVP. Please try again.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestAddPerson() {
    const name = newPersonName.trim();
    if (!name) return;

    setRequesting(true);
    try {
      const res = await fetch('/api/guest/invitees/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ code: guestCode, name }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast({ kind: 'ok', text: `Request sent! ${coupleNames.split('&')[0].trim() || 'The couple'}'s admin will need to approve it before it's added.` });
        setNewPersonName('');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not send that request.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-2 text-gray-900">Who&apos;s Coming?</h2>
      <p className="text-sm text-gray-600 mb-6">
        Let {coupleNames} know who from your party will be attending.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {approved.map((invitee) => (
          <div
            key={invitee.id}
            className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 rounded-2xl px-4 py-3"
          >
            <span className="font-semibold text-gray-900">{invitee.name}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResponses((prev) => ({ ...prev, [invitee.id]: true }))}
                className={`py-1.5 px-4 rounded-full text-sm font-semibold transition-colors ${
                  responses[invitee.id] === true
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                }`}
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => setResponses((prev) => ({ ...prev, [invitee.id]: false }))}
                className={`py-1.5 px-4 rounded-full text-sm font-semibold transition-colors ${
                  responses[invitee.id] === false
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Decline
              </button>
            </div>
          </div>
        ))}

        {pendingRequests.map((invitee) => (
          <div
            key={invitee.id}
            className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 rounded-2xl px-4 py-3"
          >
            <span className="font-semibold text-gray-700">{invitee.name}</span>
            <span className="text-xs font-semibold text-amber-700">Waiting for admin approval</span>
          </div>
        ))}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 px-6 rounded-full bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Submit RSVP'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <label htmlFor="newPerson" className="block text-sm font-semibold text-gray-700 mb-2">
          Need to add someone not on this list?
        </label>
        <div className="flex gap-2">
          <input
            id="newPerson"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            placeholder="Their full name"
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleRequestAddPerson}
            disabled={requesting || !newPersonName.trim()}
            className="py-2 px-5 rounded-full border-2 border-blue-600 text-blue-600 font-semibold hover:bg-blue-50 disabled:opacity-50 transition-colors"
          >
            {requesting ? 'Sending...' : 'Request'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          This needs a quick approval before it&apos;s added to your list.
        </p>
      </div>
    </div>
  );
}
