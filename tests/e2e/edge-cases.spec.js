/**
 * E2E Tests for Edge Cases and Integration Scenarios
 * Tests error handling, conflict detection, and complex scenarios
 */

const { test, expect } = require('@playwright/test');
const { navigateToMainPage, resetDatabase, createTestBooking } = require('./helpers/test-helpers');

test.describe('Booking Conflicts', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
  });

  test('should prevent double booking of same room', async ({ page }) => {
    // Create first booking
    await createTestBooking(page, {
      name: 'First Booking',
      email: 'first@test.cz',
      startDate: '2025-11-01',
      endDate: '2025-11-03',
      rooms: ['12'],
    });

    // Try to create overlapping booking
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Second Booking',
            email: 'second@test.cz',
            startDate: '2025-11-02',
            endDate: '2025-11-04',
            rooms: ['12'],
            guestType: 'utia',
            adults: 2,
            children: 0,
            toddlers: 0,
            phone: '+420123456789',
            company: 'Test',
            address: 'Test 123',
            city: 'Praha',
            zip: '12345',
          }),
        });
        return { status: response.status, data: await response.json() };
      } catch (error) {
        return { error: error.message };
      }
    });

    // Should fail with conflict error
    expect(result.status).not.toBe(200);
  });

  test('should allow booking same room on different dates', async ({ page }) => {
    // Create first booking
    await createTestBooking(page, {
      name: 'First Booking',
      email: 'first@test.cz',
      startDate: '2025-11-01',
      endDate: '2025-11-03',
      rooms: ['12'],
    });

    // Create non-overlapping booking
    const result = await createTestBooking(page, {
      name: 'Second Booking',
      email: 'second@test.cz',
      startDate: '2025-11-05',
      endDate: '2025-11-07',
      rooms: ['12'],
    });

    expect(result.success || result.id).toBeTruthy();
  });

  test('should handle edge-to-edge bookings (checkout/checkin same day)', async ({ page }) => {
    // Create first booking ending on Nov 3
    await createTestBooking(page, {
      name: 'First Booking',
      email: 'first@test.cz',
      startDate: '2025-11-01',
      endDate: '2025-11-03',
      rooms: ['12'],
    });

    // Create second booking starting on Nov 4 (next day - should work)
    const result = await createTestBooking(page, {
      name: 'Second Booking',
      email: 'second@test.cz',
      startDate: '2025-11-04',
      endDate: '2025-11-06',
      rooms: ['12'],
    });

    expect(result.success || result.id).toBeTruthy();
  });

  test('should prevent booking on blocked dates', async ({ page }) => {
    // Block dates via API
    await page.evaluate(async () => {
      const response = await fetch('/api/data');
      const data = await response.json();

      data.blockedDates = [
        {
          date: '2025-11-15',
          roomId: '12',
          reason: 'Maintenance',
          blockageId: 'BLK123',
          blockedAt: new Date().toISOString(),
        },
      ];

      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    });

    // Try to book on blocked date
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test Booking',
            email: 'test@test.cz',
            startDate: '2025-11-15',
            endDate: '2025-11-17',
            rooms: ['12'],
            guestType: 'utia',
            adults: 2,
            children: 0,
            toddlers: 0,
            phone: '+420123456789',
            company: 'Test',
            address: 'Test 123',
            city: 'Praha',
            zip: '12345',
          }),
        });
        return { status: response.status, data: await response.json() };
      } catch (error) {
        return { error: error.message };
      }
    });

    // Should fail due to blocked date
    expect(result.status).not.toBe(200);
  });
});

test.describe('Data Validation', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
  });

  test('should reject booking with invalid email', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User',
            email: 'invalid-email',
            startDate: '2025-11-01',
            endDate: '2025-11-03',
            rooms: ['12'],
            guestType: 'utia',
            adults: 2,
            children: 0,
            toddlers: 0,
            phone: '+420123456789',
            company: 'Test',
            address: 'Test 123',
            city: 'Praha',
            zip: '12345',
          }),
        });
        return { status: response.status, data: await response.json() };
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result.status).not.toBe(200);
  });

  test('should reject booking with invalid phone number', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User',
            email: 'test@test.cz',
            startDate: '2025-11-01',
            endDate: '2025-11-03',
            rooms: ['12'],
            guestType: 'utia',
            adults: 2,
            children: 0,
            toddlers: 0,
            phone: '123', // Too short
            company: 'Test',
            address: 'Test 123',
            city: 'Praha',
            zip: '12345',
          }),
        });
        return { status: response.status, data: await response.json() };
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result.status).not.toBe(200);
  });

  test('should reject booking with invalid date range', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User',
            email: 'test@test.cz',
            startDate: '2025-11-05',
            endDate: '2025-11-03', // End before start
            rooms: ['12'],
            guestType: 'utia',
            adults: 2,
            children: 0,
            toddlers: 0,
            phone: '+420123456789',
            company: 'Test',
            address: 'Test 123',
            city: 'Praha',
            zip: '12345',
          }),
        });
        return { status: response.status, data: await response.json() };
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result.status).not.toBe(200);
  });

  test('should reject booking with missing required fields', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User',
            // Missing email
            startDate: '2025-11-01',
            endDate: '2025-11-03',
            rooms: ['12'],
            guestType: 'utia',
            adults: 2,
          }),
        });
        return { status: response.status, data: await response.json() };
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result.status).not.toBe(200);
  });
});

