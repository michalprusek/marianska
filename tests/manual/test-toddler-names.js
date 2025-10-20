/**
 * Comprehensive Test Suite for Toddler Name Collection Feature
 *
 * Tests all aspects of toddler name collection in booking and edit flows
 */

const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'test-toddler@utia.cas.cz';

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m',
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * Make HTTP request
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode, headers: res.headers, body: jsonBody });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Test helper: Assert condition
 */
function assert(condition, message) {
  if (condition) {
    console.log(`${colors.green}✓${colors.reset} ${message}`);
    results.passed++;
    results.tests.push({ name: message, passed: true });
    return true;
  } else {
    console.log(`${colors.red}✗${colors.reset} ${message}`);
    results.failed++;
    results.tests.push({ name: message, passed: false });
    return false;
  }
}

/**
 * Test helper: Log section
 */
function logSection(title) {
  console.log(`\n${colors.blue}━━━ ${title} ━━━${colors.reset}\n`);
}

/**
 * Generate test booking data with toddlers
 */
function generateBookingWithToddlers(toddlerCount = 2) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 10);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 3);

  const guestNames = [
    { personType: 'adult', firstName: 'Jan', lastName: 'Novák' },
    { personType: 'adult', firstName: 'Marie', lastName: 'Nováková' },
  ];

  // Add toddler names
  for (let i = 1; i <= toddlerCount; i++) {
    guestNames.push({
      personType: 'toddler',
      firstName: `Toddler${i}`,
      lastName: `Test${i}`,
    });
  }

  return {
    name: 'Jan Novák',
    email: TEST_EMAIL,
    phone: '+420123456789',
    address: 'Test 123',
    city: 'Praha',
    zip: '12345',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    rooms: ['12'],
    guestType: 'utia',
    adults: 2,
    children: 0,
    toddlers: toddlerCount,
    notes: 'Test booking with toddlers',
    guestNames,
  };
}

/**
 * Test 1: Create booking with toddlers
 */
async function testCreateBookingWithToddlers() {
  logSection('Test 1: Create Booking with Toddlers');

  const bookingData = generateBookingWithToddlers(2);

  const response = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/booking',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    bookingData
  );

  assert(response.statusCode === 200, 'Booking created successfully (status 200)');
  assert(response.body.id, 'Booking has ID');
  assert(response.body.id.startsWith('BK'), 'Booking ID has correct format');
  assert(response.body.guestNames, 'Booking has guestNames array');
  assert(
    response.body.guestNames.length === 4,
    `Booking has correct number of guest names (expected 4, got ${response.body.guestNames.length})`
  );

  const toddlerNames = response.body.guestNames.filter((g) => g.personType === 'toddler');
  assert(
    toddlerNames.length === 2,
    `Booking has correct number of toddler names (expected 2, got ${toddlerNames.length})`
  );
  assert(toddlerNames[0].firstName === 'Toddler1', 'First toddler name is correct');
  assert(toddlerNames[1].firstName === 'Toddler2', 'Second toddler name is correct');

  return response.body;
}

/**
 * Test 2: Validate toddler names are required
 */
async function testToddlerNamesRequired() {
  logSection('Test 2: Toddler Names Required Validation');

  const bookingData = generateBookingWithToddlers(1);
  // Remove toddler names (keep only adult names)
  bookingData.guestNames = bookingData.guestNames.filter((g) => g.personType === 'adult');

  const response = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/booking',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    bookingData
  );

  assert(
    response.statusCode === 400,
    'Server rejects booking with missing toddler names (status 400)'
  );
  assert(response.body.error, 'Error message is provided');
  console.log(`  Error message: "${response.body.error}"`);
}

/**
 * Test 3: Validate toddler name count mismatch
 */
async function testToddlerCountMismatch() {
  logSection('Test 3: Toddler Count Mismatch Validation');

  const bookingData = generateBookingWithToddlers(2);
  // Remove one toddler name (3 total instead of 4)
  bookingData.guestNames = bookingData.guestNames.slice(0, 3);

  const response = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/booking',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    bookingData
  );

  assert(
    response.statusCode === 400,
    'Server rejects booking with incorrect toddler name count (status 400)'
  );
  assert(response.body.error, 'Error message is provided');
  console.log(`  Error message: "${response.body.error}"`);
}

/**
 * Test 4: Validate toddler name length
 */
async function testToddlerNameLength() {
  logSection('Test 4: Toddler Name Length Validation');

  const bookingData = generateBookingWithToddlers(1);
  // Set too short name
  bookingData.guestNames[2].firstName = 'A';

  const response = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/booking',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    bookingData
  );

  assert(
    response.statusCode === 400,
    'Server rejects booking with too short toddler name (status 400)'
  );
  assert(response.body.error, 'Error message is provided');
  console.log(`  Error message: "${response.body.error}"`);
}

/**
 * Test 5: Edit booking with toddlers
 */
