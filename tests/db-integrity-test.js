#!/usr/bin/env node

/**
 * Database Integrity and Configuration Test
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/bookings.db');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  issues: []
};

function test(condition, description, level = 'error') {
  if (condition) {
    results.passed++;
    log(`✓ ${description}`, 'green');
    return true;
  } else {
    if (level === 'warning') {
      results.warnings++;
      log(`⚠ ${description}`, 'yellow');
      results.issues.push(`[WARNING] ${description}`);
    } else {
      results.failed++;
      log(`✗ ${description}`, 'red');
      results.issues.push(`[ERROR] ${description}`);
    }
    return false;
  }
}

// Main test function
async function runTests() {
  log('\n🧪 DATABASE INTEGRITY AND CONFIGURATION TEST', 'bright');
  log('Starting at: ' + new Date().toISOString(), 'cyan');
  log('Database: ' + DB_PATH, 'cyan');

  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
  } catch (error) {
    log(`❌ Failed to open database: ${error.message}`, 'red');
    process.exit(1);
  }

  try {
    // Test 1: Christmas Period Configuration
    section('1. Christmas Period Configuration');

    const christmasPeriods = db.prepare('SELECT * FROM christmas_periods ORDER BY created_at DESC').all();
    test(christmasPeriods.length > 0, 'Christmas period exists in database');

    if (christmasPeriods.length > 0) {
      const period = christmasPeriods[0];
      log(`   Period ID: ${period.period_id}`, 'cyan');
      log(`   Name: ${period.name}`, 'cyan');
      log(`   Start: ${period.start_date}`, 'cyan');
      log(`   End: ${period.end_date}`, 'cyan');
      log(`   Year: ${period.year}`, 'cyan');

      test(period.start_date && period.start_date.match(/^\d{4}-\d{2}-\d{2}$/),
           'Christmas start date has valid format (YYYY-MM-DD)');
      test(period.end_date && period.end_date.match(/^\d{4}-\d{2}-\d{2}$/),
           'Christmas end date has valid format (YYYY-MM-DD)');

      const startDate = new Date(period.start_date);
      const endDate = new Date(period.end_date);
      test(endDate > startDate, 'Christmas end date is after start date');

      // Check if current Christmas period is for 2024 or 2025
      const currentYear = new Date().getFullYear();
      if (period.year < currentYear) {
        test(false, `Christmas period is outdated (year ${period.year}, current ${currentYear})`, 'warning');
      }
    }

    const christmasCodes = db.prepare('SELECT * FROM christmas_codes').all();
    log(`   Found ${christmasCodes.length} Christmas access codes`, 'cyan');

    // Test 2: Blocked Dates/Blockages
    section('2. Blocked Dates Configuration');

    const blockageInstances = db.prepare('SELECT * FROM blockage_instances').all();
    log(`   Found ${blockageInstances.length} blockage instances`, 'cyan');

    if (blockageInstances.length > 0) {
      for (const blockage of blockageInstances.slice(0, 5)) { // Show first 5
        log(`   - ${blockage.start_date} to ${blockage.end_date}: ${blockage.reason || 'No reason'}`, 'cyan');

        test(blockage.start_date && blockage.start_date.match(/^\d{4}-\d{2}-\d{2}$/),
             `Blockage ${blockage.blockage_id} has valid start date format`);
        test(blockage.end_date && blockage.end_date.match(/^\d{4}-\d{2}-\d{2}$/),
             `Blockage ${blockage.blockage_id} has valid end date format`);

        // Check associated rooms
        const rooms = db.prepare('SELECT * FROM blockage_rooms WHERE blockage_id = ?').all(blockage.blockage_id);
        test(rooms.length > 0, `Blockage ${blockage.blockage_id} has associated rooms (${rooms.length} rooms)`);
      }
    }

    const legacyBlocked = db.prepare('SELECT COUNT(*) as count FROM blocked_dates_legacy').get();
    if (legacyBlocked.count > 0) {
      log(`   ⚠️ Found ${legacyBlocked.count} legacy blocked dates`, 'yellow');
    }

    // Test 3: Rooms Configuration
    section('3. Rooms Configuration');

    const rooms = db.prepare('SELECT * FROM rooms ORDER BY id').all();
    test(rooms.length === 9, `Exactly 9 rooms configured (found ${rooms.length})`);

    const expectedRooms = ['12', '13', '14', '22', '23', '24', '42', '43', '44'];
    for (const expectedId of expectedRooms) {
      const room = rooms.find(r => r.id === expectedId);
      test(room !== undefined, `Room ${expectedId} exists`);
      if (room) {
        test(room.name && room.name.length > 0, `Room ${expectedId} has name: ${room.name}`);
        test(['small', 'large'].includes(room.type), `Room ${expectedId} has valid type: ${room.type}`);
        test(room.beds >= 2 && room.beds <= 4, `Room ${expectedId} has valid bed count: ${room.beds}`);
      }
    }

    // Test 4: Settings
    section('4. Settings Configuration');

    const settings = db.prepare('SELECT * FROM settings').all();
    log(`   Found ${settings.length} settings entries`, 'cyan');

    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
      if (s.key !== 'adminPassword') { // Don't log password
        log(`   - ${s.key}: ${s.value.substring(0, 100)}${s.value.length > 100 ? '...' : ''}`, 'cyan');
      }
    });

    // Parse prices from settings
    if (settingsMap.prices) {
      try {
        const prices = JSON.parse(settingsMap.prices);
        test(prices.utia !== undefined, 'UTIA prices configured');
        test(prices.external !== undefined, 'External prices configured');

        if (prices.utia) {
          test(prices.utia.small !== undefined, 'UTIA small room prices configured');
          test(prices.utia.large !== undefined, 'UTIA large room prices configured');

          if (prices.utia.small) {
            log(`   UTIA Small: Empty=${prices.utia.small.empty}, Adult=${prices.utia.small.adult}, Child=${prices.utia.small.child}`, 'cyan');
          }
          if (prices.utia.large) {
            log(`   UTIA Large: Empty=${prices.utia.large.empty}, Adult=${prices.utia.large.adult}, Child=${prices.utia.large.child}`, 'cyan');
          }
        }

        if (prices.external) {
          if (prices.external.small) {
            log(`   External Small: Empty=${prices.external.small.empty}, Adult=${prices.external.small.adult}, Child=${prices.external.small.child}`, 'cyan');
          }
          if (prices.external.large) {
            log(`   External Large: Empty=${prices.external.large.empty}, Adult=${prices.external.large.adult}, Child=${prices.external.large.child}`, 'cyan');
          }
        }
      } catch (e) {
        test(false, `Failed to parse prices JSON: ${e.message}`);
      }
    }

    // Test 5: Bookings
    section('5. Bookings Data Integrity');

    const bookings = db.prepare('SELECT * FROM bookings').all();
    log(`   Found ${bookings.length} bookings`, 'cyan');

    const recentBookings = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 10').all();

    for (const booking of recentBookings) {
      // Check required fields
      test(booking.id && booking.id.length > 0, `Booking ${booking.id}: Has ID`);
      test(booking.name && booking.name.length > 0, `Booking ${booking.id}: Has name`);
      test(booking.email && booking.email.includes('@'), `Booking ${booking.id}: Has valid email`);
      test(booking.start_date && booking.start_date.match(/^\d{4}-\d{2}-\d{2}$/),
           `Booking ${booking.id}: Valid start date`);
      test(booking.end_date && booking.end_date.match(/^\d{4}-\d{2}-\d{2}$/),
           `Booking ${booking.id}: Valid end date`);
      test(booking.edit_token && booking.edit_token.length === 30,
           `Booking ${booking.id}: Has edit token (${booking.edit_token.length} chars)`);

      // Check associated rooms
      const bookingRooms = db.prepare('SELECT * FROM booking_rooms WHERE booking_id = ?').all(booking.id);
      test(bookingRooms.length > 0, `Booking ${booking.id}: Has rooms (${bookingRooms.length})`);

      // Check guest names
      const guestNames = db.prepare('SELECT * FROM guest_names WHERE booking_id = ?').all(booking.id);
      const totalGuests = (booking.adults || 0) + (booking.children || 0);

      if (totalGuests > 0) {
        test(guestNames.length > 0,
             `Booking ${booking.id}: Has guest names (${guestNames.length} names for ${totalGuests} guests)`,
             'warning');
      }
    }

    // Test 6: Orphaned Records
    section('6. Orphaned Records Check');

    const orphanedBookingRooms = db.prepare(`
      SELECT br.* FROM booking_rooms br
      LEFT JOIN bookings b ON br.booking_id = b.id
      WHERE b.id IS NULL
    `).all();
    test(orphanedBookingRooms.length === 0,
         `No orphaned booking_rooms (found ${orphanedBookingRooms.length})`);

    const orphanedGuestNames = db.prepare(`
      SELECT gn.* FROM guest_names gn
      LEFT JOIN bookings b ON gn.booking_id = b.id
      WHERE b.id IS NULL
    `).all();
    test(orphanedGuestNames.length === 0,
         `No orphaned guest_names (found ${orphanedGuestNames.length})`);

    const orphanedProposedRooms = db.prepare(`
      SELECT pbr.* FROM proposed_booking_rooms pbr
      LEFT JOIN proposed_bookings pb ON pbr.proposal_id = pb.proposal_id
      WHERE pb.proposal_id IS NULL
    `).all();
    test(orphanedProposedRooms.length === 0,
         `No orphaned proposed_booking_rooms (found ${orphanedProposedRooms.length})`);

    // Test 7: Proposed Bookings
    section('7. Proposed Bookings (Temporary Reservations)');

    const now = new Date().toISOString();
    const activeProposals = db.prepare('SELECT * FROM proposed_bookings WHERE expires_at > ?').all(now);
    const expiredProposals = db.prepare('SELECT * FROM proposed_bookings WHERE expires_at <= ?').all(now);

    log(`   Active proposals: ${activeProposals.length}`, 'cyan');
    log(`   Expired proposals: ${expiredProposals.length}`, 'cyan');

    if (expiredProposals.length > 0) {
      test(false,
           `Found ${expiredProposals.length} expired proposals that should be cleaned up`,
           'warning');
    }

    for (const proposal of activeProposals) {
      const created = new Date(proposal.created_at);
      const expires = new Date(proposal.expires_at);
      const diffMinutes = (expires - created) / (1000 * 60);

      test(diffMinutes >= 14 && diffMinutes <= 16,
           `Proposal ${proposal.proposal_id}: Has ~15 min expiration (${diffMinutes.toFixed(1)} min)`,
           'warning');
    }

    // Test 8: Admin Sessions
    section('8. Admin Sessions');

    const activeSessions = db.prepare('SELECT * FROM admin_sessions WHERE expires_at > ?').all(now);
    const expiredSessions = db.prepare('SELECT * FROM admin_sessions WHERE expires_at <= ?').all(now);

    log(`   Active admin sessions: ${activeSessions.length}`, 'cyan');
    log(`   Expired admin sessions: ${expiredSessions.length}`, 'cyan');

  } catch (error) {
    log(`\n❌ Test execution error: ${error.message}`, 'red');
    console.error(error);
    results.failed++;
  } finally {
    db.close();
  }

  // Summary
  section('TEST SUMMARY');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Warnings: ${results.warnings}`, results.warnings > 0 ? 'yellow' : 'green');
  log(`Total: ${results.passed + results.failed + results.warnings}`, 'cyan');

  if (results.issues.length > 0) {
    console.log('\n' + '='.repeat(60));
    log('ISSUES FOUND:', 'red');
    console.log('='.repeat(60));
    results.issues.forEach((issue, index) => {
      log(`${index + 1}. ${issue}`, issue.startsWith('[WARNING]') ? 'yellow' : 'red');
    });
  }

  log('\nCompleted at: ' + new Date().toISOString(), 'cyan');

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
