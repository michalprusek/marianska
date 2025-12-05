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
  await page.waitForLoadState('networkidle');

  // Check if already logged in
  const isLoggedIn = await page
    .locator('#adminContent')
    .evaluate((el) => el.style.display !== 'none')
    .catch(() => false);

  if (isLoggedIn) {
    return; // Already logged in
  }

  // Wait for login form and submit via Enter
  await page.waitForSelector('#password', { state: 'visible', timeout: 10000 });
  await page.fill('#password', password);
  await page.press('#password', 'Enter');
  await page.waitForFunction(
    () => document.getElementById('adminContent')?.style.display === 'block',
    { timeout: 10000 }
  );
}

/**
 * Reset database to clean state
 */
async function resetDatabase(page) {
  // ALWAYS reset admin password first (some tests change it)
  const { resetAdminPassword } = require('./reset-admin-password');
  resetAdminPassword();

  // Use API to reset database with admin auth
  await page.goto('/admin.html');
  await page.waitForLoadState('networkidle');

  // Wait for page to initialize
  await page.waitForTimeout(500);

  const isLoggedIn = await page
    .locator('#adminContent')
    .evaluate((el) => el.style.display !== 'none')
    .catch(() => false);

  if (!isLoggedIn) {
    // Wait for login form and submit
    await page.waitForSelector('#password', { state: 'visible', timeout: 10000 });
    await page.fill('#password', 'admin123');
    // Submit form by pressing Enter
    await page.press('#password', 'Enter');
    // Wait for admin content to be visible
    await page.waitForFunction(
      () => document.getElementById('adminContent')?.style.display === 'block',
      { timeout: 10000 }
    );
  }

  // Clear all bookings and blocked dates via API with admin token
  await page.evaluate(async () => {
    const token = localStorage.getItem('adminSessionToken') || '';

    // Get current data
    const response = await fetch('/api/data');
    const data = await response.json();

    // Clear bookings and blocked dates
    data.bookings = [];
    data.blockedDates = [];

    // Save cleared data
    await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token
      },
      body: JSON.stringify(data),
    });

    // Also clear proposed bookings
    await fetch('/api/proposed', {
      method: 'DELETE',
      headers: {
        'x-session-token': token
      },
    }).catch(() => {});

    // Force reload dataManager if exists
    if (window.dataManager) {
      await window.dataManager.syncWithServer();
    }
  });

  // Wait for data to be cleared
  await page.waitForTimeout(200);
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

/**
 * Open single room booking modal for a specific room
 * @param {Page} page - Playwright page
 * @param {string} roomId - Room ID (e.g., '12', '13', '14')
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 */
async function openSingleRoomModal(page, roomId, dateStr) {
  // Navigate to main page if not already there
  const currentUrl = page.url();
  if (!currentUrl.includes('index.html') && !currentUrl.endsWith('/')) {
    await navigateToMainPage(page);
  }

  // Click on the room indicator for the specific date
  // The calendar uses data attributes for room and date
  const selector = `.room-indicator[data-room="${roomId}"], .calendar-day[data-date="${dateStr}"] .room-indicator:has-text("${roomId}")`;

  // Try clicking the room cell
  try {
    await page.click(selector, { timeout: 5000 });
  } catch {
    // Fallback: find by room number text in the calendar
    await page.click(`.room-indicator:has-text("${roomId}")`, { timeout: 5000 });
  }

  // Wait for modal to open
  await page.waitForSelector('#singleRoomBookingModal.active', { timeout: 5000 });
  await page.waitForTimeout(300); // Wait for animation
}

/**
 * Open bulk booking modal
 * @param {Page} page - Playwright page
 */
async function openBulkBookingModal(page) {
  // Click on "Hromadná akce" button
  await page.click('#bulkActionBtn, button:has-text("Hromadná akce"), button:has-text("Bulk booking")');

  // Wait for modal to open
  await page.waitForSelector('#bulkBookingModal.active', { timeout: 5000 });
  await page.waitForTimeout(300); // Wait for animation
}

