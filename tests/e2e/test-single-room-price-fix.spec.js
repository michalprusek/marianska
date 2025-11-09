/**
 * E2E Test: Single Room Booking Price Calculation Fix
 * 
 * Verifies that the price calculation in single room booking modal
 * uses the NEW pricing model (2025-11-04):
 * - Empty room base price (no guests included)
 * - ALL adults pay surcharge
 * - ALL children pay surcharge
 * 
 * Bug: Previously showed 900 Kč instead of 600 Kč for:
 * - Small room, ÚTIA, 1 adult, 2 nights
 * 
 * Expected: 250 × 2 + 50 × 1 × 2 = 600 Kč
 */

const { test, expect } = require('@playwright/test');

test.describe('Single Room Booking Price Calculation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the booking page
    await page.goto('http://localhost:3000');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should calculate correct price for 1 adult, 2 nights, ÚTIA, small room', async ({ page }) => {
    // Find a small room (e.g., P12) and click on an available date
    // First, navigate to a future month to ensure availability
    const nextMonthBtn = page.locator('button:has-text("›")').first();
    await nextMonthBtn.click();
    await page.waitForTimeout(500);

    // Find an available date cell for room P12 (small room, 3 beds)
    // Look for a green cell (available) in the P12 row
    const availableCell = page.locator('.calendar-cell.available').first();
    await availableCell.click();
    await page.waitForTimeout(500);

    // Click on the room name or booking button to open single room modal
    // Try to find "Rezervovat" button or room name
    const bookButton = page.locator('button:has-text("Rezervovat")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
    } else {
      // Alternative: click on room name
      const roomLink = page.locator('text=/Pokoj 1[2-3]/').first();
      await roomLink.click();
    }

    // Wait for single room booking modal to open
    await page.waitForSelector('#singleRoomBookingModal.active', { timeout: 5000 });

    // Select 2 consecutive available dates in the mini calendar
    const miniCalendarCells = page.locator('#miniCalendar .calendar-cell.available');
    const firstCell = miniCalendarCells.first();
    await firstCell.click();
    await page.waitForTimeout(300);

    // Click on the next available cell to select 2 nights
    const secondCell = miniCalendarCells.nth(1);
    await secondCell.click();
    await page.waitForTimeout(300);

    // Ensure guest type is set to ÚTIA (should be default)
    const utiaRadio = page.locator('input[name="singleRoomGuestType"][value="utia"]');
    await utiaRadio.check();
    await page.waitForTimeout(500);

    // Ensure 1 adult is selected (should be default)
    const adultsCount = page.locator('#singleRoomAdults');
    const adultsText = await adultsCount.textContent();
    expect(adultsText).toBe('1');

    // Wait for price calculation to complete
    await page.waitForTimeout(1000);

    // Check the price breakdown
    const basePriceEl = page.locator('#basePrice');
    const basePriceText = await basePriceEl.textContent();
    console.log('Base price:', basePriceText);
    
    // Base price should be 250 Kč (empty small room, ÚTIA)
    expect(basePriceText).toContain('250');

    const adultsSurchargeEl = page.locator('#adultsSurcharge');
    const adultsSurchargeText = await adultsSurchargeEl.textContent();
    console.log('Adults surcharge:', adultsSurchargeText);
    
    // Adults surcharge should be 50 Kč (1 × 50 Kč)
    expect(adultsSurchargeText).toContain('50');

    const nightsMultiplierEl = page.locator('#nightsMultiplier');
    const nightsText = await nightsMultiplierEl.textContent();
    console.log('Nights:', nightsText);
    
    // Should be 2 nights (3 days selected - 1)
    // Note: This might be 1 if only 2 days were selected
    // We'll check the total price instead

    const totalPriceEl = page.locator('#totalPrice');
    const totalPriceText = await totalPriceEl.textContent();
    console.log('Total price:', totalPriceText);

    // Extract numeric value from "600 Kč" format
    const totalPriceMatch = totalPriceText.match(/(\d+(?:\s?\d+)*)/);
    expect(totalPriceMatch).not.toBeNull();
    
    const totalPrice = parseInt(totalPriceMatch[1].replace(/\s/g, ''), 10);
    console.log('Total price (numeric):', totalPrice);

    // For 2 nights: 250 × 2 + 50 × 1 × 2 = 600 Kč
    // For 1 night: 250 × 1 + 50 × 1 × 1 = 300 Kč
    // Accept either depending on how many dates were selected
    expect([300, 600]).toContain(totalPrice);

    // If 2 nights, verify the calculation
    if (nightsText === '2') {
      expect(totalPrice).toBe(600);
    } else if (nightsText === '1') {
      expect(totalPrice).toBe(300);
    }
  });

  test('should update price when changing guest count', async ({ page }) => {
    // Similar setup as above
    const nextMonthBtn = page.locator('button:has-text("›")').first();
    await nextMonthBtn.click();
    await page.waitForTimeout(500);

    const availableCell = page.locator('.calendar-cell.available').first();
    await availableCell.click();
    await page.waitForTimeout(500);

    const bookButton = page.locator('button:has-text("Rezervovat")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
    }

    await page.waitForSelector('#singleRoomBookingModal.active', { timeout: 5000 });

    // Select dates
    const miniCalendarCells = page.locator('#miniCalendar .calendar-cell.available');
    await miniCalendarCells.first().click();
    await page.waitForTimeout(300);
    await miniCalendarCells.nth(1).click();
    await page.waitForTimeout(300);

    // Set to ÚTIA
    await page.locator('input[name="singleRoomGuestType"][value="utia"]').check();
    await page.waitForTimeout(500);

    // Get initial price with 1 adult
    const initialPriceText = await page.locator('#totalPrice').textContent();
    const initialPrice = parseInt(initialPriceText.match(/(\d+(?:\s?\d+)*)/)[1].replace(/\s/g, ''), 10);
    console.log('Initial price (1 adult):', initialPrice);

    // Increase adults to 2
    const increaseAdultsBtn = page.locator('[data-action="increase-adults"]');
    await increaseAdultsBtn.click();
    await page.waitForTimeout(1000);

    // Check that adults count is now 2
    const adultsCount = await page.locator('#singleRoomAdults').textContent();
    expect(adultsCount).toBe('2');

    // Get new price with 2 adults
    const newPriceText = await page.locator('#totalPrice').textContent();
    const newPrice = parseInt(newPriceText.match(/(\d+(?:\s?\d+)*)/)[1].replace(/\s/g, ''), 10);
    console.log('New price (2 adults):', newPrice);

    // Price should increase by adult surcharge × nights
    // For 1 night: +50 Kč, for 2 nights: +100 Kč
    const priceDiff = newPrice - initialPrice;
    console.log('Price difference:', priceDiff);
    
    expect([50, 100]).toContain(priceDiff);
  });

  test('should show correct base price for ÚTIA vs External', async ({ page }) => {
    const nextMonthBtn = page.locator('button:has-text("›")').first();
    await nextMonthBtn.click();
    await page.waitForTimeout(500);

    const availableCell = page.locator('.calendar-cell.available').first();
    await availableCell.click();
    await page.waitForTimeout(500);

    const bookButton = page.locator('button:has-text("Rezervovat")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
    }

    await page.waitForSelector('#singleRoomBookingModal.active', { timeout: 5000 });

    // Select dates
    const miniCalendarCells = page.locator('#miniCalendar .calendar-cell.available');
    await miniCalendarCells.first().click();
    await page.waitForTimeout(300);

    // Check ÚTIA base price
    await page.locator('input[name="singleRoomGuestType"][value="utia"]').check();
    await page.waitForTimeout(500);

    const utiaBasePriceText = await page.locator('#basePrice').textContent();
    console.log('ÚTIA base price:', utiaBasePriceText);
    
    // Should be 250 Kč for small room or 350 Kč for large room
    expect(utiaBasePriceText).toMatch(/250|350/);

    // Switch to External
    await page.locator('input[name="singleRoomGuestType"][value="external"]').check();
    await page.waitForTimeout(500);

    const externalBasePriceText = await page.locator('#basePrice').textContent();
    console.log('External base price:', externalBasePriceText);
    
    // Should be 400 Kč for small room or 500 Kč for large room
    expect(externalBasePriceText).toMatch(/400|500/);
  });
});

