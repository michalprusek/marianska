#!/usr/bin/env node

/* eslint-disable no-implicit-globals, no-param-reassign, no-promise-executor-return, no-plusplus, no-console, no-continue */

/**
 * Migration Script: Add Guest Names to Existing Bookings
 *
 * This script generates random Czech names for existing bookings
 * that don't have guest names yet. It matches the number of adults
 * and children in each booking.
 *
 * Usage: node scripts/migrate-guest-names.js
 */

const path = require('path');
const DatabaseManager = require(path.join(__dirname, '..', 'database.js'));

// Czech first names
const CZECH_FIRST_NAMES = {
  male: [
    'Jan',
    'Petr',
    'Josef',
    'Pavel',
    'Martin',
    'Tomáš',
    'Jaroslav',
    'Jiří',
    'Miroslav',
    'František',
    'Václav',
    'Karel',
    'Milan',
    'Michal',
    'Lukáš',
    'Jakub',
    'David',
    'Ondřej',
    'Marek',
    'Adam',
    'Aleš',
    'Daniel',
    'Filip',
    'Matěj',
    'Vojtěch',
    'Radek',
    'Stanislav',
    'Vlastimil',
    'Zdeněk',
    'Roman',
  ],
  female: [
    'Marie',
    'Jana',
    'Eva',
    'Hana',
    'Anna',
    'Lenka',
    'Kateřina',
    'Petra',
    'Lucie',
    'Martina',
    'Věra',
    'Alena',
    'Zuzana',
    'Ivana',
    'Monika',
    'Jitka',
    'Barbora',
    'Tereza',
    'Veronika',
    'Markéta',
    'Kristýna',
    'Michaela',
    'Pavla',
    'Simona',
    'Andrea',
    'Nikola',
    'Klára',
    'Eliška',
    'Adéla',
    'Natálie',
  ],
  children: [
    'Jakub',
    'Jan',
    'Tomáš',
    'Matěj',
    'Adam',
    'Lukáš',
    'Filip',
    'Vojtěch',
    'David',
    'Martin',
    'Ondřej',
    'Marek',
    'Daniel',
    'Petr',
    'Pavel',
    'Tereza',
    'Anna',
    'Eliška',
    'Natálie',
    'Karolína',
    'Adéla',
    'Kristýna',
    'Barbora',
    'Lucie',
    'Klára',
    'Veronika',
    'Aneta',
    'Nikola',
    'Sofie',
    'Emma',
  ],
};

// Czech last names (gender-neutral base forms)
const CZECH_LAST_NAMES = [
  'Novák',
  'Svoboda',
  'Novotný',
  'Dvořák',
  'Černý',
  'Procházka',
  'Kučera',
  'Veselý',
  'Horák',
  'Němec',
  'Marek',
  'Pospíšil',
  'Hájek',
  'Král',
  'Jelínek',
  'Růžička',
  'Beneš',
  'Fiala',
  'Sedláček',
  'Doležal',
  'Zeman',
  'Kolář',
  'Navrátil',
  'Čermák',
  'Urban',
  'Vaněk',
  'Blažek',
  'Krejčí',
  'Bartošek',
  'Vlček',
  'Říha',
  'Kovář',
  'Malý',
  'Polák',
  'Musil',
  'Šimek',
  'Kopecký',
  'Holub',
  'Moravec',
  'Konečný',
  'Bartoš',
  'Vítek',
  'Šťastný',
  'Šmejkal',
];

/**
 * Get random element from array
 */
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random Czech name
 * @param {string} type - 'adult' or 'child'
 * @param {string} gender - 'male' or 'female' (optional, will be random if not provided)
 * @returns {{firstName: string, lastName: string}}
 */
function generateCzechName(type = 'adult', gender = null) {
  // Randomly choose gender if not specified
  if (!gender) {
    gender = Math.random() < 0.5 ? 'male' : 'female';
  }

  let firstName;
  if (type === 'child') {
    firstName = getRandomElement(CZECH_FIRST_NAMES.children);
  } else {
    firstName = getRandomElement(CZECH_FIRST_NAMES[gender]);
  }

  const lastName = getRandomElement(CZECH_LAST_NAMES);

  // Add feminine suffix to last names for females (if needed)
  const feminineLastName =
    gender === 'female' && !lastName.endsWith('ová') ? `${lastName}ová` : lastName;

  return {
    firstName,
    lastName: feminineLastName,
  };
}