/**
 * Select date range in mini calendar via clicking
 * Works for both single room and bulk booking calendars
 * @param {Page} page - Playwright page
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} calendarId - Calendar container ID ('miniCalendar' or 'bulkCalendar')
 */
async function selectDateRangeInCalendar(page, startDate, endDate, calendarId = 'miniCalendar') {
  // Click start date
  await page.click(`#${calendarId} [data-date="${startDate}"]`);
  await page.waitForTimeout(200);

  // Click end date
  await page.click(`#${calendarId} [data-date="${endDate}"]`);
  await page.waitForTimeout(200);
}

/**
 * Fill guest names in the guest names section
 * @param {Page} page - Playwright page
 * @param {Array<Object>} guestNames - Array of {firstName, lastName, type: 'adult'|'child'|'toddler'}
 * @param {string} sectionPrefix - Prefix for section IDs ('singleRoom' or 'bulk')
 */
async function fillGuestNames(page, guestNames, sectionPrefix = 'singleRoom') {
  // Group guests by type
  const adults = guestNames.filter(g => g.type === 'adult');
  const children = guestNames.filter(g => g.type === 'child');
  const toddlers = guestNames.filter(g => g.type === 'toddler');

  // Fill adult names
  for (let i = 0; i < adults.length; i++) {
    const idx = i + 1;
    const firstNameSelector = `#${sectionPrefix}GuestNamesSection input[id*="adultFirstName${idx}"], input#adultFirstName${idx}`;
    const lastNameSelector = `#${sectionPrefix}GuestNamesSection input[id*="adultLastName${idx}"], input#adultLastName${idx}`;

    await page.fill(firstNameSelector, adults[i].firstName);
    await page.fill(lastNameSelector, adults[i].lastName);
  }

  // Fill children names
  for (let i = 0; i < children.length; i++) {
    const idx = i + 1;
    const firstNameSelector = `#${sectionPrefix}GuestNamesSection input[id*="childFirstName${idx}"], input#childFirstName${idx}`;
    const lastNameSelector = `#${sectionPrefix}GuestNamesSection input[id*="childLastName${idx}"], input#childLastName${idx}`;

    await page.fill(firstNameSelector, children[i].firstName);
    await page.fill(lastNameSelector, children[i].lastName);
  }

  // Fill toddler names
  for (let i = 0; i < toddlers.length; i++) {
    const idx = i + 1;
    const firstNameSelector = `#${sectionPrefix}GuestNamesSection input[id*="toddlerFirstName${idx}"], input#toddlerFirstName${idx}`;
    const lastNameSelector = `#${sectionPrefix}GuestNamesSection input[id*="toddlerLastName${idx}"], input#toddlerLastName${idx}`;

    await page.fill(firstNameSelector, toddlers[i].firstName);
    await page.fill(lastNameSelector, toddlers[i].lastName);
  }
}

/**
 * Toggle guest pricing type (ÚTIA vs External) for a specific guest
 * @param {Page} page - Playwright page
 * @param {number} guestIndex - 1-based index of the guest
 * @param {boolean} toExternal - If true, set to External; if false, set to ÚTIA
 * @param {string} guestType - 'adult', 'child', or 'toddler'
 */
async function toggleGuestPricingType(page, guestIndex, toExternal = true, guestType = 'adult') {
  const toggleSelector = `input[data-guest-price-type][data-guest-index="${guestIndex}"][data-guest-type="${guestType}"]`;

  const toggle = page.locator(toggleSelector);
  const isChecked = await toggle.isChecked();

  // Unchecked = ÚTIA, Checked = External
  if (toExternal && !isChecked) {
    await toggle.check();
  } else if (!toExternal && isChecked) {
    await toggle.uncheck();
  }

  await page.waitForTimeout(100); // Wait for price recalculation
}

/**
 * Adjust guest count in single room or bulk booking modal
 * @param {Page} page - Playwright page
 * @param {string} guestType - 'adults', 'children', or 'toddlers'
 * @param {number} change - Positive to increase, negative to decrease
 * @param {string} modalType - 'singleRoom' or 'bulk'
 */
