'use client';

import { useRef, useState } from 'react';
import { CURATED_BACKGROUNDS } from '@/src/theme/curatedBackgrounds.js';

// Mirrors src/storage/blobStorage.js's limits (kept as plain constants here,
// not imported, so this client component never bundles server-only code) —
// same pattern as ImageUploadField.tsx.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * The homepage hero background picker (PRD §18, TASKS.md Action 65): upload
 * a custom photo, or pick one of a small curated set. Either path also sets
 * `heroDominantColor`, which sizes the hero overlay's opacity server-side
 * (see src/theme/heroOverlay.js) — a curated preset already knows its own
 * color, an upload gets it computed by /api/admin/upload.
 */
export default function HeroBackgroundField({
  imageUrl,
  onChange,
  csrfToken,
}: {
  imageUrl: string;
  onChange: (url: string, dominantColor: string) => void;
  csrfToken: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError('');

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please choose a JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('That image is too large (max 5MB).');
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('computeDominantColor', '1');
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onChange(data.url, data.dominantColor || '');
      } else {
        setError(data.message || 'Upload failed. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">
        Home page hero background
      </label>

      {imageUrl ? (
        <div className="flex items-center gap-3 mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote/data-URI
              background, same reasoning as ImageUploadField.tsx. */}
          <img src={imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover border border-slate-300" />
          <button
            type="button"
            disabled={busy}
            onClick={() => onChange('', '')}
            className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500 mb-3">No background set — the default design is shown.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="w-full text-sm mb-3"
      />
      {busy && <p className="mb-3 text-xs text-slate-500">Uploading…</p>}
      {error && <p className="mb-3 text-xs text-red-700">{error}</p>}

      <p className="text-xs font-semibold text-slate-500 mb-2">Or pick a curated background</p>
      <div className="flex flex-wrap gap-2">
        {CURATED_BACKGROUNDS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.label}
            onClick={() => onChange(preset.dataUri, preset.dominantColor)}
            className={`h-14 w-14 rounded-lg border-2 bg-cover bg-center ${
              imageUrl === preset.dataUri ? 'border-slate-900' : 'border-slate-300'
            }`}
            style={{ backgroundImage: `url(${preset.dataUri})` }}
          />
        ))}
      </div>
    </div>
  );
}
