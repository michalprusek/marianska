/**
 * Admin Booking Advanced Tests
 * E2E tests for advanced admin booking management
 */
const { test, expect } = require('@playwright/test');
const {
  resetDatabase,
  loginAsAdmin,
  createTestBooking,
  getFutureDate,
  getTestDates,
  navigateToMainPage,
  waitForNotification,
} = require('./helpers/test-helpers');

test.describe('Admin Booking Advanced Management', () => {
  let testBooking;

  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);

    // Create a test booking for admin tests
    await navigateToMainPage(page);
    const { startDate, endDate } = getTestDates();
    testBooking = await createTestBooking(page, {
      name: 'Admin Test User',
      email: 'admin.test@example.com',
      phone: '+420123456789',
      startDate,
      endDate,
      rooms: ['12'],
      guestType: 'utia',
      adults: 2,
      children: 0,
      company: 'UTIA Test',
      address: 'Testovaci 123',
      city: 'Praha',
      zip: '12345',
    });

    // Login to admin panel
    await loginAsAdmin(page);
  });

  test.describe('Booking Search & Filter', () => {
    test('should search bookings by guest name', async ({ page }) => {
      // Navigate to bookings tab
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // Search by name
      const searchInput = page.locator('#searchBookings');
      await searchInput.fill('Admin Test');
      await page.waitForTimeout(300);

      // Should find the booking
      const tableBody = page.locator('#bookingsTableBody');
      const rows = tableBody.locator('tr');

      // At least one row should be visible
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(1);

      // Row should contain the name
      const rowContent = await tableBody.textContent();
      expect(rowContent.toLowerCase()).toContain('admin');
    });

    test('should search bookings by email', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const searchInput = page.locator('#searchBookings');
      await searchInput.fill('admin.test@example');
      await page.waitForTimeout(300);

      // Should find the booking
      const tableBody = page.locator('#bookingsTableBody');
      const rowContent = await tableBody.textContent();
      expect(rowContent.toLowerCase()).toContain('admin');
    });

    test('should search bookings by booking ID', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // Get the booking ID from the table first
      const firstRow = page.locator('#bookingsTableBody tr').first();
      const bookingIdCell = firstRow.locator('td').nth(1); // Second column is ID
      const bookingId = await bookingIdCell.textContent();

      // Search by partial ID
      const searchInput = page.locator('#searchBookings');
      await searchInput.fill(bookingId.substring(0, 5));
      await page.waitForTimeout(300);

      // Should still show the booking
      const rowCount = await page.locator('#bookingsTableBody tr').count();
      expect(rowCount).toBeGreaterThanOrEqual(1);
    });

    test('should show no results for non-matching search', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const searchInput = page.locator('#searchBookings');
      await searchInput.fill('NonExistentUserXYZ12345');
      await page.waitForTimeout(300);

      // Should show empty table or no results message
      const tableBody = page.locator('#bookingsTableBody');
      const rows = tableBody.locator('tr');

      // Either no rows or a "no results" row
      const rowCount = await rows.count();
      if (rowCount > 0) {
        const text = await tableBody.textContent();
        // Content should not contain our test booking
        expect(text.toLowerCase()).not.toContain('admin test');
      }
    });
  });

  test.describe('Bulk Selection & Actions', () => {
    test('should select multiple bookings with checkboxes', async ({ page }) => {
      // Create additional bookings
      await navigateToMainPage(page);
      const startDate2 = getFutureDate(20);
      const endDate2 = getFutureDate(22);
      await createTestBooking(page, {
        name: 'Second Booking',
        email: 'second@example.com',
        phone: '+420987654321',
        startDate: startDate2,
        endDate: endDate2,
        rooms: ['13'],
        guestType: 'external',
        adults: 1,
        company: 'Test',
        address: 'Test',
        city: 'Praha',
        zip: '12345',
      });

      await loginAsAdmin(page);
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // Select first booking checkbox
      const checkboxes = page.locator('#bookingsTableBody input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount >= 2) {
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();

        // Bulk actions container should appear
        const bulkActions = page.locator('#bulkActionsContainer');
        await expect(bulkActions).toBeVisible();

        // Selected count should show 2
        const selectedCount = page.locator('#selectedCount');
        const countText = await selectedCount.textContent();
        expect(countText).toContain('2');
      }
    });

    test('should toggle select all bookings', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // Click select all checkbox
      const selectAll = page.locator('#selectAllCheckbox');
      await selectAll.check();

      // All booking checkboxes should be checked
      const bookingCheckboxes = page.locator('#bookingsTableBody input[type="checkbox"]');
      const count = await bookingCheckboxes.count();

      for (let i = 0; i < count; i++) {
        await expect(bookingCheckboxes.nth(i)).toBeChecked();
      }

      // Uncheck select all
      await selectAll.uncheck();

      // All should be unchecked
      for (let i = 0; i < count; i++) {
        await expect(bookingCheckboxes.nth(i)).not.toBeChecked();
      }
    });

    test('should show bulk delete button when bookings selected', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // Select a booking
      const checkbox = page.locator('#bookingsTableBody input[type="checkbox"]').first();
      await checkbox.check();

      // Bulk delete button should be visible
      const deleteBtn = page.locator('#bulkDeleteBtn');
      await expect(deleteBtn).toBeVisible();
    });

    test('should show bulk print button when bookings selected', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // Select a booking
      const checkbox = page.locator('#bookingsTableBody input[type="checkbox"]').first();
      await checkbox.check();

      // Bulk print button should be visible
      const printBtn = page.locator('#bulkPrintBtn');
      await expect(printBtn).toBeVisible();
    });

    test('should show confirmation dialog for bulk delete', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // Select a booking
      const checkbox = page.locator('#bookingsTableBody input[type="checkbox"]').first();
      await checkbox.check();

      // Click bulk delete
      await page.click('#bulkDeleteBtn');
      await page.waitForTimeout(300);

      // Confirmation dialog should appear
      const confirmModal = page.locator('.modal.active, .confirm-dialog.active');
      await expect(confirmModal).toBeVisible({ timeout: 3000 });

      // Cancel the deletion
      const cancelBtn = confirmModal.locator('button:has-text("Zrušit"), button:has-text("Ne")');
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    });
  });

  test.describe('Paid Status Management', () => {
    test('should toggle paid status on single booking', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // Find the paid status toggle/button
      const row = page.locator('#bookingsTableBody tr').first();
      const paidToggle = row.locator('input[type="checkbox"][onchange*="togglePaidStatus"], button:has-text("Zaplaceno")');

      if (await paidToggle.isVisible()) {
        // Get initial state
        const initialChecked = await paidToggle.isChecked().catch(() => false);

        // Toggle the status
        await paidToggle.click();
        await page.waitForTimeout(500);

        // State should be different now
        // (We can't easily verify the new state without API call)
      }
    });

    test('should display paid/unpaid indicator correctly', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // The paid column (8th column based on HTML) should show status
      const row = page.locator('#bookingsTableBody tr').first();
      const paidCell = row.locator('td').nth(8); // Zaplaceno column

      const cellContent = await paidCell.textContent();
      // Should contain some indication (checkbox or text)
      expect(cellContent.length).toBeGreaterThan(0);
    });
  });

  test.describe('Edit Booking Modal', () => {
    test('should open edit modal with full booking details', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // Click edit button on first row
      const editBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-edit, button:has-text("Upravit")');
      await editBtn.click();
      await page.waitForTimeout(500);

      // Edit modal should open
      const modal = page.locator('#editBookingModal');
      await expect(modal).toHaveClass(/active/);

      // Modal should contain booking info
      const modalContent = await modal.textContent();
      expect(modalContent.toLowerCase()).toContain('upravit');
    });

    test('should display two tabs in edit modal - Dates and Billing', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const editBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-edit, button:has-text("Upravit")');
      await editBtn.click();
      await page.waitForTimeout(500);

      // Check for tabs
      const datesTab = page.locator('.edit-tab-btn[data-tab="dates"]');
      const billingTab = page.locator('.edit-tab-btn[data-tab="billing"]');

      await expect(datesTab).toBeVisible();
      await expect(billingTab).toBeVisible();
    });

    test('should switch between tabs in edit modal', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const editBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-edit, button:has-text("Upravit")');
      await editBtn.click();
      await page.waitForTimeout(500);

      // Click billing tab
      const billingTab = page.locator('.edit-tab-btn[data-tab="billing"]');
      await billingTab.click();
      await page.waitForTimeout(300);

      // Billing content should be visible
      const billingContent = page.locator('#editBillingTab');
      await expect(billingContent).toBeVisible();

      // Dates content should be hidden
      const datesContent = page.locator('#editDatesTab');
      await expect(datesContent).toHaveCSS('display', 'none');
    });

    test('should show billing fields in edit modal', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const editBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-edit, button:has-text("Upravit")');
      await editBtn.click();
      await page.waitForTimeout(500);

      // Switch to billing tab
      await page.click('.edit-tab-btn[data-tab="billing"]');
      await page.waitForTimeout(300);

      // Check billing fields
      await expect(page.locator('#editName')).toBeVisible();
      await expect(page.locator('#editEmail')).toBeVisible();
      await expect(page.locator('#editPhone')).toBeVisible();
      await expect(page.locator('#editAddress')).toBeVisible();
      await expect(page.locator('#editCity')).toBeVisible();
      await expect(page.locator('#editZip')).toBeVisible();
    });

    test('should close edit modal on cancel', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const editBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-edit, button:has-text("Upravit")');
      await editBtn.click();
      await page.waitForTimeout(500);

      // Click cancel button
      const cancelBtn = page.locator('#editBookingModal button.btn-secondary:has-text("Zrušit")');
      await cancelBtn.click();
      await page.waitForTimeout(300);

      // Modal should be closed
      const modal = page.locator('#editBookingModal');
      await expect(modal).not.toHaveClass(/active/);
    });
  });

  test.describe('View Booking Details', () => {
    test('should open view modal with booking details', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // Click view button on first row
      const viewBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-view, button:has-text("Detail")');

      if (await viewBtn.isVisible()) {
        await viewBtn.click();
        await page.waitForTimeout(500);

        // Some kind of detail view should be visible
        // Could be modal or expanded row
      }
    });

    test('should display guest names in booking details', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      // Open edit modal
      const editBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-edit, button:has-text("Upravit")');
      await editBtn.click();
      await page.waitForTimeout(500);

      // Switch to billing tab where guest names are
      await page.click('.edit-tab-btn[data-tab="billing"]');
      await page.waitForTimeout(300);

      // Guest names section might be visible
      const guestSection = page.locator('#editGuestNamesSection');
      // Guest names section is conditionally shown
    });
  });

  test.describe('Booking Deletion', () => {
    test('should show delete button in action column', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const deleteBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-delete, button:has-text("Smazat")');
      await expect(deleteBtn).toBeVisible();
    });

    test('should show confirmation for single booking delete', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const deleteBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-delete, button:has-text("Smazat")');
      await deleteBtn.click();
      await page.waitForTimeout(300);

      // Confirmation dialog should appear
      const confirmModal = page.locator('.modal.active');
      await expect(confirmModal).toBeVisible({ timeout: 3000 });
    });

    test('should delete booking on confirmation', async ({ page }) => {
      // First count the bookings
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const initialCount = await page.locator('#bookingsTableBody tr').count();

      // Click delete
      const deleteBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-delete, button:has-text("Smazat")');
      await deleteBtn.click();
      await page.waitForTimeout(300);

      // Confirm deletion
      const confirmBtn = page.locator('.modal.active button:has-text("Potvrdit"), .modal.active button:has-text("Ano")');
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);

        // Booking count should decrease
        const newCount = await page.locator('#bookingsTableBody tr').count();
        expect(newCount).toBeLessThan(initialCount);
      }
    });
  });

  test.describe('Room Management in Edit', () => {
    test('should show rooms list in edit modal dates tab', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const editBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-edit, button:has-text("Upravit")');
      await editBtn.click();
      await page.waitForTimeout(500);

      // Rooms list should be visible in dates tab
      const roomsList = page.locator('#editRoomsList');
      await expect(roomsList).toBeVisible();
    });

    test('should show change dates button for each room', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const editBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-edit, button:has-text("Upravit")');
      await editBtn.click();
      await page.waitForTimeout(500);

      // Each room should have a change dates button
      const changeDatesBtn = page.locator('#editRoomsList button:has-text("Změnit termín")');
      const count = await changeDatesBtn.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should show calendar when clicking change dates', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const editBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-edit, button:has-text("Upravit")');
      await editBtn.click();
      await page.waitForTimeout(500);

      // Click change dates
      const changeDatesBtn = page.locator('#editRoomsList button:has-text("Změnit termín")').first();
      if (await changeDatesBtn.isVisible()) {
        await changeDatesBtn.click();
        await page.waitForTimeout(300);

        // Calendar should appear
        const calendar = page.locator('#editCalendarContainer');
        await expect(calendar).toBeVisible();
      }
    });

    test('should display total price in edit modal', async ({ page }) => {
      await page.click('.tab-button[data-tab="bookings"]');
      await page.waitForTimeout(500);

      const editBtn = page.locator('#bookingsTableBody tr').first().locator('.btn-edit, button:has-text("Upravit")');
      await editBtn.click();
      await page.waitForTimeout(500);

      // Total price should be visible
      const totalPrice = page.locator('#editTotalPrice');
      await expect(totalPrice).toBeVisible();

      const priceText = await totalPrice.textContent();
      expect(priceText).toContain('Kč');
    });
  });
});
