import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { loginGuestByCode, loginGuestByName } from './guest-auth/index.js';
import { signSession, verifySession } from './session.js';
import { getOrCreateCsrfToken, verifyCsrfToken } from './csrf.js';
import { RateLimiter, createRateLimitMiddleware } from './rate-limiter.js';
import { securityHeadersMiddleware, getSecurityHeadersPreset } from './security-headers.js';
import { requestLoggerMiddleware, logger } from './request-logger.js';
import {
  findGuestByCode,
  findRsvpResponseByGuestId,
  updateGuestRsvpStatus,
  upsertRsvpResponse,
} from './guest-auth/guestRepo.js';

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
  const rateLimiter = new RateLimiter();

  // Apply security headers early
  app.use(securityHeadersMiddleware(getSecurityHeadersPreset()));

  // Request logging (with sensitive data sanitization)
  app.use(requestLoggerMiddleware({
    enabled: true,
    format: process.env.LOG_FORMAT || 'json', // 'json' or 'text'
  }));

  app.use(cookieParser());
  app.use(bodyParser.json());
  app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      getOrCreateCsrfToken(req, res);
    }
    next();
  });

  // Rate limit configuration per endpoint
  const loginLimitMiddleware = createRateLimitMiddleware(rateLimiter, {
    maxRequests: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
    message: 'Too many login attempts. Please try again in 10 minutes.',
  });

  const rsvpLimitMiddleware = createRateLimitMiddleware(rateLimiter, {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many RSVP updates. Please try again later.',
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

  app.post('/api/guest/login', loginLimitMiddleware, async (req, res) => {
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

  app.post('/api/guest/rsvp', rsvpLimitMiddleware, async (req, res) => {
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

  return app;
}

if (process.argv[2] !== 'test') {
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
}
