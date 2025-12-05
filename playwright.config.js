const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for Chata Mariánská E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Sequential - SQLite doesn't support parallel writes
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1, // Single worker for SQLite
  timeout: 15000, // 15 second timeout per test
  expect: {
    timeout: 3000, // 3 second timeout for expect assertions
  },
  reporter: 'list', // Console only, no HTML report
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off', // Disable tracing for speed
    screenshot: 'off', // Disable screenshots for speed
    video: 'off', // Disable video for speed
    actionTimeout: 5000, // 5 second timeout for actions
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to enable additional browsers (requires: npx playwright install)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Run development server before tests
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
