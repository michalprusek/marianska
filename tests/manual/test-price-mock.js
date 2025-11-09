const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log(`[CONSOLE] ${text}`);
  });

  try {
    console.log('\n=== Testing Price Calculation with Mock Data ===\n');

    // Navigate to homepage
    await page.goto('http://localhost', { waitUntil: 'networkidle' });
    console.log('✓ Homepage loaded');

    // Wait for PriceCalculator
    await page.waitForFunction(() => window.PriceCalculator, { timeout: 10000 });
    console.log('✓ PriceCalculator loaded\n');

    // Test with mock settings
    console.log('Test: Room P13 (small), 2 nights, 1 adult ÚTIA guest');
    console.log('Expected: (250 empty + 50 adult) × 2 nights = 600 Kč\n');

    const result = await page.evaluate(() => {
      const PriceCalculator = window.PriceCalculator;

      // Mock settings matching the expected configuration
      const mockSettings = {
        rooms: [
          { id: '12', name: 'P12', capacity: 2, type: 'small' },
          { id: '13', name: 'P13', capacity: 3, type: 'small' },
          { id: '14', name: 'P14', capacity: 4, type: 'large' }
        ],
        prices: {
          utia: {
            small: { base: 250, adult: 50, child: 25 },  // Using 'base' not 'empty'
            large: { base: 350, adult: 70, child: 35 }
          },
          external: {
            small: { base: 400, adult: 100, child: 50 },
            large: { base: 500, adult: 120, child: 60 }
          }
        }
      };

      const roomId = '13';
      const guestType = 'utia';
      const nights = 2;

      // Step 1: Get room config
      const room = mockSettings.rooms.find(r => r.id === roomId);
      const roomType = room?.type || 'small';
      const roomPriceConfig = mockSettings.prices[guestType][roomType];

      // Step 2: Get empty room price
      const emptyPrice = PriceCalculator.getEmptyRoomPrice(roomPriceConfig);

      // Step 3: Calculate total with perRoomGuests
      const perRoomGuests = {
        [roomId]: {
          adults: 1,
          children: 0,
          toddlers: 0,
          guestType: guestType
        }
      };

      const guestNames = [
        { name: 'Test Adult', ageCategory: 'adult' }
      ];

      const totalPrice = PriceCalculator.calculatePerGuestPrice({
        rooms: [roomId],
        guestNames: guestNames,
        perRoomGuests: perRoomGuests,
        nights: nights,
        settings: mockSettings,
        fallbackGuestType: guestType
      });

      return {
        roomId: roomId,
        guestType: guestType,
        roomPriceConfig: roomPriceConfig,
        emptyPrice: emptyPrice,
        adultSurcharge: roomPriceConfig.adult,
        childSurcharge: roomPriceConfig.child,
        nights: nights,
        perRoomGuests: perRoomGuests,
        totalPrice: totalPrice,
        expectedPrice: (emptyPrice + roomPriceConfig.adult) * nights
      };
    });

    console.log('=== CALCULATION RESULTS ===');
    console.log(`Room: P${result.roomId} (${result.guestType.toUpperCase()})`);
    console.log(`Empty room price: ${result.emptyPrice} Kč`);
    console.log(`Adult surcharge: ${result.adultSurcharge} Kč/night`);
    console.log(`Child surcharge: ${result.childSurcharge} Kč/night`);
    console.log(`Nights: ${result.nights}`);
    console.log(`\nperRoomGuests structure:`);
    console.log(JSON.stringify(result.perRoomGuests, null, 2));
    console.log(`\nCalculation:`);
    console.log(`  Empty room: ${result.emptyPrice} Kč/night`);
    console.log(`  + Adult: ${result.adultSurcharge} Kč/night`);
    console.log(`  = ${result.emptyPrice + result.adultSurcharge} Kč/night`);
    console.log(`  × ${result.nights} nights`);
    console.log(`  = ${result.expectedPrice} Kč`);
    console.log(`\nActual result: ${result.totalPrice} Kč`);

    // Check result
    if (result.totalPrice === result.expectedPrice) {
      console.log(`\n✅ PASS: Price calculation is CORRECT (${result.totalPrice} Kč)`);
    } else {
      console.log(`\n❌ FAIL: Expected ${result.expectedPrice} Kč, got ${result.totalPrice} Kč`);
      console.log(`\nDifference: ${result.totalPrice - result.expectedPrice} Kč`);
    }

    // Check for fallback warnings
    console.log('\n=== CONSOLE LOGS ANALYSIS ===');
    const fallbackLogs = consoleLogs.filter(log => log.includes('fallback'));
    const priceCalcLogs = consoleLogs.filter(log => log.includes('PriceCalculator'));

    if (fallbackLogs.length > 0) {
      console.log('⚠️  Fallback warnings found:');
      fallbackLogs.forEach(log => console.log('  -', log));
    } else {
      console.log('✅ No fallback warnings - perRoomGuests used correctly');
    }

    if (priceCalcLogs.length > 0) {
      console.log('\nPriceCalculator logs:');
      priceCalcLogs.forEach(log => console.log('  -', log));
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