async function testEditBookingWithToddlers(createdBooking) {
  logSection('Test 5: Edit Booking with Toddlers');

  if (!createdBooking || !createdBooking.editToken) {
    console.log(`${colors.yellow}⚠ Skipping edit test - no booking created${colors.reset}`);
    return;
  }

  // Modify toddler names
  const updatedGuestNames = [...createdBooking.guestNames];
  const toddlerIndex = updatedGuestNames.findIndex((g) => g.personType === 'toddler');
  if (toddlerIndex !== -1) {
    updatedGuestNames[toddlerIndex].firstName = 'UpdatedToddler';
    updatedGuestNames[toddlerIndex].lastName = 'UpdatedTest';
  }

  const updateData = {
    name: createdBooking.name,
    email: createdBooking.email,
    phone: createdBooking.phone,
    address: createdBooking.address,
    city: createdBooking.city,
    zip: createdBooking.zip,
    startDate: createdBooking.startDate,
    endDate: createdBooking.endDate,
    rooms: createdBooking.rooms,
    guestType: createdBooking.guestType,
    adults: createdBooking.adults,
    children: createdBooking.children,
    toddlers: createdBooking.toddlers,
    guestNames: updatedGuestNames,
    notes: createdBooking.notes,
  };

  const response = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: `/api/booking/${createdBooking.id}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Edit-Token': createdBooking.editToken,
      },
    },
    updateData
  );

  assert(response.statusCode === 200, 'Booking updated successfully (status 200)');
  assert(response.body.guestNames, 'Updated booking has guestNames array');

  const updatedToddler = response.body.guestNames.find((g) => g.personType === 'toddler');
  assert(updatedToddler, 'Updated booking has toddler name');
  assert(
    updatedToddler.firstName === 'UpdatedToddler',
    'Toddler name was updated correctly'
  );
}

/**
 * Test 6: Multi-toddler scenario
 */
async function testMultipleToddlers() {
  logSection('Test 6: Multiple Toddlers (5 toddlers)');

  const bookingData = generateBookingWithToddlers(5);

  const response = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/booking',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    bookingData
  );

  assert(response.statusCode === 200, 'Booking with 5 toddlers created successfully');
  assert(response.body.guestNames, 'Booking has guestNames array');

  const toddlerNames = response.body.guestNames.filter((g) => g.personType === 'toddler');
  assert(
    toddlerNames.length === 5,
    `Booking has correct number of toddler names (expected 5, got ${toddlerNames.length})`
  );
}

/**
 * Test 7: Zero toddlers (backward compatibility)
 */
async function testZeroToddlers() {
  logSection('Test 7: Zero Toddlers (Backward Compatibility)');

  const bookingData = generateBookingWithToddlers(0);
  bookingData.guestNames = bookingData.guestNames.filter((g) => g.personType !== 'toddler');

  const response = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/booking',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    bookingData
  );

  assert(response.statusCode === 200, 'Booking without toddlers created successfully');
  assert(response.body.guestNames, 'Booking has guestNames array');

  const toddlerNames = response.body.guestNames.filter((g) => g.personType === 'toddler');
  assert(toddlerNames.length === 0, 'Booking has no toddler names (as expected)');
}

/**
 * Test 8: Mixed guest types
 */
async function testMixedGuestTypes() {
  logSection('Test 8: Mixed Guest Types (Adults + Children + Toddlers)');

  const bookingData = generateBookingWithToddlers(2);
  bookingData.children = 2;
  bookingData.guestNames.push(
    { personType: 'child', firstName: 'Child1', lastName: 'Test1' },
    { personType: 'child', firstName: 'Child2', lastName: 'Test2' }
  );

  const response = await makeRequest(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/booking',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    bookingData
  );

  assert(response.statusCode === 200, 'Mixed guest types booking created successfully');
  assert(response.body.guestNames, 'Booking has guestNames array');
  assert(
    response.body.guestNames.length === 6,
    `Booking has all guest names (expected 6, got ${response.body.guestNames.length})`
  );

  const adultNames = response.body.guestNames.filter((g) => g.personType === 'adult');
  const childNames = response.body.guestNames.filter((g) => g.personType === 'child');
  const toddlerNames = response.body.guestNames.filter((g) => g.personType === 'toddler');

  assert(adultNames.length === 2, 'Correct number of adult names (2)');
  assert(childNames.length === 2, 'Correct number of child names (2)');
  assert(toddlerNames.length === 2, 'Correct number of toddler names (2)');
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(`\n${colors.blue}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  Toddler Name Collection - Comprehensive Test Suite           ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  try {
    // Test 1: Basic creation
    const createdBooking = await testCreateBookingWithToddlers();

    // Test 2: Validation - missing names
    await testToddlerNamesRequired();

    // Test 3: Validation - count mismatch
    await testToddlerCountMismatch();

    // Test 4: Validation - name length
    await testToddlerNameLength();

    // Test 5: Edit flow
    await testEditBookingWithToddlers(createdBooking);

    // Test 6: Multiple toddlers
    await testMultipleToddlers();

    // Test 7: Zero toddlers (backward compatibility)
    await testZeroToddlers();

    // Test 8: Mixed guest types
    await testMixedGuestTypes();

    // Summary
    logSection('Test Summary');
    console.log(`Total Tests: ${results.passed + results.failed}`);
    console.log(`${colors.green}✓ Passed: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}✗ Failed: ${results.failed}${colors.reset}`);

    if (results.failed === 0) {
      console.log(`\n${colors.green}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
      console.log(`${colors.green}║  ✓ ALL TESTS PASSED - Implementation is working correctly!    ║${colors.reset}`);
      console.log(`${colors.green}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);
    } else {
      console.log(`\n${colors.red}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
      console.log(`${colors.red}║  ✗ SOME TESTS FAILED - Review the failures above              ║${colors.reset}`);
      console.log(`${colors.red}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);
    }

    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error(`\n${colors.red}Fatal Error:${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
