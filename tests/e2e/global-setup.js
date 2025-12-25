/**
 * Playwright Global Setup
 * Creates a fresh test database before running E2E tests
 * This ensures tests never affect the production database
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const TEST_DB_PATH = path.join(__dirname, '../../data/test-bookings.db');

async function globalSetup() {
  console.log('\n🧪 Setting up E2E test environment...');

  // Remove existing test database
  for (const ext of ['', '-shm', '-wal']) {
    const filePath = TEST_DB_PATH + ext;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`  ✓ Removed ${path.basename(filePath)}`);
    }
  }

  // Create fresh test database with schema
  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create bookings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      company TEXT,
      address TEXT,
      city TEXT,
      zip TEXT,
      ico TEXT,
      dic TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_price REAL NOT NULL,
      notes TEXT,
      edit_token TEXT NOT NULL,
      is_bulk_booking INTEGER DEFAULT 0,
      paid INTEGER DEFAULT 0,
      pay_from_benefit INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create booking_rooms table
  db.exec(`
    CREATE TABLE IF NOT EXISTS booking_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      UNIQUE(booking_id, room_id)
    )
  `);

  // Create guest_names table (SSOT for guest types)
  db.exec(`
    CREATE TABLE IF NOT EXISTS guest_names (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      person_type TEXT NOT NULL CHECK(person_type IN ('adult', 'child', 'toddler')),
      guest_type TEXT NOT NULL DEFAULT 'utia' CHECK(guest_type IN ('utia', 'external')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `);

  // Create blocked_dates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS blocked_dates (
      id TEXT PRIMARY KEY,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      room_id TEXT NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    )
  `);

  // Create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Create proposed_bookings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS proposed_bookings (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_booking_rooms_booking ON booking_rooms(booking_id);
    CREATE INDEX IF NOT EXISTS idx_booking_rooms_room ON booking_rooms(room_id);
    CREATE INDEX IF NOT EXISTS idx_guest_names_booking ON guest_names(booking_id);
    CREATE INDEX IF NOT EXISTS idx_blocked_dates_dates ON blocked_dates(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);

  // Insert default settings
  const adminHash = bcrypt.hashSync('admin123', 10);
  const defaultSettings = [
    ['adminPassword', adminHash],
    ['contactEmail', 'test@example.com'],
    [
      'prices',
      JSON.stringify({
        utia: { adults: 250, children: 150, toddlers: 0, emptyRoom: 500 },
        external: { adults: 500, children: 300, toddlers: 0, emptyRoom: 500 },
      }),
    ],
    [
      'rooms',
      JSON.stringify([
        { id: '12', name: 'Pokoj 12', capacity: 4 },
        { id: '13', name: 'Pokoj 13', capacity: 4 },
        { id: '14', name: 'Pokoj 14', capacity: 4 },
      ]),
    ],
    [
      'emailTemplate',
      JSON.stringify({
        subject: 'Potvrzení rezervace - Chata Mariánská',
        body: 'Děkujeme za Vaši rezervaci.',
      }),
    ],
    ['adminEmails', JSON.stringify(['admin@example.com'])],
    ['cabinManagerEmails', JSON.stringify([])],
    ['christmasPeriods', JSON.stringify([])],
    ['christmasAccessCodes', JSON.stringify([])],
  ];

  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }

  db.close();
  console.log(`  ✓ Created fresh test database: ${path.basename(TEST_DB_PATH)}`);
  console.log('  ✓ Initialized schema and default settings');
  console.log('🚀 E2E test environment ready!\n');
}

module.exports = globalSetup;
