import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { buildSiteLink } from '../src/admin/messageTemplates.js';
import { MESSAGE_LEVELS, levelForShareTag } from '../src/messaging/messageLevels.js';
import { saveTemplateImage, listTemplates } from '../src/messaging/messageTemplatesRepo.js';
import { cropShareImage } from '../src/messaging/cropShareImage.js';
import { isGatedPath } from '../src/site-gate.js';

test('every message level has its own share tag and card wording', () => {
  const tags = MESSAGE_LEVELS.map((level) => level.shareTag);
  assert.equal(new Set(tags).size, MESSAGE_LEVELS.length);
  for (const level of MESSAGE_LEVELS) {
    assert.ok(level.shareCard.length > 10);
    assert.equal(levelForShareTag(level.shareTag), level);
  }
  assert.equal(levelForShareTag('nope'), undefined);
});

test('buildSiteLink adds the level tag only when given, and never a guest code', () => {
  assert.equal(buildSiteLink('https://example.com/'), 'https://example.com');
  assert.equal(buildSiteLink('https://example.com/', 'reminder'), 'https://example.com/s/reminder');
});

test('the share page path is readable without signing in, the rest of the site is not', () => {
  assert.equal(isGatedPath('/s/reminder'), false);
  assert.equal(isGatedPath('/'), true);
  assert.equal(isGatedPath('/invitation/ABC-123'), true);
});

test('saving and clearing a level photo works, and creates the row for the table level', async () => {
  const saved = await saveTemplateImage('table_update', 'https://blob.example/a.jpg', 'default body');
  assert.equal(saved.imageUrl, 'https://blob.example/a.jpg');
  const listed = (await listTemplates()).find((entry) => entry.name === 'table_update');
  assert.equal(listed.imageUrl, 'https://blob.example/a.jpg');

  const cleared = await saveTemplateImage('table_update', null, 'default body');
  assert.equal(cleared.imageUrl, null);
});

test('cropShareImage makes a 1200x630 JPEG from a tall photo', async () => {
  const tall = await sharp({ create: { width: 400, height: 900, channels: 3, background: '#a33' } })
    .png()
    .toBuffer();
  const out = await cropShareImage(tall);
  const meta = await sharp(out).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
});

test('the image prompt is filled from site details and differs per level', async () => {
  const { buildSharePhotoPrompt } = await import('../src/messaging/sharePhotoPrompt.js');
  const details = { coupleNames: 'Tharindu & Amandi', weddingDate: 'Monday, 14 December 2026', venueName: 'Grand Hall' };
  const prompts = MESSAGE_LEVELS.map((level) => buildSharePhotoPrompt(level.key, details));
  assert.equal(new Set(prompts).size, MESSAGE_LEVELS.length);
  for (const prompt of prompts) {
    assert.match(prompt, /1200x630/);
    assert.ok(prompt.includes('Tharindu & Amandi') && prompt.includes('14 December 2026') && prompt.includes('Grand Hall'));
  }
  const bare = buildSharePhotoPrompt('rsvp_reminder', {});
  assert.ok(!bare.includes('Small venue line') && !bare.includes('Date line'));
});
