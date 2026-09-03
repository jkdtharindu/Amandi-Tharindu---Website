'use client';

import { useState, useEffect } from 'react';

interface InvitationClientProps {
  guestCode: string;
  slotCount: number;
  hasResponded: boolean;
  currentRsvpStatus: string;
}

export default function InvitationClient({
  guestCode,
  slotCount,
  hasResponded,
  currentRsvpStatus,
}: InvitationClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [attending, setAttending] = useState(true);
  const [participantNames, setParticipantNames] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>('');

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
      setMessage('Please enter participant names or decline if you are not attending.');
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
        setMessage('Thank you! Your response has been saved. We look forward to seeing you!');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage(data.message || data.reason || 'Unable to save RSVP. Please try again.');
      }
    } catch (err) {
      setMessage('An error occurred. Please try again.');
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
              Amandi & Tharindu are waiting for your response 💍 — Will you join us?
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

          {/* Message */}
          {message && (
            <div
              className={`mt-6 p-4 rounded-2xl ${
                message.includes('Thank you')
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
              role="status"
              aria-live="polite"
            >
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
