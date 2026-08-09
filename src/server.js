import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { loginGuestByCode } from './guest-auth/index.js';
import { guestStore } from './data/guestStore.js';

export function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(bodyParser.json());

  app.post('/api/guest/login', async (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ success: false, reason: 'missing_code' });

    const result = await loginGuestByCode(code);
    if (!result.success) return res.status(404).json(result);

    // set a simple session cookie (not secure, for demo only)
    res.cookie('guest_session', result.sessionId, { httpOnly: true });
    return res.json(result);
  });

  app.get('/invitation/:code', (req, res) => {
    const { code } = req.params;
    const sessionId = req.cookies && req.cookies.guest_session;
    const guest = guestStore.find((g) => g.code === code && !g.isDeleted);

    if (!guest) return res.status(404).send('<h1>Invitation not found</h1>');

    const loggedIn = sessionId === guest.id;

    return res.send(`
      <html>
        <head><meta charset="utf-8"><title>Invitation - ${guest.name}</title></head>
        <body>
          <h1>Invitation for ${guest.name}</h1>
          <p>Code: ${guest.code}</p>
          <p>Status: ${loggedIn ? 'Logged in' : 'Not logged in'}</p>
          <p><a href="/rsvp">Go to RSVP (placeholder)</a></p>
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
