import http from 'http';
import { createApp } from './server.js';

async function run() {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  // perform login
  const postData = JSON.stringify({ code: 'SILVA-001' });
  const postOptions = {
    hostname: '127.0.0.1',
    port,
    path: '/api/guest/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
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

  // fetch invitation with cookie
  const cookie = (loginResult.headers['set-cookie'] || [])[0];
  const getOptions = { hostname: '127.0.0.1', port, path: '/invitation/SILVA-001', method: 'GET', headers: { Cookie: cookie || '' } };

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
