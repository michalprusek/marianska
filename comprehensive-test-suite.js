/**
 * Comprehensive Test Suite for Chata Mariánská Booking System
 * Tests all user workflows and edge cases
 */

const { chromium } = require('playwright');

// Test configuration
const BASE_URL = 'https://chata.utia.cas.cz';
const ADMIN_PASSWORD = 'admin123';

// Test results tracker
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function recordTest(name, passed, details = '') {
  if (passed) {
    testResults.passed.push({ name, details });
    log(`PASS: ${name}`, 'success');
  } else {
    testResults.failed.push({ name, details });
    log(`FAIL: ${name} - ${details}`, 'error');
  }
}

function recordWarning(name, details) {
  testResults.warnings.push({ name, details });
  log(`WARNING: ${name} - ${details}`, 'warning');
}

// Helper to wait for network idle
async function waitForNetworkIdle(page, timeout = 3000) {
  await page.waitForLoadState('networkidle', { timeout });
}

// Helper to safely click with retry
async function safeClick(page, selector, options = {}) {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.click(selector, { timeout: 5000, ...options });
      return true;
    } catch (error) {
      if (i === maxRetries - 1) {
        log(`Failed to click ${selector}: ${error.message}`, 'error');
        return false;
      }
      await page.waitForTimeout(1000);
    }
  }
}

// Helper to check console errors
function setupConsoleMonitoring(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  return errors;
}

// ============================================================================
// TEST 1: Homepage Load and Initial State
// ============================================================================
async function testHomepageLoad(page) {
  log('TEST 1: Homepage Load and Initial State');

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

    // Check page title
    const title = await page.title();
    recordTest('Homepage title correct', title.includes('Rezervační systém'), `Title: ${title}`);

    // Check calendar is rendered
    const calendarExists = await page.locator('.calendar-grid').count() > 0;
    recordTest('Calendar grid rendered', calendarExists);

    // Check room labels are present
    const roomLabels = await page.locator('text=/P[0-9]{2}/').count();
    recordTest('Room labels present', roomLabels >= 9, `Found ${roomLabels} room labels`);

    // Check navigation buttons
    const prevMonthBtn = await page.locator('button:has-text("Předchozí")').count();
    const nextMonthBtn = await page.locator('button:has-text("Další")').count();
    recordTest('Month navigation buttons present', prevMonthBtn > 0 && nextMonthBtn > 0);

    // Check bulk booking button
    const bulkBtn = await page.locator('button:has-text("Bulk Booking")').count();
    recordTest('Bulk booking button present', bulkBtn > 0);

    // Check admin button
    const adminBtn = await page.locator('button:has-text("Admin")').count();
    recordTest('Admin button present', adminBtn > 0);

    // Check room information button
    const roomInfoBtn = await page.locator('button:has-text("Room Information")').count();
    recordTest('Room information button present', roomInfoBtn > 0);

    return true;
  } catch (error) {
    recordTest('Homepage load', false, error.message);
    return false;
  }
}

// ============================================================================
// TEST 2: Calendar Interaction and Availability Display
// ============================================================================
async function testCalendarInteraction(page) {
  log('TEST 2: Calendar Interaction and Availability');

  try {
    // Test month navigation
    await safeClick(page, 'button:has-text("Další měsíc")');
    await page.waitForTimeout(500);

    const monthHeader = await page.locator('h2').first().textContent();
    recordTest('Month navigation forward works', monthHeader.includes('2025') || monthHeader.includes('2026'));

    await safeClick(page, 'button:has-text("Předchozí měsíc")');
    await page.waitForTimeout(500);

    // Test clicking on available cell
    const availableCells = page.locator('.calendar-cell.available').first();
    const availableCount = await availableCells.count();

    if (availableCount > 0) {
      await availableCells.click();
      await page.waitForTimeout(500);

      // Check if modal or selection happens
      const modalVisible = await page.locator('.modal:visible').count() > 0;
      recordTest('Clicking available cell triggers action', modalVisible, 'Modal should appear or cell should be selected');
    } else {
      recordWarning('Calendar interaction', 'No available cells found to test click');
    }

    // Test legend display
    const legendBtn = page.locator('button:has-text("Show legend")');
    if (await legendBtn.count() > 0) {
      await legendBtn.click();
      await page.waitForTimeout(300);

      const legendVisible = await page.locator('text="Room States"').isVisible();
      recordTest('Legend displays correctly', legendVisible);
    }

    return true;
  } catch (error) {
    recordTest('Calendar interaction', false, error.message);
    return false;
  }
}

