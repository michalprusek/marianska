# Test Suite Installation Guide

## Mariánská Chata Reservation System

This guide will help you install and set up the comprehensive test suite for the booking system.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git (for version control)
- Basic understanding of JavaScript and testing concepts

## Step 1: Install Dependencies

### Install All Dependencies

```bash
npm install
```

This will install both production and development dependencies including:

- `jest` - Test framework
- `@testing-library/dom` - DOM testing utilities
- `@playwright/test` - E2E browser testing
- `supertest` - HTTP API testing

### Verify Installation

```bash
npm list jest
npm list playwright
```

You should see version numbers without errors.

## Step 2: Verify Test Infrastructure

### Check Jest Configuration

```bash
cat jest.config.js
```

Should display Jest configuration with:

- Test environment: node
- Coverage configuration
- Test file patterns

### Check Test Directory Structure

```bash
ls -la tests/
```

Should show:

- `backend/` - Backend tests
- `unit/` - Unit tests
- `frontend/` - Frontend tests
- `integration/` - Integration tests
- `helpers/` - Test utilities
- `fixtures/` - Test data (if exists)

## Step 3: Run First Test

### Run All Tests

```bash
npm test
```

Expected output:

```
PASS  tests/unit/validation.test.js
PASS  tests/unit/dataManager.test.js
PASS  tests/backend/api.test.js
PASS  tests/integration/booking-flow.test.js

Test Suites: 4 passed, 4 total
Tests:       XX passed, XX total
Snapshots:   0 total
Time:        X.XXXs
```

### Run with Coverage

```bash
npm run test:coverage
```

Expected output:

```
---------|---------|----------|---------|---------|
File     | % Stmts | % Branch | % Funcs | % Lines |
---------|---------|----------|---------|---------|
All files|   XX.XX |    XX.XX |   XX.XX |   XX.XX |
...
```

Coverage report will be in `coverage/lcov-report/index.html`.

## Step 4: Configure Test Environment

### Create .env.test File (Optional)

```bash
# tests/.env.test
NODE_ENV=test
DB_PATH=:memory:
PORT=3001
API_KEY=test-api-key-123
ADMIN_PASSWORD=test-admin-pass
SILENT_TESTS=false
```

### Set Environment Variables

Environment variables are automatically set in `tests/helpers/setup.js`, but you can override them:

```bash
export NODE_ENV=test
export DB_PATH=:memory:
```

## Step 5: Run Specific Test Suites

### Backend API Tests

```bash
npm run test:backend
```

### Unit Tests (Business Logic)

```bash
npm run test:unit
```

### Frontend Component Tests

```bash
npm run test:frontend
```

### Integration Tests (E2E)

```bash
npm run test:integration
```

### All Tests Sequentially

```bash
npm run test:all
```

## Step 6: Development Workflow

### Watch Mode for Development

```bash
npm run test:watch
```

This will:

- Run tests on file changes
- Show coverage in terminal
- Allow interactive test selection

### Run Specific Test File

```bash
npm test -- tests/unit/validation.test.js
```

### Run Tests Matching Pattern

```bash
npm test -- -t "booking creation"
```

### Run with Verbose Output

```bash
npm run test:verbose
```

## Troubleshooting

### Issue: "jest: command not found"

**Solution**: Install dependencies

```bash
npm install
```

### Issue: "Cannot find module 'jest'"

**Solution**: Clear node_modules and reinstall

```bash
rm -rf node_modules
npm install
```

### Issue: "Database is locked"

**Solution**: Use in-memory database (already configured)

```javascript
// In tests/helpers/setup.js
process.env.DB_PATH = ':memory:';
```

### Issue: "Port 3000 already in use"

**Solution**: Tests use port 3001 by default

```javascript
// In tests/helpers/setup.js
process.env.PORT = 3001;
```

### Issue: Tests timeout

**Solution**: Increase timeout in jest.config.js

```javascript
module.exports = {
  testTimeout: 10000, // 10 seconds
};
```

### Issue: Coverage not generating

**Solution**: Check jest.config.js has coverage enabled

```javascript
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
};
```

## Verifying Setup

### 1. Check Test Scripts

```bash
npm run | grep test
```

Should show:

```
test
test:watch
test:coverage
test:backend
test:unit
test:frontend
test:integration
test:all
test:verbose
```

### 2. Check Jest Version

```bash
npx jest --version
```

Should show: `29.x.x` or higher

### 3. Check Playwright Version

```bash
npx playwright --version
```

Should show: `1.x.x` or higher

### 4. Run Minimal Test

Create `tests/minimal.test.js`:

```javascript
describe('Minimal Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run:

```bash
npm test -- tests/minimal.test.js
```

Should pass ✅

### 5. Check Coverage Report

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

Should open HTML coverage report in browser.

## Next Steps

After successful installation:

1. **Read Testing Guide**: See `TESTING.md` for comprehensive testing documentation
2. **Review Existing Tests**: Explore `tests/` directory
3. **Run All Tests**: `npm test` to ensure everything works
4. **Write New Tests**: Follow patterns in existing tests
5. **Set Up CI/CD**: Configure GitHub Actions or similar

## Common Commands Reference

| Command                          | Description                      |
| -------------------------------- | -------------------------------- |
| `npm test`                       | Run all tests                    |
| `npm run test:watch`             | Run tests in watch mode          |
| `npm run test:coverage`          | Generate coverage report         |
| `npm run test:backend`           | Run backend tests only           |
| `npm run test:unit`              | Run unit tests only              |
| `npm run test:frontend`          | Run frontend tests only          |
| `npm run test:integration`       | Run integration tests only       |
| `npm run test:all`               | Run all test suites sequentially |
| `npm run test:verbose`           | Run with verbose output          |
| `npm test -- -t "pattern"`       | Run tests matching pattern       |
| `npm test -- tests/file.test.js` | Run specific test file           |

## IDE Integration

### Visual Studio Code

Install extensions:

- **Jest** by Orta
- **Jest Runner** by firsttris

Configuration (`.vscode/settings.json`):

```json
{
  "jest.autoRun": "off",
  "jest.showCoverageOnLoad": true,
  "jest.testExplorer.enabled": true
}
```

### WebStorm/IntelliJ

1. Right-click test file
2. Select "Run" or "Debug"
3. Built-in Jest integration works automatically

### Vim/Neovim

Install plugin:

- **vim-test** or **nvim-dap**

Add to config:

```vim
let test#javascript#runner = 'jest'
```

## Performance Tips

### Speed Up Tests

1. **Run in parallel** (default in Jest)
2. **Use in-memory database** (already configured)
3. **Mock external dependencies**
4. **Skip integration tests during development**:
   ```bash
   npm run test:unit -- --watch
   ```

### Reduce Noise

Set `SILENT_TESTS=true` in environment to suppress console logs during tests.

## Additional Resources

- [Jest CLI Options](https://jestjs.io/docs/cli)
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [Playwright Setup](https://playwright.dev/docs/intro)
- [Testing Best Practices](https://testingjavascript.com/)

## Getting Help

If you encounter issues:

1. Check this installation guide
2. Review `TESTING.md` documentation
3. Check Jest/Playwright documentation
4. Search for error messages online
5. Ask team members
6. Create an issue in the repository

---

**Setup Complete!** 🎉

You're now ready to write and run tests for the Mariánská Chata booking system.
