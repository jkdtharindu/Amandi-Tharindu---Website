import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FONT_FAMILY_OPTIONS,
  FONT_STYLE_OPTIONS,
  validateThemeInput,
} from '../src/admin/themeValidation.js';

const VALID_INPUT = {
  primaryColor: '#B8860B',
  secondaryColor: '#FFF8DC',
  accentColor: '#8B0000',
  fontFamily: 'Cormorant Garamond',
  fontStyle: 'italic',
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
    fontFamily: 'Comic Sans',
    fontStyle: 'oblique',
  });

  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    'accentColor',
    'fontFamily',
    'fontStyle',
    'primaryColor',
    'secondaryColor',
  ]);
});

test('exposes the curated font options', () => {
  assert.deepEqual([...FONT_FAMILY_OPTIONS], [
    'Default',
    'Cormorant Garamond',
    'Playfair Display',
    'EB Garamond',
  ]);
  assert.deepEqual([...FONT_STYLE_OPTIONS], ['italic', 'normal']);
});
