import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import { computeDominantColor } from '../src/storage/dominantColor.js';
import { CURATED_BACKGROUNDS, findCuratedBackground } from '../src/theme/curatedBackgrounds.js';
import { mergeThemeUpdate } from '../src/theme/mergeThemeUpdate.js';
import { validateThemeInput } from '../src/theme/basicThemeValidation.js';
import { themeSettings } from '../src/data/themeStore.js';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

async function solidColorPng(r, g, b) {
  return sharp({ create: { width: 20, height: 20, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();
}

test('computeDominantColor reads back a solid color image almost exactly', async () => {
  const buffer = await solidColorPng(124, 45, 64); // close to the site's own burgundy
  const color = await computeDominantColor(buffer);
  assert.match(color, HEX_COLOR);
  assert.equal(color, '#7c2d40');
});

test('computeDominantColor tells a light image from a dark one', async () => {
  const light = await computeDominantColor(await solidColorPng(230, 225, 210));
  const dark = await computeDominantColor(await solidColorPng(20, 15, 25));

  const brightnessOf = (hex) =>
    parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  assert.ok(brightnessOf(light) > brightnessOf(dark));
});

test('computeDominantColor rejects a non-image buffer instead of returning a wrong color', async () => {
  await assert.rejects(() => computeDominantColor(Buffer.from('not an image')));
});

test('every curated background has a valid id, label, data URI and dominant color', () => {
  assert.ok(CURATED_BACKGROUNDS.length > 0);
  const ids = new Set();
  for (const entry of CURATED_BACKGROUNDS) {
    assert.equal(typeof entry.id, 'string');
    assert.ok(!ids.has(entry.id), `duplicate curated background id ${entry.id}`);
    ids.add(entry.id);
    assert.match(entry.label, /placeholder/i, `${entry.id}'s label should say it's a placeholder`);
    assert.match(entry.dataUri, /^data:image\/svg\+xml,/);
    assert.match(entry.dominantColor, HEX_COLOR);
  }
});

test('findCuratedBackground finds an existing preset and returns null for an unknown id', () => {
  const first = CURATED_BACKGROUNDS[0];
  assert.deepEqual(findCuratedBackground(first.id), first);
  assert.equal(findCuratedBackground('does-not-exist'), null);
});

test('mergeThemeUpdate accepts a valid heroDominantColor', () => {
  const { settings, errors } = mergeThemeUpdate(themeSettings, { heroDominantColor: '#7C2D40' });
  assert.deepEqual(errors, []);
  assert.equal(settings.heroDominantColor, '#7C2D40');
});

test('mergeThemeUpdate rejects a malformed heroDominantColor the same way as other color fields', () => {
  const { errors } = mergeThemeUpdate(themeSettings, { heroDominantColor: 'burgundy' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'heroDominantColor');
  assert.equal(errors[0].reason, 'invalid_hex_color');
});

test('mergeThemeUpdate clears heroDominantColor along with heroImageUrl when both are emptied', () => {
  const withHero = mergeThemeUpdate(themeSettings, {
    heroImageUrl: 'https://example.com/hero.jpg',
    heroDominantColor: '#7c2d40',
  }).settings;
  const cleared = mergeThemeUpdate(withHero, { heroImageUrl: '', heroDominantColor: '' }).settings;
  assert.equal(cleared.heroImageUrl, '');
  assert.equal(cleared.heroDominantColor, '');
});

test('validateThemeInput passes heroDominantColor through untouched (format checked downstream)', () => {
  const base = {
    primaryColor: '#111111',
    secondaryColor: '#222222',
    accentColor: '#333333',
    baseTextColor: '#444444',
    invertedTextColor: '#555555',
    surfaceColor: '#666666',
    fontFamily: 'Cormorant Garamond',
    fontStyle: 'italic',
    weddingDate: '2026-12-14',
    weddingTime: '15:00',
  };
  const result = validateThemeInput({ ...base, heroDominantColor: ' #7c2d40 ' });
  assert.equal(result.valid, true);
  assert.equal(result.value.heroDominantColor, '#7c2d40');
});