/**
 * Generate guest names for a booking
 * @param {number} adultsCount - Number of adults
 * @param {number} childrenCount - Number of children
 * @returns {Array} Array of guest name objects
 */
function generateGuestNames(adultsCount, childrenCount) {
  const guestNames = [];

  // Generate adult names
  for (let i = 0; i < adultsCount; i++) {
    const name = generateCzechName('adult');
    guestNames.push({
      personType: 'adult',
      firstName: name.firstName,
      lastName: name.lastName,
    });
  }

  // Generate child names
  for (let i = 0; i < childrenCount; i++) {
    const name = generateCzechName('child');
    guestNames.push({
      personType: 'child',
      firstName: name.firstName,
      lastName: name.lastName,
    });
  }

  return guestNames;
}

/**
 * Main migration function
 */
async function migrateGuestNames() {
  console.log('='.repeat(60));
  console.log('Guest Names Migration Script');
  console.log('='.repeat(60));
  console.log();

  try {
    // Initialize database
    const dbPath = path.join(__dirname, '..', 'data', 'bookings.db');
    console.log(`📂 Connecting to database: ${dbPath}`);
    const db = new DatabaseManager(dbPath);
    console.log('✅ Database connected successfully');
    console.log();

    // Get all bookings
    const bookings = db.getAllBookings();
    console.log(`📊 Found ${bookings.length} total bookings`);

    if (bookings.length === 0) {
      console.log('ℹ️  No bookings found. Nothing to migrate.');
      return;
    }

    // Filter bookings that need migration
    const bookingsNeedingMigration = [];
    for (const booking of bookings) {
      // FIX: Use correct method from database.js prepared statements
      const guestNames = db.statements.getGuestNamesByBooking.all(booking.id);
      if (!guestNames || guestNames.length === 0) {
        bookingsNeedingMigration.push(booking);
      }
    }

    console.log(`🔍 Bookings needing migration: ${bookingsNeedingMigration.length}`);
    console.log();

    if (bookingsNeedingMigration.length === 0) {
      console.log('✅ All bookings already have guest names. No migration needed.');
      return;
    }

    // Ask for confirmation
    console.log('⚠️  WARNING: This will add random Czech names to existing bookings.');
    console.log('   This operation cannot be easily undone.');
    console.log();
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    console.log();

    // Wait 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('🚀 Starting migration...');
    console.log();

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const booking of bookingsNeedingMigration) {
      try {
        const adultsCount = booking.adults || 0;
        const childrenCount = booking.children || 0;
        const totalGuests = adultsCount + childrenCount;

        console.log(`📝 Migrating booking ${booking.id}:`);
        console.log(`   - Adults: ${adultsCount}, Children: ${childrenCount}`);

        if (totalGuests === 0) {
          console.log('   ⏭️  Skipping (no guests)');
          console.log();
          continue;
        }

        // Generate guest names
        const guestNames = generateGuestNames(adultsCount, childrenCount);

        // Insert guest names using prepared statement
        const now = new Date().toISOString();
        for (let i = 0; i < guestNames.length; i++) {
          const guest = guestNames[i];
          db.statements.insertGuestName.run(
            booking.id,
            guest.personType,
            guest.firstName,
            guest.lastName,
            i + 1, // order_index
            now
          );
        }

        console.log(`   ✅ Added ${guestNames.length} guest names`);
        console.log(
          `   👥 Names: ${guestNames.map((g) => `${g.firstName} ${g.lastName}`).join(', ')}`
        );
        console.log();
        successCount++;
      } catch (error) {
        console.error(`   ❌ Error migrating booking ${booking.id}:`, error.message);
        console.log();
        errorCount++;
        errors.push({ bookingId: booking.id, error: error.message });
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${successCount} bookings`);
    console.log(`❌ Failed: ${errorCount} bookings`);
    console.log(`📊 Total processed: ${successCount + errorCount} bookings`);
    console.log();

    if (errors.length > 0) {
      console.log('Errors:');
      errors.forEach(({ bookingId, error }) => {
        console.log(`  - Booking ${bookingId}: ${error}`);
      });
      console.log();
    }

    console.log('✅ Migration completed!');
    console.log();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateGuestNames()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { generateCzechName, generateGuestNames, migrateGuestNames };
