import test from 'node:test';
import assert from 'node:assert/strict';

import { THEME_PALETTES, FONT_CHOICES, findPalette, findFontChoice } from '../src/theme/palettes.js';
import { contrastRatio, readableTextColor } from '../src/theme/colors.js';

test('every approved palette clears WCAG AA for ink-on-background', () => {
  for (const palette of THEME_PALETTES) {
    const ratio = contrastRatio(palette.inkColor, palette.secondaryColor);
    assert.ok(ratio >= 4.5, `${palette.name} ink/background ratio ${ratio.toFixed(2)} fails AA`);
  }
});

test('every approved palette clears WCAG AA for primary-button text', () => {
  for (const palette of THEME_PALETTES) {
    const buttonText = readableTextColor(palette.primaryColor);
    const ratio = contrastRatio(buttonText, palette.primaryColor);
    assert.ok(ratio >= 4.5, `${palette.name} button text ratio ${ratio.toFixed(2)} fails AA`);
  }
});

test('Modern Royal Romance accent clears WCAG AA as text, unlike its original gold', () => {
  const palette = findPalette('modern-royal-romance');
  const ratio = contrastRatio(palette.accentColor, palette.secondaryColor);
  assert.ok(ratio >= 4.5, `accent/background ratio ${ratio.toFixed(2)} fails AA`);

  const originalGold = contrastRatio('#C5A059', palette.secondaryColor);
  assert.ok(originalGold < 4.5, 'the original unfixed gold should still fail, proving the fix was necessary');
});

test('findPalette returns null for an unknown id', () => {
  assert.equal(findPalette('not-a-real-palette'), null);
});

test('findFontChoice returns a known font pairing', () => {
  const choice = findFontChoice('playfair');
  assert.equal(choice.displayFont, 'Playfair Display');
});

test('findFontChoice returns null for an unknown id', () => {
  assert.equal(findFontChoice('comic-sans'), null);
});

test('FONT_CHOICES has no duplicate ids', () => {
  const ids = FONT_CHOICES.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('THEME_PALETTES has no duplicate ids', () => {
  const ids = THEME_PALETTES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});
