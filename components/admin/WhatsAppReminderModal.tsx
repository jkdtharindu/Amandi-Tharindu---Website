'use client';

import { useMemo, useState } from 'react';
import {
  DEFAULT_RSVP_REMINDER_TEMPLATE,
  renderTemplate,
  buildInvitationLink,
  buildWhatsAppLink,
} from '@/src/admin/messageTemplates.js';

type Guest = {
  name: string;
  code: string;
  whatsappNumber: string | null;
};

/** Preview-then-approve WhatsApp reminder (PRD P1 messaging, slim slice). */
export default function WhatsAppReminderModal({
  guest,
  siteUrl,
  onClose,
}: {
  guest: Guest;
  siteUrl: string;
  onClose: () => void;
}) {
  const link = useMemo(() => buildInvitationLink(siteUrl, guest.code), [siteUrl, guest.code]);

  const [message, setMessage] = useState(() =>
    renderTemplate(DEFAULT_RSVP_REMINDER_TEMPLATE, { name: guest.name, link })
  );
  const [error, setError] = useState('');

  function resetToDefault() {
    setMessage(renderTemplate(DEFAULT_RSVP_REMINDER_TEMPLATE, { name: guest.name, link }));
  }

  function handleSend() {
    if (!message.trim()) {
      setError('Message cannot be empty.');
      return;
    }
    try {
      const waLink = buildWhatsAppLink(guest.whatsappNumber, message);
      window.open(waLink, '_blank', 'noopener,noreferrer');
      onClose();
    } catch {
      setError('This guest has no usable WhatsApp number.');
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 p-5 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold mb-1">Send RSVP reminder</h2>
        <p className="text-sm text-slate-500 mb-4">
          To {guest.name} ({guest.code}) &middot; {guest.whatsappNumber ?? 'no number on file'}
        </p>

        <label htmlFor="wa-message" className="block text-xs font-semibold text-slate-500 mb-1">
          Message
        </label>
        <textarea
          id="wa-message"
          rows={5}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setError('');
          }}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <div className="mt-1 flex justify-between items-center">
          <button
            type="button"
            onClick={resetToDefault}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Reset to default
          </button>
          <span className="text-xs text-slate-400">{message.length} characters</span>
        </div>

        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

        <p className="mt-4 text-xs text-slate-500">
          This opens WhatsApp with the message filled in. Nothing is sent until you press Send
          inside WhatsApp yourself.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={!guest.whatsappNumber}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            Open in WhatsApp
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
