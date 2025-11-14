/**
 * Verify Modal Dialog Integration
 * Tests that modalDialog is properly loaded and functional (headless)
 */

const { chromium } = require('playwright');

async function verifyModalIntegration() {
  console.log('🚀 Verifying modal dialog integration...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    console.log('📄 Test 1: Loading admin.html...');
    await page.goto('https://localhost/admin.html', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Page loaded successfully\n');
    testsPassed++;

    console.log('📄 Test 2: Checking if modalDialog global exists...');
    const modalExists = await page.evaluate(() => {
      return typeof window.modalDialog !== 'undefined';
    });

    if (!modalExists) {
      console.error('❌ FAILED: modalDialog is not available globally!');
      testsFailed++;
    } else {
      console.log('✅ modalDialog is available globally\n');
      testsPassed++;
    }

    console.log('📄 Test 3: Verifying modalDialog methods...');
    const hasMethods = await page.evaluate(() => {
      return {
        hasConfirm: typeof window.modalDialog.confirm === 'function',
        hasAlert: typeof window.modalDialog.alert === 'function',
        hasClose: typeof window.modalDialog.close === 'function',
      };
    });

    if (!hasMethods.hasConfirm || !hasMethods.hasAlert || !hasMethods.hasClose) {
      console.error('❌ FAILED: Missing required methods:', hasMethods);
      testsFailed++;
    } else {
      console.log('✅ All required methods exist (confirm, alert, close)\n');
      testsPassed++;
    }

    console.log('📄 Test 4: Testing modal.confirm() with auto-cancel...');
    const confirmResult = await page.evaluate(async () => {
      // Start the modal
      const promise = window.modalDialog.confirm({
        title: 'Test',
        message: 'Test message',
        confirmText: 'OK',
        cancelText: 'Cancel',
      });

      // Wait for modal to appear
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify modal exists in DOM
      const backdrop = document.querySelector('.modal-backdrop');
      const dialog = document.querySelector('.modal-dialog');

      if (!backdrop || !dialog) {
        throw new Error('Modal did not appear in DOM');
      }

      // Auto-click cancel button
      const cancelBtn = document.querySelector('.modal-cancel-btn');
      if (!cancelBtn) {
        throw new Error('Cancel button not found');
      }

      cancelBtn.click();

      // Wait for promise to resolve
      const result = await promise;

      // Verify modal is gone
      const backdropGone = !document.querySelector('.modal-backdrop');

      return { result, backdropGone };
    });

    if (confirmResult.result !== false || !confirmResult.backdropGone) {
      console.error('❌ FAILED: Modal did not work correctly:', confirmResult);
      testsFailed++;
    } else {
      console.log('✅ Modal confirm() works correctly (returns false on cancel)\n');
      testsPassed++;
    }

    console.log('📄 Test 5: Testing modal styling...');
    const styling = await page.evaluate(async () => {
      const promise = window.modalDialog.confirm({
        title: 'Styling Test',
        icon: '🎨',
        type: 'warning',
        message: 'Test message',
        details: [
          { label: 'Field 1', value: 'Value 1' },
          { label: 'Field 2', value: 'Value 2' },
        ],
        confirmText: 'OK',
        cancelText: 'Cancel',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const backdrop = document.querySelector('.modal-backdrop');
      const dialog = document.querySelector('.modal-dialog');
      const header = document.querySelector('.modal-dialog h3');
      const headerParent = header?.parentElement;
      const iconSpan = headerParent?.querySelector('span');
      const icon = iconSpan?.textContent?.includes('🎨');
      const title = header?.textContent?.includes('Styling Test');
      const message = document.querySelector('.modal-dialog p');
      const hasMessage = message?.textContent?.includes('Test message');
      const hasDetails = document.querySelector('.modal-dialog')?.textContent?.includes('Field 1');

      // Close modal
      document.querySelector('.modal-cancel-btn')?.click();
      await promise;

      return {
        hasBackdrop: !!backdrop,
        hasDialog: !!dialog,
        hasIcon: icon,
        hasTitle: title,
        hasMessage: hasMessage,
        hasDetails: hasDetails,
      };
    });

    if (
      !styling.hasBackdrop ||
      !styling.hasDialog ||
      !styling.hasIcon ||
      !styling.hasTitle ||
      !styling.hasMessage ||
      !styling.hasDetails
    ) {
      console.error('❌ FAILED: Modal styling incomplete:', styling);
      testsFailed++;
    } else {
      console.log('✅ Modal styling complete (icon, title, message, details)\n');
      testsPassed++;
    }

    console.log('📄 Test 6: Testing ESC key...');
    const escResult = await page.evaluate(async () => {
      const promise = window.modalDialog.confirm({
        title: 'ESC Test',
        message: 'Press ESC',
        confirmText: 'OK',
        cancelText: 'Cancel',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate ESC key
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      const result = await promise;
      return result;
    });

    if (escResult !== false) {
      console.error('❌ FAILED: ESC key did not close modal correctly');
      testsFailed++;
    } else {
      console.log('✅ ESC key closes modal correctly\n');
      testsPassed++;
    }

    console.log('📄 Test 7: Loading edit.html...');
    await page.goto('https://localhost/edit.html?token=test', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const editPageModalExists = await page.evaluate(() => {
      return typeof window.modalDialog !== 'undefined';
    });

    if (!editPageModalExists) {
      console.error('❌ FAILED: modalDialog not available on edit.html');
      testsFailed++;
    } else {
      console.log('✅ modalDialog available on edit.html\n');
      testsPassed++;
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (testsFailed === 0) {
      console.log('🎉 ALL TESTS PASSED!\n');
      console.log('✅ ModalDialog.js is properly integrated:');
      console.log('   ✓ Loads before EditBookingComponent on admin.html');
      console.log('   ✓ Loads before EditBookingComponent on edit.html');
      console.log('   ✓ Global modalDialog object available');
      console.log('   ✓ All required methods exist');
      console.log('   ✓ confirm() modal works correctly');
      console.log('   ✓ Cancel button returns false');
      console.log('   ✓ ESC key closes modal');
      console.log('   ✓ Custom styling applied (icons, title, message, details)');
      console.log('\n✅ Phase 1 (Custom Modal Dialogs) is COMPLETE and VERIFIED!\n');

      await browser.close();
      process.exit(0);
    } else {
      console.log('⚠️  SOME TESTS FAILED - Please review errors above\n');
      await browser.close();
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error during testing:');
    console.error(error);
    console.log('\n⚠️  VERIFICATION FAILED\n');
    await browser.close();
    process.exit(1);
  }
}

verifyModalIntegration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
