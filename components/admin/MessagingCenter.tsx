'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  renderTemplate,
  buildInvitationLink,
  buildWhatsAppLink,
} from '@/src/admin/messageTemplates.js';

export type MessageTemplate = {
  id: string;
  name: string;
  label: string;
  body: string;
  channel: string;
};

type Recipient = {
  id: string;
  code: string;
  name: string;
  relationship: string;
  rsvpStatus: string;
  whatsappNumber: string | null;
};

type Audience = {
  recipients: Recipient[];
  noNumberCount: number;
  alreadySentCount: number;
};

type LogEntry = {
  id: string;
  guestName: string;
  guestCode: string;
  templateLabel: string;
  sentAt: string | null;
  status: string;
};

const STATUSES = [
  { value: 'pending', label: 'Pending RSVP' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'all', label: 'Everyone' },
];

const EMPTY_AUDIENCE: Audience = { recipients: [], noNumberCount: 0, alreadySentCount: 0 };

function formatSentAt(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('en-GB');
}

/**
 * WhatsApp messaging center (PRD P1-06/P1-07).
 *
 * "Bulk send" with wa.me links is a worklist, not a broadcast: the admin picks
 * a template and an audience, then steps through recipients one at a time.
 * Each one opens WhatsApp with the message pre-filled and records a MessageLog
 * entry so the next run can skip whoever has already been handled.
 */
