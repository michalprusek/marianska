#!/usr/bin/env node

/**
 * Mobile Responsiveness Test Script
 *
 * Tests critical mobile functionality without requiring browser automation.
 * Run this in browser console on http://chata.utia.cas.cz
 *
 * Usage:
 * 1. Open http://chata.utia.cas.cz in Chrome
 * 2. Open DevTools (F12)
 * 3. Toggle Device Mode (Ctrl+Shift+M)
 * 4. Select mobile device (iPhone SE, Samsung S20, etc.)
 * 5. Paste this entire script into Console
 * 6. Review results
 */

(function () {
  console.clear();
  console.log(
    '%c🧪 MOBILE RESPONSIVENESS TEST SUITE',
    'color: #007aff; font-size: 20px; font-weight: bold'
  );
  console.log('%c════════════════════════════════════', 'color: #007aff');
  console.log('');

  const results = {
    passed: [],
    failed: [],
    warnings: [],
  };

  function pass(test, message) {
    results.passed.push({ test, message });
    console.log('%c✓ PASS', 'color: green; font-weight: bold', test, message || '');
  }

  function fail(test, message, expected, actual) {
    results.failed.push({ test, message, expected, actual });
    console.log('%c✗ FAIL', 'color: red; font-weight: bold', test);
    console.log('  Expected:', expected);
    console.log('  Actual:', actual);
    if (message) console.log('  Note:', message);
  }

  function warn(test, message) {
    results.warnings.push({ test, message });
    console.log('%c⚠ WARN', 'color: orange; font-weight: bold', test, message);
  }

  // ============================================================
  // TEST 1: Viewport & Device Detection
  // ============================================================
  console.log('\n%c📱 TEST 1: Viewport & Device Detection', 'color: #007aff; font-weight: bold');
  console.log('─────────────────────────────────');

  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    ratio: window.devicePixelRatio,
  };

  console.log('Viewport:', viewport);
  console.log('User Agent:', navigator.userAgent);
  console.log('Touch support:', 'ontouchstart' in window);

  if (viewport.width <= 768) {
    pass('Viewport', `Mobile viewport detected: ${viewport.width}px`);
  } else {
    warn('Viewport', `Desktop viewport: ${viewport.width}px - switch to mobile emulation`);
  }

  // ============================================================
  // TEST 2: CSS Loading
  // ============================================================
  console.log('\n%c🎨 TEST 2: CSS Files Loading', 'color: #007aff; font-weight: bold');
  console.log('─────────────────────────────────');

  const stylesheets = Array.from(document.styleSheets)
    .map((sheet) => sheet.href)
    .filter((href) => href);

  const hasUnifiedCSS = stylesheets.some((href) => href.includes('styles-unified.css'));
  const hasMobileCSS = stylesheets.some((href) => href.includes('mobile-improvements.css'));

  if (hasUnifiedCSS) {
    pass('CSS Loading', 'styles-unified.css loaded');
  } else {
    fail('CSS Loading', 'Missing styles-unified.css', 'loaded', 'not found');
  }

  if (hasMobileCSS) {
    pass('CSS Loading', 'mobile-improvements.css loaded');
  } else {
    fail('CSS Loading', 'Missing mobile-improvements.css', 'loaded', 'not found');
  }

  console.log('Loaded stylesheets:', stylesheets.length);

  // ============================================================
  // TEST 3: Touch Target Sizes
  // ============================================================
  console.log(
    '\n%c👆 TEST 3: Touch Target Sizes (min 44x44px)',
    'color: #007aff; font-weight: bold'
  );
  console.log('─────────────────────────────────');

  const MIN_TOUCH_SIZE = 44;

  const touchTargets = [
    { selector: '#roomInfoBtn', name: 'Room Info Button' },
    { selector: '#bulkActionBtn', name: 'Bulk Booking Button' },
    { selector: '.modal-close', name: 'Modal Close Button' },
    { selector: '.counter-btn', name: 'Guest Counter Button' },
    { selector: '.nav-btn', name: 'Navigation Button' },
  ];

  touchTargets.forEach((target) => {
    const element = document.querySelector(target.selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (width >= MIN_TOUCH_SIZE && height >= MIN_TOUCH_SIZE) {
        pass(`Touch Target: ${target.name}`, `${Math.round(width)}x${Math.round(height)}px`);
      } else {
        fail(
          `Touch Target: ${target.name}`,
          'Too small for touch',
          `≥${MIN_TOUCH_SIZE}x${MIN_TOUCH_SIZE}px`,
          `${Math.round(width)}x${Math.round(height)}px`
        );
      }
    } else {
      warn(`Touch Target: ${target.name}`, 'Element not found (may not be visible yet)');
    }
  });

  // ============================================================
  // TEST 4: Font Sizes (Readability)
  // ============================================================
  console.log(
    '\n%c📝 TEST 4: Font Sizes (min 14px for readability)',
    'color: #007aff; font-weight: bold'
  );
  console.log('─────────────────────────────────');

  const textElements = [
    { selector: '.logo', name: 'Logo', minSize: 16 },
    { selector: '.btn', name: 'Button Text', minSize: 14 },
    { selector: '.calendar-day-number', name: 'Calendar Day Number', minSize: 12 },
    { selector: '.room-indicator', name: 'Room Indicator', minSize: 9 },
    { selector: 'input', name: 'Form Input', minSize: 16 }, // 16px prevents iOS zoom
  ];

  textElements.forEach((item) => {
    const element = document.querySelector(item.selector);
    if (element) {
      const fontSize = parseFloat(window.getComputedStyle(element).fontSize);

      if (fontSize >= item.minSize) {
        pass(`Font Size: ${item.name}`, `${fontSize}px`);
      } else {
        fail(`Font Size: ${item.name}`, 'Too small', `≥${item.minSize}px`, `${fontSize}px`);
      }
    } else {
      warn(`Font Size: ${item.name}`, 'Element not found');
    }
  });

  // ============================================================
  // TEST 5: Horizontal Scrolling (CRITICAL)
  // ============================================================
  console.log('\n%c↔ TEST 5: Horizontal Scrolling', 'color: #007aff; font-weight: bold');
  console.log('─────────────────────────────────');

  const bodyWidth = document.body.scrollWidth;
  const windowWidth = window.innerWidth;

  if (bodyWidth <= windowWidth) {
    pass('Horizontal Scroll', 'No horizontal overflow detected');
  } else {
    fail(
      'Horizontal Scroll',
      'Page has horizontal overflow',
      `width ≤ ${windowWidth}px`,
      `${bodyWidth}px`
    );

    // Find elements causing overflow
    console.log('%c🔍 Elements wider than viewport:', 'color: orange');
    Array.from(document.querySelectorAll('*')).forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > windowWidth) {
        console.log(`  - ${el.tagName}.${el.className}:`, `${Math.round(rect.width)}px`);
      }
    });
  }

  // ============================================================
  // TEST 6: Modal Functionality
  // ============================================================
  console.log('\n%c🪟 TEST 6: Modal Functionality', 'color: #007aff; font-weight: bold');
  console.log('─────────────────────────────────');

  const modals = document.querySelectorAll('.modal');
  console.log(`Found ${modals.length} modal(s)`);

  modals.forEach((modal, index) => {
    const closeBtn = modal.querySelector('.modal-close');
    const modalContent = modal.querySelector('.modal-content');

    if (closeBtn) {
      const rect = closeBtn.getBoundingClientRect();
      if (rect.width >= 44 && rect.height >= 44) {
        pass(
          `Modal ${index + 1} Close Button`,
          `${Math.round(rect.width)}x${Math.round(rect.height)}px`
        );
      } else {
        fail(
          `Modal ${index + 1} Close Button`,
          'Too small',
          '≥44x44px',
          `${Math.round(rect.width)}x${Math.round(rect.height)}px`
        );
      }
    }

    if (modalContent) {
      const maxHeight =
        modalContent.style.maxHeight || window.getComputedStyle(modalContent).maxHeight;
      const overflow = window.getComputedStyle(modalContent).overflowY;

      if (overflow === 'auto' || overflow === 'scroll') {
        pass(`Modal ${index + 1} Content`, `Scrollable (overflow: ${overflow})`);
      } else if (viewport.height < 600) {
        warn(`Modal ${index + 1} Content`, `Not scrollable on small screen (${viewport.height}px)`);
      }
    }
  });

  // ============================================================
  // TEST 7: Form Input Focus (iOS Zoom Prevention)
  // ============================================================
  console.log(
    '\n%c⌨️ TEST 7: Form Input Focus (iOS Zoom Prevention)',
    'color: #007aff; font-weight: bold'
  );
  console.log('─────────────────────────────────');

  const inputs = document.querySelectorAll('input, textarea, select');
  let zoomPreventionCount = 0;

  inputs.forEach((input) => {
    const fontSize = parseFloat(window.getComputedStyle(input).fontSize);
    if (fontSize >= 16) {
      zoomPreventionCount++;
    }
  });

  if (zoomPreventionCount === inputs.length) {
    pass('iOS Zoom Prevention', `All ${inputs.length} inputs are ≥16px`);
  } else {
    warn(
      'iOS Zoom Prevention',
      `${inputs.length - zoomPreventionCount}/${inputs.length} inputs < 16px (may cause zoom on iOS)`
    );
  }

  // ============================================================
  // TEST 8: Calendar Rendering
  // ============================================================
  console.log('\n%c📅 TEST 8: Calendar Rendering', 'color: #007aff; font-weight: bold');
  console.log('─────────────────────────────────');

  const calendarDays = document.querySelectorAll('.calendar-day');
  const calendarGrid = document.querySelector('.calendar-grid');

  if (calendarDays.length > 0) {
    pass('Calendar Rendering', `${calendarDays.length} days rendered`);

    // Check if days are properly sized
    const firstDay = calendarDays[0];
    const dayRect = firstDay.getBoundingClientRect();

    if (dayRect.height >= 40) {
      // Min height for mobile (line 118 in CSS)
      pass('Calendar Day Size', `${Math.round(dayRect.height)}px height`);
    } else {
      fail('Calendar Day Size', 'Too small', '≥40px', `${Math.round(dayRect.height)}px`);
    }

    // Check room indicators
    const roomIndicators = firstDay.querySelectorAll('.room-indicator');
    if (roomIndicators.length > 0) {
      const indicatorFontSize = parseFloat(window.getComputedStyle(roomIndicators[0]).fontSize);
      console.log(`  Room indicators: ${roomIndicators.length}, font-size: ${indicatorFontSize}px`);
    }
  } else {
    warn('Calendar Rendering', 'No calendar days found');
  }

  if (calendarGrid) {
    const gridWidth = calendarGrid.getBoundingClientRect().width;
    if (gridWidth <= windowWidth) {
      pass('Calendar Width', 'Fits in viewport');
    } else {
      fail('Calendar Width', 'Overflows viewport', `≤${windowWidth}px`, `${gridWidth}px`);
    }
  }

  // ============================================================
  // TEST 9: Performance Check
  // ============================================================
  console.log('\n%c⚡ TEST 9: Performance Check', 'color: #007aff; font-weight: bold');
  console.log('─────────────────────────────────');

  // Check DOM size
  const domElements = document.querySelectorAll('*').length;
  console.log(`DOM elements: ${domElements}`);

  if (domElements < 1500) {
    pass('DOM Size', `${domElements} elements (good)`);
  } else if (domElements < 3000) {
    warn('DOM Size', `${domElements} elements (acceptable)`);
  } else {
    warn('DOM Size', `${domElements} elements (may impact performance)`);
  }

  // Check for memory leaks (event listeners)
  const elementsWithListeners = document.querySelectorAll('[onclick]').length;
  console.log(`Elements with inline onclick: ${elementsWithListeners}`);

  if (elementsWithListeners === 0) {
    pass('Event Listeners', 'No inline onclick handlers (good practice)');
  } else {
    warn('Event Listeners', `${elementsWithListeners} inline onclick handlers found`);
  }

  // ============================================================
  // TEST 10: Accessibility
  // ============================================================
  console.log('\n%c♿ TEST 10: Accessibility', 'color: #007aff; font-weight: bold');
  console.log('─────────────────────────────────');

  // Check for alt text on images
  const images = document.querySelectorAll('img');
  let missingAlt = 0;
  images.forEach((img) => {
    if (!img.alt) missingAlt++;
  });

  if (missingAlt === 0 && images.length > 0) {
    pass('Image Alt Text', `All ${images.length} images have alt text`);
  } else if (images.length === 0) {
    console.log('  No images found');
  } else {
    warn('Image Alt Text', `${missingAlt}/${images.length} images missing alt text`);
  }

  // Check for ARIA labels
  const ariaLabels = document.querySelectorAll('[aria-label]').length;
  console.log(`Elements with aria-label: ${ariaLabels}`);

  if (ariaLabels > 0) {
    pass('ARIA Labels', `${ariaLabels} elements have aria-label`);
  } else {
    warn('ARIA Labels', 'No aria-labels found');
  }

  // Check focus indicators
  const focusableElements = document.querySelectorAll(
    'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  console.log(`Focusable elements: ${focusableElements.length}`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log(
    '\n%c═══════════════════════════════════════════════',
    'color: #007aff; font-weight: bold'
  );
  console.log('%c📊 TEST SUMMARY', 'color: #007aff; font-size: 18px; font-weight: bold');
  console.log(
    '%c═══════════════════════════════════════════════',
    'color: #007aff; font-weight: bold'
  );
  console.log('');

  const total = results.passed.length + results.failed.length + results.warnings.length;
  const passRate = ((results.passed.length / total) * 100).toFixed(1);

  console.log(`%c✓ PASSED: ${results.passed.length}`, 'color: green; font-weight: bold');
  console.log(`%c✗ FAILED: ${results.failed.length}`, 'color: red; font-weight: bold');
  console.log(`%c⚠ WARNINGS: ${results.warnings.length}`, 'color: orange; font-weight: bold');
  console.log(
    `%cPass Rate: ${passRate}%`,
    `color: ${passRate >= 80 ? 'green' : 'orange'}; font-weight: bold`
  );
  console.log('');

  if (results.failed.length > 0) {
    console.log('%c❌ CRITICAL ISSUES:', 'color: red; font-weight: bold; font-size: 14px');
    results.failed.forEach((item, index) => {
      console.log(`${index + 1}. ${item.test}`);
      console.log(`   Expected: ${item.expected}`);
      console.log(`   Actual: ${item.actual}`);
    });
    console.log('');
  }

  if (results.warnings.length > 0 && results.warnings.length <= 5) {
    console.log('%c⚠️ WARNINGS:', 'color: orange; font-weight: bold; font-size: 14px');
    results.warnings.forEach((item, index) => {
      console.log(`${index + 1}. ${item.test}: ${item.message}`);
    });
    console.log('');
  }

  console.log('%c💡 RECOMMENDATIONS:', 'color: blue; font-weight: bold; font-size: 14px');

  if (viewport.width > 768) {
    console.log('  - Switch to mobile emulation (Ctrl+Shift+M) for accurate testing');
  }

  if (results.failed.length > 0) {
    console.log('  - Fix critical issues before deploying to production');
  }

  if (results.warnings.length > 5) {
    console.log('  - Review warnings for potential UX improvements');
  }

  console.log('  - Run Lighthouse audit for comprehensive performance check');
  console.log('  - Test on real devices (iPhone, Android) for final validation');
  console.log('  - Check console for any JavaScript errors');
  console.log('');

  console.log(
    '%c═══════════════════════════════════════════════',
    'color: #007aff; font-weight: bold'
  );
  console.log('%c✨ Test completed! Review results above.', 'color: #007aff');
  console.log(
    '%c═══════════════════════════════════════════════',
    'color: #007aff; font-weight: bold'
  );
  console.log('');

  // Return results object for programmatic access
  return {
    summary: {
      total,
      passed: results.passed.length,
      failed: results.failed.length,
      warnings: results.warnings.length,
      passRate: parseFloat(passRate),
    },
    details: results,
    viewport,
  };
})();
