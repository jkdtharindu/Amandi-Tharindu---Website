/**
 * Security Headers Middleware
 *
 * Sets HTTP security headers to protect against:
 * - Clickjacking (X-Frame-Options)
 * - MIME sniffing (X-Content-Type-Options)
 * - XSS attacks (X-XSS-Protection, Content-Security-Policy)
 * - Referrer leaks (Referrer-Policy)
 * - Excessive browser permissions (Permissions-Policy)
 * - Man-in-the-middle (Strict-Transport-Security)
 *
 * Reference: https://owasp.org/www-project-secure-headers/
 */

/**
 * Express middleware to set security headers
 * @param {object} options - Configuration options
 * @returns {function} Express middleware
 */
export function securityHeadersMiddleware(options = {}) {
  const config = {
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
    xssFilter: true,
    permissionsPolicy: {
      features: {
        geolocation: [],
        microphone: [],
        camera: [],
        magnetometer: [],
        gyroscope: [],
        accelerometer: [],
        paymentHandler: [],
        usb: [],
      },
    },
    ...options,
  };

  return (req, res, next) => {
    // Prevent MIME type sniffing
    if (config.noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // Prevent clickjacking
    if (config.frameguard) {
      const action = config.frameguard.action || 'deny';
      res.setHeader('X-Frame-Options', action.toUpperCase());
    }

    // Enable XSS filter in browsers
    if (config.xssFilter) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Control referrer information
    if (config.referrerPolicy) {
      const policy = config.referrerPolicy.policy || 'no-referrer';
      res.setHeader('Referrer-Policy', policy);
    }

    // Control browser features/permissions
    if (config.permissionsPolicy && config.permissionsPolicy.features) {
      const features = config.permissionsPolicy.features;
      const directives = Object.entries(features)
        .map(([key, value]) => {
          const valueStr = Array.isArray(value) ? value.join(' ') : value;
          return `${key}=(${valueStr})`;
        })
        .join(', ');
      res.setHeader('Permissions-Policy', directives);
    }

    // DNS prefetch control
    if (config.dnsPrefetchControl !== false) {
      const allow = config.dnsPrefetchControl.allow === true ? 'on' : 'off';
      res.setHeader('X-DNS-Prefetch-Control', allow);
    }

    // Prevent IE from executing downloads
    if (config.ieNoOpen) {
      res.setHeader('X-Download-Options', 'noopen');
    }

    // Hide "X-Powered-By" header
    if (config.hidePoweredBy) {
      res.removeHeader('X-Powered-By');
    }

    // HSTS (HTTP Strict Transport Security) - Production only
    if (config.hsts && process.env.NODE_ENV === 'production') {
      const { maxAge, includeSubDomains, preload } = config.hsts;
      let hstsValue = `max-age=${maxAge}`;
      if (includeSubDomains) hstsValue += '; includeSubDomains';
      if (preload) hstsValue += '; preload';
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // Content Security Policy
    if (config.contentSecurityPolicy) {
      const cspDirectives = {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"], // unsafe-inline needed for inline scripts in server.js
        'style-src': ["'self'", "'unsafe-inline'"], // unsafe-inline needed for inline styles
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
      };

      const cspValue = Object.entries(cspDirectives)
        .map(([key, values]) => `${key} ${values.join(' ')}`)
        .join('; ');

      res.setHeader('Content-Security-Policy', cspValue);
    }

    // Cross-Origin Opener Policy
    if (config.crossOriginOpenerPolicy) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }

    // Cross-Origin Embedder Policy
    if (config.crossOriginEmbedderPolicy) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    // Cross-Origin Resource Policy
    if (config.crossOriginResourcePolicy && config.crossOriginResourcePolicy.policy) {
      res.setHeader('Cross-Origin-Resource-Policy', config.crossOriginResourcePolicy.policy);
    }

    next();
  };
}

/**
 * Preset configurations for different environments
 */
export const securityHeadersPresets = {
  /**
   * Strict CSP for static content (no inline scripts)
   * Use when refactoring inline scripts to separate files
   */
  strict: {
    contentSecurityPolicy: true,
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'no-referrer' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },

  /**
   * Relaxed CSP for dynamic content with inline scripts
   * Current default for wedding website
   */
  relaxed: {
    contentSecurityPolicy: true, // Allows unsafe-inline
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'no-referrer' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: false,
    },
  },

  /**
   * Development mode (minimal headers)
   * For faster development iteration
   */
  development: {
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
    contentSecurityPolicy: false, // Disabled in dev for easier inline scripts
    hsts: false,
  },
};

/**
 * Get preset based on environment
 */
export function getSecurityHeadersPreset() {
  if (process.env.NODE_ENV === 'production') {
    return securityHeadersPresets.relaxed;
  }
  return securityHeadersPresets.development;
}
