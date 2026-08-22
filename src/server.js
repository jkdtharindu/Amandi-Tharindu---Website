import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { pathToFileURL } from 'node:url';
import { loginGuestByCode, loginGuestByName } from './guest-auth/index.js';
import { signSession, verifySession } from './session.js';
import { getOrCreateCsrfToken, verifyCsrfToken } from './csrf.js';
import {
  findGuestByCode,
  findRsvpResponseByGuestId,
  updateGuestRsvpStatus,
  upsertRsvpResponse,
} from './guest-auth/guestRepo.js';
import { adminStore } from './data/adminStore.js';
import { verifyAdminCredentials } from './admin-auth/verifyAdminCredentials.js';
import { getThemeSettings, updateThemeSettings } from './theme/themeRepo.js';
import { THEME_FIELD_GROUPS } from './theme/mergeThemeUpdate.js';
import {
  listSections,
  createSection,
  updateSection,
  deleteSection,
} from './sections/sectionsRepo.js';
import { VALID_PAGES, VALID_SECTION_TYPES } from './sections/validateSection.js';

const ADMIN_SESSION_COOKIE = 'admin_session';

async function findAdminByEmail(email) {
  return adminStore.find((a) => a.email.toLowerCase() === String(email).trim().toLowerCase()) || null;
}

