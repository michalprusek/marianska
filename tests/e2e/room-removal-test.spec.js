/**
 * Room Removal Feature Test
 * Tests the ability to remove individual rooms from a reservation in edit mode
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = 'https://localhost';  // Use HTTPS (nginx redirects HTTP)
const ADMIN_PASSWORD = 'admin123';  // Actual password stored in database

test.use({ ignoreHTTPSErrors: true });  // Ignore SSL cert mismatch for localhost

test.describe('Room Removal Feature', () => {
  let adminSessionToken;
  let testBookingId;
  let editToken;

  test.beforeAll(async ({ request }) => {
    // Login as admin to get session token
    const loginResponse = await request.post(`${BASE_URL}/api/admin/login`, {
      data: {
        password: ADMIN_PASSWORD,
      },
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    adminSessionToken = loginData.sessionToken;

    // Create a test booking with 3 rooms
    const createResponse = await request.post(`${BASE_URL}/api/booking`, {
      data: {
        name: 'Test Room Removal',
        email: 'test-removal@example.com',
        phone: '+420777888999',
        address: 'Test Street 123',
        city: 'Praha',
        zip: '12000',
        ico: '',
        dic: '',
        startDate: '2025-12-01',
        endDate: '2025-12-05',
        rooms: ['12', '13', '14'],
        guestType: 'utia',
        adults: 3,
        children: 0,
        toddlers: 0,
        totalPrice: 4500,
        notes: 'Test booking for room removal',
        perRoomGuests: [
          { roomId: '12', guestType: 'utia', adults: 1, children: 0, toddlers: 0 },
          { roomId: '13', guestType: 'utia', adults: 1, children: 0, toddlers: 0 },
          { roomId: '14', guestType: 'utia', adults: 1, children: 0, toddlers: 0 },
        ],
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    testBookingId = createData.booking.id;
    editToken = createData.booking.editToken;

    console.log('Created test booking:', testBookingId);
  });

  test.afterAll(async ({ request }) => {
    // Cleanup: delete test booking
    if (testBookingId && adminSessionToken) {
      await request.delete(`${BASE_URL}/api/booking/${testBookingId}`, {
        headers: {
          'x-session-token': adminSessionToken,
        },
      });
      console.log('Cleaned up test booking:', testBookingId);
    }
  });

  test('should show room removal confirmation dialog', async ({ page }) => {
    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${editToken}`);

    // Wait for page to load
    await page.waitForSelector('#editRoomsList');

    // Verify all 3 rooms are visible
    const room12Checkbox = await page.locator('input[type="checkbox"]').filter({ hasText: /P12/ }).first();
    const room13Checkbox = await page.locator('input[type="checkbox"]').filter({ hasText: /P13/ }).first();
    const room14Checkbox = await page.locator('input[type="checkbox"]').filter({ hasText: /P14/ }).first();

    await expect(room12Checkbox).toBeChecked();
    await expect(room13Checkbox).toBeChecked();
    await expect(room14Checkbox).toBeChecked();

    // Set up dialog handler before clicking
    page.on('dialog', async (dialog) => {
      console.log('Dialog message:', dialog.message());
      expect(dialog.message()).toContain('Opravdu chcete odebrat pokoj');
      expect(dialog.message()).toContain('P13');
      expect(dialog.message()).toContain('Dopad na rezervaci');
      expect(dialog.message()).toContain('Cena pokoje');
      expect(dialog.message()).toContain('Zbývající pokoje: 2');
      await dialog.dismiss(); // Cancel for this test
    });

    // Click checkbox to remove room 13
    await room13Checkbox.click();

    // Verify room is still checked (because we cancelled)
    await page.waitForTimeout(500);
    await expect(room13Checkbox).toBeChecked();
  });

  test('should successfully remove a room when confirmed', async ({ page }) => {
    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${editToken}`);
    await page.waitForSelector('#editRoomsList');

    // Accept the confirmation dialog
    page.on('dialog', async (dialog) => {
      await dialog.accept(); // Confirm removal
    });

    // Find and click checkbox for room 13
    const room13Checkbox = await page.locator('input[type="checkbox"]').nth(1); // Assuming order
    await room13Checkbox.click();

    // Wait for removal to complete
    await page.waitForTimeout(1000);

    // Verify success notification appears
    await expect(page.locator('text=byl odebrán z rezervace')).toBeVisible({ timeout: 5000 });

    // Verify only 2 rooms remain checked
    const checkedBoxes = await page.locator('input[type="checkbox"]:checked').count();
    expect(checkedBoxes).toBeLessThanOrEqual(2);
  });

  test('should show special warning when removing last room', async ({ page }) => {
    // First, we need a booking with only 1 room
    const { request } = page.context();

    const singleRoomResponse = await request.post(`${BASE_URL}/api/booking`, {
      data: {
        name: 'Single Room Test',
        email: 'single@example.com',
        phone: '+420777888999',
        address: 'Test Street 123',
        city: 'Praha',
        zip: '12000',
        startDate: '2025-12-10',
        endDate: '2025-12-12',
        rooms: ['12'],
        guestType: 'utia',
        adults: 1,
        children: 0,
        totalPrice: 750,
      },
    });

    expect(singleRoomResponse.ok()).toBeTruthy();
    const singleData = await singleRoomResponse.json();
    const singleBookingId = singleData.booking.id;
    const singleEditToken = singleData.booking.editToken;

    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${singleEditToken}`);
    await page.waitForSelector('#editRoomsList');

    // Set up dialog handler expecting deletion warning
    page.on('dialog', async (dialog) => {
      console.log('Last room dialog:', dialog.message());
      expect(dialog.message()).toContain('VAROVÁNÍ');
      expect(dialog.message()).toContain('poslední pokoj');
      expect(dialog.message()).toContain('SMAŽE celou rezervaci');
      await dialog.dismiss(); // Cancel deletion for this test
    });

    // Try to remove the only room
    const room12Checkbox = await page.locator('input[type="checkbox"]').first();
    await room12Checkbox.click();

    // Wait a bit
    await page.waitForTimeout(500);

    // Cleanup: delete the single room booking
    await request.delete(`${BASE_URL}/api/booking/${singleBookingId}`, {
      headers: {
        'x-session-token': adminSessionToken,
      },
    });
  });

  test('should prevent adding new rooms', async ({ page }) => {
    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${editToken}`);
    await page.waitForSelector('#editRoomsList');

    // Verify info banner shows correct message
    await expect(page.locator('text=/Pokoje lze odebrat.*Nové pokoje nelze přidávat/')).toBeVisible();

    // Since we removed room 13 earlier, it should not be visible
    // All checkboxes should be for rooms in original booking only
    const checkboxes = await page.locator('input[type="checkbox"]').count();
    expect(checkboxes).toBeLessThanOrEqual(3); // Original booking had 3 rooms
  });

  test('should allow re-adding a removed room', async ({ page }) => {
    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${editToken}`);
    await page.waitForSelector('#editRoomsList');

    // First remove a room
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const room14Checkbox = await page.locator('input[type="checkbox"]').nth(2);
    await room14Checkbox.click();

    // Wait for removal
    await page.waitForTimeout(1000);

    // Now try to check it again
    await room14Checkbox.click();

    // Wait for re-addition
    await page.waitForTimeout(500);

    // Verify success notification
    await expect(page.locator('text=byl přidán zpět do rezervace')).toBeVisible({ timeout: 5000 });

    // Verify checkbox is checked again
    await expect(room14Checkbox).toBeChecked();
  });

  test('should update price when room is removed', async ({ page }) => {
    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${editToken}`);
    await page.waitForSelector('#editRoomsList');

    // Get initial total price
    const initialPriceElement = await page.locator('#editTotalPrice');
    const initialPriceText = await initialPriceElement.textContent();
    console.log('Initial price:', initialPriceText);

    // Accept confirmation
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Remove a room
    const room13Checkbox = await page.locator('input[type="checkbox"]').nth(1);
    await room13Checkbox.click();

    // Wait for price update
    await page.waitForTimeout(1500);

    // Get updated price
    const updatedPriceText = await initialPriceElement.textContent();
    console.log('Updated price:', updatedPriceText);

    // Verify price changed (decreased)
    expect(updatedPriceText).not.toBe(initialPriceText);
  });

  test('should prevent bulk booking room removal', async ({ page, request }) => {
    // Create a bulk booking (all 9 rooms)
    const bulkResponse = await request.post(`${BASE_URL}/api/booking`, {
      data: {
        name: 'Bulk Test',
        email: 'bulk@example.com',
        phone: '+420777888999',
        address: 'Test Street 123',
        city: 'Praha',
        zip: '12000',
        startDate: '2025-12-15',
        endDate: '2025-12-18',
        rooms: ['12', '13', '14', '22', '23', '24', '42', '43', '44'],
        guestType: 'utia',
        adults: 20,
        children: 0,
        totalPrice: 6000,
        isBulkBooking: true,
      },
    });

    expect(bulkResponse.ok()).toBeTruthy();
    const bulkData = await bulkResponse.json();
    const bulkBookingId = bulkData.booking.id;
    const bulkEditToken = bulkData.booking.editToken;

    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${bulkEditToken}`);
    await page.waitForSelector('#editRoomsList');

    // Verify bulk booking badge is shown
    await expect(page.locator('text=HROMADNÁ REZERVACE')).toBeVisible();

    // Try to click any checkbox
    const firstCheckbox = await page.locator('input[type="checkbox"]').first();
    await firstCheckbox.click();

    // Wait for notification
    await page.waitForTimeout(500);

    // Verify warning notification appears
    await expect(
      page.locator('text=/Hromadné rezervace.*nelze měnit po jednotlivých pokojích/')
    ).toBeVisible({ timeout: 3000 });

    // Cleanup
    await request.delete(`${BASE_URL}/api/booking/${bulkBookingId}`, {
      headers: {
        'x-session-token': adminSessionToken,
      },
    });
  });
});
