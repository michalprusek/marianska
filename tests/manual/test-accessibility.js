#!/usr/bin/env node
/**
 * Accessibility and ARIA attributes test
 * Tests the language checkbox and other accessibility features
 */

const puppeteer = require('puppeteer');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function testAccessibility() {
  console.log('🚀 Starting accessibility testing...\n');

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

  const errors = [];
  const warnings = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') {
      errors.push(text);
    } else if (type === 'warning') {
      warnings.push(text);
    }
  });

  page.on('pageerror', (error) => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  try {
    console.log('📄 Loading http://localhost...');
    await page.goto('http://localhost', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    console.log('✅ Page loaded\n');

    // Test 1: Language switch accessibility
    console.log('🧪 Test 1: Language switch accessibility attributes...');
    const langSwitchAttrs = await page.evaluate(() => {
      const checkbox = document.getElementById('languageSwitch');
      const label = checkbox?.parentElement;

      if (!checkbox) return { error: 'Checkbox not found' };

      return {
        id: checkbox.id,
        role: checkbox.getAttribute('role'),
        ariaChecked: checkbox.getAttribute('aria-checked'),
        ariaLabel: checkbox.getAttribute('aria-label'),
        checked: checkbox.checked,
        labelFor: label?.getAttribute('for'),
        labelAriaLabel: label?.getAttribute('aria-label'),
      };
    });

    console.log('Language switch attributes:');
    console.log(JSON.stringify(langSwitchAttrs, null, 2));
    console.log('');

    // Validate ARIA attributes
    const ariaIssues = [];
    if (langSwitchAttrs.role !== 'switch') {
      ariaIssues.push('Missing or incorrect role="switch"');
    }
    if (!langSwitchAttrs.ariaChecked) {
      ariaIssues.push('Missing aria-checked attribute');
    }
    if (!langSwitchAttrs.ariaLabel && !langSwitchAttrs.labelAriaLabel) {
      ariaIssues.push('Missing aria-label on checkbox or label');
    }
    if (!langSwitchAttrs.labelFor) {
      ariaIssues.push('Missing for attribute on label');
    }

    if (ariaIssues.length === 0) {
      console.log('✅ All ARIA attributes present\n');
    } else {
      console.log('❌ ARIA issues found:');
      ariaIssues.forEach((issue) => console.log(`  - ${issue}`));
      console.log('');
      errors.push(...ariaIssues);
    }

    // Test 2: Try to change language and check ARIA state update
    console.log('🧪 Test 2: Language switch state change...');
    try {
      const initialState = await page.evaluate(() => {
        const checkbox = document.getElementById('languageSwitch');
        return {
          checked: checkbox.checked,
          ariaChecked: checkbox.getAttribute('aria-checked'),
        };
      });
      console.log('Initial state:', initialState);

      // Use evaluate to click the checkbox directly (bypass styling issues)
      await page.evaluate(() => {
        const checkbox = document.getElementById('languageSwitch');
        checkbox.click();
      });

      await delay(1000);

      const newState = await page.evaluate(() => {
        const checkbox = document.getElementById('languageSwitch');
        return {
          checked: checkbox.checked,
          ariaChecked: checkbox.getAttribute('aria-checked'),
        };
      });
      console.log('New state:', newState);

      // Check if aria-checked was updated
      if (initialState.ariaChecked !== newState.ariaChecked) {
        console.log('✅ aria-checked attribute updated correctly\n');
      } else {
        console.log('❌ aria-checked attribute NOT updated\n');
        errors.push('aria-checked not updated on language switch');
      }

      // Check if checked state changed
      if (initialState.checked !== newState.checked) {
        console.log('✅ Checkbox state changed correctly\n');
      } else {
        console.log('❌ Checkbox state NOT changed\n');
        errors.push('Checkbox state not changed on click');
      }
    } catch (err) {
      console.log(`❌ Language switch error: ${err.message}\n`);
      errors.push(`Language switch error: ${err.message}`);
    }

    // Test 3: Check other accessibility features
    console.log('🧪 Test 3: Other accessibility features...');
    const a11yFeatures = await page.evaluate(() => {
      const results = {};

      // Check for alt text on images
      const images = Array.from(document.querySelectorAll('img'));
      results.imagesWithoutAlt = images.filter((img) => !img.alt).map((img) => img.src);

      // Check for form labels
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      results.inputsWithoutLabels = inputs
        .filter((input) => {
          if (input.type === 'hidden' || input.type === 'submit') return false;
          const id = input.id;
          if (!id) return true;
          const label = document.querySelector(`label[for="${id}"]`);
          return !label && !input.getAttribute('aria-label');
        })
        .map((input) => ({
          id: input.id,
          type: input.type,
          name: input.name,
        }));

      return results;
    });

    if (a11yFeatures.imagesWithoutAlt.length > 0) {
      console.log(`⚠️  Found ${a11yFeatures.imagesWithoutAlt.length} images without alt text`);
      warnings.push(`${a11yFeatures.imagesWithoutAlt.length} images without alt text`);
    } else {
      console.log('✅ All images have alt text');
    }

    if (a11yFeatures.inputsWithoutLabels.length > 0) {
      console.log(`⚠️  Found ${a11yFeatures.inputsWithoutLabels.length} inputs without labels`);
      warnings.push(`${a11yFeatures.inputsWithoutLabels.length} inputs without labels`);
    } else {
      console.log('✅ All inputs have labels');
    }
    console.log('');

    await delay(1000);
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    errors.push(`TEST ERROR: ${error.message}`);
  }

  await browser.close();

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 ACCESSIBILITY TEST RESULTS');
  console.log('='.repeat(60) + '\n');

  if (errors.length === 0) {
    console.log('✅ NO CRITICAL ISSUES FOUND!\n');
  } else {
    console.log(`❌ FOUND ${errors.length} CRITICAL ISSUE(S):\n`);
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

  process.exit(errors.length > 0 ? 1 : 0);
}

testAccessibility().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
