'use client';

import { useRef, useState } from 'react';
import { useToast } from '@/components/Toast';

/**
 * The WhatsApp preview photo for one message level (PRD section 24). The photo is
 * shown as the big picture on the link card the message's link makes. It is
 * cropped to 1200x630 on upload, and the box below shows that same crop. Both
 * admins share it, and a level with no photo sends a plain card.
 */
export default function SharePhoto({
  levelKey,
  levelLabel,
  prompt,
  imageUrl,
  csrfToken,
  onChanged,
}: {
  levelKey: string;
  levelLabel: string;
  prompt: string;
  imageUrl: string | null;
  csrfToken: string;
  onChanged: (imageUrl: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const showToast = useToast();

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('levelKey', levelKey);
      form.append('file', file);
      const res = await fetch('/api/admin/message-templates/image', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast({ kind: 'error', text: data.message || 'Could not save the photo.' });
        return;
      }
      onChanged(data.imageUrl);
      showToast({ kind: 'ok', text: `Saved the ${levelLabel} preview photo.` });
    } catch {
      showToast({ kind: 'error', text: 'Could not reach the server.' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      showToast({ kind: 'ok', text: 'Prompt copied. Paste it into your AI image tool.' });
    } catch {
      showToast({ kind: 'error', text: 'Could not copy. Select the prompt and copy it by hand.' });
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/message-templates/image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ levelKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast({ kind: 'error', text: data.message || 'Could not remove the photo.' });
        return;
      }
      onChanged(null);
      showToast({ kind: 'ok', text: `Removed the ${levelLabel} preview photo.` });
    } catch {
      showToast({ kind: 'error', text: 'Could not reach the server.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="bg-white rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Preview photo for this level {imageUrl ? '(set)' : '(none)'}
      </summary>

      <p className="mt-3 text-xs text-slate-500">
        This photo shows as the big picture on the WhatsApp link card when a guest receives this
        level&apos;s message. A picture that is not the wide card shape is shown whole on a blurred
        copy of itself, so nothing is cut off. It is also shrunk to a small file size, because
        WhatsApp shows only a tiny thumbnail for heavy pictures. With no photo, the card is plain. Messages already sent keep their old card, and WhatsApp can take a while to show a
        changed photo.
      </p>

      <p className="mt-3 text-xs font-semibold text-slate-500">Image prompt for this level</p>
      <p className="mt-1 text-xs text-slate-500">
        Copy this into an AI image tool (ChatGPT, Gemini, etc.), then upload the picture it makes
        below. It uses the couple names, date and venue from the site.
      </p>
      <textarea
        readOnly
        rows={9}
        value={prompt}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-700"
      />
      <button
        type="button"
        onClick={() => void copyPrompt()}
        className="mt-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100"
      >
        Copy prompt
      </button>

      <div
        className="mt-3 w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        style={{ aspectRatio: '1200 / 630' }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={`${levelLabel} preview`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">No photo yet</div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || !csrfToken}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Working…' : imageUrl ? 'Replace photo' : 'Upload photo'}
        </button>
        {imageUrl && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy || !csrfToken}
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
          >
            Remove photo
          </button>
        )}
      </div>
    </details>
  );
}
