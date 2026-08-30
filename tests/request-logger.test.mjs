import { test } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { startTestServer } from './helpers/test-server.mjs';
import { requestLoggerMiddleware, RequestLogger } from '../src/request-logger.js';

function captureConsoleLog() {
  const logs = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args) => logs.push({ level: 'log', args });
  console.warn = (...args) => logs.push({ level: 'warn', args });
  console.error = (...args) => logs.push({ level: 'error', args });

  return {
    logs,
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    },
  };
}

async function withTestApp(configureApp, run) {
  const app = express();
  configureApp(app);
  const server = await startTestServer(app);
  try {
    await run(server.baseUrl);
  } finally {
    await server.close();
  }
}

test('Request Logger: logs successful request', async () => {
  const captured = captureConsoleLog();
  try {
    await withTestApp((app) => {
      app.use(requestLoggerMiddleware({ enabled: true }));
      app.get('/api/test', (req, res) => res.json({ success: true }));
    }, async (baseUrl) => {
      await fetch(`${baseUrl}/api/test`);
    });
  } finally {
    captured.restore();
  }

  const logEntry = captured.logs.find(log => log.level === 'log' && log.args[0]);
  assert(logEntry, 'Should log the request');

  const parsed = JSON.parse(logEntry.args[0]);
  assert.strictEqual(parsed.status, 200);
  assert.strictEqual(parsed.method, 'GET');
  assert(parsed.path.includes('/api/test'));
  assert(parsed.status_category === 'success');
});

test('Request Logger: sanitizes guest code in path', async () => {
  const captured = captureConsoleLog();
  try {
    await withTestApp((app) => {
      app.use(requestLoggerMiddleware({ enabled: true }));
      app.get('/invitation/:code', (req, res) => res.json({ ok: true }));
    }, async (baseUrl) => {
      await fetch(`${baseUrl}/invitation/SILVA-001`);
    });
  } finally {
    captured.restore();
  }

  const logEntry = captured.logs.find(log => log.level === 'log' && log.args[0]);
  const parsed = JSON.parse(logEntry.args[0]);

  assert(parsed.path.includes('/invitation/***'));
  assert(!parsed.path.includes('SILVA-001'));
});

test('Request Logger: sanitizes code in query parameters', async () => {
  const captured = captureConsoleLog();
  try {
    await withTestApp((app) => {
      app.use(requestLoggerMiddleware({ enabled: true }));
      app.get('/login', (req, res) => res.json({ ok: true }));
    }, async (baseUrl) => {
      await fetch(`${baseUrl}/login?code=SECRET123`);
    });
  } finally {
    captured.restore();
  }

  const logEntry = captured.logs.find(log => log.level === 'log' && log.args[0]);
  const parsed = JSON.parse(logEntry.args[0]);

  assert(parsed.path.includes('code=***'));
  assert(!parsed.path.includes('SECRET123'));
});

test('Request Logger: sanitizes name in query parameters', async () => {
  const captured = captureConsoleLog();
  try {
    await withTestApp((app) => {
      app.use(requestLoggerMiddleware({ enabled: true }));
      app.get('/login', (req, res) => res.json({ ok: true }));
    }, async (baseUrl) => {
      await fetch(`${baseUrl}/login?name=John%20Doe`);
    });
  } finally {
    captured.restore();
  }

  const logEntry = captured.logs.find(log => log.level === 'log' && log.args[0]);
  const parsed = JSON.parse(logEntry.args[0]);

  assert(parsed.path.includes('name=***'));
  assert(!parsed.path.includes('John'));
});

test('Request Logger: logs rate limited requests', async () => {
  const captured = captureConsoleLog();
  try {
    await withTestApp((app) => {
      app.use(requestLoggerMiddleware({ enabled: true }));
      app.post('/api/test', (req, res) => res.status(429).json({ rate_limited: true }));
    }, async (baseUrl) => {
      await fetch(`${baseUrl}/api/test`, { method: 'POST' });
    });
  } finally {
    captured.restore();
  }

  const logEntry = captured.logs.find(log => log.level === 'log' && log.args[0]);
  const parsed = JSON.parse(logEntry.args[0]);

  assert.strictEqual(parsed.status, 429);
  assert.strictEqual(parsed.rate_limited, true);

  const warnEntry = captured.logs.find(log => log.level === 'warn' && log.args[0].includes('RATE_LIMITED'));
  assert(warnEntry, 'Should warn about rate limiting');
});

