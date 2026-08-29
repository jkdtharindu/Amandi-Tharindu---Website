import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { guestStore } from '../src/data/guestStore.js';
import { themeSettings } from '../src/data/themeStore.js';

// Configurable InvitationCode format, end to end through the admin API.

const DEFAULT_ADMIN = { email: 'admin@example.com', password: 'changeme123' };
const ORIGINAL_GUESTS = structuredClone(guestStore);
const ORIGINAL_THEME = { ...themeSettings };

beforeEach(() => {
  guestStore.length = 0;
  guestStore.push(...structuredClone(ORIGINAL_GUESTS));
  Object.assign(themeSettings, ORIGINAL_THEME);
});

afterEach(() => {
  guestStore.length = 0;
  guestStore.push(...structuredClone(ORIGINAL_GUESTS));
  Object.assign(themeSettings, ORIGINAL_THEME);
});

function request(port, { path, method = 'GET', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const allHeaders = { ...headers };
    if (payload) {
      allHeaders['Content-Type'] = 'application/json';
      allHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: allHeaders }, (res) => {
      let text = '';
      res.on('data', (chunk) => (text += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(text || 'null');
        } catch {
          json = null;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, text, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function parseCookies(setCookieHeaders) {
  return (setCookieHeaders || []).map((header) => header.split(';')[0]).join('; ');
}

function csrfFrom(cookie) {
  const match = /csrf_token=([^;]+)/.exec(cookie || '');
  return match ? match[1] : '';
}

async function withServer(fn) {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    await fn(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function loginAdmin(port) {
  const landing = await request(port, { path: '/admin' });
  const cookie = parseCookies(landing.headers['set-cookie']);
  const res = await request(port, {
    path: '/api/admin/login',
    method: 'POST',
    headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
    body: DEFAULT_ADMIN,
  });
  assert.equal(res.statusCode, 200);
  return [cookie, parseCookies(res.headers['set-cookie'])].filter(Boolean).join('; ');
}

function addGuest(port, cookie, body) {
  return request(port, {
    path: '/api/admin/guests',
    method: 'POST',
    headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
    body,
  });
}

function setFormat(port, cookie, patch) {
  return request(port, {
    path: '/api/admin/theme',
    method: 'POST',
    headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
    body: patch,
  });
}

test('the default format is unchanged for existing behaviour', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await addGuest(port, cookie, { name: 'Ajith Perera', relationship: 'Relations', slotCount: 2 });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.guest.code, 'PERERA-001');
  });
});

test('switching to surname-first changes newly generated codes', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);

    const saved = await setFormat(port, cookie, { invitationCodeSurnamePosition: 'first' });
    assert.equal(saved.statusCode, 200);

    const res = await addGuest(port, cookie, {
      name: 'Wickramasinghe Arachchige Nimal',
      relationship: 'Relations',
      slotCount: 2,
    });
    assert.equal(res.body.guest.code, 'WICKRAMASINGHE-001');
  });
});

test('enabling the group prefix tags new codes by relationship', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    await setFormat(port, cookie, { invitationCodeGroupPrefix: true });

    const relation = await addGuest(port, cookie, { name: 'Ajith Perera', relationship: 'Relations', slotCount: 1 });
    const colleague = await addGuest(port, cookie, { name: 'Sunil Perera', relationship: 'Colleagues', slotCount: 1 });

    assert.equal(relation.body.guest.code, 'R-PERERA-001');
    assert.equal(colleague.body.guest.code, 'C-PERERA-001', 'each group keeps its own sequence');
  });
});

