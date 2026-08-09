import http from 'http';
import { createApp } from './server.js';

function parseCookies(setCookieHeaders) {
  return (setCookieHeaders || []).map((header) => header.split(';')[0]).join('; ');
}

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return '';
  const cookies = cookieHeader.split('; ').map((cookie) => cookie.split('='));
  const found = cookies.find(([cookieName]) => cookieName === name);
  return found ? found[1] : '';
}

async function run() {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const loginPage = await new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/login', method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.end();
  });

  const cookie = parseCookies(loginPage.headers['set-cookie'] || []);
  const csrfToken = getCookieValue(cookie, 'csrf_token');

  const postData = JSON.stringify({ code: 'SILVA-001' });
  const postOptions = {
    hostname: '127.0.0.1',
    port,
    path: '/api/guest/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Cookie': cookie,
      'x-csrf-token': csrfToken,
    },
  };

  const loginResult = await new Promise((resolve) => {
    const req = http.request(postOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data, headers: res.headers }));
    });
    req.write(postData);
    req.end();
  });

  console.log('Login result:', loginResult.statusCode, loginResult.body);

  const guestCookie = parseCookies(loginResult.headers['set-cookie'] || []);
  const allCookies = [cookie, guestCookie].filter(Boolean).join('; ');

  const getOptions = { hostname: '127.0.0.1', port, path: '/invitation/SILVA-001', method: 'GET', headers: { Cookie: allCookies } };

  const page = await new Promise((resolve) => {
    const req = http.request(getOptions, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.end();
  });

  console.log('Invitation page status:', page.statusCode);

  await new Promise((resolve) => server.close(resolve));
}

run().catch((err) => { console.error(err); process.exit(1); });
