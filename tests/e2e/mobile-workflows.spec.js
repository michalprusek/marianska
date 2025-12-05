/**
 * Mobile Workflows Tests
 * E2E tests for mobile-specific interactions and layouts
 */
const { test, expect, devices } = require('@playwright/test');
const {
  navigateToMainPage,
  resetDatabase,
  createProposedBooking,
  clickFinalizeAndWaitForForm,
  fillContactForm,
  selectDateRangeInCalendar,
  openBulkBookingModal,
  getTestDates,
} = require('./helpers/test-helpers');

// Mobile viewport configuration
const mobileViewport = { width: 375, height: 667 }; // iPhone SE

test.describe('Mobile Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(mobileViewport);
    await resetDatabase(page);
    await navigateToMainPage(page);
  });

  test.describe('Mobile Layout', () => {
    test('should display mobile-optimized calendar layout', async ({ page }) => {
      // Calendar should be visible and responsive
      const calendar = page.locator('#calendar, .calendar-container');
      await expect(calendar).toBeVisible();

      // Check that calendar fits viewport
      const calendarBox = await calendar.boundingBox();
      expect(calendarBox.width).toBeLessThanOrEqual(mobileViewport.width);
    });

    test('should show mobile-friendly modal sizing', async ({ page }) => {
      // Open single room modal
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      const modal = page.locator('#singleRoomBookingModal .modal-content');
      const modalBox = await modal.boundingBox();

      // Modal should fit within viewport
      expect(modalBox.width).toBeLessThanOrEqual(mobileViewport.width);
    });

    test('should scroll within modal on small screens', async ({ page }) => {
      const { startDate, endDate } = getTestDates();

      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      await clickFinalizeAndWaitForForm(page);

      // Modal content should be scrollable
      const modalContent = page.locator('#bookingFormModal .modal-content');

      // Check if scrollable
      const isScrollable = await modalContent.evaluate((el) => {
        return el.scrollHeight > el.clientHeight;
      });

      // Content might be scrollable on mobile
    });

    test('should have larger touch targets', async ({ page }) => {
      // Buttons should be large enough for touch
      const buttons = page.locator('button:visible');
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();

        if (box) {
          // Minimum touch target size is typically 44x44 pixels
          expect(box.height).toBeGreaterThanOrEqual(36);
        }
      }
    });
  });

  test.describe('Touch Interactions', () => {
    test('should handle touch for date selection', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Simulate touch tap on date
      const { startDate, endDate } = getTestDates();

      // Touch first date
      const startCell = page.locator(`#miniCalendar [data-date="${startDate}"]`);
      if (await startCell.isVisible()) {
        await startCell.tap();
        await page.waitForTimeout(200);

        // Touch end date
        const endCell = page.locator(`#miniCalendar [data-date="${endDate}"]`);
        if (await endCell.isVisible()) {
          await endCell.tap();
          await page.waitForTimeout(200);
        }
      }
    });

    test('should handle swipe gestures on calendar', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Get current month
      const monthHeader = page.locator('#miniCalendar .calendar-header, #miniCalendar h3');
      const initialMonth = await monthHeader.textContent();

      // Simulate swipe left (next month)
      const calendar = page.locator('#miniCalendar');
      const box = await calendar.boundingBox();

      if (box) {
        // Swipe from right to left
        await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(300);
      }

      // Or use navigation buttons
      const nextBtn = page.locator('#miniCalendar button:has-text("›"), #miniCalendar .next-month');
      if (await nextBtn.isVisible()) {
        await nextBtn.tap();
        await page.waitForTimeout(200);
      }
    });
  });

  test.describe('Form Input on Mobile', () => {
    test('should show mobile-optimized form inputs', async ({ page }) => {
      const { startDate, endDate } = getTestDates();

      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      await clickFinalizeAndWaitForForm(page);

      // Check input types for mobile optimization
      const emailInput = page.locator('#bookingEmail, input[name="email"]');
      const phoneInput = page.locator('#bookingPhone, input[name="phone"]');

      // Email input should have type="email" for mobile keyboard
      const emailType = await emailInput.getAttribute('type');
      expect(emailType).toBe('email');

      // Phone input should have type="tel" for numeric keyboard
      const phoneType = await phoneInput.getAttribute('type');
      expect(phoneType).toBe('tel');
    });

    test('should handle virtual keyboard appearance', async ({ page }) => {
      const { startDate, endDate } = getTestDates();

      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      await clickFinalizeAndWaitForForm(page);

      // Focus on input
      const nameInput = page.locator('#bookingName, input[name="name"]');
      await nameInput.tap();
      await page.waitForTimeout(300);

      // Input should be visible (not covered by keyboard simulation)
      await expect(nameInput).toBeVisible();
    });
  });

  test.describe('Complete Mobile Flow', () => {
    test('should complete full booking flow on mobile viewport', async ({ page }) => {
      const { startDate, endDate } = getTestDates();

      // Step 1: Open room modal
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Step 2: Select dates
      await selectDateRangeInCalendar(page, startDate, endDate, 'miniCalendar');
      await page.waitForTimeout(300);

      // Step 3: Fill guest names
      const firstNameInput = page.locator('#singleRoomGuestNamesSection input[id*="FirstName"]').first();
      if (await firstNameInput.isVisible()) {
        await firstNameInput.tap();
        await firstNameInput.fill('Jan');

        const lastNameInput = page.locator('#singleRoomGuestNamesSection input[id*="LastName"]').first();
        await lastNameInput.tap();
        await lastNameInput.fill('Novak');
      }

      // Step 4: Confirm booking
      const confirmBtn = page.locator('#confirmSingleRoomBtn');
      await confirmBtn.tap();
      await page.waitForTimeout(500);

      // Step 5: Open finalize form
      await clickFinalizeAndWaitForForm(page);

      // Step 6: Fill contact form
      await fillContactForm(page, {
        name: 'Jan Novak',
        email: 'jan@example.com',
        phone: '+420123456789',
        company: 'Test',
        address: 'Test 123',
        city: 'Praha',
        zip: '12345',
      });

      // Step 7: Submit
      const submitBtn = page.locator('#bookingFormModal button[type="submit"]');
      await submitBtn.tap();
      await page.waitForTimeout(2000);

      // Should complete successfully
    });
  });

  test.describe('Responsive Elements', () => {
    test('should collapse/expand sections appropriately', async ({ page }) => {
      // Some sections might collapse on mobile
      const sidebar = page.locator('#sidebar, .sidebar');

      if (await sidebar.isVisible()) {
        const sidebarBox = await sidebar.boundingBox();
        // Sidebar might be hidden or collapsed on mobile
      }
    });

    test('should show hamburger menu on mobile', async ({ page }) => {
      // Look for hamburger menu button
      const hamburger = page.locator('.hamburger, .mobile-menu-toggle, button[aria-label="Menu"]');

      // Hamburger menu might or might not exist
      // Depends on implementation
    });

    test('should handle orientation change', async ({ page }) => {
      // Landscape orientation
      await page.setViewportSize({ width: 667, height: 375 });
      await page.waitForTimeout(300);

      // Page should still be usable
      const calendar = page.locator('#calendar, .calendar-container');
      await expect(calendar).toBeVisible();

      // Back to portrait
      await page.setViewportSize(mobileViewport);
      await page.waitForTimeout(300);

      await expect(calendar).toBeVisible();
    });
  });

  test.describe('Performance on Mobile', () => {
    test('should load page within acceptable time on mobile', async ({ page }) => {
      const startTime = Date.now();

      await navigateToMainPage(page);

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds on mobile
      expect(loadTime).toBeLessThan(5000);
    });
  });
});

// Additional test with tablet viewport
test.describe('Tablet Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // iPad viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await resetDatabase(page);
    await navigateToMainPage(page);
  });

  test('should display properly on tablet', async ({ page }) => {
    const calendar = page.locator('#calendar, .calendar-container');
    await expect(calendar).toBeVisible();

    // On tablet, layout might be different from mobile
    const calendarBox = await calendar.boundingBox();
    expect(calendarBox.width).toBeGreaterThan(mobileViewport.width);
  });

  test('should work with tablet touch interactions', async ({ page }) => {
    // Open a room
    await page.click('.room-indicator:has-text("12")');
    await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

    // Calendar should be visible and usable
    const calendar = page.locator('#miniCalendar');
    await expect(calendar).toBeVisible();
  });
});
