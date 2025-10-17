/**
 * Test updating prices through the API (simulating admin panel)
 */

const DatabaseManager = require('./database.js');
const PriceCalculator = require('./js/shared/priceCalculator.js');

async function testPriceUpdate() {
  console.log('\n=== TESTING PRICE UPDATE ===\n');

  try {
    const db = new DatabaseManager();

    // 1. Read current prices
    console.log('1. Current prices:');
    let currentPrices = await db.getSetting('prices');
    if (typeof currentPrices === 'string') {
      currentPrices = JSON.parse(currentPrices);
    }
    console.log('   ÚTIA small base:', currentPrices.utia.small.base, 'Kč');
    console.log('   ÚTIA large base:', currentPrices.utia.large.base, 'Kč');

    // 2. Update prices to test values
    console.log('\n2. Updating prices to test values...');
    const testPrices = {
      utia: {
        small: { base: 350, adult: 60, child: 30 },
        large: { base: 450, adult: 60, child: 30 },
      },
      external: {
        small: { base: 550, adult: 110, child: 55 },
        large: { base: 650, adult: 110, child: 55 },
      },
    };

    await db.setSetting('prices', JSON.stringify(testPrices));
    console.log('   ✓ Prices updated');

    // 3. Verify prices were saved
    console.log('\n3. Verifying updated prices:');
    let updatedPrices = await db.getSetting('prices');
    if (typeof updatedPrices === 'string') {
      updatedPrices = JSON.parse(updatedPrices);
    }
    console.log(
      '   ÚTIA small base:',
      updatedPrices.utia.small.base,
      'Kč',
      updatedPrices.utia.small.base === 350 ? '✓' : '✗'
    );
    console.log(
      '   ÚTIA large base:',
      updatedPrices.utia.large.base,
      'Kč',
      updatedPrices.utia.large.base === 450 ? '✓' : '✗'
    );
    console.log(
      '   External small base:',
      updatedPrices.external.small.base,
      'Kč',
      updatedPrices.external.small.base === 550 ? '✓' : '✗'
    );
    console.log(
      '   External large base:',
      updatedPrices.external.large.base,
      'Kč',
      updatedPrices.external.large.base === 650 ? '✓' : '✗'
    );

    // 4. Test calculations with new prices
    console.log('\n4. Testing calculations with new prices:');
    const settings = {
      prices: updatedPrices,
      rooms: [
        { id: '12', name: 'Pokoj 12', type: 'small', beds: 2 },
        { id: '14', name: 'Pokoj 14', type: 'large', beds: 4 },
      ],
    };

    const price1 = PriceCalculator.calculatePrice({
      guestType: 'utia',
      adults: 1,
      children: 0,
      toddlers: 0,
      nights: 2,
      rooms: ['12'],
      settings,
    });
    console.log(
      '   ÚTIA small room, 1 adult, 2 nights:',
      price1,
      'Kč',
      price1 === 700 ? '✓' : '✗',
      '(expected 700)'
    );

    const price2 = PriceCalculator.calculatePrice({
      guestType: 'external',
      adults: 1,
      children: 0,
      toddlers: 0,
      nights: 2,
      rooms: ['14'],
      settings,
    });
    console.log(
      '   External large room, 1 adult, 2 nights:',
      price2,
      'Kč',
      price2 === 1300 ? '✓' : '✗',
      '(expected 1300)'
    );

    // 5. Restore original prices
    console.log('\n5. Restoring original prices...');
    const originalPrices = PriceCalculator.getDefaultPrices();
    await db.setSetting('prices', JSON.stringify(originalPrices));

    let restoredPrices = await db.getSetting('prices');
    if (typeof restoredPrices === 'string') {
      restoredPrices = JSON.parse(restoredPrices);
    }
    console.log('   ✓ Prices restored');
    console.log(
      '   ÚTIA small base:',
      restoredPrices.utia.small.base,
      'Kč',
      restoredPrices.utia.small.base === 300 ? '✓' : '✗'
    );
    console.log(
      '   ÚTIA large base:',
      restoredPrices.utia.large.base,
      'Kč',
      restoredPrices.utia.large.base === 400 ? '✓' : '✗'
    );

    console.log('\n=== PRICE UPDATE TESTS COMPLETED ===\n');

    db.close();
  } catch (error) {
    console.error('Error during testing:', error);
    process.exit(1);
  }
}

testPriceUpdate();
