#!/usr/bin/env node

// Test the full admin flow: admin.js -> data.js -> database.js

const DateUtils = require('./js/shared/dateUtils');

// Simulate what happens in admin.js AFTER the fix
const startDate = '2025-10-20'; // From HTML form input
const endDate = '2025-10-25'; // From HTML form input

console.log('=== Testing Admin Flow ===\n');
console.log('1. Admin panel receives dates from form:');
console.log(`   startDate: "${startDate}" (${typeof startDate})`);
console.log(`   endDate: "${endDate}" (${typeof endDate})`);

// Simulate what data.js does (line 714-715)
console.log('\n2. DataManager.createBlockageInstance() calls formatDate():');
const formattedStart = DateUtils.formatDate(startDate);
const formattedEnd = DateUtils.formatDate(endDate);
console.log(`   formatted startDate: "${formattedStart}"`);
console.log(`   formatted endDate: "${formattedEnd}"`);

// Check if the interval is preserved
if (formattedStart === startDate && formattedEnd === endDate) {
  console.log('\n✅ SUCCESS: Date interval preserved correctly!');
  console.log(`   Interval: ${formattedStart} to ${formattedEnd}`);
} else {
  console.log('\n❌ FAILED: Date interval was modified!');
  console.log(`   Expected: ${startDate} to ${endDate}`);
  console.log(`   Got: ${formattedStart} to ${formattedEnd}`);
}

// Test edge case: What if someone passes Date objects (old behavior)?
console.log('\n3. Testing backward compatibility with Date objects:');
const oldStartDate = new Date(startDate);
const oldEndDate = new Date(endDate);
console.log(`   old startDate: ${oldStartDate} (${typeof oldStartDate})`);
console.log(`   old endDate: ${oldEndDate} (${typeof oldEndDate})`);

const oldFormattedStart = DateUtils.formatDate(oldStartDate);
const oldFormattedEnd = DateUtils.formatDate(oldEndDate);
console.log(`   formatted: "${oldFormattedStart}" to "${oldFormattedEnd}"`);

if (oldFormattedStart === startDate && oldFormattedEnd === endDate) {
  console.log('   ✅ Backward compatibility OK');
} else {
  console.log('   ⚠️  Date objects may cause timezone issues');
  console.log(`   Expected: ${startDate} to ${endDate}`);
  console.log(`   Got: ${oldFormattedStart} to ${oldFormattedEnd}`);
}

console.log('\n=== Test Complete ===\n');
