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
    // ============================================================
    // NEW UNIFIED SCHEMA (2025-12-04)
    // SSOT: guest_type exists ONLY in guest_names table
    // ============================================================

    // BOOKINGS: Contact info and total price only
    // Guest counts and types are derived from booking_rooms and guest_names
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
        total_price REAL NOT NULL,
        notes TEXT,
        edit_token TEXT NOT NULL,
        is_bulk_booking INTEGER DEFAULT 0,
        paid INTEGER DEFAULT 0,
        pay_from_benefit INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // BOOKING_ROOMS: Per-room dates and guest counts
    // guest_type removed - derived from guest_names
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS booking_rooms (
        booking_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        adults INTEGER DEFAULT 0,
        children INTEGER DEFAULT 0,
        toddlers INTEGER DEFAULT 0,
        PRIMARY KEY (booking_id, room_id),
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      )
    `);

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

    // PROPOSED_BOOKINGS: Simplified - just essentials
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS proposed_bookings (
        proposal_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `);

    // PROPOSED_BOOKING_ROOMS: Per-room dates for proposals
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS proposed_booking_rooms (
        proposal_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        PRIMARY KEY (proposal_id, room_id),
        FOREIGN KEY (proposal_id) REFERENCES proposed_bookings(proposal_id) ON DELETE CASCADE
      )
    `);

    // Create indexes for proposed bookings
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_proposed_bookings_expires ON proposed_bookings(expires_at);
      CREATE INDEX IF NOT EXISTS idx_proposed_booking_rooms ON proposed_booking_rooms(room_id);
      CREATE INDEX IF NOT EXISTS idx_proposed_booking_rooms_dates ON proposed_booking_rooms(start_date, end_date);
    `);

    // GUEST_NAMES: SSOT for guests and their type (ÚTIA/External)
    // room_id and guest_type are now REQUIRED (NOT NULL)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guest_names (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        person_type TEXT NOT NULL CHECK(person_type IN ('adult', 'child', 'toddler')),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        guest_type TEXT NOT NULL DEFAULT 'external' CHECK(guest_type IN ('utia', 'external')),
        order_index INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        UNIQUE(booking_id, room_id, person_type, order_index)
      )
    `);

    // Create indexes for guest names performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_guest_names_booking ON guest_names(booking_id);
      CREATE INDEX IF NOT EXISTS idx_guest_names_room ON guest_names(booking_id, room_id);
      CREATE INDEX IF NOT EXISTS idx_guest_names_type ON guest_names(guest_type);
    `);

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

    // ============================================================
    // RESERVATION GROUPS TABLE (2025-12-09)
    // Groups multiple bookings created in the same session
    // ============================================================
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reservation_groups (
        group_id TEXT PRIMARY KEY,
        session_id TEXT,
        total_price REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create indexes for reservation groups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_reservation_groups_session ON reservation_groups(session_id);
      CREATE INDEX IF NOT EXISTS idx_reservation_groups_created ON reservation_groups(created_at);
    `);

    // Add group_id column to bookings table if it doesn't exist
    // This links bookings to their parent group
    try {
      this.db.exec(`ALTER TABLE bookings ADD COLUMN group_id TEXT REFERENCES reservation_groups(group_id) ON DELETE SET NULL`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_group ON bookings(group_id)`);
    } catch (e) {
      // Column already exists, ignore error
      if (!e.message.includes('duplicate column name')) {
        throw e;
      }
    }

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
    // NEW UNIFIED SCHEMA (2025-12-04): guest_type only in guest_names
    this.statements = {
      // Bookings - simplified without guest counts/types (derived from booking_rooms and guest_names)
      insertBooking: this.db.prepare(`
        INSERT INTO bookings (
          id, name, email, phone, company, address, city, zip, ico, dic,
          start_date, end_date, total_price, notes, is_bulk_booking,
          paid, pay_from_benefit, edit_token, created_at, updated_at
        ) VALUES (
          @id, @name, @email, @phone, @company, @address, @city, @zip, @ico, @dic,
          @start_date, @end_date, @total_price, @notes, @is_bulk_booking,
          @paid, @pay_from_benefit, @edit_token, @created_at, @updated_at
        )
      `),

      updateBooking: this.db.prepare(`
        UPDATE bookings SET
          name = @name, email = @email, phone = @phone,
          company = @company, address = @address, city = @city,
          zip = @zip, ico = @ico, dic = @dic,
          start_date = @start_date, end_date = @end_date,
          total_price = @total_price, notes = @notes,
          is_bulk_booking = @is_bulk_booking,
          paid = @paid, pay_from_benefit = @pay_from_benefit,
          updated_at = @updated_at
        WHERE id = @id
      `),

      deleteBooking: this.db.prepare('DELETE FROM bookings WHERE id = ?'),

      getBooking: this.db.prepare('SELECT * FROM bookings WHERE id = ?'),

      getAllBookings: this.db.prepare('SELECT * FROM bookings ORDER BY start_date DESC'),

      // Booking rooms - guest_type removed (derived from guest_names)
      insertBookingRoom: this.db.prepare(
        'INSERT INTO booking_rooms (booking_id, room_id, start_date, end_date, adults, children, toddlers) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ),

      deleteBookingRooms: this.db.prepare('DELETE FROM booking_rooms WHERE booking_id = ?'),

      getBookingRooms: this.db.prepare(
        'SELECT room_id, start_date, end_date, adults, children, toddlers FROM booking_rooms WHERE booking_id = ?'
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

      // Proposed bookings - simplified (no guest info stored, just room reservations)
      insertProposedBooking: this.db.prepare(`
        INSERT INTO proposed_bookings (proposal_id, session_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `),

      // Proposed booking rooms now have per-room dates
      insertProposedBookingRoom: this.db.prepare(
        'INSERT INTO proposed_booking_rooms (proposal_id, room_id, start_date, end_date) VALUES (?, ?, ?, ?)'
      ),

      deleteProposedBooking: this.db.prepare('DELETE FROM proposed_bookings WHERE proposal_id = ?'),

      deleteExpiredProposedBookings: this.db.prepare(
        'DELETE FROM proposed_bookings WHERE expires_at < ?'
      ),

      // Updated query - dates now in proposed_booking_rooms
      getProposedBookingsByDateRange: this.db.prepare(`
        SELECT pb.proposal_id, pb.session_id, pb.created_at, pb.expires_at,
               pbr.room_id, pbr.start_date, pbr.end_date
        FROM proposed_bookings pb
        JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
        WHERE pbr.start_date <= ? AND pbr.end_date >= ?
          AND pb.expires_at > ?
      `),

      getProposedBookingsBySession: this.db.prepare(`
        SELECT pb.*, GROUP_CONCAT(pbr.room_id || ':' || pbr.start_date || ':' || pbr.end_date) as room_data
        FROM proposed_bookings pb
        LEFT JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
        WHERE pb.session_id = ? AND pb.expires_at > ?
        GROUP BY pb.proposal_id
      `),

      deleteProposedBookingsBySession: this.db.prepare(
        'DELETE FROM proposed_bookings WHERE session_id = ?'
      ),

      // Guest names - room_id and guest_type are now required (NOT NULL)
      insertGuestName: this.db.prepare(`
        INSERT INTO guest_names (booking_id, room_id, person_type, first_name, last_name, guest_type, order_index, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),

      deleteGuestNamesByBooking: this.db.prepare('DELETE FROM guest_names WHERE booking_id = ?'),

      // Simplified ORDER BY - room_id is never NULL now
      getGuestNamesByBooking: this.db.prepare(`
        SELECT room_id, person_type, first_name, last_name, guest_type, order_index
        FROM guest_names
        WHERE booking_id = ?
        ORDER BY
          room_id,
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

      // Reservation groups
      insertReservationGroup: this.db.prepare(`
        INSERT INTO reservation_groups (group_id, session_id, total_price, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `),

      updateReservationGroupPrice: this.db.prepare(`
        UPDATE reservation_groups SET total_price = ?, updated_at = ? WHERE group_id = ?
      `),

      getReservationGroup: this.db.prepare(`
        SELECT * FROM reservation_groups WHERE group_id = ?
      `),

      getAllReservationGroups: this.db.prepare(`
        SELECT * FROM reservation_groups ORDER BY created_at DESC
      `),

      deleteReservationGroup: this.db.prepare(`
        DELETE FROM reservation_groups WHERE group_id = ?
      `),

      getBookingsByGroupId: this.db.prepare(`
        SELECT * FROM bookings WHERE group_id = ? ORDER BY start_date
      `),

      updateBookingGroupId: this.db.prepare(`
        UPDATE bookings SET group_id = ?, updated_at = ? WHERE id = ?
      `),
    };
  }

  // Booking operations
  // NEW UNIFIED SCHEMA (2025-12-04): guest_type derived from guest_names
  createBooking(bookingData) {
    const transaction = this.db.transaction((data) => {
      // Insert booking - simplified (no guest_type, adults, children, toddlers)
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
        total_price: data.totalPrice,
        notes: data.notes || null,
        is_bulk_booking: data.isBulkBooking ? 1 : 0,
        paid: data.paid ? 1 : 0,
        pay_from_benefit: data.payFromBenefit ? 1 : 0,
        edit_token: data.editToken,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      });

      // Insert room associations with per-room dates and guest counts
      // FIX 2025-12-06: Deduplicate rooms to prevent UNIQUE constraint violation
      const uniqueRooms = data.rooms && data.rooms.length > 0
        ? [...new Set(data.rooms.filter(r => r != null && r !== ''))]
        : [];

      for (const roomId of uniqueRooms) {
        // Use per-room dates if available, otherwise use booking-level dates
        let roomStartDate = data.startDate;
        let roomEndDate = data.endDate;
        let roomAdults = 0;
        let roomChildren = 0;
        let roomToddlers = 0;

        if (data.perRoomDates && data.perRoomDates[roomId]) {
          roomStartDate = data.perRoomDates[roomId].startDate;
          roomEndDate = data.perRoomDates[roomId].endDate;
        }

        // Use per-room guest counts if available
        if (data.perRoomGuests && data.perRoomGuests[roomId]) {
          roomAdults = data.perRoomGuests[roomId].adults ?? 0;
          roomChildren = data.perRoomGuests[roomId].children ?? 0;
          roomToddlers = data.perRoomGuests[roomId].toddlers ?? 0;
        }

        // No guest_type parameter - removed from schema
        this.statements.insertBookingRoom.run(
          data.id,
          roomId,
          roomStartDate,
          roomEndDate,
          roomAdults,
          roomChildren,
          roomToddlers
        );
      }

      // Insert guest names - room_id and guest_type are now REQUIRED
      if (data.guestNames && Array.isArray(data.guestNames)) {
        const now = new Date().toISOString();
        data.guestNames.forEach((guest, index) => {
          // Validate required fields
          if (!guest.roomId) {
            throw new Error(`Guest ${guest.firstName} ${guest.lastName} is missing roomId`);
          }
          this.statements.insertGuestName.run(
            data.id,
            guest.roomId, // Now required
            guest.personType,
            guest.firstName,
            guest.lastName,
            guest.guestPriceType || 'external', // Default to external if not specified
            index + 1,
            now
          );
        });
      }
    });

    return transaction(bookingData);
  }

  updateBooking(id, bookingData) {
    const transaction = this.db.transaction((bookingId, data) => {
      // Update booking - simplified (no guest_type, adults, children, toddlers)
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
        total_price: data.totalPrice,
        notes: data.notes || null,
        is_bulk_booking: data.isBulkBooking ? 1 : 0,
        paid: data.paid ? 1 : 0,
        pay_from_benefit: data.payFromBenefit ? 1 : 0,
        updated_at: new Date().toISOString(),
      });

      // Update rooms (delete and re-insert) - no guest_type
      // FIX 2025-12-06: Deduplicate rooms to prevent UNIQUE constraint violation
      this.statements.deleteBookingRooms.run(bookingId);
      const uniqueRooms = data.rooms && data.rooms.length > 0
        ? [...new Set(data.rooms.filter(r => r != null && r !== ''))]
        : [];

      for (const roomId of uniqueRooms) {
        let roomStartDate = data.startDate;
        let roomEndDate = data.endDate;
        let roomAdults = 0;
        let roomChildren = 0;
        let roomToddlers = 0;

        if (data.perRoomDates && data.perRoomDates[roomId]) {
          roomStartDate = data.perRoomDates[roomId].startDate;
          roomEndDate = data.perRoomDates[roomId].endDate;
        }

        if (data.perRoomGuests && data.perRoomGuests[roomId]) {
          roomAdults = data.perRoomGuests[roomId].adults ?? 0;
          roomChildren = data.perRoomGuests[roomId].children ?? 0;
          roomToddlers = data.perRoomGuests[roomId].toddlers ?? 0;
        }

        this.statements.insertBookingRoom.run(
          bookingId,
          roomId,
          roomStartDate,
          roomEndDate,
          roomAdults,
          roomChildren,
          roomToddlers
        );
      }

      // Update guest names - room_id and guest_type are now REQUIRED
      this.statements.deleteGuestNamesByBooking.run(bookingId);
      if (data.guestNames && Array.isArray(data.guestNames)) {
        const now = new Date().toISOString();
        data.guestNames.forEach((guest, index) => {
          if (!guest.roomId) {
            throw new Error(`Guest ${guest.firstName} ${guest.lastName} is missing roomId`);
          }
          this.statements.insertGuestName.run(
            bookingId,
            guest.roomId,
            guest.personType,
            guest.firstName,
            guest.lastName,
            guest.guestPriceType || 'external',
            index + 1,
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
      // Get associated rooms with per-room dates and guest counts
      const roomRows = this.statements.getBookingRooms.all(id);
      const rooms = roomRows.map((r) => r.room_id);

      // Build perRoomDates and perRoomGuests objects
      const perRoomDates = {};
      const perRoomGuests = {};
      roomRows.forEach((row) => {
        perRoomDates[row.room_id] = {
          startDate: row.start_date,
          endDate: row.end_date,
        };
        perRoomGuests[row.room_id] = {
          adults: row.adults ?? 0,
          children: row.children ?? 0,
          toddlers: row.toddlers ?? 0,
        };
      });

      // Get guest names - now includes room_id and guest_type
      const guestNameRows = this.statements.getGuestNamesByBooking.all(id);
      const guestNames = guestNameRows.map((row) => ({
        roomId: row.room_id,
        personType: row.person_type,
        firstName: row.first_name,
        lastName: row.last_name,
        guestPriceType: row.guest_type,
      }));

      // Derive guest_type from guest_names (SSOT)
      // Rule: If at least one paying guest (adult/child) is ÚTIA, use ÚTIA rate for empty room
      const hasUtiaGuest = guestNames.some(
        (g) => g.guestPriceType === 'utia' && g.personType !== 'toddler'
      );
      const derivedGuestType = hasUtiaGuest ? 'utia' : 'external';

      // Derive guest type breakdown from guest_names (SSOT)
      const guestTypeBreakdown = {
        utiaAdults: guestNames.filter(
          (g) => g.personType === 'adult' && g.guestPriceType === 'utia'
        ).length,
        externalAdults: guestNames.filter(
          (g) => g.personType === 'adult' && g.guestPriceType === 'external'
        ).length,
        utiaChildren: guestNames.filter(
          (g) => g.personType === 'child' && g.guestPriceType === 'utia'
        ).length,
        externalChildren: guestNames.filter(
          (g) => g.personType === 'child' && g.guestPriceType === 'external'
        ).length,
      };

      // FIX 2025-12-06: Derive guest counts from guestNames (SSOT), NOT from booking_rooms
      // Previously: summing perRoomGuests caused 9×10=90 for bulk bookings
      // Now: count directly from guestNames which is the single source of truth
      const totalAdults = (guestNames || []).filter((g) => g?.personType === 'adult').length;
      const totalChildren = (guestNames || []).filter((g) => g?.personType === 'child').length;
      const totalToddlers = (guestNames || []).filter((g) => g?.personType === 'toddler').length;

      // Return booking with derived values
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
        perRoomDates,
        perRoomGuests,
        guestType: derivedGuestType, // Derived from guest_names
        guestTypeBreakdown, // Derived from guest_names
        isBulkBooking: Boolean(booking.is_bulk_booking),
        adults: totalAdults, // Derived from guestNames (SSOT)
        children: totalChildren,
        toddlers: totalToddlers,
        totalPrice: booking.total_price,
        notes: booking.notes,
        paid: Boolean(booking.paid),
        payFromBenefit: Boolean(booking.pay_from_benefit),
        editToken: booking.edit_token,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        guestNames,
        groupId: booking.group_id || null, // FIX 2025-12-09: Include group_id for grouped bookings
      };
    }
    return null;
  }

  getBookingByEditToken(editToken) {
    const stmt = this.db.prepare('SELECT * FROM bookings WHERE edit_token = ?');
    const booking = stmt.get(editToken);

    if (booking) {
      // Reuse getBooking() logic for consistency
      return this.getBooking(booking.id);
    }
    return null;
  }

  // ============================================================
  // GROUPED BOOKING OPERATIONS (2025-12-09)
  // ============================================================

  /**
   * Generate a unique group ID
   */
  generateGroupId() {
    return IdGenerator.generateBookingId().replace('RES-', 'GRP-');
  }

  /**
   * Create a grouped booking (multiple reservations in one transaction)
   * @param {Object} groupData - Group data including sessionId, reservations, and contact info
   * @returns {Object} - Created group with all bookings
   */
  createGroupedBooking(groupData) {
    const { sessionId, reservations, contact } = groupData;

    const transaction = this.db.transaction(() => {
      const groupId = this.generateGroupId();
      const now = new Date().toISOString();
      const createdBookings = [];
      let totalGroupPrice = 0;

      // Create reservation group
      this.statements.insertReservationGroup.run(groupId, sessionId, 0, now, now);

      // Create individual bookings for each reservation
      for (let i = 0; i < reservations.length; i++) {
        const reservation = reservations[i];
        const bookingId = IdGenerator.generateBookingId();
        const editToken = IdGenerator.generateToken(12);

        // Insert booking with group link
        this.db.prepare(`
          INSERT INTO bookings (
            id, name, email, phone, company, address, city, zip, ico, dic,
            start_date, end_date, total_price, notes, is_bulk_booking,
            paid, pay_from_benefit, edit_token, created_at, updated_at, group_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          bookingId,
          contact.name,
          contact.email,
          contact.phone,
          contact.company || null,
          contact.address || null,
          contact.city || null,
          contact.zip || null,
          contact.ico || null,
          contact.dic || null,
          reservation.startDate,
          reservation.endDate,
          reservation.totalPrice || 0,
          contact.notes || null,
          reservation.isBulkBooking ? 1 : 0,
          0, // paid
          0, // pay_from_benefit
          editToken,
          now,
          now,
          groupId
        );

        // Insert room associations
        const rooms = reservation.rooms || [];
        const uniqueRooms = [...new Set(rooms.filter(r => r != null && r !== ''))];

        for (const roomId of uniqueRooms) {
          const roomDates = reservation.perRoomDates?.[roomId] || {
            startDate: reservation.startDate,
            endDate: reservation.endDate
          };
          const roomGuests = reservation.perRoomGuests?.[roomId] || {
            adults: 0, children: 0, toddlers: 0
          };

          this.statements.insertBookingRoom.run(
            bookingId,
            roomId,
            roomDates.startDate,
            roomDates.endDate,
            roomGuests.adults || 0,
            roomGuests.children || 0,
            roomGuests.toddlers || 0
          );
        }

        // Insert guest names
        if (reservation.guestNames && Array.isArray(reservation.guestNames)) {
          reservation.guestNames.forEach((guest, index) => {
            if (!guest.roomId && uniqueRooms.length > 0) {
              guest.roomId = uniqueRooms[0]; // Default to first room if not specified
            }
            this.statements.insertGuestName.run(
              bookingId,
              guest.roomId,
              guest.personType,
              guest.firstName,
              guest.lastName,
              guest.guestPriceType || 'external',
              index + 1,
              now
            );
          });
        }

        totalGroupPrice += reservation.totalPrice || 0;
        createdBookings.push({
          id: bookingId,
          editToken,
          rooms: uniqueRooms,
          startDate: reservation.startDate,
          endDate: reservation.endDate,
          totalPrice: reservation.totalPrice || 0,
          isBulkBooking: reservation.isBulkBooking || false
        });
      }

      // Update group total price
      this.statements.updateReservationGroupPrice.run(totalGroupPrice, now, groupId);

      return {
        groupId,
        bookings: createdBookings,
        totalPrice: totalGroupPrice,
        createdAt: now
      };
    });

    return transaction();
  }

  /**
   * Get a reservation group with all its bookings
   * @param {string} groupId - The group ID
   * @returns {Object|null} - Group with bookings or null
   */
  getBookingGroup(groupId) {
    const group = this.statements.getReservationGroup.get(groupId);
    if (!group) {
      return null;
    }

    // Get all bookings in this group
    const bookingRows = this.statements.getBookingsByGroupId.all(groupId);
    const bookings = bookingRows.map(row => this.getBooking(row.id));

    return {
      groupId: group.group_id,
      sessionId: group.session_id,
      totalPrice: group.total_price,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      bookings,
      bookingCount: bookings.length
    };
  }

  /**
   * Get all bookings grouped by group_id
   * Returns both grouped and ungrouped bookings
   * @returns {Object} - { groups: [...], ungrouped: [...] }
   */
  getGroupedBookings() {
    const allBookings = this.getAllBookings();
    const groups = new Map();
    const ungrouped = [];

    for (const booking of allBookings) {
      // Check if booking has group_id
      const groupId = this.db.prepare('SELECT group_id FROM bookings WHERE id = ?').get(booking.id)?.group_id;

      if (groupId) {
        if (!groups.has(groupId)) {
          const groupData = this.statements.getReservationGroup.get(groupId);
          groups.set(groupId, {
            groupId,
            sessionId: groupData?.session_id,
            totalPrice: groupData?.total_price || 0,
            createdAt: groupData?.created_at,
            updatedAt: groupData?.updated_at,
            bookings: []
          });
        }
        groups.get(groupId).bookings.push(booking);
      } else {
        ungrouped.push(booking);
      }
    }

    // Convert Map to array and add computed fields
    const groupsArray = Array.from(groups.values()).map(group => ({
      ...group,
      bookingCount: group.bookings.length,
      // Compute date range across all bookings
      startDate: group.bookings.reduce((min, b) => b.startDate < min ? b.startDate : min, group.bookings[0]?.startDate),
      endDate: group.bookings.reduce((max, b) => b.endDate > max ? b.endDate : max, group.bookings[0]?.endDate),
      // Compute room list
      rooms: [...new Set(group.bookings.flatMap(b => b.rooms))],
      // Use first booking's contact info (all should be same)
      name: group.bookings[0]?.name,
      email: group.bookings[0]?.email,
      phone: group.bookings[0]?.phone,
      // Check if any booking is paid
      paid: group.bookings.every(b => b.paid),
      // Check if any booking is bulk
      hasBulkBooking: group.bookings.some(b => b.isBulkBooking)
    }));

    return {
      groups: groupsArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      ungrouped
    };
  }

  /**
   * Recalculate and update the total price for a group
   * @param {string} groupId - The group ID
   * @returns {number} - New total price
   */
  updateBookingGroupPrice(groupId) {
    const bookingRows = this.statements.getBookingsByGroupId.all(groupId);
    let totalPrice = 0;

    for (const row of bookingRows) {
      totalPrice += row.total_price || 0;
    }

    const now = new Date().toISOString();
    this.statements.updateReservationGroupPrice.run(totalPrice, now, groupId);

    return totalPrice;
  }

  /**
   * Delete an empty reservation group
   * @param {string} groupId - The group ID
   */
  deleteReservationGroup(groupId) {
    // Check if group has any bookings
    const bookings = this.statements.getBookingsByGroupId.all(groupId);
    if (bookings.length > 0) {
      throw new Error('Cannot delete group with existing bookings');
    }

    return this.statements.deleteReservationGroup.run(groupId);
  }

  getAllBookings() {
    // NEW UNIFIED SCHEMA (2025-12-04): Simplified query, derive values from guest_names
    // UPDATED 2025-12-09: Include group_id for grouped bookings
    const query = `
      SELECT
        b.*,
        b.group_id,
        GROUP_CONCAT(
          br.room_id || ':' ||
          br.start_date || ':' ||
          br.end_date || ':' ||
          COALESCE(br.adults, 0) || ':' ||
          COALESCE(br.children, 0) || ':' ||
          COALESCE(br.toddlers, 0)
        ) as room_data
      FROM bookings b
      LEFT JOIN booking_rooms br ON b.id = br.booking_id
      GROUP BY b.id
      ORDER BY b.start_date DESC
    `;

    const bookings = this.db.prepare(query).all();

    return bookings.map((booking) => {
      // Parse room_data to extract rooms, per-room dates, and per-room guest counts
      const rooms = [];
      const perRoomDates = {};
      const perRoomGuests = {};

      if (booking.room_data) {
        const roomEntries = booking.room_data.split(',');
        roomEntries.forEach((entry) => {
          const [roomId, startDate, endDate, adults, children, toddlers] = entry.split(':');
          rooms.push(roomId);
          perRoomDates[roomId] = { startDate, endDate };

          const adultsNum = parseInt(adults, 10) || 0;
          const childrenNum = parseInt(children, 10) || 0;
          const toddlersNum = parseInt(toddlers, 10) || 0;

          perRoomGuests[roomId] = {
            adults: adultsNum,
            children: childrenNum,
            toddlers: toddlersNum,
          };
        });
      }

      // Fetch guest names - SSOT for guest types AND guest counts
      const guestNameRows = this.statements.getGuestNamesByBooking.all(booking.id);
      const guestNames = guestNameRows.map((row) => ({
        roomId: row.room_id,
        personType: row.person_type,
        firstName: row.first_name,
        lastName: row.last_name,
        guestPriceType: row.guest_type,
      }));

      // Derive guest_type from guest_names (SSOT)
      const hasUtiaGuest = guestNames.some(
        (g) => g.guestPriceType === 'utia' && g.personType !== 'toddler'
      );
      const derivedGuestType = hasUtiaGuest ? 'utia' : 'external';

      // Derive guest type breakdown from guest_names
      const guestTypeBreakdown = {
        utiaAdults: guestNames.filter(
          (g) => g.personType === 'adult' && g.guestPriceType === 'utia'
        ).length,
        externalAdults: guestNames.filter(
          (g) => g.personType === 'adult' && g.guestPriceType === 'external'
        ).length,
        utiaChildren: guestNames.filter(
          (g) => g.personType === 'child' && g.guestPriceType === 'utia'
        ).length,
        externalChildren: guestNames.filter(
          (g) => g.personType === 'child' && g.guestPriceType === 'external'
        ).length,
      };

      // FIX 2025-12-06: Derive guest counts from guestNames (SSOT), NOT from booking_rooms
      // Previously: summing perRoomGuests caused 9×10=90 for bulk bookings
      const totalAdults = guestNames.filter((g) => g.personType === 'adult').length;
      const totalChildren = guestNames.filter((g) => g.personType === 'child').length;
      const totalToddlers = guestNames.filter((g) => g.personType === 'toddler').length;

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
        perRoomDates,
        perRoomGuests,
        guestType: derivedGuestType, // Derived from guest_names
        guestTypeBreakdown, // Derived from guest_names
        adults: totalAdults, // Derived from booking_rooms
        children: totalChildren,
        toddlers: totalToddlers,
        totalPrice: booking.total_price,
        isBulkBooking: Boolean(booking.is_bulk_booking),
        notes: booking.notes,
        paid: Boolean(booking.paid),
        payFromBenefit: Boolean(booking.pay_from_benefit),
        editToken: booking.edit_token,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        guestNames,
        groupId: booking.group_id || null, // FIX 2025-12-09: Include group_id for grouped bookings
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
  // NEW UNIFIED SCHEMA (2025-12-04): Simplified - only reservation dates per room
  createProposedBooking(sessionId, rooms, perRoomDates = {}) {
    const proposalId = this.generateProposalId();
    const now = new Date().toISOString();
    // FIX 2025-12-05: Increased from 15 to 60 minutes to give users more time to complete booking
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // Expires in 60 minutes

    const transaction = this.db.transaction(() => {
      // Insert proposed booking header
      this.statements.insertProposedBooking.run(proposalId, sessionId, now, expiresAt);

      // Insert room associations with per-room dates
      for (const roomId of rooms) {
        const dates = perRoomDates[roomId] || {};
        const startDate = dates.startDate || dates.start_date;
        const endDate = dates.endDate || dates.end_date;

        if (!startDate || !endDate) {
          throw new Error(`Missing dates for room ${roomId} in proposed booking`);
        }

        this.statements.insertProposedBookingRoom.run(proposalId, roomId, startDate, endDate);
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
    // NEW SCHEMA: Get per-room dates
    const query = `
      SELECT pb.proposal_id, pb.session_id, pb.created_at, pb.expires_at,
             GROUP_CONCAT(pbr.room_id || ':' || pbr.start_date || ':' || pbr.end_date) as room_data
      FROM proposed_bookings pb
      JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
      WHERE pb.session_id = ? AND pb.expires_at > ?
      GROUP BY pb.proposal_id
    `;
    const results = this.db.prepare(query).all(sessionId, now);

    // Parse room_data to extract rooms and per-room dates
    return results.map((booking) => {
      const rooms = [];
      const perRoomDates = {};

      if (booking.room_data) {
        booking.room_data.split(',').forEach((entry) => {
          const [roomId, startDate, endDate] = entry.split(':');
          rooms.push(roomId);
          perRoomDates[roomId] = { startDate, endDate };
        });
      }

      return {
        proposalId: booking.proposal_id,
        sessionId: booking.session_id,
        createdAt: booking.created_at,
        expiresAt: booking.expires_at,
        rooms,
        perRoomDates,
      };
    });
  }

  getProposedBookingsByDateRange(startDate, endDate) {
    const now = new Date().toISOString();
    return this.statements.getProposedBookingsByDateRange.all(endDate, startDate, now);
  }

  getActiveProposedBookings() {
    const now = new Date().toISOString();
    // NEW SCHEMA: Get per-room dates
    const query = `
      SELECT pb.proposal_id, pb.session_id, pb.created_at, pb.expires_at,
             GROUP_CONCAT(pbr.room_id || ':' || pbr.start_date || ':' || pbr.end_date) as room_data
      FROM proposed_bookings pb
      JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
      WHERE pb.expires_at > ?
      GROUP BY pb.proposal_id
    `;
    const results = this.db.prepare(query).all(now);

    // Parse room_data to extract rooms and per-room dates
    return results.map((booking) => {
      const rooms = [];
      const perRoomDates = {};

      if (booking.room_data) {
        booking.room_data.split(',').forEach((entry) => {
          const [roomId, startDate, endDate] = entry.split(':');
          rooms.push(roomId);
          perRoomDates[roomId] = { startDate, endDate };
        });
      }

      return {
        proposalId: booking.proposal_id,
        sessionId: booking.session_id,
        createdAt: booking.created_at,
        expiresAt: booking.expires_at,
        rooms,
        perRoomDates,
      };
    });
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
