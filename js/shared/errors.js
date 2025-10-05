/**
 * Custom Error Classes for Marianska Booking System
 * Provides structured error handling with HTTP status codes
 */

class BookingError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'BookingError';
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
  }
}

class ValidationError extends BookingError {
  constructor(field, message) {
    super(message, 400);
    this.name = 'ValidationError';
    this.field = field;
  }
}

class AuthenticationError extends BookingError {
  constructor(message = 'Neautorizovaný přístup') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends BookingError {
  constructor(message = 'Nedostatečná oprávnění') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends BookingError {
  constructor(resource, id = null) {
    const message = id ? `${resource} s ID ${id} nebyla nalezena` : `${resource} nenalezen(a)`;
    super(message, 404);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.resourceId = id;
  }
}

class ConflictError extends BookingError {
  constructor(message, conflictData = null) {
    super(message, 409);
    this.name = 'ConflictError';
    this.conflictData = conflictData;
  }
}

class SessionExpiredError extends AuthenticationError {
  constructor(message = 'Session vypršela - přihlaste se znovu') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

class RateLimitError extends BookingError {
  constructor(message = 'Příliš mnoho požadavků. Zkuste to prosím později.') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

class DatabaseError extends BookingError {
  constructor(message, originalError = null) {
    super(message, 500);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

// Export for Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BookingError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    SessionExpiredError,
    RateLimitError,
    DatabaseError,
  };
}

// Export for browser (if needed)
if (typeof window !== 'undefined') {
  window.BookingErrors = {
    BookingError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    SessionExpiredError,
    RateLimitError,
    DatabaseError,
  };
}
