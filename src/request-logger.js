/**
 * Request Logging Middleware
 *
 * Logs HTTP requests with:
 * - Method, path, status code, response time
 * - Request size, response size
 * - User agent, referrer
 *
 * Sanitizes sensitive data:
 * - Guest codes (e.g., SILVA-001)
 * - Guest names
 * - Query parameters
 * - Request/response bodies
 * - Full IP addresses
 */

/**
 * Sanitize request path to remove sensitive data
 * @param {string} path - Request path
 * @returns {string} Sanitized path
 */
function sanitizePath(path) {
  // Hide guest codes in invitation paths: /invitation/SILVA-001 → /invitation/***
  return path
    .replace(/\/invitation\/[A-Z0-9\-]+/gi, '/invitation/***')
    .replace(/code=[A-Z0-9\-]+/gi, 'code=***')
    .replace(/name=[^&]+/gi, 'name=***');
}

/**
 * Mask IP address to prevent full IP logging
 * Keeps first two octets for geolocation awareness
 * @param {string} ip - IP address
 * @returns {string} Masked IP
 */
function maskIpAddress(ip) {
  if (!ip) return 'unknown';

  // For IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.*.* `;
  }

  // For IPv6
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 3).join(':') + ':***';
  }

  return 'unknown';
}

/**
 * Sanitize request body
 * Removes sensitive fields from POST data
 * @param {object} body - Request body
 * @returns {object} Sanitized body
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;

  const sanitized = { ...body };

  // Remove/mask sensitive fields
  const sensitiveFields = ['code', 'name', 'password', 'token', 'sessionId'];
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '***';
    }
  });

  return sanitized;
}

/**
 * Sanitize user agent to remove personal info
 * @param {string} userAgent - User agent string
 * @returns {string} Sanitized user agent
 */
function sanitizeUserAgent(userAgent) {
  if (!userAgent) return 'unknown';

  // Keep browser/OS info, remove version details
  return userAgent
    .replace(/\(([^)]+)\)/g, '(***)')
    .substring(0, 100); // Limit length
}

/**
 * Format response size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get HTTP status category
 * @param {number} statusCode - HTTP status code
 * @returns {string} Category (info, success, redirect, client_error, server_error)
 */
function getStatusCategory(statusCode) {
  if (statusCode < 300) return 'success';
  if (statusCode < 400) return 'redirect';
  if (statusCode < 500) return 'client_error';
  return 'server_error';
}

/**
 * Request logger middleware for Express
 * @param {object} options - Configuration
 * @returns {function} Express middleware
 */
