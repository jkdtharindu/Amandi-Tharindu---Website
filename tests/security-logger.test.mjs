import { test } from 'node:test';
import assert from 'node:assert';
import { SecurityLogger, maskIpAddress, sanitizePath } from '../src/security/securityLogger.js';

function capture() {
  const lines = [];
  const original = { log: console.log, warn: console.warn, error: console.error };

  console.log = (...args) => lines.push({ level: 'log', text: args[0] });
  console.warn = (...args) => lines.push({ level: 'warn', text: args[0] });
  console.error = (...args) => lines.push({ level: 'error', text: args[0] });

  return {
    lines,
    entries: () => lines.map((line) => JSON.parse(line.text)),
    restore: () => Object.assign(console, original),
  };
}

test('maskIpAddress: keeps the first two IPv4 octets and drops the rest', () => {
  assert.strictEqual(maskIpAddress('203.0.113.42'), '203.0.*.*');
});

test('maskIpAddress: shortens IPv6 to its first three groups', () => {
  assert.strictEqual(maskIpAddress('2001:db8:85a3:0:0:8a2e:370:7334'), '2001:db8:85a3:***');
});

test('maskIpAddress: refuses anything that is not an address', () => {
  // A malformed value must not be echoed into the logs verbatim, or an
  // attacker-supplied header lands in them unfiltered.
  assert.strictEqual(maskIpAddress('not-an-ip'), 'unknown');
  assert.strictEqual(maskIpAddress('203.0.113'), 'unknown');
  assert.strictEqual(maskIpAddress(''), 'unknown');
  assert.strictEqual(maskIpAddress(null), 'unknown');
  assert.strictEqual(maskIpAddress('<script>alert(1)</script>'), 'unknown');
});

test('sanitizePath: hides the invitation code', () => {
  assert.strictEqual(sanitizePath('/invitation/FRIEND-AMANDI-4F2A'), '/invitation/***');
});

test('sanitizePath: hides code and name query values', () => {
  assert.strictEqual(sanitizePath('/login?code=FRIEND-AMANDI-4F2A'), '/login?code=***');
  assert.strictEqual(sanitizePath('/login?name=Amandi%20Perera'), '/login?name=***');
  assert.strictEqual(sanitizePath('/login?name=Amandi&next=/wishes'), '/login?name=***&next=/wishes');
});

test('sanitizePath: leaves an ordinary path alone', () => {
  assert.strictEqual(sanitizePath('/api/admin/login'), '/api/admin/login');
});

test('SecurityLogger: masks sensitive fields, including nested ones', () => {
  const captured = capture();
  try {
    new SecurityLogger().info('rsvp_submitted', {
      code: 'FRIEND-AMANDI-4F2A',
      guest: { name: 'Amandi Perera', attending: true },
      attending: true,
    });
  } finally {
    captured.restore();
  }

  const [entry] = captured.entries();
  assert.strictEqual(entry.data.code, '***');
  assert.strictEqual(entry.data.guest.name, '***');
  assert.strictEqual(entry.data.guest.attending, true, 'non-sensitive fields survive');
  assert.strictEqual(entry.data.attending, true);
  assert.strictEqual(captured.lines[0].text.includes('Amandi'), false);
});

test('SecurityLogger: masks sensitive fields inside arrays', () => {
  const captured = capture();
  try {
    new SecurityLogger().info('bulk', { guests: [{ name: 'Amandi' }, { name: 'Tharindu' }] });
  } finally {
    captured.restore();
  }

  assert.strictEqual(captured.lines[0].text.includes('Amandi'), false);
  assert.strictEqual(captured.lines[0].text.includes('Tharindu'), false);
});

test('SecurityLogger: loginAttempt never records the identifier tried', () => {
  const captured = capture();
  try {
    new SecurityLogger().loginAttempt({
      success: false,
      endpoint: '/api/guest/login',
      ip: '203.0.113.42',
      reason: 'invalid_code',
      identifier: 'FRIEND-AMANDI-4F2A',
    });
  } finally {
    captured.restore();
  }

  const [entry] = captured.entries();
  assert.strictEqual(entry.event, 'login_failed');
  assert.strictEqual(entry.event_type, 'security');
  assert.strictEqual(entry.details.ip, '203.0.*.*');
  assert.strictEqual(entry.details.reason, 'invalid_code');
  assert.strictEqual(captured.lines[0].text.includes('FRIEND-AMANDI-4F2A'), false);
});

test('SecurityLogger: rateLimited records the endpoint and masked caller', () => {
  const captured = capture();
  try {
    new SecurityLogger().rateLimited({ endpoint: '/api/admin/login', ip: '198.51.100.7' });
  } finally {
    captured.restore();
  }

  const [entry] = captured.entries();
  assert.strictEqual(entry.level, 'warn');
  assert.strictEqual(entry.event, 'rate_limited');
  assert.strictEqual(entry.details.endpoint, '/api/admin/login');
  assert.strictEqual(entry.details.ip, '198.51.*.*');
});

test('SecurityLogger: an unidentified caller is reported as such, not as a fake address', () => {
  const captured = capture();
  try {
    new SecurityLogger().rateLimited({ endpoint: '/api/admin/login', ip: null });
  } finally {
    captured.restore();
  }

  assert.strictEqual(captured.entries()[0].details.ip, 'unknown');
});

test('SecurityLogger: error keeps the stack out of production logs', () => {
  const captured = capture();
  try {
    new SecurityLogger({ includeStack: false }).error('boom', new Error('kaboom'));
  } finally {
    captured.restore();
  }

  const [entry] = captured.entries();
  assert.strictEqual(entry.error, 'kaboom');
  assert.strictEqual('stack' in entry, false);
});

test('SecurityLogger: can be switched off entirely', () => {
  const captured = capture();
  try {
    const logger = new SecurityLogger({ enabled: false });
    logger.info('nothing');
    logger.rateLimited({ endpoint: '/e', ip: '1.2.3.4' });
  } finally {
    captured.restore();
  }

  assert.strictEqual(captured.lines.length, 0);
});

test('SecurityLogger: every entry carries a timestamp and level', () => {
  const captured = capture();
  try {
    new SecurityLogger().info('something_happened');
  } finally {
    captured.restore();
  }

  const [entry] = captured.entries();
  assert.strictEqual(entry.level, 'info');
  assert.strictEqual(entry.message, 'something_happened');
  assert.ok(!Number.isNaN(Date.parse(entry.timestamp)));
});
