/**
 * E2E Test: Verify toddlers don't have ÚTIA/External toggle switch
 *
 * This test verifies that:
 * 1. Adults and children have toggle switches
 * 2. Toddlers do NOT have toggle switches (they're free, no price difference)
 * 3. All guest types can still enter names
 */

const { test, expect } = require('@playwright/test');

test.describe('Toddler Toggle Switch - Single Room Booking', () => {
  test('should NOT show toggle switches for toddlers, but should for adults and children', async ({
    page,
  }) => {
    // Navigate to single room booking page
    await page.goto('http://localhost:3000/single-room-booking.html');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Select a future date range (7 days from now, 3 nights)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 3);

    const formatDate = (date) => date.toISOString().split('T')[0];

    // Fill in date range
    await page.fill('#singleRoomStartDate', formatDate(startDate));
    await page.fill('#singleRoomEndDate', formatDate(endDate));

    // Select room (e.g., room 12)
    await page.click('#singleRoomRoomSelect');
    await page.click('option[value="12"]');

    // Set guest counts: 2 adults, 1 child, 2 toddlers
    await page.selectOption('#singleRoomAdults', '2');
    await page.selectOption('#singleRoomChildren', '1');
    await page.selectOption('#singleRoomToddlers', '2');

    // Wait for guest name inputs to appear
    await page.waitForSelector('#singleRoomGuestNamesSection', { state: 'visible' });

    // Wait a bit for all inputs to render
    await page.waitForTimeout(500);

    // Count toggle switches
    // Adults should have 2 toggle switches
    const adultToggles = await page.locator('input[data-guest-type="adult"][data-guest-price-type]');
    await expect(adultToggles).toHaveCount(2);
    console.log('✓ Found 2 adult toggle switches');

    // Children should have 1 toggle switch
    const childToggles = await page.locator('input[data-guest-type="child"][data-guest-price-type]');
    await expect(childToggles).toHaveCount(1);
    console.log('✓ Found 1 child toggle switch');

    // Toddlers should have 0 toggle switches (this is the key test!)
    const toddlerToggles = await page.locator(
      'input[data-guest-type="toddler"][data-guest-price-type]'
    );
    await expect(toddlerToggles).toHaveCount(0);
    console.log('✓ Toddlers have NO toggle switches (as expected)');

    // Verify that toddler name inputs still exist (2 toddlers × 2 fields = 4 inputs)
    const toddlerNameInputs = await page.locator(
      'input[data-guest-type="toddler"]:not([data-guest-price-type])'
    );
    await expect(toddlerNameInputs).toHaveCount(4); // 2 toddlers × (firstName + lastName)
    console.log('✓ Toddler name inputs are present (4 inputs for 2 toddlers)');

    // Verify "zdarma" (free) label appears for toddlers
    const freeLabels = await page.locator('text=(zdarma)');
    const freeLabelsCount = await freeLabels.count();
    expect(freeLabelsCount).toBeGreaterThan(0);
    console.log(`✓ Found ${freeLabelsCount} "(zdarma)" free labels for toddlers`);

    // Test that we can fill in toddler names (verify functionality)
    await page.fill('input[id*="ToddlerFirstName1"]', 'Baby');
    await page.fill('input[id*="ToddlerLastName1"]', 'One');
    await page.fill('input[id*="ToddlerFirstName2"]', 'Baby');
    await page.fill('input[id*="ToddlerLastName2"]', 'Two');
    console.log('✓ Successfully filled in toddler names');

    // Verify that adult toggle switches work
    const firstAdultToggle = await page.locator('input[data-guest-type="adult"][data-guest-index="1"][data-guest-price-type]').first();
    await expect(firstAdultToggle).toBeVisible();

    // Check initial state (should be unchecked = ÚTIA)
    const isCheckedBefore = await firstAdultToggle.isChecked();
    console.log(`✓ Adult toggle initial state: ${isCheckedBefore ? 'External' : 'ÚTIA'}`);

    // Toggle it
    await firstAdultToggle.click();
    await page.waitForTimeout(300); // Wait for animation

    // Verify state changed
    const isCheckedAfter = await firstAdultToggle.isChecked();
    expect(isCheckedAfter).not.toBe(isCheckedBefore);
    console.log(`✓ Adult toggle changed to: ${isCheckedAfter ? 'External' : 'ÚTIA'}`);
  });
});

test.describe('Toddler Toggle Switch - Bulk Booking', () => {
  test('should not show toggle switches for any guest type in bulk booking', async ({ page }) => {
    // Navigate to bulk booking page
    await page.goto('http://localhost:3000/bulk-booking.html');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Select a future date range
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + 20);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 2);

    const formatDate = (date) => date.toISOString().split('T')[0];

    // Fill in date range
    await page.fill('#bulkStartDate', formatDate(startDate));
    await page.fill('#bulkEndDate', formatDate(endDate));

    // Add a room
    await page.click('#addRoomBtn');
    await page.waitForTimeout(300);

    // Set guest counts for first room
    const firstRoomContainer = await page.locator('.room-selection-item').first();
    await firstRoomContainer.locator('select[id*="Adults"]').selectOption('2');
    await firstRoomContainer.locator('select[id*="Children"]').selectOption('1');
    await firstRoomContainer.locator('select[id*="Toddlers"]').selectOption('1');

    // Wait for guest name section to appear
    await page.waitForTimeout(500);

    // In bulk booking, NO guest type should have toggle switches
    const allToggles = await page.locator('input[data-guest-price-type]');
    await expect(allToggles).toHaveCount(0);
    console.log('✓ Bulk booking: No toggle switches for any guest type (as expected)');

    // Verify that name inputs still exist for all guest types
    const allNameInputs = await firstRoomContainer.locator(
      'input[data-guest-type]:not([data-guest-price-type])'
    );
    const inputCount = await allNameInputs.count();
    // 2 adults × 2 fields + 1 child × 2 fields + 1 toddler × 2 fields = 8 inputs
    expect(inputCount).toBe(8);
    console.log(`✓ Bulk booking: Found ${inputCount} name inputs (all guest types can enter names)`);
  });
});
