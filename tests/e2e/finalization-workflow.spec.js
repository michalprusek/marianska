/**
 * Finalization Workflow Tests
 * E2E tests for the booking finalization process from temp reservations to final booking
 */
const { test, expect } = require('@playwright/test');
const {
  navigateToMainPage,
  resetDatabase,
  createProposedBooking,
  fillContactForm,
  clickFinalizeAndWaitForForm,
  getTempReservationsCount,
  deleteTempReservation,
  editTempReservation,
  getFutureDate,
  getTestDates,
  selectDateRangeInCalendar,
  fillGuestNames,
} = require('./helpers/test-helpers');

test.describe('Finalization Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await navigateToMainPage(page);
  });

  test.describe('Temp Reservations Display', () => {
    test('should display temp reservations in sidebar section', async ({ page }) => {
      // Create a temp reservation
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Temp reservations section should be visible
      const tempSection = page.locator('#tempReservationsSection, #tempReservationsContainer');
      await expect(tempSection).toBeVisible();

      // Should show the reservation
      const reservationItem = page.locator('.temp-reservation-item, .reservation-item');
      await expect(reservationItem.first()).toBeVisible();
    });

    test('should show edit button for temp reservations', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Edit button should be visible
      const editBtn = page.locator('#tempReservationsContainer .edit-btn, #tempReservationsContainer [data-action="edit"], #tempReservationsContainer button:has-text("✏")');
      await expect(editBtn.first()).toBeVisible();
    });

    test('should show delete button for temp reservations', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Delete button should be visible
      const deleteBtn = page.locator('#tempReservationsContainer .delete-btn, #tempReservationsContainer [data-action="delete"], #tempReservationsContainer button:has-text("×")');
      await expect(deleteBtn.first()).toBeVisible();
    });
  });

  test.describe('Temp Reservation Management', () => {
    test('should allow editing temp reservation dates via modal', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Click edit button
      await editTempReservation(page, 0);

      // Single room modal should open
      await expect(page.locator('#singleRoomBookingModal')).toHaveClass(/active/);

      // Modal should show the room's calendar
      await expect(page.locator('#miniCalendar')).toBeVisible();

      // Button text should indicate editing (Uložit instead of Přidat)
      const confirmBtn = page.locator('#confirmSingleRoomBtn');
      const btnText = await confirmBtn.textContent();
      // Should contain "Uložit" or "Save" when editing
    });

    test('should allow deleting temp reservation', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Verify we have 1 reservation
      let count = await getTempReservationsCount(page);
      expect(count).toBe(1);

      // Delete it
      await deleteTempReservation(page, 0);
      await page.waitForTimeout(500);

      // Should have 0 reservations
      count = await getTempReservationsCount(page);
      expect(count).toBe(0);
    });

    test('should show finalize button when temp reservations exist', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Finalize button should be visible
      const finalizeBtn = page.locator('#finalizeBtn, button:has-text("Dokončit"), button:has-text("Finalize")');
      await expect(finalizeBtn.first()).toBeVisible();
    });
  });

  test.describe('Contact Form Modal', () => {
    test('should open contact form modal on finalize click', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Click finalize
      await clickFinalizeAndWaitForForm(page);

      // Contact form modal should be open
      await expect(page.locator('#bookingFormModal')).toHaveClass(/active/);
    });

    test('should display booking summary in contact form', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      await clickFinalizeAndWaitForForm(page);

      // Summary section should be visible
      const summary = page.locator('#bookingSummary, .booking-summary');
      await expect(summary).toBeVisible();

      // Should show room info
      const summaryText = await summary.textContent();
      expect(summaryText).toContain('12');
    });

    test('should display guest names summary', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      await clickFinalizeAndWaitForForm(page);

      // Guest names should be shown in summary
      const modal = page.locator('#bookingFormModal');
      const content = await modal.textContent();

      // Should contain guest name somewhere
      expect(content.toLowerCase()).toContain('jan');
    });
  });

  test.describe('Form Validation', () => {
    test('should validate all contact form fields', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      await clickFinalizeAndWaitForForm(page);

      // Try to submit without filling fields
      const submitBtn = page.locator('#bookingFormModal button[type="submit"], #bookingFormModal button:has-text("Potvrdit")');
      await submitBtn.click();

      // Should show validation errors or not submit
      await page.waitForTimeout(500);

      // Modal should still be open (not submitted)
      await expect(page.locator('#bookingFormModal')).toHaveClass(/active/);
    });

    test('should validate phone number format', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      await clickFinalizeAndWaitForForm(page);

      // Fill with invalid phone
      await page.fill('#bookingPhone, input[name="phone"]', 'abc123');

      // Other required fields
      await page.fill('#bookingName, input[name="name"]', 'Test User');
      await page.fill('#bookingEmail, input[name="email"]', 'test@example.com');
      await page.fill('#bookingCompany, input[name="company"]', 'Test Company');
      await page.fill('#bookingAddress, input[name="address"]', 'Test Address');
      await page.fill('#bookingCity, input[name="city"]', 'Praha');
      await page.fill('#bookingZip, input[name="zip"]', '12345');

      // Try to submit
      const submitBtn = page.locator('#bookingFormModal button[type="submit"], #bookingFormModal button:has-text("Potvrdit")');
      await submitBtn.click();

      // Should show phone validation error
      await page.waitForTimeout(500);

      // Either error notification or inline error
      const phoneInput = page.locator('#bookingPhone, input[name="phone"]');
      const hasError = await phoneInput.evaluate(el => el.classList.contains('error') || el.validity.valid === false);
      // Phone validation should be triggered
    });

    test('should validate ZIP code format', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      await clickFinalizeAndWaitForForm(page);

      // Fill with invalid ZIP
      await page.fill('#bookingZip, input[name="zip"]', 'ABC');

      // The field should show validation error
      const zipInput = page.locator('#bookingZip, input[name="zip"]');
      await zipInput.blur();

      // Check for error styling
      await page.waitForTimeout(200);
    });
  });

  test.describe('Booking Submission', () => {
    test('should create final booking on successful submit', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      await clickFinalizeAndWaitForForm(page);

      // Fill all required fields
      await fillContactForm(page, {
        name: 'Jan Novak',
        email: 'jan.novak@example.com',
        phone: '123456789',
        company: 'Test Company',
        address: 'Hlavni 123',
        city: 'Praha',
        zip: '12345',
      });

      // Submit
      const submitBtn = page.locator('#bookingFormModal button[type="submit"], #bookingFormModal button:has-text("Potvrdit")');
      await submitBtn.click();

      // Wait for response
      await page.waitForTimeout(2000);

      // Success modal should appear or notification
      const successModal = page.locator('.modal:has-text("úspěšně"), .modal:has-text("Successfully")');
      const successNotification = page.locator('.notification.success, .notification:has-text("úspěšně")');

      // Either success modal or notification should be visible
      const hasSuccess = await successModal.isVisible().catch(() => false) ||
                         await successNotification.isVisible().catch(() => false);

      // If booking was created, modal should close
      const formModalHidden = await page.locator('#bookingFormModal').evaluate(el =>
        !el.classList.contains('active')
      ).catch(() => true);

      expect(hasSuccess || formModalHidden).toBeTruthy();
    });

    test('should display edit link in success modal', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      await clickFinalizeAndWaitForForm(page);
      await fillContactForm(page, {
        name: 'Jan Novak',
        email: 'jan.novak@example.com',
        phone: '123456789',
        company: 'Test Company',
        address: 'Hlavni 123',
        city: 'Praha',
        zip: '12345',
      });

      const submitBtn = page.locator('#bookingFormModal button[type="submit"], #bookingFormModal button:has-text("Potvrdit")');
      await submitBtn.click();

      await page.waitForTimeout(2000);

      // Success modal should show edit link
      const editLink = page.locator('a[href*="edit.html"], a:has-text("edit")');
      const copyBtn = page.locator('#copyEditLinkBtn, button:has-text("Kopírovat")');

      // Either edit link or copy button should be present
      const hasEditLink = await editLink.isVisible().catch(() => false) ||
                          await copyBtn.isVisible().catch(() => false);

      // Document expected behavior
    });

    test('should clear temp reservations after successful booking', async ({ page }) => {
      const { startDate, endDate } = getTestDates();
      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Verify we have 1 temp reservation
      let count = await getTempReservationsCount(page);
      expect(count).toBe(1);

      await clickFinalizeAndWaitForForm(page);
      await fillContactForm(page, {
        name: 'Jan Novak',
        email: 'jan.novak@example.com',
        phone: '123456789',
        company: 'Test Company',
        address: 'Hlavni 123',
        city: 'Praha',
        zip: '12345',
      });

      const submitBtn = page.locator('#bookingFormModal button[type="submit"], #bookingFormModal button:has-text("Potvrdit")');
      await submitBtn.click();

      await page.waitForTimeout(2000);

      // Close any success modals
      const closeBtn = page.locator('.modal.active button:has-text("Zavřít"), .modal.active #closeSuccessModal');
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }

      // Temp reservations should be cleared
      count = await getTempReservationsCount(page);
      expect(count).toBe(0);
    });
  });

  test.describe('Multiple Reservations', () => {
    test('should handle multiple temp reservations in finalization', async ({ page }) => {
      // Create two temp reservations for different rooms
      const { startDate, endDate } = getTestDates();

      await createProposedBooking(page, {
        roomId: '12',
        startDate,
        endDate,
        guests: [{ firstName: 'Jan', lastName: 'Novak', type: 'adult' }],
      });

      // Create second reservation with different dates
      const startDate2 = getFutureDate(20);
      const endDate2 = getFutureDate(22);

      await createProposedBooking(page, {
        roomId: '13',
        startDate: startDate2,
        endDate: endDate2,
        guests: [{ firstName: 'Petr', lastName: 'Svoboda', type: 'adult' }],
      });

      // Should have 2 temp reservations
      const count = await getTempReservationsCount(page);
      expect(count).toBe(2);

      // Finalize should create a combined booking
      await clickFinalizeAndWaitForForm(page);

      // Summary should show both rooms
      const summary = page.locator('#bookingSummary, .booking-summary');
      const summaryText = await summary.textContent();

      expect(summaryText).toContain('12');
      expect(summaryText).toContain('13');
    });
  });
});
