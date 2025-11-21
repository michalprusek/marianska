const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const IdGenerator = require('./js/shared/idGenerator');
const DateUtils = require('./js/shared/dateUtils');
const { logger } = require('./js/shared/logger');

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
    // CRITICAL FIX 2025-10-07: Add WAL autocheckpoint to prevent unbounded WAL growth
    this.db.pragma('wal_autocheckpoint = 1000'); // Checkpoint every 1000 pages (~4MB)

    // CRITICAL FIX: Verify foreign keys are actually enabled
    const fkEnabled = this.db.pragma('foreign_keys', { simple: true });
    if (!fkEnabled) {
      throw new Error('Failed to enable foreign key constraints!');
    }

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

    // Create rooms junction table for many-to-many relationship with per-room dates
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS booking_rooms (
                booking_id TEXT NOT NULL,
                room_id TEXT NOT NULL,
                start_date TEXT,
                end_date TEXT,
                PRIMARY KEY (booking_id, room_id),
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
            )
        `);

    // Migration: Add per-room columns if they don't exist
    const tableInfo = this.db.pragma('table_info(booking_rooms)');
    const hasStartDate = tableInfo.some((col) => col.name === 'start_date');
    const hasEndDate = tableInfo.some((col) => col.name === 'end_date');
    const hasAdults = tableInfo.some((col) => col.name === 'adults');
    const hasChildren = tableInfo.some((col) => col.name === 'children');
    const hasToddlers = tableInfo.some((col) => col.name === 'toddlers');
    const hasGuestType = tableInfo.some((col) => col.name === 'guest_type');

    if (!hasStartDate) {
      this.db.exec(`ALTER TABLE booking_rooms ADD COLUMN start_date TEXT`);
    }
    if (!hasEndDate) {
      this.db.exec(`ALTER TABLE booking_rooms ADD COLUMN end_date TEXT`);
    }
    if (!hasAdults) {
      this.db.exec(`ALTER TABLE booking_rooms ADD COLUMN adults INTEGER DEFAULT 1`);
    }
    if (!hasChildren) {
      this.db.exec(`ALTER TABLE booking_rooms ADD COLUMN children INTEGER DEFAULT 0`);
    }
    if (!hasToddlers) {
      this.db.exec(`ALTER TABLE booking_rooms ADD COLUMN toddlers INTEGER DEFAULT 0`);
    }
    if (!hasGuestType) {
      this.db.exec(`ALTER TABLE booking_rooms ADD COLUMN guest_type TEXT DEFAULT 'external'`);
    }

    // Create blockage instances table - ONE row per blockage action
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS blockage_instances (
                blockage_id TEXT PRIMARY KEY,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                reason TEXT,
                created_at TEXT NOT NULL
            )
        `);

    // Create blockage rooms table - which rooms are blocked for each instance
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS blockage_rooms (
                blockage_id TEXT NOT NULL,
                room_id TEXT NOT NULL,
                PRIMARY KEY (blockage_id, room_id),
                FOREIGN KEY (blockage_id) REFERENCES blockage_instances(blockage_id) ON DELETE CASCADE
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

    // Create christmas periods table
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS christmas_periods (
                period_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                year INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(start_date, end_date)
            )
        `);

    // Create proposed bookings table for temporary reservations
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS proposed_bookings (
                proposal_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                adults INTEGER DEFAULT 0,
                children INTEGER DEFAULT 0,
                toddlers INTEGER DEFAULT 0,
                guest_type TEXT DEFAULT 'external',
                total_price INTEGER DEFAULT 0
            )
        `);

    // Add new columns if they don't exist (for existing databases)
    const addColumnIfNotExists = (table, column, type, defaultVal = null) => {
      try {
        const defaultClause = defaultVal === null ? '' : ` DEFAULT ${defaultVal}`;
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${defaultClause}`);
      } catch (err) {
        // Column already exists, ignore error
        if (err.message.includes('duplicate column name')) {
          // Ignore - column already exists
        } else {
          throw err;
        }
      }
    };

    addColumnIfNotExists('proposed_bookings', 'adults', 'INTEGER', 0);
    addColumnIfNotExists('proposed_bookings', 'children', 'INTEGER', 0);
    addColumnIfNotExists('proposed_bookings', 'toddlers', 'INTEGER', 0);
    addColumnIfNotExists('proposed_bookings', 'guest_type', 'TEXT', "'external'");
    addColumnIfNotExists('proposed_bookings', 'total_price', 'INTEGER', 0);

    // Add paid status column to bookings table if it doesn't exist
    addColumnIfNotExists('bookings', 'paid', 'INTEGER', 0);

    // Add pay_from_benefit column to bookings table if it doesn't exist
    addColumnIfNotExists('bookings', 'pay_from_benefit', 'INTEGER', 0);

    // Add per_room_guests column to bookings table if it doesn't exist (JSON format)
    addColumnIfNotExists('bookings', 'per_room_guests', 'TEXT', null);

    // Add price_locked column to bookings table if it doesn't exist (for new pricing model)
    // This prevents existing bookings from recalculating with the new "empty room" pricing formula
    addColumnIfNotExists('bookings', 'price_locked', 'INTEGER', 0);

    // Migration: Lock prices for all existing bookings (one-time migration)
    try {
      const existingBookings = this.db
        .prepare(
          'SELECT COUNT(*) as count FROM bookings WHERE price_locked = 0 OR price_locked IS NULL'
        )
        .get();

      if (existingBookings.count > 0) {
        const updated = this.db
          .prepare(
            'UPDATE bookings SET price_locked = 1 WHERE price_locked = 0 OR price_locked IS NULL'
          )
          .run();

        if (updated.changes > 0) {
          logger.info(`Locked prices for ${updated.changes} existing bookings`, {
            component: 'Migration',
          });
        }
      }
    } catch (error) {
      // Column might not exist yet, or migration already completed - safe to ignore
      if (!error.message.includes('no such column')) {
        console.error('[Migration] Price lock migration error:', error.message);
      }
    }

    // Create proposed booking rooms table
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS proposed_booking_rooms (
                proposal_id TEXT NOT NULL,
                room_id TEXT NOT NULL,
                FOREIGN KEY (proposal_id) REFERENCES proposed_bookings(proposal_id) ON DELETE CASCADE,
                PRIMARY KEY (proposal_id, room_id)
            )
        `);

    // Create indexes for proposed bookings
    this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_proposed_bookings_dates ON proposed_bookings(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_proposed_bookings_expires ON proposed_bookings(expires_at);
            CREATE INDEX IF NOT EXISTS idx_proposed_booking_rooms ON proposed_booking_rooms(room_id);
        `);

    // Create guest names table for storing individual guest information
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS guest_names (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id TEXT NOT NULL,
                person_type TEXT NOT NULL CHECK(person_type IN ('adult', 'child', 'toddler')),
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                order_index INTEGER NOT NULL,
                room_id TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                UNIQUE(booking_id, person_type, order_index)
            )
        `);

    // Migration: Add room_id column if it doesn't exist (for existing databases)
    try {
      const columns = this.db.prepare('PRAGMA table_info(guest_names)').all();
      const hasRoomId = columns.some((col) => col.name === 'room_id');

      if (!hasRoomId) {
        this.db.exec('ALTER TABLE guest_names ADD COLUMN room_id TEXT');
      }
    } catch (error) {
      // Table might not exist yet, or column already added - safe to ignore
    }

    // Migration: Add guest_type column if it doesn't exist (NEW 2025-11-04: per-guest pricing)
    try {
      const columns = this.db.prepare('PRAGMA table_info(guest_names)').all();
      const hasGuestTypeColumn = columns.some((col) => col.name === 'guest_type');

      if (!hasGuestTypeColumn) {
        this.db.exec('ALTER TABLE guest_names ADD COLUMN guest_type TEXT DEFAULT NULL');
        logger.info('Added guest_type column to guest_names table for per-guest pricing support', {
          component: 'Database',
        });
      }
    } catch (_error) {
      // Column might already exist - safe to ignore
    }

    // Create indexes for guest names performance
    try {
      this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_guest_names_booking ON guest_names(booking_id);
            CREATE INDEX IF NOT EXISTS idx_guest_names_type ON guest_names(booking_id, person_type);
        `);

      // Only create room_id index if column exists
      const columns = this.db.prepare('PRAGMA table_info(guest_names)').all();
      const hasRoomId = columns.some((col) => col.name === 'room_id');
      if (hasRoomId) {
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_guest_names_room ON guest_names(booking_id, room_id);
        `);
      }
    } catch (error) {
      // Index creation failed - safe to ignore
    }

    // Create admin sessions table for persistent session storage
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS admin_sessions (
                session_token TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                last_activity TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                user_agent TEXT,
                ip_address TEXT
            )
        `);

    // Create index for session expiration cleanup
    this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
        `);

    // Create audit logs table for tracking booking changes
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                log_id TEXT PRIMARY KEY,
                booking_id TEXT NOT NULL,
                action_type TEXT NOT NULL CHECK(action_type IN ('room_added', 'room_removed', 'room_restored', 'booking_created', 'booking_updated', 'booking_deleted')),
                user_type TEXT NOT NULL CHECK(user_type IN ('user', 'admin')),
                user_identifier TEXT,
                room_id TEXT,
                before_state TEXT,
                after_state TEXT,
                change_details TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
            )
        `);

    // Create indexes for audit logs
    this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_booking ON audit_logs(booking_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_room ON audit_logs(room_id);
        `);

    // Create all indexes for performance - AFTER all tables are created
    this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);
            CREATE INDEX IF NOT EXISTS idx_blockage_dates ON blockage_instances(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_blockage_rooms ON blockage_rooms(blockage_id, room_id);
            CREATE INDEX IF NOT EXISTS idx_blockage_rooms_room_id ON blockage_rooms(room_id);
            CREATE INDEX IF NOT EXISTS idx_booking_rooms ON booking_rooms(room_id);
            CREATE INDEX IF NOT EXISTS idx_booking_rooms_booking_id ON booking_rooms(booking_id);
            CREATE INDEX IF NOT EXISTS idx_christmas_periods ON christmas_periods(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_proposed_bookings_session ON proposed_bookings(session_id);
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

      // Individual room prices (NEW 2025-11-06: Fixed to match documentation)
      // Empty room = room with 0 guests, then add per-guest charges
      const prices = {
        utia: {
          small: {
            empty: 250, // Empty small room base price
            adult: 50, // Per adult
            child: 25, // Per child (3-17 years)
          },
          large: {
            empty: 350, // Empty large room base price
            adult: 70, // Per adult
            child: 35, // Per child (3-17 years)
          },
        },
        external: {
          small: {
            empty: 400, // Empty small room base price
            adult: 100, // Per adult
            child: 50, // Per child (3-17 years)
          },
          large: {
            empty: 500, // Empty large room base price
            adult: 120, // Per adult
            child: 60, // Per child (3-17 years)
          },
        },
      };
      insertSetting.run('prices', JSON.stringify(prices));

      // Bulk booking prices
      const bulkPrices = {
        basePrice: 2000,
        utiaAdult: 100,
        utiaChild: 0,
        externalAdult: 250,
        externalChild: 50,
      };
      insertSetting.run('bulkPrices', JSON.stringify(bulkPrices));
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
                    total_price, notes, paid, pay_from_benefit, per_room_guests, edit_token, created_at, updated_at
                ) VALUES (
                    @id, @name, @email, @phone, @company, @address, @city, @zip, @ico, @dic,
                    @start_date, @end_date, @guest_type, @adults, @children, @toddlers,
                    @total_price, @notes, @paid, @pay_from_benefit, @per_room_guests, @edit_token, @created_at, @updated_at
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
                    paid = @paid, pay_from_benefit = @pay_from_benefit,
                    per_room_guests = @per_room_guests,
                    updated_at = @updated_at
                WHERE id = @id
            `),

      deleteBooking: this.db.prepare('DELETE FROM bookings WHERE id = ?'),

      getBooking: this.db.prepare('SELECT * FROM bookings WHERE id = ?'),

      getAllBookings: this.db.prepare('SELECT * FROM bookings ORDER BY start_date DESC'),

      // Rooms (with per-room dates and guest data)
      insertBookingRoom: this.db.prepare(
        'INSERT INTO booking_rooms (booking_id, room_id, start_date, end_date, adults, children, toddlers, guest_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ),

      deleteBookingRooms: this.db.prepare('DELETE FROM booking_rooms WHERE booking_id = ?'),

      getBookingRooms: this.db.prepare(
        'SELECT room_id, start_date, end_date, adults, children, toddlers, guest_type FROM booking_rooms WHERE booking_id = ?'
      ),

      // Blockage instances
      insertBlockageInstance: this.db.prepare(`
                INSERT INTO blockage_instances (blockage_id, start_date, end_date, reason, created_at)
                VALUES (?, ?, ?, ?, ?)
            `),

      insertBlockageRoom: this.db.prepare(`
                INSERT INTO blockage_rooms (blockage_id, room_id)
                VALUES (?, ?)
            `),

      deleteBlockageInstance: this.db.prepare(
        'DELETE FROM blockage_instances WHERE blockage_id = ?'
      ),

      getAllBlockageInstances: this.db.prepare(`
                SELECT bi.*, GROUP_CONCAT(br.room_id) as room_ids
                FROM blockage_instances bi
                LEFT JOIN blockage_rooms br ON bi.blockage_id = br.blockage_id
                GROUP BY bi.blockage_id
                ORDER BY bi.start_date DESC
            `),

      getBlockageInstance: this.db.prepare(`
                SELECT bi.*, GROUP_CONCAT(br.room_id) as room_ids
                FROM blockage_instances bi
                LEFT JOIN blockage_rooms br ON bi.blockage_id = br.blockage_id
                WHERE bi.blockage_id = ?
                GROUP BY bi.blockage_id
            `),

      getBlockageRooms: this.db.prepare('SELECT room_id FROM blockage_rooms WHERE blockage_id = ?'),

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

      // Christmas periods
      insertChristmasPeriod: this.db.prepare(`
        INSERT INTO christmas_periods (period_id, name, start_date, end_date, year, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),

      updateChristmasPeriod: this.db.prepare(`
        UPDATE christmas_periods SET
          name = ?, start_date = ?, end_date = ?, year = ?, updated_at = ?
        WHERE period_id = ?
      `),

      deleteChristmasPeriod: this.db.prepare('DELETE FROM christmas_periods WHERE period_id = ?'),

      getChristmasPeriod: this.db.prepare('SELECT * FROM christmas_periods WHERE period_id = ?'),

      getAllChristmasPeriods: this.db.prepare(
        'SELECT * FROM christmas_periods ORDER BY start_date'
      ),

      // Proposed bookings
      insertProposedBooking: this.db.prepare(`
        INSERT INTO proposed_bookings (proposal_id, session_id, start_date, end_date, created_at, expires_at, adults, children, toddlers, guest_type, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      insertProposedBookingRoom: this.db.prepare(
        'INSERT INTO proposed_booking_rooms (proposal_id, room_id) VALUES (?, ?)'
      ),

      deleteProposedBooking: this.db.prepare('DELETE FROM proposed_bookings WHERE proposal_id = ?'),

      deleteExpiredProposedBookings: this.db.prepare(
        'DELETE FROM proposed_bookings WHERE expires_at < ?'
      ),

      getProposedBookingsByDateRange: this.db.prepare(`
        SELECT pb.*, pbr.room_id
        FROM proposed_bookings pb
        JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
        WHERE pb.start_date <= ? AND pb.end_date >= ?
          AND pb.expires_at > ?
      `),

      getProposedBookingsBySession: this.db.prepare(`
        SELECT * FROM proposed_bookings
        WHERE session_id = ? AND expires_at > ?
      `),

      deleteProposedBookingsBySession: this.db.prepare(
        'DELETE FROM proposed_bookings WHERE session_id = ?'
      ),

      // Guest names
      insertGuestName: this.db.prepare(`
        INSERT INTO guest_names (booking_id, person_type, first_name, last_name, order_index, room_id, guest_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),

      deleteGuestNamesByBooking: this.db.prepare('DELETE FROM guest_names WHERE booking_id = ?'),

      getGuestNamesByBooking: this.db.prepare(`
        SELECT person_type, first_name, last_name, order_index, room_id, guest_type
        FROM guest_names
        WHERE booking_id = ?
        ORDER BY
          room_id NULLS LAST,
          CASE person_type WHEN 'adult' THEN 1 WHEN 'child' THEN 2 WHEN 'toddler' THEN 3 END,
          order_index
      `),

      // Audit logs
      insertAuditLog: this.db.prepare(`
        INSERT INTO audit_logs (log_id, booking_id, action_type, user_type, user_identifier, room_id, before_state, after_state, change_details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      getAuditLogsByBooking: this.db.prepare(`
        SELECT * FROM audit_logs
        WHERE booking_id = ?
        ORDER BY created_at DESC
      `),

      getAuditLogsByRoom: this.db.prepare(`
        SELECT * FROM audit_logs
        WHERE room_id = ?
        ORDER BY created_at DESC
      `),

      getAllAuditLogs: this.db.prepare(`
        SELECT * FROM audit_logs
        ORDER BY created_at DESC
        LIMIT ?
      `),
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
        paid: data.paid ? 1 : 0,
        pay_from_benefit: data.payFromBenefit ? 1 : 0,
        per_room_guests: data.perRoomGuests ? JSON.stringify(data.perRoomGuests) : null,
        edit_token: data.editToken,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      });

      // Insert room associations with per-room dates and guest data
      if (data.rooms && data.rooms.length > 0) {
        for (const roomId of data.rooms) {
          // Skip null/undefined room IDs
          if (roomId != null && roomId !== '') {
            // Use per-room dates if available, otherwise use booking-level dates
            let roomStartDate = data.startDate;
            let roomEndDate = data.endDate;
            let roomAdults = 1; // Default
            let roomChildren = 0;
            let roomToddlers = 0;
            let roomGuestType = data.guestType;

            if (data.perRoomDates && data.perRoomDates[roomId]) {
              roomStartDate = data.perRoomDates[roomId].startDate;
              roomEndDate = data.perRoomDates[roomId].endDate;
            }

            // Use per-room guest data if available
            if (data.perRoomGuests && data.perRoomGuests[roomId]) {
              // FIX: Respect 0 as valid value (don't use || operator for numbers)
              roomAdults =
                data.perRoomGuests[roomId].adults === undefined
                  ? 1
                  : data.perRoomGuests[roomId].adults;
              roomChildren =
                data.perRoomGuests[roomId].children === undefined
                  ? 0
                  : data.perRoomGuests[roomId].children;
              roomToddlers =
                data.perRoomGuests[roomId].toddlers === undefined
                  ? 0
                  : data.perRoomGuests[roomId].toddlers;
              roomGuestType = data.perRoomGuests[roomId].guestType || data.guestType;
            }

            this.statements.insertBookingRoom.run(
              data.id,
              roomId,
              roomStartDate,
              roomEndDate,
              roomAdults,
              roomChildren,
              roomToddlers,
              roomGuestType
            );
          }
        }
      }

      // Insert guest names if provided
      if (data.guestNames && Array.isArray(data.guestNames)) {
        const now = new Date().toISOString();
        data.guestNames.forEach((guest, index) => {
          this.statements.insertGuestName.run(
            data.id,
            guest.personType, // 'adult', 'child', or 'toddler'
            guest.firstName,
            guest.lastName,
            index + 1, // order_index starts at 1
            guest.roomId || null, // room_id (nullable for backward compatibility)
            guest.guestPriceType || null, // guest_type for per-guest pricing (NEW 2025-11-04)
            now
          );
        });
      }
    });

    return transaction(bookingData);
  }

  updateBooking(id, bookingData) {
    const transaction = this.db.transaction((bookingId, data) => {
      // Update booking
      this.statements.updateBooking.run({
        id: bookingId,
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
        paid: data.paid ? 1 : 0,
        pay_from_benefit: data.payFromBenefit ? 1 : 0,
        per_room_guests: data.perRoomGuests ? JSON.stringify(data.perRoomGuests) : null,
        updated_at: new Date().toISOString(),
      });

      // Update rooms (delete and re-insert) with per-room dates and guest data
      this.statements.deleteBookingRooms.run(bookingId);
      if (data.rooms && data.rooms.length > 0) {
        for (const roomId of data.rooms) {
          // Skip null/undefined room IDs
          if (roomId != null && roomId !== '') {
            // Use per-room dates if available, otherwise use booking-level dates
            let roomStartDate = data.startDate;
            let roomEndDate = data.endDate;
            let roomAdults = 1; // Default
            let roomChildren = 0;
            let roomToddlers = 0;
            let roomGuestType = data.guestType;

            if (data.perRoomDates && data.perRoomDates[roomId]) {
              roomStartDate = data.perRoomDates[roomId].startDate;
              roomEndDate = data.perRoomDates[roomId].endDate;
            }

            // Use per-room guest data if available
            if (data.perRoomGuests && data.perRoomGuests[roomId]) {
              // FIX: Respect 0 as valid value (don't use || operator for numbers)
              roomAdults =
                data.perRoomGuests[roomId].adults === undefined
                  ? 1
                  : data.perRoomGuests[roomId].adults;
              roomChildren =
                data.perRoomGuests[roomId].children === undefined
                  ? 0
                  : data.perRoomGuests[roomId].children;
              roomToddlers =
                data.perRoomGuests[roomId].toddlers === undefined
                  ? 0
                  : data.perRoomGuests[roomId].toddlers;
              roomGuestType = data.perRoomGuests[roomId].guestType || data.guestType;
            }

            this.statements.insertBookingRoom.run(
              bookingId,
              roomId,
              roomStartDate,
              roomEndDate,
              roomAdults,
              roomChildren,
              roomToddlers,
              roomGuestType
            );
          }
        }
      }

      // Update guest names (delete and re-insert)
      this.statements.deleteGuestNamesByBooking.run(bookingId);
      if (data.guestNames && Array.isArray(data.guestNames)) {
        const now = new Date().toISOString();
        data.guestNames.forEach((guest, index) => {
          this.statements.insertGuestName.run(
            bookingId,
            guest.personType, // 'adult', 'child', or 'toddler'
            guest.firstName,
            guest.lastName,
            index + 1, // order_index starts at 1
            guest.roomId || null, // room_id (nullable for backward compatibility)
            guest.guestPriceType || null, // guest_type for per-guest pricing (NEW 2025-11-04)
            now
          );
        });
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
      // Get associated rooms with per-room dates and guest data
      const roomRows = this.statements.getBookingRooms.all(id);
      const rooms = roomRows.map((r) => r.room_id);

      // Build perRoomDates and perRoomGuests objects
      const perRoomDates = {};
      const perRoomGuests = {};
      roomRows.forEach((row) => {
        if (row.start_date && row.end_date) {
          perRoomDates[row.room_id] = {
            startDate: row.start_date,
            endDate: row.end_date,
          };
        }
        // Include per-room guest data
        perRoomGuests[row.room_id] = {
          // FIX: Respect 0 as valid value (don't use || operator for numbers)
          adults: row.adults !== null && row.adults !== undefined ? row.adults : 1,
          children: row.children !== null && row.children !== undefined ? row.children : 0,
          toddlers: row.toddlers !== null && row.toddlers !== undefined ? row.toddlers : 0,
          guestType: row.guest_type || booking.guest_type,
        };
      });

      // Get guest names
      const guestNameRows = this.statements.getGuestNamesByBooking.all(id);
      const guestNames = guestNameRows.map((row) => ({
        personType: row.person_type,
        firstName: row.first_name,
        lastName: row.last_name,
        guestPriceType: row.guest_type, // Per-guest pricing type (utia/external)
      }));

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
        perRoomDates, // Include per-room dates
        perRoomGuests, // Include per-room guest data
        guestType: booking.guest_type,
        adults: booking.adults,
        children: booking.children,
        toddlers: booking.toddlers,
        totalPrice: booking.total_price,
        notes: booking.notes,
        paid: Boolean(booking.paid),
        editToken: booking.edit_token,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        guestNames, // Include guest names
      };
    }
    return null;
  }

  getBookingByEditToken(editToken) {
    const stmt = this.db.prepare('SELECT * FROM bookings WHERE edit_token = ?');
    const booking = stmt.get(editToken);

    if (booking) {
      // Get associated rooms with per-room dates and guest data
      const roomRows = this.statements.getBookingRooms.all(booking.id);
      const rooms = roomRows.map((r) => r.room_id);

      // Build perRoomDates and perRoomGuests objects
      const perRoomDates = {};
      let perRoomGuests = {}; // Changed from const to let
      roomRows.forEach((row) => {
        if (row.start_date && row.end_date) {
          perRoomDates[row.room_id] = {
            startDate: row.start_date,
            endDate: row.end_date,
          };
        }
        // Include per-room guest data
        perRoomGuests[row.room_id] = {
          // FIX: Respect 0 as valid value (don't use || operator for numbers)
          adults: row.adults === null || row.adults === undefined ? 1 : row.adults,
          children: row.children === null || row.children === undefined ? 0 : row.children,
          toddlers: row.toddlers === null || row.toddlers === undefined ? 0 : row.toddlers,
          guestType: row.guest_type || booking.guest_type,
        };
      });

      // PRIORITY: Use per_room_guests from bookings table if exists (new format)
      // This overrides the data from booking_rooms table
      if (booking.per_room_guests) {
        try {
          const parsedPerRoomGuests = JSON.parse(booking.per_room_guests);
          // Convert array format to object format with roomId as key
          if (Array.isArray(parsedPerRoomGuests)) {
            perRoomGuests = {};
            parsedPerRoomGuests.forEach((roomGuest) => {
              if (roomGuest.roomId) {
                perRoomGuests[roomGuest.roomId] = {
                  adults: roomGuest.adults || 0,
                  children: roomGuest.children || 0,
                  toddlers: roomGuest.toddlers || 0,
                  guestType: roomGuest.guestType || booking.guest_type,
                };
              }
            });
          }
        } catch (error) {
          // Ignore JSON parse errors, use fallback from booking_rooms
          console.warn('Failed to parse per_room_guests for booking', booking.id, error);
        }
      }

      // Get guest names
      const guestNameRows = this.statements.getGuestNamesByBooking.all(booking.id);
      const guestNames = guestNameRows.map((row) => ({
        personType: row.person_type,
        firstName: row.first_name,
        lastName: row.last_name,
        guestPriceType: row.guest_type, // Per-guest pricing type (utia/external)
      }));

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
        perRoomDates, // Include per-room dates
        perRoomGuests, // Include per-room guest data
        guestType: booking.guest_type,
        adults: booking.adults,
        children: booking.children,
        toddlers: booking.toddlers,
        totalPrice: booking.total_price,
        notes: booking.notes,
        paid: Boolean(booking.paid),
        payFromBenefit: Boolean(booking.pay_from_benefit),
        editToken: booking.edit_token,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        guestNames, // Include guest names
      };
    }
    return null;
  }

  getAllBookings() {
    // PERFORMANCE FIX: Use JOIN with GROUP_CONCAT to get per-room dates and guest data
    const query = `
      SELECT
        b.*,
        GROUP_CONCAT(
          br.room_id || ':' ||
          COALESCE(br.start_date, '') || ':' ||
          COALESCE(br.end_date, '') || ':' ||
          COALESCE(br.adults, 1) || ':' ||
          COALESCE(br.children, 0) || ':' ||
          COALESCE(br.toddlers, 0) || ':' ||
          COALESCE(br.guest_type, '')
        ) as room_data
      FROM bookings b
      LEFT JOIN booking_rooms br ON b.id = br.booking_id
      GROUP BY b.id
      ORDER BY b.start_date DESC
    `;

    const bookings = this.db.prepare(query).all();

    return bookings.map((booking) => {
      // Parse room_data to extract rooms, per-room dates, and per-room guest data
      const rooms = [];
      const perRoomDates = {};
      let perRoomGuests = {};

      if (booking.room_data) {
        const roomEntries = booking.room_data.split(',');
        roomEntries.forEach((entry) => {
          const [roomId, startDate, endDate, adults, children, toddlers, guestType] =
            entry.split(':');
          rooms.push(roomId);
          if (startDate && endDate) {
            perRoomDates[roomId] = { startDate, endDate };
          }
          // Include per-room guest data
          // FIX: Respect 0 as valid value (don't use || operator for numbers)
          const adultsNum = parseInt(adults, 10);
          const childrenNum = parseInt(children, 10);
          const toddlersNum = parseInt(toddlers, 10);

          perRoomGuests[roomId] = {
            adults: isNaN(adultsNum) ? 1 : adultsNum,
            children: isNaN(childrenNum) ? 0 : childrenNum,
            toddlers: isNaN(toddlersNum) ? 0 : toddlersNum,
            guestType: guestType || booking.guest_type,
          };
        });
      }

      // PRIORITY: Use per_room_guests from bookings table if exists (new format)
      // This overrides the data from booking_rooms table
      if (booking.per_room_guests) {
        try {
          const parsedPerRoomGuests = JSON.parse(booking.per_room_guests);
          // Convert array format to object format with roomId as key
          if (Array.isArray(parsedPerRoomGuests)) {
            perRoomGuests = {};
            parsedPerRoomGuests.forEach((roomGuest) => {
              if (roomGuest.roomId) {
                perRoomGuests[roomGuest.roomId] = {
                  adults: roomGuest.adults || 0,
                  children: roomGuest.children || 0,
                  toddlers: roomGuest.toddlers || 0,
                  guestType: roomGuest.guestType || booking.guest_type,
                };
              }
            });
          }
        } catch (error) {
          // Ignore JSON parse errors, use fallback from booking_rooms
          console.warn('Failed to parse per_room_guests for booking', booking.id, error);
        }
      }

      // Fetch guest names for this booking
      const guestNameRows = this.statements.getGuestNamesByBooking.all(booking.id);
      const guestNames = guestNameRows.map((row) => ({
        personType: row.person_type,
        firstName: row.first_name,
        lastName: row.last_name,
        guestPriceType: row.guest_type, // Per-guest pricing type (utia/external)
      }));

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
        perRoomDates, // Include per-room dates
        perRoomGuests, // Include per-room guest data
        guestType: booking.guest_type,
        adults: booking.adults,
        children: booking.children,
        toddlers: booking.toddlers,
        totalPrice: booking.total_price,
        priceLocked: Boolean(booking.price_locked), // NEW 2025-11-14: Include price_locked flag
        notes: booking.notes,
        paid: Boolean(booking.paid),
        payFromBenefit: Boolean(booking.pay_from_benefit),
        editToken: booking.edit_token,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        guestNames, // Include guest names
      };
    });
  }

  // Blockage instances operations
  createBlockageInstance(blockageData) {
    const transaction = this.db.transaction((data) => {
      // Insert blockage instance
      this.statements.insertBlockageInstance.run(
        data.blockageId,
        data.startDate,
        data.endDate,
        data.reason || null,
        data.createdAt
      );

      // Insert room associations (empty = all rooms blocked)
      if (data.rooms && data.rooms.length > 0) {
        for (const roomId of data.rooms) {
          this.statements.insertBlockageRoom.run(data.blockageId, roomId);
        }
      }
    });

    return transaction(blockageData);
  }

  deleteBlockageInstance(blockageId) {
    // CASCADE will automatically delete associated rooms
    return this.statements.deleteBlockageInstance.run(blockageId);
  }

  getAllBlockageInstances() {
    const instances = this.statements.getAllBlockageInstances.all();
    return instances.map((inst) => ({
      blockageId: inst.blockage_id,
      startDate: inst.start_date,
      endDate: inst.end_date,
      reason: inst.reason,
      createdAt: inst.created_at,
      rooms: inst.room_ids ? inst.room_ids.split(',') : [], // Empty = all rooms
    }));
  }

  getBlockageInstance(blockageId) {
    const inst = this.statements.getBlockageInstance.get(blockageId);
    if (!inst) {
      return null;
    }

    return {
      blockageId: inst.blockage_id,
      startDate: inst.start_date,
      endDate: inst.end_date,
      reason: inst.reason,
      createdAt: inst.created_at,
      rooms: inst.room_ids ? inst.room_ids.split(',') : [],
    };
  }

  // Legacy compatibility - convert blockage instances to old blocked_dates format
  getAllBlockedDates() {
    const instances = this.getAllBlockageInstances();
    const blockedDates = [];

    for (const inst of instances) {
      // Expand date range to individual dates
      const start = new Date(inst.startDate);
      const end = new Date(inst.endDate);

      // eslint-disable-next-line no-unmodified-loop-condition
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // Use local date components instead of UTC to avoid timezone issues
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        if (inst.rooms.length === 0) {
          // All rooms blocked
          blockedDates.push({
            date: dateStr,
            roomId: null,
            reason: inst.reason,
            blockageId: inst.blockageId,
            blockedAt: inst.createdAt,
          });
        } else {
          // Specific rooms blocked
          for (const roomId of inst.rooms) {
            blockedDates.push({
              date: dateStr,
              roomId,
              reason: inst.reason,
              blockageId: inst.blockageId,
              blockedAt: inst.createdAt,
            });
          }
        }
      }
    }

    return blockedDates;
  }

  // Legacy compatibility - create blocked date (converts to new blockage_instances format)
  createBlockedDate(blockedDateData) {
    // Old format: { date, roomId, reason, blockageId, blockedAt }
    // New format: { blockageId, startDate, endDate, reason, createdAt, rooms: [] }

    const blockageId = blockedDateData.blockageId || this.generateBlockageId();
    const { date } = blockedDateData;
    const { roomId } = blockedDateData;
    const reason = blockedDateData.reason || null;
    const createdAt = blockedDateData.blockedAt || new Date().toISOString();

    // Check if blockage instance already exists
    const existing = this.getBlockageInstance(blockageId);

    if (existing) {
      // Add room to existing blockage if not already present
      if (roomId && !existing.rooms.includes(roomId)) {
        this.statements.insertBlockageRoom.run(blockageId, roomId);
      }
    } else {
      // Create new blockage instance (single date = start equals end)
      const blockageData = {
        blockageId,
        startDate: date,
        endDate: date,
        reason,
        createdAt,
        rooms: roomId ? [roomId] : [], // empty array = all rooms blocked
      };

      this.createBlockageInstance(blockageData);
    }

    return blockageId;
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

    // Get christmas periods from the new table
    const christmasPeriods = this.getAllChristmasPeriods();
    if (christmasPeriods.length > 0) {
      // Support multiple periods - map database fields to frontend format
      settings.christmasPeriods = christmasPeriods.map((p) => ({
        start: p.start_date,
        end: p.end_date,
        year: p.year,
        periodId: p.period_id, // Map period_id to periodId for frontend
        name: p.name,
      }));

      // Also provide old format for backward compatibility
      const currentPeriod = christmasPeriods[0];
      settings.christmasPeriod = {
        start: currentPeriod.start_date,
        end: currentPeriod.end_date,
      };
    } else {
      // Fallback to old settings if no periods in new table
      const start = this.getSetting('christmasPeriodStart');
      const end = this.getSetting('christmasPeriodEnd');
      if (start && end) {
        settings.christmasPeriod = { start, end };
        settings.christmasPeriods = [{ start, end, year: new Date(start).getFullYear() }];
        // Migrate to new table
        this.migrateChristmasSettings();
      } else {
        // ✅ FIX: Check if periods were intentionally deleted by checking for explicit empty flag
        const periodsDeleted = this.getSetting('christmasPeriodsDeleted');

        if (periodsDeleted) {
          // User intentionally deleted all periods - return empty arrays
          settings.christmasPeriod = null;
          settings.christmasPeriods = [];
        } else {
          // Only create defaults on first initialization (not when user deleted all periods)
          const defaultStart = '2024-12-23';
          const defaultEnd = '2025-01-02';
          settings.christmasPeriod = { start: defaultStart, end: defaultEnd };
          settings.christmasPeriods = [{ start: defaultStart, end: defaultEnd, year: 2024 }];
          // Create default period in database
          this.createChristmasPeriod({
            name: 'Vánoce 2024',
            startDate: defaultStart,
            endDate: defaultEnd,
            year: 2024,
          });
        }
      }
    }

    // Get christmas access codes
    settings.christmasAccessCodes = this.statements.getAllChristmasCodes.all().map((c) => c.code);

    // Get prices (NEW 2025-11-05: Room-size based pricing model)
    const pricesJson = this.getSetting('prices');
    settings.prices = pricesJson
      ? JSON.parse(pricesJson)
      : {
          utia: {
            small: { empty: 250, adult: 50, child: 25 },
            large: { empty: 350, adult: 50, child: 25 },
          },
          external: {
            small: { empty: 400, adult: 100, child: 50 },
            large: { empty: 500, adult: 100, child: 50 },
          },
        };

    // Get bulk prices
    const bulkPricesJson = this.getSetting('bulkPrices');
    settings.bulkPrices = bulkPricesJson
      ? JSON.parse(bulkPricesJson)
      : {
          basePrice: 2000,
          utiaAdult: 100,
          utiaChild: 0,
          externalAdult: 250,
          externalChild: 50,
        };

    // Get rooms
    settings.rooms = this.statements.getAllRooms.all();

    // Get email template
    const emailTemplateJson = this.getSetting('emailTemplate');
    if (emailTemplateJson) {
      settings.emailTemplate = JSON.parse(emailTemplateJson);
    }

    // Get contact email
    const contactEmail = this.getSetting('contactEmail');
    if (contactEmail) {
      settings.contactEmail = contactEmail;
    }

    // Get admin emails for notifications
    const adminEmailsJson = this.getSetting('adminEmails');
    if (adminEmailsJson) {
      try {
        settings.adminEmails = JSON.parse(adminEmailsJson);
      } catch (error) {
        settings.adminEmails = [];
      }
    } else {
      settings.adminEmails = [];
    }

    return settings;
  }

  updateSettings(settings) {
    const transaction = this.db.transaction((updatedSettings) => {
      if (updatedSettings.adminPassword) {
        this.setSetting('adminPassword', updatedSettings.adminPassword);
      }

      // Handle new Christmas periods format
      if (updatedSettings.christmasPeriods && Array.isArray(updatedSettings.christmasPeriods)) {
        // Clear existing periods
        this.db.exec('DELETE FROM christmas_periods');

        // ✅ FIX: Set flag if array is empty (user deleted all periods)
        if (updatedSettings.christmasPeriods.length === 0) {
          this.setSetting('christmasPeriodsDeleted', 'true');
        } else {
          // Clear flag when periods are added
          this.db.exec("DELETE FROM settings WHERE key = 'christmasPeriodsDeleted'");
        }

        // Add new periods
        for (const period of updatedSettings.christmasPeriods) {
          this.createChristmasPeriod({
            periodId: period.periodId,
            name: period.name || `Vánoce ${period.year}`,
            startDate: period.start,
            endDate: period.end,
            year: period.year,
          });
        }
      } else if (updatedSettings.christmasPeriod) {
        // Backward compatibility - update old format
        if (updatedSettings.christmasPeriod.start) {
          this.setSetting('christmasPeriodStart', updatedSettings.christmasPeriod.start);
        }
        if (updatedSettings.christmasPeriod.end) {
          this.setSetting('christmasPeriodEnd', updatedSettings.christmasPeriod.end);
        }
      }

      if (updatedSettings.prices) {
        this.setSetting('prices', JSON.stringify(updatedSettings.prices));
      }

      if (updatedSettings.bulkPrices) {
        this.setSetting('bulkPrices', JSON.stringify(updatedSettings.bulkPrices));
      }

      if (updatedSettings.christmasAccessCodes) {
        // Clear existing codes
        this.db.exec('DELETE FROM christmas_codes');

        // Add new codes
        const now = new Date().toISOString();
        for (const code of updatedSettings.christmasAccessCodes) {
          this.statements.insertChristmasCode.run(code, now);
        }
      }

      // Handle room configuration updates
      if (updatedSettings.rooms && Array.isArray(updatedSettings.rooms)) {
        this.updateRooms(updatedSettings.rooms);
      }

      // Handle email template updates
      if (updatedSettings.emailTemplate) {
        this.setSetting('emailTemplate', JSON.stringify(updatedSettings.emailTemplate));
      }

      // Handle contact email updates
      if (updatedSettings.contactEmail) {
        this.setSetting('contactEmail', updatedSettings.contactEmail);
      }

      // Handle admin emails updates
      if (updatedSettings.adminEmails !== undefined) {
        // Validate that it's an array
        if (Array.isArray(updatedSettings.adminEmails)) {
          this.setSetting('adminEmails', JSON.stringify(updatedSettings.adminEmails));
        }
      }
    });

    return transaction(settings);
  }

  /**
   * Updates rooms in the database
   * @param {Array<{id: string, name: string, type: string, beds: number}>} rooms - Array of room objects
   */
  updateRooms(rooms) {
    if (!rooms || !Array.isArray(rooms)) {
      throw new Error('Invalid rooms data: must be an array');
    }

    const updateTransaction = this.db.transaction((roomsList) => {
      // Clear existing rooms
      this.db.prepare('DELETE FROM rooms').run();

      // Insert new rooms
      const insertRoom = this.db.prepare(
        'INSERT INTO rooms (id, name, type, beds) VALUES (?, ?, ?, ?)'
      );

      for (const room of roomsList) {
        // Validate room structure
        if (!room.id || !room.name || typeof room.beds !== 'number') {
          console.warn(`Skipping invalid room:`, room);
          continue;
        }

        insertRoom.run(
          room.id,
          room.name,
          room.type || 'standard', // Default type if not provided
          room.beds
        );
      }
    });

    return updateTransaction(rooms);
  }

  // Get all data (for compatibility with existing API)
  getAllData() {
    return {
      bookings: this.getAllBookings(),
      blockedDates: this.getAllBlockedDates(), // Legacy compatibility
      blockageInstances: this.getAllBlockageInstances(), // New structure
      settings: this.getSettings(),
    };
  }

  // Check room availability using night-based logic
  // NIGHT-BASED MODEL:
  // - available: No nights around the day are occupied
  // - edge: Exactly ONE night around the day is occupied
  // - occupied: BOTH nights around the day are occupied
  // - blocked: Day is administratively blocked
  // - proposed: Day has a pending booking proposal
  getRoomAvailability(roomId, date, excludeSessionId = null) {
    // Check for blocked dates using new blockage_instances structure
    const blocked = this.db
      .prepare(
        `
            SELECT bi.*
            FROM blockage_instances bi
            LEFT JOIN blockage_rooms br ON bi.blockage_id = br.blockage_id
            WHERE bi.start_date <= ? AND bi.end_date >= ?
              AND (br.room_id = ? OR br.room_id IS NULL)
        `
      )
      .get(date, date, roomId);

    if (blocked) {
      return { available: false, status: 'blocked', reason: 'blocked' };
    }

    // Get all bookings for this room (using per-room dates from booking_rooms table)
    const allBookings = this.db
      .prepare(
        `
            SELECT br.start_date as startDate, br.end_date as endDate, b.email
            FROM bookings b
            JOIN booking_rooms br ON b.id = br.booking_id
            WHERE br.room_id = ?
        `
      )
      .all(roomId);

    // Calculate nights around the given day using DateUtils
    // nightBefore: from (date-1) to date
    // nightAfter: from date to (date+1)
    const dateObj = DateUtils.parseDate(date);

    const prevDateObj = new Date(dateObj);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const nightBefore = DateUtils.formatDate(prevDateObj);

    const nightAfter = date;

    let nightBeforeOccupied = false;
    let nightAfterOccupied = false;
    let bookingEmail = null;

    // Check if each night is occupied by any booking using DateUtils (INCLUSIVE end date model)
    for (const booking of allBookings) {
      // Use DateUtils.isNightOccupied for consistent inclusive end date logic
      if (DateUtils.isNightOccupied(nightBefore, booking.startDate, booking.endDate)) {
        nightBeforeOccupied = true;
        bookingEmail = booking.email;
      }
      if (DateUtils.isNightOccupied(nightAfter, booking.startDate, booking.endDate)) {
        nightAfterOccupied = true;
        bookingEmail = booking.email;
      }
    }

    // Check for proposed bookings using NIGHT-BASED MODEL (supports mixed edge days)
    const now = new Date().toISOString();
    const proposedQuery = excludeSessionId
      ? `
            SELECT pb.* FROM proposed_bookings pb
            JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
            WHERE pbr.room_id = ?
            AND pb.expires_at > ?
            AND pb.session_id != ?
        `
      : `
            SELECT pb.* FROM proposed_bookings pb
            JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
            WHERE pbr.room_id = ?
            AND pb.expires_at > ?
        `;

    const proposedParams = excludeSessionId ? [roomId, now, excludeSessionId] : [roomId, now];

    const proposedBookings = this.db.prepare(proposedQuery).all(...proposedParams);

    // Check if nights are occupied by proposed bookings
    let proposedNightBeforeOccupied = false;
    let proposedNightAfterOccupied = false;

    for (const pb of proposedBookings) {
      // Use DateUtils.isNightOccupied for consistent EXCLUSIVE end date logic
      if (DateUtils.isNightOccupied(nightBefore, pb.start_date, pb.end_date)) {
        proposedNightBeforeOccupied = true;
      }
      if (DateUtils.isNightOccupied(nightAfter, pb.start_date, pb.end_date)) {
        proposedNightAfterOccupied = true;
      }
    }

    // Combine proposed and confirmed night occupancy
    const totalNightBeforeOccupied = proposedNightBeforeOccupied || nightBeforeOccupied;
    const totalNightAfterOccupied = proposedNightAfterOccupied || nightAfterOccupied;
    const totalOccupiedCount =
      (totalNightBeforeOccupied ? 1 : 0) + (totalNightAfterOccupied ? 1 : 0);

    // Determine night types for detailed rendering
    const nightBeforeType = proposedNightBeforeOccupied
      ? 'proposed'
      : nightBeforeOccupied
        ? 'confirmed'
        : 'available';
    const nightAfterType = proposedNightAfterOccupied
      ? 'proposed'
      : nightAfterOccupied
        ? 'confirmed'
        : 'available';

    // Determine status based on total occupied night count
    if (totalOccupiedCount === 0) {
      return { available: true, status: 'available', email: null };
    } else if (totalOccupiedCount === 1) {
      // Edge day - ONE night occupied (either proposed or confirmed)
      return {
        available: true, // Edge days are available for new bookings
        status: 'edge',
        reason: 'edge',
        email: bookingEmail,
        nightBefore: totalNightBeforeOccupied,
        nightAfter: totalNightAfterOccupied,
        nightBeforeType,
        nightAfterType,
      };
    } else if (totalOccupiedCount === 2) {
      // BOTH nights occupied - check if MIXED (one proposed, one confirmed)
      const isMixed =
        (proposedNightBeforeOccupied && !nightBeforeOccupied && nightAfterOccupied) ||
        (proposedNightAfterOccupied && !nightAfterOccupied && nightBeforeOccupied);

      if (isMixed) {
        // Mixed edge day - one night proposed, one confirmed
        // Treat as edge day (clickable) with special flag
        return {
          available: true,
          status: 'edge',
          reason: 'edge',
          email: bookingEmail,
          nightBefore: totalNightBeforeOccupied,
          nightAfter: totalNightAfterOccupied,
          nightBeforeType,
          nightAfterType,
          isMixed: true, // Flag for special rendering
        };
      }

      // Both nights occupied by same type (both proposed OR both confirmed)
      if (proposedNightBeforeOccupied && proposedNightAfterOccupied) {
        return {
          available: false,
          status: 'proposed',
          reason: 'proposed',
          proposal: proposedBookings[0],
        };
      }

      // Both nights confirmed
      return {
        available: false,
        status: 'occupied',
        reason: 'booked',
        email: bookingEmail,
      };
    }

    // Shouldn't reach here, but return occupied as fallback
    return {
      available: false,
      status: 'occupied',
      reason: 'booked',
      email: bookingEmail,
    };
  }

  // Migrate data from JSON file
  async migrateFromJSON(jsonPath) {
    const fsPromises = require('fs').promises;
    const data = JSON.parse(await fsPromises.readFile(jsonPath, 'utf8'));

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

  // Delegate to IdGenerator for SSOT compliance
  generateToken() {
    return IdGenerator.generateToken(12);
  }

  generateBlockageId() {
    return IdGenerator.generateBlockageId();
  }

  generateChristmasPeriodId() {
    return IdGenerator.generateChristmasPeriodId();
  }

  generateProposalId() {
    return IdGenerator.generateProposalId();
  }

  // Christmas period operations
  getAllChristmasPeriods() {
    return this.statements.getAllChristmasPeriods.all();
  }

  getChristmasPeriod(periodId) {
    return this.statements.getChristmasPeriod.get(periodId);
  }

  createChristmasPeriod(periodData) {
    const periodId = periodData.periodId || this.generateChristmasPeriodId();
    const now = new Date().toISOString();

    return this.statements.insertChristmasPeriod.run(
      periodId,
      periodData.name,
      periodData.startDate,
      periodData.endDate,
      periodData.year || new Date(periodData.startDate).getFullYear(),
      periodData.createdAt || now,
      periodData.updatedAt || now
    );
  }

  updateChristmasPeriod(periodId, periodData) {
    return this.statements.updateChristmasPeriod.run(
      periodData.name,
      periodData.startDate,
      periodData.endDate,
      periodData.year || new Date(periodData.startDate).getFullYear(),
      new Date().toISOString(),
      periodId
    );
  }

  deleteChristmasPeriod(periodId) {
    const result = this.statements.deleteChristmasPeriod.run(periodId);

    // Also clean up any legacy settings to prevent auto-recreation
    // This prevents the migration logic from recreating deleted periods
    this.db.exec(
      "DELETE FROM settings WHERE key IN ('christmasPeriodStart', 'christmasPeriodEnd')"
    );

    return result;
  }

  // Migrate old Christmas settings to new table
  migrateChristmasSettings() {
    const start = this.getSetting('christmasPeriodStart');
    const end = this.getSetting('christmasPeriodEnd');

    if (start && end) {
      const year = new Date(start).getFullYear();
      const periodData = {
        name: `Vánoce ${year}`,
        startDate: start,
        endDate: end,
        year,
      };

      try {
        this.createChristmasPeriod(periodData);
        // Clean up old settings after successful migration
        this.db.exec(
          "DELETE FROM settings WHERE key IN ('christmasPeriodStart', 'christmasPeriodEnd')"
        );
      } catch (error) {
        console.error('Migration failed:', error);
      }
    }
  }

  // Proposed booking operations
  createProposedBooking(
    sessionId,
    startDate,
    endDate,
    rooms,
    guests = {},
    guestType = 'external',
    totalPrice = 0
  ) {
    const proposalId = this.generateProposalId();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // Expires in 15 minutes

    const adults = guests.adults || 0;
    const children = guests.children || 0;
    const toddlers = guests.toddlers || 0;

    const transaction = this.db.transaction(() => {
      // Insert proposed booking with guest and price info
      this.statements.insertProposedBooking.run(
        proposalId,
        sessionId,
        startDate,
        endDate,
        now,
        expiresAt,
        adults,
        children,
        toddlers,
        guestType,
        totalPrice
      );

      // Insert room associations
      for (const roomId of rooms) {
        this.statements.insertProposedBookingRoom.run(proposalId, roomId);
      }
    });

    transaction();
    return proposalId;
  }

  deleteProposedBooking(proposalId) {
    return this.statements.deleteProposedBooking.run(proposalId);
  }

  deleteExpiredProposedBookings() {
    const now = new Date().toISOString();
    return this.statements.deleteExpiredProposedBookings.run(now);
  }

  deleteProposedBookingsBySession(sessionId) {
    return this.statements.deleteProposedBookingsBySession.run(sessionId);
  }

  getProposedBookingsBySession(sessionId) {
    const now = new Date().toISOString();
    const query = `
      SELECT pb.*, GROUP_CONCAT(pbr.room_id) as rooms
      FROM proposed_bookings pb
      JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
      WHERE pb.session_id = ? AND pb.expires_at > ?
      GROUP BY pb.proposal_id
    `;
    const results = this.db.prepare(query).all(sessionId, now);

    // Convert comma-separated rooms string to array
    return results.map((booking) => ({
      ...booking,
      rooms: booking.rooms ? booking.rooms.split(',') : [],
    }));
  }

  getProposedBookingsByDateRange(startDate, endDate) {
    const now = new Date().toISOString();
    return this.statements.getProposedBookingsByDateRange.all(endDate, startDate, now);
  }

  getActiveProposedBookings() {
    const now = new Date().toISOString();
    const query = `
      SELECT pb.*, GROUP_CONCAT(pbr.room_id) as rooms
      FROM proposed_bookings pb
      JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
      WHERE pb.expires_at > ?
      GROUP BY pb.proposal_id
    `;
    const results = this.db.prepare(query).all(now);

    // Convert comma-separated rooms string to array
    return results.map((booking) => ({
      ...booking,
      rooms: booking.rooms ? booking.rooms.split(',') : [],
    }));
  }

  // Admin session operations
  createAdminSession(sessionToken, expiresAt, userAgent = null, ipAddress = null) {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      INSERT INTO admin_sessions (session_token, created_at, last_activity, expires_at, user_agent, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .run(sessionToken, now, now, expiresAt, userAgent, ipAddress);
  }

  getAdminSession(sessionToken) {
    return this.db
      .prepare(
        `
      SELECT * FROM admin_sessions WHERE session_token = ?
    `
      )
      .get(sessionToken);
  }

  updateAdminSessionActivity(sessionToken, newExpiresAt) {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      UPDATE admin_sessions
      SET last_activity = ?, expires_at = ?
      WHERE session_token = ?
    `
      )
      .run(now, newExpiresAt, sessionToken);
  }

  deleteAdminSession(sessionToken) {
    this.db
      .prepare(
        `
      DELETE FROM admin_sessions WHERE session_token = ?
    `
      )
      .run(sessionToken);
  }

  deleteExpiredAdminSessions() {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `
      DELETE FROM admin_sessions WHERE expires_at < ?
    `
      )
      .run(now);
    return result.changes;
  }

  getAllAdminSessions() {
    return this.db
      .prepare(
        `
      SELECT * FROM admin_sessions ORDER BY created_at DESC
    `
      )
      .all();
  }

  // Audit log operations
  createAuditLog(auditData) {
    const logId = IdGenerator.generateSessionId(); // Reuse session ID generator for unique IDs
    const timestamp = new Date().toISOString();

    this.statements.insertAuditLog.run(
      logId,
      auditData.bookingId,
      auditData.actionType, // 'room_added', 'room_removed', 'room_restored', etc.
      auditData.userType, // 'user' or 'admin'
      auditData.userIdentifier || null, // edit token fragment or admin session ID
      auditData.roomId || null,
      auditData.beforeState ? JSON.stringify(auditData.beforeState) : null,
      auditData.afterState ? JSON.stringify(auditData.afterState) : null,
      auditData.changeDetails || null,
      timestamp
    );

    return { logId, createdAt: timestamp };
  }

  getAuditLogsByBooking(bookingId) {
    const logs = this.statements.getAuditLogsByBooking.all(bookingId);

    // Parse JSON fields
    return logs.map((log) => ({
      ...log,
      beforeState: log.before_state ? JSON.parse(log.before_state) : null,
      afterState: log.after_state ? JSON.parse(log.after_state) : null,
    }));
  }

  getAuditLogsByRoom(roomId) {
    const logs = this.statements.getAuditLogsByRoom.all(roomId);

    // Parse JSON fields
    return logs.map((log) => ({
      ...log,
      beforeState: log.before_state ? JSON.parse(log.before_state) : null,
      afterState: log.after_state ? JSON.parse(log.after_state) : null,
    }));
  }

  getAllAuditLogs(limit = 100) {
    const logs = this.statements.getAllAuditLogs.all(limit);

    // Parse JSON fields
    return logs.map((log) => ({
      ...log,
      beforeState: log.before_state ? JSON.parse(log.before_state) : null,
      afterState: log.after_state ? JSON.parse(log.after_state) : null,
    }));
  }

  // Close database connection
  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;
