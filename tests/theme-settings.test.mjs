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

test('mergeThemeUpdate accepts a valid wedding time', () => {
  const { settings, errors } = mergeThemeUpdate(themeSettings, { weddingTime: '09:30' });
  assert.deepEqual(errors, []);
  assert.equal(settings.weddingTime, '09:30');
});

test('mergeThemeUpdate rejects a wedding time outside 24-hour HH:MM', () => {
  const { errors } = mergeThemeUpdate(themeSettings, { weddingTime: '3:00 PM' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'weddingTime');
  assert.equal(errors[0].reason, 'invalid_time');
});

test('mergeThemeUpdate does not mutate the original settings object', () => {
  const original = { ...themeSettings };
  mergeThemeUpdate(themeSettings, { fontFamily: 'Playfair Display' });
  assert.deepEqual(themeSettings, original);
});

test('mergeThemeUpdate cascades a ThemePalette selection to all three colours', () => {
  const { settings, errors } = mergeThemeUpdate(themeSettings, { paletteName: 'modern-royal-romance' });
  assert.deepEqual(errors, []);
  assert.equal(settings.paletteName, 'modern-royal-romance');
  assert.equal(settings.primaryColor, '#4A1525');
  assert.equal(settings.secondaryColor, '#FBF9F5');
  assert.equal(settings.accentColor, '#866D3D');
});

test('mergeThemeUpdate cascades a ThemePalette selection to baseTextColor, invertedTextColor, and surfaceColor', () => {
  const { settings, errors } = mergeThemeUpdate(themeSettings, { paletteName: 'terracotta' });
  assert.deepEqual(errors, []);
  assert.equal(settings.baseTextColor, '#2E1F17', "baseTextColor cascades from the palette's inkColor");
  assert.equal(settings.invertedTextColor, '#FFFFFF');
  assert.equal(settings.surfaceColor, '#FFFFFF');
});

test('mergeThemeUpdate accepts a valid hex value for each new text/surface field', () => {
  for (const field of ['baseTextColor', 'invertedTextColor', 'surfaceColor']) {
    const { settings, errors } = mergeThemeUpdate(themeSettings, { [field]: '#123ABC' });
    assert.deepEqual(errors, [], `${field} should accept a valid hex`);
    assert.equal(settings[field], '#123ABC');
  }
});

test('mergeThemeUpdate rejects an invalid hex value for each new text/surface field', () => {
  for (const field of ['baseTextColor', 'invertedTextColor', 'surfaceColor']) {
    const { errors } = mergeThemeUpdate(themeSettings, { [field]: 'not-a-color' });
    assert.equal(errors.length, 1, `${field} should reject a bad hex`);
    assert.equal(errors[0].field, field);
    assert.equal(errors[0].reason, 'invalid_hex_color');
  }
});

test('editing baseTextColor, invertedTextColor, or surfaceColor directly detaches from the curated palette', () => {
  for (const field of ['baseTextColor', 'invertedTextColor', 'surfaceColor']) {
    const withPalette = mergeThemeUpdate(themeSettings, { paletteName: 'chateau-green' }).settings;
    const { settings } = mergeThemeUpdate(withPalette, { [field]: '#654321' });
    assert.equal(settings.paletteName, '', `editing ${field} should mark the palette as custom`);
    assert.equal(settings[field], '#654321');
  }
});

test('mergeThemeUpdate rejects an unknown paletteName', () => {
  const { errors } = mergeThemeUpdate(themeSettings, { paletteName: 'not-a-palette' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'paletteName');
  assert.equal(errors[0].reason, 'invalid_palette');
});

test('mergeThemeUpdate clears paletteName back to custom with an empty value', () => {
  const withPalette = mergeThemeUpdate(themeSettings, { paletteName: 'terracotta' }).settings;
  const { settings } = mergeThemeUpdate(withPalette, { paletteName: '' });
  assert.equal(settings.paletteName, '');
  assert.equal(settings.primaryColor, '#9C4A21', 'clearing the palette should not revert already-cascaded colours');
});

test('mergeThemeUpdate cascades a FontChoice selection to fontFamily and fontStyle', () => {
  const { settings, errors } = mergeThemeUpdate(themeSettings, { fontChoice: 'playfair' });
  assert.deepEqual(errors, []);
  assert.equal(settings.fontChoice, 'playfair');
  assert.equal(settings.fontFamily, 'Playfair Display');
  assert.equal(settings.fontStyle, 'normal');
});

test('mergeThemeUpdate rejects an unknown fontChoice', () => {
  const { errors } = mergeThemeUpdate(themeSettings, { fontChoice: 'comic-sans' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'fontChoice');
  assert.equal(errors[0].reason, 'invalid_font_choice');
});

test('editing a colour directly detaches it from its curated palette', () => {
  const withPalette = mergeThemeUpdate(themeSettings, { paletteName: 'terracotta' }).settings;
  const { settings } = mergeThemeUpdate(withPalette, { primaryColor: '#123456' });
  assert.equal(settings.paletteName, '', 'a manual hex edit should mark the palette as custom');
  assert.equal(settings.primaryColor, '#123456');
});

test('editing a font directly detaches it from its curated font pairing', () => {
  const withFont = mergeThemeUpdate(themeSettings, { fontChoice: 'cinzel' }).settings;
  const { settings } = mergeThemeUpdate(withFont, { fontFamily: 'Georgia' });
  assert.equal(settings.fontChoice, '', 'a manual font edit should mark the pairing as custom');
  assert.equal(settings.fontFamily, 'Georgia');
});

test('mergeThemeUpdate applies bride/groom profile fields and trims strings', () => {
  const { settings, errors } = mergeThemeUpdate(themeSettings, {
    brideName: '  Amandi Wijesundara  ',
    bridePhotoUrl: '  https://example.com/bride.jpg  ',
    brideBio: '  Loves the ocean.  ',
    groomName: '  Tharindu Jayanetti  ',
    groomPhotoUrl: '  https://example.com/groom.jpg  ',
    groomBio: '  Loves the mountains.  ',
  });
  assert.deepEqual(errors, []);
  assert.equal(settings.brideName, 'Amandi Wijesundara');
  assert.equal(settings.bridePhotoUrl, 'https://example.com/bride.jpg');
  assert.equal(settings.brideBio, 'Loves the ocean.');
  assert.equal(settings.groomName, 'Tharindu Jayanetti');
  assert.equal(settings.groomPhotoUrl, 'https://example.com/groom.jpg');
  assert.equal(settings.groomBio, 'Loves the mountains.');
});
