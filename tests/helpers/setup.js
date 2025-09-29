// Test environment setup
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = 3001;
process.env.DB_PATH = ':memory:'; // Use in-memory SQLite for tests
process.env.API_KEY = 'test-api-key-123';
process.env.ADMIN_PASSWORD = 'test-admin-pass';

// Extend Jest matchers
expect.extend({
  toBeValidDate(received) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime());
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid date`
          : `Expected ${received} to be a valid date`,
    };
  },

  toBeValidBookingId(received) {
    const pass = /^BK[A-Z0-9]{13}$/.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid booking ID`
          : `Expected ${received} to be a valid booking ID (format: BK + 13 alphanumeric)`,
    };
  },

  toBeValidEditToken(received) {
    const pass = typeof received === 'string' && received.length === 30;
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid edit token`
          : `Expected ${received} to be a valid edit token (30 characters)`,
    };
  },

  toBeAvailableStatus(received) {
    const validStatuses = ['available', 'booked', 'blocked', 'proposed'];
    const pass = validStatuses.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid availability status`
          : `Expected ${received} to be one of: ${validStatuses.join(', ')}`,
    };
  },
});

// Global test utilities
global.testUtils = {
  // Generate test date in YYYY-MM-DD format
  getTestDate(daysOffset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  },

  // Generate date range
  getDateRange(startOffset, endOffset) {
    return {
      startDate: this.getTestDate(startOffset),
      endDate: this.getTestDate(endOffset),
    };
  },

  // Sleep utility for async tests
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  // Mock fetch response
  mockFetchResponse(data, ok = true, status = 200) {
    return Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    });
  },

  // Generate random string
  randomString(length = 10) {
    return Math.random()
      .toString(36)
      .substring(2, length + 2);
  },

  // Generate random email
  randomEmail() {
    return `test${this.randomString(8)}@example.com`;
  },
};

// Suppress console output during tests (optional)
if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Cleanup after all tests
afterAll(() => {
  // Clean up any open connections, timers, etc.
});