test.describe('Price Calculation', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
  });

  test('should calculate correct price for UTIA single room', async ({ page }) => {
    const result = await createTestBooking(page, {
      startDate: '2025-11-01',
      endDate: '2025-11-03', // 2 nights
      rooms: ['12'],
      guestType: 'utia',
      adults: 2,
      children: 1,
      toddlers: 0,
    });

    // Base 298 + (2 adults * 49) + (1 child * 24) = 420 per night
    // 420 * 2 nights = 840
    expect(result.totalPrice).toBe(840);
  });

  test('should calculate correct price for external guest', async ({ page }) => {
    const result = await createTestBooking(page, {
      startDate: '2025-11-01',
      endDate: '2025-11-03', // 2 nights
      rooms: ['12'],
      guestType: 'external',
      adults: 2,
      children: 0,
      toddlers: 0,
    });

    // Base 499 + (2 adults * 99) = 697 per night
    // 697 * 2 nights = 1394
    expect(result.totalPrice).toBe(1394);
  });

  test('should not charge for toddlers', async ({ page }) => {
    const result = await createTestBooking(page, {
      startDate: '2025-11-01',
      endDate: '2025-11-03', // 2 nights
      rooms: ['12'],
      guestType: 'utia',
      adults: 2,
      children: 0,
      toddlers: 2, // Should be free
    });

    // Base 298 + (2 adults * 49) = 396 per night
    // 396 * 2 nights = 792 (toddlers don't add to price)
    expect(result.totalPrice).toBe(792);
  });
});

test.describe('Multi-Room Booking', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
  });

  test('should allow booking multiple rooms', async ({ page }) => {
    const result = await createTestBooking(page, {
      startDate: '2025-11-01',
      endDate: '2025-11-03',
      rooms: ['12', '13', '14'], // 3 rooms
      guestType: 'utia',
      adults: 6,
      children: 2,
      toddlers: 1,
    });

    expect(result.success || result.id).toBeTruthy();
    expect(result.rooms).toHaveLength(3);
  });

  test('should prevent multi-room booking if one room is occupied', async ({ page }) => {
    // Book room 12
    await createTestBooking(page, {
      startDate: '2025-11-01',
      endDate: '2025-11-03',
      rooms: ['12'],
    });

    // Try to book rooms 12 and 13 (12 is already booked)
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test User',
            email: 'test@test.cz',
            startDate: '2025-11-02',
            endDate: '2025-11-04',
            rooms: ['12', '13'],
            guestType: 'utia',
            adults: 4,
            children: 0,
            toddlers: 0,
            phone: '+420123456789',
            company: 'Test',
            address: 'Test 123',
            city: 'Praha',
            zip: '12345',
          }),
        });
        return { status: response.status, data: await response.json() };
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result.status).not.toBe(200);
  });
});

test.describe('Edit Token Security', () => {
  test('should generate unique edit token for each booking', async ({ page }) => {
    const booking1 = await createTestBooking(page, {
      email: 'booking1@test.cz',
      startDate: '2025-11-01',
      endDate: '2025-11-03',
      rooms: ['12'],
    });

    const booking2 = await createTestBooking(page, {
      email: 'booking2@test.cz',
      startDate: '2025-11-05',
      endDate: '2025-11-07',
      rooms: ['13'],
    });

    expect(booking1.editToken).toBeTruthy();
    expect(booking2.editToken).toBeTruthy();
    expect(booking1.editToken).not.toBe(booking2.editToken);
  });

  test('should have edit token of proper length', async ({ page }) => {
    const booking = await createTestBooking(page, {
      startDate: '2025-11-01',
      endDate: '2025-11-03',
      rooms: ['12'],
    });

    // Edit token should be 30 characters (as per IdGenerator)
    expect(booking.editToken).toHaveLength(30);
  });
});

test.describe('Performance and Load', () => {
  test('should handle multiple concurrent bookings', async ({ page }) => {
    await resetDatabase(page);

    // Create 10 bookings in parallel
    const bookingPromises = [];
    for (let i = 0; i < 10; i++) {
      bookingPromises.push(
        createTestBooking(page, {
          name: `User ${i}`,
          email: `user${i}@test.cz`,
          startDate: `2025-11-${String(i + 1).padStart(2, '0')}`,
          endDate: `2025-11-${String(i + 2).padStart(2, '0')}`,
          rooms: ['12'],
        })
      );
    }

    const results = await Promise.allSettled(bookingPromises);

    // At least some should succeed (first one should always succeed)
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    expect(successful).toBeGreaterThan(0);
  });

  test('should render calendar with many bookings efficiently', async ({ page }) => {
    await resetDatabase(page);

    // Create 20 bookings across different rooms
    for (let i = 0; i < 20; i++) {
      const roomId = ['12', '13', '14', '22', '23', '24', '42', '43', '44'][i % 9];
      await createTestBooking(page, {
        name: `Booking ${i}`,
        email: `booking${i}@test.cz`,
        startDate: `2025-${String((i % 12) + 1).padStart(2, '0')}-01`,
        endDate: `2025-${String((i % 12) + 1).padStart(2, '0')}-03`,
        rooms: [roomId],
      });
    }

    // Navigate and measure load time
    const startTime = Date.now();
    await navigateToMainPage(page);
    const loadTime = Date.now() - startTime;

    // Calendar should load within reasonable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);
  });
});

test.describe('Browser Compatibility', () => {
  test('should work without JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await navigateToMainPage(page);

    // Wait for app to fully load
    await page.waitForTimeout(2000);

    // Should have no JavaScript errors
    expect(errors).toHaveLength(0);
  });

  test('should handle page refresh gracefully', async ({ page }) => {
    await navigateToMainPage(page);

    // Reload page multiple times
    await page.reload();
    await page.waitForSelector('#calendar');

    await page.reload();
    await page.waitForSelector('#calendar');

    // Calendar should still be visible
    await expect(page.locator('#calendar')).toBeVisible();
  });
});
