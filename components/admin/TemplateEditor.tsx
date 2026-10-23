'use client';

import { useState } from 'react';
import { renderTemplate, buildSiteLink } from '@/src/admin/messageTemplates.js';
import { useToast } from '@/components/Toast';

const PLACEHOLDERS: { tag: string; meaning: string }[] = [
  { tag: '[Name]', meaning: "the guest's name" },
  { tag: '[Code]', meaning: 'their invitation code' },
  { tag: '[Link]', meaning: 'the website address' },
  { tag: '[Date]', meaning: 'the wedding date' },
  { tag: '[Venue]', meaning: 'the venue name' },
  { tag: '[TableNumber]', meaning: "each member's table, filled in once seated" },
  { tag: '[Greeting]', meaning: 'the sender (the bride or groom family)' },
];

/**
 * Edit and save the wording for one message level. The [Name], [Code],
 * [TableNumber] and similar tags are not filled here: they are filled per guest
 * from live data when a message is opened, so a table assigned later is always
 * reflected. The preview below uses made-up sample values only.
 */
export default function TemplateEditor({
  levelKey,
  levelLabel,
  savedBody,
  defaultBody,
  csrfToken,
  siteUrl,
  shareTag,
  weddingDate,
  venueName,
  onSaved,
}: {
  levelKey: string;
  shareTag?: string;
  levelLabel: string;
  savedBody: string;
  defaultBody: string;
  csrfToken: string;
  siteUrl: string;
  weddingDate: string;
  venueName: string;
  onSaved: (body: string) => void;
}) {
  const [draft, setDraft] = useState(savedBody);
  const [busy, setBusy] = useState(false);
  const showToast = useToast();

  const changed = draft.trim() !== savedBody.trim();

  async function save(body: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/message-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ levelKey, body }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast({ kind: 'error', text: data.message || 'Could not save the template.' });
        return;
      }
      setDraft(body);
      onSaved(body);
      showToast({ kind: 'ok', text: `Saved the ${levelLabel} template.` });
    } catch {
      showToast({ kind: 'error', text: 'Could not reach the server.' });
    } finally {
      setBusy(false);
    }
  }

  const preview = renderTemplate(draft, {
    name: 'Perera Family',
    code: 'PERERA-001',
    link: buildSiteLink(siteUrl, shareTag),
    date: weddingDate,
    venue: venueName,
    greeting: "The Bride's Family",
    tablenumber: 'Kamala – Rose\nNirmala – Lotus',
  });

  return (
    <details className="bg-white rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Edit the saved template for this level
      </summary>

      <p className="mt-3 text-xs text-slate-500">
        Write the message once and save it. The tags below are filled in for each guest
        automatically when you open their message, using their latest details.
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {PLACEHOLDERS.map((entry) => (
          <li key={entry.tag}>
            <code className="font-mono text-slate-700">{entry.tag}</code> {entry.meaning}
          </li>
        ))}
      </ul>

      <label htmlFor="template-body" className="mt-3 block text-xs font-semibold text-slate-500 mb-1">
        {levelLabel} template
      </label>
      <textarea
        id="template-body"
        rows={6}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
      />

      <p className="mt-3 text-xs font-semibold text-slate-500">Preview with sample details</p>
      <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {preview}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => save(draft)}
          disabled={busy || !csrfToken || !changed || !draft.trim()}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save template'}
        </button>
        <button
          type="button"
          onClick={() => save(defaultBody)}
          disabled={busy || !csrfToken}
          className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
        >
          Reset to default
        </button>
      </div>
    </details>
  );
}
