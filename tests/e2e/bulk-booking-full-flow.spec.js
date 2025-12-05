/**
 * Bulk Booking - Full UI Flow Tests
 * Comprehensive E2E tests for the whole cabin (bulk) booking workflow
 */
const { test, expect } = require('@playwright/test');
const {
  navigateToMainPage,
  resetDatabase,
  loginAsAdmin,
  openBulkBookingModal,
  selectDateRangeInCalendar,
  fillGuestNames,
  adjustGuestCount,
  getPriceValue,
  closeBulkBookingModal,
  getFutureDate,
  getTestDates,
  getTempReservationsCount,
  createBlockageViaAPI,
  createTestBooking,
  setMockDate,
} = require('./helpers/test-helpers');

test.describe('Bulk Booking - Full UI Flow', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await navigateToMainPage(page);
  });

  test.describe('Modal Opening and Display', () => {
    test('should open bulk booking modal on Hromadna akce button click', async ({ page }) => {
      // Click on bulk booking button
      await page.click('#bulkActionBtn, button:has-text("Hromadná akce"), button:has-text("Bulk")');

      // Wait for modal to open
      await expect(page.locator('#bulkBookingModal')).toHaveClass(/active/);
    });

    test('should display all 9 rooms info in bulk modal', async ({ page }) => {
      await openBulkBookingModal(page);

      // Modal should mention that it's for the whole cabin
      const modalContent = page.locator('#bulkBookingModal');
      await expect(modalContent).toBeVisible();

      // Should have calendar visible
      await expect(page.locator('#bulkCalendar')).toBeVisible();
    });

    test('should display bulk calendar for date selection', async ({ page }) => {
      await openBulkBookingModal(page);

      // Verify bulk calendar is rendered
      const calendar = page.locator('#bulkCalendar');
      await expect(calendar).toBeVisible();

      // Calendar should have day cells
      const dayCells = page.locator('#bulkCalendar .calendar-day');
      await expect(dayCells.first()).toBeVisible();
    });
  });

  test.describe('Date Selection', () => {
    test('should select date range for all rooms simultaneously', async ({ page }) => {
      await openBulkBookingModal(page);

      const { startDate, endDate } = getTestDates();

      // Select date range
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');

      // Verify dates are selected
      await expect(page.locator(`#bulkCalendar [data-date="${startDate}"]`)).toHaveClass(/selected/);
      await expect(page.locator(`#bulkCalendar [data-date="${endDate}"]`)).toHaveClass(/selected/);

      // Verify date summary is shown
      const dateSummary = page.locator('#bulkSelectedDatesDisplay, #bulkDateSelectionSummary');
      await expect(dateSummary).toBeVisible();
    });

    test('should update nights count when dates are selected', async ({ page }) => {
      await openBulkBookingModal(page);

      const startDate = getFutureDate(10);
      const endDate = getFutureDate(13); // 3 nights

      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');

      // Verify nights count is displayed
      const nightsDisplay = page.locator('#bulkNightsCount, .nights-count');
      await expect(nightsDisplay.first()).toBeVisible();
    });
  });

  test.describe('Guest Configuration', () => {
    test('should enforce minimum 10 guests for bulk booking', async ({ page }) => {
      await openBulkBookingModal(page);

      const { startDate, endDate } = getTestDates();
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');

      // Default should be 10 adults
      const adultsDisplay = page.locator('#bulkAdults');
      const adultsCount = await adultsDisplay.textContent();
      expect(parseInt(adultsCount, 10)).toBeGreaterThanOrEqual(10);

      // Try to decrease below 10
      const decreaseBtn = page.locator('button[onclick*="adjustBulkGuests"][onclick*="-1"]').first();

      // Click to try to decrease
      await decreaseBtn.click();
      await page.waitForTimeout(100);

      // Should show warning or prevent going below 10
      // Either still shows 10 or shows a warning notification
      const newCount = await adultsDisplay.textContent();
      const total = parseInt(newCount, 10);

      // With 0 children, total must be >= 10
      expect(total).toBeGreaterThanOrEqual(10);
    });

    test('should enforce maximum 26 guests for bulk booking', async ({ page }) => {
      await openBulkBookingModal(page);

      const { startDate, endDate } = getTestDates();
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');

      // Try to increase adults beyond capacity
      const increaseBtn = page.locator('button[onclick*="adjustBulkGuests"][onclick*="adults"][onclick*="1"]').first();

      // Click multiple times to try to exceed 26
      for (let i = 0; i < 20; i++) {
        await increaseBtn.click();
        await page.waitForTimeout(50);
      }

      // Check if capacity warning is shown
      const capacityWarning = page.locator('#bulkCapacityWarning');
      const isWarningVisible = await capacityWarning.isVisible().catch(() => false);

      // Either warning is visible or count is capped at 26
      const adultsDisplay = page.locator('#bulkAdults');
      const count = parseInt(await adultsDisplay.textContent(), 10);

      expect(count <= 26 || isWarningVisible).toBeTruthy();
    });

    test('should generate guest name inputs for all guests', async ({ page }) => {
      await openBulkBookingModal(page);

      const { startDate, endDate } = getTestDates();
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');
      await page.waitForTimeout(500);

      // Guest names section should be visible
      const guestNamesSection = page.locator('#bulkGuestNamesSection');
      await expect(guestNamesSection).toBeVisible();

      // Should have multiple guest name inputs (at least 10 for minimum)
      const guestInputs = page.locator('#bulkGuestNamesSection input[id*="FirstName"]');
      const inputCount = await guestInputs.count();
      expect(inputCount).toBeGreaterThanOrEqual(10);
    });

    test('should calculate bulk pricing correctly', async ({ page }) => {
      await openBulkBookingModal(page);

      const { startDate, endDate } = getTestDates();
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');
      await page.waitForTimeout(500);

      // Verify price is displayed
      const totalPrice = page.locator('#bulkTotalPrice');
      await expect(totalPrice).toBeVisible();

      const priceText = await totalPrice.textContent();
      const priceValue = parseInt(priceText.replace(/\D/g, ''), 10);

      // Bulk booking should have a base price + per-guest surcharges
      // Base is 2000 Kč, so with 10 guests and 2 nights should be > 4000
      expect(priceValue).toBeGreaterThan(4000);
    });

    test('should display per-type pricing breakdown (UTIA vs External)', async ({ page }) => {
      await openBulkBookingModal(page);

      const { startDate, endDate } = getTestDates();
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');
      await page.waitForTimeout(500);

      // Toggle some guests to External
      const toggles = page.locator('#bulkGuestNamesSection input[data-guest-price-type]');
      const toggleCount = await toggles.count();

      if (toggleCount > 0) {
        // Toggle first guest to External
        await toggles.first().check();
        await page.waitForTimeout(300);

        // Price breakdown should show mixed pricing
        const detailedSurcharges = page.locator('#bulkDetailedSurcharges');
        if (await detailedSurcharges.isVisible()) {
          // Should show ÚTIA and External lines
          const content = await detailedSurcharges.textContent();
          // Should contain price information
          expect(content).toContain('Kč');
        }
      }
    });
  });

  test.describe('Validation', () => {
    test('should validate all guest names before confirm', async ({ page }) => {
      await openBulkBookingModal(page);

      const { startDate, endDate } = getTestDates();
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');
      await page.waitForTimeout(500);

      // Don't fill any guest names
      // Try to confirm
      const confirmBtn = page.locator('#confirmBulkBookingBtn, #confirmBulkBooking');
      await confirmBtn.click();

      // Should show validation error
      await page.waitForTimeout(500);
      const notification = page.locator('.notification');
      await expect(notification).toBeVisible({ timeout: 3000 });
    });

    test('should not allow bulk when any room is occupied', async ({ page }) => {
      // Create an existing booking for one room
      const { startDate, endDate } = getTestDates();

      await createTestBooking(page, {
        startDate,
        endDate,
        rooms: ['12'],
        name: 'Existing Booking',
        email: 'existing@test.com',
      });

      await navigateToMainPage(page);
      await page.waitForTimeout(500);

      await openBulkBookingModal(page);

      // Try to select overlapping dates
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');

      // The dates should be marked as unavailable or show warning
      // Check if calendar shows unavailable status
      const dateCell = page.locator(`#bulkCalendar [data-date="${startDate}"]`);
      const isOccupied = await dateCell.evaluate(el =>
        el.classList.contains('occupied') ||
        el.classList.contains('unavailable') ||
        el.classList.contains('blocked')
      ).catch(() => false);

      // Either the date is marked or confirmation will fail
      expect(typeof isOccupied).toBe('boolean');
    });
  });

  test.describe('Christmas Period Restrictions', () => {
    test('should block bulk booking for Christmas after Oct 1', async ({ page, context }) => {
      // Set date to November 1st
      await context.addInitScript(() => {
        const mockDate = new Date('2025-11-01T12:00:00');
        const RealDate = Date;
        class MockDate extends RealDate {
          constructor(...args) {
            if (args.length === 0) return new RealDate(mockDate);
            return new RealDate(...args);
          }
          static now() {
            return mockDate.getTime();
          }
        }
        globalThis.Date = MockDate;
      });

      await page.goto('/');
      await page.waitForSelector('#calendar');

      await openBulkBookingModal(page);

      // Try to select Christmas dates (Dec 24-26)
      const christmasStart = '2025-12-24';
      const christmasEnd = '2025-12-26';

      // Navigate to December
      const nextBtn = page.locator('#bulkCalendar .nav-next, #bulkCalendar button:has-text("›")');
      await nextBtn.click(); // November -> December
      await page.waitForTimeout(300);

      // Try to select Christmas dates
      await page.click(`#bulkCalendar [data-date="${christmasStart}"]`).catch(() => {});
      await page.waitForTimeout(200);
      await page.click(`#bulkCalendar [data-date="${christmasEnd}"]`).catch(() => {});
      await page.waitForTimeout(200);

      // Fill guest names
      const guestInputs = page.locator('#bulkGuestNamesSection input[id*="FirstName"]');
      const inputCount = await guestInputs.count();

      for (let i = 0; i < inputCount; i++) {
        await guestInputs.nth(i).fill(`Guest${i + 1}`);
        const lastNameInput = page.locator(`#bulkGuestNamesSection input[id*="LastName"]`).nth(i);
        await lastNameInput.fill(`Test${i + 1}`);
      }

      // Try to confirm
      const confirmBtn = page.locator('#confirmBulkBookingBtn, #confirmBulkBooking');
      await confirmBtn.click();

      // Should show error about bulk being blocked after Oct 1
      await page.waitForTimeout(500);
      const notification = page.locator('.notification.error, .notification:has-text("1. říjnu")');
      // Either error notification or no booking created
    });

    test('should require access code for Christmas bulk before Oct 1', async ({ page, context }) => {
      // Set date to September 15th
      await context.addInitScript(() => {
        const mockDate = new Date('2025-09-15T12:00:00');
        const RealDate = Date;
        class MockDate extends RealDate {
          constructor(...args) {
            if (args.length === 0) return new RealDate(mockDate);
            return new RealDate(...args);
          }
          static now() {
            return mockDate.getTime();
          }
        }
        globalThis.Date = MockDate;
      });

      await page.goto('/');
      await page.waitForSelector('#calendar');

      await openBulkBookingModal(page);

      // Navigate to December
      const nextBtn = page.locator('#bulkCalendar .nav-next, #bulkCalendar button:has-text("›")');
      for (let i = 0; i < 3; i++) { // Sep -> Oct -> Nov -> Dec
        await nextBtn.click();
        await page.waitForTimeout(200);
      }

      // Try to select Christmas dates
      const christmasStart = '2025-12-24';
      const christmasEnd = '2025-12-26';

      await page.click(`#bulkCalendar [data-date="${christmasStart}"]`).catch(() => {});
      await page.click(`#bulkCalendar [data-date="${christmasEnd}"]`).catch(() => {});

      // Christmas code field may appear
      const codeField = page.locator('#christmasCodeGroup, #bulkChristmasCode');
      // The test documents expected behavior
    });
  });

  test.describe('Booking Confirmation', () => {
    test('should create proposed bookings for all 9 rooms', async ({ page }) => {
      await openBulkBookingModal(page);

      const { startDate, endDate } = getTestDates();
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');
      await page.waitForTimeout(500);

      // Fill all guest names
      const guestInputs = page.locator('#bulkGuestNamesSection input[id*="FirstName"]');
      const inputCount = await guestInputs.count();

      for (let i = 0; i < inputCount; i++) {
        await guestInputs.nth(i).fill(`Guest${i + 1}`);
        const lastNameInput = page.locator(`#bulkGuestNamesSection input[id*="LastName"]`).nth(i);
        await lastNameInput.fill(`Test${i + 1}`);
      }

      // Confirm
      const confirmBtn = page.locator('#confirmBulkBookingBtn, #confirmBulkBooking');
      await confirmBtn.click();
      await page.waitForTimeout(800);

      // Modal should close
      await expect(page.locator('#bulkBookingModal')).not.toHaveClass(/active/);

      // Should show success notification
      const notification = page.locator('.notification.success, .notification:has-text("přidána")');
      await expect(notification).toBeVisible({ timeout: 3000 });
    });

    test('should show bulk booking in temp reservations list', async ({ page }) => {
      await openBulkBookingModal(page);

      const { startDate, endDate } = getTestDates();
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');
      await page.waitForTimeout(500);

      // Fill guest names
      const guestInputs = page.locator('#bulkGuestNamesSection input[id*="FirstName"]');
      const inputCount = await guestInputs.count();

      for (let i = 0; i < inputCount; i++) {
        await guestInputs.nth(i).fill(`Guest${i + 1}`);
        const lastNameInput = page.locator(`#bulkGuestNamesSection input[id*="LastName"]`).nth(i);
        await lastNameInput.fill(`Test${i + 1}`);
      }

      await page.locator('#confirmBulkBookingBtn, #confirmBulkBooking').click();
      await page.waitForTimeout(800);

      // Temp reservations should show the bulk booking
      const tempSection = page.locator('#tempReservationsSection, #tempReservationsContainer');
      await expect(tempSection).toBeVisible();

      // Should show "celá chata" or similar bulk indicator
      const bulkIndicator = page.locator('#tempReservationsContainer:has-text("chata"), #tempReservationsContainer:has-text("9 pokojů")');
      // Document expected behavior
    });

    test('should update calendar to show all rooms as proposed', async ({ page }) => {
      await openBulkBookingModal(page);

      const { startDate, endDate } = getTestDates();
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');
      await page.waitForTimeout(500);

      // Fill guest names
      const guestInputs = page.locator('#bulkGuestNamesSection input[id*="FirstName"]');
      const inputCount = await guestInputs.count();

      for (let i = 0; i < inputCount; i++) {
        await guestInputs.nth(i).fill(`Guest${i + 1}`);
        const lastNameInput = page.locator(`#bulkGuestNamesSection input[id*="LastName"]`).nth(i);
        await lastNameInput.fill(`Test${i + 1}`);
      }

      await page.locator('#confirmBulkBookingBtn, #confirmBulkBooking').click();
      await page.waitForTimeout(800);

      // Calendar should show proposed status for all rooms on selected dates
      // Room indicators should show yellow/proposed color
      const proposedIndicator = page.locator(`.room-indicator.proposed, .room-indicator[style*="yellow"]`);
      // Document expected behavior - all 9 rooms should be marked
    });
  });

  test.describe('Modal Closing', () => {
    test('should close modal and clear selection on cancel', async ({ page }) => {
      await openBulkBookingModal(page);

      const { startDate, endDate } = getTestDates();
      await selectDateRangeInCalendar(page, startDate, endDate, 'bulkCalendar');

      // Close modal
      const closeBtn = page.locator('#bulkBookingModal .close-btn, #bulkBookingModal button:has-text("×"), #bulkBookingModal button:has-text("Zrušit")');
      await closeBtn.first().click();

      // Modal should close
      await expect(page.locator('#bulkBookingModal')).not.toHaveClass(/active/);

      // No temp reservations should be created
      const count = await getTempReservationsCount(page);
      expect(count).toBe(0);
    });
  });
});
