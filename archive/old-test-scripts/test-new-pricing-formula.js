/**
 * Test New Pricing Formula
 * Formula: empty_room + (ALL adults × rate) + (ALL children × rate)
 */

const PriceCalculator = require('./js/shared/priceCalculator');

console.log('\n=== Testing New Pricing Formula ===\n');

// Test settings with new "empty" pricing
const testSettings = {
  rooms: [
    { id: '12', type: 'small', capacity: 3, floor: 1, number: 2 },
    { id: '14', type: 'large', capacity: 4, floor: 1, number: 4 },
  ],
  prices: {
    utia: {
      small: {
        empty: 250,  // Empty room price (no guests)
        adult: 50,   // Adult surcharge
        child: 25,   // Child surcharge
      },
      large: {
        empty: 350,
        adult: 70,
        child: 35,
      },
    },
    external: {
      small: {
        empty: 400,
        adult: 100,
        child: 50,
      },
      large: {
        empty: 500,
        adult: 120,
        child: 60,
      },
    },
  },
};

// Test cases
const testCases = [
  {
    name: 'Small room, ÚTIA, 0 adults, 0 children, 2 toddlers (only empty room)',
    options: {
      rooms: ['12'],
      guestType: 'utia',
      adults: 0,
      children: 0,
      toddlers: 2,
      nights: 2,
      settings: testSettings,
    },
    expected: 500, // 250 × 2 nights = 500
    explanation: 'Only empty room price, no surcharges',
  },
  {
    name: 'Small room, ÚTIA, 1 adult, 0 children, 2 nights',
    options: {
      rooms: ['12'],
      guestType: 'utia',
      adults: 1,
      children: 0,
      toddlers: 0,
      nights: 2,
      settings: testSettings,
    },
    expected: 600, // (250 + 1×50) × 2 = 600
    explanation: 'Empty (250) + 1 adult (50) = 300 per night × 2 nights',
  },
  {
    name: 'Small room, ÚTIA, 2 adults, 1 child, 2 nights',
    options: {
      rooms: ['12'],
      guestType: 'utia',
      adults: 2,
      children: 1,
      toddlers: 0,
      nights: 2,
      settings: testSettings,
    },
    expected: 750, // (250 + 2×50 + 1×25) × 2 = 750
    explanation: 'Empty (250) + 2 adults (100) + 1 child (25) = 375 per night × 2',
  },
  {
    name: 'Large room, ÚTIA, 3 adults, 1 child, 2 nights',
    options: {
      rooms: ['14'],
      guestType: 'utia',
      adults: 3,
      children: 1,
      toddlers: 0,
      nights: 2,
      settings: testSettings,
    },
    expected: 1190, // (350 + 3×70 + 1×35) × 2 = 1190
    explanation: 'Empty (350) + 3 adults (210) + 1 child (35) = 595 per night × 2',
  },
  {
    name: 'Small room, External, 1 adult, 0 children, 2 nights',
    options: {
      rooms: ['12'],
      guestType: 'external',
      adults: 1,
      children: 0,
      toddlers: 0,
      nights: 2,
      settings: testSettings,
    },
    expected: 1000, // (400 + 1×100) × 2 = 1000
    explanation: 'Empty (400) + 1 adult (100) = 500 per night × 2',
  },
  {
    name: 'Large room, External, 4 adults, 2 children, 2 nights',
    options: {
      rooms: ['14'],
      guestType: 'external',
      adults: 4,
      children: 2,
      toddlers: 1,
      nights: 2,
      settings: testSettings,
    },
    expected: 2200, // (500 + 4×120 + 2×60) × 2 = 2200
    explanation: 'Empty (500) + 4 adults (480) + 2 children (120) = 1100 per night × 2',
  },
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  console.log(`\nTest: ${test.name}`);
  console.log(`Expected: ${test.expected} Kč (${test.explanation})`);

  try {
    const result = PriceCalculator.calculatePriceFromRooms(test.options);
    console.log(`Actual: ${result} Kč`);

    if (result === test.expected) {
      console.log('✅ PASS');
      passed++;
    } else {
      console.log(`❌ FAIL (difference: ${result - test.expected} Kč)`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    failed++;
  }
}

console.log('\n=== Test Summary ===');
console.log(`Total: ${testCases.length}`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);

if (failed === 0) {
  console.log('\n✅ All tests passed!\n');
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} test(s) failed\n`);
  process.exit(1);
}
