/**
 * Server entry point.
 *
 * `dotenv/config` is imported FIRST and deliberately: the repos under `src/`
 * read `process.env.DATABASE_URL` at module-evaluation time to decide between
 * Postgres and their in-memory fallback. ES modules evaluate in import-
 * declaration order, so loading .env here happens before `./server.js` — and
 * everything it imports — is evaluated.
 *
 * This lives outside `server.js` on purpose. The test suite imports
 * `createApp` from `server.js`; if that module loaded .env, every test would
 * start talking to whatever database `.env` points at.
 */
import 'dotenv/config';
import { createApp } from './server.js';

const app = createApp();
const port = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.warn(
    'WARNING: DATABASE_URL is not set. Running on in-memory stores — ' +
      'guests, RSVPs, theme and sections will be lost when this process exits.'
  );
}

app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
