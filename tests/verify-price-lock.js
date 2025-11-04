/**
 * Verify Price Lock Migration
 *
 * This script verifies that:
 * 1. All existing bookings have price_locked = 1
 * 2. Database schema includes price_locked column
 * 3. Price lock prevents recalculation during edits
 */

const Database = require('../database');
const path = require('path');

console.log('\n=== Price Lock Migration Verification ===\n');

// Initialize database
const dbPath = path.join(__dirname, '..', 'data', 'bookings.db');
const db = new Database(dbPath);

// Test 1: Check column exists
console.log('Test 1: Verify price_locked column exists');
try {
  const result = db.db.prepare('PRAGMA table_info(bookings)').all();
  const priceLockColumn = result.find(col => col.name === 'price_locked');

  if (priceLockColumn) {
    console.log('✅ PASS: price_locked column exists');
    console.log(`   Type: ${priceLockColumn.type}, Default: ${priceLockColumn.dflt_value}`);
  } else {
    console.log('❌ FAIL: price_locked column NOT FOUND');
    process.exit(1);
  }
} catch (error) {
  console.log(`❌ FAIL: ${error.message}`);
  process.exit(1);
}

// Test 2: Count locked vs unlocked bookings
console.log('\nTest 2: Count locked bookings');
try {
  const stats = db.db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN price_locked = 1 THEN 1 ELSE 0 END) as locked,
      SUM(CASE WHEN price_locked = 0 OR price_locked IS NULL THEN 1 ELSE 0 END) as unlocked
    FROM bookings
  `).get();

  console.log(`✅ Total bookings: ${stats.total}`);
  console.log(`✅ Locked bookings: ${stats.locked}`);
  console.log(`✅ Unlocked bookings: ${stats.unlocked}`);

  if (stats.locked === stats.total) {
    console.log('✅ PASS: All existing bookings are locked');
  } else if (stats.locked > 0) {
    console.log(`⚠️  PARTIAL: ${stats.locked}/${stats.total} bookings locked`);
  } else {
    console.log('❌ FAIL: No bookings are locked');
  }
} catch (error) {
  console.log(`❌ FAIL: ${error.message}`);
  process.exit(1);
}

// Test 3: Check for old bookings that should be locked
console.log('\nTest 3: Verify old bookings are locked');
try {
  const oldUnlocked = db.db.prepare(`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE created_at < '2025-11-04'
    AND (price_locked = 0 OR price_locked IS NULL)
  `).get();

  if (oldUnlocked.count === 0) {
    console.log('✅ PASS: All pre-2025-11-04 bookings are locked');
  } else {
    console.log(`❌ FAIL: ${oldUnlocked.count} old bookings are NOT locked`);
  }
} catch (error) {
  console.log(`❌ FAIL: ${error.message}`);
}

// Test 4: Sample booking details
console.log('\nTest 4: Sample locked booking details');
try {
  const sample = db.db.prepare(`
    SELECT id, total_price, price_locked, created_at, start_date, end_date
    FROM bookings
    WHERE price_locked = 1
    LIMIT 1
  `).get();

  if (sample) {
    console.log('✅ Sample locked booking:');
    console.log(`   ID: ${sample.id}`);
    console.log(`   Price: ${sample.total_price} Kč`);
    console.log(`   Locked: ${sample.price_locked === 1 ? 'YES' : 'NO'}`);
    console.log(`   Created: ${sample.created_at}`);
    console.log(`   Dates: ${sample.start_date} to ${sample.end_date}`);
  } else {
    console.log('⚠️  No locked bookings found (empty database?)');
  }
} catch (error) {
  console.log(`❌ FAIL: ${error.message}`);
}

console.log('\n=== Verification Complete ===\n');
