import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseCouplePhoto,
  serialiseCouplePhoto,
  fadeMask,
  DEFAULT_COUPLE_PHOTO,
} from '../src/theme/couplePhoto.js';

// Action 86: the couple photo adjuster.
test('missing or broken values fall back to the defaults', () => {
  assert.deepEqual(normaliseCouplePhoto(undefined), DEFAULT_COUPLE_PHOTO);
  assert.deepEqual(normaliseCouplePhoto('{not json'), DEFAULT_COUPLE_PHOTO);
  assert.deepEqual(normaliseCouplePhoto({}), DEFAULT_COUPLE_PHOTO);
});

test('numbers are clamped into range', () => {
  const v = normaliseCouplePhoto({ size: 9999, fade: -5, bride: { zoom: 10, x: 500, y: 'abc' } });
  assert.equal(v.size, 320);
  assert.equal(v.fade, 0);
  assert.equal(v.bride.zoom, 100);
  assert.equal(v.bride.x, 100);
  assert.equal(v.bride.y, DEFAULT_COUPLE_PHOTO.bride.y);
});

test('a JSON string from the database is understood and round-trips', () => {
  const saved = serialiseCouplePhoto({ size: 200, fade: 10, groom: { zoom: 150, x: 40, y: 30 } });
  const back = normaliseCouplePhoto(saved);
  assert.equal(back.size, 200);
  assert.deepEqual(back.groom, { zoom: 150, x: 40, y: 30 });
});

test('fadeMask is off at 0 and grows with the fade level', () => {
  assert.equal(fadeMask(0), undefined);
  assert.match(fadeMask(30), /#000 10\.5%/);
  assert.match(fadeMask(100), /#000 35%/);
});