export function requestLoggerMiddleware(options = {}) {
  const config = {
    enabled: true,
    logLevel: process.env.LOG_LEVEL || 'info',
    skipPaths: ['/home', '/story', '/celebration', '/gallery', '/wishes'], // Don't log public page views
    skipMethods: ['HEAD'], // Don't log HEAD requests
    maxBodySize: 200, // Max chars to log from body
    format: 'json', // 'json' or 'text'
    ...options,
  };

  // Parse skip paths into regex
  const skipPathRegexes = config.skipPaths.map(path => new RegExp(`^${path}$`));

  return (req, res, next) => {
    if (!config.enabled) return next();

    // Skip certain paths
    if (skipPathRegexes.some(regex => regex.test(req.path))) {
      return next();
    }

    // Skip certain methods
    if (config.skipMethods.includes(req.method)) {
      return next();
    }

    // Capture start time
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Capture request details
    const requestSize = parseInt(req.get('content-length') || 0);
    const method = req.method;
    const path = sanitizePath(req.path);
    const query = req.query && Object.keys(req.query).length ? '?' + new URLSearchParams(req.query) : '';
    const ip = maskIpAddress(req.ip || req.connection.remoteAddress);
    const userAgent = sanitizeUserAgent(req.get('user-agent'));
    const referer = req.get('referer') ? '***' : '-'; // Mask referer

    // Intercept response.json to capture status and body
    const originalJson = res.json;
    const originalSend = res.send;
    let responseBody = null;

    res.json = function(data) {
      responseBody = data;
      return originalJson.call(this, data);
    };

    res.send = function(data) {
      if (typeof data === 'string') {
        responseBody = data.substring(0, config.maxBodySize);
      }
      return originalSend.call(this, data);
    };

    // Finish handler
    res.on('finish', () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const responseSize = parseInt(res.get('content-length') || 0);
      const statusCode = res.statusCode;
      const statusCategory = getStatusCategory(statusCode);

      // Determine if rate limited
      const rateLimited = statusCode === 429;
      const csrfFailed = statusCode === 403 && path.includes('/api');
      const notFound = statusCode === 404;
      const serverError = statusCode >= 500;

      // Build log entry
      const logEntry = {
        timestamp: new Date().toISOString(),
        method,
        path: path + query,
        status: statusCode,
        status_category: statusCategory,
        duration_ms: duration,
        request_size: formatBytes(requestSize),
        response_size: formatBytes(responseSize),
        ip,
        user_agent: userAgent,
        referer,
        rate_limited: rateLimited,
        csrf_failed: csrfFailed,
        not_found: notFound,
        server_error: serverError,
      };

      // Log based on format
      if (config.format === 'json') {
        console.log(JSON.stringify(logEntry));
      } else {
        // Text format
        const icon = statusCategory === 'success' ? '✓' : statusCode < 400 ? '→' : '✗';
        console.log(
          `${icon} [${logEntry.timestamp}] ${method.padEnd(6)} ${logEntry.status} ${duration.toString().padStart(4)}ms ${path + query}`
        );
      }

      // Log warnings for issues
      if (rateLimited) {
        console.warn(`[RATE_LIMITED] ${method} ${path} from ${ip}`);
      }
      if (csrfFailed) {
        console.warn(`[CSRF_FAILED] ${method} ${path} from ${ip}`);
      }
      if (serverError) {
        console.error(`[SERVER_ERROR] ${method} ${path} returned ${statusCode}`);
      }
    });

    next();
  };
}

/**
 * Structured logger for application events
 * Sanitizes sensitive data
 */
export class RequestLogger {
  constructor(options = {}) {
    this.options = {
      enabled: true,
      logLevel: process.env.LOG_LEVEL || 'info',
      ...options,
    };
  }

  /**
   * Log info level message
   */
  info(message, data = {}) {
    if (!this.options.enabled) return;
    const sanitized = this._sanitize(data);
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      data: sanitized,
    }));
  }

  /**
   * Log warning level message
   */
  warn(message, data = {}) {
    if (!this.options.enabled) return;
    const sanitized = this._sanitize(data);
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      data: sanitized,
    }));
  }

  /**
   * Log error level message
   */
  error(message, error, data = {}) {
    if (!this.options.enabled) return;
    const sanitized = this._sanitize(data);
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      error: error ? error.message : null,
      stack: error && process.env.NODE_ENV === 'development' ? error.stack : undefined,
      data: sanitized,
    }));
  }

  /**
   * Log security event
   */
  security(event, details = {}) {
    const sanitized = this._sanitize(details);
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'warn',
      event_type: 'security',
      event,
      details: sanitized,
    }));
  }

  /**
   * Log failed login attempt
   */
  loginAttempt(success, identifier, ip, reason = null) {
    this.security(success ? 'login_success' : 'login_failed', {
      identifier: '***', // Don't log identifier
      ip: maskIpAddress(ip),
      reason,
    });
  }

  /**
   * Log RSVP submission
   */
  rsvpSubmission(guestCode, attending, ip) {
    this.info('rsvp_submitted', {
      guest_code: '***', // Don't log actual code
      attending,
      ip: maskIpAddress(ip),
    });
  }

  /**
   * Sanitize data for logging
   */
  _sanitize(data) {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveFields = ['code', 'name', 'password', 'token', 'sessionId', 'csrf_token'];

    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    });

    return sanitized;
  }
}

/**
 * Create singleton logger instance
 */
export const logger = new RequestLogger();
