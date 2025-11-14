/**
 * Test Audit Logging API
 * Simpler test that directly tests the API endpoints without browser automation
 */

async function testAuditAPI() {
  console.log('🧪 Testing Audit Logging API...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Create a test booking
  console.log('📄 Test 1: Creating a test booking...');
  try {
    const bookingResponse = await fetch('https://localhost/api/booking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'API Test User',
        email: 'api-test@example.com',
        phone: '+420777888999',
        address: 'Test Street 123',
        city: 'Praha',
        zip: '12000',
        startDate: '2027-06-15',
        endDate: '2027-06-20',
        rooms: ['12', '13'],
        guestType: 'utia',
        adults: 2,
        children: 0,
        totalPrice: 3000,
        perRoomGuests: [
          { roomId: '12', guestType: 'utia', adults: 1, children: 0, toddlers: 0 },
          { roomId: '13', guestType: 'utia', adults: 1, children: 0, toddlers: 0 },
        ],
        guestNames: [
          { firstName: 'Test', lastName: 'User1', personType: 'adult' },
          { firstName: 'Test', lastName: 'User2', personType: 'adult' },
        ],
      }),
    });

    const bookingResult = await bookingResponse.json();
    if (!bookingResult.success) {
      throw new Error(bookingResult.error || 'Failed to create booking');
    }

    const bookingId = bookingResult.booking.id;
    console.log(`✅ Test booking created: ${bookingId}\n`);
    testsPassed++;

    // Test 2: Create audit log for room removal
    console.log('📄 Test 2: Creating audit log for room_removed...');
    const auditData = {
      bookingId: bookingId,
      actionType: 'room_removed',
      userType: 'user',
      userIdentifier: 'test1234',
      roomId: '13',
      beforeState: {
        roomData: { roomId: '13', guestType: 'utia', adults: 1, children: 0 },
        roomDates: { startDate: '2027-06-15', endDate: '2027-06-20' },
      },
      afterState: null,
      changeDetails: 'Room 13 removed from booking',
    };

    const auditResponse = await fetch('https://localhost/api/audit-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(auditData),
    });

    const auditResult = await auditResponse.json();
    if (!auditResult.success) {
      throw new Error('Failed to create audit log');
    }

    console.log(`✅ Audit log created: ${auditResult.logId}\n`);
    testsPassed++;

    // Test 3: Create audit log for room restoration
    console.log('📄 Test 3: Creating audit log for room_restored...');
    const restoreAuditData = {
      bookingId: bookingId,
      actionType: 'room_restored',
      userType: 'user',
      userIdentifier: 'test1234',
      roomId: '13',
      beforeState: null,
      afterState: {
        roomData: { roomId: '13', guestType: 'utia', adults: 1, children: 0 },
        roomDates: { startDate: '2027-06-15', endDate: '2027-06-20' },
      },
      changeDetails: 'Room 13 restored via undo',
    };

    const restoreAuditResponse = await fetch('https://localhost/api/audit-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(restoreAuditData),
    });

    const restoreAuditResult = await restoreAuditResponse.json();
    if (!restoreAuditResult.success) {
      throw new Error('Failed to create restore audit log');
    }

    console.log(`✅ Restore audit log created: ${restoreAuditResult.logId}\n`);
    testsPassed++;

    // Test 4: Retrieve audit logs for booking
    console.log('📄 Test 4: Retrieving audit logs for booking...');
    const logsResponse = await fetch(`https://localhost/api/audit-logs/booking/${bookingId}`);
    const logsResult = await logsResponse.json();

    if (!logsResult.success || !Array.isArray(logsResult.logs)) {
      throw new Error('Failed to retrieve audit logs');
    }

    console.log(`✅ Retrieved ${logsResult.logs.length} audit log(s)\n`);
    testsPassed++;

    // Test 5: Verify audit log data
    console.log('📄 Test 5: Verifying audit log data...');
    const logs = logsResult.logs;

    if (logs.length < 2) {
      throw new Error(`Expected at least 2 logs, got ${logs.length}`);
    }

    // Find room_removed log
    const removedLog = logs.find((log) => log.action_type === 'room_removed');
    if (!removedLog) {
      throw new Error('room_removed log not found');
    }

    // Verify removed log data
    if (
      removedLog.booking_id !== bookingId ||
      removedLog.room_id !== '13' ||
      removedLog.user_type !== 'user'
    ) {
      throw new Error('room_removed log data is incorrect');
    }

    console.log('✅ room_removed log verified');
    console.log(`   - booking_id: ${removedLog.booking_id}`);
    console.log(`   - action_type: ${removedLog.action_type}`);
    console.log(`   - room_id: ${removedLog.room_id}`);
    console.log(`   - user_type: ${removedLog.user_type}\n`);
    testsPassed++;

    // Find room_restored log
    const restoredLog = logs.find((log) => log.action_type === 'room_restored');
    if (!restoredLog) {
      throw new Error('room_restored log not found');
    }

    // Verify restored log data
    if (
      restoredLog.booking_id !== bookingId ||
      restoredLog.room_id !== '13' ||
      restoredLog.user_type !== 'user'
    ) {
      throw new Error('room_restored log data is incorrect');
    }

    console.log('✅ room_restored log verified');
    console.log(`   - booking_id: ${restoredLog.booking_id}`);
    console.log(`   - action_type: ${restoredLog.action_type}`);
    console.log(`   - room_id: ${restoredLog.room_id}`);
    console.log(`   - user_type: ${restoredLog.user_type}\n`);
    testsPassed++;

    // Test 6: Verify before/after state
    console.log('📄 Test 6: Verifying before/after state data...');
    if (!removedLog.beforeState || removedLog.afterState !== null) {
      throw new Error('room_removed state data is incorrect');
    }

    if (restoredLog.beforeState !== null || !restoredLog.afterState) {
      throw new Error('room_restored state data is incorrect');
    }

    console.log('✅ Before/after state data verified\n');
    testsPassed++;

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (testsFailed === 0) {
      console.log('🎉 ALL TESTS PASSED!\n');
      console.log('✅ Audit logging API is working correctly:');
      console.log('   ✓ Can create audit logs via POST /api/audit-log');
      console.log('   ✓ Can retrieve audit logs via GET /api/audit-logs/booking/:id');
      console.log('   ✓ Audit log data structure is correct');
      console.log('   ✓ Before/after state serialization works');
      console.log('   ✓ room_removed and room_restored actions logged');
      console.log('\n✅ Phase 3 (Audit Logging) API VERIFICATION COMPLETE!\n');
      process.exit(0);
    } else {
      console.log('⚠️  SOME TESTS FAILED - Please review errors above\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error during testing:');
    console.error(error.message || error);
    console.log('\n⚠️  VERIFICATION FAILED\n');
    process.exit(1);
  }
}

// Run tests
testAuditAPI().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
