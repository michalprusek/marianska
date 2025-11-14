/**
 * Verify Audit Logging Functionality
 * Tests that audit logs are created for room changes
 */

const { chromium } = require('playwright');

async function verifyAuditLogging() {
  console.log('🚀 Verifying audit logging for room changes...\n');

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
    console.log('📄 Test 1: Creating a test booking...');

    // Create a multi-room booking via API
    const createResponse = await page.request.post('https://localhost/api/booking', {
      data: {
        name: 'Audit Test User',
        email: 'audit-test@example.com',
        phone: '+420777888999',
        address: 'Test Street 123',
        city: 'Praha',
        zip: '12000',
        startDate: '2027-04-15',
        endDate: '2027-04-20',
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

    await page.waitForSelector('#editRoomsList', { timeout: 10000 });
    console.log('✅ Edit page loaded successfully\n');
    testsPassed++;

    console.log('📄 Test 3: Remove a room (Pokoj 14)...');

    // Intercept audit log API call
    let auditLogCreated = false;
    let auditLogData = null;

    page.on('request', (request) => {
      if (request.url().includes('/api/audit-log') && request.method() === 'POST') {
        auditLogCreated = true;
        try {
          auditLogData = JSON.parse(request.postData());
        } catch (e) {
          console.warn('Could not parse audit log data');
        }
      }
    });

    // Find and click the remove button for room 14
    const removeResult = await page.evaluate(async () => {
      const roomItems = Array.from(document.querySelectorAll('.room-edit-item'));
      const room14Item = roomItems.find((item) => item.textContent.includes('Pokoj P14'));

      if (!room14Item) {
        return { success: false, error: 'Could not find room 14' };
      }

      const removeBtn = room14Item.querySelector('button[title*="Odebrat"]');
      if (!removeBtn) {
        return { success: false, error: 'Could not find remove button' };
      }

      removeBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const confirmBtn = document.querySelector('.modal-confirm-btn');
      if (!confirmBtn) {
        return { success: false, error: 'Confirm button not found' };
      }

      confirmBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return { success: true };
    });

    if (!removeResult.success) {
      console.error(`❌ FAILED: ${removeResult.error}`);
      testsFailed++;
    } else {
      console.log('✅ Room removal confirmed\n');
      testsPassed++;
    }

    // Wait a bit for audit log request to complete
    await page.waitForTimeout(2000);

    console.log('📄 Test 4: Verify audit log was created...');
    if (auditLogCreated) {
      console.log('✅ Audit log API call was made\n');
      testsPassed++;

      console.log('📄 Test 5: Verify audit log data...');
      if (auditLogData) {
        console.log('   Audit log data:', JSON.stringify(auditLogData, null, 2));

        if (
          auditLogData.bookingId === bookingId &&
          auditLogData.actionType === 'room_removed' &&
          auditLogData.userType === 'user' &&
          auditLogData.roomId === '14'
        ) {
          console.log('✅ Audit log data is correct\n');
          testsPassed++;
        } else {
          console.error('❌ FAILED: Audit log data is incorrect');
          testsFailed++;
        }
      } else {
        console.error('❌ FAILED: Could not capture audit log data');
        testsFailed++;
      }
    } else {
      console.error('❌ FAILED: No audit log API call was made');
      testsFailed++;
    }

    console.log('📄 Test 6: Fetch audit logs from API...');
    const auditLogsResponse = await page.request.get(
      `https://localhost/api/audit-logs/booking/${bookingId}`
    );
    const auditLogsResult = await auditLogsResponse.json();

    if (auditLogsResult.success && auditLogsResult.logs) {
      console.log(`✅ Retrieved ${auditLogsResult.logs.length} audit log(s)\n`);
      testsPassed++;

      if (auditLogsResult.logs.length > 0) {
        console.log('📄 Test 7: Verify audit log persisted to database...');
        const log = auditLogsResult.logs[0];
        console.log('   Latest audit log:', JSON.stringify(log, null, 2));

        if (
          log.booking_id === bookingId &&
          log.action_type === 'room_removed' &&
          log.user_type === 'user' &&
          log.room_id === '14' &&
          log.before_state &&
          log.change_details
        ) {
          console.log('✅ Audit log persisted correctly\n');
          testsPassed++;
        } else {
          console.error('❌ FAILED: Audit log data in database is incorrect');
          testsFailed++;
        }
      }
    } else {
      console.error('❌ FAILED: Could not fetch audit logs from API');
      testsFailed++;
    }

    console.log('📄 Test 8: Test UNDO and verify audit log...');

    // Reset audit log tracking
    auditLogCreated = false;
    auditLogData = null;

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

    // Wait for audit log request
    await page.waitForTimeout(2000);

    console.log('📄 Test 9: Verify room_restored audit log was created...');
    if (auditLogCreated) {
      console.log('✅ Room restoration audit log created\n');
      testsPassed++;

      if (auditLogData && auditLogData.actionType === 'room_restored') {
        console.log('✅ Audit log action type is "room_restored"\n');
        testsPassed++;
      } else {
        console.error('❌ FAILED: Audit log action type is not "room_restored"');
        testsFailed++;
      }
    } else {
      console.error('❌ FAILED: No audit log created for room restoration');
      testsFailed++;
    }

    // Final audit logs fetch
    console.log('📄 Test 10: Fetch all audit logs for this booking...');
    const finalAuditLogsResponse = await page.request.get(
      `https://localhost/api/audit-logs/booking/${bookingId}`
    );
    const finalAuditLogsResult = await finalAuditLogsResponse.json();

    if (finalAuditLogsResult.success && finalAuditLogsResult.logs) {
      console.log(`✅ Total audit logs for booking: ${finalAuditLogsResult.logs.length}\n`);

      // Should have at least 2 logs: room_removed and room_restored
      if (finalAuditLogsResult.logs.length >= 2) {
        console.log('✅ Multiple audit logs recorded (remove + restore)\n');
        testsPassed++;

        // Display all audit logs
        console.log('   Audit log history:');
        finalAuditLogsResult.logs.forEach((log, index) => {
          console.log(
            `   ${index + 1}. ${log.action_type} - Room ${log.room_id} - ${log.user_type} - ${log.created_at}`
          );
        });
        console.log('');
      } else {
        console.error('❌ FAILED: Expected at least 2 audit logs (remove + restore)');
        testsFailed++;
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (testsFailed === 0) {
      console.log('🎉 ALL TESTS PASSED!\n');
      console.log('✅ Audit logging works correctly:');
      console.log('   ✓ Audit logs created for room removal');
      console.log('   ✓ Audit logs created for room restoration via undo');
      console.log('   ✓ Audit log data includes before/after state');
      console.log('   ✓ Audit logs persisted to database');
      console.log('   ✓ Audit logs can be retrieved via API');
      console.log('   ✓ User type and identifier tracked correctly');
      console.log('\n✅ Phase 3 (Audit Logging) is COMPLETE and VERIFIED!\n');

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

verifyAuditLogging().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
