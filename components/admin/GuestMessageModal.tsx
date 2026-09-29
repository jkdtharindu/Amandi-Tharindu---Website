'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  renderTemplate,
  buildSiteLink,
  buildWhatsAppLink,
  greetingForParty,
  TABLE_UPDATE_TEMPLATE,
} from '@/src/admin/messageTemplates.js';
import { useToast } from '@/components/Toast';

type Guest = {
  id: string;
  name: string;
  code: string;
  whatsappNumber: string | null;
};

export type MessageTemplate = {
  id: string;
  name: string;
  label: string;
  body: string;
  channel: string;
};

type MessageEvent = { eventName: string; isCompleted: boolean };

type Kind = { key: string; label: string; eventName: string; body: string };

/**
 * The per-guest WhatsApp drop-down (Action 73): one guest, four message kinds
 * (RSVP reminder, final reminder, thank you, table-number update), each shown
 * with the filled-in text and whether it's already been ticked as sent. Picking
 * one and opening WhatsApp does not tick it by itself — the owner's Grill Me
 * answer described ticking as a separate, deliberate step afterward, so it can
 * also be un-ticked (a mis-tick, or a message that needs re-sending).
 */
export default function GuestMessageModal({
  guest,
  party,
  siteUrl,
  weddingDate,
  venueName,
  templates,
  onClose,
}: {
  guest: Guest;
  party: 'bride' | 'groom';
  siteUrl: string;
  weddingDate: string;
  venueName: string;
  templates: MessageTemplate[];
  onClose: () => void;
}) {
  const link = useMemo(() => buildSiteLink(siteUrl), [siteUrl]);
  const showToast = useToast();

  const kinds = useMemo<Kind[]>(() => {
    const byName = (name: string) => templates.find((entry) => entry.name === name)?.body ?? '';
    return [
      { key: 'reminder_1', label: 'RSVP reminder', eventName: 'RSVP Reminder', body: byName('reminder_1') },
      { key: 'table_update', label: 'Table number update', eventName: 'Table Details', body: TABLE_UPDATE_TEMPLATE },
      { key: 'reminder_2', label: 'Final reminder', eventName: 'Final Reminder', body: byName('reminder_2') },
      { key: 'thank_you', label: 'Thank you', eventName: 'Thank You', body: byName('thank_you') },
    ];
  }, [templates]);

  const [kindKey, setKindKey] = useState(kinds[0].key);
  const kind = kinds.find((entry) => entry.key === kindKey) ?? kinds[0];

  const [events, setEvents] = useState<MessageEvent[]>([]);
  const [tableName, setTableName] = useState('');
  const [loadingContext, setLoadingContext] = useState(true);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [togglingKind, setTogglingKind] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isCompleted = (eventName: string) =>
    events.find((entry) => entry.eventName === eventName)?.isCompleted ?? false;

  function renderFor(k: Kind): string {
    return renderTemplate(k.body, {
      name: guest.name,
      code: guest.code,
      link,
      date: weddingDate,
      venue: venueName,
      greeting: greetingForParty(party),
      tablenumber: tableName || 'their table (once seating is finalised)',
    });
  }

  // Derived at render time, not synced via an effect: whenever tableName
  // finishes loading, or the kind changes, this picks it up on the next
  // render automatically — but never clobbers an in-progress edit.
  const message = draft ?? renderFor(kind);

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => showToast({ kind: 'error', text: 'Could not reach the server.' }));

    fetch(`/api/admin/messages/events?guestId=${guest.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEvents(data.events);
          setTableName(data.tableName ?? '');
        }
      })
      .catch(() => {
        // Non-fatal: the drop-down still works with no tick marks and a
        // "not yet assigned" table placeholder.
      })
      .finally(() => setLoadingContext(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    textareaRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  function selectKind(nextKey: string) {
    setKindKey(nextKey);
    setDraft(null);
    setError('');
  }

  function resetToTemplate() {
    setDraft(null);
  }

  function handleOpen() {
    if (!message.trim()) {
      setError('Message cannot be empty.');
      return;
    }
    try {
      const waLink = buildWhatsAppLink(guest.whatsappNumber, message);
      window.open(waLink, '_blank', 'noopener,noreferrer');
    } catch {
      setError('This guest has no usable WhatsApp number.');
    }
  }

  async function toggleTick() {
    if (!csrfToken) return;
    const nextCompleted = !isCompleted(kind.eventName);
    setTogglingKind(kind.key);

    try {
      const res = await fetch('/api/admin/messages/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ guestId: guest.id, eventName: kind.eventName, isCompleted: nextCompleted }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast({ kind: 'error', text: data.message || 'Could not update.' });
        return;
      }
      setEvents((current) => {
        const rest = current.filter((entry) => entry.eventName !== kind.eventName);
        return [...rest, { eventName: kind.eventName, isCompleted: nextCompleted }];
      });
    } catch {
      showToast({ kind: 'error', text: 'Could not reach the server.' });
    } finally {
      setTogglingKind(null);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-message-title"
        className="bg-white rounded-xl border border-slate-200 p-5 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="guest-message-title" className="font-semibold mb-1">
          Message {guest.name}
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          {guest.code} &middot; {guest.whatsappNumber ?? 'no number on file'}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4" role="tablist" aria-label="Message kind">
          {kinds.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={entry.key === kindKey}
              onClick={() => selectKind(entry.key)}
              className={
                'px-3 py-2 rounded-lg border text-sm font-medium text-left flex items-center justify-between gap-2 ' +
                (entry.key === kindKey
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 hover:bg-slate-50')
              }
            >
              <span>{entry.label}</span>
              {isCompleted(entry.eventName) && (
                <span
                  className={entry.key === kindKey ? 'text-emerald-300' : 'text-emerald-600'}
                  title="Already ticked as sent"
                  aria-label="Already ticked as sent"
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>

        <label htmlFor="guest-message" className="block text-xs font-semibold text-slate-500 mb-1">
          Message
        </label>
        <textarea
          ref={textareaRef}
          id="guest-message"
          rows={5}
          value={message}
          onChange={(e) => {
            setDraft(e.target.value);
            setError('');
          }}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <div className="mt-1 flex justify-between items-center">
          <button
            type="button"
            onClick={resetToTemplate}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Reset to template
          </button>
          <span className="text-xs text-slate-400">
            {loadingContext ? 'Loading…' : `${message.length} characters`}
          </span>
        </div>

        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isCompleted(kind.eventName)}
            onChange={toggleTick}
            disabled={togglingKind === kind.key || !csrfToken}
            className="rounded border-slate-300"
          />
          Mark &quot;{kind.label}&quot; as sent
        </label>

        <p className="mt-3 text-xs text-slate-500">
          Opening WhatsApp does not tick this by itself — nothing is sent until you press Send
          inside WhatsApp, and delivery is not tracked. Tick it yourself once it&apos;s done.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleOpen}
            disabled={!guest.whatsappNumber}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            Open in WhatsApp
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
