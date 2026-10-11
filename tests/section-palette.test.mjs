import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import { extractPalette } from '../src/theme/paletteExtract.js';
import {
  buildSectionColors,
  contrastRatio,
  parsePalette,
  serialisePalette,
  isValidPaletteString,
  mixHex,
} from '../src/theme/sectionPalette.js';
import { buildSectionGlassVars } from '../src/theme/sectionTint.js';
import { mergeThemeUpdate } from '../src/theme/mergeThemeUpdate.js';
import { validateThemeInput } from '../src/theme/basicThemeValidation.js';
import { mapRow } from '../src/theme/themeRepo.js';
import { themeSettings } from '../src/data/themeStore.js';

/** A real image: left third wine, middle third gold, right third near-black shadow. */
async function threeToneImage() {
  const w = 90;
  const h = 30;
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = x < 30 ? [103, 41, 66] : x < 60 ? [179, 142, 70] : [10, 8, 8];
      const i = (y * w + x) * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

const near = (a, b, tolerance = 12) =>
  [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= tolerance);

test('extractPalette finds the real colours and skips near-black shadow', async () => {
  const palette = await extractPalette(await threeToneImage());
  assert.ok(palette.some((c) => near(c, '#672942')), `wine missing in ${palette}`);
  assert.ok(palette.some((c) => near(c, '#B38E46')), `gold missing in ${palette}`);
  assert.ok(!palette.some((c) => near(c, '#0A0808', 20)), `shadow kept in ${palette}`);
  assert.ok(palette.length <= 5);
});

test('extractPalette throws on something that is not an image', async () => {
  await assert.rejects(() => extractPalette(Buffer.from('not an image')));
});

test('palette strings: parse, serialise and validate', () => {
  assert.deepEqual(parsePalette('#aabbcc, nope ,#112233'), ['#AABBCC', '#112233']);
  assert.equal(serialisePalette(['#aabbcc', '#112233']), '#AABBCC,#112233');
  assert.equal(isValidPaletteString(''), true);
  assert.equal(isValidPaletteString('#AABBCC,#112233'), true);
  assert.equal(isValidPaletteString('red'), false);
  assert.equal(isValidPaletteString('#111111,#222222,#333333,#444444,#555555,#666666,#777777'), false);
});

test('every wash is readable under Base text, even for dark swatches and at full strength', () => {
  const settings = {
    heroPalette: '#672942,#3A2418,#B38E46,#000000,#8F6B25',
    surfaceColor: '#FDFBF8',
    baseTextColor: '#2C1D1D',
  };
  for (const sectionGlassStrength of [0, 60, 100]) {
    const washes = buildSectionColors({ ...settings, sectionGlassStrength });
    assert.equal(washes.length, 5);
    for (const wash of washes) {
      assert.ok(contrastRatio(wash, '#2C1D1D') >= 8, `${wash} at strength ${sectionGlassStrength}`);
    }
  }
});

test('higher strength gives a more coloured wash', () => {
  const base = { heroPalette: '#B38E46', surfaceColor: '#FFFFFF', baseTextColor: '#2C1D1D' };
  const soft = buildSectionColors({ ...base, sectionGlassStrength: 10 })[0];
  const strong = buildSectionColors({ ...base, sectionGlassStrength: 70 })[0];
  const distanceFromSurface = (hex) => 255 * 3 - [1, 3, 5].reduce((n, i) => n + parseInt(hex.slice(i, i + 2), 16), 0);
  assert.ok(distanceFromSurface(strong) > distanceFromSurface(soft));
});

test('with no palette the washes come from the theme colours; with nothing, a neutral', () => {
  const fromTheme = buildSectionColors({ accentColor: '#B38E46', surfaceColor: '#FFFFFF', baseTextColor: '#2C1D1D' });
  assert.equal(fromTheme.length, 5);
  assert.ok(fromTheme.every((c) => /^#[0-9A-F]{6}$/.test(c)));
  const nothing = buildSectionColors({});
  assert.equal(nothing.length, 5);
});

test('mixHex blends by share', () => {
  assert.equal(mixHex('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(mixHex('#FF0000', '#FFFFFF', 1), '#FF0000');
});

test('layout vars carry five section colours', () => {
  const { enabled, vars } = buildSectionGlassVars({
    heroPalette: '#672942,#B38E46',
    accentColor: '#B38E46',
    surfaceColor: '#FDFBF8',
    baseTextColor: '#2C1D1D',
  });
  assert.equal(enabled, true);
  for (let i = 1; i <= 5; i++) assert.match(vars[`--section-c${i}`], /^#[0-9A-F]{6}$/);
});

test('heroPalette: repo default, merge rules and form validation', () => {
  assert.equal(mapRow({ id: 'x' }).heroPalette, '');
  assert.equal(mapRow({ id: 'x', hero_palette: '#AABBCC' }).heroPalette, '#AABBCC');

  const ok = mergeThemeUpdate(themeSettings, { heroPalette: '#aabbcc,#112233' });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.settings.heroPalette, '#AABBCC,#112233');

  const cleared = mergeThemeUpdate({ ...themeSettings, heroPalette: '#AABBCC' }, { heroPalette: '' });
  assert.equal(cleared.settings.heroPalette, '');

  const bad = mergeThemeUpdate(themeSettings, { heroPalette: 'red,blue' });
  assert.equal(bad.errors[0].reason, 'invalid_palette_list');

  const base = {
    primaryColor: '#672942', secondaryColor: '#FBF5EE', accentColor: '#B38E46',
    baseTextColor: '#2C1D1D', invertedTextColor: '#FFFFFF', surfaceColor: '#FDFBF8',
    fontFamily: 'Cormorant Garamond', fontStyle: 'italic', weddingDate: '2026-12-14', weddingTime: '15:00',
  };
  const valid = validateThemeInput({ ...base, heroPalette: '#aabbcc' });
  assert.equal(valid.valid, true);
  assert.equal(valid.value.heroPalette, '#AABBCC');
  assert.equal(validateThemeInput({ ...base, heroPalette: 'nope' }).valid, false);
});
