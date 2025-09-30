# Testing Guide
## Mariánská Chata Reservation System

This document provides comprehensive guidance for testing the booking system application.

## Quick Start

```bash
# Install test dependencies
npm install

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test suite
npm run test:backend    # Backend API tests
npm run test:unit       # Unit tests (business logic)
npm run test:frontend   # Frontend component tests
npm run test:integration # E2E integration tests

# Watch mode for development
npm run test:watch
```

## Test Structure Overview

```
tests/
├── backend/           # Backend API and database tests
│   ├── api.test.js   # API endpoint tests
│   └── database.test.js # SQLite operations
│
├── unit/              # Unit tests for business logic
│   ├── dataManager.test.js # DataManager class
│   ├── pricing.test.js # Price calculations
│   ├── availability.test.js # Room availability
│   └── validation.test.js # Input validation
│
├── frontend/          # Frontend component tests
│   ├── calendar.test.js # Calendar rendering
│   ├── booking-form.test.js # Form validation
│   └── modals.test.js # Modal interactions
│
├── integration/       # End-to-end tests
│   ├── booking-flow.test.js # Complete booking process
│   └── admin-operations.test.js # Admin panel
│
├── helpers/           # Test utilities
│   ├── setup.js      # Global setup
│   ├── mocks.js      # Mock data & functions
│   └── assertions.js # Custom matchers
│
└── fixtures/          # Test data
    ├── bookings.json # Sample bookings
    └── settings.json # Test settings
```

## Test Coverage Goals

| Component | Target Coverage | Current Status |
|-----------|----------------|----------------|
| Backend API | 90%+ | ⚠️ Pending |
| Business Logic | 95%+ | ⚠️ Pending |
| Frontend Components | 80%+ | ⚠️ Pending |
| Integration Flows | 100% critical paths | ⚠️ Pending |

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test File
```bash
npm test -- tests/unit/validation.test.js
```

### Tests Matching Pattern
```bash
npm test -- -t "booking creation"
```

### With Verbose Output
```bash
npm run test:verbose
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

Coverage report will be generated in `coverage/` directory. Open `coverage/lcov-report/index.html` in browser to view detailed report.

## Test Environment

Tests run with the following environment:
- **Node.js**: Test environment
- **Database**: In-memory SQLite (`:memory:`)
- **Port**: 3001 (separate from dev server)
- **API Key**: `test-api-key-123`
- **Admin Password**: `test-admin-pass`

Environment variables are set automatically in `tests/helpers/setup.js`.

## Writing Tests

### Test Structure Template

```javascript
describe('ComponentName', () => {
  // Setup before each test
  beforeEach(() => {
    // Initialize test data
    // Reset mocks
  });

  // Cleanup after each test
  afterEach(() => {
    // Clean up resources
  });

  describe('methodName', () => {
    it('should do expected behavior', () => {
      // Arrange - Set up test data
      const input = { ... };

      // Act - Execute the code under test
      const result = component.method(input);

      // Assert - Verify the result
      expect(result).toBe(expected);
    });
  });
});
```

### Using Test Utilities

```javascript
// Generate test dates
const futureDate = testUtils.getTestDate(10); // 10 days from now
const dateRange = testUtils.getDateRange(10, 15); // 10-15 days from now

// Sleep in async tests
await testUtils.sleep(100); // Wait 100ms

// Generate random data
const email = testUtils.randomEmail();
const string = testUtils.randomString(10);

// Mock fetch response
global.fetch = jest.fn(() => testUtils.mockFetchResponse(data));
```

### Custom Matchers

```javascript
// Validate booking ID format
expect(bookingId).toBeValidBookingId();

// Validate edit token
expect(token).toBeValidEditToken();

// Validate date
expect(dateString).toBeValidDate();

// Validate availability status
expect(status).toBeAvailableStatus();
```

### Using Mocks

```javascript
const { MockDataManager, sampleBooking, sampleSettings } = require('./helpers/mocks');

// Mock DataManager
const dataManager = new MockDataManager();

// Use sample data
const booking = { ...sampleBooking };
booking.name = 'Test User';

// Mock localStorage
global.localStorage = new MockLocalStorage();

