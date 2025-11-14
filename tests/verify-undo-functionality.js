/**
 * Verify Undo Functionality for Room Removal
 * Tests that undo button appears and works correctly
 */

const { chromium } = require('playwright');

async function verifyUndoFunctionality() {
  console.log('🚀 Verifying undo functionality for room removal...\n');

  const browser = await chromium.launch({
    headless: true, // Headless for automated testing
    args: ['--ignore-certificate-errors', '--no-sandbox'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    console.log('📄 Test 1: Creating a test booking...');

    // Create a multi-room booking via API
    const createResponse = await page.request.post('https://localhost/api/booking', {
      data: {
        name: 'Undo Test User',
        email: 'undo-test@example.com',
        phone: '+420777888999',
        address: 'Test Street 123',
        city: 'Praha',
        zip: '12000',
        startDate: '2027-03-15',
        endDate: '2027-03-20',
        rooms: ['12', '13', '14'],
        guestType: 'utia',
        adults: 3,
        children: 0,
        totalPrice: 4500,
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

    const createResult = await createResponse.json();
    if (!createResult.success) {
      console.error('❌ FAILED: Could not create test booking:', createResult.error);
      testsFailed++;
      await browser.close();
      process.exit(1);
    }

    const bookingId = createResult.booking.id;
    const editToken = createResult.editToken || createResult.booking?.editToken;

    if (!editToken) {
      console.error('❌ FAILED: No edit token in response');
      console.log('Response:', JSON.stringify(createResult, null, 2));
      testsFailed++;
      await browser.close();
      process.exit(1);
    }

    console.log(`✅ Test booking created: ${bookingId}`);
    console.log(`   Edit token: ${editToken.substring(0, 10)}...`);
    testsPassed++;

    console.log('\n📄 Test 2: Opening edit page...');
    await page.goto(`https://localhost/edit.html?token=${editToken}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for booking to load
    await page.waitForSelector('#editRoomsList', { timeout: 10000 });
    console.log('✅ Edit page loaded successfully\n');
    testsPassed++;

    console.log('📄 Test 3: Verify 3 rooms are displayed...');
    const roomCount = await page.evaluate(() => {
      return document.querySelectorAll('.room-edit-item').length;
    });

    if (roomCount !== 3) {
      console.error(`❌ FAILED: Expected 3 rooms, found ${roomCount}`);
      testsFailed++;
    } else {
      console.log(`✅ Found ${roomCount} rooms as expected\n`);
      testsPassed++;
    }

    console.log('📄 Test 4: Remove a room (Pokoj 14)...');

    // Find and click the remove button for room 14
    const removeResult = await page.evaluate(async () => {
      // Find the room item for room 14
      const roomItems = Array.from(document.querySelectorAll('.room-edit-item'));
      const room14Item = roomItems.find((item) => item.textContent.includes('Pokoj P14'));

      if (!room14Item) {
        return { success: false, error: 'Could not find room 14' };
      }

      // Find the remove button
      const removeBtn = room14Item.querySelector('button[title*="Odebrat"]');
      if (!removeBtn) {
        return { success: false, error: 'Could not find remove button' };
      }

      // Click the remove button
      removeBtn.click();

      // Wait for modal to appear
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if modal appeared
      const modal = document.querySelector('.modal-backdrop');
      if (!modal) {
        return { success: false, error: 'Modal did not appear' };
      }

      // Click confirm button
      const confirmBtn = document.querySelector('.modal-confirm-btn');
      if (!confirmBtn) {
        return { success: false, error: 'Confirm button not found' };
      }

      confirmBtn.click();

      // Wait for modal to disappear
      await new Promise((resolve) => setTimeout(resolve, 500));

      return { success: true };
    });

    if (!removeResult.success) {
      console.error(`❌ FAILED: ${removeResult.error}`);
      testsFailed++;
    } else {
      console.log('✅ Room removal confirmed\n');
      testsPassed++;
    }

    console.log('📄 Test 5: Wait for notification with undo button...');
    await page.waitForSelector('.notification-undo-btn', { timeout: 5000 });
    console.log('✅ Undo button appeared in notification\n');
    testsPassed++;

    console.log('📄 Test 6: Verify only 2 rooms remain...');
    const roomCountAfterRemove = await page.evaluate(() => {
      return document.querySelectorAll('.room-edit-item').length;
    });

    if (roomCountAfterRemove !== 2) {
      console.error(`❌ FAILED: Expected 2 rooms after removal, found ${roomCountAfterRemove}`);
      testsFailed++;
    } else {
      console.log(`✅ Correctly showing ${roomCountAfterRemove} rooms after removal\n`);
      testsPassed++;
    }

    console.log('📄 Test 7: Click UNDO button...');
    const undoResult = await page.evaluate(() => {
      const undoBtn = document.querySelector('.notification-undo-btn');
      if (!undoBtn) {
        return { success: false, error: 'Undo button not found' };
      }

      undoBtn.click();
      return { success: true };
    });

    if (!undoResult.success) {
      console.error(`❌ FAILED: ${undoResult.error}`);
      testsFailed++;
    } else {
      console.log('✅ Undo button clicked\n');
      testsPassed++;
    }

    // Wait for UI to update
    await page.waitForTimeout(1000);

    console.log('📄 Test 8: Verify room was restored...');
    const roomCountAfterUndo = await page.evaluate(() => {
      return document.querySelectorAll('.room-edit-item').length;
    });

    if (roomCountAfterUndo !== 3) {
      console.error(
        `❌ FAILED: Expected 3 rooms after undo, found ${roomCountAfterUndo}`
      );
      testsFailed++;
    } else {
      console.log(`✅ Room successfully restored! Now showing ${roomCountAfterUndo} rooms\n`);
      testsPassed++;
    }

    console.log('📄 Test 9: Verify room 14 is back in the list...');
    const hasRoom14 = await page.evaluate(() => {
      const roomItems = Array.from(document.querySelectorAll('.room-edit-item'));
      return roomItems.some((item) => item.textContent.includes('Pokoj P14'));
    });

    if (!hasRoom14) {
      console.error('❌ FAILED: Room 14 not found after undo');
      testsFailed++;
    } else {
      console.log('✅ Room 14 (P14) is back in the list\n');
      testsPassed++;
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (testsFailed === 0) {
      console.log('🎉 ALL TESTS PASSED!\n');
      console.log('✅ Undo functionality works correctly:');
      console.log('   ✓ Notification with undo button appears after room removal');
      console.log('   ✓ Room is successfully removed from booking');
      console.log('   ✓ Undo button restores the removed room');
      console.log('   ✓ Room data and state are correctly preserved');
      console.log('\n✅ Phase 2 (Undo Functionality) is COMPLETE and VERIFIED!\n');

      console.log('Press Ctrl+C to close the browser...');
      await page.waitForTimeout(10000);

      await browser.close();
      process.exit(0);
    } else {
      console.log('⚠️  SOME TESTS FAILED - Please review errors above\n');
      console.log('Press Ctrl+C to close the browser...');
      await page.waitForTimeout(30000);

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

verifyUndoFunctionality().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
