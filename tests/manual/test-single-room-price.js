/**
 * Test single room booking price calculation
 * 
 * Reproduces the bug where single room booking shows incorrect price
 * Expected: 600 Kč (250 × 2 + 50 × 1 × 2)
 * Actual: 900 Kč (BUG)
 */

const PriceCalculator = require('../../js/shared/priceCalculator.js');

// Mock settings with current pricing (2025-11-06)
const settings = {
  rooms: [
    { id: '12', name: 'Pokoj 12', beds: 3, type: 'small' },
    { id: '13', name: 'Pokoj 13', beds: 3, type: 'small' },
    { id: '14', name: 'Pokoj 14', beds: 4, type: 'large' },
  ],
  prices: {
    utia: {
      small: {
        base: 250,  // Empty room price
        adult: 50,  // Per adult surcharge
        child: 25,  // Per child surcharge
      },
      large: {
        base: 350,
        adult: 70,
        child: 35,
      },
    },
    external: {
      small: {
        base: 400,
        adult: 100,
        child: 50,
      },
      large: {
        base: 500,
        adult: 120,
        child: 60,
      },
    },
  },
};

console.log('=== Test Single Room Price Calculation ===\n');

// Test case: Small room, ÚTIA, 1 adult, 2 nights
console.log('Test Case: Small room (P12), ÚTIA, 1 adult, 2 nights');
console.log('Expected: 600 Kč (250 × 2 + 50 × 1 × 2)\n');

const guestNames = [
  {
    personType: 'adult',
    firstName: 'Jan',
    lastName: 'Novák',
    guestPriceType: 'utia',
  },
];

const perRoomGuests = {
  '12': {
    adults: 1,
    children: 0,
    toddlers: 0,
    guestType: 'utia',
  },
};

try {
  const price = PriceCalculator.calculatePerGuestPrice({
    rooms: ['12'],
    guestNames: guestNames,
    perRoomGuests: perRoomGuests,
    nights: 2,
    settings: settings,
    fallbackGuestType: 'utia',
  });

  console.log(`Calculated price: ${price} Kč`);
  
  if (price === 600) {
    console.log('✅ PASS: Price is correct!');
  } else {
    console.log(`❌ FAIL: Expected 600 Kč, got ${price} Kč`);
    console.log(`Difference: ${price - 600} Kč`);
  }
} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.error(error.stack);
}

console.log('\n=== Breakdown Analysis ===\n');

// Manual calculation
const emptyRoomPrice = settings.prices.utia.small.base;
const adultSurcharge = settings.prices.utia.small.adult;
const nights = 2;
const adults = 1;

const expectedEmptyRoomTotal = emptyRoomPrice * nights;
const expectedAdultSurchargeTotal = adultSurcharge * adults * nights;
const expectedTotal = expectedEmptyRoomTotal + expectedAdultSurchargeTotal;

console.log(`Empty room: ${emptyRoomPrice} Kč/night × ${nights} nights = ${expectedEmptyRoomTotal} Kč`);
console.log(`Adult surcharge: ${adultSurcharge} Kč/adult/night × ${adults} adult × ${nights} nights = ${expectedAdultSurchargeTotal} Kč`);
console.log(`Total: ${expectedTotal} Kč`);