function getAdminFromRequest(req) {
  const signed = req.cookies && req.cookies[ADMIN_SESSION_COOKIE];
  const adminId = verifySession(signed);
  return adminStore.find((a) => a.id === adminId) || null;
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

function adminPageWrapper(title, bodyContent, scripts = '') {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>${baseStyles}
          .admin-shell { max-width: 960px; margin: 0 auto; padding: 1.75rem 1.5rem 3rem; }
          .admin-nav { display: flex; flex-wrap: wrap; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 1.5rem; }
          .admin-nav a, .admin-nav button { text-decoration: none; font-weight: 600; color: #475569; background: none; border: none; font: inherit; cursor: pointer; padding: 0; }
          .field-group { background: white; border-radius: 20px; padding: 1.5rem; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06); margin-bottom: 1.25rem; }
          .field-group h2 { margin: 0 0 1rem; font-size: 1.2rem; }
          .field-row { margin-bottom: 0.85rem; }
          .field-row label { font-size: 0.9rem; }
          .field-row input { padding: 0.6rem 0.75rem; border-radius: 12px; }
          .save-btn { background: #2563eb; color: white; border: none; border-radius: 999px; padding: 0.6rem 1.25rem; font-weight: 700; cursor: pointer; }
          .status-msg { font-size: 0.9rem; margin-top: 0.5rem; min-height: 1.2rem; }
          .status-msg.success { color: #15803d; }
          .status-msg.error { color: #b91c1c; }
          .section-item { border: 1px solid #e2e8f0; border-radius: 16px; padding: 1rem; margin-bottom: 0.85rem; }
          .section-item .section-item-header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
          table.admin-table { width: 100%; border-collapse: collapse; }
          table.admin-table th, table.admin-table td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="admin-shell">
          <header class="admin-nav">
            <strong>Admin</strong>
            <a href="/admin/theme">Theme</a>
            <a href="/admin/sections">Sections</a>
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

const baseStyles = `
  :root {
    color-scheme: light;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #1f2937;
    background: #f8fafc;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body { background: radial-gradient(circle at top, rgba(59, 130, 246, 0.12), transparent 30%), #f8fafc; }
  img { max-width: 100%; display: block; }
  a { color: inherit; }
  .page-shell { max-width: 1180px; margin: 0 auto; padding: 1.75rem 1.5rem 3rem; }
  .page-shell h1, .page-shell h2, .page-shell h3 { color: #0f172a; }
  .site-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem 0; }
  .site-brand { font-size: 0.95rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #334155; }
  .site-nav { display: flex; flex-wrap: wrap; gap: 1rem; }
  .site-nav a { text-decoration: none; font-weight: 600; color: #475569; transition: color 0.2s ease; }
  .site-nav a:hover { color: #2563eb; }
  .hero-panel { background: white; border-radius: 32px; padding: 2.5rem; box-shadow: 0 30px 90px rgba(15, 23, 42, 0.08); }
  .hero-panel { text-align: center; max-width: 900px; margin: 0 auto; }
  .hero-flag { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1rem; border-radius: 999px; background: #e0f2fe; color: #0369a1; font-size: 0.95rem; margin-bottom: 1.4rem; }
  .hero-panel h1 { margin: 0 0 1rem; font-size: clamp(2.5rem, 4vw, 4.2rem); line-height: 1.02; }
  .hero-panel p { margin: 0 0 1.75rem; color: #475569; font-size: 1.05rem; line-height: 1.78; max-width: 68rem; }
  .button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border: none; border-radius: 999px; padding: 1rem 1.6rem; font-weight: 700; cursor: pointer; text-decoration: none; }
  .button-primary { background: #2563eb; color: white; }
  .button-secondary { background: transparent; color: #334155; border: 1px solid rgba(100, 116, 139, 0.22); }
  .section-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-top: 2.5rem; }
  .feature-card, .event-card, .gallery-card, .wish-card, .story-card { background: white; border-radius: 28px; padding: 1.75rem; box-shadow: 0 18px 36px rgba(15, 23, 42, 0.06); }
  .gallery-card { min-height: 180px; display: flex; align-items: center; justify-content: center; color: #64748b; }
  .story-card { padding: 1.5rem; }
  .feature-card h2, .event-card h2, .story-card h3 { margin: 0 0 0.75rem; }
  .feature-card p, .event-card p, .story-card p, .wish-card p { margin: 0; color: #475569; line-height: 1.75; }
  .countdown { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; margin-top: 2rem; }
  .countdown-item { background: #1d4ed8; color: white; border-radius: 24px; padding: 1.3rem; text-align: center; }
  .countdown-item strong { display: block; font-size: 2rem; line-height: 1; }
  .section-title { font-size: 1.75rem; margin: 0 0 1rem; }
  .page-footer { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 0.95rem; }
  .grid-panel { display: grid; gap: 1.25rem; }
  .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .responsive-stack { display: grid; gap: 1.5rem; }
  label { display: block; margin-bottom: 0.75rem; font-weight: 600; color: #334155; }
  input[type="text"], input[type="email"], textarea { width: 100%; padding: 0.95rem 1rem; border-radius: 18px; border: 1px solid #cbd5e1; font: inherit; color: #0f172a; }
  textarea { min-height: 120px; resize: vertical; }
  button { cursor: pointer; }
  @media (max-width: 760px) {
    .page-shell { padding: 1.25rem 1rem 2rem; }
    .site-header { flex-direction: column; align-items: flex-start; }
    .countdown { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .hero-panel { padding: 1.75rem; }
  }
`;

function pageWrapper(title, bodyContent, scripts = '') {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>${baseStyles}</style>
      </head>
      <body>
        <div class="page-shell">
          <header class="site-header">
            <div class="site-brand">Amandi & Tharindu</div>
            ${siteNav}
          </header>
          ${bodyContent}
          <footer class="page-footer">
            <p>Wedding day: Monday, 14 December 2026 · Amandi & Tharindu’s celebration website</p>
          </footer>
        </div>
        ${scripts}
      </body>
    </html>
  `;
}

export function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(bodyParser.json());
  app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      getOrCreateCsrfToken(req, res);
    }
    next();
  });

  app.get('/', (req, res) => {
    return res.redirect('/home');
  });

  app.get('/home', (req, res) => {
    const bodyContent = `
      <section class="hero-panel">
        <span class="hero-flag">Save the date — 14 December 2026</span>
        <h1>Join us for a celebration of love, family, and new beginnings.</h1>
        <p>Welcome to the wedding website for Amandi & Tharindu. Discover our story, event details, gallery, wishes, and access your personalized invitation.</p>
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
    `;

    const scripts = `
      <script>
        function updateCountdown() {
          const weddingDate = new Date('2026-12-14T15:00:00');
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

    return res.send(pageWrapper('Amandi & Tharindu — Home', bodyContent, scripts));
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
    `;

    return res.send(pageWrapper('Our Story — Amandi & Tharindu', bodyContent));
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
    `;

    return res.send(pageWrapper('The Celebration — Amandi & Tharindu', bodyContent));
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
    `;

    return res.send(pageWrapper('Gallery — Amandi & Tharindu', bodyContent));
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
    `;

    return res.send(pageWrapper('Wishes — Amandi & Tharindu', bodyContent));
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

    return res.send(pageWrapper('Guest Login — Amandi & Tharindu', bodyContent, scripts));
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

  app.post('/api/guest/rsvp', async (req, res) => {
    if (!verifyCsrfToken(req)) {
      return res.status(403).json({ success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' });
    }

    const { code, attending, participantNames } = req.body || {};

    if (!code || typeof attending !== 'boolean') {
      return res.status(400).json({ success: false, reason: 'missing_rsvp_data' });
    }

    const guest = await findGuestByCode(code);
    if (!guest) {
      return res.status(404).json({ success: false, reason: 'guest_not_found' });
    }

    const result = await upsertRsvpResponse(guest.id, attending, attending ? participantNames || [] : []);
    await updateGuestRsvpStatus(guest.id, attending ? 'accepted' : 'declined');

    return res.json({ success: true, rsvp: result });
  });

  app.get('/invitation/:code', async (req, res) => {
    const { code } = req.params;
    const signedSession = req.cookies && req.cookies.guest_session;
    const sessionId = verifySession(signedSession);
    const guest = await findGuestByCode(code);

    if (!guest) return res.status(404).send('<h1>Invitation not found</h1>');

    const rsvp = await findRsvpResponseByGuestId(guest.id);
    const loggedIn = sessionId === guest.id;
    const hasResponded = Boolean(rsvp);
    const rsvpStatus = rsvp ? (rsvp.attending ? 'accepted' : 'declined') : 'pending';

    return res.send(`
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invitation - ${guest.name}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 720px; margin: auto; }
            .sticky-bar { position: fixed; left: 0; right: 0; bottom: 0; background: #fff8e6; border-top: 1px solid #ddd; padding: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; box-shadow: 0 -4px 16px rgba(0,0,0,0.05); }
            .sticky-bar button { padding: 0.75rem 1rem; font-size: 1rem; border: none; cursor: pointer; }
            .accept { background: #2f855a; color: white; }
            .decline { background: #718096; color: white; }
            .hidden { display: none; }
            .response-card { border: 1px solid #ddd; border-radius: 12px; padding: 1rem; margin-top: 1rem; background: #f9fafb; }
          </style>
        </head>
        <body>
          <h1>Invitation for ${guest.name}</h1>
          <p><strong>Code:</strong> ${guest.code}</p>
          <p><strong>Relationship:</strong> ${guest.relationship}</p>
          <p><strong>RSVP status:</strong> ${rsvpStatus}</p>

          <section class="response-card">
            <h2>Your invitation</h2>
            <p>Welcome ${guest.name}! Please confirm your attendance by responding below.</p>
            ${hasResponded ? `<p>Thank you. Your current response is <strong>${rsvpStatus}</strong>.</p>` : '<p>We are looking forward to your response.</p>'}
            ${hasResponded ? '<p><button id="change-response" type="button">Change your response</button></p>' : ''}
          </section>

          <div id="rsvp-form" class="hidden">
            <div class="response-card">
              <h2>RSVP</h2>
              <p>Slot count: ${guest.slotCount}</p>
              <label>
                <input type="radio" name="attending" value="yes" checked /> Accept
              </label>
              <label>
                <input type="radio" name="attending" value="no" /> Decline
              </label>
              <div id="participant-section">
                <label>
                  Participant names (comma-separated)<br />
                  <input id="participant_names" type="text" placeholder="Nimal Silva, Anu Silva" style="width:100%; padding:0.75rem; margin-top:0.5rem;" />
                </label>
              </div>
              <button id="submit-rsvp" type="button" class="accept">Submit RSVP</button>
              <p id="rsvp-message" aria-live="polite"></p>
            </div>
          </div>

          <div id="invitation-content" class="response-card">
            <h2>Event details</h2>
            <p>This is a demo invitation page. The real site will include the wedding invitation template, event information, and a personalized overlay.</p>
          </div>

          <div id="sticky-bar" class="sticky-bar ${hasResponded ? 'hidden' : ''}">
            <span>Amandi & Tharindu are waiting for your response 💍 — Will you join us?</span>
            <div>
              <button id="accept" class="accept">Accept</button>
              <button id="decline" class="decline">Decline</button>
            </div>
          </div>

          <script>
            const showForm = () => {
              document.getElementById('rsvp-form').classList.remove('hidden');
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            };

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
        </body>
      </html>
    `);
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

    return res.send(pageWrapper('Admin Login — Amandi & Tharindu', bodyContent, scripts));
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
      const fieldsHtml = group.fields
        .map(
          (field) => `
            <div class="field-row">
              <label>${field}
                <input type="text" data-field="${field}" value="${String(settings[field] ?? '').replace(/"/g, '&quot;')}" />
              </label>
            </div>
          `
        )
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
      </script>
    `;

    return res.send(adminPageWrapper('Theme Editor — Admin', bodyContent, scripts));
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

    return res.send(adminPageWrapper('Section Manager — Admin', bodyContent, scripts));
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

  return app;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
}