export default function MessagingCenter({
  templates,
  categories,
  siteUrl,
  weddingDate,
  venueName,
}: {
  templates: MessageTemplate[];
  categories: string[];
  siteUrl: string;
  weddingDate: string;
  venueName: string;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [status, setStatus] = useState('pending');
  const [relationship, setRelationship] = useState('all');
  const [skipSent, setSkipSent] = useState(true);

  const [audience, setAudience] = useState<Audience>(EMPTY_AUDIENCE);
  const [loading, setLoading] = useState(true);

  // null = not started; otherwise the index of the recipient being worked on.
  const [queueIndex, setQueueIndex] = useState<number | null>(null);
  // null = show the freshly rendered template; a string = the admin's edit.
  const [draft, setDraft] = useState<string | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [csrfToken, setCsrfToken] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Guards against an older in-flight audience request overwriting a newer one.
  const requestId = useRef(0);

  const template = templates.find((entry) => entry.id === templateId) ?? templates[0];

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/messages/log');
      const data = await res.json();
      if (data.success) setLogs(data.logs);
    } catch {
      // The log is supporting detail — a failure here must not block sending.
    }
  }, []);

  const loadAudience = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);

    const params = new URLSearchParams({
      status,
      relationship,
      templateId,
      skipSent: String(skipSent),
    });

    try {
      const res = await fetch('/api/admin/messages?' + params.toString());
      const data = await res.json();
      if (id !== requestId.current) return; // a newer request already answered
      if (data.success) {
        setAudience({
          recipients: data.recipients,
          noNumberCount: data.noNumberCount,
          alreadySentCount: data.alreadySentCount,
        });
      } else {
        setMessage({ kind: 'error', text: data.message || 'Could not load the audience.' });
      }
    } catch {
      if (id === requestId.current) {
        setMessage({ kind: 'error', text: 'Could not load the audience.' });
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [status, relationship, templateId, skipSent]);

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => setMessage({ kind: 'error', text: 'Could not reach the server.' }));

    const timer = setTimeout(loadLogs, 0);
    return () => clearTimeout(timer);
  }, [loadLogs]);

  useEffect(() => {
    const timer = setTimeout(loadAudience, 0);
    return () => clearTimeout(timer);
  }, [loadAudience]);

  /** Changing the template or audience invalidates a run in progress. */
  function resetRun() {
    setQueueIndex(null);
    setDraft(null);
  }

  const { recipients } = audience;
  const current = queueIndex === null ? null : recipients[queueIndex] ?? null;
  const finished = queueIndex !== null && queueIndex >= recipients.length;

  function renderFor(recipient: Recipient): string {
    return renderTemplate(template?.body ?? '', {
      name: recipient.name,
      code: recipient.code,
      link: buildInvitationLink(siteUrl, recipient.code),
      date: weddingDate,
      venue: venueName,
    });
  }

  const messageText = current ? draft ?? renderFor(current) : '';

  function advance() {
    setDraft(null);
    setQueueIndex((index) => (index === null ? null : index + 1));
  }

  async function handleOpenAndLog() {
    if (!current) return;

    if (!messageText.trim()) {
      setMessage({ kind: 'error', text: 'Message cannot be empty.' });
      return;
    }

    let waLink = '';
    try {
      waLink = buildWhatsAppLink(current.whatsappNumber, messageText);
    } catch {
      setMessage({ kind: 'error', text: `${current.name} has no usable WhatsApp number.` });
      return;
    }

    const opened = window.open(waLink, '_blank', 'noopener,noreferrer');
    if (!opened) {
      setMessage({
        kind: 'error',
        text: 'WhatsApp could not be opened (pop-up blocked). Nothing was logged.',
      });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/messages/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ guestId: current.id, templateId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({
          kind: 'error',
          text: data.message || 'WhatsApp opened, but the send could not be logged.',
        });
      }
      await loadLogs();
    } catch {
      setMessage({
        kind: 'error',
        text: 'WhatsApp opened, but the send could not be logged.',
      });
    } finally {
      setBusy(false);
      advance();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        {/* Template + audience */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label
                htmlFor="template"
                className="block text-xs font-semibold text-slate-500 mb-1"
              >
                Template
              </label>
              <select
                id="template"
                value={templateId}
                onChange={(e) => {
                  resetRun();
                  setTemplateId(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                {templates.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="audience-status"
                className="block text-xs font-semibold text-slate-500 mb-1"
              >
                Audience
              </label>
              <select
                id="audience-status"
                value={status}
                onChange={(e) => {
                  resetRun();
                  setStatus(e.target.value);
                }}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                {STATUSES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="audience-group"
                className="block text-xs font-semibold text-slate-500 mb-1"
              >
                Group
              </label>
              <select
                id="audience-group"
                value={relationship}
                onChange={(e) => {
                  resetRun();
                  setRelationship(e.target.value);
                }}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="all">All groups</option>
                {categories.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={skipSent}
              onChange={(e) => {
                resetRun();
                setSkipSent(e.target.checked);
              }}
              className="rounded border-slate-300"
            />
            Skip guests who already got this template
          </label>

          <p className="mt-3 text-sm text-slate-600" role="status">
            {loading ? (
              'Working out who is in this group…'
            ) : (
              <>
                <span className="font-semibold text-slate-900">
                  {recipients.length} recipient{recipients.length === 1 ? '' : 's'}
                </span>
                {audience.alreadySentCount > 0 && ` · ${audience.alreadySentCount} already sent`}
                {audience.noNumberCount > 0 &&
                  ` · ${audience.noNumberCount} skipped (no WhatsApp number)`}
              </>
            )}
          </p>

          {queueIndex === null && (
            <button
              type="button"
              onClick={() => setQueueIndex(0)}
              disabled={loading || recipients.length === 0 || !template}
              className="mt-3 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              Start sending
            </button>
          )}
        </div>

        {message && (
          <p
            role="status"
            className={
              'text-sm rounded-lg p-3 border ' +
              (message.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200')
            }
          >
            {message.text}
          </p>
        )}

        {/* Worklist */}
        {current && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="font-semibold">
                {current.name}{' '}
                <span className="font-mono text-xs text-slate-500">{current.code}</span>
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                {(queueIndex ?? 0) + 1} of {recipients.length}
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              {current.whatsappNumber} · {current.relationship} · {current.rsvpStatus}
            </p>

            <label
              htmlFor="bulk-message"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              Message
            </label>
            <textarea
              id="bulk-message"
              rows={6}
              value={messageText}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
            <div className="mt-1 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Reset to template
              </button>
              <span className="text-xs text-slate-400">{messageText.length} characters</span>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              This opens WhatsApp with the message filled in and records it in the log below.
              Nothing is sent until you press Send inside WhatsApp yourself — delivery is not
              tracked.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleOpenAndLog}
                disabled={busy || !csrfToken}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? 'Logging…' : 'Open in WhatsApp'}
              </button>
              <button
                type="button"
                onClick={advance}
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  setQueueIndex(null);
                  setDraft(null);
                }}
                className="ml-auto px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100"
              >
                Stop
              </button>
            </div>
          </div>
        )}

        {finished && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
            <p className="font-semibold mb-1">That is everyone in this group.</p>
            <p className="text-sm text-slate-500 mb-4">
              Refresh to pick up anyone still outstanding.
            </p>
            <button
              type="button"
              onClick={() => {
                setQueueIndex(null);
                loadAudience();
              }}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              Refresh audience
            </button>
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold mb-1">Recent messages</h2>
        <p className="text-xs text-slate-500 mb-3">
          Logged when WhatsApp is opened, not when the guest receives it.
        </p>

        {logs.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="py-2">
                <span className="font-medium">{log.guestName}</span>{' '}
                <span className="font-mono text-xs text-slate-500">{log.guestCode}</span>
                <div className="text-xs text-slate-500">
                  {log.templateLabel} · {formatSentAt(log.sentAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
