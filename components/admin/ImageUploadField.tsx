'use client';

import { useRef, useState } from 'react';

// Mirrors src/storage/blobStorage.js's limits (kept as plain constants here,
// not imported, so this client component never bundles server-only code).
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export default function ImageUploadField({
  imageUrl,
  onChange,
  csrfToken,
  label = 'Photo',
}: {
  imageUrl: string;
  onChange: (url: string) => void;
  csrfToken: string;
  label?: string;
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
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onChange(data.url);
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
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      {imageUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote,
              admin-supplied URL; see components/public/CustomSections.tsx for
              why next/image is skipped project-wide for uploaded photos. */}
          <img src={imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover border border-slate-300" />
          <button
            type="button"
            disabled={busy}
            onClick={() => onChange('')}
            className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="w-full text-sm"
        />
      )}
      {busy && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
