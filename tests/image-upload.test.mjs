import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/server.js';
import { TEST_ADMIN, seedTestAdmin } from './helpers/adminFixture.mjs';

// Slice 14 (admin image upload). SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are
// never set in the test environment (tests import createApp() directly,
// which never loads .env -- see src/main.js's decision, docs/MEMORY.md
// 2026-08-30), so these tests exercise every validation/auth path plus the
// real "storage not configured" response, but not an actual Supabase upload.
// That path is identical in spirit to how themeRepo's Postgres branch is
// only ever exercised with a live DATABASE_URL, not in this suite.

const DEFAULT_ADMIN = { email: TEST_ADMIN.email, password: TEST_ADMIN.password };
const BOUNDARY = 'test-boundary-image-upload';

beforeEach(() => {
  seedTestAdmin();
});

function buildMultipartBody({ fields = {}, file }) {
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  if (file) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`
      )
    );
    parts.push(file.buffer);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(parts);
}

function request(port, { path, method = 'GET', headers = {}, body, jsonBody, multipart }) {
  return new Promise((resolve, reject) => {
    let payload = null;
    const allHeaders = { ...headers };

    if (multipart) {
      payload = buildMultipartBody(multipart);
      allHeaders['Content-Type'] = `multipart/form-data; boundary=${BOUNDARY}`;
      allHeaders['Content-Length'] = payload.length;
    } else if (jsonBody !== undefined) {
      payload = Buffer.from(JSON.stringify(jsonBody));
      allHeaders['Content-Type'] = 'application/json';
      allHeaders['Content-Length'] = payload.length;
    } else if (body !== undefined) {
      payload = body;
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
    jsonBody: DEFAULT_ADMIN,
  });
  assert.equal(res.statusCode, 200, 'admin login should succeed');
  return [cookie, parseCookies(res.headers['set-cookie'])].filter(Boolean).join('; ');
}

const TINY_PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

test('upload is admin-only', async () => {
  await withServer(async (port) => {
    const res = await request(port, {
      path: '/api/admin/upload',
      method: 'POST',
      multipart: { fields: { folder: 'gallery' }, file: { filename: 'a.png', mimeType: 'image/png', buffer: TINY_PNG } },
    });
    assert.equal(res.statusCode, 401);
  });
});

test('upload without a CSRF token is refused', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await request(port, {
      path: '/api/admin/upload',
      method: 'POST',
      headers: { Cookie: cookie },
      multipart: { fields: { folder: 'gallery' }, file: { filename: 'a.png', mimeType: 'image/png', buffer: TINY_PNG } },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.reason, 'csrf_invalid');
  });
});

test('an unsupported file type is rejected', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await request(port, {
      path: '/api/admin/upload',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      multipart: {
        fields: { folder: 'gallery' },
        file: { filename: 'a.gif', mimeType: 'image/gif', buffer: TINY_PNG },
      },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.reason, 'invalid_file_type');
  });
});

test('a file over the 5MB limit is rejected', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
    const res = await request(port, {
      path: '/api/admin/upload',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      multipart: {
        fields: { folder: 'gallery' },
        file: { filename: 'big.png', mimeType: 'image/png', buffer: oversized },
      },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.reason, 'file_too_large');
  });
});

test('an unknown folder is rejected', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await request(port, {
      path: '/api/admin/upload',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      multipart: {
        fields: { folder: 'not-a-real-folder' },
        file: { filename: 'a.png', mimeType: 'image/png', buffer: TINY_PNG },
      },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.reason, 'invalid_folder');
  });
});

test('a request with no file is rejected', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await request(port, {
      path: '/api/admin/upload',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      multipart: { fields: { folder: 'gallery' } },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.reason, 'no_file');
  });
});

test('a valid upload fails clearly when storage is not configured', async () => {
  await withServer(async (port) => {
    const cookie = await loginAdmin(port);
    const res = await request(port, {
      path: '/api/admin/upload',
      method: 'POST',
      headers: { Cookie: cookie, 'x-csrf-token': csrfFrom(cookie) },
      multipart: {
        fields: { folder: 'gallery' },
        file: { filename: 'a.png', mimeType: 'image/png', buffer: TINY_PNG },
      },
    });
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.reason, 'storage_not_configured');
  });
});
