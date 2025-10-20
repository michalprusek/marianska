#!/usr/bin/env node
/**
 * Frontend testing script using Puppeteer
 * Tests the booking application for console errors and runtime issues
 */

const puppeteer = require('puppeteer');

// Helper function for delays
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function testFrontend() {
  console.log('🚀 Starting frontend testing with Puppeteer...\n');

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

  // Store console messages
  const consoleMessages = [];
  const errors = [];
  const warnings = [];

  // Listen to console events
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();

    consoleMessages.push({ type, text });

    if (type === 'error') {
      errors.push(text);
    } else if (type === 'warning') {
      warnings.push(text);
    }
  });

  // Listen to page errors
  page.on('pageerror', (error) => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  // Listen to failed requests
  page.on('requestfailed', (request) => {
    errors.push(`REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`);
  });

  try {
    console.log('📄 Loading http://localhost...');
    await page.goto('http://localhost', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    console.log('✅ Page loaded successfully\n');

    // Wait for main calendar to render
    await page.waitForSelector('#calendar', { timeout: 5000 });
    console.log('✅ Main calendar rendered\n');

    // Test 1: Click on room info button
    console.log('🧪 Test 1: Room info button...');
    const roomInfoBtn = await page.$('#roomInfoBtn');
    if (roomInfoBtn) {
      await roomInfoBtn.click();
      await delay(1000);
      console.log('✅ Room info button clicked\n');
    } else {
      console.log('⚠️  Room info button not found\n');
    }

    // Test 2: Try language switch (checkbox)
    console.log('🧪 Test 2: Language switch...');
    try {
      await page.click('#languageSwitch');
      await delay(1000);
      console.log('✅ Language switched\n');
    } catch (err) {
      console.log(`⚠️  Language switch error: ${err.message}\n`);
    }

    // Test 3: Click on calendar navigation
    console.log('🧪 Test 3: Calendar navigation...');
    const nextBtn = await page.$('#nextMonth');
    if (nextBtn) {
      await nextBtn.click();
      await delay(1000);
      console.log('✅ Calendar navigated\n');
    } else {
      console.log('⚠️  Next month button not found\n');
    }

    // Test 4: Try to open bulk booking modal
    console.log('🧪 Test 4: Bulk booking modal...');
    const bulkBtn = await page.$('#bulkActionBtn');
    if (bulkBtn) {
      await bulkBtn.click();
      await delay(1000);
      console.log('✅ Bulk booking modal opened\n');
    } else {
      console.log('⚠️  Bulk booking button not found\n');
    }

    // Wait a bit to catch any delayed errors
    await delay(2000);
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    errors.push(`TEST ERROR: ${error.message}`);
  }

  await browser.close();

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60) + '\n');

  if (errors.length === 0) {
    console.log('✅ NO ERRORS FOUND!\n');
  } else {
    console.log(`❌ FOUND ${errors.length} ERROR(S):\n`);
    errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err}`);
    });
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`⚠️  FOUND ${warnings.length} WARNING(S):\n`);
    warnings.forEach((warn, i) => {
      console.log(`${i + 1}. ${warn}`);
    });
    console.log('');
  }

  console.log(`📝 Total console messages: ${consoleMessages.length}`);

  // Return exit code based on errors
  process.exit(errors.length > 0 ? 1 : 0);
}

testFrontend().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