async function adjustGuestCount(page, guestType, change, modalType = 'singleRoom') {
  const direction = change > 0 ? 'increase' : 'decrease';
  const clicks = Math.abs(change);

  // Determine button selector based on modal type
  let buttonSelector;
  if (modalType === 'bulk') {
    buttonSelector = change > 0
      ? `button[onclick*="adjustBulkGuests('${guestType.replace('s', '')}', 1)"]`
      : `button[onclick*="adjustBulkGuests('${guestType.replace('s', '')}', -1)"]`;
  } else {
    buttonSelector = change > 0
      ? `#${modalType}${guestType.charAt(0).toUpperCase() + guestType.slice(1)}Increase, button[data-action="${direction}-${guestType}"]`
      : `#${modalType}${guestType.charAt(0).toUpperCase() + guestType.slice(1)}Decrease, button[data-action="${direction}-${guestType}"]`;
  }

  for (let i = 0; i < clicks; i++) {
    await page.click(buttonSelector);
    await page.waitForTimeout(100);
  }
}

/**
 * Get the displayed price value from an element
 * @param {Page} page - Playwright page
 * @param {string} selector - CSS selector for price element
 * @returns {Promise<number>} Price as a number
 */
async function getPriceValue(page, selector) {
  const text = await page.locator(selector).textContent();
  // Extract number from text like "1 500 Kč" or "1500 Kč"
  const match = text.match(/(\d+(?:\s?\d+)*)/);
  if (match) {
    return parseInt(match[1].replace(/\s/g, ''), 10);
  }
  return 0;
}

/**
 * Create a proposed booking and add it to temp reservations
 * @param {Page} page - Playwright page
 * @param {Object} options - Booking options
 */
async function createProposedBooking(page, options) {
  const {
    roomId,
    startDate,
    endDate,
    guests = [{ firstName: 'Test', lastName: 'User', type: 'adult' }]
  } = options;

  await openSingleRoomModal(page, roomId, startDate);
  await selectDateRangeInCalendar(page, startDate, endDate, 'miniCalendar');
  await page.waitForTimeout(300);

  // Fill guest names
  await fillGuestNames(page, guests, 'singleRoom');

  // Click confirm button
  await page.click('#confirmSingleRoomBtn');
  await page.waitForTimeout(500);
}

/**
 * Fill contact form in finalization modal
 * @param {Page} page - Playwright page
 * @param {Object} contactData - Contact information
 */
async function fillContactForm(page, contactData) {
  const defaults = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '123456789',
    company: 'Test Company',
    address: 'Test Address 123',
    city: 'Praha',
    zip: '12345',
    ...contactData,
  };

  // Fill required fields
  await page.fill('#bookingName, input[name="name"]', defaults.name);
  await page.fill('#bookingEmail, input[name="email"]', defaults.email);
  await page.fill('#bookingPhone, input[name="phone"]', defaults.phone);
  await page.fill('#bookingCompany, input[name="company"]', defaults.company);
  await page.fill('#bookingAddress, input[name="address"]', defaults.address);
  await page.fill('#bookingCity, input[name="city"]', defaults.city);
  await page.fill('#bookingZip, input[name="zip"]', defaults.zip);

  // Fill optional fields if provided
  if (defaults.ico) {
    await page.fill('#bookingIco, input[name="ico"]', defaults.ico);
  }
  if (defaults.dic) {
    await page.fill('#bookingDic, input[name="dic"]', defaults.dic);
  }
  if (defaults.notes) {
    await page.fill('#bookingNotes, textarea[name="notes"]', defaults.notes);
  }
  if (defaults.christmasCode) {
    await page.fill('#bookingChristmasCode, input[name="christmasCode"]', defaults.christmasCode);
  }
}

/**
 * Navigate to edit page with token
 * @param {Page} page - Playwright page
 * @param {string} editToken - Edit token from booking creation
 */
