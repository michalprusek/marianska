/**
 * E2E Test Helpers for Chata Mariánská
 * Reusable functions for Playwright tests
 */

const { expect } = require('@playwright/test');

/**
 * Navigate to the main page and wait for app to load
 */
async function navigateToMainPage(page) {
  await page.goto('/');
  await page.waitForSelector('#calendar', { state: 'visible' });
  await page.waitForTimeout(500); // Wait for calendar to render
}

/**
 * Login to admin panel
 */
async function loginAsAdmin(page, password = 'admin123') {
  await page.goto('/admin.html');
  await page.fill('#password', password);
  await page.click('button:has-text("Přihlásit")');
  await page.waitForSelector('.admin-tabs', { state: 'visible' });
}

/**
 * Reset database to clean state
 */
async function resetDatabase(page) {
  // Use API or admin panel to clear all bookings
  await page.goto('/admin.html');
  const isLoggedIn = await page
    .locator('.admin-tabs')
    .isVisible()
    .catch(() => false);

  if (!isLoggedIn) {
    await loginAsAdmin(page);
  }

  // Clear all bookings via API
  await page.evaluate(async () => {
    const response = await fetch('/api/data');
    const data = await response.json();

    // Clear bookings
    data.bookings = [];
    data.blockedDates = [];

    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  });
}

/**
 * Create a test booking via API
 */
async function createTestBooking(page, booking) {
  const defaultBooking = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+420123456789',
    startDate: '2025-11-01',
    endDate: '2025-11-03',
    rooms: ['12'],
    guestType: 'utia',
    adults: 2,
    children: 0,
    toddlers: 0,
    company: 'Test Company',
    address: 'Test Address 123',
    city: 'Praha',
    zip: '12345',
    ico: '12345678',
    dic: 'CZ12345678',
    notes: 'Test booking',
    ...booking,
  };

  const result = await page.evaluate(async (bookingData) => {
    const response = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData),
    });
    return response.json();
  }, defaultBooking);

  return result;
}

/**
 * Fill booking form step 1 (dates and rooms)
 */
async function fillBookingFormStep1(
  page,
  { startDate, endDate, roomIds, guestType, adults, children }
) {
  // Select dates in calendar
  await page.click(`[data-date="${startDate}"]`);
  await page.click(`[data-date="${endDate}"]`);

  // Select rooms
  for (const roomId of roomIds) {
    await page.click(`input[value="${roomId}"]`);
  }

  // Select guest type
  await page.selectOption('#guestType', guestType);

  // Fill guest counts
  await page.fill('#adults', adults.toString());
  if (children) {
    await page.fill('#children', children.toString());
  }

  // Proceed to step 2
  await page.click('button:has-text("Pokračovat")');
}

/**
 * Fill booking form step 2 (personal details)
 */
async function fillBookingFormStep2(page, personalData) {
  const defaults = {
    name: 'Jan Novák',
    email: 'jan.novak@example.com',
    phone: '123456789',
    company: 'Test s.r.o.',
    address: 'Hlavní 123',
    city: 'Praha',
    zip: '12345',
    ico: '12345678',
    dic: 'CZ12345678',
    notes: '',
    ...personalData,
  };

  await page.fill('#name', defaults.name);
  await page.fill('#email', defaults.email);
  await page.fill('#phone', defaults.phone);
  await page.fill('#company', defaults.company);
  await page.fill('#address', defaults.address);
  await page.fill('#city', defaults.city);
  await page.fill('#zip', defaults.zip);

  if (defaults.ico) {
    await page.fill('#ico', defaults.ico);
  }
  if (defaults.dic) {
    await page.fill('#dic', defaults.dic);
  }
  if (defaults.notes) {
    await page.fill('#notes', defaults.notes);
  }
}

/**
 * Submit booking form
 */
async function submitBookingForm(page) {
  await page.click('button:has-text("Rezervovat")');
  await page.waitForSelector('.confirmation-message, .error-message', { timeout: 10000 });
}

/**
 * Wait for calendar to load
 */
async function waitForCalendar(page) {
  await page.waitForSelector('#calendar', { state: 'visible' });
  await page.waitForTimeout(500);
}