// Mock DOM element
const element = createMockElement('div');
```

## Test Categories

### 1. Backend API Tests (`tests/backend/`)

**Purpose**: Test Express API endpoints and database operations

**Key Areas**:
- Health check endpoint
- Booking CRUD operations
- Admin authentication
- Rate limiting
- Christmas period logic
- Proposed bookings

**Example**:
```javascript
describe('POST /api/booking', () => {
  it('should create booking with valid data', () => {
    const booking = db.createBooking({
      name: 'Jan Novák',
      email: 'jan@example.com',
      // ... other fields
    });

    expect(booking.id).toBeValidBookingId();
    expect(booking.edit_token).toBeValidEditToken();
  });
});
```

### 2. Unit Tests (`tests/unit/`)

**Purpose**: Test business logic in isolation

**Key Areas**:
- Price calculation
- Room availability checking
- Christmas period detection
- Date formatting
- ID generation
- Email validation

**Example**:
```javascript
describe('Price Calculation', () => {
  it('should calculate ÚTIA price correctly', () => {
    const price = dataManager.calculatePrice('utia', 2, 1, 0, 2, 1);
    // (300 + 50 + 25) * 2 = 750
    expect(price).toBe(750);
  });
});
```

### 3. Frontend Component Tests (`tests/frontend/`)

**Purpose**: Test UI components and interactions

**Key Areas**:
- Calendar rendering
- Form validation
- Modal behavior
- Event handling
- State management

**Example**:
```javascript
describe('Email Validation', () => {
  it('should validate correct email format', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

### 4. Integration Tests (`tests/integration/`)

**Purpose**: Test complete user flows end-to-end

**Key Areas**:
- Complete booking flow
- Multi-room bookings
- Bulk bookings
- Admin operations
- Error handling

**Example**:
```javascript
describe('Complete Booking Flow', () => {
  it('should complete full booking process', async () => {
    // Navigate to homepage
    // Click room in calendar
    // Select dates
    // Fill form
    // Submit booking
    // Verify success
  });
});
```

## Testing Best Practices

### 1. Test Independence
```javascript
// Good ✅
beforeEach(() => {
  dataManager = new MockDataManager();
  // Fresh instance for each test
});

// Bad ❌
const dataManager = new MockDataManager();
// Shared state between tests
```

### 2. Clear Test Names
```javascript
// Good ✅
it('should reject booking with end date before start date', () => {});

// Bad ❌
it('works', () => {});
```

### 3. One Assertion Per Concept
```javascript
// Good ✅
it('should create booking with generated ID', () => {
  const booking = createBooking(data);
  expect(booking.id).toBeValidBookingId();
});

it('should create booking with edit token', () => {
  const booking = createBooking(data);
  expect(booking.edit_token).toBeValidEditToken();
});

// Bad ❌
it('should create booking', () => {
  const booking = createBooking(data);
  expect(booking.id).toBeValidBookingId();
  expect(booking.edit_token).toBeValidEditToken();
  expect(booking.name).toBe('Test');
  // Too many unrelated assertions
});
```

### 4. Use Meaningful Test Data
```javascript
// Good ✅
const booking = {
  name: 'Jan Novák',
  email: 'jan@example.com',
  // Realistic test data
};

// Bad ❌
const booking = {
  name: 'test',
  email: 'test@test.com',
  // Generic data
};
```

### 5. Test Edge Cases
```javascript
describe('Guest Count Validation', () => {
  it('should handle minimum (1 adult)', () => { ... });
  it('should handle maximum (room capacity)', () => { ... });
  it('should reject zero adults', () => { ... });
  it('should reject negative counts', () => { ... });
  it('should allow toddlers without counting', () => { ... });
});
```

## Common Testing Patterns

### Testing Async Functions
```javascript
it('should create booking asynchronously', async () => {
  const booking = await dataManager.createBooking(data);
  expect(booking).toBeDefined();
});
```

### Testing Errors
```javascript
it('should throw error for invalid input', () => {
  expect(() => {
    calculatePrice('invalid-type', -1, 0, 0, 1, 1);
  }).toThrow();
});
```

### Testing Dates
```javascript
it('should detect Christmas period', () => {
  const christmasDate = '2024-12-25';
  const period = { start_date: '2024-12-23', end_date: '2025-01-02' };

  const isChristmas = christmasDate >= period.start_date &&
                     christmasDate <= period.end_date;

  expect(isChristmas).toBe(true);
});
```

### Testing Array Operations
```javascript
it('should filter bookings by date range', () => {
  const bookings = getAllBookings();
  const filtered = bookings.filter(b =>
    b.startDate >= '2025-06-01' && b.endDate <= '2025-06-30'
  );

  expect(filtered.length).toBeGreaterThan(0);
  expect(filtered.every(b => b.startDate >= '2025-06-01')).toBe(true);
});
```

## Debugging Tests

### Running Single Test
```bash
npm test -- -t "should calculate price correctly"
```

### Using Node Inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

### Adding Debug Logs
```javascript
it('should do something', () => {
  console.log('Debug info:', data);
  const result = doSomething(data);
  console.log('Result:', result);
  expect(result).toBe(expected);
});
```

### Using Jest Snapshots
```javascript
it('should render correctly', () => {
  const output = render(component);
  expect(output).toMatchSnapshot();
});
```

## Continuous Integration

Tests run automatically on:
- Every commit to feature branches
- Pull requests to main
- Scheduled nightly builds

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Troubleshooting

### Database Locked Error
```javascript
// Solution: Use in-memory database
process.env.DB_PATH = ':memory:';
```

### Timeout Errors
```javascript
// Solution: Increase timeout for slow tests
jest.setTimeout(10000); // 10 seconds
```

### Mock Not Working
```javascript
// Solution: Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Port Already in Use
```javascript
// Solution: Use different port for tests
process.env.PORT = 3001; // Not 3000
```

## Test Maintenance

### When to Update Tests
- After adding new features
- After fixing bugs
- When refactoring code
- When changing business rules

### Keeping Tests Fast
- Use in-memory database
- Mock external dependencies
- Avoid unnecessary waits
- Run tests in parallel

### Test Code Quality
- Follow same coding standards as production code
- Keep tests DRY (Don't Repeat Yourself)
- Use descriptive variable names
- Add comments for complex test logic

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

## Support

For questions or issues with tests:
1. Check this documentation
2. Review existing tests for examples
3. Check test output and error messages
4. Ask in team chat or create an issue

---

**Last Updated**: 2025-06-01
**Maintained By**: Development Team