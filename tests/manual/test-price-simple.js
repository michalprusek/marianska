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
    console.log(`[BROWSER CONSOLE] ${text}`);
  });

  try {
    console.log('\n=== Testing Price Calculation Directly ===\n');

    // Navigate to homepage
    await page.goto('http://localhost', { waitUntil: 'networkidle' });
    console.log('✓ Homepage loaded');

    // Wait for PriceCalculator and dataManager to be available
    console.log('Waiting for PriceCalculator and app.dataManager...');
    await page.waitForFunction(
      () => window.PriceCalculator && window.app && window.app.dataManager && window.app.dataManager.cachedData,
      { timeout: 10000 }
    );
    console.log('✓ PriceCalculator and app.dataManager loaded');

    await page.waitForTimeout(1000);

    // Test price calculation directly
    console.log('\nTest: Room P13, 2 nights, 1 adult ÚTIA guest');
    console.log('Expected: (250 empty + 50 adult) × 2 nights = 600 Kč\n');

    const result = await page.evaluate(() => {
      const PriceCalculator = window.PriceCalculator;
      const dataManager = window.app?.dataManager;

      if (!PriceCalculator || !dataManager) {
        return { error: 'PriceCalculator or dataManager not found' };
      }

      // Get settings
      const settings = dataManager.cachedData?.settings;
      if (!settings) {
        return { error: 'Settings not found' };
      }

      const roomId = '13';
      const nights = 2;
      const guestType = 'utia';

      // Test 1: Get empty room price
      const roomPriceConfig = PriceCalculator.getRoomPriceConfig(roomId, guestType, settings);
      const emptyPrice = PriceCalculator.getEmptyRoomPrice(roomPriceConfig);

      // Test 2: Calculate full price with perRoomGuests
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
        settings: settings,
        fallbackGuestType: guestType
      });

      return {
        roomId: roomId,
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

    if (result.error) {
      console.error('❌ Error:', result.error);
      process.exit(1);
    }

    console.log('=== CALCULATION RESULTS ===');
    console.log(`Room: P${result.roomId}`);
    console.log(`Empty room price: ${result.emptyPrice} Kč`);
    console.log(`Adult surcharge: ${result.adultSurcharge} Kč`);
    console.log(`Child surcharge: ${result.childSurcharge} Kč`);
    console.log(`Nights: ${result.nights}`);
    console.log(`\nperRoomGuests: ${JSON.stringify(result.perRoomGuests, null, 2)}`);
    console.log(`\nCalculation: (${result.emptyPrice} + ${result.adultSurcharge}) × ${result.nights} = ${result.expectedPrice} Kč`);
    console.log(`\nActual total: ${result.totalPrice} Kč`);

    if (result.totalPrice === result.expectedPrice) {
      console.log(`\n✅ PASS: Price is correct (${result.totalPrice} Kč)`);
    } else {
      console.log(`\n❌ FAIL: Expected ${result.expectedPrice} Kč, got ${result.totalPrice} Kč`);
    }

    // Check for fallback warnings in console logs
    console.log('\n=== RELEVANT CONSOLE LOGS ===');
    const relevantLogs = consoleLogs.filter(log =>
      log.includes('PriceCalculator') ||
      log.includes('perRoomGuests') ||
      log.includes('fallback')
    );

    if (relevantLogs.length > 0) {
      relevantLogs.forEach(log => console.log(log));
    } else {
      console.log('(No relevant logs)');
    }

    // Check for fallback warning
    const hasFallbackWarning = consoleLogs.some(log =>
      log.includes('Using fallback guest type')
    );

    if (hasFallbackWarning) {
      console.log('\n⚠️  WARNING: Fallback guest type was used - perRoomGuests may not be passed correctly');
    } else {
      console.log('\n✅ No fallback warning - perRoomGuests passed correctly');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
