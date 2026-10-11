import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeSectionTint,
  normaliseGlassStrength,
  buildSectionGlassVars,
} from '../src/theme/sectionTint.js';
import { mergeThemeUpdate } from '../src/theme/mergeThemeUpdate.js';
import { validateThemeInput } from '../src/theme/basicThemeValidation.js';
import { mapRow } from '../src/theme/themeRepo.js';
import { themeSettings } from '../src/data/themeStore.js';

test('tint blends 40% hero colour with 60% accent', () => {
  // hero (0,200,100) + accent (100,200,0):
  // R = 0.4*0 + 0.6*100 = 60 (3C), G = 200 (C8), B = 0.4*100 + 0.6*0 = 40 (28)
  assert.equal(computeSectionTint('#00C864', '#64C800', '#FFFFFF'), '#3CC828');
});

test('tint falls back to accent, then hero, then secondary, then a neutral', () => {
  assert.equal(computeSectionTint('', '#B38E46', '#FBF5EE'), '#B38E46');
  assert.equal(computeSectionTint('#112233', '', '#FBF5EE'), '#112233');
  assert.equal(computeSectionTint('nope', 'nope', '#FBF5EE'), '#FBF5EE');
  assert.equal(computeSectionTint('', '', ''), '#B8A99A');
});

test('strength is clamped to a whole number 0-100 and junk gets the default', () => {
  assert.equal(normaliseGlassStrength(150), 100);
  assert.equal(normaliseGlassStrength(-5), 0);
  assert.equal(normaliseGlassStrength('40'), 40);
  assert.equal(normaliseGlassStrength('abc'), 60);
  assert.equal(normaliseGlassStrength(undefined), 60);
});

test('layout vars: on by default, off only when explicitly false', () => {
  assert.equal(buildSectionGlassVars({ accentColor: '#B38E46' }).enabled, true);
  assert.equal(buildSectionGlassVars({ sectionGlassEnabled: false }).enabled, false);
  const { vars } = buildSectionGlassVars({ accentColor: '#B38E46', sectionGlassStrength: 80 });
  assert.equal(vars['--glass-strength'], '80');
  assert.equal(vars['--section-tint'], '#B38E46');
});

test('mapRow defaults to on / 60 for a row from before migration 026', () => {
  const mapped = mapRow({ id: 'x', primary_color: '#000000' });
  assert.equal(mapped.sectionGlassEnabled, true);
  assert.equal(mapped.sectionGlassStrength, 60);
  const off = mapRow({ id: 'x', section_glass_enabled: false, section_glass_strength: 25 });
  assert.equal(off.sectionGlassEnabled, false);
  assert.equal(off.sectionGlassStrength, 25);
});

test('mergeThemeUpdate accepts the switch and a valid strength', () => {
  const { settings, errors } = mergeThemeUpdate(themeSettings, {
    sectionGlassEnabled: false,
    sectionGlassStrength: 35,
  });
  assert.deepEqual(errors, []);
  assert.equal(settings.sectionGlassEnabled, false);
  assert.equal(settings.sectionGlassStrength, 35);
});

test('mergeThemeUpdate rejects a strength outside 0-100 or not whole', () => {
  for (const bad of [101, -1, 12.5, 'abc']) {
    const { errors } = mergeThemeUpdate(themeSettings, { sectionGlassStrength: bad });
    assert.equal(errors.length, 1, String(bad));
    assert.equal(errors[0].reason, 'invalid_glass_strength');
  }
});

const validInput = {
  primaryColor: '#672942',
  secondaryColor: '#FBF5EE',
  accentColor: '#B38E46',
  baseTextColor: '#2C1D1D',
  invertedTextColor: '#FFFFFF',
  surfaceColor: '#FDFBF8',
  fontFamily: 'Cormorant Garamond',
  fontStyle: 'italic',
  weddingDate: '2026-12-14',
  weddingTime: '15:00',
};

test('form validation passes the glass fields through and rejects a bad strength', () => {
  const ok = validateThemeInput({ ...validInput, sectionGlassEnabled: false, sectionGlassStrength: 20 });
  assert.equal(ok.valid, true, JSON.stringify(ok.errors));
  assert.equal(ok.value.sectionGlassEnabled, false);
  assert.equal(ok.value.sectionGlassStrength, 20);

  const missing = validateThemeInput(validInput);
  assert.equal(missing.valid, true);
  assert.equal(missing.value.sectionGlassEnabled, true);
  assert.equal(missing.value.sectionGlassStrength, 60);

  const bad = validateThemeInput({ ...validInput, sectionGlassStrength: 500 });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.sectionGlassStrength);
});
