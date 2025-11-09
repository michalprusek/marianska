const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });  // Show browser
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs
  page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

  try {
    console.log('\n=== Real Browser Test: Single Room Booking ===\n');

    // Navigate to homepage
    await page.goto('http://localhost', { waitUntil: 'networkidle' });
    console.log('✓ Homepage loaded');

    await page.waitForTimeout(3000);

    // Take screenshot of homepage
    await page.screenshot({ path: '/tmp/test-homepage.png' });
    console.log('✓ Screenshot saved: /tmp/test-homepage.png');

    // Wait indefinitely for manual testing
    console.log('\n📋 Manual testing instructions:');
    console.log('1. Click on room P13 in the calendar');
    console.log('2. Select 2 nights (e.g., 10th-11th of next month)');
    console.log('3. Add 1 adult ÚTIA guest');
    console.log('4. Check the price display:');
    console.log('   - Základní cena za pokoj: 250 Kč (ÚTIA)');
    console.log('   - Dospělí: 50 Kč');
    console.log('   - Počet nocí: × 2');
    console.log('   - Celkem: 600 Kč');
    console.log('\nPress Ctrl+C to exit when done testing');

    await page.waitForTimeout(300000); // Wait 5 minutes

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
})();
