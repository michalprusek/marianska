/**
 * Tests for js/shared/bookingLogic.js frontend booking business logic
 */

describe('Frontend BookingLogic', () => {
  let BookingLogic;

  beforeAll(() => {
    // Mock Date for consistent testing
    const mockDate = new Date('2025-06-15T12:00:00.000Z');
    global.Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) {
          super(mockDate);
        } else {
          super(...args);
        }
      }

      static now() {
        return mockDate.getTime();
      }
    };

    // Load the booking logic file
    const fs = require('fs');
    const path = require('path');
    const logicPath = path.join(__dirname, '../../js/shared/bookingLogic.js');
    const logicContent = fs.readFileSync(logicPath, 'utf8');

    // Execute the file to get BookingLogic
    // eslint-disable-next-line no-eval
    eval(logicContent);

    // BookingLogic should now be available
    ({ BookingLogic } = global);
  });

  describe('Date Range Calculation', () => {
    it('should calculate number of nights', () => {
      const nights = BookingLogic.calculateNights('2025-07-01', '2025-07-05');
      expect(nights).toBe(4);
    });

    it('should return 0 for same day', () => {
      const nights = BookingLogic.calculateNights('2025-07-01', '2025-07-01');
      expect(nights).toBe(0);
    });

    it('should handle single night', () => {
      const nights = BookingLogic.calculateNights('2025-07-01', '2025-07-02');
      expect(nights).toBe(1);
    });

    it('should handle multi-week stays', () => {
      const nights = BookingLogic.calculateNights('2025-07-01', '2025-07-15');
      expect(nights).toBe(14);
    });
  });

  describe('Date Range Generation', () => {
    it('should generate array of dates in range', () => {
      const dates = BookingLogic.getDateRange('2025-07-01', '2025-07-05');

      expect(dates).toHaveLength(4);
      expect(dates[0]).toBe('2025-07-01');
      expect(dates[3]).toBe('2025-07-04');
    });

    it('should exclude end date (checkout day)', () => {
      const dates = BookingLogic.getDateRange('2025-07-01', '2025-07-03');

      expect(dates).toHaveLength(2);
      expect(dates).toContain('2025-07-01');
      expect(dates).toContain('2025-07-02');
      expect(dates).not.toContain('2025-07-03');
    });

    it('should return empty array for same day', () => {
      const dates = BookingLogic.getDateRange('2025-07-01', '2025-07-01');

      expect(dates).toHaveLength(0);
    });
  });

  describe('Room Availability Checking', () => {
    const existingBookings = [
      {
        id: 'BK1',
        startDate: '2025-07-05',
        endDate: '2025-07-10',
        rooms: ['12', '13'],
      },
      {
        id: 'BK2',
        startDate: '2025-07-12',
        endDate: '2025-07-15',
        rooms: ['14'],
      },
    ];

    it('should detect conflicting booking', () => {
      const hasConflict = BookingLogic.hasBookingConflict(
        '2025-07-06',
        '2025-07-09',
        ['12'],
        existingBookings
      );

      expect(hasConflict).toBe(true);
    });

    it('should detect no conflict for different rooms', () => {
      const hasConflict = BookingLogic.hasBookingConflict(
        '2025-07-06',
        '2025-07-09',
        ['14'], // Room 14 is free
        existingBookings
      );

      expect(hasConflict).toBe(false);
    });

    it('should allow booking on checkout day', () => {
      const hasConflict = BookingLogic.hasBookingConflict(
        '2025-07-10',
        '2025-07-12',
        ['12'],
        existingBookings
      );

      expect(hasConflict).toBe(false); // July 10 is checkout
    });

    it('should detect conflict on check-in day', () => {
      const hasConflict = BookingLogic.hasBookingConflict(
        '2025-07-05',
        '2025-07-07',
        ['12'],
        existingBookings
      );

      expect(hasConflict).toBe(true);
    });

    it('should handle multiple rooms', () => {
      const hasConflict = BookingLogic.hasBookingConflict(
        '2025-07-06',
        '2025-07-09',
        ['12', '14'], // 12 is booked, 14 is free
        existingBookings
      );

      expect(hasConflict).toBe(true); // At least one room has conflict
    });
  });

  describe('Price Calculation', () => {
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

    it('should calculate base price for ÚTIA guest', () => {
      const price = BookingLogic.calculatePrice(
        'utia',
        2,
        0,
        0,
        3, // nights
        1, // rooms
        'small',
        prices
      );

      // (300 base + (2-1) * 50) * 3 nights = 1050
      expect(price).toBe(1050);
    });

    it('should add child surcharge', () => {
      const price = BookingLogic.calculatePrice(
        'utia',
        2,
        2,
        0,
        2, // nights
        1, // rooms
        'small',
        prices
      );

      // (300 base + (2-1) * 50 + 2 * 25) * 2 nights = 800
      expect(price).toBe(800);
    });

    it('should not charge for toddlers', () => {
      const price1 = BookingLogic.calculatePrice('utia', 2, 0, 0, 2, 1, 'small', prices);
      const price2 = BookingLogic.calculatePrice('utia', 2, 0, 3, 2, 1, 'small', prices);

      expect(price1).toBe(price2);
    });

    it('should calculate for external guests', () => {
      const price = BookingLogic.calculatePrice('external', 1, 0, 0, 1, 1, 'small', prices);

      expect(price).toBe(500); // Base price for external
    });

    it('should use large room pricing', () => {
      const smallPrice = BookingLogic.calculatePrice('utia', 1, 0, 0, 1, 1, 'small', prices);
      const largePrice = BookingLogic.calculatePrice('utia', 1, 0, 0, 1, 1, 'large', prices);

      expect(largePrice).toBeGreaterThan(smallPrice);
    });

    it('should multiply by number of rooms', () => {
      const singleRoom = BookingLogic.calculatePrice('utia', 2, 0, 0, 1, 1, 'small', prices);
      const twoRooms = BookingLogic.calculatePrice('utia', 2, 0, 0, 1, 2, 'small', prices);

      expect(twoRooms).toBe(singleRoom * 2);
    });
  });

  describe('Bulk Booking Validation', () => {
    const rooms = [
      { id: '12', beds: 2 },
      { id: '13', beds: 3 },
      { id: '14', beds: 4 },
    ];

    it('should validate guest count fits in selected rooms', () => {
      const isValid = BookingLogic.validateBulkBooking(
        3, // adults
        2, // children
        0, // toddlers
        ['12', '13'], // 2 + 3 = 5 beds
        rooms
      );

      expect(isValid).toBe(true); // 5 people, 5 beds
    });

    it('should reject exceeding capacity', () => {
      const isValid = BookingLogic.validateBulkBooking(
        5, // adults
        2, // children
        0, // toddlers
        ['12'], // Only 2 beds
        rooms
      );

      expect(isValid).toBe(false); // 7 people, 2 beds
    });

    it('should not count toddlers toward capacity', () => {
      const isValid = BookingLogic.validateBulkBooking(
        2,
        0,
        3, // toddlers
        ['12'], // 2 beds
        rooms
      );

      expect(isValid).toBe(true); // Only 2 adults counted
    });
  });

  describe('Christmas Period Detection', () => {
    const christmasPeriods = [
      {
        period_id: 'XMAS_2024',
        start_date: '2024-12-23',
        end_date: '2025-01-02',
        year: 2024,
      },
    ];

    it('should detect booking in Christmas period', () => {
      const isChristmas = BookingLogic.isChristmasPeriodBooking(
        '2024-12-25',
        '2024-12-27',
        christmasPeriods
      );

      expect(isChristmas).toBe(true);
    });

    it('should detect partial overlap', () => {
      const isChristmas = BookingLogic.isChristmasPeriodBooking(
        '2024-12-20',
        '2024-12-25',
        christmasPeriods
      );

      expect(isChristmas).toBe(true);
    });

    it('should detect dates outside period', () => {
      const isChristmas = BookingLogic.isChristmasPeriodBooking(
        '2024-12-10',
        '2024-12-15',
        christmasPeriods
      );

      expect(isChristmas).toBe(false);
    });

    it('should handle multiple periods', () => {
      const multiplePeriods = [
        ...christmasPeriods,
        {
          period_id: 'XMAS_2025',
          start_date: '2025-12-23',
          end_date: '2026-01-02',
          year: 2025,
        },
      ];

      const isChristmas1 = BookingLogic.isChristmasPeriodBooking(
        '2024-12-25',
        '2024-12-27',
        multiplePeriods
      );
      const isChristmas2 = BookingLogic.isChristmasPeriodBooking(
        '2025-12-25',
        '2025-12-27',
        multiplePeriods
      );

      expect(isChristmas1).toBe(true);
      expect(isChristmas2).toBe(true);
    });
  });

  describe('September 30 Cutoff Logic', () => {
    it('should require code before Sept 30', () => {
      const requiresCode = BookingLogic.requiresChristmasCode(
        new Date('2024-09-20'),
        '2024-12-25',
        '2024-12-27'
      );

      expect(requiresCode).toBe(true);
    });

    it('should not require code after Sept 30', () => {
      const requiresCode = BookingLogic.requiresChristmasCode(
        new Date('2024-10-05'),
        '2024-12-25',
        '2024-12-27'
      );

      expect(requiresCode).toBe(false);
    });

    it('should not require code for non-Christmas dates', () => {
      const requiresCode = BookingLogic.requiresChristmasCode(
        new Date('2024-09-20'),
        '2024-11-01',
        '2024-11-05'
      );

      expect(requiresCode).toBe(false);
    });
  });

  describe('Room Type Classification', () => {
    it('should classify small rooms', () => {
      const roomType = BookingLogic.getRoomType(2);
      expect(roomType).toBe('small');
    });

    it('should classify large rooms', () => {
      const roomType = BookingLogic.getRoomType(4);
      expect(roomType).toBe('large');
    });

    it('should classify 3-bed as small', () => {
      const roomType = BookingLogic.getRoomType(3);
      expect(roomType).toBe('small');
    });
  });

  describe('Edit Token Generation', () => {
    it('should generate token with correct length', () => {
      const token = BookingLogic.generateEditToken();
      expect(token).toHaveLength(30);
    });

    it('should generate alphanumeric token', () => {
      const token = BookingLogic.generateEditToken();
      expect(token).toMatch(/^[a-z0-9]{30}$/u);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 50; i++) {
        tokens.add(BookingLogic.generateEditToken());
      }
      expect(tokens.size).toBe(50);
    });
  });

  describe('Booking ID Generation', () => {
    it('should generate ID with correct format', () => {
      const id = BookingLogic.generateBookingId();
      expect(id).toMatch(/^BK[A-Z0-9]{13}$/u);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        ids.add(BookingLogic.generateBookingId());
      }
      expect(ids.size).toBe(50);
    });
  });

  describe('Guest Type Validation', () => {
    it('should validate ÚTIA guest type', () => {
      expect(BookingLogic.isValidGuestType('utia')).toBe(true);
    });

    it('should validate external guest type', () => {
      expect(BookingLogic.isValidGuestType('external')).toBe(true);
    });

    it('should reject invalid guest types', () => {
      expect(BookingLogic.isValidGuestType('invalid')).toBe(false);
      expect(BookingLogic.isValidGuestType('')).toBe(false);
    });
  });

  describe('Minimum Stay Validation', () => {
    it('should require at least 1 night', () => {
      expect(BookingLogic.validateMinimumStay('2025-07-01', '2025-07-02')).toBe(true);
    });

    it('should reject same-day bookings', () => {
      expect(BookingLogic.validateMinimumStay('2025-07-01', '2025-07-01')).toBe(false);
    });

    it('should allow multi-night stays', () => {
      expect(BookingLogic.validateMinimumStay('2025-07-01', '2025-07-05')).toBe(true);
    });
  });

  describe('Room Selection Validation', () => {
    it('should validate room selection', () => {
      expect(BookingLogic.validateRoomSelection(['12', '13'])).toBe(true);
    });

    it('should reject empty selection', () => {
      expect(BookingLogic.validateRoomSelection([])).toBe(false);
    });

    it('should reject invalid input', () => {
      expect(BookingLogic.validateRoomSelection(null)).toBe(false);
      expect(BookingLogic.validateRoomSelection(undefined)).toBe(false);
    });
  });

  describe('Total Guest Count', () => {
    it('should count adults and children', () => {
      const total = BookingLogic.getTotalGuests(2, 3, 0);
      expect(total).toBe(5);
    });

    it('should not count toddlers', () => {
      const total = BookingLogic.getTotalGuests(2, 1, 2);
      expect(total).toBe(3); // 2 adults + 1 child, toddlers excluded
    });

    it('should handle only adults', () => {
      const total = BookingLogic.getTotalGuests(4, 0, 0);
      expect(total).toBe(4);
    });
  });

  describe('Booking Status', () => {
    it('should detect proposed booking', () => {
      const booking = { status: 'proposed' };
      expect(BookingLogic.isProposedBooking(booking)).toBe(true);
    });

    it('should detect confirmed booking', () => {
      const booking = { status: 'confirmed' };
      expect(BookingLogic.isProposedBooking(booking)).toBe(false);
    });

    it('should handle missing status', () => {
      const booking = {};
      expect(BookingLogic.isProposedBooking(booking)).toBe(false);
    });
  });

  describe('Expiry Detection', () => {
    it('should detect expired proposed booking', () => {
      const proposedAt = new Date('2025-06-15T11:00:00.000Z'); // 1 hour ago
      const expiresAt = new Date(proposedAt.getTime() + 15 * 60 * 1000); // +15 min

      const booking = {
        status: 'proposed',
        proposedAt: proposedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      expect(BookingLogic.isExpired(booking)).toBe(true);
    });

    it('should detect non-expired proposed booking', () => {
      const proposedAt = new Date('2025-06-15T12:00:00.000Z'); // Now
      const expiresAt = new Date(proposedAt.getTime() + 15 * 60 * 1000); // +15 min

      const booking = {
        status: 'proposed',
        proposedAt: proposedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      expect(BookingLogic.isExpired(booking)).toBe(false);
    });
  });
});
