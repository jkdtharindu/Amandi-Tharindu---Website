import test from 'node:test';
import assert from 'node:assert/strict';

import { computeOverlayFromColor, DEFAULT_HERO_OVERLAY } from '../src/theme/heroOverlay.js';

test('computeOverlayFromColor falls back to the pre-Action-65 default for an empty color', () => {
  assert.equal(computeOverlayFromColor(''), DEFAULT_HERO_OVERLAY);
  assert.equal(computeOverlayFromColor(undefined), DEFAULT_HERO_OVERLAY);
  assert.equal(computeOverlayFromColor(null), DEFAULT_HERO_OVERLAY);
});

test('computeOverlayFromColor falls back to the default for a malformed color', () => {
  assert.equal(computeOverlayFromColor('not-a-color'), DEFAULT_HERO_OVERLAY);
  assert.equal(computeOverlayFromColor('#fff'), DEFAULT_HERO_OVERLAY);
  assert.equal(computeOverlayFromColor('rgb(0,0,0)'), DEFAULT_HERO_OVERLAY);
});

test('computeOverlayFromColor gives a light photo a darker overlay than a dark photo', () => {
  const lightOverlay = computeOverlayFromColor('#ffffff');
  const darkOverlay = computeOverlayFromColor('#000000');

  const opacityOf = (rgba) => Number(rgba.match(/[\d.]+\)$/)[0].slice(0, -1));
  assert.ok(
    opacityOf(lightOverlay) > opacityOf(darkOverlay),
    `expected white's overlay (${lightOverlay}) to be more opaque than black's (${darkOverlay})`
  );
});

test('computeOverlayFromColor stays within a readable, photo-visible range', () => {
  const opacityOf = (rgba) => Number(rgba.match(/[\d.]+\)$/)[0].slice(0, -1));
  for (const color of ['#000000', '#7c2d40', '#a6813c', '#ffffff']) {
    const opacity = opacityOf(computeOverlayFromColor(color));
    assert.ok(opacity >= 0.2 && opacity <= 0.65, `${color} produced an out-of-range opacity ${opacity}`);
  }
});

test('computeOverlayFromColor is case-insensitive', () => {
  assert.equal(computeOverlayFromColor('#ABCDEF'), computeOverlayFromColor('#abcdef'));
});

// Action 85: the owner can switch the hero photo's dark layer off.
test('heroOverlayValue is transparent when the switch is off', async () => {
  const { heroOverlayValue } = await import('../src/theme/heroOverlay.js');
  assert.equal(heroOverlayValue('#a68b5c', false), 'transparent');
});

test('heroOverlayValue keeps the adaptive overlay when the switch is on or missing', async () => {
  const { heroOverlayValue, computeOverlayFromColor } = await import('../src/theme/heroOverlay.js');
  assert.equal(heroOverlayValue('#a68b5c', true), computeOverlayFromColor('#a68b5c'));
  assert.equal(heroOverlayValue('#a68b5c', undefined), computeOverlayFromColor('#a68b5c'));
});

// Action 87: the strength slider scales the dark layer.
test('heroOverlayValue at strength 100 keeps the full adaptive overlay', async () => {
  const { heroOverlayValue, computeOverlayFromColor } = await import('../src/theme/heroOverlay.js');
  assert.equal(heroOverlayValue('#a68b5c', true, 100), computeOverlayFromColor('#a68b5c'));
});

test('heroOverlayValue halves the opacity at strength 50 and is clear at 0', async () => {
  const { heroOverlayValue, computeOverlayOpacity } = await import('../src/theme/heroOverlay.js');
  const full = computeOverlayOpacity('#a68b5c');
  assert.equal(heroOverlayValue('#a68b5c', true, 50), `rgba(0, 0, 0, ${Math.round(full * 50) / 100})`);
  assert.equal(heroOverlayValue('#a68b5c', true, 0), 'rgba(0, 0, 0, 0)');
});

test('normaliseOverlayStrength clamps and defaults to 100', async () => {
  const { normaliseOverlayStrength } = await import('../src/theme/heroOverlay.js');
  assert.equal(normaliseOverlayStrength(undefined), 100);
  assert.equal(normaliseOverlayStrength(''), 100);
  assert.equal(normaliseOverlayStrength(-20), 0);
  assert.equal(normaliseOverlayStrength(250), 100);
  assert.equal(normaliseOverlayStrength('40'), 40);
});
