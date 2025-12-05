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
   * Get log file path (single unified access.log file)
   */
  getLogFilePath() {
    return path.join(this.logDir, 'access.log');
  }

  /**
   * Extract user info from request
   */
  getUserInfo(req) {
    // Check for admin session or user email
    const sessionToken = req.headers['x-session-token'];
    const editToken = req.headers['x-edit-token'];

    // Try to get user email from session if available
    let userIdentifier = 'anonymous';

    if (req.session && req.session.email) {
      // User is authenticated with email
      userIdentifier = req.session.email;
    } else if (req.user && req.user.email) {
      // Alternative user object
      userIdentifier = req.user.email;
    } else if (sessionToken) {
      // Admin session (no email stored)
      userIdentifier = 'admin';
    } else if (editToken) {
      // Booking editor (no email stored)
      userIdentifier = 'booking_editor';
    }

    return userIdentifier;
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
   * Format log entry in human-readable format
   * Format: [timestamp] IP user METHOD /path STATUS time "User-Agent"
   */
  formatLogEntry(req, res, responseTime) {
    const timestamp = new Date().toISOString();
    const userIdentifier = this.getUserInfo(req);
    const clientIP = this.getClientIP(req);
    const userAgent = req.get('user-agent') || 'unknown';
    const { method } = req;
    const url = req.originalUrl || req.url;
    const { statusCode } = res;

    // Format: [2025-10-09T14:03:42.190Z] 147.231.12.83 prusemic@cvut.cz POST /api/queue/batch 200 21ms "Mozilla/5.0..."
    return `[${timestamp}] ${clientIP} ${userIdentifier} ${method} ${url} ${statusCode} ${responseTime}ms "${userAgent}"`;
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

      return lines[lines.length - 1];
    } catch (error) {
      // Log the error for debugging before returning null
      console.error('[AccessLogger] Failed to read last log entry:', error.message, {
        logFilePath,
      });
      return null;
    }
  }

  /**
   * Generate signature for log entry (for duplicate detection)
   * Extracts stable fields from plain text log entry
   * Format: [timestamp] IP user METHOD /path STATUS time "User-Agent"
   */
  getLogSignature(logEntry) {
    if (!logEntry || typeof logEntry !== 'string') {
      return '';
    }

    // Extract parts between brackets and quotes, split by spaces
    // Example: [2025-10-09T14:03:42.190Z] 147.231.12.83 prusemic@cvut.cz POST /api/queue/batch 200 21ms "Mozilla..."
    const match = logEntry.match(
      /^\[(?<timestamp>.*?)\]\s+(?<ip>\S+)\s+(?<user>\S+)\s+(?<method>\S+)\s+(?<url>\S+)\s+(?<status>\d+)\s+\d+ms\s+"(?<userAgent>.*)"/u
    );

    if (!match) {
      return logEntry; // Fallback to full string comparison
    }

    const { ip, user, method, url, status, userAgent } = match.groups;

    // Signature excludes timestamp and response time
    return `${ip}|${user}|${method}|${url}|${status}|${userAgent}`;
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

      // Update cache (store as plain text string)
      this.lastLogEntry = logEntry;
    } catch (error) {
      // Log the error to stderr so it's not completely silent
      console.error('[AccessLogger] Failed to write log entry:', error.message, { logFilePath });
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
