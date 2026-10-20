'use client';

import { useEffect, useState } from 'react';
import ImageUploadField from './ImageUploadField';
import HeroBackgroundField from './HeroBackgroundField';
import ColorField from './ColorField';
import CouplePhotoAdjuster, { type CouplePhotoSettings } from './CouplePhotoAdjuster';
import { useToast } from '@/components/Toast';

export type ThemeSettings = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  baseTextColor: string;
  invertedTextColor: string;
  surfaceColor: string;
  fontFamily: string;
  fontStyle: string;
  weddingDate: string;
  weddingTime: string;
  heroImageUrl: string;
  heroDominantColor: string;
  heroPalette: string;
  heroOverlayEnabled: boolean;
  heroOverlayStrength: number;
  sectionGlassEnabled: boolean;
  sectionGlassStrength: number;
  brideName: string;
  bridePhotoUrl: string;
  brideBio: string;
  groomName: string;
  groomPhotoUrl: string;
  groomBio: string;
  couplePhoto: CouplePhotoSettings;
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
  const [busy, setBusy] = useState(false);
  const [paletteBusy, setPaletteBusy] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const showToast = useToast();

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.token))
      .catch(() => showToast({ kind: 'error', text: 'Could not reach the server.' }));
  }, [showToast]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFieldErrors({});

    try {
      const res = await fetch('/api/admin/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setForm(data.settings);
        showToast({ kind: 'ok', text: 'Theme updated. Changes are live site-wide.' });
        return;
      }

      if (data.errors) setFieldErrors(data.errors);
      showToast({ kind: 'error', text: data.message || 'Could not save theme settings.' });
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function readPalette() {
    setPaletteBusy(true);
    try {
      const res = await fetch('/api/admin/theme/palette', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setForm((current) => ({ ...current, heroPalette: (data.palette as string[]).join(',') }));
        showToast({ kind: 'ok', text: 'Colours read. Press Save to publish them.' });
      } else {
        showToast({ kind: 'error', text: data.message || 'Could not read colours from the photo.' });
      }
    } catch {
      showToast({ kind: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setPaletteBusy(false);
    }
  }

  const previewFontFamily =
    form.fontFamily === 'Default' ? 'inherit' : `'${form.fontFamily}', serif`;

  const previewDate = (() => {
    const parsed = new Date(`${form.weddingDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return form.weddingDate;
    return parsed.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  })();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5"
      >
        <h2 className="font-semibold mb-4">Colors</h2>
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <ColorField
            id="primaryColor"
            label="Primary"
            value={form.primaryColor}
            onChange={(value) => setForm({ ...form, primaryColor: value })}
            error={fieldErrors.primaryColor}
          />

          <ColorField
            id="secondaryColor"
            label="Secondary"
            value={form.secondaryColor}
            onChange={(value) => setForm({ ...form, secondaryColor: value })}
            error={fieldErrors.secondaryColor}
          />

          <ColorField
            id="accentColor"
            label="Accent"
            value={form.accentColor}
            onChange={(value) => setForm({ ...form, accentColor: value })}
            error={fieldErrors.accentColor}
          />
        </div>

        <h2 className="font-semibold mb-4">Text &amp; Surface Colours</h2>
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <ColorField
            id="baseTextColor"
            label="Base text"
            value={form.baseTextColor}
            onChange={(value) => setForm({ ...form, baseTextColor: value })}
            error={fieldErrors.baseTextColor}
          />

          <ColorField
            id="invertedTextColor"
            label="Inverted text"
            value={form.invertedTextColor}
            onChange={(value) => setForm({ ...form, invertedTextColor: value })}
            error={fieldErrors.invertedTextColor}
          />

          <ColorField
            id="surfaceColor"
            label="Surface"
            value={form.surfaceColor}
            onChange={(value) => setForm({ ...form, surfaceColor: value })}
            error={fieldErrors.surfaceColor}
          />
        </div>

        <h2 className="font-semibold mb-4">Section Tint &amp; Glass</h2>
        <div className="mb-6 space-y-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              id="sectionGlassEnabled"
              type="checkbox"
              checked={form.sectionGlassEnabled}
              onChange={(e) => setForm({ ...form, sectionGlassEnabled: e.target.checked })}
              className="mt-1 h-5 w-5"
            />
            <span>
              <span className="font-semibold">Tint and frosted glass on section panels</span>
              <span className="block text-xs text-slate-500">
                Gives the big homepage sections a soft tint taken from your hero photo and
                Accent colour, with a glassy shine.
              </span>
            </span>
          </label>
          <div>
            <p className="block text-xs font-semibold text-slate-500 mb-1">
              Colours read from the hero photo
            </p>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {form.heroPalette ? (
                form.heroPalette.split(',').map((color) => (
                  <span
                    key={color}
                    title={color}
                    className="h-8 w-8 rounded-full border border-slate-300"
                    style={{ backgroundColor: color }}
                  />
                ))
              ) : (
                <span className="text-xs text-slate-500">
                  None yet. Sections use your Accent colour until the photo&apos;s colours are read.
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={!form.heroImageUrl || paletteBusy}
              onClick={readPalette}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              {paletteBusy ? 'Reading…' : 'Read colours from my hero photo'}
            </button>
            <p className="mt-1 text-xs text-slate-500">
              Happens automatically when you upload a photo. Press Save afterwards to publish.
            </p>
          </div>
          <div>
            <label
              htmlFor="sectionGlassStrength"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              Tint strength: {form.sectionGlassStrength}
            </label>
            <input
              id="sectionGlassStrength"
              type="range"
              min={0}
              max={100}
              step={5}
              disabled={!form.sectionGlassEnabled}
              value={form.sectionGlassStrength}
              onChange={(e) =>
                setForm({ ...form, sectionGlassStrength: Number(e.target.value) })
              }
              className="w-full disabled:opacity-40"
            />
            <p className="text-xs text-slate-500">
              0 keeps the glass look with no tint. 100 is the strongest tint.
            </p>
            {fieldErrors.sectionGlassStrength && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.sectionGlassStrength}</p>
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

        <h2 className="font-semibold mb-4">Wedding Date &amp; Time</h2>
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <div>
            <label
              htmlFor="weddingDate"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              Wedding date
            </label>
            <input
              id="weddingDate"
              type="date"
              value={form.weddingDate}
              onChange={(e) => setForm({ ...form, weddingDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            />
            {fieldErrors.weddingDate && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.weddingDate}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="weddingTime"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              Ceremony time (Sri Lanka time)
            </label>
            <input
              id="weddingTime"
              type="time"
              value={form.weddingTime}
              onChange={(e) => setForm({ ...form, weddingTime: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            />
            {fieldErrors.weddingTime && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.weddingTime}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              The countdown on the home page always counts down to this moment in Sri Lanka
              (Asia/Colombo) time, no matter where a guest is viewing from.
            </p>
          </div>
        </div>

        <h2 className="font-semibold mb-4">Hero Photo</h2>
        <div className="mb-6">
          <HeroBackgroundField
            imageUrl={form.heroImageUrl}
            onChange={(url, dominantColor, palette) =>
              setForm({
                ...form,
                heroImageUrl: url,
                heroDominantColor: dominantColor,
                heroPalette: palette,
              })
            }
            csrfToken={csrfToken}
          />
          <p className="mt-1 text-xs text-slate-500">
            Shown behind the countdown on the home page. The dark overlay adjusts automatically to
            the photo&apos;s own color. Leave empty to use the default design.
          </p>
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input
              id="heroOverlayEnabled"
              type="checkbox"
              checked={form.heroOverlayEnabled}
              onChange={(e) => setForm({ ...form, heroOverlayEnabled: e.target.checked })}
              className="mt-1 h-5 w-5"
            />
            <span>
              <span className="font-semibold">Dark layer on the hero photo</span>
              <span className="block text-xs text-slate-500">
                Untick to show your photo exactly as uploaded. The white names and countdown can
                be hard to read on a bright photo without the dark layer.
              </span>
            </span>
          </label>
          {form.heroOverlayEnabled && (
            <div className="mt-3">
              <label htmlFor="heroOverlayStrength" className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>Dark layer strength</span>
                <span className="font-normal">{form.heroOverlayStrength}%</span>
              </label>
              <input
                id="heroOverlayStrength"
                type="range"
                min={0}
                max={100}
                value={form.heroOverlayStrength}
                onChange={(e) => setForm({ ...form, heroOverlayStrength: Number(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                100 is the full dark layer. Lower it to lighten the tint and let more of the photo show.
              </p>
            </div>
          )}
        </div>

        <h2 className="font-semibold mb-4">Bride &amp; Groom</h2>
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <div className="grid gap-3">
            <div>
              <label htmlFor="brideName" className="block text-xs font-semibold text-slate-500 mb-1">
                Bride&rsquo;s name
              </label>
              <input
                id="brideName"
                type="text"
                value={form.brideName}
                onChange={(e) => setForm({ ...form, brideName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
            <ImageUploadField
              label="Bride's photo"
              imageUrl={form.bridePhotoUrl}
              onChange={(url) => setForm({ ...form, bridePhotoUrl: url })}
              csrfToken={csrfToken}
            />
            <div>
              <label htmlFor="brideBio" className="block text-xs font-semibold text-slate-500 mb-1">
                Bride&rsquo;s short bio
              </label>
              <textarea
                id="brideBio"
                value={form.brideBio}
                onChange={(e) => setForm({ ...form, brideBio: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
          </div>

          <div className="grid gap-3">
            <div>
              <label htmlFor="groomName" className="block text-xs font-semibold text-slate-500 mb-1">
                Groom&rsquo;s name
              </label>
              <input
                id="groomName"
                type="text"
                value={form.groomName}
                onChange={(e) => setForm({ ...form, groomName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
            <ImageUploadField
              label="Groom's photo"
              imageUrl={form.groomPhotoUrl}
              onChange={(url) => setForm({ ...form, groomPhotoUrl: url })}
              csrfToken={csrfToken}
            />
            <div>
              <label htmlFor="groomBio" className="block text-xs font-semibold text-slate-500 mb-1">
                Groom&rsquo;s short bio
              </label>
              <textarea
                id="groomBio"
                value={form.groomBio}
                onChange={(e) => setForm({ ...form, groomBio: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
          </div>
          <p className="sm:col-span-2 -mt-2 text-xs text-slate-500">
            Leave a name empty to hide the Bride &amp; Groom section on the home page entirely.
          </p>
        </div>

        <CouplePhotoAdjuster
          value={form.couplePhoto}
          bridePhotoUrl={form.bridePhotoUrl}
          groomPhotoUrl={form.groomPhotoUrl}
          brideName={form.brideName}
          groomName={form.groomName}
          onChange={(couplePhoto) => setForm({ ...form, couplePhoto })}
        />

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
            {previewDate}
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
