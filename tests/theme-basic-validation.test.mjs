import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FONT_FAMILY_OPTIONS,
  FONT_STYLE_OPTIONS,
  validateThemeInput,
} from '../src/theme/basicThemeValidation.js';

const VALID_INPUT = {
  primaryColor: '#B8860B',
  secondaryColor: '#FFF8DC',
  accentColor: '#8B0000',
  baseTextColor: '#2B2118',
  invertedTextColor: '#FFFFFF',
  surfaceColor: '#FFFFFF',
  fontFamily: 'Cormorant Garamond',
  fontStyle: 'italic',
  weddingDate: '2026-12-14',
  weddingTime: '15:00',
  heroImageUrl: '',
};

test('accepts valid theme input and returns normalised values', () => {
  const result = validateThemeInput({
    ...VALID_INPUT,
    primaryColor: '  #B8860B  ',
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.primaryColor, '#B8860B', 'color is trimmed');
  assert.deepEqual(result.value, VALID_INPUT);
});

test('rejects malformed hex colors', () => {
  for (const primaryColor of ['B8860B', '#B886', '#GGGGGG', '', null, 'gold']) {
    const result = validateThemeInput({ ...VALID_INPUT, primaryColor });
    assert.equal(result.valid, false, `should reject ${primaryColor}`);
    assert.ok(result.errors.primaryColor);
  }
});

test('rejects a font family outside the curated set', () => {
  const result = validateThemeInput({ ...VALID_INPUT, fontFamily: 'Comic Sans' });

  assert.equal(result.valid, false);
  assert.ok(result.errors.fontFamily);
});

test('rejects a font style outside italic/normal', () => {
  const result = validateThemeInput({ ...VALID_INPUT, fontStyle: 'oblique' });

  assert.equal(result.valid, false);
  assert.ok(result.errors.fontStyle);
});

test('reports every invalid field at once', () => {
  const result = validateThemeInput({
    primaryColor: 'nope',
    secondaryColor: 'nope',
    accentColor: 'nope',
    baseTextColor: 'nope',
    invertedTextColor: 'nope',
    surfaceColor: 'nope',
    fontFamily: 'Comic Sans',
    fontStyle: 'oblique',
    weddingDate: '14-12-2026',
    weddingTime: '3:00 PM',
  });

  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    'accentColor',
    'baseTextColor',
    'fontFamily',
    'fontStyle',
    'invertedTextColor',
    'primaryColor',
    'secondaryColor',
    'surfaceColor',
    'weddingDate',
    'weddingTime',
  ]);
});

test('rejects malformed hex colors for the text/surface fields', () => {
  for (const field of ['baseTextColor', 'invertedTextColor', 'surfaceColor']) {
    const result = validateThemeInput({ ...VALID_INPUT, [field]: 'not-a-hex' });
    assert.equal(result.valid, false, `should reject ${field}`);
    assert.ok(result.errors[field]);
  }
});

test('accepts valid hex values for the text/surface fields', () => {
  const result = validateThemeInput({
    ...VALID_INPUT,
    baseTextColor: '#111111',
    invertedTextColor: '#EEEEEE',
    surfaceColor: '#F5F5F5',
  });
  assert.equal(result.valid, true);
  assert.equal(result.value.baseTextColor, '#111111');
  assert.equal(result.value.invertedTextColor, '#EEEEEE');
  assert.equal(result.value.surfaceColor, '#F5F5F5');
});

test('rejects a malformed wedding date', () => {
  for (const weddingDate of ['14-12-2026', '2026/12/14', '', 'not-a-date']) {
    const result = validateThemeInput({ ...VALID_INPUT, weddingDate });
    assert.equal(result.valid, false, `should reject ${weddingDate}`);
    assert.ok(result.errors.weddingDate);
  }
});

test('rejects a wedding time outside 24-hour HH:MM', () => {
  for (const weddingTime of ['3:00 PM', '25:00', '15:60', '', '3pm']) {
    const result = validateThemeInput({ ...VALID_INPUT, weddingTime });
    assert.equal(result.valid, false, `should reject ${weddingTime}`);
    assert.ok(result.errors.weddingTime);
  }
});

test('accepts a valid 24-hour wedding time', () => {
  const result = validateThemeInput({ ...VALID_INPUT, weddingTime: '09:05' });
  assert.equal(result.valid, true);
  assert.equal(result.value.weddingTime, '09:05');
});

test('accepts an empty hero image (clears it) and trims a set one', () => {
  const cleared = validateThemeInput({ ...VALID_INPUT, heroImageUrl: '' });
  assert.equal(cleared.valid, true);
  assert.equal(cleared.value.heroImageUrl, '');

  const set = validateThemeInput({
    ...VALID_INPUT,
    heroImageUrl: '  https://example.com/hero.jpg  ',
  });
  assert.equal(set.valid, true);
  assert.equal(set.value.heroImageUrl, 'https://example.com/hero.jpg');
});

test('exposes the curated font options', () => {
  assert.deepEqual([...FONT_FAMILY_OPTIONS], [
    'Default',
    'Cormorant Garamond',
    'Playfair Display',
    'Cinzel',
  ]);
  assert.deepEqual([...FONT_STYLE_OPTIONS], ['italic', 'normal']);
});
