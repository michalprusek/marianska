/**
 * Access Logger for Marianska Booking System
 * Provides comprehensive access logging for security and audit purposes
 * Complies with IT security standards for web application logging
 */

const fs = require('fs');
const path = require('path');

class AccessLogger {
  constructor(logDir = './logs') {
    this.logDir = logDir;
    this.lastLogEntry = null; // In-memory cache to prevent race conditions
    this.isWriting = false; // Mutex flag
    this.writeQueue = []; // Queue for concurrent writes
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Get current date in YYYY-MM-DD format for log rotation
   */
  getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Get log file path for current date
   */
  getLogFilePath() {
    const dateString = this.getDateString();
    return path.join(this.logDir, `access-${dateString}.log`);
  }

  /**
   * Extract user info from request
   */
  getUserInfo(req) {
    // Check for admin session
    const sessionToken = req.headers['x-session-token'];
    const editToken = req.headers['x-edit-token'];

    let userType = 'anonymous';
    let userId = null;

    if (sessionToken) {
      userType = 'admin';
      userId = sessionToken.substring(0, 8); // First 8 chars for identification
    } else if (editToken) {
      userType = 'booking_editor';
      userId = editToken.substring(0, 8);
    }

    return { userType, userId };
  }

  /**
   * Get client IP address (handles proxy)
   */
  getClientIP(req) {
    // Trust X-Forwarded-For header when behind nginx proxy
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // Take the first IP in the list
      return forwardedFor.split(',')[0].trim();
    }

    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * Format log entry according to security standards
   */
  formatLogEntry(req, res, responseTime) {
    const timestamp = new Date().toISOString();
    const { userType, userId } = this.getUserInfo(req);
    const clientIP = this.getClientIP(req);
    const userAgent = req.get('user-agent') || 'unknown';
    const { method } = req;
    const url = req.originalUrl || req.url;
    const { statusCode } = res;
    const contentLength = res.get('content-length') || 0;
    const referer = req.get('referer') || '-';
    const { protocol } = req;
    const httpVersion = `HTTP/${req.httpVersion}`;

    // Create structured log entry
    const logEntry = {
      timestamp,
      client_ip: clientIP,
      user_type: userType,
      user_id: userId || '-',
      method,
      url,
      protocol,
      http_version: httpVersion,
      status_code: statusCode,
      content_length: contentLength,
      referer,
      user_agent: userAgent,
      response_time_ms: responseTime,
    };

    // Format as JSON for easy parsing
    return JSON.stringify(logEntry);
  }

  /**
   * Get last log entry from file
   */
  getLastLogEntry(logFilePath) {
    try {
      if (!fs.existsSync(logFilePath)) {
        return null;
      }

      const content = fs.readFileSync(logFilePath, 'utf8');
      const lines = content.trim().split('\n');

      if (lines.length === 0 || lines[0] === '') {
        return null;
      }

      const lastLine = lines[lines.length - 1];
      return JSON.parse(lastLine);
    } catch {
      // If parsing fails, return null (allow new entry)
      return null;
    }
  }

  /**
   * Generate signature for log entry (for duplicate detection)
   * Signature includes only stable fields, ignoring timestamp/response_time/content_length
   * NOTE: content_length is excluded because it can vary slightly for identical requests
   * (e.g., health endpoint with varying uptime in response)
   */
  getLogSignature(logEntry) {
    const parsed = typeof logEntry === 'string' ? JSON.parse(logEntry) : logEntry;

    return [
      parsed.client_ip,
      parsed.user_type,
      parsed.user_id,
      parsed.method,
      parsed.url,
      parsed.status_code,
      parsed.user_agent,
      // Deliberately exclude: timestamp, response_time_ms, content_length
    ].join('|');
  }

  /**
   * Check if new log entry is duplicate of last entry
   * Compares signatures, ignoring timestamp and response_time
   */
  isDuplicateEntry(newEntry, lastEntry) {
    if (!lastEntry) {
      return false;
    }

    const newSignature = this.getLogSignature(newEntry);
    const lastSignature = this.getLogSignature(lastEntry);

    return newSignature === lastSignature;
  }

  /**
   * Process write queue (internal)
   */
  processWriteQueue() {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;
    const { logEntry, logFilePath } = this.writeQueue.shift();

    try {
      // Re-check for duplicates (queue might have changed)
      const isDuplicate = this.lastLogEntry && this.isDuplicateEntry(logEntry, this.lastLogEntry);

      if (isDuplicate) {
        // Skip duplicate (silent)
        this.isWriting = false;
        setImmediate(() => this.processWriteQueue());
        return;
      }

      // Append to log file
      fs.appendFileSync(logFilePath, `${logEntry}\n`, 'utf8');

      // Update cache
      this.lastLogEntry = JSON.parse(logEntry);
    } catch {
      // Fallback to stderr if file write fails (silent - logged via main logger)
    } finally {
      this.isWriting = false;
      // Process next item in queue
      setImmediate(() => this.processWriteQueue());
    }
  }

  /**
   * Log access to file (with queue to prevent race conditions)
   */
  logAccess(req, res, responseTime) {
    const logEntry = this.formatLogEntry(req, res, responseTime);
    const logFilePath = this.getLogFilePath();

    // Add to queue (duplicate check happens in processWriteQueue under mutex)
    this.writeQueue.push({ logEntry, logFilePath });

    // Trigger queue processing
    this.processWriteQueue();
  }

  /**
   * Express middleware for access logging
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Capture response finish event
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.logAccess(req, res, responseTime);
      });

      next();
    };
  }
}

/**
 * Factory function for creating access logger
 */
const createAccessLogger = (logDir = './logs') => new AccessLogger(logDir);

module.exports = { AccessLogger, createAccessLogger };
