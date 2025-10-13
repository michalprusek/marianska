#!/usr/bin/env node

const DatabaseManager = require('./database');

const db = new DatabaseManager();

// Create a test blockage for October 20-25, 2025
const testBlockage = {
  startDate: '2025-10-20',
  endDate: '2025-10-25',
  rooms: ['12', '13'],
  reason: 'TEST: Multi-day blockage',
};

console.log('Creating test blockage:');
console.log(`  Start: ${testBlockage.startDate}`);
console.log(`  End: ${testBlockage.endDate}`);
console.log(`  Rooms: ${testBlockage.rooms.join(', ')}`);
console.log(`  Reason: ${testBlockage.reason}\n`);

try {
  const result = db.createBlockageInstance(testBlockage);
  console.log('✓ Blockage created successfully!');
  console.log(`  Blockage ID: ${result.blockageId}\n`);

  // Verify it was stored correctly
  console.log('Verifying storage...');
  const allBlockages = db.getAllBlockageInstances();
  const newBlockage = allBlockages.find((b) => b.blockageId === result.blockageId);

  if (newBlockage) {
    console.log('✓ Blockage found in database:');
    console.log(`  Start Date: ${newBlockage.startDate}`);
    console.log(`  End Date: ${newBlockage.endDate}`);
    console.log(`  Rooms: ${newBlockage.rooms.join(', ')}`);
    console.log(`  Reason: ${newBlockage.reason}`);

    // Check if interval is preserved
    if (
      newBlockage.startDate === testBlockage.startDate &&
      newBlockage.endDate === testBlockage.endDate
    ) {
      console.log('\n✅ SUCCESS: Interval preserved correctly!');
    } else {
      console.log('\n❌ FAILED: Interval collapsed!');
      console.log(`   Expected: ${testBlockage.startDate} - ${testBlockage.endDate}`);
      console.log(`   Got: ${newBlockage.startDate} - ${newBlockage.endDate}`);
    }
  } else {
    console.log('❌ Blockage not found after creation!');
  }
} catch (error) {
  console.error('❌ Error creating blockage:', error.message);
} finally {
  db.close();
}
