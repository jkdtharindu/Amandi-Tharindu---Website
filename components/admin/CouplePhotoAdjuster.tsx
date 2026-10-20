'use client';

import CouplePhoto, { type CouplePhotoPerson } from '../CouplePhoto';
import { COUPLE_PHOTO_LIMITS, DEFAULT_COUPLE_PHOTO } from '@/src/theme/couplePhoto.js';

export type CouplePhotoSettings = {
  size: number;
  fade: number;
  bride: CouplePhotoPerson;
  groom: CouplePhotoPerson;
};

function Slider({
  id,
  label,
  hint,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
        <span>{label}</span>
        <span className="font-normal">
          {value}
          {unit}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/**
 * Size, edge fade, zoom and position for the bride and groom portraits, with
 * a live preview that uses the same component as the home page (Action 86).
 */
export default function CouplePhotoAdjuster({
  value,
  bridePhotoUrl,
  groomPhotoUrl,
  brideName,
  groomName,
  onChange,
}: {
  value: CouplePhotoSettings;
  bridePhotoUrl: string;
  groomPhotoUrl: string;
  brideName: string;
  groomName: string;
  onChange: (next: CouplePhotoSettings) => void;
}) {
  const L = COUPLE_PHOTO_LIMITS;

  function setPerson(who: 'bride' | 'groom', patch: Partial<CouplePhotoPerson>) {
    onChange({ ...value, [who]: { ...value[who], ...patch } });
  }

  function personControls(who: 'bride' | 'groom', title: string, url: string, name: string) {
    const person = value[who];
    return (
      <div className="grid gap-3 content-start">
        <p className="text-xs font-semibold text-slate-500">{title}</p>
        {url ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 py-4 px-2">
            <CouplePhoto
              src={url}
              alt={name || title}
              size={value.size}
              fade={value.fade}
              person={person}
            />
          </div>
        ) : (
          <p className="text-xs text-slate-500">Upload a photo above to adjust it.</p>
        )}
        <Slider
          id={`${who}-zoom`}
          label="Zoom"
          value={person.zoom}
          min={L.zoom.min}
          max={L.zoom.max}
          unit="%"
          onChange={(zoom) => setPerson(who, { zoom })}
        />
        <Slider
          id={`${who}-x`}
          label="Move left / right"
          value={person.x}
          min={L.pos.min}
          max={L.pos.max}
          unit="%"
          onChange={(x) => setPerson(who, { x })}
        />
        <Slider
          id={`${who}-y`}
          label="Move up / down"
          value={person.y}
          min={L.pos.min}
          max={L.pos.max}
          unit="%"
          onChange={(y) => setPerson(who, { y })}
        />
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <h3 className="font-semibold text-sm mb-1">Photo size, fade &amp; position</h3>
      <p className="text-xs text-slate-500 mb-4">
        The previews below show how the photos look on the home page. Zoom in, then move the photo
        to centre the face. Press Save changes to publish.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <Slider
          id="couple-size"
          label="Photo size (both)"
          value={value.size}
          min={L.size.min}
          max={L.size.max}
          unit="px"
          onChange={(size) => onChange({ ...value, size })}
        />
        <Slider
          id="couple-fade"
          label="Edge fade (both)"
          hint="0 = sharp edges. Around 20–35 is a gentle fade."
          value={value.fade}
          min={L.fade.min}
          max={L.fade.max}
          unit=""
          onChange={(fade) => onChange({ ...value, fade })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {personControls('bride', 'Bride', bridePhotoUrl, brideName)}
        {personControls('groom', 'Groom', groomPhotoUrl, groomName)}
      </div>

      <button
        type="button"
        onClick={() =>
          onChange({
            ...DEFAULT_COUPLE_PHOTO,
            bride: { ...DEFAULT_COUPLE_PHOTO.bride },
            groom: { ...DEFAULT_COUPLE_PHOTO.groom },
          })
        }
        className="mt-4 text-xs font-semibold text-slate-600 underline"
      >
        Reset to default
      </button>
    </div>
  );
}
