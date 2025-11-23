/**
 * Manual Test: Christmas Period Access Code Logic
 *
 * This test verifies that the Christmas access code requirement is correctly
 * enforced based on the date rules documented in CLAUDE.md.
 */

const ChristmasUtils = require('../../js/shared/christmasUtils.js');

// Test scenarios
const scenarios = [
  {
    name: 'Scenario 1: Christmas 23.12.2025 - 2.1.2026, Today: 4.4.2025 (BEFORE Oct 1)',
    today: new Date('2025-04-04'),
    christmasPeriodStart: '2025-12-23',
    christmasPeriodEnd: '2026-01-02',
    isBulkBooking: false,
    expectedCodeRequired: true,
    expectedBulkBlocked: false,
    reason: 'Before Sept 30, 2025 → Code REQUIRED',
  },
  {
    name: 'Scenario 2: Christmas 23.12.2025 - 2.1.2026, Today: 30.9.2025 23:59 (EXACTLY at cutoff)',
    today: new Date('2025-09-30T23:59:59'),
    christmasPeriodStart: '2025-12-23',
    christmasPeriodEnd: '2026-01-02',
    isBulkBooking: false,
    expectedCodeRequired: true,
    expectedBulkBlocked: false,
    reason: 'At cutoff (inclusive) → Code REQUIRED',
  },
  {
    name: 'Scenario 3: Christmas 23.12.2025 - 2.1.2026, Today: 1.10.2025 (AFTER Oct 1) - SINGLE ROOM',
    today: new Date('2025-10-01T00:00:01'),
    christmasPeriodStart: '2025-12-23',
    christmasPeriodEnd: '2026-01-02',
    isBulkBooking: false,
    expectedCodeRequired: false,
    expectedBulkBlocked: false,
    reason: 'After Sept 30, 2025, single room → Code NOT required',
  },
  {
    name: 'Scenario 4: Christmas 23.12.2025 - 2.1.2026, Today: 1.10.2025 (AFTER Oct 1) - BULK BOOKING',
    today: new Date('2025-10-01T00:00:01'),
    christmasPeriodStart: '2025-12-23',
    christmasPeriodEnd: '2026-01-02',
    isBulkBooking: true,
    expectedCodeRequired: false,
    expectedBulkBlocked: true,
    reason: 'After Sept 30, 2025, bulk booking → Bulk BLOCKED',
  },
  {
    name: 'Scenario 5: Christmas 4.1.2026 - 3.3.2026, Today: 15.9.2025 (BEFORE Oct 1 of Christmas year)',
    today: new Date('2025-09-15'),
    christmasPeriodStart: '2026-01-04',
    christmasPeriodEnd: '2026-03-03',
    isBulkBooking: false,
    expectedCodeRequired: true,
    expectedBulkBlocked: false,
    reason: 'Before Sept 30, 2026 → Code REQUIRED (Christmas year is 2026)',
  },
  {
    name: 'Scenario 6: Christmas 4.1.2026 - 3.3.2026, Today: 15.10.2025 (Still BEFORE Oct 1 of 2026!)',
    today: new Date('2025-10-15'),
    christmasPeriodStart: '2026-01-04',
    christmasPeriodEnd: '2026-03-03',
    isBulkBooking: false,
    expectedCodeRequired: true,
    expectedBulkBlocked: false,
    reason: 'Before Sept 30, 2026 → Code REQUIRED (cutoff is in 2026, not 2025!)',
  },
  {
    name: 'Scenario 7: Christmas 4.1.2026 - 3.3.2026, Today: 15.10.2026 (AFTER Oct 1 of Christmas year) - SINGLE',
    today: new Date('2026-10-15'),
    christmasPeriodStart: '2026-01-04',
    christmasPeriodEnd: '2026-03-03',
    isBulkBooking: false,
    expectedCodeRequired: false,
    expectedBulkBlocked: false,
    reason: 'After Sept 30, 2026, single room → Code NOT required',
  },
  {
    name: 'Scenario 8: Christmas 4.1.2026 - 3.3.2026, Today: 15.10.2026 (AFTER Oct 1 of Christmas year) - BULK',
    today: new Date('2026-10-15'),
    christmasPeriodStart: '2026-01-04',
    christmasPeriodEnd: '2026-03-03',
    isBulkBooking: true,
    expectedCodeRequired: false,
    expectedBulkBlocked: true,
    reason: 'After Sept 30, 2026, bulk booking → Bulk BLOCKED',
  },
];

// Run tests
console.log('\n========================================');
console.log('CHRISTMAS ACCESS CODE LOGIC VERIFICATION');
console.log('========================================\n');

let passed = 0;
let failed = 0;

scenarios.forEach((scenario, index) => {
  console.log(`\nTest ${index + 1}: ${scenario.name}`);
  console.log(
    `  Christmas Period: ${scenario.christmasPeriodStart} - ${scenario.christmasPeriodEnd}`
  );
  console.log(
    `  Today: ${scenario.today.toISOString().split('T')[0]} ${scenario.today.toTimeString().split(' ')[0]}`
  );
  console.log(`  Bulk Booking: ${scenario.isBulkBooking ? 'YES' : 'NO'}`);
  console.log(`  Reason: ${scenario.reason}`);

  const result = ChristmasUtils.checkChristmasAccessRequirement(
    scenario.today,
    scenario.christmasPeriodStart,
    scenario.isBulkBooking
  );

  const codeMatch = result.codeRequired === scenario.expectedCodeRequired;
  const bulkMatch = result.bulkBlocked === scenario.expectedBulkBlocked;
  const success = codeMatch && bulkMatch;

  console.log(
    `  Expected: codeRequired=${scenario.expectedCodeRequired}, bulkBlocked=${scenario.expectedBulkBlocked}`
  );
  console.log(`  Actual:   codeRequired=${result.codeRequired}, bulkBlocked=${result.bulkBlocked}`);
  console.log(`  Result: ${success ? '✅ PASS' : '❌ FAIL'}`);

  if (success) {
    passed += 1;
  } else {
    failed += 1;
    if (!codeMatch) {
      console.log(
        `    ❌ codeRequired mismatch: expected ${scenario.expectedCodeRequired}, got ${result.codeRequired}`
      );
    }
    if (!bulkMatch) {
      console.log(
        `    ❌ bulkBlocked mismatch: expected ${scenario.expectedBulkBlocked}, got ${result.bulkBlocked}`
      );
    }
  }
});

console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`Total tests: ${scenarios.length}`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ${failed > 0 ? '❌' : '✅'}`);
console.log('========================================\n');

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
