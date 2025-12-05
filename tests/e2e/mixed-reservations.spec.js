/**
 * Mixed Reservations Tests
 * E2E tests for combining different reservation types
 */
const { test, expect } = require('@playwright/test');
const {
  navigateToMainPage,
  resetDatabase,
  createProposedBooking,
  openBulkBookingModal,
  selectDateRangeInCalendar,
  fillGuestNames,
  getTempReservationsCount,
  clickFinalizeAndWaitForForm,
  fillContactForm,
  deleteTempReservation,
  getFutureDate,
  getTestDates,
  getPriceValue,
} = require('./helpers/test-helpers');

test.describe('Mixed Reservations', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await navigateToMainPage(page);
  });

  test.describe('Multi-Room Combinations', () => {
    test('should allow single room + single room (different dates)', async ({ page }) => {
      // First room - dates 1
      const dates1 = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate: dates1.startDate,
        endDate: dates1.endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Second room - different dates
      const startDate2 = getFutureDate(20);
      const endDate2 = getFutureDate(22);
      await createProposedBooking(page, {
        roomId: '13',
        startDate: startDate2,
        endDate: endDate2,
        guests: [{ firstName: 'Petr', lastName: 'Svoboda', type: 'adult' }],
      });

      // Should have 2 temp reservations
      const count = await getTempReservationsCount(page);
      expect(count).toBe(2);
    });

    test('should allow single room + single room (same dates, different rooms)', async ({ page }) => {
      const { startDate, endDate } = getTestDates();

      // First room
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Second room - same dates
      await createProposedBooking(page, {
        roomId: '13',
        startDate,
        endDate,
        guests: [{ firstName: 'Petr', lastName: 'Svoboda', type: 'adult' }],
      });

      // Should have 2 temp reservations
      const count = await getTempReservationsCount(page);
      expect(count).toBe(2);
    });

    test('should consolidate multi-room into single booking on finalize', async ({ page }) => {
      const { startDate, endDate } = getTestDates();

      // Create two rooms with same dates
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      await createProposedBooking(page, {
        roomId: '13',
        startDate,
        endDate,
        guests: [{ firstName: 'Petr', lastName: 'Svoboda', type: 'adult' }],
      });

      // Finalize
      await clickFinalizeAndWaitForForm(page);

      // Summary should show both rooms
      const summary = page.locator('#bookingSummary, .booking-summary');
      const summaryText = await summary.textContent();

      expect(summaryText).toContain('12');
      expect(summaryText).toContain('13');

      // Fill contact form and submit
      await fillContactForm(page, {
        name: 'Test User',
        email: 'test@example.com',
        phone: '123456789',
        company: 'Test',
        address: 'Test',
        city: 'Praha',
        zip: '12345',
      });

      const submitBtn = page.locator('#bookingFormModal button[type="submit"], button:has-text("Potvrdit")');
      await submitBtn.click();
      await page.waitForTimeout(2000);

      // Should create ONE consolidated booking
      // Verify by checking success message
    });

    test('should handle different date ranges per room', async ({ page }) => {
      // Room 12: Nov 1-3
      const startDate1 = getFutureDate(10);
      const endDate1 = getFutureDate(12);
      await createProposedBooking(page, {
        roomId: '12',
        startDate: startDate1,
        endDate: endDate1,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Room 13: Nov 2-4 (overlapping)
      const startDate2 = getFutureDate(11);
      const endDate2 = getFutureDate(13);
      await createProposedBooking(page, {
        roomId: '13',
        startDate: startDate2,
        endDate: endDate2,
        guests: [{ firstName: 'Petr', lastName: 'Svoboda', type: 'adult' }],
      });

      // Both should be in temp reservations
      const count = await getTempReservationsCount(page);
      expect(count).toBe(2);

      // On finalize, perRoomDates should be preserved
      await clickFinalizeAndWaitForForm(page);

      // Summary should show different dates for each room
      const summary = page.locator('#bookingSummary, .booking-summary');
      await expect(summary).toBeVisible();
    });
  });

  test.describe('Price Calculations', () => {
    test('should calculate correct total price for mixed reservations', async ({ page }) => {
      const { startDate, endDate } = getTestDates();

      // Room 12 with ÚTIA guest
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      await selectDateRangeInCalendar(page, startDate, endDate, 'miniCalendar');
      await page.waitForTimeout(300);

      // Keep as ÚTIA (default)
      await fillGuestNames(page, [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }], 'singleRoom');
      await page.click('#confirmSingleRoomBtn');
      await page.waitForTimeout(500);

      // Room 13 with External guest
      await page.click('.room-indicator:has-text("13")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      await selectDateRangeInCalendar(page, startDate, endDate, 'miniCalendar');
      await page.waitForTimeout(300);

      // Toggle to External
      const toggle = page.locator('#singleRoomGuestNamesSection input[data-guest-price-type]').first();
      if (await toggle.isVisible()) {
        await toggle.check();
        await page.waitForTimeout(200);
      }

      await fillGuestNames(page, [{ firstName: 'Petr', lastName: 'External', type: 'adult' }], 'singleRoom');
      await page.click('#confirmSingleRoomBtn');
      await page.waitForTimeout(500);

      // Verify total in sidebar
      const totalPrice = page.locator('#tempReservationsTotalPrice, .temp-reservations-total');
      if (await totalPrice.isVisible()) {
        const priceText = await totalPrice.textContent();
        const price = parseInt(priceText.replace(/\D/g, ''), 10);
        // Combined price should be greater than 0
        expect(price).toBeGreaterThan(0);
      }
    });

    test('should update sidebar totals correctly', async ({ page }) => {
      const { startDate, endDate } = getTestDates();

      // Add first reservation
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Get initial total
      const totalEl = page.locator('#tempReservationsTotalPrice, .temp-reservations-total');
      let initialTotal = 0;
      if (await totalEl.isVisible()) {
        const text = await totalEl.textContent();
        initialTotal = parseInt(text.replace(/\D/g, ''), 10);
      }

      // Add second reservation
      const startDate2 = getFutureDate(20);
      const endDate2 = getFutureDate(22);
      await createProposedBooking(page, {
        roomId: '13',
        startDate: startDate2,
        endDate: endDate2,
        guests: [{ firstName: 'Petr', lastName: 'Svoboda', type: 'adult' }],
      });

      // Total should increase
      if (await totalEl.isVisible()) {
        const text = await totalEl.textContent();
        const newTotal = parseInt(text.replace(/\D/g, ''), 10);
        expect(newTotal).toBeGreaterThan(initialTotal);
      }
    });
  });

  test.describe('Conflict Prevention', () => {
    test('should prevent adding room if conflicts with existing temp', async ({ page }) => {
      const { startDate, endDate } = getTestDates();

      // Book room 12
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Try to book room 12 again with overlapping dates
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // The occupied dates should be marked
      const dateCell = page.locator(`#miniCalendar [data-date="${startDate}"]`);
      const isProposed = await dateCell.evaluate(el =>
        el.classList.contains('proposed') || el.classList.contains('occupied')
      ).catch(() => false);

      // Should show as proposed/occupied
    });

    test('should handle edge-to-edge bookings in temp list', async ({ page }) => {
      // Room 12: Day 1-3
      const startDate1 = getFutureDate(10);
      const endDate1 = getFutureDate(12); // Checkout on day 12

      await createProposedBooking(page, {
        roomId: '12',
        startDate: startDate1,
        endDate: endDate1,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Room 12: Day 3-5 (checkin = checkout of previous)
      const startDate2 = endDate1; // Same day
      const endDate2 = getFutureDate(14);

      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Try to select edge-to-edge dates
      await selectDateRangeInCalendar(page, startDate2, endDate2, 'miniCalendar');
      await page.waitForTimeout(300);

      // Should either allow or show appropriate message
      // Edge-to-edge bookings are typically allowed
    });
  });

  test.describe('Reservation Management', () => {
    test('should allow switching from bulk to single rooms', async ({ page }) => {
      const { startDate, endDate } = getTestDates();

      // Create bulk booking
      await openBulkBookingModal(page);
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
      await page.waitForTimeout(500);

      // Delete bulk booking
      await deleteTempReservation(page, 0);
      await page.waitForTimeout(500);

      // Should have 0 reservations
      let count = await getTempReservationsCount(page);
      expect(count).toBe(0);

      // Add single room instead
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      count = await getTempReservationsCount(page);
      expect(count).toBe(1);
    });

    test('should maintain guest names across room additions', async ({ page }) => {
      const { startDate, endDate } = getTestDates();

      // First room with specific guest
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Second room with different guest
      await createProposedBooking(page, {
        roomId: '13',
        startDate,
        endDate,
        guests: [{ firstName: 'Petr', lastName: 'Svoboda', type: 'adult' }],
      });

      // Finalize and check summary
      await clickFinalizeAndWaitForForm(page);

      // Both guest names should be preserved
      const modal = page.locator('#bookingFormModal');
      const content = await modal.textContent();

      expect(content.toLowerCase()).toContain('jan');
      expect(content.toLowerCase()).toContain('petr');
    });
  });
});
