import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loginGuestByCode, loginGuestByName } from './guest-auth/index.js';
import { signSession, verifySession } from './session.js';
import { getOrCreateCsrfToken, verifyCsrfToken } from './csrf.js';
import {
  findGuestByCode,
  findGuestById,
  findRsvpResponseByGuestId,
  updateGuestRsvpStatus,
  upsertRsvpResponse,
  listGuestsForAdmin,
  createGuest,
  updateGuest,
  softDeleteGuest,
} from './guest-auth/guestRepo.js';
import { adminStore } from './data/adminStore.js';
import { verifyAdminCredentials } from './admin-auth/verifyAdminCredentials.js';
import { getThemeSettings, updateThemeSettings } from './theme/themeRepo.js';
import { THEME_FIELD_GROUPS, FIELD_LABELS } from './theme/mergeThemeUpdate.js';
import { readableTextColor } from './theme/colors.js';
import { THEME_PALETTES, FONT_CHOICES } from './theme/palettes.js';
import { buildFontFaceCss } from './theme/fontFaces.js';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
import { themeSettings as themeDefaults } from './data/themeStore.js';
import {
  listSections,
  createSection,
  updateSection,
  deleteSection,
} from './sections/sectionsRepo.js';
import { VALID_PAGES, VALID_SECTION_TYPES } from './sections/validateSection.js';
import { VALID_RELATIONSHIP_TYPES } from './guest-auth/validateGuestInput.js';

const ADMIN_SESSION_COOKIE = 'admin_session';
const GUEST_SESSION_COOKIE = 'guest_session';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes untrusted values before they are interpolated into HTML. */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Maps a public route path to the SiteSection page key used by the admin. */
const SECTION_PAGE_BY_ROUTE = {
  '/home': 'home',
  '/story': 'our-story',
  '/celebration': 'celebration',
  '/gallery': 'gallery',
  '/wishes': 'wishes',
};

async function findAdminByEmail(email) {
  return adminStore.find((a) => a.email.toLowerCase() === String(email).trim().toLowerCase()) || null;
}

function getAdminFromRequest(req) {
  const signed = req.cookies && req.cookies[ADMIN_SESSION_COOKIE];
  const adminId = verifySession(signed);
  return adminStore.find((a) => a.id === adminId) || null;
}

/**
 * Resolves the Guest proved by the signed `guest_session` cookie, or null.
 *
 * The cookie carries the guest's id, so the lookup goes through guestRepo —
 * which excludes soft-deleted guests. Removing a guest therefore revokes any
 * session they still hold, with no extra bookkeeping.
 */
async function getGuestFromRequest(req) {
  const signed = req.cookies && req.cookies[GUEST_SESSION_COOKIE];
  const guestId = verifySession(signed);
  if (!guestId) return null;
  return findGuestById(guestId);
}

function requireAdminPage(req, res, next) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.redirect('/admin');
  }
  req.admin = admin;
  next();
}

function requireAdminApi(req, res, next) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.status(401).json({ success: false, reason: 'not_authenticated', message: 'Admin login required.' });
  }
  req.admin = admin;
  next();
}

function adminPageWrapper(title, bodyContent, scripts = '', theme = null) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>${buildStyles(theme)}
          .admin-shell { max-width: 960px; margin: 0 auto; padding: 1.75rem 1.5rem 3rem; }
          .admin-nav { display: flex; flex-wrap: wrap; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--color-line); margin-bottom: 1.5rem; align-items: center; }
          .admin-nav a, .admin-nav button { text-decoration: none; font-weight: 600; color: var(--color-muted); background: none; border: none; font: inherit; cursor: pointer; padding: 0; }
          .field-group { background: var(--color-surface); border-radius: 20px; padding: 1.5rem; box-shadow: 0 12px 30px rgba(43, 33, 24, 0.06); margin-bottom: 1.25rem; }
          .field-group h2 { margin: 0 0 1rem; font-size: 1.2rem; }
          .field-row { margin-bottom: 0.85rem; }
          .field-row label { font-size: 0.9rem; }
          .field-row input { padding: 0.6rem 0.75rem; border-radius: 12px; }
          .field-hint { display: block; font-weight: 400; color: var(--color-muted); font-size: 0.8rem; margin-top: 0.15rem; }
          .save-btn { background: var(--color-primary); color: var(--color-on-primary); border: none; border-radius: 999px; padding: 0.6rem 1.25rem; font-weight: 700; cursor: pointer; }
          .status-msg { font-size: 0.9rem; margin-top: 0.5rem; min-height: 1.2rem; }
          .status-msg.success { color: #15803d; }
          .status-msg.error { color: #b91c1c; }
          .section-item { border: 1px solid var(--color-line); border-radius: 16px; padding: 1rem; margin-bottom: 0.85rem; }
          .section-item .section-item-header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
          .guest-table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
          .guest-table th, .guest-table td { text-align: left; padding: 0.65rem 0.5rem; border-bottom: 1px solid var(--color-line); vertical-align: top; }
          .guest-table th { font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-muted); }
          .guest-filters { display: grid; gap: 0.85rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 1rem; }
          .guest-row-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
          .badge-deleted { color: #b91c1c; font-weight: 700; font-size: 0.78rem; text-transform: uppercase; }
          .palette-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
          .palette-swatch { display: flex; flex-direction: column; align-items: flex-start; gap: 0.6rem; padding: 0.85rem; border-radius: 14px; border: 2px solid var(--color-line); background: var(--color-surface); cursor: pointer; text-align: left; font: inherit; color: var(--color-ink); }
          .palette-swatch.selected { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary) inset; }
          .swatch-colors { display: flex; gap: 0.3rem; }
          .swatch-colors span { width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.15); display: inline-block; }
          .swatch-name { font-weight: 600; font-size: 0.85rem; }
          .font-choice-grid { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1rem 0; }
          .font-choice-option { padding: 0.6rem 1.1rem; border-radius: 999px; border: 2px solid var(--color-line); background: var(--color-surface); cursor: pointer; font-size: 1.05rem; color: var(--color-ink); }
          .font-choice-option.selected { border-color: var(--color-primary); background: var(--color-secondary); }
          .theme-preview { margin: 1rem 0; padding: 1.25rem 1.5rem; border-radius: 16px; background: var(--preview-secondary, var(--color-secondary)); border: 1px solid var(--color-line); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
          .preview-heading { font-family: var(--font-display); color: var(--preview-primary, var(--color-primary)); font-size: 1.3rem; }
          .preview-button { display: inline-block; background: var(--preview-primary, var(--color-primary)); color: #fff; border-radius: 999px; padding: 0.6rem 1.25rem; font-weight: 700; font-size: 0.9rem; }
        </style>
      </head>
      <body>
        <div class="admin-shell">
          <header class="admin-nav">
            <strong>Admin</strong>
            <a href="/admin/theme">Theme</a>
            <a href="/admin/sections">Sections</a>
            <a href="/admin/guests">Guests</a>
            <button id="admin-logout" type="button">Log out</button>
          </header>
          ${bodyContent}
        </div>
        <script>
          function getCookieValue(name) {
            return document.cookie.split('; ').reduce((value, cookie) => {
              const [cookieName, cookieValue] = cookie.split('=');
              return cookieName === name ? decodeURIComponent(cookieValue) : value;
            }, '');
          }
          const csrfToken = getCookieValue('csrf_token');
          const logoutBtn = document.getElementById('admin-logout');
          if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
              await fetch('/api/admin/logout', { method: 'POST', headers: { 'x-csrf-token': csrfToken } });
              window.location.href = '/admin';
            });
          }
        </script>
        ${scripts}
      </body>
    </html>
  `;
}

const siteNav = `
  <nav class="site-nav">
    <a href="/home">Home</a>
    <a href="/story">Our Story</a>
    <a href="/celebration">Celebration</a>
    <a href="/gallery">Gallery</a>
    <a href="/wishes">Wishes</a>
    <a href="/login">Invitation</a>
  </nav>
