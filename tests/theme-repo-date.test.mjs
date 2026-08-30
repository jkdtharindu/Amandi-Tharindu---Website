import test from 'node:test';
import assert from 'node:assert/strict';
import { toIsoDateString, mapRow } from '../src/theme/themeRepo.js';

// Regression test for the 2026-08-30 "NaN countdown" bug: node-postgres
// parses a `date` column into a JS Date built from LOCAL year/month/day
// components (postgres-date's getDate()), not UTC. Every consumer of
// weddingDate expects a plain 'YYYY-MM-DD' string, so mapRow must convert it
// back using the same local components it was built from -- using UTC
// getters (e.g. toISOString()) would shift the date backward on any server
// running east of UTC. This never surfaces via createApp() tests, which
// never load DATABASE_URL and so never take the Postgres path.

test('toIsoDateString converts a pg-style local Date back to the original calendar date', () => {
  // Constructed the same way postgres-date's getDate() builds it: new Date(year, month, day).
  const pgStyleDate = new Date(2026, 11, 14); // month is 0-indexed: December
  assert.equal(toIsoDateString(pgStyleDate), '2026-12-14');
});

test('toIsoDateString pads single-digit month and day', () => {
  const pgStyleDate = new Date(2026, 0, 5); // January 5th
  assert.equal(toIsoDateString(pgStyleDate), '2026-01-05');
});

test('toIsoDateString passes a plain string through unchanged (in-memory store shape)', () => {
  assert.equal(toIsoDateString('2026-12-14'), '2026-12-14');
});

test('mapRow normalizes wedding_date from a Postgres Date into the string every consumer expects', () => {
  const row = { id: 'theme-1', couple_names: 'Tharindu & Amandi', wedding_date: new Date(2026, 11, 14) };
  const settings = mapRow(row);
  assert.equal(settings.weddingDate, '2026-12-14');
});
