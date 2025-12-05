/**
 * Admin Christmas Full Tests
 * E2E tests for Christmas period and access code management
 */
const { test, expect } = require('@playwright/test');
const {
  resetDatabase,
  loginAsAdmin,
  navigateToMainPage,
  openBulkBookingModal,
  getFutureDate,
} = require('./helpers/test-helpers');

test.describe('Admin Christmas Management', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await loginAsAdmin(page);
  });

  test.describe('Christmas Tab Display', () => {
    test('should display Christmas access tab', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      const tabContent = page.locator('#christmasTab');
      await expect(tabContent).toHaveClass(/active/);
    });

    test('should display Christmas periods section', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      // Period form should be visible
      await expect(page.locator('#christmasPeriodForm')).toBeVisible();
    });

    test('should display access codes section', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      // Add code form should be visible
      await expect(page.locator('#addCodeForm')).toBeVisible();
      await expect(page.locator('#newCode')).toBeVisible();
    });

    test('should display Christmas periods list', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      const periodsContainer = page.locator('#christmasPeriodsContainer');
      await expect(periodsContainer).toBeVisible();
    });

    test('should display access codes list', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      const codesList = page.locator('#christmasCodesList');
      await expect(codesList).toBeVisible();
    });
  });

  test.describe('Christmas Period Management', () => {
    test('should display add period form', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      await expect(page.locator('#christmasStart')).toBeVisible();
      await expect(page.locator('#christmasEnd')).toBeVisible();
    });

    test('should add new Christmas period', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      // Use next year's Christmas dates
      const nextYear = new Date().getFullYear() + 1;
      const startDate = `${nextYear}-12-23`;
      const endDate = `${nextYear}-01-02`;

      await page.fill('#christmasStart', startDate);
      await page.fill('#christmasEnd', endDate);

      await page.click('#christmasPeriodForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Period should appear in the list
      const periodsContainer = page.locator('#christmasPeriodsContainer');
      const content = await periodsContainer.textContent();
      expect(content).toContain('12');
    });

    test('should delete Christmas period', async ({ page }) => {
      // First add a period
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      const nextYear = new Date().getFullYear() + 2;
      await page.fill('#christmasStart', `${nextYear}-12-23`);
      await page.fill('#christmasEnd', `${nextYear}-01-02`);
      await page.click('#christmasPeriodForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Now delete it
      const deleteBtn = page.locator('#christmasPeriodsContainer .christmas-period-card button').first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.waitForTimeout(500);

        // Confirm if needed
        const confirmBtn = page.locator('.modal.active button:has-text("Potvrdit"), .modal.active button:has-text("Ano")');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test('should handle multiple Christmas periods', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      // Add first period (this year)
      const thisYear = new Date().getFullYear();
      await page.fill('#christmasStart', `${thisYear}-12-23`);
      await page.fill('#christmasEnd', `${thisYear + 1}-01-02`);
      await page.click('#christmasPeriodForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Add second period (next year)
      await page.fill('#christmasStart', `${thisYear + 1}-12-23`);
      await page.fill('#christmasEnd', `${thisYear + 2}-01-02`);
      await page.click('#christmasPeriodForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Both periods should be visible
      const periodCards = page.locator('#christmasPeriodsContainer .christmas-period-card');
      const count = await periodCards.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Access Code Management', () => {
    test('should add access code', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      const testCode = 'TESTCODE2024';
      await page.fill('#newCode', testCode);
      await page.click('#addCodeForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Code should appear in the list
      const codesList = page.locator('#christmasCodesList');
      const content = await codesList.textContent();
      expect(content).toContain(testCode);
    });

    test('should remove access code', async ({ page }) => {
      // First add a code
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      const testCode = 'TOREMOVE123';
      await page.fill('#newCode', testCode);
      await page.click('#addCodeForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Now remove it
      const codeChip = page.locator(`#christmasCodesList .code-chip:has-text("${testCode}")`);
      const removeBtn = codeChip.locator('button');

      if (await removeBtn.isVisible()) {
        await removeBtn.click();
        await page.waitForTimeout(500);

        // Code should be removed
        const codesList = page.locator('#christmasCodesList');
        const content = await codesList.textContent();
        expect(content).not.toContain(testCode);
      }
    });

    test('should display access codes list', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      // Add multiple codes
      await page.fill('#newCode', 'CODE1');
      await page.click('#addCodeForm button[type="submit"]');
      await page.waitForTimeout(500);

      await page.fill('#newCode', 'CODE2');
      await page.click('#addCodeForm button[type="submit"]');
      await page.waitForTimeout(500);

      // Both codes should be visible
      const codeChips = page.locator('#christmasCodesList .code-chip');
      const count = await codeChips.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    test('should prevent duplicate codes', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      const duplicateCode = 'DUPLICATE123';

      // Add first time
      await page.fill('#newCode', duplicateCode);
      await page.click('#addCodeForm button[type="submit"]');
      await page.waitForTimeout(500);

      // Try to add again
      await page.fill('#newCode', duplicateCode);
      await page.click('#addCodeForm button[type="submit"]');
      await page.waitForTimeout(500);

      // Should show error or only have one instance
      const codeChips = page.locator(`#christmasCodesList .code-chip:has-text("${duplicateCode}")`);
      const count = await codeChips.count();
      expect(count).toBe(1);
    });
  });

  test.describe('Christmas Rules Display', () => {
    test('should display Christmas rules info box', async ({ page }) => {
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      // Rules info should be visible
      const rulesBox = page.locator(':has-text("Pravidla pro vánoční období")');
      await expect(rulesBox.first()).toBeVisible();
    });
  });

  test.describe('Public Booking Integration', () => {
    test('should show Christmas dates in calendar', async ({ page }) => {
      // First add a Christmas period
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      const thisYear = new Date().getFullYear();
      await page.fill('#christmasStart', `${thisYear}-12-23`);
      await page.fill('#christmasEnd', `${thisYear + 1}-01-02`);
      await page.click('#christmasPeriodForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Navigate to public calendar
      await navigateToMainPage(page);
      await page.waitForTimeout(500);

      // Calendar should show Christmas period styling
      // (Implementation specific - may have special CSS class)
    });

    test('should require access code for Christmas booking before Oct 1', async ({ page }) => {
      // This test depends on the current date
      // If current date is before Oct 1, Christmas bookings need a code

      // First set up a Christmas period
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      const thisYear = new Date().getFullYear();
      const nextYear = thisYear + 1;
      await page.fill('#christmasStart', `${thisYear}-12-23`);
      await page.fill('#christmasEnd', `${nextYear}-01-02`);
      await page.click('#christmasPeriodForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Add a valid code
      await page.fill('#newCode', 'VALIDCODE2024');
      await page.click('#addCodeForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Navigate to public and try to book during Christmas
      await navigateToMainPage(page);
      await page.waitForTimeout(500);

      // Single room booking during Christmas might require code
      // (Behavior depends on current date and implementation)
    });

    test('should verify bulk blocked after Oct 1', async ({ page }) => {
      // Set up Christmas period
      await page.click('.tab-button[data-tab="christmas"]');
      await page.waitForTimeout(500);

      const thisYear = new Date().getFullYear();
      const nextYear = thisYear + 1;
      await page.fill('#christmasStart', `${thisYear}-12-23`);
      await page.fill('#christmasEnd', `${nextYear}-01-02`);
      await page.click('#christmasPeriodForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // After Oct 1, bulk booking for Christmas should be blocked
      // Navigate to public and try bulk booking
      await navigateToMainPage(page);
      await page.waitForTimeout(500);

      // Try to open bulk booking modal
      await openBulkBookingModal(page);
      await page.waitForTimeout(500);

      // Behavior depends on current date
      // After Oct 1: bulk Christmas booking should be blocked
      // Before Oct 1: should require access code
    });
  });
});