test('CRITICAL: changing the format never rewrites a code that already exists', async () => {
  // An existing code may already be printed on a card. If a format change
  // rewrote it, that guest could never log in.
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);

    const before = await addGuest(port, cookie, { name: 'Ajith Perera', relationship: 'Relations', slotCount: 1 });
    const originalCode = before.body.guest.code;

    await setFormat(port, cookie, { invitationCodeSurnamePosition: 'first', invitationCodeGroupPrefix: true });

    const list = await request(port, { path: '/api/admin/guests', headers: { Cookie: cookie } });
    const stillThere = list.body.guests.find((guest) => guest.id === before.body.guest.id);

    assert.equal(stillThere.code, originalCode, 'the printed code must survive a format change');

    const seeded = list.body.guests.find((guest) => guest.code === 'SILVA-001');
    assert.ok(seeded, 'and so must the seeded guest code');
  });
});

test('an admin-supplied code overrides generation', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await addGuest(port, cookie, {
      name: 'Ajith Perera',
      relationship: 'Relations',
      slotCount: 2,
      code: 'amma-01',
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.guest.code, 'AMMA-01', 'accepted, trimmed and upper-cased');
  });
});

test('a blank code field falls back to generation rather than erroring', async () => {
  // The form always posts the field, so an empty string must mean "generate".
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await addGuest(port, cookie, {
      name: 'Ajith Perera',
      relationship: 'Relations',
      slotCount: 2,
      code: '   ',
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.guest.code, 'PERERA-001');
  });
});

test('a duplicate manual code is refused, so two guests cannot share a login', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await addGuest(port, cookie, {
      name: 'Ajith Perera',
      relationship: 'Relations',
      slotCount: 1,
      code: 'SILVA-001', // already held by the seeded guest
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors[0].reason, 'code_taken');
  });
});

test('a manual code that could not be typed off a card is refused', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await addGuest(port, cookie, {
      name: 'Ajith Perera',
      relationship: 'Relations',
      slotCount: 1,
      code: 'not a code!',
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors[0].reason, 'invalid_code_format');
  });
});

test('a code can be corrected on an existing guest', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const created = await addGuest(port, cookie, { name: 'Ajith Perera', relationship: 'Relations', slotCount: 1 });

    const patched = await request(port, {
      path: `/api/admin/guests/${created.body.guest.id}`,
      method: 'PATCH',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { code: 'PERERA-777' },
    });

    assert.equal(patched.statusCode, 200);
    assert.equal(patched.body.guest.code, 'PERERA-777');
  });
});

test('a corrected code still cannot collide with another guest', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const created = await addGuest(port, cookie, { name: 'Ajith Perera', relationship: 'Relations', slotCount: 1 });

    const patched = await request(port, {
      path: `/api/admin/guests/${created.body.guest.id}`,
      method: 'PATCH',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { code: 'SILVA-001' },
    });

    assert.equal(patched.statusCode, 400);
    assert.equal(patched.body.errors[0].reason, 'code_taken');
  });
});

test('renaming a guest leaves their code alone', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const created = await addGuest(port, cookie, { name: 'Ajith Perera', relationship: 'Relations', slotCount: 1 });

    const patched = await request(port, {
      path: `/api/admin/guests/${created.body.guest.id}`,
      method: 'PATCH',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      body: { name: 'Ajith Fernando' },
    });

    assert.equal(patched.body.guest.code, 'PERERA-001', 'a code is only ever replaced deliberately');
  });
});

test('an invalid format setting is rejected', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await setFormat(port, cookie, { invitationCodeSurnamePosition: 'middle' });

    assert.equal(res.statusCode, 400);
    assert.ok(
      JSON.stringify(res.body).includes('invalid_surname_position'),
      'and says which setting was wrong'
    );
  });
});

test('the guest page shows the format controls and a worked preview', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const page = await request(port, { path: '/admin/guests', headers: { Cookie: cookie } });

    assert.ok(page.text.includes('id="code-surname-position"'), 'surname position picker');
    assert.ok(page.text.includes('id="code-group-prefix"'), 'group prefix toggle');
    assert.ok(page.text.includes('id="new-guest-code"'), 'manual code override field');
    assert.ok(page.text.includes('SILVA-001'), 'a worked example, not a description of the rule');
    assert.match(page.text, /never alters codes that already exist/i, 'states the guarantee plainly');
  });
});
