/**
 * Quick Price Lock Verification
 */

const Database = require('./database');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'bookings.db');
const db = new Database(dbPath);

console.log('\n=== Price Lock Verification ===\n');

// Check locked bookings
const stats = db.db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN price_locked = 1 THEN 1 ELSE 0 END) as locked,
    SUM(CASE WHEN price_locked = 0 OR price_locked IS NULL THEN 1 ELSE 0 END) as unlocked
  FROM bookings
`).get();

console.log(`Total bookings: ${stats.total}`);
console.log(`Locked: ${stats.locked}`);
console.log(`Unlocked: ${stats.unlocked}`);

if (stats.locked === stats.total) {
  console.log('\n✅ SUCCESS: All bookings are locked\n');
} else {
  console.log(`\n⚠️  WARNING: ${stats.unlocked} bookings are NOT locked\n`);
}
