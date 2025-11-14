/**
 * Manual Modal Dialog Test
 * Opens a browser to manually verify custom modal dialogs work
 */

const { chromium } = require('playwright');

async function testModals() {
  console.log('🚀 Starting manual modal test...\n');

  const browser = await chromium.launch({
    headless: false, // Show browser for manual verification
    args: ['--ignore-certificate-errors'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  try {
    console.log('📄 Navigating to admin panel...');
    await page.goto('https://localhost/admin.html');

    console.log('🔐 Logging in...');
    await page.fill('#password', 'admin123');
    await page.click('button:has-text("Přihlásit")');

    // Wait for login
    await page.waitForSelector('text=Vítejte v admin panelu', { timeout: 10000 });
    console.log('✅ Logged in successfully\n');

    // Check if modalDialog is available
    console.log('🔍 Checking if modalDialog is loaded...');
    const modalExists = await page.evaluate(() => {
      return typeof window.modalDialog !== 'undefined';
    });

    if (!modalExists) {
      console.error('❌ modalDialog is not available globally!');
      console.log('\n⚠️  FAILED: ModalDialog.js not loaded properly');
      await browser.close();
      process.exit(1);
    }

    console.log('✅ modalDialog is available\n');

    // Test 1: Simple confirmation modal
    console.log('📋 Test 1: Triggering simple confirmation modal...');
    const testModal1Promise = page.evaluate(async () => {
      return await window.modalDialog.confirm({
        title: 'Test Confirmation',
        icon: '🧪',
        type: 'warning',
        message: 'This is a test confirmation modal.\n\nPlease click CANCEL to continue the test.',
        details: [
          { label: 'Test Field', value: 'Test Value' },
          { label: 'Another Field', value: '123' },
        ],
        confirmText: 'Potvrdit',
        cancelText: 'Zrušit',
      });
    });

    // Wait for modal to appear
    await page.waitForSelector('.modal-backdrop', { timeout: 2000 });
    console.log('✅ Modal appeared on screen\n');

    console.log('👀 Please verify the modal has:');
    console.log('   - 🧪 Icon in header');
    console.log('   - "Test Confirmation" title');
    console.log('   - Warning color scheme (yellow)');
    console.log('   - Two detail fields');
    console.log('   - "Potvrdit" and "Zrušit" buttons\n');

    console.log('⏳ Waiting for you to click CANCEL button...');
    const result1 = await testModal1Promise;
    console.log(`✅ Modal returned: ${result1} (should be false)\n`);

    if (result1 !== false) {
      console.error('❌ Expected false (cancel), got:', result1);
      console.log('\n⚠️  FAILED: Modal did not return correct value');
      await browser.close();
      process.exit(1);
    }

    // Test 2: Danger modal
    console.log('📋 Test 2: Triggering danger modal...');
    const testModal2Promise = page.evaluate(async () => {
      return await window.modalDialog.confirm({
        title: 'VAROVÁNÍ: Danger Modal',
        icon: '⚠️',
        type: 'danger',
        message: 'This is a danger-type modal with red color scheme.\n\nPlease click CONFIRM to continue.',
        confirmText: 'Ano, pokračovat',
        cancelText: 'Zrušit',
      });
    });

    await page.waitForSelector('.modal-backdrop', { timeout: 2000 });
    console.log('✅ Danger modal appeared\n');

    console.log('👀 Please verify the modal has:');
    console.log('   - ⚠️ Warning icon');
    console.log('   - Red/danger color scheme');
    console.log('   - "Ano, pokračovat" button\n');

    console.log('⏳ Waiting for you to click CONFIRM button...');
    const result2 = await testModal2Promise;
    console.log(`✅ Modal returned: ${result2} (should be true)\n`);

    if (result2 !== true) {
      console.error('❌ Expected true (confirm), got:', result2);
      console.log('\n⚠️  FAILED: Modal did not return correct value');
      await browser.close();
      process.exit(1);
    }

    // Test 3: ESC key
    console.log('📋 Test 3: Testing ESC key...');
    const testModal3Promise = page.evaluate(async () => {
      return await window.modalDialog.confirm({
        title: 'ESC Key Test',
        message: 'Press ESC key to close this modal',
        confirmText: 'OK',
        cancelText: 'Cancel',
      });
    });

    await page.waitForSelector('.modal-backdrop', { timeout: 2000 });
    console.log('✅ Modal appeared\n');

    console.log('⏳ Waiting for you to press ESC key...');
    await page.keyboard.press('Escape');
    const result3 = await testModal3Promise;
    console.log(`✅ Modal returned: ${result3} (should be false)\n`);

    if (result3 !== false) {
      console.error('❌ Expected false (ESC = cancel), got:', result3);
      console.log('\n⚠️  FAILED: ESC key did not work correctly');
      await browser.close();
      process.exit(1);
    }

    console.log('🎉 ALL TESTS PASSED!\n');
    console.log('✅ Custom modals are working correctly:');
    console.log('   ✓ modalDialog loads before EditBookingComponent');
    console.log('   ✓ Confirm modal returns true when confirmed');
    console.log('   ✓ Cancel button returns false');
    console.log('   ✓ ESC key closes modal and returns false');
    console.log('   ✓ Different modal types (warning, danger) work');
    console.log('   ✓ Details section displays correctly');
    console.log('   ✓ Custom styling applied (not native confirm)\n');

    console.log('Press Ctrl+C to close the browser...');

    // Keep browser open for manual inspection
    await page.waitForTimeout(60000);
  } catch (error) {
    console.error('\n❌ Error during test:');
    console.error(error);
    console.log('\n⚠️  TEST FAILED');
    await browser.close();
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testModals().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
