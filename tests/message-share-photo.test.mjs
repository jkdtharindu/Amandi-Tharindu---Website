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

test('cropShareImage keeps a busy picture under the WhatsApp size limit', async () => {
  const { SHARE_IMAGE_MAX_BYTES } = await import('../src/messaging/cropShareImage.js');
  const noise = Buffer.alloc(1800 * 1200 * 3);
  for (let i = 0; i < noise.length; i += 1) noise[i] = (i * 2654435761) >>> 24;
  const busy = await sharp(noise, { raw: { width: 1800, height: 1200, channels: 3 } }).png().toBuffer();
  const out = await cropShareImage(busy);
  assert.ok(out.length <= SHARE_IMAGE_MAX_BYTES, `size ${out.length}`);
  const meta = await sharp(out).metadata();
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
});

test('cropShareImage shows an off-shape picture whole instead of cutting it', async () => {
  // Left and right thirds are red and blue; a 3:2 picture must keep both visible.
  const left = { create: { width: 300, height: 600, channels: 3, background: '#ff0000' } };
  const right = { create: { width: 300, height: 600, channels: 3, background: '#0000ff' } };
  const mid = { create: { width: 300, height: 600, channels: 3, background: '#00ff00' } };
  const wide = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#000' } })
    .composite([
      { input: await sharp(left).png().toBuffer(), left: 0, top: 0 },
      { input: await sharp(mid).png().toBuffer(), left: 300, top: 0 },
      { input: await sharp(right).png().toBuffer(), left: 600, top: 0 },
    ])
    .png()
    .toBuffer();
  const out = await cropShareImage(wide);
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => [...data.slice((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
  // 3:2 inside 1200x630 is 945 wide, centred: it starts near x=127 and ends near x=1073.
  const [r, , b1] = px(160, 315);
  const [r2, , b2] = px(1040, 315);
  assert.ok(r > 150 && b1 < 100, 'left edge of the picture is still red');
  assert.ok(b2 > 150 && r2 < 100, 'right edge of the picture is still blue');
});

test('the image prompt uses the site colours when set and falls back when not', async () => {
  const { buildSharePhotoPrompt } = await import('../src/messaging/sharePhotoPrompt.js');
  const withColors = buildSharePhotoPrompt('main_invitation', {
    coupleNames: 'A & B',
    colors: { name: 'Rose Gold', primary: '#B76E79', secondary: '#F5E6E8', accent: '#C9A227' },
  });
  assert.ok(withColors.includes('#B76E79') && withColors.includes('#C9A227') && withColors.includes('Rose Gold'));
  const without = buildSharePhotoPrompt('main_invitation', { coupleNames: 'A & B' });
  assert.ok(!without.includes('#') && without.includes('ivory'));
});
