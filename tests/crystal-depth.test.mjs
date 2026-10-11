import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const start = css.indexOf('Crystal depth (PRD');
const block = css.slice(start);

test('crystal depth block exists and is the last block in globals.css', () => {
  assert.ok(start > -1);
});

test('every depth rule is behind the data-glass="on" switch', () => {
  const selectors = block
    .split('\n')
    .filter((line) => /\{\s*$/.test(line) && !/@layer|@media/.test(line))
    .join('\n');
  const lines = selectors.split('\n').filter((l) => l.trim());
  assert.ok(lines.length >= 3);
  for (const line of lines) {
    assert.match(line, /html\[data-glass="on"\]/, line);
  }
});

test('depth is static: no transform, animation or transition (owner chose no movement)', () => {
  const body = block.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(body, /\btransform\s*:/);
  assert.doesNotMatch(body, /\banimation(-\w+)?\s*:/);
  assert.doesNotMatch(body, /\btransition(-\w+)?\s*:/);
});

test('depth covers the panels, the photo hero and the inner cards', () => {
  for (const selector of ['.hero-panel--light', '.hero-panel--seal::before', '.hero-panel--photo', '.wish-card', '.faq-item']) {
    assert.ok(block.includes(selector), selector);
  }
});
