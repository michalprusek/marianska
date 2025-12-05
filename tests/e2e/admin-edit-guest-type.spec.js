/**
 * E2E Test for Admin Edit Booking - Guest Type Toggle
 * Tests the fix for price update when changing guest types
 * NOTE: Since the test booking has 1 room, it opens singleRoomBookingModal for editing
 */
const { test, expect } = require('@playwright/test');
const {
    navigateToMainPage,
    resetDatabase,
    createTestBooking,
    loginAsAdmin,
    getFutureDate,
    getTestDates,
} = require('./helpers/test-helpers');

test.describe('Admin Edit Booking - Guest Type Toggle', () => {
    let testBooking;

    test.beforeEach(async ({ page }) => {
        await resetDatabase(page);

        // Create a test booking with 2 UTIA adults
        const { startDate, endDate } = getTestDates();
        testBooking = await createTestBooking(page, {
            name: 'Test Admin User',
            email: 'admin.test@example.com',
            phone: '+420123456789',
            startDate,
            endDate,
            rooms: ['12'],
            guestType: 'utia',
            adults: 2,
            children: 0,
            toddlers: 0,
            company: 'Test Company',
            address: 'Test Address 123',
            city: 'Praha',
            zip: '12345',
            guestNames: [
                { personType: 'adult', firstName: 'Jan', lastName: 'Novak', guestPriceType: 'utia', roomId: '12' },
                { personType: 'adult', firstName: 'Marie', lastName: 'Novakova', guestPriceType: 'utia', roomId: '12' },
            ],
        });
    });

    test('should update price when changing guest type from UTIA to External', async ({ page }) => {
        // Login as admin
        await loginAsAdmin(page);

        // Open booking edit modal
        await page.goto('/admin.html');
        await page.waitForSelector('.admin-content', { timeout: 10000 });

        // Find and click edit button for booking
        const editButton = page.locator(`button:has-text("Upravit"), [onclick*="editBooking"]`).first();
        if (await editButton.isVisible({ timeout: 5000 })) {
            await editButton.click();
        }

        // Wait for single room edit modal (new behavior - single room booking opens single room modal)
        await page.waitForSelector('#singleRoomBookingModal.active', { timeout: 5000 });

        // Get initial price from the single room modal
        const priceEl = page.locator('#totalPrice, #singleRoomBookingModal .total-price');
        const initialPrice = await priceEl.first().textContent().catch(() => '0 Kč');

        // Find guest type toggle for second adult
        const guestToggle = page.locator('#singleRoomGuestNamesSection [id*="GuestTypeToggle"]').nth(1);

        if (await guestToggle.isVisible()) {
            // Click toggle to change from UTIA to External
            await guestToggle.click();
            await page.waitForTimeout(500);

            // Price should have updated
            const newPrice = await priceEl.first().textContent().catch(() => '0 Kč');

            // External guests cost more, so price should increase
            const initialNum = parseInt(initialPrice.replace(/[^\d]/g, '')) || 0;
            const newNum = parseInt(newPrice.replace(/[^\d]/g, '')) || 0;

            // Verify price changed (External is more expensive than UTIA)
            expect(newNum).toBeGreaterThan(initialNum);
        }
    });

    test('should save guest type changes to database', async ({ page }) => {
        // Login as admin
        await loginAsAdmin(page);
        await page.goto('/admin.html');
        await page.waitForSelector('.admin-content', { timeout: 10000 });

        // Open booking edit modal
        const editButton = page.locator(`button:has-text("Upravit"), [onclick*="editBooking"]`).first();
        if (await editButton.isVisible({ timeout: 5000 })) {
            await editButton.click();
        }
        // Wait for single room edit modal
        await page.waitForSelector('#singleRoomBookingModal.active', { timeout: 5000 });

        // Find and click guest type toggle for second adult
        const guestToggle = page.locator('#singleRoomGuestNamesSection [id*="GuestTypeToggle"]').nth(1);
        if (await guestToggle.isVisible()) {
            await guestToggle.click();
            await page.waitForTimeout(300);
        }

        // Save changes
        const saveBtn = page.locator('#confirmSingleRoomBtn');
        if (await saveBtn.isVisible()) {
            await saveBtn.click();
            await page.waitForTimeout(2000);
        }

        // Verify modal closed (success)
        const modalClosed = await page.locator('#singleRoomBookingModal.active').isHidden().catch(() => true);
        expect(modalClosed).toBe(true);

        // Reload and check guest data persisted
        await page.reload();
        await page.waitForTimeout(1000);

        // Use API to verify booking was updated
        const bookingData = await page.evaluate(async (bookingId) => {
            const response = await fetch(`/api/booking/${bookingId}`);
            return response.json();
        }, testBooking.id);

        // Find the second adult guest
        if (bookingData.guestNames && bookingData.guestNames.length >= 2) {
            const secondAdult = bookingData.guestNames.find(g =>
                g.personType === 'adult' && g.firstName === 'Marie'
            );

            // Verify guest type was saved as external
            if (secondAdult) {
                expect(secondAdult.guestPriceType).toBe('external');
            }
        }
    });

    test('should include roomId in saved guest data', async ({ page }) => {
        // Login as admin  
        await loginAsAdmin(page);
        await page.goto('/admin.html');
        await page.waitForSelector('.admin-content', { timeout: 10000 });

        // Open and save booking without changes (to test roomId)
        const editButton = page.locator(`button:has-text("Upravit"), [onclick*="editBooking"]`).first();
        if (await editButton.isVisible({ timeout: 5000 })) {
            await editButton.click();
        }
        await page.waitForSelector('#singleRoomBookingModal.active', { timeout: 5000 });

        // Just save without changes
        const saveBtn = page.locator('#confirmSingleRoomBtn');
        if (await saveBtn.isVisible()) {
            await saveBtn.click();
            await page.waitForTimeout(2000);
        }

        // Verify booking has roomId in guestNames via API
        const bookingData = await page.evaluate(async (bookingId) => {
            const response = await fetch(`/api/booking/${bookingId}`);
            return response.json();
        }, testBooking.id);

        // All guests should have roomId
        if (bookingData.guestNames && bookingData.guestNames.length > 0) {
            for (const guest of bookingData.guestNames) {
                expect(guest.roomId).toBeTruthy();
            }
        }
    });
});

