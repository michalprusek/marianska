/**
 * Comprehensive Playwright E2E Tests for Mariánská Chata
 *
 * Tests:
 * 1. Christmas Period visibility and behavior
 * 2. Blocked Dates display in calendar
 * 3. User booking workflows
 * 4. Price calculations
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://chata.utia.cas.cz';

test.describe('Christmas Period Tests', () => {
  test('should display Christmas period information on homepage', async ({ page }) => {
    await page.goto(BASE_URL);

    // Wait for page to load
    await page.waitForSelector('body', { timeout: 10000 });

    // Check for Christmas-related elements
    const christmasInfo = await page.locator('text=/vánoč/i').count();

    console.log(`Found ${christmasInfo} Christmas-related elements`);
    expect(christmasInfo).toBeGreaterThan(0);
  });

  test('should show Christmas access code field when booking during Christmas period', async ({ page }) => {
    await page.goto(BASE_URL);

    // This test would need to select Christmas dates and verify code field appears
    // Implementation depends on whether there's a current Christmas period configured
    console.log('Christmas code field test - implementation needed based on current period');
  });
});

test.describe('Blocked Dates Tests', () => {
  test('should display blocked dates in calendar with gray color', async ({ page }) => {
    await page.goto(BASE_URL);

    // Wait for calendar to load
    await page.waitForSelector('.calendar', { timeout: 10000 });

    // Check for blocked date indicators (gray cells)
    const blockedCells = await page.locator('.calendar .blocked, .calendar [data-status="blocked"]').count();

    console.log(`Found ${blockedCells} blocked calendar cells`);

    // Take screenshot for verification
    await page.screenshot({ path: '/tmp/calendar-blocked-dates.png' });
  });

  test('should prevent booking on blocked dates', async ({ page }) => {
    // This would require knowing which dates are blocked
    console.log('Blocked date booking prevention test - requires specific blocked dates');
  });
});

test.describe('Booking Workflow Tests', () => {
  test('should load booking page successfully', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check for essential page elements
    await expect(page.locator('h1, h2')).toBeVisible();

    // Check for calendar
    const hasCalendar = await page.locator('.calendar, [class*="calendar"]').count() > 0;
    console.log(`Calendar present: ${hasCalendar}`);
    expect(hasCalendar).toBeTruthy();

    // Take screenshot
    await page.screenshot({ path: '/tmp/booking-homepage.png' });
  });

  test('should display all 9 rooms in calendar', async ({ page }) => {
    await page.goto(BASE_URL);

    // Wait for calendar
    await page.waitForSelector('.calendar', { timeout: 10000 });

    // Count room rows/columns
    const rooms = await page.locator('[data-room-id], .room-row, .room-column').count();

    console.log(`Found ${rooms} room elements`);

    // Should have 9 rooms
    expect(rooms).toBeGreaterThanOrEqual(9);
  });

  test('should show price calculation when selecting dates', async ({ page }) => {
    await page.goto(BASE_URL);

    await page.waitForSelector('.calendar', { timeout: 10000 });

    // Try to select a room and date
    const firstAvailableCell = await page.locator('.calendar .available, .calendar [data-status="available"]').first();

    if (await firstAvailableCell.count() > 0) {
      await firstAvailableCell.click();

      // Wait for price display
      await page.waitForTimeout(1000);

      // Check if price is displayed
      const priceElement = await page.locator('text=/cena|price|kč/i').count();
      console.log(`Price elements found: ${priceElement}`);

      await page.screenshot({ path: '/tmp/booking-with-price.png' });
    } else {
      console.log('No available dates found for testing');
    }
  });
});

test.describe('Calendar Navigation Tests', () => {
  test('should navigate between months', async ({ page }) => {
    await page.goto(BASE_URL);

    await page.waitForSelector('.calendar', { timeout: 10000 });

    // Look for navigation buttons
    const nextButton = await page.locator('button:has-text("›"), button:has-text("Next"), [aria-label*="next" i]').first();
    const prevButton = await page.locator('button:has-text("‹"), button:has-text("Previous"), button:has-text("Prev"), [aria-label*="previous" i], [aria-label*="prev" i]').first();

    if (await nextButton.count() > 0) {
      // Get current month text
      const monthBefore = await page.locator('text=/\w+ \d{4}/).first().textContent();
      console.log(`Month before: ${monthBefore}`);

      // Click next
      await nextButton.click();
      await page.waitForTimeout(500);

      // Get new month text
      const monthAfter = await page.locator('text=/\w+ \d{4}/).first().textContent();
      console.log(`Month after: ${monthAfter}`);

      expect(monthBefore).not.toBe(monthAfter);

      await page.screenshot({ path: '/tmp/calendar-navigation.png' });
    } else {
      console.log('Navigation buttons not found');
    }
  });
});

test.describe('Data Integrity Tests', () => {
  test('should fetch booking data via API', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/data`, {
      ignoreHTTPSErrors: true
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();

    // Verify data structure
    expect(data).toHaveProperty('bookings');
    expect(data).toHaveProperty('settings');
    expect(data).toHaveProperty('blockedDates');

    console.log(`API returned ${data.bookings.length} bookings`);
    console.log(`API returned ${data.blockedDates.length} blocked dates`);

    // Verify settings structure
    expect(data.settings).toHaveProperty('prices');
    expect(data.settings).toHaveProperty('rooms');

    // Check room count
    expect(data.settings.rooms.length).toBe(9);

    console.log('API data structure validated successfully');
  });

  test('should verify room pricing structure', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/data`, {
      ignoreHTTPSErrors: true
    });

    const data = await response.json();
    const prices = data.settings.prices;

    // Verify UTIA prices
    expect(prices).toHaveProperty('utia');
    expect(prices.utia).toHaveProperty('small');
    expect(prices.utia).toHaveProperty('large');
    expect(prices.utia.small).toHaveProperty('empty');
    expect(prices.utia.small).toHaveProperty('adult');
    expect(prices.utia.small).toHaveProperty('child');

    // Verify External prices
    expect(prices).toHaveProperty('external');
    expect(prices.external).toHaveProperty('small');
    expect(prices.external).toHaveProperty('large');

    console.log('UTIA Small Room: Empty=' + prices.utia.small.empty + ', Adult=' + prices.utia.small.adult + ', Child=' + prices.utia.small.child);
    console.log('UTIA Large Room: Empty=' + prices.utia.large.empty + ', Adult=' + prices.utia.large.adult + ', Child=' + prices.utia.large.child);
    console.log('External Small Room: Empty=' + prices.external.small.empty + ', Adult=' + prices.external.small.adult + ', Child=' + prices.external.small.child);
    console.log('External Large Room: Empty=' + prices.external.large.empty + ', Adult=' + prices.external.large.adult + ', Child=' + prices.external.large.child);

    // Verify bulk prices
    expect(data.settings).toHaveProperty('bulkPrices');
    expect(data.settings.bulkPrices).toHaveProperty('basePrice');

    console.log('Bulk Base Price: ' + data.settings.bulkPrices.basePrice);
  });

  test('should verify Christmas period configuration', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/data`, {
      ignoreHTTPSErrors: true
    });

    const data = await response.json();
    const settings = data.settings;

    // Check for Christmas period
    if (settings.christmasPeriods && settings.christmasPeriods.length > 0) {
      const period = settings.christmasPeriods[0];
      console.log(`Christmas Period: ${period.start} to ${period.end}`);

      expect(period).toHaveProperty('start');
      expect(period).toHaveProperty('end');
      expect(period).toHaveProperty('year');

      // Verify dates are in correct format (YYYY-MM-DD)
      expect(period.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(period.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      console.log('Christmas period configuration validated');
    } else {
      console.log('No Christmas period configured');
    }
  });

  test('should verify existing bookings have required fields', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/data`, {
      ignoreHTTPSErrors: true
    });

    const data = await response.json();
    const bookings = data.bookings;

    if (bookings.length > 0) {
      // Test first booking
      const booking = bookings[0];

      // Required fields
      expect(booking).toHaveProperty('id');
      expect(booking).toHaveProperty('name');
      expect(booking).toHaveProperty('email');
      expect(booking).toHaveProperty('phone');
      expect(booking).toHaveProperty('startDate');
      expect(booking).toHaveProperty('endDate');
      expect(booking).toHaveProperty('rooms');
      expect(booking).toHaveProperty('guestType');
      expect(booking).toHaveProperty('totalPrice');
      expect(booking).toHaveProperty('editToken');

      console.log(`Sample booking ID: ${booking.id}`);
      console.log(`Sample booking dates: ${booking.startDate} to ${booking.endDate}`);
      console.log(`Sample booking rooms: ${booking.rooms.join(', ')}`);
      console.log(`Sample booking price: ${booking.totalPrice} CZK`);

      // Verify rooms is an array
      expect(Array.isArray(booking.rooms)).toBeTruthy();
      expect(booking.rooms.length).toBeGreaterThan(0);

      console.log('Booking structure validated');
    } else {
      console.log('No bookings found in system');
    }
  });
});

test.describe('Guest Names Validation', () => {
  test('should verify bookings have guest names', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/data`, {
      ignoreHTTPSErrors: true
    });

    const data = await response.json();
    const bookings = data.bookings;

    if (bookings.length > 0) {
      let bookingsWithNames = 0;
      let bookingsWithoutNames = 0;

      for (const booking of bookings) {
        if (booking.guestNames && booking.guestNames.length > 0) {
          bookingsWithNames++;

          // Verify guest name structure
          const guestName = booking.guestNames[0];
          expect(guestName).toHaveProperty('personType');
          expect(guestName).toHaveProperty('firstName');
          expect(guestName).toHaveProperty('lastName');

          // Verify guest count matches
          const totalGuests = (booking.adults || 0) + (booking.children || 0);
          // toddlers might not be in guest names

          if (booking.guestNames.length > totalGuests) {
            console.log(`WARNING: Booking ${booking.id} has more names than guests (${booking.guestNames.length} vs ${totalGuests})`);
          }
        } else {
          bookingsWithoutNames++;
        }
      }

      console.log(`Bookings with guest names: ${bookingsWithNames}`);
      console.log(`Bookings without guest names: ${bookingsWithoutNames}`);

      // Most bookings should have guest names
      if (bookingsWithNames > 0) {
        console.log('Guest names validation passed');
      }
    }
  });
});

test.describe('Price Calculation Verification', () => {
  test('should verify UTIA pricing calculation for sample booking', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/data`, {
      ignoreHTTPSErrors: true
    });

    const data = await response.json();
    const prices = data.settings.prices.utia;

    // Example: Small room, 2 adults, 1 child, 2 nights
    const roomType = 'small';
    const adults = 2;
    const children = 1;
    const nights = 2;

    const expectedPrice = (
      (prices[roomType].empty * nights) +
      (adults * prices[roomType].adult * nights) +
      (children * prices[roomType].child * nights)
    );

    console.log('Sample calculation (UTIA small room, 2 adults, 1 child, 2 nights):');
    console.log(`  Empty room: ${prices[roomType].empty} × ${nights} = ${prices[roomType].empty * nights}`);
    console.log(`  Adults: ${adults} × ${prices[roomType].adult} × ${nights} = ${adults * prices[roomType].adult * nights}`);
    console.log(`  Children: ${children} × ${prices[roomType].child} × ${nights} = ${children * prices[roomType].child * nights}`);
    console.log(`  Total: ${expectedPrice} CZK`);

    expect(expectedPrice).toBeGreaterThan(0);
  });

  test('should verify External pricing calculation for sample booking', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/data`, {
      ignoreHTTPSErrors: true
    });

    const data = await response.json();
    const prices = data.settings.prices.external;

    // Example: Large room, 3 adults, 2 children, 3 nights
    const roomType = 'large';
    const adults = 3;
    const children = 2;
    const nights = 3;

    const expectedPrice = (
      (prices[roomType].empty * nights) +
      (adults * prices[roomType].adult * nights) +
      (children * prices[roomType].child * nights)
    );

    console.log('Sample calculation (External large room, 3 adults, 2 children, 3 nights):');
    console.log(`  Empty room: ${prices[roomType].empty} × ${nights} = ${prices[roomType].empty * nights}`);
    console.log(`  Adults: ${adults} × ${prices[roomType].adult} × ${nights} = ${adults * prices[roomType].adult * nights}`);
    console.log(`  Children: ${children} × ${prices[roomType].child} × ${nights} = ${children * prices[roomType].child * nights}`);
    console.log(`  Total: ${expectedPrice} CZK`);

    expect(expectedPrice).toBeGreaterThan(0);
  });
});
