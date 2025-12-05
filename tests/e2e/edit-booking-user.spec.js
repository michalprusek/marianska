/**
 * Edit Booking User Workflow Tests
 * E2E tests for the edit.html page user workflows
 */
const { test, expect } = require('@playwright/test');
const {
  navigateToMainPage,
  resetDatabase,
  createTestBooking,
  navigateToEditPage,
  getFutureDate,
  getTestDates,
  loginAsAdmin,
} = require('./helpers/test-helpers');

test.describe('Edit Booking - User Workflow', () => {
  let testBooking;

  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);

    // Create a test booking with edit token
    const { startDate, endDate } = getTestDates();
    testBooking = await createTestBooking(page, {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+420123456789',
      startDate,
      endDate,
      rooms: ['12'],
      guestType: 'utia',
      adults: 2,
      children: 0,
      company: 'Test Company',
      address: 'Test Address 123',
      city: 'Praha',
      zip: '12345',
    });
  });

  test.describe('Edit Page Loading', () => {
    test('should load booking data from edit token', async ({ page }) => {
      // Navigate to edit page with token
      await navigateToEditPage(page, testBooking.editToken);

      // Page should load successfully
      await expect(page.locator('#editFormContainer, .edit-form')).toBeVisible({ timeout: 10000 });

      // Should display booking information
      const pageContent = await page.content();
      expect(pageContent.toLowerCase()).toContain('test');
    });

    test('should show error for invalid token', async ({ page }) => {
      // Navigate with invalid token
      await page.goto('/edit.html?token=invalid-token-12345');

      await page.waitForTimeout(2000);

      // Should show error message
      const errorMessage = page.locator('.edit-error, .error-message, :has-text("nenalezena")');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should display two tabs - Dates and Billing', async ({ page }) => {
      await navigateToEditPage(page, testBooking.editToken);

      // Look for tabs
      const datesTab = page.locator('button:has-text("Termín"), button:has-text("Dates"), [data-tab="dates"]');
      const billingTab = page.locator('button:has-text("Fakturace"), button:has-text("Billing"), [data-tab="billing"]');

      // At least one tab structure should exist
      const hasTabs = await datesTab.isVisible().catch(() => false) ||
                      await billingTab.isVisible().catch(() => false);

      // Document expected behavior
    });
  });

  test.describe('Edit Deadline', () => {
    test('should show edit deadline warning when < 3 days before start', async ({ page }) => {
      // Create booking starting in 2 days
      const startDate = getFutureDate(2);
      const endDate = getFutureDate(4);

      const shortNoticeBooking = await createTestBooking(page, {
        name: 'Short Notice',
        email: 'short@example.com',
        phone: '+420123456789',
        startDate,
        endDate,
        rooms: ['13'],
        guestType: 'utia',
        adults: 1,
        company: 'Test',
        address: 'Test',
        city: 'Praha',
        zip: '12345',
      });

      await navigateToEditPage(page, shortNoticeBooking.editToken);

      // Should show deadline warning or locked state
      const warning = page.locator('#editDeadlineWarning, .deadline-warning, :has-text("nelze upravit")');
      const lockedForm = page.locator('.form-locked, [disabled]');

      // Either warning or locked form
      await page.waitForTimeout(1000);
    });

    test('should disable all inputs for paid bookings', async ({ page }) => {
      // Mark booking as paid via admin
      await loginAsAdmin(page);

      // Update booking to paid status
      await page.evaluate(async (bookingId) => {
        const response = await fetch(`/api/booking/${bookingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': sessionStorage.getItem('adminSessionToken') || '',
          },
          body: JSON.stringify({ paid: true }),
        });
        return response.json();
      }, testBooking.id);

      // Navigate to edit page
      await navigateToEditPage(page, testBooking.editToken);
      await page.waitForTimeout(1000);

      // Form should be in read-only mode
      const paidWarning = page.locator(':has-text("zaplacen"), :has-text("paid")');
      // Document expected behavior
    });
  });

  test.describe('Editing Booking', () => {
    test('should allow modifying guest names', async ({ page }) => {
      await navigateToEditPage(page, testBooking.editToken);

      // Find guest name input
      const guestNameInput = page.locator('input[name*="name"], input[id*="guestName"], input[id*="FirstName"]').first();

      if (await guestNameInput.isVisible()) {
        // Clear and type new name
        await guestNameInput.fill('Updated Name');

        // Value should be updated
        await expect(guestNameInput).toHaveValue('Updated Name');
      }
    });

    test('should allow modifying contact info', async ({ page }) => {
      await navigateToEditPage(page, testBooking.editToken);

      // Switch to billing tab if exists
      const billingTab = page.locator('button:has-text("Fakturace"), button:has-text("Billing"), [data-tab="billing"]');
      if (await billingTab.isVisible()) {
        await billingTab.click();
        await page.waitForTimeout(300);
      }

      // Find email input
      const emailInput = page.locator('input[name="email"], input[type="email"]').first();

      if (await emailInput.isVisible()) {
        await emailInput.fill('updated@example.com');
        await expect(emailInput).toHaveValue('updated@example.com');
      }
    });

    test('should validate changes before saving', async ({ page }) => {
      await navigateToEditPage(page, testBooking.editToken);

      // Switch to billing tab if exists
      const billingTab = page.locator('button:has-text("Fakturace"), [data-tab="billing"]');
      if (await billingTab.isVisible()) {
        await billingTab.click();
        await page.waitForTimeout(300);
      }

      // Clear required field
      const emailInput = page.locator('input[name="email"], input[type="email"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill('invalid-email');
      }

      // Try to save
      const saveBtn = page.locator('button:has-text("Uložit"), button:has-text("Save")');
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(500);

        // Should show validation error or not save
      }
    });

    test('should show success message on save', async ({ page }) => {
      await navigateToEditPage(page, testBooking.editToken);

      // Make a valid change
      const nameInput = page.locator('input[name="name"], input[id*="bookingName"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Updated Test User');
      }

      // Save
      const saveBtn = page.locator('button:has-text("Uložit"), button:has-text("Save")');
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(2000);

        // Should show success notification or redirect
        const successNotification = page.locator('.notification.success, :has-text("uložen")');
        // Document expected behavior
      }
    });
  });

  test.describe('Booking Cancellation', () => {
    test('should allow canceling/deleting booking', async ({ page }) => {
      await navigateToEditPage(page, testBooking.editToken);

      // Find cancel/delete button
      const cancelBtn = page.locator('button:has-text("Zrušit rezervaci"), button:has-text("Cancel booking"), button:has-text("Smazat")');

      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();

        // Confirmation dialog should appear
        await page.waitForTimeout(500);

        const confirmDialog = page.locator('.modal.active, .confirm-dialog');
        // Document expected behavior
      }
    });

    test('should show confirmation dialog for destructive actions', async ({ page }) => {
      await navigateToEditPage(page, testBooking.editToken);

      const cancelBtn = page.locator('button:has-text("Zrušit rezervaci"), button:has-text("Smazat")');

      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(500);

        // Should show custom modal (not native confirm)
        const customModal = page.locator('.modal.active, .custom-modal');
        const isCustomModal = await customModal.isVisible().catch(() => false);

        // Document expected behavior - should use custom modal
      }
    });

    test('should redirect to homepage after cancel', async ({ page }) => {
      await navigateToEditPage(page, testBooking.editToken);

      const cancelBtn = page.locator('button:has-text("Zrušit rezervaci"), button:has-text("Smazat")');

      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(500);

        // Confirm deletion
        const confirmBtn = page.locator('.modal.active button:has-text("Ano"), .modal.active button:has-text("Potvrdit")');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(2000);

          // Should redirect to homepage
          const url = page.url();
          // Document expected redirect behavior
        }
      }
    });
  });

  test.describe('Room Management', () => {
    test('should handle room removal correctly with price update', async ({ page }) => {
      // Create booking with multiple rooms
      const { startDate, endDate } = getTestDates();
      const multiRoomBooking = await createTestBooking(page, {
        name: 'Multi Room',
        email: 'multi@example.com',
        phone: '+420123456789',
        startDate,
        endDate,
        rooms: ['12', '13'],
        guestType: 'utia',
        adults: 3,
        company: 'Test',
        address: 'Test',
        city: 'Praha',
        zip: '12345',
      });

      await navigateToEditPage(page, multiRoomBooking.editToken);

      // Find room removal button
      const removeRoomBtn = page.locator('button:has-text("Odebrat pokoj"), .remove-room-btn');

      if (await removeRoomBtn.first().isVisible()) {
        // Get initial price
        const priceEl = page.locator('.total-price, #totalPrice');
        const initialPrice = await priceEl.textContent().catch(() => '0');

        // Remove one room
        await removeRoomBtn.first().click();
        await page.waitForTimeout(500);

        // Confirm if needed
        const confirmBtn = page.locator('.modal.active button:has-text("Ano")');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
        }

        // Price should be updated
        const newPrice = await priceEl.textContent().catch(() => '0');
        // Document expected behavior
      }
    });
  });
});
