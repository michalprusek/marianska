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
    console.log('\n=== Starting test: Single Room Booking Price Calculation ===\n');

    // Navigate to homepage
    await page.goto('http://localhost', { waitUntil: 'networkidle' });
    console.log('✓ Homepage loaded');

    // Wait for app to initialize
    await page.waitForTimeout(2000);

    // Wait for calendar to be visible (try multiple selectors)
    try {
      await page.waitForSelector('.calendar-container', { timeout: 5000 });
    } catch (e) {
      await page.waitForSelector('#calendar', { timeout: 5000 });
    }
    console.log('✓ Calendar visible');

    // Wait for the calendar to fully render
    await page.waitForTimeout(1000);

    // Trigger single room booking directly via JavaScript
    console.log('Opening single room booking modal for room P13...');
    await page.evaluate(() => {
      // Open single room booking modal programmatically
      if (window.app && window.app.openSingleRoomBooking) {
        window.app.openSingleRoomBooking('13'); // Room P13
      }
    });

    await page.waitForTimeout(1000);

    // Wait for booking modal
    await page.waitForSelector('#singleRoomBookingModal', { state: 'visible', timeout: 5000 });
    console.log('✓ Booking modal visible');

    // Select 2 dates (for 2 nights)
    const today = new Date();
    const futureDate1 = new Date(today);
    futureDate1.setDate(today.getDate() + 10);
    const futureDate2 = new Date(today);
    futureDate2.setDate(today.getDate() + 11); // 2 nights

    const dateStr1 = futureDate1.toISOString().split('T')[0];
    const dateStr2 = futureDate2.toISOString().split('T')[0];

    console.log(`Selecting dates: ${dateStr1} to ${dateStr2}`);

    // Select dates via JavaScript
    await page.evaluate((date1, date2) => {
      const calendar = window.singleRoomBooking?.calendar;
      if (calendar) {
        calendar.selectedDates.add(date1);
        calendar.selectedDates.add(date2);
        calendar.updateSelectedDatesDisplay();
      }
    }, dateStr1, dateStr2);

    await page.waitForTimeout(500);

    // Set guest data directly via JavaScript
    console.log('Setting guest data: 1 adult, ÚTIA type');
    await page.evaluate(() => {
      const booking = window.singleRoomBooking;
      if (booking) {
        // Set guest counts
        booking.adults = 1;
        booking.children = 0;
        booking.toddlers = 0;

        // Set guest type to ÚTIA
        booking.guestType = 'utia';

        // Trigger price update
        if (booking.updatePriceForCurrentRoom) {
          booking.updatePriceForCurrentRoom();
        }
      }
    });

    console.log('✓ Set 1 adult ÚTIA guest');
    await page.waitForTimeout(1500); // Wait for price calculation and display update

    // Get price display
    const totalPriceElement = page.locator('#totalPrice');
    const totalPriceText = await totalPriceElement.textContent();
    console.log(`\n=== PRICE DISPLAY ===`);
    console.log(`Total price: ${totalPriceText}`);

    // Check console logs for debug info
    console.log(`\n=== RELEVANT CONSOLE LOGS ===`);
    const relevantLogs = consoleLogs.filter(log =>
      log.includes('SingleRoomBooking') ||
      log.includes('PriceCalculator') ||
      log.includes('perRoomGuests')
    );
    relevantLogs.forEach(log => console.log(log));

    // Expected: (250 + 50) * 2 = 600 Kč
    const expectedPrice = '600 Kč';
    if (totalPriceText.includes('600')) {
      console.log(`\n✅ PASS: Price is correct (${totalPriceText})`);
    } else {
      console.log(`\n❌ FAIL: Expected ${expectedPrice}, got ${totalPriceText}`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
