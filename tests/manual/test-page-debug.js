const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture all console messages
  page.on('console', msg => console.log(`[CONSOLE ${msg.type()}]`, msg.text()));

  // Capture errors
  page.on('pageerror', error => console.log('[PAGE ERROR]', error.message));

  try {
    console.log('Navigating to homepage...\n');
    await page.goto('http://localhost', { waitUntil: 'networkidle' });

    await page.waitForTimeout(3000);

    // Check what's on window
    const windowCheck = await page.evaluate(() => {
      return {
        hasPriceCalculator: typeof window.PriceCalculator !== 'undefined',
        hasDataManager: typeof window.dataManager !== 'undefined',
        hasApp: typeof window.app !== 'undefined',
        appKeys: window.app ? Object.keys(window.app) : null,
        hasAppDataManager: window.app && typeof window.app.dataManager !== 'undefined',
        hasCachedData: window.app && window.app.dataManager && typeof window.app.dataManager.cachedData !== 'undefined',
        cachedDataKeys: window.app && window.app.dataManager && window.app.dataManager.cachedData ? Object.keys(window.app.dataManager.cachedData) : null,
        hasSingleRoomBooking: typeof window.singleRoomBooking !== 'undefined',
        windowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('price') || k.toLowerCase().includes('data') || k.toLowerCase().includes('booking') || k === 'app')
      };
    });

    console.log('=== Window Object Check ===');
    console.log('Has PriceCalculator:', windowCheck.hasPriceCalculator);
    console.log('Has dataManager:', windowCheck.hasDataManager);
    console.log('Has app:', windowCheck.hasApp);
    console.log('App keys:', windowCheck.appKeys);
    console.log('Has app.dataManager:', windowCheck.hasAppDataManager);
    console.log('Has cachedData:', windowCheck.hasCachedData);
    console.log('CachedData keys:', windowCheck.cachedDataKeys);
    console.log('Has singleRoomBooking:', windowCheck.hasSingleRoomBooking);
    console.log('Relevant window keys:', windowCheck.windowKeys);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
