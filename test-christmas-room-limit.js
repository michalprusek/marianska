/**
 * Test suite for Christmas room limit validation (NEW 2025-10-16)
 *
 * Tests the official ÚTIA rules:
 * - Before Oct 1: ÚTIA employees can book max 2 rooms (1 room always OK, 2 rooms with warning, 3+ blocked)
 * - After Oct 1: No room limits for anyone
 * - External guests: No room limits at any time
 */

const ChristmasUtils = require('./js/shared/christmasUtils.js');

// Test scenarios
const scenarios = [
  {
    name: '1️⃣ ÚTIA employee, 1 room, before Oct 1',
    bookingData: {
      rooms: ['12'],
      guestType: 'utia',
    },
    currentDate: new Date('2025-09-15'),
    christmasStart: '2025-12-23',
    expected: {
      valid: true,
      warning: null,
      error: null,
    },
  },
  {
    name: '2️⃣ ÚTIA employee, 2 rooms, before Oct 1',
    bookingData: {
      rooms: ['12', '13'],
      guestType: 'utia',
    },
    currentDate: new Date('2025-09-15'),
    christmasStart: '2025-12-23',
    expected: {
      valid: true,
      warning:
        'Pamatujte: Dva pokoje lze rezervovat pouze pokud budou oba plně obsazeny příslušníky Vaší rodiny',
      error: null,
    },
  },
  {
    name: '3️⃣ ÚTIA employee, 3 rooms, before Oct 1',
    bookingData: {
      rooms: ['12', '13', '14'],
      guestType: 'utia',
    },
    currentDate: new Date('2025-09-15'),
    christmasStart: '2025-12-23',
    expected: {
      valid: false,
      warning: null,
      error: 'Zaměstnanci ÚTIA mohou do 30. září rezervovat maximálně 2 pokoje',
    },
  },
  {
    name: '4️⃣ ÚTIA employee, 5 rooms, before Oct 1',
    bookingData: {
      rooms: ['12', '13', '14', '22', '23'],
      guestType: 'utia',
    },
    currentDate: new Date('2025-09-15'),
    christmasStart: '2025-12-23',
    expected: {
      valid: false,
      warning: null,
      error: 'Zaměstnanci ÚTIA mohou do 30. září rezervovat maximálně 2 pokoje',
    },
  },
  {
    name: '5️⃣ ÚTIA employee, 1 room, after Oct 1',
    bookingData: {
      rooms: ['12'],
      guestType: 'utia',
    },
    currentDate: new Date('2025-10-05'),
    christmasStart: '2025-12-23',
    expected: {
      valid: true,
      warning: null,
      error: null,
    },
  },
  {
    name: '6️⃣ ÚTIA employee, 5 rooms, after Oct 1',
    bookingData: {
      rooms: ['12', '13', '14', '22', '23'],
      guestType: 'utia',
    },
    currentDate: new Date('2025-10-05'),
    christmasStart: '2025-12-23',
    expected: {
      valid: true,
      warning: null,
      error: null,
    },
  },
  {
    name: '7️⃣ External guest, 5 rooms, before Oct 1',
    bookingData: {
      rooms: ['12', '13', '14', '22', '23'],
      guestType: 'external',
    },
    currentDate: new Date('2025-09-15'),
    christmasStart: '2025-12-23',
    expected: {
      valid: true,
      warning: null,
      error: null,
    },
  },
  {
    name: '8️⃣ External guest, 2 rooms, before Oct 1',
    bookingData: {
      rooms: ['12', '13'],
      guestType: 'external',
    },
    currentDate: new Date('2025-09-15'),
    christmasStart: '2025-12-23',
    expected: {
      valid: true,
      warning: null,
      error: null,
    },
  },
  {
    name: '9️⃣ EDGE: Exactly Sept 30 23:59 (last moment before Oct 1)',
    bookingData: {
      rooms: ['12', '13', '14'],
      guestType: 'utia',
    },
    currentDate: new Date('2025-09-30T23:59:59'),
    christmasStart: '2025-12-23',
    expected: {
      valid: false,
      warning: null,
      error: 'Zaměstnanci ÚTIA mohou do 30. září rezervovat maximálně 2 pokoje',
    },
  },
  {
    name: '🔟 EDGE: Exactly Oct 1 00:00 (first moment after Oct 1)',
    bookingData: {
      rooms: ['12', '13', '14'],
      guestType: 'utia',
    },
    currentDate: new Date('2025-10-01T00:00:00'),
    christmasStart: '2025-12-23',
    expected: {
      valid: true,
      warning: null,
      error: null,
    },
  },
  {
    name: '1️⃣1️⃣ ÚTIA employee, 0 rooms (validation error)',
    bookingData: {
      rooms: [],
      guestType: 'utia',
    },
    currentDate: new Date('2025-09-15'),
    christmasStart: '2025-12-23',
    expected: {
      valid: false,
      warning: null,
      error: 'Musíte vybrat alespoň jeden pokoj',
    },
  },
  {
    name: '1️⃣2️⃣ Christmas period in following year, before Oct 1 of Christmas year',
    bookingData: {
      rooms: ['12', '13', '14'],
      guestType: 'utia',
    },
    currentDate: new Date('2025-09-15'),
    christmasStart: '2026-01-04', // Christmas in 2026
    expected: {
      valid: false,
      warning: null,
      error: 'Zaměstnanci ÚTIA mohou do 30. září rezervovat maximálně 2 pokoje',
    },
  },
  {
    name: '1️⃣3️⃣ Christmas period in following year, after Oct 1 of Christmas year',
    bookingData: {
      rooms: ['12', '13', '14'],
      guestType: 'utia',
    },
    currentDate: new Date('2026-10-05'),
    christmasStart: '2026-01-04', // Christmas in 2026, but we're past Oct 1 2026
    expected: {
      valid: true,
      warning: null,
      error: null,
    },
  },
  {
    name: '1️⃣4️⃣ No Christmas period set (null)',
    bookingData: {
      rooms: ['12', '13', '14'],
      guestType: 'utia',
    },
    currentDate: new Date('2025-09-15'),
    christmasStart: null,
    expected: {
      valid: true,
      warning: null,
      error: null,
    },
  },
  {
    name: '1️⃣5️⃣ ÚTIA employee, 2 rooms, on exact Oct 1 (should allow unlimited)',
    bookingData: {
      rooms: ['12', '13'],
      guestType: 'utia',
    },
    currentDate: new Date('2025-10-01T00:00:01'),
    christmasStart: '2025-12-23',
    expected: {
      valid: true,
      warning: null, // No warning after Oct 1
      error: null,
    },
  },
];

