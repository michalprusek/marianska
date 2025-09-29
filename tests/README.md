# Test Suite Documentation
## Mariánská Chata Reservation System

This directory contains comprehensive tests for the entire booking system.

## Test Structure

```
tests/
├── backend/           # Backend API and database tests
│   ├── api.test.js           # API endpoint tests
│   ├── database.test.js      # SQLite database tests
│   └── auth.test.js          # Authentication tests
│
├── unit/              # Unit tests for business logic
│   ├── dataManager.test.js   # DataManager class tests
│   ├── pricing.test.js       # Price calculation tests
│   ├── availability.test.js  # Room availability tests
│   └── validation.test.js    # Validation utilities tests
│
├── frontend/          # Frontend component tests
│   ├── calendar.test.js      # Calendar rendering tests
│   ├── booking-form.test.js  # Form validation tests
│   ├── modals.test.js        # Modal interactions tests
│   └── utils.test.js         # Utility functions tests
│
├── integration/       # End-to-end integration tests
│   ├── booking-flow.test.js  # Complete booking process
│   ├── admin-operations.test.js # Admin panel operations
│   └── multi-room.test.js    # Multi-room bookings
│
├── fixtures/          # Test data
│   ├── bookings.json         # Sample bookings
│   ├── settings.json         # Test settings
│   └── users.json            # Test users
│
└── helpers/           # Test utilities
    ├── setup.js              # Test environment setup
    ├── mocks.js              # Mock functions
    └── assertions.js         # Custom assertions
```

## Test Framework

- **Backend**: Jest for Node.js tests
- **Frontend**: Jest + Testing Library
- **E2E**: Playwright for browser automation
- **Coverage**: NYC/Istanbul for code coverage

## Running Tests

```bash
# Install test dependencies
npm install --save-dev jest @testing-library/dom @testing-library/jest-dom playwright

# Run all tests
npm test

# Run specific test suite
npm run test:backend
npm run test:unit
npm run test:frontend
npm run test:integration

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Test Coverage Goals

- **Backend API**: 90%+ coverage
- **Business Logic**: 95%+ coverage
- **Frontend Components**: 80%+ coverage
- **Integration Flows**: 100% critical paths

## Writing Tests

### Test Structure
```javascript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('methodName', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = {...};

      // Act
      const result = component.method(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

## Test Priorities

### High Priority (Must Pass)
- Booking creation/update/delete
- Payment calculation
- Room availability checking
- Authentication and authorization
- Date conflict detection

### Medium Priority (Should Pass)
- Form validation
- Calendar rendering
- Admin operations
- Email notifications
- Statistics calculation

### Low Priority (Nice to Have)
- UI animations
- Notification styling
- Language switching
- Export/import operations

## Continuous Integration

Tests run automatically on:
- Every commit to feature branches
- Pull requests to main
- Scheduled nightly builds

## Debugging Tests

```bash
# Run specific test file
npm test -- backend/api.test.js

# Run test with specific pattern
npm test -- -t "booking creation"

# Debug with node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Verbose output
npm test -- --verbose
```

## Mock Data

Test fixtures are located in `tests/fixtures/`. Use these for consistent test data:

```javascript
const { sampleBookings, testSettings } = require('./fixtures');
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Clarity**: Test names should describe expected behavior
3. **Coverage**: Test both happy path and edge cases
4. **Performance**: Keep tests fast (< 5s for unit tests)
5. **Maintainability**: Update tests when features change

## Troubleshooting

### Database Locked
```javascript
// Use separate test database
process.env.DB_PATH = ':memory:';
```

### Async Timeout
```javascript
// Increase timeout for slow tests
jest.setTimeout(10000);
```

### Mock Issues
```javascript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```