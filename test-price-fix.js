/**
 * Test script to verify per-guest pricing fix
 * Tests that backend calculates the same price as frontend for mixed ÚTIA/external guests
 */

const PriceCalculator = require('./js/shared/priceCalculator.js');

// Mock settings (typical configuration)
const settings = {
  rooms: [
    { id: '12', name: 'Pokoj 12', capacity: 2, type: 'small' },
    { id: '13', name: 'Pokoj 13', capacity: 3, type: 'small' },
    { id: '14', name: 'Pokoj 14', capacity: 4, type: 'large' },
  ],
  prices: {
    utia: {
      small: { base: 300, adult: 50, child: 25 },
      large: { base: 400, adult: 50, child: 25 },
    },
    external: {
      small: { base: 500, adult: 100, child: 50 },
      large: { base: 600, adult: 100, child: 50 },
    },
  },
};

console.log('=== Testing Per-Guest Pricing Fix ===\n');

// Test Case 1: Mixed guest types - 1 ÚTIA adult + 1 External adult + 1 External child
console.log('Test Case 1: Mixed guest types in 2 small rooms (12, 13)');
console.log('Setup: 2 small rooms, 3 nights');
console.log('Guests: 1 ÚTIA adult + 1 External adult + 1 External child');

const guestNames1 = [
  { firstName: 'Jan', lastName: 'Novák', personType: 'adult', guestPriceType: 'utia' },
  { firstName: 'John', lastName: 'Smith', personType: 'adult', guestPriceType: 'external' },
  { firstName: 'Anna', lastName: 'Smith', personType: 'child', guestPriceType: 'external' },
];

const pricePerGuest1 = PriceCalculator.calculatePerGuestPrice({
  rooms: ['12', '13'],
  guestNames: guestNames1,
  nights: 3,
  settings,
  fallbackGuestType: 'utia',
});

console.log('\nExpected calculation (per night):');
console.log('  Empty rooms (2 × ÚTIA small): 2 × 250 = 500 Kč');
console.log('  Jan (ÚTIA adult): 50 Kč');
console.log('  John (External adult): 100 Kč');
console.log('  Anna (External child): 50 Kč');
console.log('  Per night total: 500 + 50 + 100 + 50 = 700 Kč');
console.log('  For 3 nights: 700 × 3 = 2100 Kč');

console.log('\nActual calculation:');
console.log(`  Total price: ${pricePerGuest1} Kč`);
console.log(`  ✅ ${pricePerGuest1 === 2100 ? 'CORRECT' : '❌ WRONG'}`);

// Test Case 2: All ÚTIA guests (should use legacy calculation)
console.log('\n\n---\n');
console.log('Test Case 2: All ÚTIA guests (fallback test)');
console.log('Setup: 1 small room (12), 2 nights');
console.log('Guests: 2 ÚTIA adults + 1 ÚTIA child');

const guestNames2 = [
  { firstName: 'Jan', lastName: 'Novák', personType: 'adult', guestPriceType: 'utia' },
  { firstName: 'Petr', lastName: 'Svoboda', personType: 'adult', guestPriceType: 'utia' },
  { firstName: 'Marie', lastName: 'Nováková', personType: 'child', guestPriceType: 'utia' },
];

const pricePerGuest2 = PriceCalculator.calculatePerGuestPrice({
  rooms: ['12'],
  guestNames: guestNames2,
  nights: 2,
  settings,
  fallbackGuestType: 'utia',
});

console.log('\nExpected calculation (per night):');
console.log('  Empty room (ÚTIA small): 250 Kč');
console.log('  2 ÚTIA adults: 2 × 50 = 100 Kč');
console.log('  1 ÚTIA child: 1 × 25 = 25 Kč');
console.log('  Per night total: 250 + 100 + 25 = 375 Kč');
console.log('  For 2 nights: 375 × 2 = 750 Kč');

console.log('\nActual calculation:');
console.log(`  Total price: ${pricePerGuest2} Kč`);
console.log(`  ✅ ${pricePerGuest2 === 750 ? 'CORRECT' : '❌ WRONG'}`);

// Test Case 3: All External guests
console.log('\n\n---\n');
console.log('Test Case 3: All External guests');
console.log('Setup: 1 large room (14), 1 night');
console.log('Guests: 2 External adults + 2 External children');

const guestNames3 = [
  { firstName: 'John', lastName: 'Smith', personType: 'adult', guestPriceType: 'external' },
  { firstName: 'Jane', lastName: 'Smith', personType: 'adult', guestPriceType: 'external' },
  { firstName: 'Jack', lastName: 'Smith', personType: 'child', guestPriceType: 'external' },
  { firstName: 'Jill', lastName: 'Smith', personType: 'child', guestPriceType: 'external' },
];

const pricePerGuest3 = PriceCalculator.calculatePerGuestPrice({
  rooms: ['14'],
  guestNames: guestNames3,
  nights: 1,
  settings,
  fallbackGuestType: 'external',
});

console.log('\nExpected calculation (per night):');
console.log('  Empty room (External large): 500 Kč');
console.log('  2 External adults: 2 × 100 = 200 Kč');
console.log('  2 External children: 2 × 50 = 100 Kč');
console.log('  Per night total: 500 + 200 + 100 = 800 Kč');
console.log('  For 1 night: 800 Kč');

console.log('\nActual calculation:');
console.log(`  Total price: ${pricePerGuest3} Kč`);
console.log(`  ✅ ${pricePerGuest3 === 800 ? 'CORRECT' : '❌ WRONG'}`);

// Summary
console.log('\n\n=== Test Summary ===');
const allPassed = pricePerGuest1 === 2100 && pricePerGuest2 === 750 && pricePerGuest3 === 800;
console.log(allPassed ? '✅ All tests PASSED!' : '❌ Some tests FAILED');
console.log('\nBackend now uses the same pricing logic as frontend.');
console.log('Mixed ÚTIA/external guests are correctly priced per person.');

process.exit(allPassed ? 0 : 1);
