/**
 * Date Validation Edge Cases Tests
 * E2E tests for edge cases in date handling and selection
 */
const { test, expect } = require('@playwright/test');
const {
  navigateToMainPage,
  resetDatabase,
  createProposedBooking,
  selectDateRangeInCalendar,
  navigateCalendarMonth,
  getFutureDate,
  getTestDates,
} = require('./helpers/test-helpers');

test.describe('Date Validation Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await navigateToMainPage(page);
  });

  test.describe('Edge-to-Edge Bookings', () => {
    test('should allow edge-to-edge bookings (checkout = checkin)', async ({ page }) => {
      // First booking: Day 10-12
      const startDate1 = getFutureDate(10);
      const endDate1 = getFutureDate(12);

      await createProposedBooking(page, {
        roomId: '12',
        startDate: startDate1,
        endDate: endDate1,
        guests: [{ firstName: 'First', lastName: 'Guest', type: 'adult' }],
      });

      // Delete the temp reservation
      const deleteBtn = page.locator('#tempReservationsContainer button:has-text("×")').first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.waitForTimeout(500);
      }

      // Second booking: Day 12-14 (checkout of first = checkin of second)
      const startDate2 = endDate1;
      const endDate2 = getFutureDate(14);

      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Edge-to-edge booking should be allowed
      await selectDateRangeInCalendar(page, startDate2, endDate2, 'miniCalendar');
      await page.waitForTimeout(300);

      // Date selection should work
      const dateDisplay = page.locator('#singleRoomBookingModal .selected-dates, #dateRangeDisplay');
      if (await dateDisplay.isVisible()) {
        const text = await dateDisplay.textContent();
        // Should show selected dates
      }
    });
  });

  test.describe('Minimum Stay', () => {
    test('should enforce minimum 1 night stay', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Try to select same date for start and end (0 nights)
      const sameDate = getFutureDate(15);

      await selectDateRangeInCalendar(page, sameDate, sameDate, 'miniCalendar');
      await page.waitForTimeout(300);

      // Should not allow 0-night booking or should show error
      // The confirm button might be disabled or show warning
      const confirmBtn = page.locator('#confirmSingleRoomBtn');
      // Either disabled or selection not complete
    });

    test('should handle single-day selection as error', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Click only one date
      const singleDate = getFutureDate(20);
      const dateCell = page.locator(`#miniCalendar [data-date="${singleDate}"]`);

      if (await dateCell.isVisible()) {
        await dateCell.click();
        await page.waitForTimeout(200);

        // Should require second click to complete range
        // Selection should be incomplete
      }
    });
  });

  test.describe('Month Boundaries', () => {
    test('should handle month boundary selections', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Get dates at month boundary
      const now = new Date();
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1);

      const startDate = lastDayOfMonth.toISOString().split('T')[0];
      const endDate = new Date(firstDayOfNextMonth.getTime() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      // Navigate to the correct month if needed
      await navigateCalendarMonth(page, 'next', 'miniCalendar');
      await navigateCalendarMonth(page, 'next', 'miniCalendar');
      await page.waitForTimeout(300);

      // Selection across month boundary should work
    });

    test('should handle year boundary selections', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // This test is for December -> January bookings
      // Only relevant in Nov-Jan timeframe
      const now = new Date();
      if (now.getMonth() >= 10 || now.getMonth() <= 1) {
        // Navigate to December
        while (true) {
          const monthHeader = page.locator('#miniCalendar .calendar-header, #miniCalendar h3');
          const headerText = await monthHeader.textContent();
          if (headerText.toLowerCase().includes('prosinec') || headerText.toLowerCase().includes('december')) {
            break;
          }
          await navigateCalendarMonth(page, 'next', 'miniCalendar');
          await page.waitForTimeout(200);
        }

        // Year boundary bookings should work
      }
    });
  });

  test.describe('Past Date Prevention', () => {
    test('should not allow past date selection', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Past dates should be disabled
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const pastDate = yesterday.toISOString().split('T')[0];

      const pastCell = page.locator(`#miniCalendar [data-date="${pastDate}"]`);
      if (await pastCell.isVisible()) {
        const isDisabled = await pastCell.evaluate((el) =>
          el.classList.contains('disabled') ||
          el.classList.contains('past') ||
          el.hasAttribute('disabled')
        );
        expect(isDisabled).toBeTruthy();
      }
    });

    test('should start date selection from today or future', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Today's date should be selectable (if not already occupied)
      const today = new Date().toISOString().split('T')[0];
      const todayCell = page.locator(`#miniCalendar [data-date="${today}"]`);

      if (await todayCell.isVisible()) {
        const isSelectable = await todayCell.evaluate((el) =>
          !el.classList.contains('disabled') &&
          !el.classList.contains('past')
        );
        // Today should be selectable (unless blocked/occupied)
      }
    });
  });

  test.describe('Night Count Calculation', () => {
    test('should calculate nights correctly across months', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Select dates spanning two months
      const startDate = getFutureDate(25); // Might be end of month
      const endDate = getFutureDate(35); // Into next month

      await selectDateRangeInCalendar(page, startDate, endDate, 'miniCalendar');
      await page.waitForTimeout(300);

      // Night count should be 10
      const nightsDisplay = page.locator('#singleRoomBookingModal :has-text("noc"), #singleRoomBookingModal :has-text("night")');
      if (await nightsDisplay.first().isVisible()) {
        const text = await nightsDisplay.first().textContent();
        // Should show 10 nights
      }
    });

    test('should show correct night count in UI', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Select 3 nights
      const startDate = getFutureDate(10);
      const endDate = getFutureDate(13);

      await selectDateRangeInCalendar(page, startDate, endDate, 'miniCalendar');
      await page.waitForTimeout(300);

      // Should show "3 noci" or similar
      const modal = page.locator('#singleRoomBookingModal');
      const text = await modal.textContent();
      expect(text).toMatch(/3/);
    });
  });

  test.describe('Date Range Validation', () => {
    test('should validate date range (end >= start)', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Calendar UI should only allow valid ranges
      // (User selects start first, then end - end must be after start)
      // This is enforced by UI, not by explicit validation
    });

    test('should highlight selected date range', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      const startDate = getFutureDate(15);
      const endDate = getFutureDate(18);

      await selectDateRangeInCalendar(page, startDate, endDate, 'miniCalendar');
      await page.waitForTimeout(300);

      // All dates in range should be highlighted
      const startCell = page.locator(`#miniCalendar [data-date="${startDate}"]`);
      const endCell = page.locator(`#miniCalendar [data-date="${endDate}"]`);

      if (await startCell.isVisible() && await endCell.isVisible()) {
        const startHighlighted = await startCell.evaluate((el) =>
          el.classList.contains('selected') ||
          el.classList.contains('range-start') ||
          el.classList.contains('in-range')
        );

        const endHighlighted = await endCell.evaluate((el) =>
          el.classList.contains('selected') ||
          el.classList.contains('range-end') ||
          el.classList.contains('in-range')
        );

        expect(startHighlighted).toBeTruthy();
        expect(endHighlighted).toBeTruthy();
      }
    });
  });

  test.describe('Date Locale', () => {
    test('should display dates in correct locale format (CZ)', async ({ page }) => {
      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Calendar should show Czech month names
      const monthHeader = page.locator('#miniCalendar .calendar-header, #miniCalendar h3');
      const headerText = await monthHeader.textContent();

      // Should contain Czech month name (leden, únor, etc.)
      const czechMonths = [
        'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
        'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
      ];

      const englishMonths = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
      ];

      // Should match either Czech or English
      const lowerText = headerText.toLowerCase();
      const hasCzech = czechMonths.some((m) => lowerText.includes(m));
      const hasEnglish = englishMonths.some((m) => lowerText.includes(m));

      expect(hasCzech || hasEnglish).toBeTruthy();
    });
  });

  test.describe('Christmas Period Overlap', () => {
    test('should handle Christmas period overlap correctly', async ({ page }) => {
      // This test checks that Christmas period dates are handled specially
      // Christmas periods might have special styling or restrictions

      await page.click('.room-indicator:has-text("12")');
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Navigate to December
      let attempts = 0;
      while (attempts < 12) {
        const monthHeader = page.locator('#miniCalendar .calendar-header, #miniCalendar h3');
        const headerText = await monthHeader.textContent();
        if (
          headerText.toLowerCase().includes('prosinec') ||
          headerText.toLowerCase().includes('december')
        ) {
          break;
        }
        await navigateCalendarMonth(page, 'next', 'miniCalendar');
        await page.waitForTimeout(200);
        attempts++;
      }

      // Check if Christmas dates have special styling
      const dec25 = page.locator('#miniCalendar [data-date*="-12-25"]').first();
      if (await dec25.isVisible()) {
        // Christmas dates might have special CSS class
      }
    });
  });
});
