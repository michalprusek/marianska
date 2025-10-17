/**
 * Test script to verify room-size-based pricing implementation
 */

const DatabaseManager = require('./database.js');
const PriceCalculator = require('./js/shared/priceCalculator.js');

async function testPrices() {
  console.log('\n=== TESTING ROOM-SIZE-BASED PRICING ===\n');

  try {
    const db = new DatabaseManager();

    // 1. Check database pricing structure
    console.log('1. Current pricing structure in database:');
    let prices = await db.getSetting('prices');

    // Parse JSON if it's a string
    if (typeof prices === 'string') {
      prices = JSON.parse(prices);
    }

    console.log(JSON.stringify(prices, null, 2));

    // 2. Test price calculations
    console.log('\n2. Testing price calculations:');

    const settings = {
      prices,
      rooms: [
        { id: '12', name: 'Pokoj 12', type: 'small', beds: 2 },
        { id: '13', name: 'Pokoj 13', type: 'small', beds: 3 },
        { id: '14', name: 'Pokoj 14', type: 'large', beds: 4 },
        { id: '22', name: 'Pokoj 22', type: 'small', beds: 2 },
        { id: '23', name: 'Pokoj 23', type: 'small', beds: 3 },
        { id: '24', name: 'Pokoj 24', type: 'large', beds: 4 },
        { id: '42', name: 'Pokoj 42', type: 'small', beds: 2 },
        { id: '43', name: 'Pokoj 43', type: 'small', beds: 2 },
        { id: '44', name: 'Pokoj 44', type: 'large', beds: 4 },
      ],
    };

    // Test case 1: ÚTIA employee, 1 small room, 1 adult, 2 nights
    const test1 = PriceCalculator.calculatePrice({
      guestType: 'utia',
      adults: 1,
      children: 0,
      toddlers: 0,
      nights: 2,
      rooms: ['12'],
      settings,
    });
    console.log(
      '\nTest 1: ÚTIA, 1 small room (P12), 1 adult, 2 nights\nExpected: 600 Kč (300 * 2)\nGot:',
      test1,
      'Kč',
      test1 === 600 ? '✓' : '✗'
    );

    // Test case 2: ÚTIA employee, 1 large room, 1 adult, 2 nights
    const test2 = PriceCalculator.calculatePrice({
      guestType: 'utia',
      adults: 1,
      children: 0,
      toddlers: 0,
      nights: 2,
      rooms: ['14'],
      settings,
    });
    console.log(
      '\nTest 2: ÚTIA, 1 large room (P14), 1 adult, 2 nights\nExpected: 800 Kč (400 * 2)\nGot:',
      test2,
      'Kč',
      test2 === 800 ? '✓' : '✗'
    );

    // Test case 3: ÚTIA employee, 1 small room, 2 adults, 2 nights
    const test3 = PriceCalculator.calculatePrice({
      guestType: 'utia',
      adults: 2,
      children: 0,
      toddlers: 0,
      nights: 2,
      rooms: ['12'],
      settings,
    });
    console.log(
      '\nTest 3: ÚTIA, 1 small room (P12), 2 adults, 2 nights\nExpected: 700 Kč (300*2 + 50*2)\nGot:',
      test3,
      'Kč',
      test3 === 700 ? '✓' : '✗'
    );

    // Test case 4: External guest, 1 small room, 1 adult, 1 child, 2 nights
    const test4 = PriceCalculator.calculatePrice({
      guestType: 'external',
      adults: 1,
      children: 1,
      toddlers: 0,
      nights: 2,
      rooms: ['12'],
      settings,
    });
    console.log(
      '\nTest 4: External, 1 small room (P12), 1 adult, 1 child, 2 nights\nExpected: 1100 Kč (500*2 + 50*2)\nGot:',
      test4,
      'Kč',
      test4 === 1100 ? '✓' : '✗'
    );

    // Test case 5: External guest, 1 large room, 2 adults, 1 child, 2 nights
    const test5 = PriceCalculator.calculatePrice({
      guestType: 'external',
      adults: 2,
      children: 1,
      toddlers: 0,
      nights: 2,
      rooms: ['14'],
      settings,
    });
    console.log(
      '\nTest 5: External, 1 large room (P14), 2 adults, 1 child, 2 nights\nExpected: 1500 Kč (600*2 + 100*2 + 50*2)\nGot:',
      test5,
      'Kč',
      test5 === 1500 ? '✓' : '✗'
    );

    // Test case 6: ÚTIA employee, 2 rooms (1 small + 1 large), 2 adults, 2 nights
    const test6 = PriceCalculator.calculatePrice({
      guestType: 'utia',
      adults: 2,
      children: 0,
      toddlers: 0,
      nights: 2,
      rooms: ['12', '14'],
      settings,
    });
    console.log(
      '\nTest 6: ÚTIA, 2 rooms (P12 small + P14 large), 2 adults, 2 nights\nExpected: 1400 Kč ((300+400)*2, no surcharges for 2 adults in 2 rooms)\nGot:',
      test6,
      'Kč',
      test6 === 1400 ? '✓' : '✗'
    );

    // Test case 7: ÚTIA employee, 2 small rooms, 3 adults, 1 child, 2 nights
    const test7 = PriceCalculator.calculatePrice({
      guestType: 'utia',
      adults: 3,
      children: 1,
      toddlers: 0,
      nights: 2,
      rooms: ['12', '13'],
      settings,
    });
    console.log(
      '\nTest 7: ÚTIA, 2 small rooms (P12+P13), 3 adults, 1 child, 2 nights\nExpected: 1350 Kč ((300*2)*2 + 50*2 + 25*2)\nGot:',
      test7,
      'Kč',
      test7 === 1350 ? '✓' : '✗'
    );

    // Test case 8: Toddlers are free
    const test8 = PriceCalculator.calculatePrice({
      guestType: 'utia',
      adults: 1,
      children: 0,
      toddlers: 2,
      nights: 2,
      rooms: ['12'],
      settings,
    });
    console.log(
      '\nTest 8: ÚTIA, 1 small room (P12), 1 adult, 2 toddlers, 2 nights\nExpected: 600 Kč (toddlers free)\nGot:',
      test8,
      'Kč',
      test8 === 600 ? '✓' : '✗'
    );

    console.log('\n=== TESTS COMPLETED ===\n');

    db.close();
  } catch (error) {
    console.error('Error during testing:', error);
    process.exit(1);
  }
}

testPrices();
