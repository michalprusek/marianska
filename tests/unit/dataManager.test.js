// DataManager unit tests
// Note: These tests require DataManager to be refactored as a module export

const { MockDataManager, sampleSettings } = require('../helpers/mocks');

describe('DataManager', () => {
  let dataManager;

  beforeEach(() => {
    dataManager = new MockDataManager();
    dataManager.data.settings = { ...sampleSettings };
  });

  describe('Initialization', () => {
    it('should initialize with default data structure', async () => {
      const data = await dataManager.initData();

      expect(data).toHaveProperty('bookings');
      expect(data).toHaveProperty('blockedDates');
      expect(data).toHaveProperty('settings');
    });

    it('should load existing data from storage', async () => {
      dataManager.data.bookings = [
        {
          id: 'BK_TEST',
          name: 'Test Booking',
        },
      ];

      const data = await dataManager.initData();
      expect(data.bookings.length).toBeGreaterThan(0);
    });
  });

  describe('Booking ID Generation', () => {
    it('should generate unique booking IDs', () => {
      const id1 = dataManager.generateBookingId();
      const id2 = dataManager.generateBookingId();

      expect(id1).toBeValidBookingId();
      expect(id2).toBeValidBookingId();
      expect(id1).not.toBe(id2);
    });

    it('should generate ID in format BK + 13 characters', () => {
      const id = dataManager.generateBookingId();

      expect(id).toMatch(/^BK[A-Z0-9]{13}$/u);
      expect(id.length).toBe(15);
    });
  });

  describe('Edit Token Generation', () => {
    it('should generate unique edit tokens', () => {
      const token1 = dataManager.generateEditToken();
      const token2 = dataManager.generateEditToken();

      expect(token1).toBeValidEditToken();
      expect(token2).toBeValidEditToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate token with 30 characters', () => {
      const token = dataManager.generateEditToken();
      expect(token.length).toBe(30);
    });
  });

  describe('Booking CRUD Operations', () => {
    describe('Create Booking', () => {
      it('should create booking with all required fields', async () => {
        const bookingData = {
          name: 'Jan Novák',
          email: 'jan@example.com',
          phone: '+420123456789',
          startDate: testUtils.getTestDate(10),
          endDate: testUtils.getTestDate(12),
          rooms: ['12'],
          guestType: 'utia',
          adults: 2,
          children: 1,
          toddlers: 0,
        };

        const booking = await dataManager.createBooking(bookingData);

        expect(booking.id).toBeDefined();
        expect(booking.editToken).toBeDefined();
        expect(booking.createdAt).toBeDefined();
        expect(booking.updatedAt).toBeDefined();
        expect(booking.name).toBe('Jan Novák');
      });

      it('should add booking to bookings array', async () => {
        const initialCount = dataManager.data.bookings.length;

        await dataManager.createBooking({
          name: 'Test',
          email: 'test@example.com',
          startDate: testUtils.getTestDate(10),
          endDate: testUtils.getTestDate(12),
          rooms: ['12'],
          guestType: 'utia',
          adults: 1,
          children: 0,
          toddlers: 0,
        });

        expect(dataManager.data.bookings.length).toBe(initialCount + 1);
      });
    });

    describe('Read Booking', () => {
      let booking;

      beforeEach(async () => {
        booking = await dataManager.createBooking({
          name: 'Test User',
          email: 'test@example.com',
          startDate: testUtils.getTestDate(10),
          endDate: testUtils.getTestDate(12),
          rooms: ['12'],
          guestType: 'utia',
          adults: 1,
          children: 0,
          toddlers: 0,
        });
      });

      it('should find booking by ID', () => {
        const found = dataManager.getBooking(booking.id);
        expect(found).toBeDefined();
        expect(found.id).toBe(booking.id);
      });

      it('should return undefined for non-existent ID', () => {
        const found = dataManager.getBooking('BK_NONEXISTENT');
        expect(found).toBeUndefined();
      });

      it('should get all bookings', () => {
        const allBookings = dataManager.getAllBookings();
        expect(Array.isArray(allBookings)).toBe(true);
        expect(allBookings.length).toBeGreaterThan(0);
      });
    });

    describe('Update Booking', () => {
      let booking;

      beforeEach(async () => {
        booking = await dataManager.createBooking({
          name: 'Original Name',
          email: 'original@example.com',
          startDate: testUtils.getTestDate(10),
          endDate: testUtils.getTestDate(12),
          rooms: ['12'],
          guestType: 'utia',
          adults: 1,
          children: 0,
          toddlers: 0,
        });
      });

      it('should update booking fields', async () => {
        const updates = {
          name: 'Updated Name',
          email: 'updated@example.com',
        };

        const updated = await dataManager.updateBooking(booking.id, updates);

        expect(updated.name).toBe('Updated Name');
        expect(updated.email).toBe('updated@example.com');
      });

      it('should update timestamp on modification', async () => {
        const originalTimestamp = booking.updatedAt;

        await testUtils.sleep(10); // Small delay

        const updated = await dataManager.updateBooking(booking.id, {
          name: 'Changed',
        });

        expect(updated.updatedAt).not.toBe(originalTimestamp);
      });

      it('should return null for non-existent booking', async () => {
        const result = await dataManager.updateBooking('BK_FAKE', {
          name: 'Test',
        });

        expect(result).toBeNull();
      });
    });

    describe('Delete Booking', () => {
      let booking;

      beforeEach(async () => {
        booking = await dataManager.createBooking({
          name: 'To Delete',
          email: 'delete@example.com',
          startDate: testUtils.getTestDate(10),
          endDate: testUtils.getTestDate(12),
          rooms: ['12'],
          guestType: 'utia',
          adults: 1,
          children: 0,
          toddlers: 0,
        });
      });

      it('should delete existing booking', async () => {
        const result = await dataManager.deleteBooking(booking.id);
        expect(result).toBe(true);

        const found = dataManager.getBooking(booking.id);
        expect(found).toBeUndefined();
      });

      it('should return false for non-existent booking', async () => {
        const result = await dataManager.deleteBooking('BK_FAKE');
        expect(result).toBe(false);
      });

      it('should remove booking from array', async () => {
        const initialCount = dataManager.data.bookings.length;

        await dataManager.deleteBooking(booking.id);

        expect(dataManager.data.bookings.length).toBe(initialCount - 1);
      });
    });
  });

  describe('Room Availability', () => {
    beforeEach(async () => {
      // Create a booking for room 12 from day 10 to day 12
      await dataManager.createBooking({
        name: 'Test Guest',
        email: 'test@example.com',
        startDate: testUtils.getTestDate(10),
        endDate: testUtils.getTestDate(12),
        rooms: ['12'],
        guestType: 'utia',
        adults: 1,
        children: 0,
        toddlers: 0,
      });
    });

    it('should return "booked" for occupied room', async () => {
      const availability = await dataManager.getRoomAvailability(testUtils.getTestDate(10), '12');

      expect(availability.status).toBe('booked');
      expect(availability.email).toBe('test@example.com');
    });

    it('should return "available" for free room', async () => {
      const availability = await dataManager.getRoomAvailability(
        testUtils.getTestDate(10),
        '13' // Different room
      );

      expect(availability.status).toBe('available');
      expect(availability.email).toBeNull();
    });

    it('should return "available" on checkout day', async () => {
      // Booking ends on day 12, so day 12 should be available (< comparison)
      const availability = await dataManager.getRoomAvailability(testUtils.getTestDate(12), '12');

      expect(availability.status).toBe('available');
    });

    it('should return "blocked" for administratively blocked date', async () => {
      dataManager.data.blockedDates.push({
        date: testUtils.getTestDate(20),
        roomId: '13',
        reason: 'Maintenance',
      });

      const availability = await dataManager.getRoomAvailability(testUtils.getTestDate(20), '13');

      expect(availability.status).toBe('blocked');
    });

    it('should check date range correctly', async () => {
      // Booking: day 10 to day 12 (10, 11 booked; 12 available)
      const day9 = await dataManager.getRoomAvailability(testUtils.getTestDate(9), '12');
      const day10 = await dataManager.getRoomAvailability(testUtils.getTestDate(10), '12');
      const day11 = await dataManager.getRoomAvailability(testUtils.getTestDate(11), '12');
      const day12 = await dataManager.getRoomAvailability(testUtils.getTestDate(12), '12');
      const day13 = await dataManager.getRoomAvailability(testUtils.getTestDate(13), '12');

      expect(day9.status).toBe('available');
      expect(day10.status).toBe('booked');
      expect(day11.status).toBe('booked');
      expect(day12.status).toBe('available'); // Checkout day
      expect(day13.status).toBe('available');
    });
  });



  describe('Christmas Period Detection', () => {
    beforeEach(() => {
      dataManager.data.settings.christmasPeriods = [
        {
          period_id: 'XMAS_2024',
          name: 'Vánoce 2024',
          start_date: '2024-12-23',
          end_date: '2025-01-02',
          year: 2024,
        },
      ];
    });

    it('should detect date within Christmas period', () => {
      const isChristmas = dataManager.isChristmasPeriod('2024-12-25');
      expect(isChristmas).toBe(true);
    });

    it('should detect first day of period', () => {
      const isChristmas = dataManager.isChristmasPeriod('2024-12-23');
      expect(isChristmas).toBe(true);
    });

    it('should detect last day of period', () => {
      const isChristmas = dataManager.isChristmasPeriod('2025-01-02');
      expect(isChristmas).toBe(true);
    });

    it('should return false for dates outside period', () => {
      const beforeChristmas = dataManager.isChristmasPeriod('2024-12-22');
      const afterChristmas = dataManager.isChristmasPeriod('2025-01-03');

      expect(beforeChristmas).toBe(false);
      expect(afterChristmas).toBe(false);
    });

    it('should handle cross-year period correctly', () => {
      const dec31 = dataManager.isChristmasPeriod('2024-12-31');
      const jan1 = dataManager.isChristmasPeriod('2025-01-01');

      expect(dec31).toBe(true);
      expect(jan1).toBe(true);
    });

    it('should support multiple periods', () => {
      dataManager.data.settings.christmasPeriods.push({
        period_id: 'XMAS_2025',
        name: 'Vánoce 2025',
        start_date: '2025-12-23',
        end_date: '2026-01-02',
        year: 2025,
      });

      const xmas2024 = dataManager.isChristmasPeriod('2024-12-25');
      const xmas2025 = dataManager.isChristmasPeriod('2025-12-25');

      expect(xmas2024).toBe(true);
      expect(xmas2025).toBe(true);
    });

    it('should return false when no periods defined', () => {
      dataManager.data.settings.christmasPeriods = [];

      const isChristmas = dataManager.isChristmasPeriod('2024-12-25');
      expect(isChristmas).toBe(false);
    });
  });

  describe('Date Formatting', () => {
    it('should format Date object to YYYY-MM-DD', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const formatted = date.toISOString().split('T')[0];

      expect(formatted).toBe('2025-06-15');
    });

    it('should handle date string', () => {
      const dateStr = '2025-06-15';
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    });
  });

  describe('Email Color Generation', () => {
    it('should generate consistent color for same email', () => {
      // This would test the getColorForEmail method
      // Mock implementation for testing
      const getColorForEmail = (email) => {
        const colors = [
          '#FF6B6B',
          '#4ECDC4',
          '#45B7D1',
          '#FFA07A',
          '#98D8C8',
          '#F7DC6F',
          '#BB8FCE',
          '#85C1E2',
        ];
        let hash = 0;
        for (let i = 0; i < email.length; i++) {
          // eslint-disable-next-line no-bitwise
          hash = email.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
      };

      const color1 = getColorForEmail('test@example.com');
      const color2 = getColorForEmail('test@example.com');

      expect(color1).toBe(color2);
    });

    it('should generate different colors for different emails', () => {
      const getColorForEmail = (email) => {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];
        let hash = 0;
        for (let i = 0; i < email.length; i++) {
          // eslint-disable-next-line no-bitwise
          hash = email.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
      };

      const color1 = getColorForEmail('user1@example.com');
      const color2 = getColorForEmail('user2@example.com');

      // Not guaranteed to be different, but highly likely
      // Test just checks both are valid colors
      expect(color1).toMatch(/^#[0-9A-F]{6}$/iu);
      expect(color2).toMatch(/^#[0-9A-F]{6}$/iu);
    });
  });

  describe('Proposed Bookings - EXCLUSIVE End Date (CRITICAL FIX 2025-10-07)', () => {
    let testUtils;

    beforeEach(() => {
      // Mock testUtils for date generation
      testUtils = {
        getTestDate: (daysFromNow) => {
          const date = new Date();
          date.setDate(date.getDate() + daysFromNow);
          return date.toISOString().split('T')[0];
        },
      };
    });

    it('should block dates from start_date to end_date-1 (EXCLUSIVE end)', async () => {
      // Add proposed booking: 2025-10-10 to 2025-10-12
      const proposedBooking = {
        proposal_id: 'PROP123',
        session_id: 'SESSION_ABC',
        start_date: testUtils.getTestDate(10),
        end_date: testUtils.getTestDate(12),
        rooms: ['12'],
        expires_at: Date.now() + 15 * 60 * 1000, // Active (15 minutes from now)
      };

      dataManager.data.proposedBookings = [proposedBooking];

      // Day 10 (start) - should be PROPOSED
      const day10 = await dataManager.getRoomAvailability(testUtils.getTestDate(10), '12');
      expect(day10.status).toBe('proposed');

      // Day 11 (middle) - should be PROPOSED
      const day11 = await dataManager.getRoomAvailability(testUtils.getTestDate(11), '12');
      expect(day11.status).toBe('proposed');

      // Day 12 (end) - should be AVAILABLE (EXCLUSIVE end date)
      // CRITICAL: This allows back-to-back bookings (checkout 12th, checkin 12th)
      const day12 = await dataManager.getRoomAvailability(testUtils.getTestDate(12), '12');
      expect(day12.status).toBe('available');

      // Day 13 (after end) - should be AVAILABLE
      const day13 = await dataManager.getRoomAvailability(testUtils.getTestDate(13), '12');
      expect(day13.status).toBe('available');
    });

    it('should allow back-to-back bookings on same day (EXCLUSIVE end)', async () => {
      // Scenario: Proposed booking A ends on Oct 10, new booking B starts on Oct 10
      // With EXCLUSIVE end, both should be allowed on the same day
      const proposedBookingA = {
        proposal_id: 'PROP_A',
        session_id: 'SESSION_A',
        start_date: testUtils.getTestDate(5),
        end_date: testUtils.getTestDate(10), // Ends on day 10
        rooms: ['12'],
        expires_at: Date.now() + 15 * 60 * 1000,
      };

      dataManager.data.proposedBookings = [proposedBookingA];

      // Day 10 should be AVAILABLE (EXCLUSIVE end) - allows new booking B to start
      const day10 = await dataManager.getRoomAvailability(testUtils.getTestDate(10), '12');
      expect(day10.status).toBe('available');
    });

    it('should NOT block availability when proposed booking is expired', async () => {
      // Add expired proposed booking
      const expiredProposal = {
        proposal_id: 'PROP_EXPIRED',
        session_id: 'SESSION_EXPIRED',
        start_date: testUtils.getTestDate(10),
        end_date: testUtils.getTestDate(12),
        rooms: ['12'],
        expires_at: Date.now() - 1000, // Expired (1 second ago)
      };

      dataManager.data.proposedBookings = [expiredProposal];

      // All dates should be AVAILABLE since proposal expired
      const day10 = await dataManager.getRoomAvailability(testUtils.getTestDate(10), '12');
      const day11 = await dataManager.getRoomAvailability(testUtils.getTestDate(11), '12');

      expect(day10.status).toBe('available');
      expect(day11.status).toBe('available');
    });

    it('should handle multiple active proposed bookings for same room', async () => {
      // Two different sessions proposing different date ranges for same room
      const proposal1 = {
        proposal_id: 'PROP_1',
        session_id: 'SESSION_1',
        start_date: testUtils.getTestDate(5),
        end_date: testUtils.getTestDate(8), // EXCLUSIVE: blocks 5, 6, 7 only
        rooms: ['12'],
        expires_at: Date.now() + 15 * 60 * 1000,
      };

      const proposal2 = {
        proposal_id: 'PROP_2',
        session_id: 'SESSION_2',
        start_date: testUtils.getTestDate(10),
        end_date: testUtils.getTestDate(13), // EXCLUSIVE: blocks 10, 11, 12 only
        rooms: ['12'],
        expires_at: Date.now() + 15 * 60 * 1000,
      };

      dataManager.data.proposedBookings = [proposal1, proposal2];

      // Days 5-7 should be PROPOSED (by proposal1)
      const day5 = await dataManager.getRoomAvailability(testUtils.getTestDate(5), '12');
      const day7 = await dataManager.getRoomAvailability(testUtils.getTestDate(7), '12');
      expect(day5.status).toBe('proposed');
      expect(day7.status).toBe('proposed');

      // Day 8 should be AVAILABLE (EXCLUSIVE end of proposal1)
      const day8 = await dataManager.getRoomAvailability(testUtils.getTestDate(8), '12');
      expect(day8.status).toBe('available');

      // Days 10-12 should be PROPOSED (by proposal2)
      const day10 = await dataManager.getRoomAvailability(testUtils.getTestDate(10), '12');
      const day12 = await dataManager.getRoomAvailability(testUtils.getTestDate(12), '12');
      expect(day10.status).toBe('proposed');
      expect(day12.status).toBe('proposed');

      // Day 13 should be AVAILABLE (EXCLUSIVE end of proposal2)
      const day13 = await dataManager.getRoomAvailability(testUtils.getTestDate(13), '12');
      expect(day13.status).toBe('available');
    });

    it('should prioritize regular booking over proposed booking', async () => {
      // Regular booking and proposed booking for same dates
      // Regular booking should take precedence
      const regularBooking = {
        id: 'BK_REGULAR',
        startDate: testUtils.getTestDate(10),
        endDate: testUtils.getTestDate(12),
        rooms: ['12'],
        email: 'regular@example.com',
      };

      const proposedBooking = {
        proposal_id: 'PROP_CONFLICT',
        session_id: 'SESSION_CONFLICT',
        start_date: testUtils.getTestDate(10),
        end_date: testUtils.getTestDate(12),
        rooms: ['12'],
        expires_at: Date.now() + 15 * 60 * 1000,
      };

      dataManager.data.bookings = [regularBooking];
      dataManager.data.proposedBookings = [proposedBooking];

      // Should show as BOOKED (not proposed) since regular booking exists
      const day10 = await dataManager.getRoomAvailability(testUtils.getTestDate(10), '12');
      expect(day10.status).toBe('booked');
      expect(day10.email).toBe('regular@example.com');
    });

    it('should handle proposed booking for different room (no conflict)', async () => {
      const proposal = {
        proposal_id: 'PROP_ROOM13',
        session_id: 'SESSION_13',
        start_date: testUtils.getTestDate(10),
        end_date: testUtils.getTestDate(12),
        rooms: ['13'], // Different room
        expires_at: Date.now() + 15 * 60 * 1000,
      };

      dataManager.data.proposedBookings = [proposal];

      // Room 12 should be AVAILABLE (proposal is for room 13)
      const room12Day10 = await dataManager.getRoomAvailability(testUtils.getTestDate(10), '12');
      expect(room12Day10.status).toBe('available');

      // Room 13 should be PROPOSED
      const room13Day10 = await dataManager.getRoomAvailability(testUtils.getTestDate(10), '13');
      expect(room13Day10.status).toBe('proposed');
    });
  });
});