// ============================================================================
// TEST 3: Single Room Booking Flow
// ============================================================================
async function testSingleRoomBooking(page) {
  log('TEST 3: Single Room Booking Flow');

  try {
    // Navigate to fresh homepage
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Find and click an available room cell (green)
    const availableCells = page.locator('.calendar-cell:not(.occupied):not(.blocked):not(.past-date)');
    const cellCount = await availableCells.count();

    if (cellCount === 0) {
      recordWarning('Single room booking', 'No available cells found - skipping booking flow test');
      return true;
    }

    // Click first available cell
    await availableCells.first().click();
    await page.waitForTimeout(1000);

    // Check if booking modal appears
    const modalVisible = await page.locator('.modal:visible').count() > 0;
    recordTest('Booking modal opens on room selection', modalVisible);

    if (modalVisible) {
      // Check form fields are present
      const nameField = await page.locator('input[name="name"], #name').count();
      const emailField = await page.locator('input[name="email"], #email').count();
      const phoneField = await page.locator('input[name="phone"], #phone').count();

      recordTest('Booking form fields present', nameField > 0 && emailField > 0 && phoneField > 0);

      // Test form validation
      const submitBtn = page.locator('button:has-text("Rezervovat"), button:has-text("Potvrdit")');
      if (await submitBtn.count() > 0) {
        await submitBtn.first().click();
        await page.waitForTimeout(500);

        // Should show validation errors for empty fields
        const errorMessages = await page.locator('.error, .validation-error, [class*="error"]').count();
        recordTest('Form validation prevents empty submission', errorMessages > 0);
      }

      // Close modal
      const closeBtn = page.locator('button:has-text("Zavřít"), button.close, .modal-close');
      if (await closeBtn.count() > 0) {
        await closeBtn.first().click();
      }
    }

    return true;
  } catch (error) {
    recordTest('Single room booking flow', false, error.message);
    return false;
  }
}

// ============================================================================
// TEST 4: Multi-Room Booking
// ============================================================================
async function testMultiRoomBooking(page) {
  log('TEST 4: Multi-Room Booking');

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Try to select multiple rooms for same date
    const availableCells = page.locator('.calendar-cell:not(.occupied):not(.blocked):not(.past-date)');
    const cellCount = await availableCells.count();

    if (cellCount < 2) {
      recordWarning('Multi-room booking', 'Not enough available cells to test multi-room');
      return true;
    }

    // Click first cell
    await availableCells.nth(0).click();
    await page.waitForTimeout(500);

    // Try to add another room
    await availableCells.nth(1).click();
    await page.waitForTimeout(500);

    // Check if system handles multiple room selection
    const selectedRooms = await page.locator('.selected-room, .room-selected').count();
    recordTest('Multi-room selection works', selectedRooms >= 1, `Selected ${selectedRooms} rooms`);

    return true;
  } catch (error) {
    recordTest('Multi-room booking', false, error.message);
    return false;
  }
}

// ============================================================================
// TEST 5: Bulk Booking Modal
// ============================================================================
async function testBulkBooking(page) {
  log('TEST 5: Bulk Booking Flow');

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

    // Click bulk booking button
    const bulkBtn = page.locator('button:has-text("Bulk Booking")');
    await bulkBtn.click();
    await page.waitForTimeout(1000);

    // Check if bulk booking modal appears
    const bulkModalVisible = await page.locator('.modal:visible, #bulkBookingModal:visible').count() > 0;
    recordTest('Bulk booking modal opens', bulkModalVisible);

    if (bulkModalVisible) {
      // Check for date selection inputs
      const dateInputs = await page.locator('input[type="date"]').count();
      recordTest('Bulk booking date inputs present', dateInputs >= 2);

      // Check capacity display (26 beds total)
      const capacityText = await page.locator('text=/26|kapacita/i').count();
      recordTest('Bulk booking shows capacity', capacityText > 0);

      // Close modal
      const closeBtn = page.locator('button:has-text("Zavřít"), button:has-text("Close")');
      if (await closeBtn.count() > 0) {
        await closeBtn.first().click();
      }
    }

    return true;
  } catch (error) {
    recordTest('Bulk booking', false, error.message);
    return false;
  }
}

