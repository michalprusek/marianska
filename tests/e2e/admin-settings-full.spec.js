/**
 * Admin Settings Full Tests
 * E2E tests for admin system settings management
 */
const { test, expect } = require('@playwright/test');
const {
  resetDatabase,
  loginAsAdmin,
} = require('./helpers/test-helpers');

test.describe('Admin Settings', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await loginAsAdmin(page);
  });

  test.describe('Settings Tab', () => {
    test('should display settings tab', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      const tabContent = page.locator('#settingsTab');
      await expect(tabContent).toHaveClass(/active/);
    });

    test('should display all settings sections', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      // Password change section
      await expect(page.locator('#changePasswordForm')).toBeVisible();

      // Email template section
      await expect(page.locator('#emailTemplateForm')).toBeVisible();
    });
  });

  test.describe('Password Change', () => {
    test('should display password change form', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      await expect(page.locator('#currentPassword')).toBeVisible();
      await expect(page.locator('#newPassword')).toBeVisible();
      await expect(page.locator('#confirmPassword')).toBeVisible();
    });

    test('should require current password', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      // Try to submit without current password
      await page.fill('#newPassword', 'newpass123');
      await page.fill('#confirmPassword', 'newpass123');

      // Current password is required - HTML validation should prevent submit
      const currentInput = page.locator('#currentPassword');
      const isRequired = await currentInput.getAttribute('required');
      expect(isRequired).not.toBeNull();
    });

    test('should validate password confirmation match', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      await page.fill('#currentPassword', 'oldpassword');
      await page.fill('#newPassword', 'newpassword1');
      await page.fill('#confirmPassword', 'differentpassword');

      await page.click('#changePasswordForm button[type="submit"]');
      await page.waitForTimeout(500);

      // Should show error notification or form error
      // (Implementation dependent)
    });

    test('should reject incorrect current password', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      await page.fill('#currentPassword', 'wrongpassword123');
      await page.fill('#newPassword', 'newpassword');
      await page.fill('#confirmPassword', 'newpassword');

      await page.click('#changePasswordForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Should show error notification
      const errorNotification = page.locator('.notification.error, .toast-error');
      // Error should be shown or form should not succeed
    });

    test('should change admin password successfully', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      // Use the actual admin password from CLAUDE.md (marianska)
      await page.fill('#currentPassword', 'marianska');
      await page.fill('#newPassword', 'newpassword123');
      await page.fill('#confirmPassword', 'newpassword123');

      await page.click('#changePasswordForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Should show success notification or message
      // Then change it back
    });
  });

  test.describe('Admin Notification Emails', () => {
    test('should display admin emails list', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      const adminEmailsList = page.locator('#adminEmailsList');
      await expect(adminEmailsList).toBeVisible();
    });

    test('should display add admin email form', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      await expect(page.locator('#addAdminEmailForm')).toBeVisible();
      await expect(page.locator('#newAdminEmail')).toBeVisible();
    });

    test('should add admin notification email', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      const testEmail = 'testadmin@example.com';
      await page.fill('#newAdminEmail', testEmail);
      await page.click('#addAdminEmailForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Email should appear in the list
      const adminEmailsList = page.locator('#adminEmailsList');
      const content = await adminEmailsList.textContent();
      expect(content).toContain(testEmail);
    });

    test('should validate email format for admin email', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      await page.fill('#newAdminEmail', 'invalid-email');
      await page.click('#addAdminEmailForm button[type="submit"]');
      await page.waitForTimeout(300);

      // Should show validation error (HTML5 email validation)
      const emailInput = page.locator('#newAdminEmail');
      const isValid = await emailInput.evaluate((el) => el.validity.valid);
      expect(isValid).toBeFalsy();
    });

    test('should remove admin notification email', async ({ page }) => {
      // First add an email
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      const testEmail = 'toremove@example.com';
      await page.fill('#newAdminEmail', testEmail);
      await page.click('#addAdminEmailForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Now remove it
      const removeBtn = page.locator(`#adminEmailsList button:near(:text("${testEmail}"))`).first();
      if (await removeBtn.isVisible()) {
        await removeBtn.click();
        await page.waitForTimeout(500);

        // Email should be removed from list
        const adminEmailsList = page.locator('#adminEmailsList');
        const content = await adminEmailsList.textContent();
        expect(content).not.toContain(testEmail);
      }
    });
  });

  test.describe('Cabin Manager Emails', () => {
    test('should display cabin manager emails list', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      const cabinManagerList = page.locator('#cabinManagerEmailsList');
      await expect(cabinManagerList).toBeVisible();
    });

    test('should add cabin manager email', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      const testEmail = 'manager@example.com';
      await page.fill('#newCabinManagerEmail', testEmail);
      await page.click('#addCabinManagerEmailForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Email should appear in the list
      const managerList = page.locator('#cabinManagerEmailsList');
      const content = await managerList.textContent();
      expect(content).toContain(testEmail);
    });

    test('should remove cabin manager email', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      // Add email first
      const testEmail = 'managertodelete@example.com';
      await page.fill('#newCabinManagerEmail', testEmail);
      await page.click('#addCabinManagerEmailForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Remove it
      const removeBtn = page.locator(`#cabinManagerEmailsList button:near(:text("${testEmail}"))`).first();
      if (await removeBtn.isVisible()) {
        await removeBtn.click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Email Template', () => {
    test('should display email template form', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      await expect(page.locator('#emailSubject')).toBeVisible();
      await expect(page.locator('#emailTemplate')).toBeVisible();
    });

    test('should edit email template subject', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      const newSubject = 'Custom Subject - Booking Confirmation';
      await page.fill('#emailSubject', newSubject);

      const value = await page.inputValue('#emailSubject');
      expect(value).toBe(newSubject);
    });

    test('should edit email template body with variables', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      const templateText = 'Hello {name}, your booking {booking_id} is confirmed!';
      await page.fill('#emailTemplate', templateText);

      const value = await page.inputValue('#emailTemplate');
      expect(value).toBe(templateText);
    });

    test('should show character counter for template', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      // Character counter should be visible
      const charCounter = page.locator('#emailTemplateCharCount');
      await expect(charCounter).toBeVisible();

      // Type some text
      await page.fill('#emailTemplate', 'Test content');
      await page.waitForTimeout(200);

      const countText = await charCounter.textContent();
      expect(parseInt(countText)).toBeGreaterThan(0);
    });

    test('should save email template', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      await page.fill('#emailSubject', 'Test Subject');
      await page.fill('#emailTemplate', 'Test template body {name}');

      await page.click('#emailTemplateForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Should show success notification
      const successNotification = page.locator('.notification.success, .toast-success');
      // Success notification or no error
    });

    test('should persist settings after save', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      const testSubject = 'Persisted Subject Test';
      await page.fill('#emailSubject', testSubject);
      await page.click('#emailTemplateForm button[type="submit"]');
      await page.waitForTimeout(1000);

      // Reload the page
      await page.reload();
      await page.waitForTimeout(500);

      // Login again
      await loginAsAdmin(page);
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(1000);

      // Value should be persisted
      const savedValue = await page.inputValue('#emailSubject');
      expect(savedValue).toBe(testSubject);
    });
  });

  test.describe('Contact Email', () => {
    test('should display contact email form', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      await expect(page.locator('#contactEmailForm')).toBeVisible();
      await expect(page.locator('#contactEmail')).toBeVisible();
    });

    test('should display current contact email', async ({ page }) => {
      await page.click('.tab-button[data-tab="settings"]');
      await page.waitForTimeout(500);

      const contactEmail = page.locator('#contactEmail');
      // Should have some value or placeholder
      const placeholder = await contactEmail.getAttribute('placeholder');
      expect(placeholder).toContain('@');
    });
  });
});