test('Request Logger: logs CSRF failures', async () => {
  const captured = captureConsoleLog();
  try {
    await withTestApp((app) => {
      app.use(requestLoggerMiddleware({ enabled: true }));
      app.post('/api/guest/login', (req, res) => res.status(403).json({ csrf_failed: true }));
    }, async (baseUrl) => {
      await fetch(`${baseUrl}/api/guest/login`, { method: 'POST' });
    });
  } finally {
    captured.restore();
  }

  const logEntry = captured.logs.find(log => log.level === 'log' && log.args[0]);
  const parsed = JSON.parse(logEntry.args[0]);

  assert.strictEqual(parsed.status, 403);
  assert.strictEqual(parsed.csrf_failed, true);
});

test('Request Logger: skips configured paths', async () => {
  const captured = captureConsoleLog();
  try {
    await withTestApp((app) => {
      app.use(requestLoggerMiddleware({
        enabled: true,
        skipPaths: ['/home', '/gallery'],
      }));
      app.get('/home', (req, res) => res.json({ ok: true }));
      app.get('/api/test', (req, res) => res.json({ ok: true }));
    }, async (baseUrl) => {
      await fetch(`${baseUrl}/home`);
      await fetch(`${baseUrl}/api/test`);
    });
  } finally {
    captured.restore();
  }

  const logEntries = captured.logs.filter(log => log.level === 'log' && log.args[0]);
  assert.strictEqual(logEntries.length, 1);

  const parsed = JSON.parse(logEntries[0].args[0]);
  assert(parsed.path.includes('/api/test'));
});

test('Request Logger: measures response time', async () => {
  const captured = captureConsoleLog();
  try {
    await withTestApp((app) => {
      app.use(requestLoggerMiddleware({ enabled: true }));
      app.get('/api/slow', (req, res) => {
        setTimeout(() => res.json({ ok: true }), 50);
      });
    }, async (baseUrl) => {
      await fetch(`${baseUrl}/api/slow`);
    });
  } finally {
    captured.restore();
  }

  const logEntry = captured.logs.find(log => log.level === 'log' && log.args[0]);
  const parsed = JSON.parse(logEntry.args[0]);

  assert(parsed.duration_ms >= 50, 'Should measure response time accurately');
});

test('RequestLogger class: logs info messages with sanitization', () => {
  const captured = captureConsoleLog();
  const logger = new RequestLogger({ enabled: true });

  logger.info('test_event', { code: 'SECRET', other: 'data' });

  captured.restore();

  const logEntry = captured.logs[0];
  const parsed = JSON.parse(logEntry.args[0]);

  assert.strictEqual(parsed.level, 'info');
  assert.strictEqual(parsed.message, 'test_event');
  assert.strictEqual(parsed.data.code, '***');
  assert.strictEqual(parsed.data.other, 'data');
});

test('RequestLogger class: logs security events', () => {
  const captured = captureConsoleLog();
  const logger = new RequestLogger({ enabled: true });

  logger.security('suspicious_activity', { ip: '192.168.1.1', reason: 'multiple_failures' });

  captured.restore();

  const logEntry = captured.logs[0];
  const parsed = JSON.parse(logEntry.args[0]);

  assert.strictEqual(parsed.level, 'warn');
  assert.strictEqual(parsed.event_type, 'security');
  assert.strictEqual(parsed.event, 'suspicious_activity');
});

test('RequestLogger class: logs login attempts', () => {
  const captured = captureConsoleLog();
  const logger = new RequestLogger({ enabled: true });

  logger.loginAttempt(false, 'SILVA-001', '192.168.1.100', 'invalid_code');

  captured.restore();

  const logEntry = captured.logs[0];
  const parsed = JSON.parse(logEntry.args[0]);

  assert.strictEqual(parsed.details.identifier, '***');
  assert(parsed.details.ip.includes('192.168'));
});

test('RequestLogger class: can be disabled', () => {
  const captured = captureConsoleLog();
  const logger = new RequestLogger({ enabled: false });

  logger.info('test', { data: 'value' });

  captured.restore();

  assert.strictEqual(captured.logs.length, 0);
});