async function navigateToEditPage(page, editToken) {
  await page.goto(`/edit.html?token=${editToken}`);
  await page.waitForSelector('#editFormContainer, #editDeadlineWarning, .edit-error', { timeout: 10000 });
}

/**
 * Create a blockage via API
 * @param {Page} page - Playwright page
 * @param {Object} options - Blockage options
 */
async function createBlockageViaAPI(page, options) {
  const { startDate, endDate, roomId, rooms = [], reason = 'Test blockage' } = options;

  // Normalize: if roomId is provided, convert to rooms array
  const normalizedRooms = roomId ? [roomId] : rooms;

  return await page.evaluate(async ({ startDate, endDate, rooms, reason }) => {
    const response = await fetch('/api/blockage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': localStorage.getItem('adminSessionToken') || ''
      },
      body: JSON.stringify({
        startDate,
        endDate,
        rooms,
        reason,
      }),
    });
    return response.json();
  }, { startDate, endDate, rooms: normalizedRooms, reason });
}

/**
 * Wait for notification with specific message
 * @param {Page} page - Playwright page
 * @param {string} messageContains - Text the notification should contain
 * @param {string} type - Notification type ('success', 'error', 'warning', 'info')
 */
async function waitForNotification(page, messageContains, type = null) {
  const typeSelector = type ? `.notification.${type}` : '.notification';

  await page.waitForSelector(typeSelector, { timeout: 5000 });

  if (messageContains) {
    const notification = page.locator(typeSelector).filter({ hasText: messageContains });
    await expect(notification).toBeVisible({ timeout: 5000 });
    return notification;
  }

  return page.locator(typeSelector).first();
}

/**
 * Get count of temporary reservations in sidebar
 * @param {Page} page - Playwright page
 * @returns {Promise<number>} Count of temp reservations
 */
async function getTempReservationsCount(page) {
  const items = page.locator('#tempReservationsContainer .temp-reservation-item, #tempReservationsContainer .reservation-item');
  return await items.count();
}

/**
 * Click finalize button and wait for form modal
 * @param {Page} page - Playwright page
 */
async function clickFinalizeAndWaitForForm(page) {
  await page.click('#finalizeBtn, button:has-text("Dokončit rezervaci"), button:has-text("Finalize")');
  await page.waitForSelector('#bookingFormModal.active', { timeout: 5000 });
}

/**
 * Close single room booking modal
 * @param {Page} page - Playwright page
 */
async function closeSingleRoomModal(page) {
  const closeBtn = page.locator('#singleRoomBookingModal .close-btn, #singleRoomBookingModal [data-action="close"]');
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  } else {
    // Click outside modal
    await page.click('.modal-backdrop', { force: true });
  }
  await page.waitForSelector('#singleRoomBookingModal.active', { state: 'hidden', timeout: 3000 }).catch(() => {});
}

/**
 * Close bulk booking modal
 * @param {Page} page - Playwright page
 */
async function closeBulkBookingModal(page) {
  const closeBtn = page.locator('#bulkBookingModal .close-btn, #bulkBookingModal [data-action="close"]');
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  }
  await page.waitForSelector('#bulkBookingModal.active', { state: 'hidden', timeout: 3000 }).catch(() => {});
}

/**
 * Get future date string in YYYY-MM-DD format
 * @param {number} daysFromNow - Number of days from today
 * @returns {string} Date string
 */
function getFutureDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

/**
 * Get current month's dates for testing
 * @returns {Object} Object with firstAvailable, lastAvailable dates
 */
function getTestDates() {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() + 7); // Start 7 days from now

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 2); // 2 nights

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Navigate month in calendar
 * @param {Page} page - Playwright page
 * @param {number} direction - 1 for next, -1 for previous
 * @param {string} calendarId - Calendar container ID
 */
async function navigateCalendarMonth(page, direction, calendarId = 'miniCalendar') {
  const buttonSelector = direction > 0
    ? `#${calendarId} .nav-next, #${calendarId} button:has-text("›")`
    : `#${calendarId} .nav-prev, #${calendarId} button:has-text("‹")`;

  await page.click(buttonSelector);
  await page.waitForTimeout(300);
}