// Run tests
console.log('\n🧪 Running Christmas Room Limit Validation Tests\n');
console.log('='.repeat(80));

let passedTests = 0;
let failedTests = 0;

scenarios.forEach((scenario, index) => {
  const result = ChristmasUtils.validateChristmasRoomLimit(
    scenario.bookingData,
    scenario.currentDate,
    scenario.christmasStart
  );

  // Check if result matches expected
  const validMatch = result.valid === scenario.expected.valid;
  const warningMatch = scenario.expected.warning
    ? result.warning && result.warning.includes(scenario.expected.warning.substring(0, 30))
    : !result.warning;
  const errorMatch = scenario.expected.error
    ? result.error && result.error.includes(scenario.expected.error.substring(0, 30))
    : !result.error;

  const passed = validMatch && warningMatch && errorMatch;

  if (passed) {
    passedTests += 1;
    console.log(`\n✅ Test ${index + 1} PASSED: ${scenario.name}`);
  } else {
    failedTests += 1;
    console.log(`\n❌ Test ${index + 1} FAILED: ${scenario.name}`);
    console.log('Expected:', JSON.stringify(scenario.expected, null, 2));
    console.log('Got:     ', JSON.stringify(result, null, 2));
  }

  // Log details for verbose output
  console.log(`   📅 Date: ${scenario.currentDate.toISOString().split('T')[0]}`);
  console.log(`   🎄 Christmas: ${scenario.christmasStart || 'N/A'}`);
  console.log(`   👥 Guest: ${scenario.bookingData.guestType}`);
  console.log(`   🏠 Rooms: ${scenario.bookingData.rooms.length}`);
  if (result.warning) {
    console.log(`   ⚠️  Warning: ${result.warning.substring(0, 60)}...`);
  }
  if (result.error) {
    console.log(`   ❌ Error: ${result.error.substring(0, 60)}...`);
  }
});

console.log(`\n${'='.repeat(80)}`);
console.log(
  `\n📊 Test Results: ${passedTests} passed, ${failedTests} failed out of ${scenarios.length} total`
);

if (failedTests === 0) {
  console.log('\n🎉 All tests passed! ✅\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failedTests} test(s) failed. Please review the implementation.\n`);
  process.exit(1);
}
