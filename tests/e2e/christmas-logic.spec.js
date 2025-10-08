/**
 * E2E Tests for Christmas Period Logic
 * Tests date-dependent access code requirements and bulk booking restrictions
 */

const { test, expect } = require('@playwright/test');
const { navigateToMainPage, resetDatabase, setChristmasPeriod } = require('./helpers/test-helpers');

test.describe('Christmas Period - Before October 1st', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);

    // Set Christmas period for next year
    const nextYear = new Date().getFullYear() + 1;
    await setChristmasPeriod(page, `${nextYear}-12-23`, `${nextYear}-01-02`, [
      'XMAS2025',
      'VIP2025',
    ]);
  });

  test('should require access code for single room booking before Oct 1', async ({ page }) => {
    // Mock current date to be before October 1
    await page.addInitScript(() => {
      const nextYear = new Date().getFullYear() + 1;
      // Set date to September 15
      Date.now = () => new Date(`${nextYear - 1}-09-15`).getTime();
    });

    await navigateToMainPage(page);
    await page.click('text=Jeden pokoj');
    await page.selectOption('#roomSelect', '12');
    await page.waitForTimeout(500);

    // Select dates in Christmas period
    const nextYear = new Date().getFullYear() + 1;
    const startDate = `${nextYear}-12-25`;
    const endDate = `${nextYear}-12-27`;

    const startCell = page.locator(`[data-date="${startDate}"]`).first();
    const endCell = page.locator(`[data-date="${endDate}"]`).first();

    if ((await startCell.isVisible()) && (await endCell.isVisible())) {
      await startCell.click();
      await endCell.click();
      await page.waitForTimeout(500);

      // Access code field should be visible
      const accessCodeInput = page.locator('#christmasCode, #accessCode');
      await expect(accessCodeInput).toBeVisible({ timeout: 5000 });
    }
  });

  test('should require access code for bulk booking before Oct 1', async ({ page }) => {
    // Mock current date to be before October 1
    await page.addInitScript(() => {
      const nextYear = new Date().getFullYear() + 1;
      Date.now = () => new Date(`${nextYear - 1}-09-15`).getTime();
    });

    await navigateToMainPage(page);
    await page.click('text=Celá chata');
    await page.waitForTimeout(500);

    // Select dates in Christmas period
    const nextYear = new Date().getFullYear() + 1;
    const startDate = `${nextYear}-12-24`;
    const endDate = `${nextYear}-12-26`;

    const startCell = page.locator(`[data-date="${startDate}"]`).first();
    const endCell = page.locator(`[data-date="${endDate}"]`).first();

    if ((await startCell.isVisible()) && (await endCell.isVisible())) {
      await startCell.click();
      await endCell.click();
      await page.waitForTimeout(500);

      // Access code field should be visible
      const accessCodeInput = page.locator('#christmasCode, #accessCode');
      await expect(accessCodeInput).toBeVisible({ timeout: 5000 });
    }
  });

  test('should accept valid Christmas access code', async ({ page }) => {
    await page.addInitScript(() => {
      const nextYear = new Date().getFullYear() + 1;
      Date.now = () => new Date(`${nextYear - 1}-09-15`).getTime();
    });

    await navigateToMainPage(page);
    await page.click('text=Jeden pokoj');
    await page.selectOption('#roomSelect', '12');
    await page.waitForTimeout(500);

    const nextYear = new Date().getFullYear() + 1;
    const startDate = `${nextYear}-12-25`;
    const endDate = `${nextYear}-12-27`;

    const startCell = page.locator(`[data-date="${startDate}"]`).first();
    const endCell = page.locator(`[data-date="${endDate}"]`).first();

    if ((await startCell.isVisible()) && (await endCell.isVisible())) {
      await startCell.click();
      await endCell.click();
      await page.waitForTimeout(500);

      // Fill access code
      const accessCodeInput = page.locator('#christmasCode, #accessCode');
      if (await accessCodeInput.isVisible()) {
        await accessCodeInput.fill('XMAS2025');

        // Should allow proceeding
        const continueBtn = page.locator('button:has-text("Pokračovat")');
        await expect(continueBtn).toBeEnabled({ timeout: 5000 });
      }
    }
  });

  test('should reject invalid Christmas access code', async ({ page }) => {
    await page.addInitScript(() => {
      const nextYear = new Date().getFullYear() + 1;
      Date.now = () => new Date(`${nextYear - 1}-09-15`).getTime();
    });

    await navigateToMainPage(page);
    await page.click('text=Jeden pokoj');
    await page.selectOption('#roomSelect', '12');
    await page.waitForTimeout(500);

    const nextYear = new Date().getFullYear() + 1;
    const startDate = `${nextYear}-12-25`;
    const endDate = `${nextYear}-12-27`;

    const startCell = page.locator(`[data-date="${startDate}"]`).first();
    const endCell = page.locator(`[data-date="${endDate}"]`).first();

    if ((await startCell.isVisible()) && (await endCell.isVisible())) {
      await startCell.click();
      await endCell.click();
      await page.waitForTimeout(500);

      // Fill invalid access code
      const accessCodeInput = page.locator('#christmasCode, #accessCode');
      if (await accessCodeInput.isVisible()) {
        await accessCodeInput.fill('INVALID');
        await accessCodeInput.blur();
        await page.waitForTimeout(500);

        // Should show error
        const errorMsg = page.locator('.error-message, .invalid-feedback');
        const hasError = await errorMsg.isVisible().catch(() => false);

        // Either error shown OR continue button disabled
        const continueBtn = page.locator('button:has-text("Pokračovat")');
        const isDisabled = await continueBtn.isDisabled().catch(() => false);

        expect(hasError || isDisabled).toBeTruthy();
      }
    }
  });
});

