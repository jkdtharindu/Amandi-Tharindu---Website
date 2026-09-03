'use client';

import { useEffect, useState } from 'react';

export type ThemeSettings = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  fontStyle: string;
};

/** Site-wide colors and typography (PRD P1-10). */
export default function ThemeEditor({
  initialSettings,
  fontFamilyOptions = ['Default', 'Cormorant Garamond', 'Playfair Display', 'EB Garamond'],
  fontStyleOptions = ['italic', 'normal'],
}: {
  initialSettings: ThemeSettings;
  fontFamilyOptions?: string[];
  fontStyleOptions?: string[];
}) {
  const [form, setForm] = useState<ThemeSettings>(initialSettings);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => setMessage({ kind: 'error', text: 'Could not reach the server.' }));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFieldErrors({});
    setMessage(null);

    try {
      const res = await fetch('/api/admin/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setForm(data.settings);
        setMessage({ kind: 'ok', text: 'Theme updated. Changes are live site-wide.' });
        return;
      }

      if (data.errors) setFieldErrors(data.errors);
      setMessage({ kind: 'error', text: data.message || 'Could not save theme settings.' });
    } catch {
      setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const previewFontFamily =
    form.fontFamily === 'Default' ? 'inherit' : `'${form.fontFamily}', serif`;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5"
      >
        {message && (
          <p
            role="status"
            className={
              'mb-4 text-sm rounded-lg p-3 border ' +
              (message.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200')
            }
          >
            {message.text}
          </p>
        )}

        <h2 className="font-semibold mb-4">Colors</h2>
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <div>
            <label
              htmlFor="primaryColor"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              Primary
            </label>
            <input
              id="primaryColor"
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              className="w-full h-10 rounded-lg border border-slate-300"
            />
            {fieldErrors.primaryColor && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.primaryColor}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="secondaryColor"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              Secondary
            </label>
            <input
              id="secondaryColor"
              type="color"
              value={form.secondaryColor}
              onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
              className="w-full h-10 rounded-lg border border-slate-300"
            />
            {fieldErrors.secondaryColor && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.secondaryColor}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="accentColor"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              Accent
            </label>
            <input
              id="accentColor"
              type="color"
              value={form.accentColor}
              onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
              className="w-full h-10 rounded-lg border border-slate-300"
            />
            {fieldErrors.accentColor && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.accentColor}</p>
            )}
          </div>
        </div>

        <h2 className="font-semibold mb-4">Typography</h2>
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <div>
            <label
              htmlFor="fontFamily"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              Font family
            </label>
            <select
              id="fontFamily"
              value={form.fontFamily}
              onChange={(e) => setForm({ ...form, fontFamily: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              {fontFamilyOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            {fieldErrors.fontFamily && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.fontFamily}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="fontStyle"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              Font style
            </label>
            <select
              id="fontStyle"
              value={form.fontStyle}
              onChange={(e) => setForm({ ...form, fontStyle: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              {fontStyleOptions.map((value) => (
                <option key={value} value={value}>
                  {value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
            {fieldErrors.fontStyle && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.fontStyle}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !csrfToken}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {/* Live preview — reflects the in-progress form, not yet saved */}
      <div
        className="bg-white rounded-xl border border-slate-200 p-5"
        style={{ backgroundColor: form.secondaryColor }}
      >
        <p className="text-xs font-semibold text-slate-500 mb-3">Preview</p>
        <div
          className="rounded-lg p-4"
          style={{
            fontFamily: previewFontFamily,
            fontStyle: form.fontStyle,
          }}
        >
          <h3 className="text-lg font-bold mb-2" style={{ color: form.primaryColor }}>
            Amandi &amp; Tharindu
          </h3>
          <p className="text-sm mb-3" style={{ color: form.primaryColor }}>
            Monday, 14 December 2026
          </p>
          <span
            className="inline-block px-3 py-1.5 rounded-full text-white text-sm font-semibold"
            style={{ backgroundColor: form.accentColor }}
          >
            RSVP now
          </span>
        </div>
      </div>
    </div>
  );
}
