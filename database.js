const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    const dbDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = path.join(dbDir, 'bookings.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initializeSchema();
    this.prepareStatements();
  }

  initializeSchema() {
    // Create bookings table
    this.db.exec(`
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
                guest_type TEXT NOT NULL,
                adults INTEGER NOT NULL,
                children INTEGER DEFAULT 0,
                toddlers INTEGER DEFAULT 0,
                total_price REAL NOT NULL,
                notes TEXT,
                edit_token TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);

    // Create rooms junction table for many-to-many relationship
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS booking_rooms (
                booking_id TEXT NOT NULL,
                room_id TEXT NOT NULL,
                PRIMARY KEY (booking_id, room_id),
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
            )
        `);

    // Create blocked dates table
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS blocked_dates (
                blockage_id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                room_id TEXT NOT NULL,
                reason TEXT,
                blocked_at TEXT NOT NULL,
                UNIQUE(date, room_id)
            )
        `);

    // Create settings table (key-value store)
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        `);

    // Create rooms configuration table
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                beds INTEGER NOT NULL
            )
        `);

    // Create christmas access codes table
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS christmas_codes (
                code TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            )
        `);

    // Create indexes for performance
    this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);
            CREATE INDEX IF NOT EXISTS idx_blocked_dates ON blocked_dates(date, room_id);
            CREATE INDEX IF NOT EXISTS idx_booking_rooms ON booking_rooms(room_id);
        `);

    // Initialize default settings if not exists
    this.initializeDefaultSettings();
  }

  initializeDefaultSettings() {
    // Check if settings exist
    const settingsCount = this.db.prepare('SELECT COUNT(*) as count FROM settings').get();
    if (settingsCount.count === 0) {
      // Insert default settings
      const insertSetting = this.db.prepare(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
      );

      insertSetting.run('adminPassword', 'admin123');
      insertSetting.run('christmasPeriodStart', '2024-12-23');
      insertSetting.run('christmasPeriodEnd', '2025-01-02');

      // Prices as JSON
      const prices = {
        utia: {
          small: { base: 300, adult: 50, child: 25 },
          large: { base: 400, adult: 50, child: 25 },
        },
        external: {
          small: { base: 500, adult: 100, child: 50 },
          large: { base: 600, adult: 100, child: 50 },
        },
      };
      insertSetting.run('prices', JSON.stringify(prices));
    }

    // Check if rooms exist
    const roomsCount = this.db.prepare('SELECT COUNT(*) as count FROM rooms').get();
    if (roomsCount.count === 0) {
      // Insert default rooms
      const insertRoom = this.db.prepare(
        'INSERT INTO rooms (id, name, type, beds) VALUES (?, ?, ?, ?)'
      );

      insertRoom.run('12', 'Pokoj 12', 'small', 2);
      insertRoom.run('13', 'Pokoj 13', 'small', 3);
      insertRoom.run('14', 'Pokoj 14', 'large', 4);
      insertRoom.run('22', 'Pokoj 22', 'small', 2);
      insertRoom.run('23', 'Pokoj 23', 'small', 3);
      insertRoom.run('24', 'Pokoj 24', 'large', 4);
      insertRoom.run('42', 'Pokoj 42', 'small', 2);
      insertRoom.run('43', 'Pokoj 43', 'small', 2);
      insertRoom.run('44', 'Pokoj 44', 'large', 4);
    }
  }

  prepareStatements() {
    // Prepare commonly used statements
    this.statements = {
      // Bookings
      insertBooking: this.db.prepare(`
                INSERT INTO bookings (
                    id, name, email, phone, company, address, city, zip, ico, dic,
                    start_date, end_date, guest_type, adults, children, toddlers,
                    total_price, notes, edit_token, created_at, updated_at
                ) VALUES (
                    @id, @name, @email, @phone, @company, @address, @city, @zip, @ico, @dic,
                    @start_date, @end_date, @guest_type, @adults, @children, @toddlers,
                    @total_price, @notes, @edit_token, @created_at, @updated_at
                )
            `),

      updateBooking: this.db.prepare(`
                UPDATE bookings SET
                    name = @name, email = @email, phone = @phone,
                    company = @company, address = @address, city = @city,
                    zip = @zip, ico = @ico, dic = @dic,
                    start_date = @start_date, end_date = @end_date,
                    guest_type = @guest_type, adults = @adults,
                    children = @children, toddlers = @toddlers,
                    total_price = @total_price, notes = @notes,
                    updated_at = @updated_at
                WHERE id = @id
            `),

      deleteBooking: this.db.prepare('DELETE FROM bookings WHERE id = ?'),

      getBooking: this.db.prepare('SELECT * FROM bookings WHERE id = ?'),

      getAllBookings: this.db.prepare('SELECT * FROM bookings ORDER BY start_date DESC'),

      // Rooms
      insertBookingRoom: this.db.prepare(
        'INSERT INTO booking_rooms (booking_id, room_id) VALUES (?, ?)'
      ),

      deleteBookingRooms: this.db.prepare('DELETE FROM booking_rooms WHERE booking_id = ?'),

      getBookingRooms: this.db.prepare('SELECT room_id FROM booking_rooms WHERE booking_id = ?'),

      // Blocked dates
      insertBlockedDate: this.db.prepare(`
                INSERT INTO blocked_dates (blockage_id, date, room_id, reason, blocked_at)
                VALUES (?, ?, ?, ?, ?)
            `),

      deleteBlockedDate: this.db.prepare('DELETE FROM blocked_dates WHERE blockage_id = ?'),

      getAllBlockedDates: this.db.prepare('SELECT * FROM blocked_dates'),

      // Settings
      getSetting: this.db.prepare('SELECT value FROM settings WHERE key = ?'),

      setSetting: this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'),

      // Rooms
      getAllRooms: this.db.prepare('SELECT * FROM rooms ORDER BY id'),

      // Christmas codes
      insertChristmasCode: this.db.prepare(
        'INSERT OR REPLACE INTO christmas_codes (code, created_at) VALUES (?, ?)'
      ),

      deleteChristmasCode: this.db.prepare('DELETE FROM christmas_codes WHERE code = ?'),

      getAllChristmasCodes: this.db.prepare('SELECT code FROM christmas_codes'),
    };
  }

  // Booking operations
  createBooking(bookingData) {
    const transaction = this.db.transaction((data) => {
      // Insert booking
      this.statements.insertBooking.run({
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company || null,
        address: data.address || null,
        city: data.city || null,
        zip: data.zip || null,
        ico: data.ico || null,
        dic: data.dic || null,
        start_date: data.startDate,
        end_date: data.endDate,
        guest_type: data.guestType,
        adults: data.adults,
        children: data.children || 0,
        toddlers: data.toddlers || 0,
        total_price: data.totalPrice,
        notes: data.notes || null,
        edit_token: data.editToken,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      });

      // Insert room associations
      if (data.rooms && data.rooms.length > 0) {
        for (const roomId of data.rooms) {
          this.statements.insertBookingRoom.run(data.id, roomId);
        }
      }
    });

    return transaction(bookingData);
  }

  updateBooking(id, bookingData) {
    const transaction = this.db.transaction((id, data) => {
      // Update booking
      this.statements.updateBooking.run({
        id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company || null,
        address: data.address || null,
        city: data.city || null,
        zip: data.zip || null,
        ico: data.ico || null,
        dic: data.dic || null,
        start_date: data.startDate,
        end_date: data.endDate,
        guest_type: data.guestType,
        adults: data.adults,
        children: data.children || 0,
        toddlers: data.toddlers || 0,
        total_price: data.totalPrice,
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
      });

      // Update rooms (delete and re-insert)
      this.statements.deleteBookingRooms.run(id);
      if (data.rooms && data.rooms.length > 0) {
        for (const roomId of data.rooms) {
          this.statements.insertBookingRoom.run(id, roomId);
        }
      }
    });

    return transaction(id, bookingData);
  }

  deleteBooking(id) {
    return this.statements.deleteBooking.run(id);
  }

  getBooking(id) {
    const booking = this.statements.getBooking.get(id);
    if (booking) {
      // Get associated rooms
      const rooms = this.statements.getBookingRooms.all(id).map((r) => r.room_id);

      // Convert snake_case to camelCase
      return {
        id: booking.id,
        name: booking.name,
        email: booking.email,
        phone: booking.phone,
        company: booking.company,
        address: booking.address,
        city: booking.city,
        zip: booking.zip,
        ico: booking.ico,
        dic: booking.dic,
        startDate: booking.start_date,
        endDate: booking.end_date,
        rooms,
        guestType: booking.guest_type,
        adults: booking.adults,
        children: booking.children,
        toddlers: booking.toddlers,
        totalPrice: booking.total_price,
        notes: booking.notes,
        editToken: booking.edit_token,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
      };
    }
    return null;
  }

  getAllBookings() {
    const bookings = this.statements.getAllBookings.all();
    return bookings.map((booking) => {
      const rooms = this.statements.getBookingRooms.all(booking.id).map((r) => r.room_id);

      return {
        id: booking.id,
        name: booking.name,
        email: booking.email,
        phone: booking.phone,
        company: booking.company,
        address: booking.address,
        city: booking.city,
        zip: booking.zip,
        ico: booking.ico,
        dic: booking.dic,
        startDate: booking.start_date,
        endDate: booking.end_date,
        rooms,
        guestType: booking.guest_type,
        adults: booking.adults,
        children: booking.children,
        toddlers: booking.toddlers,
        totalPrice: booking.total_price,
        notes: booking.notes,
        editToken: booking.edit_token,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
      };
    });
  }

  // Blocked dates operations
  createBlockedDate(blockData) {
    return this.statements.insertBlockedDate.run(
      blockData.blockageId,
      blockData.date,
      blockData.roomId,
      blockData.reason || null,
      blockData.blockedAt
    );
  }

  deleteBlockedDate(blockageId) {
    return this.statements.deleteBlockedDate.run(blockageId);
  }

  getAllBlockedDates() {
    const blocked = this.statements.getAllBlockedDates.all();
    return blocked.map((b) => ({
      date: b.date,
      roomId: b.room_id,
      reason: b.reason,
      blockageId: b.blockage_id,
      blockedAt: b.blocked_at,
    }));
  }

  // Settings operations
  getSetting(key) {
    const result = this.statements.getSetting.get(key);
    return result ? result.value : null;
  }

  setSetting(key, value) {
    return this.statements.setSetting.run(key, value);
  }

  getSettings() {
    const settings = {};

    // Get basic settings
    settings.adminPassword = this.getSetting('adminPassword');

    // Get christmas period
    settings.christmasPeriod = {
      start: this.getSetting('christmasPeriodStart'),
      end: this.getSetting('christmasPeriodEnd'),
    };

    // Get christmas access codes
    settings.christmasAccessCodes = this.statements.getAllChristmasCodes.all().map((c) => c.code);

    // Get prices
    const pricesJson = this.getSetting('prices');
    settings.prices = pricesJson ? JSON.parse(pricesJson) : {};

    // Get rooms
    settings.rooms = this.statements.getAllRooms.all();

    return settings;
  }

  updateSettings(settings) {
    const transaction = this.db.transaction((settings) => {
      if (settings.adminPassword) {
        this.setSetting('adminPassword', settings.adminPassword);
      }

      if (settings.christmasPeriod) {
        if (settings.christmasPeriod.start) {
          this.setSetting('christmasPeriodStart', settings.christmasPeriod.start);
        }
        if (settings.christmasPeriod.end) {
          this.setSetting('christmasPeriodEnd', settings.christmasPeriod.end);
        }
      }

      if (settings.prices) {
        this.setSetting('prices', JSON.stringify(settings.prices));
      }

      if (settings.christmasAccessCodes) {
        // Clear existing codes
        this.db.exec('DELETE FROM christmas_codes');

        // Add new codes
        const now = new Date().toISOString();
        for (const code of settings.christmasAccessCodes) {
          this.statements.insertChristmasCode.run(code, now);
        }
      }
    });

    return transaction(settings);
  }

  // Get all data (for compatibility with existing API)
  getAllData() {
    return {
      bookings: this.getAllBookings(),
      blockedDates: this.getAllBlockedDates(),
      settings: this.getSettings(),
    };
  }

  // Check room availability
  getRoomAvailability(roomId, date) {
    // Check for blocked dates
    const blocked = this.db
      .prepare('SELECT * FROM blocked_dates WHERE room_id = ? AND date = ?')
      .get(roomId, date);

    if (blocked) {
      return { available: false, reason: 'blocked' };
    }

    // Check for bookings
    const bookings = this.db
      .prepare(
        `
            SELECT b.* FROM bookings b
            JOIN booking_rooms br ON b.id = br.booking_id
            WHERE br.room_id = ?
            AND ? BETWEEN b.start_date AND b.end_date
        `
      )
      .all(roomId, date);

    if (bookings.length > 0) {
      return { available: false, reason: 'booked', booking: bookings[0] };
    }

    return { available: true };
  }

  // Migrate data from JSON file
  async migrateFromJSON(jsonPath) {
    const fs = require('fs').promises;
    const data = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

    const transaction = this.db.transaction(() => {
      // Migrate bookings
      if (data.bookings && data.bookings.length > 0) {
        for (const booking of data.bookings) {
          this.createBooking({
            ...booking,
            editToken: booking.editToken || this.generateToken(),
            createdAt: booking.createdAt || new Date().toISOString(),
            updatedAt: booking.updatedAt || new Date().toISOString(),
          });
        }
      }

      // Migrate blocked dates
      if (data.blockedDates && data.blockedDates.length > 0) {
        const usedIds = new Set();
        for (const blocked of data.blockedDates) {
          let blockageId = blocked.blockageId || this.generateBlockageId();
          while (usedIds.has(blockageId)) {
            blockageId = this.generateBlockageId();
          }
          usedIds.add(blockageId);

          this.createBlockedDate({
            ...blocked,
            blockageId,
            blockedAt: blocked.blockedAt || new Date().toISOString(),
          });
        }
      }

      // Migrate settings
      if (data.settings) {
        this.updateSettings(data.settings);
      }
    });

    transaction();
    return true;
  }

  generateToken() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  generateBlockageId() {
    return `BLK${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  // Close database connection
  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;