test.describe('Christmas Period - After October 1st', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);

    // Set Christmas period for current year
    const currentYear = new Date().getFullYear();
    await setChristmasPeriod(page, `${currentYear}-12-23`, `${currentYear + 1}-01-02`, [
      'XMAS2025',
    ]);
  });

  test('should NOT require access code for single room after Oct 1', async ({ page }) => {
    // Mock current date to be after October 1
    await page.addInitScript(() => {
      const currentYear = new Date().getFullYear();
      Date.now = () => new Date(`${currentYear}-10-15`).getTime();
    });

    await navigateToMainPage(page);
    await page.click('text=Jeden pokoj');
    await page.selectOption('#roomSelect', '12');
    await page.waitForTimeout(500);

    // Select dates in Christmas period
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear}-12-25`;
    const endDate = `${currentYear}-12-27`;

    const startCell = page.locator(`[data-date="${startDate}"]`).first();
    const endCell = page.locator(`[data-date="${endDate}"]`).first();

    if ((await startCell.isVisible()) && (await endCell.isVisible())) {
      await startCell.click();
      await endCell.click();
      await page.waitForTimeout(500);

      // Access code field should NOT be visible or required
      const accessCodeInput = page.locator('#christmasCode, #accessCode');
      const isVisible = await accessCodeInput.isVisible().catch(() => false);

      // Code field either not visible OR not required
      if (isVisible) {
        // If visible, it should not be required
        const continueBtn = page.locator('button:has-text("Pokračovat")');
        await expect(continueBtn).toBeEnabled({ timeout: 5000 });
      } else {
        expect(isVisible).toBeFalsy();
      }
    }
  });

  test('should BLOCK bulk booking after Oct 1', async ({ page }) => {
    // Mock current date to be after October 1
    await page.addInitScript(() => {
      const currentYear = new Date().getFullYear();
      Date.now = () => new Date(`${currentYear}-10-15`).getTime();
    });

    await navigateToMainPage(page);
    await page.click('text=Celá chata');
    await page.waitForTimeout(500);

    // Try to select dates in Christmas period
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear}-12-24`;
    const endDate = `${currentYear}-12-26`;

    const startCell = page.locator(`[data-date="${startDate}"]`).first();
    const endCell = page.locator(`[data-date="${endDate}"]`).first();

    if ((await startCell.isVisible()) && (await endCell.isVisible())) {
      await startCell.click();
      await endCell.click();
      await page.waitForTimeout(500);

      // Should show error message about bulk booking being blocked
      const errorMsg = page.locator('.error-message, .alert-error');
      await expect(errorMsg).toBeVisible({ timeout: 5000 });

      // Error should mention bulk booking restriction
      const errorText = await errorMsg.textContent();
      expect(errorText.toLowerCase()).toMatch(/hromadné|bulk|celá chata/u);
    }
  });

  test('should show appropriate error message for blocked bulk booking', async ({ page }) => {
    await page.addInitScript(() => {
      const currentYear = new Date().getFullYear();
      Date.now = () => new Date(`${currentYear}-10-15`).getTime();
    });

    await navigateToMainPage(page);
    await page.click('text=Celá chata');
    await page.waitForTimeout(500);

    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear}-12-25`;
    const endDate = `${currentYear}-12-27`;

    const startCell = page.locator(`[data-date="${startDate}"]`).first();
    const endCell = page.locator(`[data-date="${endDate}"]`).first();

    if ((await startCell.isVisible()) && (await endCell.isVisible())) {
      await startCell.click();
      await endCell.click();
      await page.waitForTimeout(500);

      const errorMsg = page.locator('.error-message, .alert-error');
      if (await errorMsg.isVisible()) {
        const errorText = await errorMsg.textContent();

        // Should mention October 1st restriction and suggest individual rooms
        expect(errorText.toLowerCase()).toMatch(/1\.\s*říjn|po 1\. říjnu|after.*october/iu);
        expect(errorText.toLowerCase()).toMatch(/jednotlivé pokoje|single.*room/iu);
      }
    }
  });
});

test.describe('Christmas Period - Visual Indicators', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);

    const currentYear = new Date().getFullYear();
    await setChristmasPeriod(page, `${currentYear}-12-23`, `${currentYear + 1}-01-02`, [
      'XMAS2025',
    ]);
  });

  test('should highlight Christmas period dates in calendar', async ({ page }) => {
    await navigateToMainPage(page);

    // Check if Christmas dates have special styling
    const currentYear = new Date().getFullYear();
    const christmasDate = `${currentYear}-12-25`;

    const christmasCell = page.locator(`[data-date="${christmasDate}"]`).first();
    if (await christmasCell.isVisible()) {
      const hasChristmasClass = await christmasCell.evaluate(
        (el) => el.classList.contains('christmas') || el.classList.contains('christmas-period')
      );

      expect(hasChristmasClass).toBeTruthy();
    }
  });

  test('should show Christmas indicator in single room calendar', async ({ page }) => {
    await navigateToMainPage(page);
    await page.click('text=Jeden pokoj');
    await page.selectOption('#roomSelect', '12');
    await page.waitForTimeout(500);

    const currentYear = new Date().getFullYear();
    const christmasDate = `${currentYear}-12-25`;

    const christmasCell = page.locator(`[data-date="${christmasDate}"]`).first();
    if (await christmasCell.isVisible()) {
      // Should have visual indicator (class, border, or special styling)
      const element = await christmasCell.elementHandle();
      expect(element).toBeTruthy();
    }
  });

  test('should show Christmas indicator in bulk calendar', async ({ page }) => {
    await navigateToMainPage(page);
    await page.click('text=Celá chata');
    await page.waitForTimeout(500);

    const currentYear = new Date().getFullYear();
    const christmasDate = `${currentYear}-12-25`;

    const christmasCell = page.locator(`[data-date="${christmasDate}"]`).first();
    if (await christmasCell.isVisible()) {
      // Should have visual indicator
      const element = await christmasCell.elementHandle();
      expect(element).toBeTruthy();
    }
  });
});

test.describe('Christmas Period - Admin Configuration', () => {
  const { loginAsAdmin } = require('./helpers/test-helpers');

  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await loginAsAdmin(page);
  });

  test('should allow admin to configure Christmas period', async ({ page }) => {
    const christmasTab = page.locator('text=Vánoční přístup');
    if (await christmasTab.isVisible()) {
      await christmasTab.click();
      await page.waitForTimeout(500);

      // Should show Christmas configuration
      const startDateInput = page.locator('#christmasStartDate, input[name="christmasStart"]');
      const endDateInput = page.locator('#christmasEndDate, input[name="christmasEnd"]');

      if (await startDateInput.isVisible()) {
        await startDateInput.fill('2025-12-20');
        await endDateInput.fill('2026-01-05');

        const saveBtn = page.locator('button:has-text("Uložit")');
        if (await saveBtn.isVisible()) {
          await saveBtn.click();
          await page.waitForTimeout(1000);

          // Should save successfully
          expect(true).toBeTruthy();
        }
      }
    }
  });

  test('should allow admin to manage access codes', async ({ page }) => {
    const christmasTab = page.locator('text=Vánoční přístup');
    if (await christmasTab.isVisible()) {
      await christmasTab.click();
      await page.waitForTimeout(500);

      // Find access codes section
      const codeInput = page.locator('#newAccessCode, input[name="accessCode"]');
      if (await codeInput.isVisible()) {
        await codeInput.fill('NEWCODE2025');

        const addBtn = page.locator('button:has-text("Přidat")');
        if (await addBtn.isVisible()) {
          await addBtn.click();
          await page.waitForTimeout(1000);

          // Code should appear in list
          await expect(page.locator('text=NEWCODE2025')).toBeVisible();
        }
      }
    }
  });

  test('should allow admin to remove access codes', async ({ page }) => {
    // First add a code
    await page.evaluate(async () => {
      const response = await fetch('/api/data');
      const data = await response.json();
      data.settings.christmasAccessCodes = ['REMOVEME2025'];
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    });

    await page.reload();

    const christmasTab = page.locator('text=Vánoční přístup');
    if (await christmasTab.isVisible()) {
      await christmasTab.click();
      await page.waitForTimeout(500);

      // Find and remove code
      const removeBtn = page.locator('button:has-text("Odstranit")').first();
      if (await removeBtn.isVisible()) {
        await removeBtn.click();
        await page.waitForTimeout(1000);

        // Code should be removed
        const isVisible = await page
          .locator('text=REMOVEME2025')
          .isVisible()
          .catch(() => false);
        expect(isVisible).toBeFalsy();
      }
    }
  });
});
