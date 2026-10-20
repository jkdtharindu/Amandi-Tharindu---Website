// Couple photo adjuster (Action 86): how the bride and groom portraits are
// sized, framed and faded. Stored as one JSON object in
// theme_settings.couple_photo_adjust. Anything missing or out of range falls
// back to the default, so a half-saved or never-set value still renders.

export const COUPLE_PHOTO_LIMITS = {
  size: { min: 80, max: 320 }, // frame width in px
  fade: { min: 0, max: 100 }, // 0 = sharp edges
  zoom: { min: 100, max: 250 }, // % — 100 shows the whole cropped photo
  pos: { min: 0, max: 100 }, // % — which part of the photo is centred
};

const PERSON_DEFAULT = { zoom: 100, x: 50, y: 20 };

export const DEFAULT_COUPLE_PHOTO = {
  size: 150,
  fade: 30,
  bride: { ...PERSON_DEFAULT },
  groom: { ...PERSON_DEFAULT },
};

function clampNumber(value, { min, max }, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalisePerson(raw, fallback) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    zoom: clampNumber(p.zoom, COUPLE_PHOTO_LIMITS.zoom, fallback.zoom),
    x: clampNumber(p.x, COUPLE_PHOTO_LIMITS.pos, fallback.x),
    y: clampNumber(p.y, COUPLE_PHOTO_LIMITS.pos, fallback.y),
  };
}

/** Accepts an object or a JSON string (the database may return either). */
export function normaliseCouplePhoto(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  const v = value && typeof value === 'object' ? value : {};
  return {
    size: clampNumber(v.size, COUPLE_PHOTO_LIMITS.size, DEFAULT_COUPLE_PHOTO.size),
    fade: clampNumber(v.fade, COUPLE_PHOTO_LIMITS.fade, DEFAULT_COUPLE_PHOTO.fade),
    bride: normalisePerson(v.bride, DEFAULT_COUPLE_PHOTO.bride),
    groom: normalisePerson(v.groom, DEFAULT_COUPLE_PHOTO.groom),
  };
}

/** The JSON text saved in the database column. */
export function serialiseCouplePhoto(raw) {
  return JSON.stringify(normaliseCouplePhoto(raw));
}

/**
 * Edge fade as a CSS mask. fade 0 = no mask; fade 100 = the soft edge reaches
 * 35% of the way in from each side. Left-right and top-bottom gradients are
 * intersected so all four edges fade.
 */
export function fadeMask(fade) {
  const amount = clampNumber(fade, COUPLE_PHOTO_LIMITS.fade, DEFAULT_COUPLE_PHOTO.fade);
  if (amount <= 0) return undefined;
  const edge = Math.round(amount * 0.35 * 10) / 10;
  const far = 100 - edge;
  return (
    `linear-gradient(to right, transparent, #000 ${edge}%, #000 ${far}%, transparent), ` +
    `linear-gradient(to bottom, transparent, #000 ${edge}%, #000 ${far}%, transparent)`
  );
}