/**
 * Get room availability for a specific date
 * Works with both grid calendar (main page) and BaseCalendar (single/bulk mode)
 */
function getRoomAvailability(page, roomId, date) {
  return page.evaluate(
    ({ roomId: rid, date: dt }) => {
      // Try BaseCalendar format first (single room / bulk booking)
      const baseCalendarCell = document.querySelector(`[data-room="${rid}"][data-date="${dt}"]`);
      if (baseCalendarCell) {
        return {
          available: baseCalendarCell.classList.contains('available'),
          occupied: baseCalendarCell.classList.contains('occupied'),
          blocked: baseCalendarCell.classList.contains('blocked'),
          proposed: baseCalendarCell.classList.contains('proposed'),
          edge: baseCalendarCell.classList.contains('edge'),
        };
      }

      // Try grid calendar format (main page with all rooms)
      // Find all calendar days and check for the date
      const allDays = Array.from(document.querySelectorAll('.calendar-day'));
      for (const dayEl of allDays) {
        // Check if this day contains room indicators
        const roomIndicators = dayEl.querySelectorAll('.room-indicator');
        if (roomIndicators.length === 0) {
          continue;
        }

        // Get the date from day number and context
        const dayNumber = dayEl.querySelector('.calendar-day-number');
        if (!dayNumber) {
          continue;
        }

        // Find room indicator matching our roomId
        const roomEl = Array.from(roomIndicators).find((el) => el.textContent.trim() === rid);
        if (roomEl) {
          // Try to match the date (approximation - would need more context)
          // For now, just return the status of the room
          return {
            available: roomEl.classList.contains('available'),
            occupied: roomEl.classList.contains('occupied'),
            blocked: roomEl.classList.contains('blocked'),
            proposed: roomEl.classList.contains('proposed'),
            edge: roomEl.classList.contains('edge'),
          };
        }
      }

      return null;
    },
    { roomId, date }
  );
}

/**
 * Check if date is in Christmas period
 */
function isChristmasPeriod(page, date) {
  return page.evaluate((dt) => {
    const settings = JSON.parse(localStorage.getItem('chataMarianska'))?.settings;
    if (!settings?.christmasPeriod) {
      return false;
    }

    const { start, end } = settings.christmasPeriod;
    return dt >= start && dt <= end;
  }, date);
}

/**
 * Set Christmas period in settings
 */
async function setChristmasPeriod(page, startDate, endDate, accessCodes = ['TEST2025']) {
  await page.evaluate(
    ({ start, end, codes }) => {
      const data = JSON.parse(localStorage.getItem('chataMarianska')) || {};
      data.settings = data.settings || {};
      data.settings.christmasPeriod = { start, end };
      data.settings.christmasAccessCodes = codes;
      localStorage.setItem('chataMarianska', JSON.stringify(data));
    },
    { start: startDate, end: endDate, codes: accessCodes }
  );
}

/**
 * Get all bookings from localStorage
 */
function getAllBookings(page) {
  return page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('chataMarianska'));
    return data?.bookings || [];
  });
}

/**
 * Get booking by ID
 */
async function getBookingById(page, bookingId) {
  const bookings = await getAllBookings(page);
  return bookings.find((b) => b.id === bookingId);
}

/**
 * Expect element to be visible
 */
async function expectVisible(page, selector) {
  await expect(page.locator(selector)).toBeVisible();
}

/**
 * Expect element to have text
 */
async function expectText(page, selector, text) {
  await expect(page.locator(selector)).toHaveText(text);
}

/**
 * Expect element to contain text
 */
async function expectContainsText(page, selector, text) {
  await expect(page.locator(selector)).toContainText(text);
}

module.exports = {
  navigateToMainPage,
  loginAsAdmin,
  resetDatabase,
  createTestBooking,
  fillBookingFormStep1,
  fillBookingFormStep2,
  submitBookingForm,
  waitForCalendar,
  getRoomAvailability,
  isChristmasPeriod,
  setChristmasPeriod,
  getAllBookings,
  getBookingById,
  expectVisible,
  expectText,
  expectContainsText,
};