`;

/**
 * Builds the site stylesheet from ThemeSettings. Admin-editable values are
 * emitted as CSS custom properties so a theme change is reflected site-wide.
 */
function buildStyles(theme) {
  const t = { ...themeDefaults, ...(theme || {}) };
  return `
  ${buildFontFaceCss()}
  :root {
    color-scheme: light;
    --color-primary: ${t.primaryColor};
    --color-secondary: ${t.secondaryColor};
    --color-accent: ${t.accentColor};
    --color-on-primary: ${readableTextColor(t.primaryColor)};
    --color-on-accent: ${readableTextColor(t.accentColor)};
    --color-ink: #2B2118;
    --color-muted: #5B5147;
    --color-surface: #FFFFFF;
    --color-line: rgba(43, 33, 24, 0.12);
    --font-display: "${t.fontFamily}", Georgia, "Times New Roman", serif;
    --font-display-style: ${t.fontStyle};
    --font-body: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-family: var(--font-body);
    color: var(--color-ink);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body { background: var(--color-secondary); color: var(--color-ink); }
  img { max-width: 100%; display: block; }
  a { color: inherit; }
  .page-shell { max-width: 1180px; margin: 0 auto; padding: 1.75rem 1.5rem 4.5rem; }
  .page-shell h1, .page-shell h2, .page-shell h3 { color: var(--color-ink); font-family: var(--font-display); font-style: var(--font-display-style); font-weight: 600; }
  .site-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem 0; }
  .site-brand { font-size: 0.95rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-ink); }
  .site-nav { display: flex; flex-wrap: wrap; gap: 1rem; }
  .site-nav a { text-decoration: none; font-weight: 600; color: var(--color-muted); transition: color 0.2s ease; }
  .site-nav a:hover { color: var(--color-primary); }
  .hero-panel { background: var(--color-surface); border-radius: 32px; padding: 2.5rem; box-shadow: 0 30px 90px rgba(43, 33, 24, 0.08); text-align: center; max-width: 900px; margin: 0 auto; }
  .hero-flag { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1rem; border-radius: 999px; background: var(--color-secondary); color: var(--color-ink); font-size: 0.95rem; margin-bottom: 1.4rem; border: 1px solid var(--color-line); }
  .hero-panel h1 { margin: 0 0 1rem; font-size: clamp(2.2rem, 4vw, 4rem); line-height: 1.08; }
  .hero-panel p { margin: 0 0 1.75rem; color: var(--color-muted); font-size: 1.05rem; line-height: 1.78; max-width: 68rem; }
  .button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border: none; border-radius: 999px; padding: 1rem 1.6rem; font-weight: 700; cursor: pointer; text-decoration: none; }
  .button-primary { background: var(--color-primary); color: var(--color-on-primary); }
  .button-secondary { background: transparent; color: var(--color-ink); border: 1px solid var(--color-line); }
  .section-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-top: 2.5rem; }
  .feature-card, .event-card, .gallery-card, .wish-card, .story-card { background: var(--color-surface); border-radius: 28px; padding: 1.75rem; box-shadow: 0 18px 36px rgba(43, 33, 24, 0.06); }
  .gallery-card { min-height: 180px; display: flex; align-items: center; justify-content: center; color: var(--color-muted); overflow: hidden; padding: 0; }
  .gallery-card img { width: 100%; height: 100%; object-fit: cover; }
  .story-card { padding: 1.5rem; }
  .feature-card h2, .event-card h2, .story-card h3 { margin: 0 0 0.75rem; }
  .feature-card p, .event-card p, .story-card p, .wish-card p { margin: 0; color: var(--color-muted); line-height: 1.75; }
  .hero-image { border-radius: 28px; margin: 0 auto 2rem; max-height: 420px; object-fit: cover; width: 100%; }
  .countdown { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; margin-top: 2rem; }
  .countdown-item { background: transparent; color: var(--color-ink); border: 1px solid var(--color-line); border-radius: 20px; padding: 1.3rem; text-align: center; font-size: 0.8rem; letter-spacing: 0.16em; text-transform: uppercase; }
  .countdown-item strong { display: block; font-size: 2.4rem; line-height: 1.1; font-family: var(--font-display); font-weight: 500; letter-spacing: 0; color: var(--color-primary); }
  .section-title { font-size: 1.75rem; margin: 0 0 1rem; font-family: var(--font-display); }
  .page-footer { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--color-line); color: var(--color-muted); font-size: 0.95rem; }
  .grid-panel { display: grid; gap: 1.25rem; }
  .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .responsive-stack { display: grid; gap: 1.5rem; }
  .custom-sections { display: grid; gap: 1.25rem; margin-top: 2.5rem; }
  .hidden { display: none; }
  .invitation-canvas { position: relative; max-width: 720px; margin: 0 auto 2rem; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 60px rgba(43, 33, 24, 0.14); }
  .invitation-canvas img { width: 100%; display: block; }
  .invitation-name { position: absolute; transform: translate(-50%, -50%); text-align: center; white-space: nowrap; font-family: var(--font-display); font-style: var(--font-display-style); }
  .invitation-fallback { max-width: 720px; margin: 0 auto 2rem; padding: 3rem 2rem; text-align: center; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: 24px; }
  .invitation-fallback .invitation-name-static { font-family: var(--font-display); font-style: var(--font-display-style); font-size: clamp(1.8rem, 4vw, 2.6rem); color: var(--color-primary); margin: 0.75rem 0; }
  .rsvp-pill { display: inline-block; padding: 0.35rem 0.9rem; border-radius: 999px; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; border: 1px solid var(--color-line); }
  .rsvp-pill.accepted { background: #E8F3EC; color: #1B5E38; border-color: #1B5E38; }
  .rsvp-pill.declined { background: #F1EEEB; color: #5B5147; }
  .rsvp-pill.pending { background: var(--color-secondary); color: var(--color-ink); }
  .response-card { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: 24px; padding: 1.75rem; margin-top: 1.25rem; }
  .detail-list { display: grid; gap: 0.4rem; margin: 0 0 1rem; padding: 0; list-style: none; color: var(--color-muted); }
  .detail-list strong { color: var(--color-ink); }
  .session-note { margin: 1.25rem 0 0; padding-top: 1rem; border-top: 1px solid var(--color-line); font-size: 0.9rem; color: var(--color-muted); }
  .link-button { background: none; border: none; padding: 0; font: inherit; color: var(--color-primary); text-decoration: underline; cursor: pointer; }
  .link-button:hover { text-decoration: none; }
  .choice-row { display: flex; flex-wrap: wrap; gap: 1.25rem; margin: 1rem 0; }
  .choice-row label { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-weight: 600; }
  .choice-row input { width: auto; }
  .sticky-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: var(--color-surface); border-top: 1px solid var(--color-line); padding: 0.9rem 1.25rem; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.75rem 1.25rem; box-shadow: 0 -8px 24px rgba(43, 33, 24, 0.08); text-align: center; }
  .sticky-bar .sticky-actions { display: flex; gap: 0.6rem; }
  .sticky-bar button { border: none; border-radius: 999px; padding: 0.65rem 1.4rem; font-weight: 700; font: inherit; font-weight: 700; cursor: pointer; }
  .accept { background: var(--color-primary); color: var(--color-on-primary); border: none; border-radius: 999px; padding: 0.75rem 1.5rem; font-weight: 700; }
  .decline { background: transparent; color: var(--color-ink); border: 1px solid var(--color-line); border-radius: 999px; padding: 0.75rem 1.5rem; font-weight: 700; }
  label { display: block; margin-bottom: 0.75rem; font-weight: 600; color: var(--color-ink); }
  input[type="text"], input[type="email"], input[type="password"], textarea, select { width: 100%; padding: 0.95rem 1rem; border-radius: 18px; border: 1px solid var(--color-line); font: inherit; color: var(--color-ink); background: var(--color-surface); }
  textarea { min-height: 120px; resize: vertical; }
  button { cursor: pointer; }
  :focus-visible { outline: 3px solid var(--color-primary); outline-offset: 2px; }
  @media (max-width: 760px) {
    .page-shell { padding: 1.25rem 1rem 5rem; }
    .site-header { flex-direction: column; align-items: flex-start; }
    .countdown { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .hero-panel { padding: 1.75rem; }
  }
`;
}

/**
 * Renders the ThemePalette picker (PRD §4.1): swatches, not text entry.
 * Selecting one writes all three colours at once via a hidden input that
 * the existing generic form-submit script already picks up.
 */
function renderPaletteGroup(group, settings) {
  const swatches = THEME_PALETTES.map((palette) => {
    const selected = settings.paletteName === palette.id;
    return `
      <button type="button" class="palette-swatch${selected ? ' selected' : ''}"
        data-palette-id="${escapeHtml(palette.id)}"
        data-primary="${escapeHtml(palette.primaryColor)}"
        data-secondary="${escapeHtml(palette.secondaryColor)}"
        data-accent="${escapeHtml(palette.accentColor)}">
        <span class="swatch-colors">
          <span style="background:${escapeHtml(palette.primaryColor)}"></span>
          <span style="background:${escapeHtml(palette.secondaryColor)}"></span>
          <span style="background:${escapeHtml(palette.accentColor)}"></span>
        </span>
        <span class="swatch-name">${escapeHtml(palette.name)}</span>
      </button>
    `;
  }).join('');

  const activePalette = THEME_PALETTES.find((p) => p.id === settings.paletteName);
  const previewPrimary = activePalette ? activePalette.primaryColor : settings.primaryColor;
  const previewSecondary = activePalette ? activePalette.secondaryColor : settings.secondaryColor;

  return `
    <form class="field-group" data-group="${group.id}">
      <h2>${group.label}</h2>
      <p class="field-hint">Pick a look — sets the colours below in one step. Custom hex values remain available under Advanced Colours.</p>
      <input type="hidden" data-field="paletteName" value="${escapeHtml(settings.paletteName ?? '')}" />
      <div class="palette-grid">${swatches}</div>
      <div class="theme-preview" data-palette-preview style="--preview-primary:${escapeHtml(previewPrimary)};--preview-secondary:${escapeHtml(previewSecondary)}">
        <span class="preview-heading">Amandi &amp; Tharindu</span>
        <span class="preview-button">Explore RSVP</span>
      </div>
      <button class="save-btn" type="submit">Save Wedding Palette</button>
      <div class="status-msg" data-status></div>
    </form>
  `;
}

/**
 * Renders the FontChoice picker (PRD §4.1): a curated list, each name shown
 * in its own face. Webfonts are not yet self-hosted (PRD §4.1 item 4), so a
 * non-system face still falls back to Georgia until that ships.
 */
function renderFontChoiceGroup(group, settings) {
  const options = FONT_CHOICES.map((font) => {
    const selected = settings.fontChoice === font.id;
    return `
      <button type="button" class="font-choice-option${selected ? ' selected' : ''}"
        data-font-id="${escapeHtml(font.id)}"
        data-display-font="${escapeHtml(font.displayFont)}"
        data-font-style="${escapeHtml(font.fontStyle)}"
        style="font-family:'${escapeHtml(font.displayFont)}', Georgia, serif; font-style:${escapeHtml(font.fontStyle)};">
        ${escapeHtml(font.name)}
      </button>
    `;
  }).join('');

  return `
    <form class="field-group" data-group="${group.id}">
      <h2>${group.label}</h2>
      <p class="field-hint">Pick a heading font from the curated list — shown in its own face below.</p>
      <input type="hidden" data-field="fontChoice" value="${escapeHtml(settings.fontChoice ?? '')}" />
      <div class="font-choice-grid">${options}</div>
      <div class="theme-preview" data-font-preview style="font-family:'${escapeHtml(settings.fontFamily)}', Georgia, serif; font-style:${escapeHtml(settings.fontStyle)};">
        Amandi &amp; Tharindu
      </div>
      <button class="save-btn" type="submit">Save Font Pairing</button>
      <div class="status-msg" data-status></div>
    </form>
  `;
}

function formatWeddingDate(isoDate) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Renders admin-managed SiteSections for a public page. Visible sections only,
 * already ordered by the repo.
 */
function renderSections(sections = []) {
  const visible = sections.filter((section) => section.isVisible);
  if (visible.length === 0) return '';

  const cards = visible
    .map(
      (section) => `
        <article class="story-card">
          ${section.title ? `<h3>${escapeHtml(section.title)}</h3>` : ''}
          ${section.content ? `<p>${escapeHtml(section.content)}</p>` : ''}
        </article>
      `
    )
    .join('');

  return `<section class="custom-sections">${cards}</section>`;
}

function pageWrapper(title, bodyContent, scripts = '', theme = null) {
  const t = { ...themeDefaults, ...(theme || {}) };
  const coupleNames = escapeHtml(t.coupleNames);
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>${buildStyles(t)}</style>
      </head>
      <body>
        <div class="page-shell">
          <header class="site-header">
            <div class="site-brand">${coupleNames}</div>
            ${siteNav}
          </header>
          ${bodyContent}
          <footer class="page-footer">
            <p>Wedding day: ${formatWeddingDate(t.weddingDate)} · ${coupleNames}’s celebration website</p>
          </footer>
        </div>
        ${scripts}
      </body>
    </html>
  `;
}

export function createApp() {
  const app = express();
  // Self-hosted webfonts (PRD §4.1 item 4) — served from our own origin so
  // the site never depends on a third-party CDN being reachable.
  app.use('/fonts', express.static(path.join(projectRoot, 'public', 'fonts'), { immutable: true, maxAge: '30d' }));
  app.use(cookieParser());
  app.use(bodyParser.json());
  app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      getOrCreateCsrfToken(req, res);
    }
    next();
  });

  // Load ThemeSettings and any admin-managed SiteSections for rendered pages so
  // admin edits take effect site-wide without each route re-fetching them.
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    try {
      res.locals.theme = await getThemeSettings();
      const sectionPage = SECTION_PAGE_BY_ROUTE[req.path];
      res.locals.sections = sectionPage ? await listSections(sectionPage) : [];
      return next();
    } catch (err) {
      return next(err);
    }
  });

  app.get('/', (req, res) => {
    return res.redirect('/home');
  });

  app.get('/home', (req, res) => {
    const theme = res.locals.theme;
    const bodyContent = `
      <section class="hero-panel">
        ${theme.heroImageUrl ? `<img class="hero-image" src="${escapeHtml(theme.heroImageUrl)}" alt="${escapeHtml(theme.coupleNames)} on their wedding journey" />` : ''}
        <span class="hero-flag">Save the date — ${formatWeddingDate(theme.weddingDate)}</span>
        <h1>Join us for a celebration of love, family, and new beginnings.</h1>
        <p>Welcome to the wedding website for ${escapeHtml(theme.coupleNames)}. Discover our story, event details, gallery, wishes, and access your personalized invitation.</p>
        <div class="button-group">
          <a class="button button-primary" href="/login">Find Your Invitation</a>
          <a class="button button-secondary" href="/story">Our Story</a>
        </div>
        <div class="countdown" id="countdown">
          <div class="countdown-item"><strong id="days">0</strong>Days</div>
          <div class="countdown-item"><strong id="hours">0</strong>Hours</div>
          <div class="countdown-item"><strong id="minutes">0</strong>Minutes</div>
          <div class="countdown-item"><strong id="seconds">0</strong>Seconds</div>
        </div>
      </section>
      <section class="section-grid">
        <div class="feature-card">
          <h2>Our Love Story</h2>
          <p>Explore how two hearts met, grew together, and decided to celebrate forever with family.</p>
        </div>
        <div class="feature-card">
          <h2>The Celebration</h2>
          <p>See the ceremony and reception details, venues, and schedule for the wedding day.</p>
        </div>
        <div class="feature-card">
          <h2>Gallery</h2>
          <p>Enjoy a curated collection of photos from the couple’s journey and engagement moments.</p>
        </div>
        <div class="feature-card">
          <h2>Wishes Wall</h2>
          <p>Read warm wishes from family and friends, and leave your own message to the couple.</p>
        </div>
      </section>
      ${renderSections(res.locals.sections)}
    `;

    const scripts = `
      <script>
        function updateCountdown() {
          const weddingDate = new Date('${theme.weddingDate}T15:00:00');
          const now = new Date();
          const diff = weddingDate - now;
          if (diff <= 0) return;
          const seconds = Math.floor(diff / 1000) % 60;
          const minutes = Math.floor(diff / 1000 / 60) % 60;
          const hours = Math.floor(diff / 1000 / 60 / 60) % 24;
          const days = Math.floor(diff / 1000 / 60 / 60 / 24);
          document.getElementById('days').textContent = days;
          document.getElementById('hours').textContent = hours;
          document.getElementById('minutes').textContent = minutes;
          document.getElementById('seconds').textContent = seconds;
        }
        updateCountdown();
        setInterval(updateCountdown, 1000);
      </script>
    `;

    return res.send(pageWrapper('Amandi & Tharindu — Home', bodyContent, scripts, res.locals.theme));
  });

  app.get('/story', (req, res) => {
    const bodyContent = `
      <section class="hero-panel">
        <span class="hero-flag">Our story</span>
        <h1>How our love story began and grew into a wedding celebration.</h1>
        <p>From a serendipitous first meeting to a joyful proposal under the stars, our story is full of memorable moments we want to share with you.</p>
      </section>
      <section class="grid-panel">
        <div class="story-card">
          <h3>2022 — First meeting</h3>
          <p>They met through mutual friends at a cozy café, and the rest was fate.</p>
        </div>
        <div class="story-card">
          <h3>2024 — First trip together</h3>
          <p>A weekend escape to the coast brought them even closer and proved they were ready for the next chapter.</p>
        </div>
        <div class="story-card">
          <h3>2025 — Engagement</h3>
          <p>A romantic proposal under the stars sealed their promise to spend forever together.</p>
        </div>
      </section>
      ${renderSections(res.locals.sections)}
    `;

    return res.send(pageWrapper('Our Story — Amandi & Tharindu', bodyContent, '', res.locals.theme));
  });

  app.get('/celebration', (req, res) => {
    const bodyContent = `
      <section class="hero-panel">
        <span class="hero-flag">Wedding events</span>
        <h1>Celebrate with us at the ceremony and reception.</h1>
        <p>We are excited to welcome our family and friends for a day filled with love, joy, and unforgettable moments.</p>
      </section>
      <section class="section-grid">
        <div class="event-card">
          <h2>Ceremony</h2>
          <p><strong>Date:</strong> Monday, 14 December 2026</p>
          <p><strong>Time:</strong> 3:00 PM</p>
          <p><strong>Venue:</strong> Sunrise Garden Hall</p>
          <p><a href="https://maps.google.com/?q=Sunrise Garden Hall" target="_blank">View on Google Maps</a></p>
        </div>
        <div class="event-card">
          <h2>Reception</h2>
          <p><strong>Date:</strong> Monday, 14 December 2026</p>
          <p><strong>Time:</strong> 6:00 PM</p>
          <p><strong>Venue:</strong> Moonlight Banquet Hall</p>
          <p><a href="https://maps.google.com/?q=Moonlight Banquet Hall" target="_blank">View on Google Maps</a></p>
        </div>
      </section>
      ${renderSections(res.locals.sections)}
    `;

    return res.send(pageWrapper('The Celebration — Amandi & Tharindu', bodyContent, '', res.locals.theme));
  });

  app.get('/gallery', (req, res) => {
    const bodyContent = `
      <section class="hero-panel">
        <span class="hero-flag">Gallery</span>
        <h1>Photos from our journey together.</h1>
        <p>Enjoy a collection of moments from the couple’s story, engagement, and memories shared with loved ones.</p>
      </section>
      <section class="gallery-grid">
        <div class="gallery-card">Photo 1</div>
        <div class="gallery-card">Photo 2</div>
        <div class="gallery-card">Photo 3</div>
        <div class="gallery-card">Photo 4</div>
      </section>
      ${renderSections(res.locals.sections)}
    `;

    return res.send(pageWrapper('Gallery — Amandi & Tharindu', bodyContent, '', res.locals.theme));
  });

  app.get('/wishes', (req, res) => {
    const bodyContent = `
      <section class="hero-panel">
        <span class="hero-flag">Wishes</span>
        <h1>Messages of love and blessings for our wedding.</h1>
        <p>Read heartfelt wishes from family and friends as we prepare to celebrate together.</p>
      </section>
      <section class="grid-panel">
        <div class="wish-card">
          <h3>Priya</h3>
          <p>Wishing you both a lifetime of love and laughter.</p>
        </div>
        <div class="wish-card">
          <h3>Rohan</h3>
          <p>May your wedding day be the start of a joyful journey together.</p>
        </div>
        <div class="wish-card">
          <h3>Anjali</h3>
          <p>So happy for you both — congratulations and best wishes.</p>
        </div>
      </section>
      ${renderSections(res.locals.sections)}
    `;

    return res.send(pageWrapper('Wishes — Amandi & Tharindu', bodyContent, '', res.locals.theme));
  });

  app.get('/login', (req, res) => {
    const bodyContent = `
      <section class="hero-panel">
        <span class="hero-flag">Guest login</span>
        <h1>Access your invitation securely.</h1>
        <p>Enter your invitation code or full name so we can locate your personalized wedding invitation.</p>
      </section>
      <section class="story-card">
        <form id="login-form" class="responsive-stack">
          <label>
            Code or Name
            <input id="identifier" name="identifier" autocomplete="off" placeholder="SILVA-001 or Nimal Silva" />
          </label>
          <button class="button button-primary" type="submit">Login</button>
        </form>
        <div id="result" role="status" aria-live="polite" style="margin-top: 1rem;"></div>
      </section>
    `;

    const scripts = `
      <script>
        function getCookieValue(name) {
          return document.cookie.split('; ').reduce((value, cookie) => {
            const [cookieName, cookieValue] = cookie.split('=');
            return cookieName === name ? decodeURIComponent(cookieValue) : value;
          }, '');
        }

        const csrfToken = getCookieValue('csrf_token');
        const form = document.getElementById('login-form');
        const result = document.getElementById('result');

        async function login(payload) {
          const res = await fetch('/api/guest/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': csrfToken,
            },
            body: JSON.stringify(payload),
          });
          return { status: res.status, body: await res.json() };
        }

        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const identifier = document.getElementById('identifier').value.trim();
          if (!identifier) {
            result.textContent = 'Please enter a code or name.';
            return;
          }

          const payload = identifier.includes('-') ? { code: identifier } : { name: identifier };
          const { status, body } = await login(payload);

          if (status === 200 && body.success) {
            result.innerHTML = '<p>Success! Logged in as ' + (body.guestId || 'guest') + '.</p><p><a href="/invitation/' + body.code + '">Go to your invitation</a></p>';
            return;
          }

          if (body.type === 'candidates') {
            let candidateHtml = '<p>Multiple matches found. Please select your guest record:</p>';
            candidateHtml += '<ul class="candidates">';
            candidateHtml += body.candidates
              .map(function (candidate) {
                return '<li>' + candidate.name + ' (' + candidate.code + ') <button type="button" data-code="' + candidate.code + '">Select</button></li>';
              })
              .join('');
            candidateHtml += '</ul>';
            result.innerHTML = candidateHtml;

            result.querySelectorAll('button[data-code]').forEach(function (button) {
              button.addEventListener('click', async function () {
                const selectedCode = button.getAttribute('data-code');
                const selectedResult = await login({ code: selectedCode });
                if (selectedResult.status === 200 && selectedResult.body.success) {
                  result.innerHTML = '<p>Selected guest: ' + selectedResult.body.guestId + '</p><p><a href="/invitation/' + selectedCode + '">Go to your invitation</a></p>';
                } else {
                  result.textContent = 'Could not select that guest. Please try again.';
                }
              });
            });
            return;
          }

          result.textContent = body.message || body.reason || 'Login failed. Please try again.';
        });
      </script>
    `;

    return res.send(pageWrapper('Guest Login — Amandi & Tharindu', bodyContent, scripts, res.locals.theme));
  });

  app.post('/api/guest/login', async (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' });
    }

    const { code, name } = req.body || {};

    if (!code && !name) {
      return res.status(400).json({ success: false, reason: 'missing_identifier' });
    }

    if (code) {
      const result = await loginGuestByCode(code);
      if (!result.success) return res.status(404).json(result);

      const signed = signSession(result.sessionId);
      res.cookie('guest_session', signed, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
      return res.json(result);
    }

    const result = await loginGuestByName(name);
    if (result.success) {
      const signed = signSession(result.sessionId);
      res.cookie('guest_session', signed, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
      return res.json(result);
    }

    if (result.type === 'candidates') {
      return res.status(200).json(result);
    }

    return res.status(404).json(result);
  });

  // Releases the guest session. Deliberately idempotent: a guest whose cookie
  // has already expired should get a clean result when they tap "Sign out",
  // not a confusing error. Matters most on a shared family phone, where the
  // device is handed to the next guest.
  app.post('/api/guest/logout', (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' });
    }

    res.clearCookie(GUEST_SESSION_COOKIE, { path: '/' });
    return res.json({ success: true });
  });

  app.post('/api/guest/rsvp', async (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' });
    }

    const { code, attending, participantNames } = req.body || {};

    if (!code || typeof attending !== 'boolean') {
      return res.status(400).json({ success: false, reason: 'missing_rsvp_data' });
    }

    // Slice 18: the session — not the posted code — decides whose RSVP this is.
    // Previously any caller who knew a code could overwrite that family's
    // response. The code is still required, but only to confirm the client is
    // answering for the guest it is signed in as.
    const guest = await getGuestFromRequest(req);
    if (!guest) {
      return res
        .status(401)
        .json({ success: false, reason: 'not_authenticated', message: 'Please sign in to respond.' });
    }

    if (guest.code !== code) {
      return res.status(403).json({
        success: false,
        reason: 'not_your_invitation',
        message: 'You can only respond to your own invitation.',
      });
    }

    const result = await upsertRsvpResponse(guest.id, attending, attending ? participantNames || [] : []);
    await updateGuestRsvpStatus(guest.id, attending ? 'accepted' : 'declined');

    return res.json({ success: true, rsvp: result });
  });

  // Slice 18: the InvitationCode says WHICH invitation; the guest_session cookie
  // proves the visitor is entitled to it. Both are required. The session is
  // checked before the code is even looked up, so an unauthenticated visitor
  // gets the same redirect for every code and cannot use this route to probe
  // which codes exist.
  app.get('/invitation/:code', async (req, res) => {
    const { code } = req.params;

    const sessionGuest = await getGuestFromRequest(req);
    if (!sessionGuest) {
      return res.redirect('/login');
    }

    const guest = await findGuestByCode(code);

    if (guest && guest.id !== sessionGuest.id) {
      return res.status(403).send(
        pageWrapper(
          'Not your invitation',
          `<section class="hero-panel">
             <span class="hero-flag">Invitation</span>
             <h1>That invitation belongs to someone else.</h1>
             <p>You are signed in as <strong>${escapeHtml(sessionGuest.name)}</strong>. Each invitation can only be opened by the guest it was addressed to.</p>
             <a class="button button-primary" href="/invitation/${encodeURIComponent(sessionGuest.code)}">Go to your invitation</a>
             <a class="button button-secondary" href="/login">Sign in as someone else</a>
           </section>`,
          '',
          res.locals.theme
        )
      );
    }

    if (!guest) {
      return res
        .status(404)
        .send(
          pageWrapper(
            'Invitation not found',
            `<section class="hero-panel">
               <span class="hero-flag">Invitation</span>
               <h1>We couldn’t find that invitation.</h1>
               <p>Please check the code printed on your wedding card, or search by your name.</p>
               <a class="button button-primary" href="/login">Find your invitation</a>
             </section>`,
            '',
            res.locals.theme
          )
        );
    }

    const theme = res.locals.theme;
    const rsvp = await findRsvpResponseByGuestId(guest.id);
    const hasResponded = Boolean(rsvp);
    const rsvpStatus = rsvp ? (rsvp.attending ? 'accepted' : 'declined') : 'pending';
    const guestName = escapeHtml(guest.name);

    // P0-02: render the admin-uploaded InvitationTemplate with the guest's name
    // overlaid at the position/size/colour configured in ThemeSettings.
    const invitationCanvas = theme.invitationTemplateUrl
      ? `<div class="invitation-canvas">
           <img src="${escapeHtml(theme.invitationTemplateUrl)}" alt="Wedding invitation for ${guestName}" />
           <span class="invitation-name" style="top: ${escapeHtml(theme.invitationNameTop)}; left: ${escapeHtml(theme.invitationNameLeft)}; font-size: ${escapeHtml(theme.invitationNameFontSize)}; color: ${escapeHtml(theme.invitationNameColor)};">${guestName}</span>
         </div>`
      : `<div class="invitation-fallback">
           <span class="hero-flag">You are invited</span>
           <p class="invitation-name-static">${guestName}</p>
           <p>${escapeHtml(theme.coupleNames)} · ${formatWeddingDate(theme.weddingDate)}</p>
         </div>`;

    const venueLine = theme.venueName
      ? `<li><strong>Venue:</strong> ${escapeHtml(theme.venueName)}${theme.venueAddress ? ` — ${escapeHtml(theme.venueAddress)}` : ''}</li>`
      : '';

    const bodyContent = `
      ${invitationCanvas}

      <section class="response-card">
        <span class="rsvp-pill ${rsvpStatus}">${rsvpStatus}</span>
        <h2>Your invitation</h2>
        <ul class="detail-list">
          <li><strong>Guest:</strong> ${guestName}</li>
          <li><strong>Code:</strong> ${escapeHtml(guest.code)}</li>
          <li><strong>Places reserved for you:</strong> ${escapeHtml(guest.slotCount)}</li>
          <li><strong>Date:</strong> ${formatWeddingDate(theme.weddingDate)}</li>
          ${venueLine}
        </ul>
        ${
          hasResponded
            ? `<p>Thank you — your current response is <strong>${rsvpStatus}</strong>.</p>
               <p><button id="change-response" type="button" class="decline">Change your response</button></p>`
            : `<p>${escapeHtml(theme.coupleNames)} would love to know if you can join them.</p>`
        }
        <p class="session-note">
          Signed in as <strong>${guestName}</strong>.
          <button id="sign-out" type="button" class="link-button">Not you? Sign out</button>
        </p>
      </section>

      <div id="rsvp-form" class="hidden">
        <section class="response-card">
          <h2>RSVP</h2>
          <div class="choice-row">
            <label><input type="radio" name="attending" value="yes" checked /> Joyfully accept</label>
            <label><input type="radio" name="attending" value="no" /> Regretfully decline</label>
          </div>
          <div id="participant-section">
            <label for="participant_names">
              Who is coming? Separate names with a comma (up to ${escapeHtml(guest.slotCount)}).
              <input id="participant_names" type="text" placeholder="Nimal Silva, Anu Silva" />
            </label>
          </div>
          <button id="submit-rsvp" type="button" class="accept">Submit RSVP</button>
          <p id="rsvp-message" aria-live="polite"></p>
        </section>
      </div>

      <div id="sticky-bar" class="sticky-bar ${hasResponded ? 'hidden' : ''}">
        <span>${escapeHtml(theme.coupleNames)} are waiting for your response 💍 — Will you join us?</span>
        <div class="sticky-actions">
          <button id="accept" class="accept">Accept</button>
          <button id="decline" class="decline">Decline</button>
        </div>
      </div>
    `;

    const scripts = `
          <script>
            function getCookieValue(name) {
              return document.cookie.split('; ').reduce((value, cookie) => {
                const [cookieName, cookieValue] = cookie.split('=');
                return cookieName === name ? decodeURIComponent(cookieValue) : value;
              }, '');
            }

            const showForm = () => {
              document.getElementById('rsvp-form').classList.remove('hidden');
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            };

            document.getElementById('sign-out').addEventListener('click', async () => {
              await fetch('/api/guest/logout', {
                method: 'POST',
                headers: { 'x-csrf-token': getCookieValue('csrf_token') },
              });
              window.location.href = '/login';
            });

            document.getElementById('accept').addEventListener('click', () => {
              document.querySelector('input[name="attending"][value="yes"]').checked = true;
              showForm();
            });

            document.getElementById('decline').addEventListener('click', () => {
              document.querySelector('input[name="attending"][value="no"]').checked = true;
              showForm();
            });

            const changeButton = document.getElementById('change-response');
            if (changeButton) {
              changeButton.addEventListener('click', showForm);
            }

            const attendingRadios = document.querySelectorAll('input[name="attending"]');
            const participantSection = document.getElementById('participant-section');

            attendingRadios.forEach((radio) => {
              radio.addEventListener('change', () => {
                participantSection.style.display = radio.value === 'yes' ? 'block' : 'none';
              });
            });

            const submitBtn = document.getElementById('submit-rsvp');
            submitBtn.addEventListener('click', async () => {
              const attending = document.querySelector('input[name="attending"]:checked').value === 'yes';
              const participantText = document.getElementById('participant_names').value.trim();
              const participantNames = participantText ? participantText.split(',').map((n) => n.trim()).filter(Boolean) : [];
              if (attending && participantNames.length === 0) {
                document.getElementById('rsvp-message').textContent = 'Please enter participant names or decline if you are not attending.';
                return;
              }

              const response = await fetch('/api/guest/rsvp', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-csrf-token': getCookieValue('csrf_token'),
                },
                body: JSON.stringify({ code: '${guest.code}', attending, participantNames }),
              });
              const data = await response.json();
              if (response.ok && data.success) {
                document.getElementById('rsvp-message').textContent = 'Thank you! Your response has been saved.';
                document.getElementById('sticky-bar').classList.add('hidden');
              } else {
                document.getElementById('rsvp-message').textContent = data.message || data.reason || 'Unable to save RSVP. Please try again.';
              }
            });
          </script>
    `;

    return res.send(pageWrapper(`Invitation — ${guestName}`, bodyContent, scripts, theme));
  });

  app.get('/admin', (req, res) => {
    const signed = req.cookies && req.cookies[ADMIN_SESSION_COOKIE];
    const adminId = verifySession(signed);
    if (adminStore.some((a) => a.id === adminId)) {
      return res.redirect('/admin/theme');
    }

    const bodyContent = `
      <section class="hero-panel">
        <span class="hero-flag">Admin login</span>
        <h1>Sign in to manage the wedding site.</h1>
      </section>
      <section class="story-card">
        <form id="admin-login-form" class="responsive-stack">
          <label>Email<input id="admin-email" type="email" autocomplete="username" /></label>
          <label>Password<input id="admin-password" type="password" autocomplete="current-password" /></label>
          <button class="button button-primary" type="submit">Log in</button>
        </form>
        <div id="admin-login-result" role="status" aria-live="polite" style="margin-top: 1rem;"></div>
      </section>
    `;

    const scripts = `
      <script>
        function getCookieValue(name) {
          return document.cookie.split('; ').reduce((value, cookie) => {
            const [cookieName, cookieValue] = cookie.split('=');
            return cookieName === name ? decodeURIComponent(cookieValue) : value;
          }, '');
        }
        const csrfToken = getCookieValue('csrf_token');
        document.getElementById('admin-login-form').addEventListener('submit', async (event) => {
          event.preventDefault();
          const email = document.getElementById('admin-email').value.trim();
          const password = document.getElementById('admin-password').value;
          const result = document.getElementById('admin-login-result');
          const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
            body: JSON.stringify({ email, password }),
          });
          const body = await res.json();
          if (res.ok && body.success) {
            window.location.href = '/admin/theme';
            return;
          }
          result.textContent = body.message || 'Login failed. Please try again.';
        });
      </script>
    `;

    return res.send(pageWrapper('Admin Login — Amandi & Tharindu', bodyContent, scripts, res.locals.theme));
  });

  app.post('/api/admin/login', async (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' });
    }

    const { email, password } = req.body || {};
    const adminRecord = await findAdminByEmail(email);
    const result = verifyAdminCredentials(email, password, adminRecord);

    if (!result.success) {
      return res.status(401).json(result);
    }

    const signed = signSession(result.adminId);
    res.cookie(ADMIN_SESSION_COOKIE, signed, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    return res.json(result);
  });

  app.post('/api/admin/logout', (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid' });
    }
    res.clearCookie(ADMIN_SESSION_COOKIE, { path: '/' });
    return res.json({ success: true });
  });

  app.get('/admin/theme', requireAdminPage, async (req, res) => {
    const settings = await getThemeSettings();

    const groupsHtml = THEME_FIELD_GROUPS.map((group) => {
      if (group.id === 'palette') return renderPaletteGroup(group, settings);
      if (group.id === 'font-choice') return renderFontChoiceGroup(group, settings);

      const fieldsHtml = group.fields
        .map((field) => {
          const { label, hint } = FIELD_LABELS[field] || { label: field, hint: '' };
          return `
            <div class="field-row">
              <label>${escapeHtml(label)}
                ${hint ? `<span class="field-hint">${escapeHtml(hint)}</span>` : ''}
                <input type="text" data-field="${field}" value="${escapeHtml(settings[field] ?? '')}" />
              </label>
            </div>
          `;
        })
        .join('');

      return `
        <form class="field-group" data-group="${group.id}">
          <h2>${group.label}</h2>
          ${fieldsHtml}
          <button class="save-btn" type="submit">Save ${group.label}</button>
          <div class="status-msg" data-status></div>
        </form>
      `;
    }).join('');

    const bodyContent = `
      <h1>Theme Editor</h1>
      <p>Update each element below and save it independently. Changes apply site-wide immediately.</p>
      ${groupsHtml}
    `;

    const scripts = `
      <script>
        document.querySelectorAll('form[data-group]').forEach((form) => {
          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const status = form.querySelector('[data-status]');
            const patch = {};
            form.querySelectorAll('input[data-field]').forEach((input) => {
              patch[input.getAttribute('data-field')] = input.value;
            });
            const res = await fetch('/api/admin/theme', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
              body: JSON.stringify(patch),
            });
            const body = await res.json();
            if (res.ok && body.success) {
              status.textContent = 'Saved.';
              status.className = 'status-msg success';
            } else {
              status.textContent = (body.errors && body.errors.map((e) => e.field + ': ' + e.reason).join(', ')) || 'Save failed.';
              status.className = 'status-msg error';
            }
          });
        });

        // ThemePalette picker: clicking a swatch stages the selection (hidden
        // input + live preview) without saving. Save button persists it.
        document.querySelectorAll('.palette-swatch').forEach((btn) => {
          btn.addEventListener('click', () => {
            const form = btn.closest('form');
            const hidden = form.querySelector('input[data-field="paletteName"]');
            hidden.value = btn.getAttribute('data-palette-id');
            form.querySelectorAll('.palette-swatch').forEach((b) => b.classList.toggle('selected', b === btn));
            const preview = form.querySelector('[data-palette-preview]');
            if (preview) {
              preview.style.setProperty('--preview-primary', btn.getAttribute('data-primary'));
              preview.style.setProperty('--preview-secondary', btn.getAttribute('data-secondary'));
            }
          });
        });

        // FontChoice picker: same staged-preview pattern as the palette picker.
        document.querySelectorAll('.font-choice-option').forEach((btn) => {
          btn.addEventListener('click', () => {
            const form = btn.closest('form');
            const hidden = form.querySelector('input[data-field="fontChoice"]');
            hidden.value = btn.getAttribute('data-font-id');
            form.querySelectorAll('.font-choice-option').forEach((b) => b.classList.toggle('selected', b === btn));
            const preview = form.querySelector('[data-font-preview]');
            if (preview) {
              preview.style.fontFamily = "'" + btn.getAttribute('data-display-font') + "', Georgia, serif";
              preview.style.fontStyle = btn.getAttribute('data-font-style');
            }
          });
        });
      </script>
    `;

    return res.send(adminPageWrapper('Theme Editor — Admin', bodyContent, scripts, settings));
  });

  app.post('/api/admin/theme', requireAdminApi, async (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid' });
    }

    const result = await updateThemeSettings(req.body || {});
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  });

  app.get('/admin/sections', requireAdminPage, async (req, res) => {
    const sections = await listSections();

    const sectionsHtml = sections
      .map(
        (section) => `
          <div class="section-item" data-id="${section.id}">
            <div class="section-item-header">
              <strong>${section.page} / ${section.sectionType}</strong>
              <span>${section.isVisible ? 'Visible' : 'Hidden'}</span>
            </div>
            <div class="field-row"><label>Title<input type="text" data-field="title" value="${String(section.title || '').replace(/"/g, '&quot;')}" /></label></div>
            <div class="field-row"><label>Content<input type="text" data-field="content" value="${String(section.content || '').replace(/"/g, '&quot;')}" /></label></div>
            <button class="save-btn" data-action="save" type="button">Save</button>
            <button class="button button-secondary" data-action="toggle" type="button">${section.isVisible ? 'Hide' : 'Show'}</button>
            <button class="button button-secondary" data-action="delete" type="button">Delete</button>
            <div class="status-msg" data-status></div>
          </div>
        `
      )
      .join('') || '<p>No custom sections yet.</p>';

    const pageOptions = VALID_PAGES.map((p) => `<option value="${p}">${p}</option>`).join('');
    const typeOptions = VALID_SECTION_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('');

    const bodyContent = `
      <h1>Section Manager</h1>
      <p>Add custom content blocks to any public page.</p>
      <form id="new-section-form" class="field-group">
        <h2>Add Section</h2>
        <div class="field-row"><label>Page<select id="new-section-page">${pageOptions}</select></label></div>
        <div class="field-row"><label>Type<select id="new-section-type">${typeOptions}</select></label></div>
        <div class="field-row"><label>Title<input id="new-section-title" type="text" /></label></div>
        <div class="field-row"><label>Content<input id="new-section-content" type="text" /></label></div>
        <button class="save-btn" type="submit">Add Section</button>
        <div class="status-msg" data-status></div>
      </form>
      <div id="sections-list">${sectionsHtml}</div>
    `;

    const scripts = `
      <script>
        document.getElementById('new-section-form').addEventListener('submit', async (event) => {
          event.preventDefault();
          const status = event.target.querySelector('[data-status]');
          const res = await fetch('/api/admin/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
            body: JSON.stringify({
              page: document.getElementById('new-section-page').value,
              sectionType: document.getElementById('new-section-type').value,
              title: document.getElementById('new-section-title').value,
              content: document.getElementById('new-section-content').value,
            }),
          });
          const body = await res.json();
          if (res.ok && body.success) {
            window.location.reload();
          } else {
            status.textContent = 'Could not add section.';
            status.className = 'status-msg error';
          }
        });

        document.querySelectorAll('.section-item').forEach((item) => {
          const id = item.getAttribute('data-id');
          const status = item.querySelector('[data-status]');

          item.querySelector('[data-action="save"]').addEventListener('click', async () => {
            const patch = {};
            item.querySelectorAll('input[data-field]').forEach((input) => {
              patch[input.getAttribute('data-field')] = input.value;
            });
            const res = await fetch('/api/admin/sections/' + id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
              body: JSON.stringify(patch),
            });
            const body = await res.json();
            status.textContent = res.ok && body.success ? 'Saved.' : 'Save failed.';
            status.className = res.ok && body.success ? 'status-msg success' : 'status-msg error';
          });

          item.querySelector('[data-action="toggle"]').addEventListener('click', async () => {
            const isVisible = item.querySelector('.section-item-header span').textContent === 'Hidden';
            await fetch('/api/admin/sections/' + id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
              body: JSON.stringify({ isVisible }),
            });
            window.location.reload();
          });

          item.querySelector('[data-action="delete"]').addEventListener('click', async () => {
            await fetch('/api/admin/sections/' + id, {
              method: 'DELETE',
              headers: { 'x-csrf-token': csrfToken },
            });
            window.location.reload();
          });
        });
      </script>
    `;

    return res.send(adminPageWrapper('Section Manager — Admin', bodyContent, scripts, res.locals.theme));
  });

  app.post('/api/admin/sections', requireAdminApi, async (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid' });
    }
    const result = await createSection(req.body || {});
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  });

  app.patch('/api/admin/sections/:id', requireAdminApi, async (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid' });
    }
    const result = await updateSection(req.params.id, req.body || {});
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json(result);
  });

  app.delete('/api/admin/sections/:id', requireAdminApi, async (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid' });
    }
    const result = await deleteSection(req.params.id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json(result);
  });

  app.get('/api/admin/guests', requireAdminApi, async (req, res) => {
    const guests = await listGuestsForAdmin({
      rsvpStatus: req.query.rsvpStatus || undefined,
      relationship: req.query.relationship || undefined,
      search: req.query.search || undefined,
    });
    return res.json({ success: true, guests });
  });

  app.post('/api/admin/guests', requireAdminApi, async (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid' });
    }
    const result = await createGuest(req.body || {});
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  });

  app.patch('/api/admin/guests/:id', requireAdminApi, async (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid' });
    }
    const result = await updateGuest(req.params.id, req.body || {});
    if (!result.success) {
      return res.status(result.reason === 'guest_not_found' ? 404 : 400).json(result);
    }
    return res.json(result);
  });

  app.delete('/api/admin/guests/:id', requireAdminApi, async (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid' });
    }
    const result = await softDeleteGuest(req.params.id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json(result);
  });

  app.get('/admin/guests', requireAdminPage, async (req, res) => {
    const guests = await listGuestsForAdmin({
      rsvpStatus: req.query.rsvpStatus || undefined,
      relationship: req.query.relationship || undefined,
      search: req.query.search || undefined,
    });

    const relationshipOptions = VALID_RELATIONSHIP_TYPES.map(
      (value) => `<option value="${value}" ${req.query.relationship === value ? 'selected' : ''}>${value}</option>`
    ).join('');
    const statusOptions = ['pending', 'accepted', 'declined']
      .map((value) => `<option value="${value}" ${req.query.rsvpStatus === value ? 'selected' : ''}>${value}</option>`)
      .join('');

    const rowsHtml = guests
      .map((guest) => {
        const updatedLabel = guest.updatedAt || guest.createdAt || '—';
        return `
          <tr data-id="${escapeHtml(guest.id)}" data-name="${escapeHtml(guest.name)}" data-relationship="${escapeHtml(guest.relationship)}" data-slot-count="${escapeHtml(String(guest.slotCount))}" class="${guest.isDeleted ? 'guest-deleted' : ''}">
            <td>
              <strong>${escapeHtml(guest.name)}</strong>
              ${guest.isDeleted ? '<div class="badge-deleted">Deleted</div>' : ''}
            </td>
            <td><code>${escapeHtml(guest.code)}</code></td>
            <td>${escapeHtml(guest.relationship)}</td>
            <td>${escapeHtml(String(guest.slotCount))}</td>
            <td>${escapeHtml(guest.rsvpStatus)}</td>
            <td>${escapeHtml(guest.whatsappNumber || '—')}</td>
            <td>${escapeHtml(String(updatedLabel))}</td>
            <td>
              <div class="guest-row-actions">
                <button class="button button-secondary" data-action="edit" type="button">Edit</button>
                ${guest.isDeleted ? '' : '<button class="button button-secondary" data-action="delete" type="button">Delete</button>'}
              </div>
            </td>
          </tr>
        `;
      })
      .join('') || '<tr><td colspan="8">No guests match these filters.</td></tr>';

    const bodyContent = `
      <h1>Guest Management</h1>
      <p>Add guests, assign invitation codes, and review RSVP status.</p>

      <form id="guest-filters" class="field-group guest-filters">
        <div class="field-row">
          <label>Search
            <input id="filter-search" type="search" value="${escapeHtml(req.query.search || '')}" placeholder="Name or code" />
          </label>
        </div>
        <div class="field-row">
          <label>RSVP status
            <select id="filter-rsvp-status">
              <option value="">All</option>
              ${statusOptions}
            </select>
          </label>
        </div>
        <div class="field-row">
          <label>Relationship
            <select id="filter-relationship">
              <option value="">All</option>
              ${relationshipOptions}
            </select>
          </label>
        </div>
        <div class="field-row" style="align-self: end;">
          <button class="save-btn" type="submit">Apply filters</button>
        </div>
      </form>

      <form id="new-guest-form" class="field-group">
        <h2>Add Guest</h2>
        <div class="field-row"><label>Name<input id="new-guest-name" type="text" required /></label></div>
        <div class="field-row">
          <label>Relationship
            <select id="new-guest-relationship">${relationshipOptions}</select>
          </label>
        </div>
        <div class="field-row"><label>Slot count<input id="new-guest-slots" type="number" min="1" value="1" /></label></div>
        <button class="save-btn" type="submit">Add Guest</button>
        <div class="status-msg" data-status></div>
      </form>

      <div class="field-group">
        <h2>Guest List (${guests.length})</h2>
        <table class="guest-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Relationship</th>
              <th>Slots</th>
              <th>RSVP</th>
              <th>WhatsApp</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    const scripts = `
      <script>
        document.getElementById('guest-filters').addEventListener('submit', (event) => {
          event.preventDefault();
          const params = new URLSearchParams();
          const search = document.getElementById('filter-search').value.trim();
          const rsvpStatus = document.getElementById('filter-rsvp-status').value;
          const relationship = document.getElementById('filter-relationship').value;
          if (search) params.set('search', search);
          if (rsvpStatus) params.set('rsvpStatus', rsvpStatus);
          if (relationship) params.set('relationship', relationship);
          const query = params.toString();
          window.location.href = query ? '/admin/guests?' + query : '/admin/guests';
        });

        document.getElementById('new-guest-form').addEventListener('submit', async (event) => {
          event.preventDefault();
          const status = event.target.querySelector('[data-status]');
          const res = await fetch('/api/admin/guests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
            body: JSON.stringify({
              name: document.getElementById('new-guest-name').value.trim(),
              relationship: document.getElementById('new-guest-relationship').value,
              slotCount: Number(document.getElementById('new-guest-slots').value),
            }),
          });
          const body = await res.json();
          if (res.ok && body.success) {
            window.location.reload();
            return;
          }
          status.textContent = (body.errors && body.errors.map((e) => e.field + ': ' + e.reason).join(', ')) || body.message || 'Could not add guest.';
          status.className = 'status-msg error';
        });

        document.querySelectorAll('.guest-table tbody tr[data-id]').forEach((row) => {
          const id = row.getAttribute('data-id');
          const editBtn = row.querySelector('[data-action="edit"]');
          const deleteBtn = row.querySelector('[data-action="delete"]');

          if (editBtn) {
            editBtn.addEventListener('click', async () => {
              const name = window.prompt('Guest name', row.getAttribute('data-name'));
              if (name === null) return;
              const relationship = window.prompt('Relationship (Relations, Colleagues, Neighbours, Friends)', row.getAttribute('data-relationship'));
              if (relationship === null) return;
              const slotCount = window.prompt('Slot count', row.getAttribute('data-slot-count'));
              if (slotCount === null) return;
              const res = await fetch('/api/admin/guests/' + id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
                body: JSON.stringify({ name: name.trim(), relationship: relationship.trim(), slotCount: Number(slotCount) }),
              });
              if (res.ok) window.location.reload();
            });
          }

          if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
              if (!window.confirm('Soft-delete this guest? They will no longer be able to log in.')) return;
              await fetch('/api/admin/guests/' + id, {
                method: 'DELETE',
                headers: { 'x-csrf-token': csrfToken },
              });
              window.location.reload();
            });
          }
        });
      </script>
    `;

    return res.send(adminPageWrapper('Guest Management — Admin', bodyContent, scripts, res.locals.theme));
  });

  return app;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
}
