import test from 'node:test';
import assert from 'node:assert/strict';
import { resizedHeroUrl } from '../src/theme/resizedHeroUrl.js';

const blob = 'https://abc123.public.blob.vercel-storage.com/hero/photo.jpg';

test('a Vercel Blob photo goes through the Next.js resizer at the asked width', () => {
  assert.equal(
    resizedHeroUrl(blob, 1080),
    `/_next/image?url=${encodeURIComponent(blob)}&w=1080&q=75`,
  );
});

test('a built-in preset (embedded data) is left unchanged', () => {
  const data = 'data:image/svg+xml;base64,AAAA';
  assert.equal(resizedHeroUrl(data, 1920), data);
});

test('a link to another website is left unchanged', () => {
  const other = 'https://example.com/photo.jpg';
  assert.equal(resizedHeroUrl(other, 1920), other);
});

test('a look-alike host is not treated as our storage', () => {
  const fake = 'https://evil.com/x.public.blob.vercel-storage.com/a.jpg';
  assert.equal(resizedHeroUrl(fake, 1920), fake);
});

test('an empty value stays empty', () => {
  assert.equal(resizedHeroUrl('', 1920), '');
});
