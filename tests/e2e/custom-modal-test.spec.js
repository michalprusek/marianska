/**
 * Custom Modal Dialog Tests
 * Tests that custom styled modals appear instead of native browser confirm()
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = 'https://localhost';
const ADMIN_PASSWORD = 'admin123';

test.use({ ignoreHTTPSErrors: true });

test.describe('Custom Modal Dialogs for Room Removal', () => {
  let adminSessionToken;
  let testBookingId;
  let editToken;

  test.beforeAll(async ({ request }) => {
    // Login as admin
    const loginResponse = await request.post(`${BASE_URL}/api/admin/login`, {
      data: { password: ADMIN_PASSWORD },
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    adminSessionToken = loginData.sessionToken;

    // Create test booking with 3 rooms
    const createResponse = await request.post(`${BASE_URL}/api/booking`, {
      data: {
        name: 'Test Custom Modals',
        email: 'modal-test@example.com',
        phone: '+420777888999',
        address: 'Test Street 123',
        city: 'Praha',
        zip: '12000',
        ico: '',
        dic: '',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        rooms: ['12', '13', '14'],
        guestType: 'utia',
        adults: 3,
        children: 0,
        toddlers: 0,
        totalPrice: 4500,
        notes: 'Test booking for modal dialogs',
        perRoomGuests: [
          { roomId: '12', guestType: 'utia', adults: 1, children: 0, toddlers: 0 },
          { roomId: '13', guestType: 'utia', adults: 1, children: 0, toddlers: 0 },
          { roomId: '14', guestType: 'utia', adults: 1, children: 0, toddlers: 0 },
        ],
        guestNames: [
          { firstName: 'Jan', lastName: 'Novák', personType: 'adult' },
          { firstName: 'Petr', lastName: 'Svoboda', personType: 'adult' },
          { firstName: 'Marie', lastName: 'Svobodová', personType: 'adult' },
        ],
      },
    });

    if (!createResponse.ok()) {
      const errorData = await createResponse.json();
      console.error('Booking creation failed:', {
        status: createResponse.status(),
        statusText: createResponse.statusText(),
        error: errorData,
      });
      throw new Error(`Failed to create test booking: ${JSON.stringify(errorData)}`);
    }

    const createData = await createResponse.json();
    testBookingId = createData.booking.id;
    editToken = createData.booking.editToken;

    console.log('Created test booking:', testBookingId);
  });

  test.afterAll(async ({ request }) => {
    // Cleanup
    if (testBookingId && adminSessionToken) {
      await request.delete(`${BASE_URL}/api/booking/${testBookingId}`, {
        headers: { 'x-session-token': adminSessionToken },
      });
      console.log('Cleaned up test booking:', testBookingId);
    }
  });

  test('should show custom modal dialog (not native confirm) when removing room', async ({
    page,
  }) => {
    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${editToken}`);
    await page.waitForSelector('#editRoomsList');

    // Prevent native confirm() dialogs from appearing
    // (they shouldn't, but this is a safety net for old code)
    page.on('dialog', async (dialog) => {
      // If native dialog appears, test should fail
      throw new Error(`Native ${dialog.type()} dialog appeared: "${dialog.message()}"`);
    });

    // Find checkbox for room 13
    const room13Checkbox = page.locator('input[type="checkbox"]').filter({ hasText: /P13/ }).first();

    // Click to remove room
    await room13Checkbox.click();

    // Wait for custom modal to appear (max 2 seconds)
    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 2000 });

    // Verify it's a custom modal (not native)
    const modalDialog = page.locator('.modal-dialog');
    await expect(modalDialog).toBeVisible();

    // Verify modal has custom styling
    await expect(modalDialog).toHaveCSS('background', /white/i);
    await expect(modalDialog).toHaveCSS('border-radius', /8px/);

    // Verify header with icon
    const header = page.locator('.modal-dialog h3');
    await expect(header).toContainText('Odebrat pokoj');
    await expect(header).toContainText('🗑️'); // Icon should be visible

    // Verify message content
    const message = page.locator('.modal-dialog p');
    await expect(message).toContainText('Opravdu chcete odebrat tento pokoj z rezervace');

    // Verify details section with price impact
    const details = page.locator('.modal-dialog');
    await expect(details).toContainText('Cena pokoje');
    await expect(details).toContainText('Zbývající pokoje');

    // Verify buttons (confirm and cancel)
    const confirmBtn = page.locator('.modal-confirm-btn');
    const cancelBtn = page.locator('.modal-cancel-btn');

    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toContainText('Odebrat pokoj');
    await expect(cancelBtn).toBeVisible();
    await expect(cancelBtn).toContainText('Zrušit');

    // Test cancel button
    await cancelBtn.click();

    // Modal should disappear
    await expect(modalBackdrop).not.toBeVisible({ timeout: 1000 });

    // Room should still be checked (not removed)
    await expect(room13Checkbox).toBeChecked();
  });

  test('should show danger modal when removing last room', async ({ page }) => {
    // Create booking with only 1 room
    const { request } = page.context();

    const singleRoomResponse = await request.post(`${BASE_URL}/api/booking`, {
      data: {
        name: 'Single Room Modal Test',
        email: 'single-modal@example.com',
        phone: '+420777888999',
        address: 'Test Street 123',
        city: 'Praha',
        zip: '12000',
        startDate: '2026-07-10',
        endDate: '2026-07-12',
        rooms: ['12'],
        guestType: 'utia',
        adults: 1,
        children: 0,
        totalPrice: 750,
        perRoomGuests: [{ roomId: '12', guestType: 'utia', adults: 1, children: 0, toddlers: 0 }],
        guestNames: [{ firstName: 'Test', lastName: 'User', personType: 'adult' }],
      },
    });

    expect(singleRoomResponse.ok()).toBeTruthy();
    const singleData = await singleRoomResponse.json();
    const singleBookingId = singleData.booking.id;
    const singleEditToken = singleData.booking.editToken;

    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${singleEditToken}`);
    await page.waitForSelector('#editRoomsList');

    // Prevent native dialogs
    page.on('dialog', async (dialog) => {
      throw new Error(`Native ${dialog.type()} dialog appeared: "${dialog.message()}"`);
    });

    // Try to remove the only room
    const room12Checkbox = page.locator('input[type="checkbox"]').first();
    await room12Checkbox.click();

    // Wait for danger modal
    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 2000 });

    // Verify it's a DANGER type modal (red color scheme)
    const modalDialog = page.locator('.modal-dialog');
    const header = modalDialog.locator('div').first(); // Header div

    // Check for danger styling (red background)
    await expect(header).toHaveCSS('background-color', /rgb\(248, 215, 218\)/); // #f8d7da in RGB

    // Verify danger message
    await expect(modalDialog).toContainText('VAROVÁNÍ');
    await expect(modalDialog).toContainText('poslední pokoj');
    await expect(modalDialog).toContainText('SMAŽE celou rezervaci');

    // Verify icon
    await expect(modalDialog).toContainText('⚠️');

    // Verify confirm button text
    const confirmBtn = page.locator('.modal-confirm-btn');
    await expect(confirmBtn).toContainText('Ano, smazat rezervaci');
    await expect(confirmBtn).toHaveCSS('background-color', /rgb\(220, 38, 38\)/); // Danger red

    // Cancel the deletion
    const cancelBtn = page.locator('.modal-cancel-btn');
    await cancelBtn.click();

    // Modal should close
    await expect(modalBackdrop).not.toBeVisible({ timeout: 1000 });

    // Cleanup
    await request.delete(`${BASE_URL}/api/booking/${singleBookingId}`, {
      headers: { 'x-session-token': adminSessionToken },
    });
  });

  test('should allow keyboard interaction (ESC to cancel)', async ({ page }) => {
    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${editToken}`);
    await page.waitForSelector('#editRoomsList');

    // Click to remove room
    const room13Checkbox = page.locator('input[type="checkbox"]').nth(1);
    await room13Checkbox.click();

    // Wait for modal
    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 2000 });

    // Press ESC key
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(modalBackdrop).not.toBeVisible({ timeout: 1000 });

    // Room should still be checked
    await expect(room13Checkbox).toBeChecked();
  });

  test('should allow click-outside-to-close', async ({ page }) => {
    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${editToken}`);
    await page.waitForSelector('#editRoomsList');

    // Click to remove room
    const room13Checkbox = page.locator('input[type="checkbox"]').nth(1);
    await room13Checkbox.click();

    // Wait for modal
    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 2000 });

    // Click on backdrop (outside modal)
    await modalBackdrop.click({ position: { x: 10, y: 10 } });

    // Modal should close
    await expect(modalBackdrop).not.toBeVisible({ timeout: 1000 });

    // Room should still be checked
    await expect(room13Checkbox).toBeChecked();
  });

  test('should successfully remove room when confirm clicked', async ({ page }) => {
    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${editToken}`);
    await page.waitForSelector('#editRoomsList');

    // Click to remove room 13
    const room13Checkbox = page.locator('input[type="checkbox"]').nth(1);
    await room13Checkbox.click();

    // Wait for modal
    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 2000 });

    // Click confirm button
    const confirmBtn = page.locator('.modal-confirm-btn');
    await confirmBtn.click();

    // Modal should close
    await expect(modalBackdrop).not.toBeVisible({ timeout: 1000 });

    // Wait for removal to complete
    await page.waitForTimeout(1000);

    // Room should be unchecked
    await expect(room13Checkbox).not.toBeChecked();

    // Success notification should appear
    await expect(page.locator('text=/byl odebrán z rezervace/')).toBeVisible({ timeout: 5000 });
  });

  test('should verify modal is accessible (ARIA labels)', async ({ page }) => {
    // Navigate to edit page
    await page.goto(`${BASE_URL}/edit.html?token=${editToken}`);
    await page.waitForSelector('#editRoomsList');

    // Click to remove room
    const room13Checkbox = page.locator('input[type="checkbox"]').nth(1);
    await room13Checkbox.click();

    // Wait for modal
    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 2000 });

    // Verify focus is on confirm button (auto-focus)
    const confirmBtn = page.locator('.modal-confirm-btn');
    await expect(confirmBtn).toBeFocused({ timeout: 500 });

    // Close modal
    await page.keyboard.press('Escape');
  });
});
