const HSTS_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const RESTRICTED_BROWSER_FEATURES = [
  'accelerometer',
  'camera',
  'geolocation',
  'gyroscope',
  'magnetometer',
  'microphone',
  'payment',
  'usb',
];

function buildContentSecurityPolicy(isProduction) {
  // Next.js injects inline bootstrap/hydration scripts, so 'unsafe-inline' is
  // required until the app serves a per-request nonce — which needs proxy.ts and
  // gives up static rendering on every page. Tracked as a follow-up rather than
  // shipped half-done here.
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  const connectSrc = ["'self'"];

  if (!isProduction) {
    // Turbopack's dev client evaluates generated code and talks to an HMR socket.
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push('ws:');
  }

  const directives = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': connectSrc,
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');
}

export function buildSecurityHeaders({ isProduction = process.env.NODE_ENV === 'production' } = {}) {
  const headers = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    {
      key: 'Permissions-Policy',
      value: RESTRICTED_BROWSER_FEATURES.map((feature) => `${feature}=()`).join(', '),
    },
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(isProduction) },
  ];

  if (isProduction) {
    // Only over real HTTPS: on a local http:// dev server this would pin the
    // browser to https for localhost and break other projects on the same port.
    headers.push({
      key: 'Strict-Transport-Security',
      value: `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
    });
  }

  return headers;
}