/**
 * Set mock date for testing date-dependent features
 * @param {Page} page - Playwright page
 * @param {string} dateString - Date string to mock (YYYY-MM-DD)
 */
async function setMockDate(page, dateString) {
  await page.addInitScript((mockDate) => {
    const RealDate = Date;
    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(mockDate);
        } else {
          super(...args);
        }
      }
      static now() {
        return new RealDate(mockDate).getTime();
      }
    }
    globalThis.Date = MockDate;
  }, dateString);
}

/**
 * Get statistics values from admin panel
 * @param {Page} page - Playwright page
 * @returns {Promise<Object>} Statistics values
 */
async function getStatisticsValues(page) {
  await page.click('button:has-text("Statistiky"), [data-tab="statistics"]');
  await page.waitForTimeout(500);

  const totalBookings = await page.locator('#totalBookings, .stat-total-bookings').textContent().catch(() => '0');
  const totalRevenue = await page.locator('#totalRevenue, .stat-total-revenue').textContent().catch(() => '0');
  const occupancy = await page.locator('#occupancyRate, .stat-occupancy').textContent().catch(() => '0%');

  return {
    totalBookings: parseInt(totalBookings.replace(/\D/g, ''), 10) || 0,
    totalRevenue: parseInt(totalRevenue.replace(/\D/g, ''), 10) || 0,
    occupancy: parseFloat(occupancy) || 0,
  };
}

/**
 * Switch language in the app
 * @param {Page} page - Playwright page
 * @param {string} language - 'cs' or 'en'
 */
async function switchLanguage(page, language) {
  const currentLang = await page.locator('#languageToggle, .language-toggle').textContent().catch(() => 'CZ');
  const targetLang = language === 'en' ? 'EN' : 'CZ';

  if (!currentLang.includes(targetLang)) {
    await page.click('#languageToggle, .language-toggle');
    await page.waitForTimeout(300);
  }
}

/**
 * Delete a temp reservation from the sidebar
 * @param {Page} page - Playwright page
 * @param {number} index - 0-based index of the reservation to delete
 */
async function deleteTempReservation(page, index = 0) {
  const deleteBtn = page.locator('#tempReservationsContainer .delete-btn, #tempReservationsContainer [data-action="delete"]').nth(index);
  await deleteBtn.click();

  // Handle confirmation dialog if present
  const confirmBtn = page.locator('.modal.active .btn-danger, .modal.active button:has-text("Smazat")');
  if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmBtn.click();
  }

  await page.waitForTimeout(300);
}

/**
 * Edit a temp reservation from the sidebar
 * @param {Page} page - Playwright page
 * @param {number} index - 0-based index of the reservation to edit
 */
async function editTempReservation(page, index = 0) {
  const editBtn = page.locator('#tempReservationsContainer .edit-btn, #tempReservationsContainer [data-action="edit"]').nth(index);
  await editBtn.click();

  // Wait for appropriate modal to open
  await page.waitForSelector('#singleRoomBookingModal.active, #bulkBookingModal.active', { timeout: 5000 });
  await page.waitForTimeout(300);
}

module.exports = {
  // Existing helpers
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

  // New helpers
  openSingleRoomModal,
  openBulkBookingModal,
  selectDateRangeInCalendar,
  fillGuestNames,
  toggleGuestPricingType,
  adjustGuestCount,
  getPriceValue,
  createProposedBooking,
  fillContactForm,
  navigateToEditPage,
  createBlockageViaAPI,
  waitForNotification,
  getTempReservationsCount,
  clickFinalizeAndWaitForForm,
  closeSingleRoomModal,
  closeBulkBookingModal,
  getFutureDate,
  getTestDates,
  navigateCalendarMonth,
  setMockDate,
  getStatisticsValues,
  switchLanguage,
  deleteTempReservation,
  editTempReservation,
};