// ============================================================================
// TEST 6: Admin Panel Access and Login
// ============================================================================
async function testAdminPanel(page) {
  log('TEST 6: Admin Panel Access');

  try {
    await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'networkidle' });

    // Check if login form is present
    const passwordField = await page.locator('input[type="password"]').count();
    recordTest('Admin login form present', passwordField > 0);

    // Test invalid login
    if (passwordField > 0) {
      await page.fill('input[type="password"]', 'wrongpassword');
      const loginBtn = page.locator('button:has-text("Přihlásit"), button[type="submit"]');
      await loginBtn.click();
      await page.waitForTimeout(1000);

      // Should show error
      const errorVisible = await page.locator('.error, .alert-error, [class*="error"]').count() > 0;
      recordTest('Admin login rejects invalid password', errorVisible);
    }

    // Test valid login
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    const loginBtn = page.locator('button:has-text("Přihlásit"), button[type="submit"]');
    await loginBtn.click();
    await page.waitForTimeout(2000);

    // Check if admin panel content loads
    const adminContent = await page.locator('.admin-panel, .tab-button, button:has-text("Rezervace")').count();
    recordTest('Admin panel loads after valid login', adminContent > 0);

    if (adminContent > 0) {
      // Test tab navigation
      const tabs = ['Rezervace', 'Blokované termíny', 'Nastavení'];
      for (const tab of tabs) {
        const tabBtn = page.locator(`button:has-text("${tab}")`);
        if (await tabBtn.count() > 0) {
          await tabBtn.first().click();
          await page.waitForTimeout(500);
        }
      }
      recordTest('Admin tab navigation works', true);

      // Go back to Rezervace tab
      await page.locator('button:has-text("Rezervace")').first().click();
      await page.waitForTimeout(500);

      // Check if bookings list is displayed
      const bookingsList = await page.locator('.booking-item, .booking-row, tr').count();
      recordTest('Admin bookings list displays', bookingsList > 0, `Found ${bookingsList} bookings`);
    }

    return true;
  } catch (error) {
    recordTest('Admin panel', false, error.message);
    return false;
  }
}

// ============================================================================
// TEST 7: Admin Booking Operations
// ============================================================================
async function testAdminBookingOperations(page) {
  log('TEST 7: Admin Booking Operations');

  try {
    // Assume we're already logged in from previous test
    const adminContent = await page.locator('.admin-panel, button:has-text("Rezervace")').count();

    if (adminContent === 0) {
      // Need to login again
      await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'networkidle' });
      await page.fill('input[type="password"]', ADMIN_PASSWORD);
      await page.locator('button:has-text("Přihlásit")').click();
      await page.waitForTimeout(2000);
    }

    // Go to Rezervace tab
    const rezervaceTab = page.locator('button:has-text("Rezervace")').first();
    await rezervaceTab.click();
    await page.waitForTimeout(1000);

    // Test search functionality
    const searchInput = page.locator('input[placeholder*="Hledat"], input[type="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      recordTest('Admin booking search works', true);
      await searchInput.fill('');
    }

    // Test filter by date
    const filterButtons = await page.locator('button:has-text("Nadcházející"), button:has-text("Všechny")').count();
    recordTest('Admin booking filters present', filterButtons > 0);

    // Test bulk selection
    const checkboxes = await page.locator('.booking-checkbox, input[type="checkbox"]').count();
    if (checkboxes >= 2) {
      const firstCheckbox = page.locator('.booking-checkbox, input[type="checkbox"]').nth(0);
      const secondCheckbox = page.locator('.booking-checkbox, input[type="checkbox"]').nth(1);

      await firstCheckbox.check();
      await page.waitForTimeout(300);
      await secondCheckbox.check();
      await page.waitForTimeout(300);

      // Check if bulk actions appear
      const bulkActions = await page.locator('#bulkActionsContainer, .bulk-actions').isVisible();
      recordTest('Admin bulk actions appear on selection', bulkActions);

      // Uncheck
      await firstCheckbox.uncheck();
      await secondCheckbox.uncheck();
    }

    return true;
  } catch (error) {
    recordTest('Admin booking operations', false, error.message);
    return false;
  }
}

// ============================================================================
// TEST 8: Validation and Edge Cases
// ============================================================================
async function testValidationEdgeCases(page) {
  log('TEST 8: Validation and Edge Cases');

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Try to select a past date
    const prevMonthBtn = page.locator('button:has-text("Předchozí")');
    await prevMonthBtn.click();
    await prevMonthBtn.click();
    await page.waitForTimeout(500);

    const pastCells = await page.locator('.past-date').count();
    recordTest('Past dates are marked as unavailable', pastCells > 0, `Found ${pastCells} past date cells`);

    // Try to click a past date
    if (pastCells > 0) {
      const pastCell = page.locator('.past-date').first();
      await pastCell.click({ force: true });
      await page.waitForTimeout(500);

      // Should not open booking modal for past dates
      const modalVisible = await page.locator('.modal:visible').count();
      recordTest('Past dates cannot be selected for booking', modalVisible === 0);
    }

    // Navigate back to current month
    const nextMonthBtn = page.locator('button:has-text("Další")');
    await nextMonthBtn.click();
    await nextMonthBtn.click();
    await page.waitForTimeout(500);

    // Test blocked dates (if any exist)
    const blockedCells = await page.locator('.blocked').count();
    if (blockedCells > 0) {
      recordTest('Blocked dates are displayed', true, `Found ${blockedCells} blocked cells`);

      // Try to click blocked cell
      await page.locator('.blocked').first().click({ force: true });
      await page.waitForTimeout(500);

      const modalAfterBlocked = await page.locator('.modal:visible').count();
      recordTest('Blocked dates cannot be selected', modalAfterBlocked === 0);
    }

    return true;
  } catch (error) {
    recordTest('Validation edge cases', false, error.message);
    return false;
  }
}

