/**
 * Custom Modal Dialog Tests - Admin Panel
 * Tests that custom styled modals appear in admin panel edit mode
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = 'https://localhost';
const ADMIN_PASSWORD = 'admin123';

test.use({ ignoreHTTPSErrors: true });

test.describe('Custom Modal Dialogs in Admin Panel', () => {
  test('should load ModalDialog.js script before EditBookingComponent', async ({ page }) => {
    // Navigate to admin panel
    await page.goto(`${BASE_URL}/admin.html`);

    // Login
    await page.fill('#adminPassword', ADMIN_PASSWORD);
    await page.click('button:has-text("Přihlásit")');

    // Wait for login
    await page.waitForSelector('text=Vítejte v admin panelu', { timeout: 10000 });

    // Check if modalDialog is available globally
    const modalDialogExists = await page.evaluate(() => {
      return typeof window.modalDialog !== 'undefined';
    });

    expect(modalDialogExists).toBeTruthy();

    // Check if modalDialog has required methods
    const hasConfirmMethod = await page.evaluate(() => {
      return typeof window.modalDialog.confirm === 'function';
    });

    const hasAlertMethod = await page.evaluate(() => {
      return typeof window.modalDialog.alert === 'function';
    });

    expect(hasConfirmMethod).toBeTruthy();
    expect(hasAlertMethod).toBeTruthy();
  });

  test('should show custom modal when testing modal dialog', async ({ page }) => {
    // Navigate to admin panel
    await page.goto(`${BASE_URL}/admin.html`);

    // Login
    await page.fill('#adminPassword', ADMIN_PASSWORD);
    await page.click('button:has-text("Přihlásit")');
    await page.waitForSelector('text=Vítejte v admin panelu', { timeout: 10000 });

    // Inject a test modal
    await page.evaluate(async () => {
      // Trigger a test confirmation modal
      window.testModalResult = await window.modalDialog.confirm({
        title: 'Test Modal',
        icon: '🧪',
        type: 'warning',
        message: 'This is a test modal dialog',
        details: [
          { label: 'Test Field 1', value: 'Value 1' },
          { label: 'Test Field 2', value: 'Value 2' },
        ],
        confirmText: 'Potvrdit',
        cancelText: 'Zrušit',
      });
    });

    // Wait for modal to appear
    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 2000 });

    // Verify it's a custom modal (not native)
    const modalDialog = page.locator('.modal-dialog');
    await expect(modalDialog).toBeVisible();

    // Verify modal has custom styling
    const bgColor = await modalDialog.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(bgColor).toContain('255, 255, 255'); // White background

    // Verify header with icon and title
    const header = page.locator('.modal-dialog h3');
    await expect(header).toContainText('Test Modal');
    await expect(header).toContainText('🧪');

    // Verify message content
    const message = page.locator('.modal-dialog p');
    await expect(message).toContainText('This is a test modal dialog');

    // Verify details section
    const details = page.locator('.modal-dialog');
    await expect(details).toContainText('Test Field 1');
    await expect(details).toContainText('Value 1');

    // Verify buttons
    const confirmBtn = page.locator('.modal-confirm-btn');
    const cancelBtn = page.locator('.modal-cancel-btn');

    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toContainText('Potvrdit');
    await expect(cancelBtn).toBeVisible();
    await expect(cancelBtn).toContainText('Zrušit');

    // Test cancel button
    await cancelBtn.click();

    // Modal should disappear
    await expect(modalBackdrop).not.toBeVisible({ timeout: 1000 });

    // Verify result was false (cancelled)
    const result = await page.evaluate(() => window.testModalResult);
    expect(result).toBe(false);
  });

  test('should support ESC key to close modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin.html`);
    await page.fill('#adminPassword', ADMIN_PASSWORD);
    await page.click('button:has-text("Přihlásit")');
    await page.waitForSelector('text=Vítejte v admin panelu', { timeout: 10000 });

    // Trigger modal
    await page.evaluate(async () => {
      window.testModalResult = await window.modalDialog.confirm({
        title: 'ESC Test',
        message: 'Press ESC to close',
        confirmText: 'OK',
        cancelText: 'Cancel',
      });
    });

    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 2000 });

    // Press ESC key
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(modalBackdrop).not.toBeVisible({ timeout: 1000 });

    // Verify result was false (cancelled via ESC)
    const result = await page.evaluate(() => window.testModalResult);
    expect(result).toBe(false);
  });

  test('should support click-outside-to-close', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin.html`);
    await page.fill('#adminPassword', ADMIN_PASSWORD);
    await page.click('button:has-text("Přihlásit")');
    await page.waitForSelector('text=Vítejte v admin panelu', { timeout: 10000 });

    // Trigger modal
    await page.evaluate(async () => {
      window.testModalResult = await window.modalDialog.confirm({
        title: 'Click Outside Test',
        message: 'Click outside to close',
        confirmText: 'OK',
        cancelText: 'Cancel',
      });
    });

    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 2000 });

    // Click on backdrop (outside modal dialog)
    await modalBackdrop.click({ position: { x: 10, y: 10 } });

    // Modal should close
    await expect(modalBackdrop).not.toBeVisible({ timeout: 1000 });

    // Verify result was false (cancelled)
    const result = await page.evaluate(() => window.testModalResult);
    expect(result).toBe(false);
  });

  test('should return true when confirm button clicked', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin.html`);
    await page.fill('#adminPassword', ADMIN_PASSWORD);
    await page.click('button:has-text("Přihlásit")');
    await page.waitForSelector('text=Vítejte v admin panelu', { timeout: 10000 });

    // Trigger modal
    await page.evaluate(async () => {
      window.testModalResult = await window.modalDialog.confirm({
        title: 'Confirm Test',
        message: 'Click confirm button',
        confirmText: 'OK',
        cancelText: 'Cancel',
      });
    });

    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 2000 });

    // Click confirm button
    const confirmBtn = page.locator('.modal-confirm-btn');
    await confirmBtn.click();

    // Modal should close
    await expect(modalBackdrop).not.toBeVisible({ timeout: 1000 });

    // Verify result was true (confirmed)
    const result = await page.evaluate(() => window.testModalResult);
    expect(result).toBe(true);
  });
});
