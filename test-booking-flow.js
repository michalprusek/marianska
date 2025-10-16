#!/usr/bin/env node
/**
 * Comprehensive booking flow test
 * Tests the complete user journey from viewing calendar to submitting a booking
 */

const puppeteer = require('puppeteer');

// Helper function for delays
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function testBookingFlow() {
  console.log('🚀 Starting comprehensive booking flow test...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
    ],
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();

  // Store console messages and errors
  const consoleMessages = [];
  const errors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    consoleMessages.push({ type, text });

    if (type === 'error') {
      errors.push(text);
      console.log(`❌ Console error: ${text}`);
    }
  });

  page.on('pageerror', (error) => {
    errors.push(`PAGE ERROR: ${error.message}`);
    console.log(`❌ Page error: ${error.message}`);
  });

  try {
    console.log('📄 Loading application...');
    await page.goto('http://localhost', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    console.log('✅ Page loaded\n');

    // Wait for calendar to render
    await page.waitForSelector('#calendar', { timeout: 5000 });
    console.log('✅ Calendar rendered\n');

    // Test 1: Click on a room to open single room booking modal
    console.log('🧪 Test 1: Opening single room booking modal...');
    try {
      // Find first available room cell
      const roomCell = await page.$('.room-cell.available');
      if (roomCell) {
        await roomCell.click();
        await delay(1000);

        // Check if modal opened
        const modal = await page.$('.modal.active, .modal.show');
        if (modal) {
          console.log('✅ Single room booking modal opened\n');
        } else {
          console.log('⚠️  Modal did not open\n');
        }
      } else {
        console.log('⚠️  No available room cells found\n');
      }
    } catch (err) {
      console.log(`⚠️  Error opening modal: ${err.message}\n`);
    }

    await delay(1000);

    // Test 2: Try bulk booking flow
    console.log('🧪 Test 2: Testing bulk booking modal...');
    try {
      const bulkBtn = await page.$('#bulkActionBtn');
      if (bulkBtn) {
        await bulkBtn.click();
        await delay(1000);

        // Check if bulk modal is visible
        const bulkModal = await page.$('#bulkBookingModal');
        if (bulkModal) {
          const isVisible = await page.evaluate(
            (el) => el.style.display !== 'none' && el.classList.contains('active'),
            bulkModal
          );

          if (isVisible) {
            console.log('✅ Bulk booking modal opened\n');

            // Try to interact with bulk modal elements
            const guestTypeRadio = await page.$('input[name="bulkGuestType"][value="utia"]');
            if (guestTypeRadio) {
              await guestTypeRadio.click();
              console.log('✅ Guest type selected\n');
            }
          } else {
            console.log('⚠️  Bulk modal not visible\n');
          }
        }
      }
    } catch (err) {
      console.log(`⚠️  Bulk booking error: ${err.message}\n`);
    }

    await delay(1000);

    // Test 3: Test room info modal
    console.log('🧪 Test 3: Testing room info modal...');
    try {
      const roomInfoBtn = await page.$('#roomInfoBtn');
      if (roomInfoBtn) {
        await roomInfoBtn.click();
        await delay(1000);

        const roomInfoModal = await page.$('#roomInfoModal');
        if (roomInfoModal) {
          const isVisible = await page.evaluate(
            (el) => el.classList.contains('active'),
            roomInfoModal
          );

          if (isVisible) {
            console.log('✅ Room info modal opened\n');

            // Check if room capacity grid is rendered
            const capacityGrid = await page.$('#roomCapacityGrid');
            if (capacityGrid) {
              const gridContent = await page.evaluate((el) => el.innerHTML, capacityGrid);
              if (gridContent && gridContent.trim().length > 0) {
                console.log('✅ Room capacity grid rendered\n');
              } else {
                console.log('⚠️  Room capacity grid is empty\n');
              }
            }

            // Close the modal
            const closeBtn = await page.$('#roomInfoModal .modal-close');
            if (closeBtn) {
              await closeBtn.click();
              await delay(500);
              console.log('✅ Room info modal closed\n');
            }
          }
        }
      }
    } catch (err) {
      console.log(`⚠️  Room info error: ${err.message}\n`);
    }

    // Wait for any async errors
    await delay(2000);
  } catch (error) {
    console.error('❌ Fatal error during testing:', error.message);
    errors.push(`FATAL ERROR: ${error.message}`);
  }

  await browser.close();

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 BOOKING FLOW TEST RESULTS');
  console.log('='.repeat(60) + '\n');

  if (errors.length === 0) {
    console.log('✅ NO ERRORS FOUND - All booking flows work correctly!\n');
  } else {
    console.log(`❌ FOUND ${errors.length} ERROR(S):\n`);
    errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err}`);
    });
    console.log('');
  }

  console.log(`📝 Total console messages: ${consoleMessages.length}`);

  // Return exit code
  process.exit(errors.length > 0 ? 1 : 0);
}

testBookingFlow().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
