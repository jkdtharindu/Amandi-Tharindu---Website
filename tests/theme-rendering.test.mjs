import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { themeSettings } from '../src/data/themeStore.js';
import { siteSections } from '../src/data/sectionsStore.js';
import { readableTextColor, contrastRatio } from '../src/theme/colors.js';

const DEFAULTS = { ...themeSettings };

beforeEach(() => {
  Object.assign(themeSettings, DEFAULTS);
  siteSections.length = 0;
});

function getPage(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function withServer(fn) {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    await fn(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('ThemeSettings colours reach the public page CSS', async () => {
  themeSettings.primaryColor = '#123456';
  await withServer(async (port) => {
    const page = await getPage(port, '/home');
    assert.equal(page.statusCode, 200);
    assert.ok(page.body.includes('--color-primary: #123456'), 'primary colour should be emitted as a CSS custom property');
  });
});

test('ThemeSettings font reaches the public page CSS', async () => {
  themeSettings.fontFamily = 'Playfair Display';
  await withServer(async (port) => {
    const page = await getPage(port, '/home');
    assert.ok(page.body.includes('"Playfair Display"'), 'font family should be emitted');
  });
});

test('couple names and wedding date render from ThemeSettings', async () => {
  themeSettings.coupleNames = 'Test Couple';
  themeSettings.weddingDate = '2027-01-02';
  await withServer(async (port) => {
    const page = await getPage(port, '/home');
    assert.ok(page.body.includes('Test Couple'), 'couple names should render');
    assert.ok(page.body.includes('Saturday, 2 January 2027'), 'wedding date should render formatted');
  });
});

test('hero image renders only when configured', async () => {
  await withServer(async (port) => {
    const withoutImage = await getPage(port, '/home');
    assert.ok(!withoutImage.body.includes('class="hero-image"'), 'no hero image element when unset');

    themeSettings.heroImageUrl = 'https://example.com/hero.jpg';
    const withImage = await getPage(port, '/home');
    assert.ok(withImage.body.includes('https://example.com/hero.jpg'), 'hero image should render when set');
  });
});

test('visible SiteSections render on their public page', async () => {
  siteSections.push({
    id: 's1',
    page: 'gallery',
    sectionType: 'text',
    title: 'Parking Info',
    content: 'Free parking is available.',
    displayOrder: 0,
    isVisible: true,
  });

  await withServer(async (port) => {
    const gallery = await getPage(port, '/gallery');
    assert.ok(gallery.body.includes('Parking Info'), 'section title should render on its page');
    assert.ok(gallery.body.includes('Free parking is available.'), 'section content should render');

    const home = await getPage(port, '/home');
    assert.ok(!home.body.includes('Parking Info'), 'section must not leak onto another page');
  });
});

test('hidden SiteSections are not rendered', async () => {
  siteSections.push({
    id: 's2',
    page: 'home',
    sectionType: 'text',
    title: 'Hidden Note',
    content: 'Should not appear.',
    displayOrder: 0,
    isVisible: false,
  });

  await withServer(async (port) => {
    const page = await getPage(port, '/home');
    assert.ok(!page.body.includes('Hidden Note'), 'hidden sections must not render');
  });
});

test('SiteSection content is HTML-escaped', async () => {
  siteSections.push({
    id: 's3',
    page: 'home',
    sectionType: 'text',
    title: '<script>alert(1)</script>',
    content: 'safe',
    displayOrder: 0,
    isVisible: true,
  });

  await withServer(async (port) => {
    const page = await getPage(port, '/home');
    assert.ok(!page.body.includes('<script>alert(1)</script>'), 'raw script tag must not be emitted');
    assert.ok(page.body.includes('&lt;script&gt;'), 'content should be escaped');
  });
});

test('webfonts are self-hosted: @font-face rules and font files are actually served', async () => {
  await withServer(async (port) => {
    const page = await getPage(port, '/home');
    assert.ok(page.body.includes("@font-face"), 'the page must declare @font-face rules, not just reference a family name');
    assert.ok(page.body.includes("url('/fonts/cormorant-garamond-latin-400-normal.woff2')"), 'the default font family must have a self-hosted source');
    assert.ok(!page.body.includes('fonts.googleapis.com') && !page.body.includes('fonts.gstatic.com'), 'must not depend on a third-party font CDN');

    const fontFile = await getPage(port, '/fonts/cormorant-garamond-latin-400-normal.woff2');
    assert.equal(fontFile.statusCode, 200, 'the referenced font file must actually be served from this origin');
  });
});

test('readableTextColor picks an accessible ink for the chosen background', () => {
  const onGold = readableTextColor('#B8860B');
  assert.ok(contrastRatio(onGold, '#B8860B') >= 4.5, 'button text should meet WCAG AA on the default gold');

  assert.equal(readableTextColor('#FFFFFF'), '#2B2118', 'dark ink on a white background');
  assert.equal(readableTextColor('#000000'), '#FFFFFF', 'light ink on a black background');
});
