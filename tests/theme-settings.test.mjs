import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeThemeUpdate } from '../src/theme/mergeThemeUpdate.js';
import { themeSettings } from '../src/data/themeStore.js';

test('mergeThemeUpdate applies allowed fields and trims strings', () => {
  const { settings, errors } = mergeThemeUpdate(themeSettings, { heroImageUrl: '  https://example.com/hero.jpg  ' });
  assert.deepEqual(errors, []);
  assert.equal(settings.heroImageUrl, 'https://example.com/hero.jpg');
});

test('mergeThemeUpdate ignores unknown fields', () => {
  const { settings, errors } = mergeThemeUpdate(themeSettings, { notARealField: 'x' });
  assert.deepEqual(errors, []);
  assert.equal(settings.notARealField, undefined);
});

test('mergeThemeUpdate rejects an invalid hex color', () => {
  const { errors } = mergeThemeUpdate(themeSettings, { primaryColor: 'not-a-color' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'primaryColor');
  assert.equal(errors[0].reason, 'invalid_hex_color');
});

test('mergeThemeUpdate accepts a valid hex color', () => {
  const { settings, errors } = mergeThemeUpdate(themeSettings, { primaryColor: '#123ABC' });
  assert.deepEqual(errors, []);
  assert.equal(settings.primaryColor, '#123ABC');
});

test('mergeThemeUpdate rejects an invalid wedding date', () => {
  const { errors } = mergeThemeUpdate(themeSettings, { weddingDate: '14-12-2026' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'weddingDate');
});

test('mergeThemeUpdate does not mutate the original settings object', () => {
  const original = { ...themeSettings };
  mergeThemeUpdate(themeSettings, { fontFamily: 'Playfair Display' });
  assert.deepEqual(themeSettings, original);
});
