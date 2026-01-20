/**
 * Tests for js/shared/bookingLogic.js - Unified booking business logic
 * FIX 2025-12-23: Rewritten to test actual BookingLogic API
 * FIX 2026-01-20: Removed deprecated formatDate/calculateNights tests (use DateUtils)
 */

const BookingLogic = require('../../js/shared/bookingLogic.js');
const DateUtils = require('../../js/shared/dateUtils.js');

describe('BookingLogic', () => {
  describe('checkDateOverlap()', () => {
    it('should detect overlapping date ranges', () => {
      const overlap = BookingLogic.checkDateOverlap(
        '2025-07-01',
        '2025-07-05',
        '2025-07-03',
        '2025-07-08'
      );
      expect(overlap).toBe(true);
    });

    it('should detect no overlap for non-overlapping ranges', () => {
      const overlap = BookingLogic.checkDateOverlap(
        '2025-07-01',
        '2025-07-05',
        '2025-07-10',
        '2025-07-15'
      );
      expect(overlap).toBe(false);
    });

    it('should allow back-to-back bookings (checkout day = checkin day)', () => {
      // Guest A checks out July 5, Guest B checks in July 5
      // This should NOT be a conflict
      const overlap = BookingLogic.checkDateOverlap(
        '2025-07-01',
        '2025-07-05', // A's checkout
        '2025-07-05', // B's checkin
        '2025-07-10'
      );
      expect(overlap).toBe(false);
    });

    it('should detect overlap when ranges share middle days', () => {
      const overlap = BookingLogic.checkDateOverlap(
        '2025-07-01',
        '2025-07-10',
        '2025-07-05',
        '2025-07-08'
      );
      expect(overlap).toBe(true);
    });

    it('should handle Date objects', () => {
      const overlap = BookingLogic.checkDateOverlap(
        new Date('2025-07-01'),
        new Date('2025-07-05'),
        new Date('2025-07-03'),
        new Date('2025-07-08')
      );
      expect(overlap).toBe(true);
    });

    it('should detect overlap for identical ranges', () => {
      const overlap = BookingLogic.checkDateOverlap(
        '2025-07-01',
        '2025-07-05',
        '2025-07-01',
        '2025-07-05'
      );
      expect(overlap).toBe(true);
    });

    it('should detect when one range contains another', () => {
      const overlap = BookingLogic.checkDateOverlap(
        '2025-07-01',
        '2025-07-15',
        '2025-07-05',
        '2025-07-10'
      );
      expect(overlap).toBe(true);
    });
  });

  describe('isDateOccupied()', () => {
    it('should return true for date within booking range', () => {
      const occupied = BookingLogic.isDateOccupied('2025-07-03', '2025-07-01', '2025-07-05');
      expect(occupied).toBe(true);
    });

    it('should return true for start date', () => {
      const occupied = BookingLogic.isDateOccupied('2025-07-01', '2025-07-01', '2025-07-05');
      expect(occupied).toBe(true);
    });

    it('should return true for end date (inclusive)', () => {
      const occupied = BookingLogic.isDateOccupied('2025-07-05', '2025-07-01', '2025-07-05');
      expect(occupied).toBe(true);
    });

    it('should return false for date before range', () => {
      const occupied = BookingLogic.isDateOccupied('2025-06-30', '2025-07-01', '2025-07-05');
      expect(occupied).toBe(false);
    });

    it('should return false for date after range', () => {
      const occupied = BookingLogic.isDateOccupied('2025-07-10', '2025-07-01', '2025-07-05');
      expect(occupied).toBe(false);
    });

    it('should handle Date objects', () => {
      const occupied = BookingLogic.isDateOccupied(
        new Date('2025-07-03'),
        new Date('2025-07-01'),
        new Date('2025-07-05')
      );
      expect(occupied).toBe(true);
    });
  });

  describe('DateUtils.formatDate()', () => {
    it('should format Date object to YYYY-MM-DD', () => {
      const formatted = DateUtils.formatDate(new Date('2025-07-15T12:00:00'));
      expect(formatted).toBe('2025-07-15');
    });

    it('should return string date as-is if already formatted', () => {
      const formatted = DateUtils.formatDate('2025-07-15');
      expect(formatted).toBe('2025-07-15');
    });

    it('should handle single digit month and day', () => {
      const formatted = DateUtils.formatDate(new Date('2025-01-05T12:00:00'));
      expect(formatted).toBe('2025-01-05');
    });
  });

  describe('DateUtils.getDaysBetween()', () => {
    it('should calculate number of nights', () => {
      const nights = DateUtils.getDaysBetween('2025-07-01', '2025-07-05');
      expect(nights).toBe(4);
    });

    it('should return 0 for same day', () => {
      const nights = DateUtils.getDaysBetween('2025-07-01', '2025-07-01');
      expect(nights).toBe(0);
    });

    it('should handle single night', () => {
      const nights = DateUtils.getDaysBetween('2025-07-01', '2025-07-02');
      expect(nights).toBe(1);
    });

    it('should handle multi-week stays', () => {
      const nights = DateUtils.getDaysBetween('2025-07-01', '2025-07-15');
      expect(nights).toBe(14);
    });

    it('should handle Date objects', () => {
      const nights = DateUtils.getDaysBetween(new Date('2025-07-01'), new Date('2025-07-05'));
      expect(nights).toBe(4);
    });

    it('should handle month boundary', () => {
      const nights = DateUtils.getDaysBetween('2025-07-30', '2025-08-02');
      expect(nights).toBe(3);
    });

    it('should handle year boundary', () => {
      const nights = DateUtils.getDaysBetween('2025-12-30', '2026-01-02');
      expect(nights).toBe(3);
    });
  });

  describe('validateDateRange()', () => {
    beforeEach(() => {
      // Mock current date to 2025-06-15 for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should accept valid future date range', () => {
      const result = BookingLogic.validateDateRange('2025-07-01', '2025-07-05');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject past dates for non-admin', () => {
      const result = BookingLogic.validateDateRange('2025-01-01', '2025-01-05');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('minulosti');
    });

    it('should allow past dates for admin', () => {
      const result = BookingLogic.validateDateRange('2025-01-01', '2025-01-05', true);
      expect(result.valid).toBe(true);
    });

    it('should reject end date before start date', () => {
      const result = BookingLogic.validateDateRange('2025-07-10', '2025-07-05');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('odjezdu');
    });

    it('should reject same day booking', () => {
      const result = BookingLogic.validateDateRange('2025-07-01', '2025-07-01');
      expect(result.valid).toBe(false);
    });

    it('should allow same day with allowSingleDay flag', () => {
      const result = BookingLogic.validateDateRange('2025-07-01', '2025-07-01', true, true);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid start date format', () => {
      const result = BookingLogic.validateDateRange('invalid', '2025-07-05');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('formát');
    });

    it('should reject invalid end date format', () => {
      const result = BookingLogic.validateDateRange('2025-07-01', 'invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('formát');
    });

    it('should reject dates more than 2 years in future', () => {
      const result = BookingLogic.validateDateRange('2028-01-01', '2028-01-05');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2 roky');
    });
  });

  describe('checkBookingConflict()', () => {
    const existingBookings = [
      {
        id: 'booking-1',
        rooms: ['12'],
        startDate: '2025-07-05',
        endDate: '2025-07-10',
      },
      {
        id: 'booking-2',
        rooms: ['14'],
        startDate: '2025-07-01',
        endDate: '2025-07-08',
      },
      {
        id: 'booking-3',
        rooms: ['12', '14'],
        startDate: '2025-08-01',
        endDate: '2025-08-05',
      },
    ];

    it('should detect conflict with existing booking', () => {
      const result = BookingLogic.checkBookingConflict(
        '2025-07-06',
        '2025-07-09',
        ['12'],
        existingBookings
      );
      expect(result.hasConflict).toBe(true);
      expect(result.conflictingBooking.id).toBe('booking-1');
      expect(result.roomId).toBe('12');
    });

    it('should detect no conflict for different room', () => {
      const result = BookingLogic.checkBookingConflict(
        '2025-07-06',
        '2025-07-09',
        ['13'], // Room 13 has no bookings
        existingBookings
      );
      expect(result.hasConflict).toBe(false);
    });

    it('should allow booking on checkout day (back-to-back)', () => {
      const result = BookingLogic.checkBookingConflict(
        '2025-07-10', // Guest A checks out July 10
        '2025-07-15',
        ['12'],
        existingBookings
      );
      expect(result.hasConflict).toBe(false);
    });

    it('should detect conflict on last night', () => {
      const result = BookingLogic.checkBookingConflict(
        '2025-07-09', // Overlaps with booking-1 last night
        '2025-07-12',
        ['12'],
        existingBookings
      );
      expect(result.hasConflict).toBe(true);
    });

    it('should exclude specific booking when updating', () => {
      const result = BookingLogic.checkBookingConflict(
        '2025-07-06',
        '2025-07-09',
        ['12'],
        existingBookings,
        'booking-1' // Exclude booking being updated
      );
      expect(result.hasConflict).toBe(false);
    });

    it('should check multiple rooms', () => {
      const result = BookingLogic.checkBookingConflict(
        '2025-08-02',
        '2025-08-04',
        ['12', '14'],
        existingBookings
      );
      expect(result.hasConflict).toBe(true);
      expect(result.conflictingBooking.id).toBe('booking-3');
    });

    it('should use per-room dates when available', () => {
      const bookingsWithPerRoom = [
        {
          id: 'multi-room',
          rooms: ['12', '14'],
          startDate: '2025-07-01',
          endDate: '2025-07-10',
          perRoomDates: {
            12: { startDate: '2025-07-01', endDate: '2025-07-05' },
            14: { startDate: '2025-07-05', endDate: '2025-07-10' },
          },
        },
      ];

      // Should NOT conflict with room 12 (ends July 5)
      const result1 = BookingLogic.checkBookingConflict(
        '2025-07-05',
        '2025-07-08',
        ['12'],
        bookingsWithPerRoom
      );
      expect(result1.hasConflict).toBe(false);

      // SHOULD conflict with room 14 (starts July 5)
      const result2 = BookingLogic.checkBookingConflict(
        '2025-07-06',
        '2025-07-08',
        ['14'],
        bookingsWithPerRoom
      );
      expect(result2.hasConflict).toBe(true);
    });

    it('should return no conflict for empty bookings array', () => {
      const result = BookingLogic.checkBookingConflict('2025-07-01', '2025-07-05', ['12'], []);
      expect(result.hasConflict).toBe(false);
    });

    it('should return no conflict when no matching rooms', () => {
      const result = BookingLogic.checkBookingConflict(
        '2025-07-01',
        '2025-07-05',
        ['99'], // Non-existent room
        existingBookings
      );
      expect(result.hasConflict).toBe(false);
    });
  });
});
