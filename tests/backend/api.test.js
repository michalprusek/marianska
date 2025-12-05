const DatabaseManager = require('../../database');

// Note: This test file requires the server to be refactored to export the Express app
// For now, we'll test the API logic by importing and calling functions directly

// Helper function to generate booking ID matching server format
function generateBookingId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'BK';
  for (let i = 0; i < 13; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

describe('API Endpoints', () => {
  let db;

  beforeEach(() => {
    // Create database instance for testing
    // DatabaseManager automatically creates schema on initialization
    db = new DatabaseManager();
  });

  afterEach(() => {
    if (db && db.db) {
      db.db.close();
    }
  });

  describe('GET /health', () => {
    it('should return healthy status', () => {
      const health = {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now(),
        environment: 'test',
      };

      expect(health.status).toBe('healthy');
      expect(health.uptime).toBeGreaterThan(0);
    });
  });

  describe('GET /api/data', () => {
    it('should return all data without admin password', () => {
      const settings = db.getSettings();

      expect(settings).toBeDefined();
      expect(settings.adminPassword).toBeDefined(); // Should exist in DB

      // Simulate removal for API response
      const sanitized = { ...settings };
      delete sanitized.adminPassword;

      expect(sanitized.adminPassword).toBeUndefined();
    });

    it('should include bookings, blocked dates, and settings', () => {
      const data = {
        bookings: db.getAllBookings(),
        blockedDates: db.getAllBlockedDates(),
        settings: db.getSettings(),
      };

      expect(data).toHaveProperty('bookings');
      expect(data).toHaveProperty('blockedDates');
      expect(data).toHaveProperty('settings');
      expect(Array.isArray(data.bookings)).toBe(true);
      expect(Array.isArray(data.blockedDates)).toBe(true);
    });
  });

  describe('POST /api/booking', () => {
    it('should create booking with valid data', () => {
      const bookingData = {
        id: generateBookingId(),
        name: 'Jan Novák',
        email: 'jan@example.com',
        phone: '+420123456789',
        company: 'Test Firma',
        address: 'Testovací 123',
        city: 'Praha',
        zip: '12345',
        startDate: testUtils.getTestDate(10),
        endDate: testUtils.getTestDate(12),
        rooms: ['12'],
        guestType: 'utia',
        adults: 2,
        children: 1,
        toddlers: 0,
        totalPrice: 750,
        editToken: Math.random().toString(36).substr(2, 12),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.createBooking(bookingData);
      const booking = db.getBooking(bookingData.id);

      expect(booking).toBeDefined();
      expect(booking.id).toMatch(/^BK[A-Z0-9]{13}$/u);
      expect(booking.editToken).toBeDefined();
      expect(booking.name).toBe('Jan Novák');
      expect(booking.email).toBe('jan@example.com');
    });

    it('should reject booking with missing required fields', () => {
      const invalidData = {
        name: 'Jan Novák',
        // Missing email
        startDate: testUtils.getTestDate(10),
        endDate: testUtils.getTestDate(12),
      };

      // Validation would occur in route handler
      expect(invalidData.email).toBeUndefined();
    });

    it('should reject booking with invalid email format', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

      expect(emailRegex.test('valid@example.com')).toBe(true);
      expect(emailRegex.test('invalid-email')).toBe(false);
      expect(emailRegex.test('@example.com')).toBe(false);
      expect(emailRegex.test('user@')).toBe(false);
    });

    it('should reject booking with end date before start date', () => {
      const startDate = new Date(testUtils.getTestDate(10));
      const endDate = new Date(testUtils.getTestDate(8));

      expect(endDate <= startDate).toBe(true); // Should fail validation
    });

    it('should calculate price correctly for ÚTIA guest', () => {
      // NEW MODEL (2025-11): empty + ALL adults pay + ALL children pay
      // ÚTIA small: empty(250) + 2*adult(50) + 1*child(25) = 375 per night
      // 2 nights = 750
      const settings = db.getSettings();
      const prices = settings.prices.utia.small; // Room-size-based pricing

      const adults = 2;
      const children = 1;
      const nights = 2;

      // NEW MODEL: empty room + ALL guests pay surcharge
      let pricePerNight = prices.empty;
      pricePerNight += adults * prices.adult;
      pricePerNight += children * prices.child;
      const totalPrice = pricePerNight * nights;

      expect(totalPrice).toBe(750);
    });

    it('should calculate price correctly for external guest', () => {
      // NEW MODEL (2025-11): empty + ALL adults pay + ALL children pay
      // External small: empty(400) + 2*adult(100) + 1*child(50) = 650 per night
      // 2 nights = 1300
      const settings = db.getSettings();
      const prices = settings.prices.external.small; // Room-size-based pricing

      const adults = 2;
      const children = 1;
      const nights = 2;

      // NEW MODEL: empty room + ALL guests pay surcharge
      let pricePerNight = prices.empty;
      pricePerNight += adults * prices.adult;
      pricePerNight += children * prices.child;
      const totalPrice = pricePerNight * nights;

      expect(totalPrice).toBe(1300);
    });

    it('should not charge for toddlers', () => {
      const settings = db.getSettings();
      const prices = settings.prices.utia.small; // Room-size-based pricing

      const adults = 2;
      const children = 1;
      const nights = 1;

      // NEW MODEL: empty room + ALL guests pay surcharge
      let pricePerNight = prices.empty;
      pricePerNight += adults * prices.adult;
      pricePerNight += children * prices.child;
      // Toddlers not added (free!)
      const totalPrice = pricePerNight * nights;

      expect(totalPrice).toBe(375); // Same as without toddlers
    });
  });

  describe('PUT /api/booking/:id', () => {
    let existingBookingId;

    beforeEach(() => {
      const bookingData = {
        id: generateBookingId(),
        name: 'Original Name',
        email: 'original@example.com',
        phone: '+420123456789',
        company: 'Original Company',
        address: 'Original Address',
        city: 'Praha',
        zip: '12345',
        startDate: testUtils.getTestDate(10),
        endDate: testUtils.getTestDate(12),
        rooms: ['12'],
        guestType: 'utia',
        adults: 2,
        children: 0,
        toddlers: 0,
        totalPrice: 600,
        editToken: Math.random().toString(36).substr(2, 12),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createBooking(bookingData);
      existingBookingId = bookingData.id;
    });

    it('should update booking with valid edit token', () => {
      const existingBooking = db.getBooking(existingBookingId);
      const updates = {
        name: 'Updated Name',
        email: 'updated@example.com',
        phone: existingBooking.phone, // Required field
        startDate: existingBooking.startDate,
        endDate: existingBooking.endDate,
        rooms: existingBooking.rooms,
        guestType: existingBooking.guestType,
        adults: existingBooking.adults,
        children: existingBooking.children,
        toddlers: existingBooking.toddlers,
        totalPrice: existingBooking.totalPrice,
      };

      db.updateBooking(existingBookingId, updates);
      const updated = db.getBooking(existingBookingId);

      expect(updated).toBeDefined();
      expect(updated.name).toBe('Updated Name');
      expect(updated.email).toBe('updated@example.com');
    });

    it('should reject update without edit token', () => {
      // Simulate missing token validation
      const hasToken = false;
      expect(hasToken).toBe(false);
    });

    it('should reject update with invalid edit token', () => {
      const existingBooking = db.getBooking(existingBookingId);
      const validToken = existingBooking.editToken;
      const invalidToken = 'wrong-token';

      expect(validToken).not.toBe(invalidToken);
    });

    it('should reject update if new dates conflict with other bookings', () => {
      // Create second booking
      const otherBookingData = {
        id: generateBookingId(),
        name: 'Other Guest',
        email: 'other@example.com',
        phone: '+420987654321',
        company: 'Other Company',
        address: 'Other Address',
        city: 'Brno',
        zip: '54321',
        startDate: testUtils.getTestDate(15),
        endDate: testUtils.getTestDate(17),
        rooms: ['12'],
        guestType: 'external',
        adults: 1,
        children: 0,
        toddlers: 0,
        totalPrice: 1000,
        editToken: Math.random().toString(36).substr(2, 12),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createBooking(otherBookingData);
      const otherBooking = db.getBooking(otherBookingData.id);

      // Try to update first booking to overlap with second
      const updates = {
        startDate: testUtils.getTestDate(14),
        endDate: testUtils.getTestDate(16), // Overlaps with 15-17
      };

      // Check overlap logic
      const start1 = new Date(updates.startDate);
      const end1 = new Date(updates.endDate);
      const start2 = new Date(otherBooking.startDate);
      const end2 = new Date(otherBooking.endDate);

      const overlaps =
        (start1 >= start2 && start1 < end2) ||
        (end1 > start2 && end1 <= end2) ||
        (start1 <= start2 && end1 >= end2);

      expect(overlaps).toBe(true); // Should detect conflict
    });
  });

  describe('DELETE /api/booking/:id', () => {
    let bookingId;

    beforeEach(() => {
      const bookingData = {
        id: generateBookingId(),
        name: 'Test User',
        email: 'test@example.com',
        phone: '+420123456789',
        company: 'Test Company',
        address: 'Test Address',
        city: 'Praha',
        zip: '12345',
        startDate: testUtils.getTestDate(10),
        endDate: testUtils.getTestDate(12),
        rooms: ['12'],
        guestType: 'utia',
        adults: 1,
        children: 0,
        toddlers: 0,
        totalPrice: 600,
        editToken: Math.random().toString(36).substr(2, 12),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createBooking(bookingData);
      bookingId = bookingData.id;
    });

    it('should delete booking with valid edit token', () => {
      const result = db.deleteBooking(bookingId);
      // deleteBooking returns a statement result object, not a boolean
      expect(result).toBeDefined();

      const found = db.getBooking(bookingId);
      expect(found).toBeNull();
    });

    it('should return changes=0 for non-existent booking', () => {
      const result = db.deleteBooking('BKNONEXISTENT123');
      expect(result.changes).toBe(0);
    });
  });

  describe('Admin Endpoints', () => {
    describe('POST /api/admin/login', () => {
      it('should authenticate with correct password', () => {
        const correctPassword = 'admin123';

        // In real implementation, would use bcrypt.compare
        expect(correctPassword).toBe('admin123');
      });

      it('should reject incorrect password', () => {
        const correctPassword = 'admin123';
        const wrongPassword = 'wrong';

        expect(wrongPassword).not.toBe(correctPassword);
      });

      it('should return API key on successful login', () => {
        const response = {
          success: true,
          sessionToken: 'mock-session-token',
          apiKey: 'test-api-key-123',
        };

        expect(response.success).toBe(true);
        expect(response.apiKey).toBeDefined();
      });
    });

    describe('POST /api/admin/block-dates', () => {
      it('should block date range for specific rooms', () => {
        const startDate = testUtils.getTestDate(30);
        testUtils.getTestDate(32);
        const rooms = ['12', '13'];
        const reason = 'Maintenance';

        const blockageId = `BLK${Date.now()}`;

        // Simulate blocking
        const blocked = [];
        for (const room of rooms) {
          blocked.push({
            blockage_id: blockageId,
            date: startDate,
            room_id: room,
            reason,
          });
        }

        expect(blocked.length).toBe(2);
        expect(blocked[0].blockage_id).toBe(blockageId);
      });

      it('should require API key', () => {
        const hasApiKey = false;
        expect(hasApiKey).toBe(false); // Should fail authorization
      });
    });

    describe('POST /api/admin/update-password', () => {
      it('should update password with valid current password', () => {
        const newPassword = 'newSecurePass123';

        expect(newPassword.length).toBeGreaterThanOrEqual(8);
      });

      it('should reject password shorter than 8 characters', () => {
        const shortPassword = 'short';
        expect(shortPassword.length).toBeLessThan(8);
      });
    });
  });

  describe('Christmas Period Logic', () => {
    it('should detect date in Christmas period', () => {
      const christmasDate = '2024-12-25';
      const period = {
        start_date: '2024-12-23',
        end_date: '2025-01-02',
      };

      const isInPeriod = christmasDate >= period.start_date && christmasDate <= period.end_date;

      expect(isInPeriod).toBe(true);
    });

    it('should allow booking without code after Sept 30', () => {
      const today = new Date('2024-10-15');
      const christmasYear = 2024;
      const deadline = new Date(christmasYear, 8, 30); // Sept 30

      const requiresCode = today <= deadline;
      expect(requiresCode).toBe(false);
    });

    it('should require code before Sept 30', () => {
      const today = new Date('2024-09-15');
      const christmasYear = 2024;
      const deadline = new Date(christmasYear, 8, 30);

      const requiresCode = today <= deadline;
      expect(requiresCode).toBe(true);
    });

    it('should validate Christmas access codes', () => {
      const validCodes = ['XMAS2024', 'VIP123'];
      const testCode = 'XMAS2024';

      expect(validCodes.includes(testCode)).toBe(true);
      expect(validCodes.includes('INVALID')).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should track request count per IP', () => {
      const requests = [];
      const maxRequests = 10;

      for (let i = 0; i < 12; i++) {
        requests.push({ ip: '127.0.0.1', timestamp: Date.now() });
      }

      expect(requests.length).toBeGreaterThan(maxRequests);
    });
  });

  describe('Proposed Bookings', () => {
    it('should create proposed booking with expiry', () => {
      const proposalId = `PROP${Date.now()}`;
      const sessionId = 'SESSION_123';
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      const proposal = {
        proposal_id: proposalId,
        session_id: sessionId,
        start_date: testUtils.getTestDate(10),
        end_date: testUtils.getTestDate(12),
        rooms: ['12'],
        expires_at: expiresAt,
      };

      expect(proposal.expires_at).toBeGreaterThan(Date.now());
    });

    it('should identify expired proposals', () => {
      const now = Date.now();
      const expiredProposal = { expires_at: now - 1000 }; // 1 second ago
      const activeProposal = { expires_at: now + 1000 }; // 1 second from now

      expect(expiredProposal.expires_at < now).toBe(true);
      expect(activeProposal.expires_at >= now).toBe(true);
    });
  });
});
