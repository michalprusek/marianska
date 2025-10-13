#!/usr/bin/env node

const DatabaseManager = require('./database');

const db = new DatabaseManager();

console.log('=== Current Blockage Instances in Database ===\n');

const blockages = db.getAllBlockageInstances();

if (blockages.length === 0) {
  console.log('No blockages found in database.\n');
} else {
  blockages.forEach((b, index) => {
    console.log(`${index + 1}. Blockage ID: ${b.blockageId}`);
    console.log(`   Start Date: ${b.startDate}`);
    console.log(`   End Date: ${b.endDate}`);
    console.log(`   Reason: ${b.reason || 'No reason'}`);
    console.log(`   Rooms: ${b.rooms.length > 0 ? b.rooms.join(', ') : 'All rooms'}`);
    console.log(`   Created: ${b.createdAt}\n`);
  });
}

db.close();
