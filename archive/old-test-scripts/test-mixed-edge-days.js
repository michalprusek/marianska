/**
 * Test script for mixed edge days functionality
 * Tests the scenario where one night is from a proposed booking and another from a confirmed booking
 */

const DatabaseManager = require('./database.js');
const IdGenerator = require('./js/shared/idGenerator.js');
const path = require('path');

async function testMixedEdgeDays() {
  console.log('=== Testing Mixed Edge Days Functionality ===\n');

  // Initialize database
  const dbPath = path.join(__dirname, 'data', 'bookings.db');
  const db = new DatabaseManager(dbPath);

  try {
    // Test scenario:
    // - Proposed booking: Room 12, 2025-10-25 to 2025-10-27 (nights: 25-26, 26-27)
    // - Confirmed booking: Room 12, 2025-10-27 to 2025-10-29 (nights: 27-28, 28-29)
    // - Expected mixed edge day: 2025-10-27 (night before from proposed, night after from confirmed)

    const testRoomId = '12';
    const sessionId = `TEST_SESSION_${Date.now()}`;

    console.log('Step 1: Creating proposed booking (25-27.10.2025)...');
    const proposalId = db.createProposedBooking(
      sessionId,
      '2025-10-25',
      '2025-10-27',
      [testRoomId],
      { adults: 1, children: 0, toddlers: 0 },
      'utia',
      1000
    );
    console.log(`✓ Proposed booking created: ${proposalId}\n`);

    console.log('Step 2: Creating confirmed booking (27-29.10.2025)...');
    const now = new Date().toISOString();
    const bookingId = db.createBooking({
      id: IdGenerator.generateBookingId(),
      name: 'Test User',
      email: 'test@example.com',
      phone: '+420123456789',
      startDate: '2025-10-27',
      endDate: '2025-10-29',
      rooms: [testRoomId],
      adults: 1,
      children: 0,
      toddlers: 0,
      guestType: 'utia',
      totalPrice: 1000,
      company: '',
      ico: '',
      dic: '',
      address: '',
      city: '',
      zip: '',
      notes: 'Test booking',
      guestNames: [
        { personType: 'adult', firstName: 'Test', lastName: 'User', roomId: testRoomId },
      ],
      editToken: IdGenerator.generateEditToken(),
      createdAt: now,
      updatedAt: now,
    });
    console.log(`✓ Confirmed booking created: ${bookingId}\n`);

    console.log('Step 3: Checking availability for edge day 2025-10-27...');
    const availability = db.getRoomAvailability(testRoomId, '2025-10-27', sessionId);

    console.log('Availability result:');
    console.log(JSON.stringify(availability, null, 2));
    console.log('');

    // Verify mixed edge day
    console.log('Step 4: Verifying mixed edge day detection...');

    if (availability.status === 'edge') {
      console.log('✓ Status is "edge" (correct)');
    } else {
      console.log(`✗ Status is "${availability.status}" (expected "edge")`);
    }

    if (availability.nightBefore && availability.nightAfter) {
      console.log('✓ Both nights occupied (correct for mixed edge)');
    } else {
      console.log(
        `✗ Night before: ${availability.nightBefore}, Night after: ${availability.nightAfter}`
      );
    }

    if (availability.nightBeforeType === 'proposed') {
      console.log('✓ Night before is "proposed" (correct)');
    } else {
      console.log(`✗ Night before type is "${availability.nightBeforeType}" (expected "proposed")`);
    }

    if (availability.nightAfterType === 'confirmed') {
      console.log('✓ Night after is "confirmed" (correct)');
    } else {
      console.log(`✗ Night after type is "${availability.nightAfterType}" (expected "confirmed")`);
    }

    if (availability.isMixed === true) {
      console.log('✓ isMixed flag is true (correct)');
    } else {
      console.log(`✗ isMixed flag is ${availability.isMixed} (expected true)`);
    }

    console.log('\n=== Test Summary ===');
    const allCorrect =
      availability.status === 'edge' &&
      availability.nightBefore === true &&
      availability.nightAfter === true &&
      availability.nightBeforeType === 'proposed' &&
      availability.nightAfterType === 'confirmed' &&
      availability.isMixed === true;

    if (allCorrect) {
      console.log('✅ ALL TESTS PASSED - Mixed edge day logic is working correctly!');
    } else {
      console.log('❌ SOME TESTS FAILED - Check the output above');
    }

    // Cleanup
    console.log('\nStep 5: Cleaning up test data...');
    db.deleteProposedBooking(proposalId);
    db.deleteBooking(bookingId);
    console.log('✓ Test data cleaned up\n');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testMixedEdgeDays().catch(console.error);
