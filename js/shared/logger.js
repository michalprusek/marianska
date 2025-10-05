/**
 * Simple Structured Logger for Marianska Booking System
 * Provides log levels and structured logging without external dependencies
 */

/* eslint-disable no-underscore-dangle -- Private methods use underscore prefix by convention */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

class Logger {
  constructor(component = 'App', level = 'INFO') {
    this.component = component;
    this.level = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    this.isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  }

  _shouldLog(level) {
    return LOG_LEVELS[level] <= this.level;
  }

  _formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      component: this.component,
      message,
      ...data,
    };

    if (this.isNode) {
      // Server-side: JSON format for log aggregation
      return JSON.stringify(logEntry);
    }
    // Client-side: Readable format
    const dataStr = Object.keys(data).length > 0 ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${this.component}] ${message}${dataStr}`;
  }

  _log(level, message, data = {}) {
    if (!this._shouldLog(level)) {
      return;
    }

    const formatted = this._formatMessage(level, message, data);

    switch (level) {
      case 'ERROR':
        console.error(formatted);
        break;
      case 'WARN':
        console.warn(formatted);
        break;
      case 'INFO':
        console.info(formatted);
        break;
      case 'DEBUG':
        // eslint-disable-next-line no-console -- Console is intended for logging
        console.debug(formatted);
        break;
      default:
        // eslint-disable-next-line no-console -- Console is intended for logging
        console.log(formatted);
    }
  }

  error(message, data = {}) {
    this._log('ERROR', message, data);
  }

  warn(message, data = {}) {
    this._log('WARN', message, data);
  }

  info(message, data = {}) {
    this._log('INFO', message, data);
  }

  debug(message, data = {}) {
    this._log('DEBUG', message, data);
  }

  // Helper method to log errors with stack traces
  logError(error, context = {}) {
    const errorData = {
      ...context,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };

    // Include custom error properties
    if (error.field) {
      errorData.field = error.field;
    }
    if (error.statusCode) {
      errorData.statusCode = error.statusCode;
    }
    if (error.conflictData) {
      errorData.conflictData = error.conflictData;
    }

    this.error(error.message, errorData);
  }
}

/**
 * Factory function for creating loggers
 * @param {string} component - Component name
 * @param {string} level - Log level
 * @returns {Logger} Logger instance
 */
const createLogger = (component, level = process.env.LOG_LEVEL || 'INFO') =>
  new Logger(component, level);

// Export for Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Logger, createLogger, LOG_LEVELS };
}

// Export for browser
if (typeof window !== 'undefined') {
  window.Logger = Logger;
  window.createLogger = createLogger;
}
/* eslint-enable no-underscore-dangle */