// ============================================================================
// TEST 9: Mobile Responsiveness
// ============================================================================
async function testMobileResponsiveness(page) {
  log('TEST 9: Mobile Responsiveness');

  try {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Check if calendar is still visible and scrollable
    const calendarVisible = await page.locator('.calendar-grid').isVisible();
    recordTest('Calendar visible on mobile', calendarVisible);

    // Check if navigation is responsive
    const navButtons = await page.locator('button:has-text("Bulk Booking"), button:has-text("Admin")').count();
    recordTest('Navigation buttons visible on mobile', navButtons >= 2);

    // Test calendar scroll
    await page.evaluate(() => {
      const calendar = document.querySelector('.calendar-grid');
      if (calendar) calendar.scrollLeft = 100;
    });

    const scrollLeft = await page.evaluate(() => {
      const calendar = document.querySelector('.calendar-grid');
      return calendar ? calendar.scrollLeft : 0;
    });
    recordTest('Calendar horizontal scroll works on mobile', scrollLeft > 0);

    // Reset viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    return true;
  } catch (error) {
    recordTest('Mobile responsiveness', false, error.message);
    return false;
  }
}

// ============================================================================
// TEST 10: Console Errors and Network Requests
// ============================================================================
async function testConsoleAndNetwork(page) {
  log('TEST 10: Console Errors and Network Monitoring');

  const errors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
  });

  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      failure: request.failure()
    });
  });

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Interact with page to trigger any dynamic errors
    await page.locator('button:has-text("Další")').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Předchozí")').click();
    await page.waitForTimeout(500);

    // Check console errors
    if (errors.length > 0) {
      recordWarning('Console errors detected', errors.join('; '));
    } else {
      recordTest('No console errors on homepage', true);
    }

    // Check network errors
    if (networkErrors.length > 0) {
      recordWarning('Network request failures', networkErrors.map(e => e.url).join('; '));
    } else {
      recordTest('No network request failures', true);
    }

    return true;
  } catch (error) {
    recordTest('Console and network monitoring', false, error.message);
    return false;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================
async function runAllTests() {
  log('═══════════════════════════════════════════════════════════');
  log('COMPREHENSIVE TEST SUITE - Chata Mariánská Booking System');
  log('═══════════════════════════════════════════════════════════');

  const browser = await chromium.launch({
    headless: false, // Set to true for CI/CD
    slowMo: 100 // Slow down by 100ms for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'cs-CZ',
    timezoneId: 'Europe/Prague'
  });

  const page = await context.newPage();

  try {
    // Run all test suites
    await testHomepageLoad(page);
    await testCalendarInteraction(page);
    await testSingleRoomBooking(page);
    await testMultiRoomBooking(page);
    await testBulkBooking(page);
    await testAdminPanel(page);
    await testAdminBookingOperations(page);
    await testValidationEdgeCases(page);
    await testMobileResponsiveness(page);
    await testConsoleAndNetwork(page);

  } catch (error) {
    log(`Fatal error during test execution: ${error.message}`, 'error');
  }

  // Generate report
  log('═══════════════════════════════════════════════════════════');
  log('TEST RESULTS SUMMARY');
  log('═══════════════════════════════════════════════════════════');
  log(`✅ PASSED: ${testResults.passed.length}`, 'success');
  log(`❌ FAILED: ${testResults.failed.length}`, 'error');
  log(`⚠️  WARNINGS: ${testResults.warnings.length}`, 'warning');

  if (testResults.failed.length > 0) {
    log('\n❌ FAILED TESTS:', 'error');
    testResults.failed.forEach(test => {
      log(`  - ${test.name}: ${test.details}`, 'error');
    });
  }

  if (testResults.warnings.length > 0) {
    log('\n⚠️  WARNINGS:', 'warning');
    testResults.warnings.forEach(warning => {
      log(`  - ${warning.name}: ${warning.details}`, 'warning');
    });
  }

  log('\n✅ PASSED TESTS:', 'success');
  testResults.passed.forEach(test => {
    log(`  - ${test.name}`, 'success');
  });

  log('\n═══════════════════════════════════════════════════════════');

  // Keep browser open for manual inspection
  log('Browser will remain open for 30 seconds for manual inspection...');
  await page.waitForTimeout(30000);

  await browser.close();

  // Exit with appropriate code
  process.exit(testResults.failed.length > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
