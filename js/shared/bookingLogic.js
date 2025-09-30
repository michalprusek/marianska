/**
 * Unified Booking Logic Utility
 *
 * Single source of truth for booking-related business logic including:
 * - Date overlap detection
 * - Conflict checking
 * - Availability validation
 *
 * This ensures consistent behavior across frontend, backend, and admin panel.
 */

class BookingLogic {
  /**
   * Check if two date ranges overlap
   *
   * Standard hotel logic: Checkout day is NOT occupied (allows same-day check-in)
   * Range 1: [start1, end1)  (exclusive end)
   * Range 2: [start2, end2)  (exclusive end)
   *
   * Examples:
   * - Booking 1: 2024-01-01 to 2024-01-05 occupies: Jan 1,2,3,4 (NOT Jan 5)
   * - Booking 2: 2024-01-05 to 2024-01-10 occupies: Jan 5,6,7,8,9 (NOT Jan 10)
   * - Result: NO overlap (guest checks out Jan 5 morning, new guest checks in Jan 5 afternoon)
   *
   * @param {string|Date} start1 - Start date of first range
   * @param {string|Date} end1 - End date of first range
   * @param {string|Date} start2 - Start date of second range
   * @param {string|Date} end2 - End date of second range
   * @returns {boolean} - True if ranges overlap
   */
  static checkDateOverlap(start1, end1, start2, end2) {
    // Convert to Date objects if strings
    const s1 = typeof start1 === 'string' ? new Date(start1) : start1;
    const e1 = typeof end1 === 'string' ? new Date(end1) : end1;
    const s2 = typeof start2 === 'string' ? new Date(start2) : start2;
    const e2 = typeof end2 === 'string' ? new Date(end2) : end2;

    // Standard interval overlap: (start1 < end2) AND (end1 > start2)
    // This correctly handles checkout day as NOT occupied
    return s1 < e2 && e1 > s2;
  }

  /**
   * Check if a specific date falls within a booking range
   *
   * @param {string|Date} checkDate - Date to check
   * @param {string|Date} bookingStart - Booking start date
   * @param {string|Date} bookingEnd - Booking end date (exclusive)
   * @returns {boolean} - True if date is occupied
   */
  static isDateOccupied(checkDate, bookingStart, bookingEnd) {
    const check = typeof checkDate === 'string' ? new Date(checkDate) : checkDate;
    const start = typeof bookingStart === 'string' ? new Date(bookingStart) : bookingStart;
    const end = typeof bookingEnd === 'string' ? new Date(bookingEnd) : bookingEnd;

    // Check if date is in range [start, end)
    return check >= start && check < end;
  }

  /**
   * Format date to YYYY-MM-DD string
   *
   * @param {Date|string} date - Date to format
   * @returns {string} - Formatted date string
   */
  static formatDate(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  }

  /**
   * Calculate number of nights between two dates
   *
   * @param {string|Date} startDate - Check-in date
   * @param {string|Date} endDate - Check-out date
   * @returns {number} - Number of nights
   */
  static calculateNights(startDate, endDate) {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Validate booking date range
   *
   * @param {string|Date} startDate - Check-in date
   * @param {string|Date} endDate - Check-out date
   * @returns {{valid: boolean, error: string|null}} - Validation result
   */
  static validateDateRange(startDate, endDate) {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

    if (start >= end) {
      return {
        valid: false,
        error: 'Datum odjezdu musí být po datu příjezdu',
      };
    }

    const nights = this.calculateNights(start, end);
    if (nights < 1) {
      return {
        valid: false,
        error: 'Rezervace musí být alespoň na 1 noc',
      };
    }

    // Check if dates are not too far in future (e.g., 2 years)
    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
    if (start > twoYearsFromNow) {
      return {
        valid: false,
        error: 'Rezervaci nelze vytvořit více než 2 roky dopředu',
      };
    }

    return { valid: true, error: null };
  }

  /**
   * Check if booking conflicts with existing bookings
   *
   * @param {string|Date} startDate - New booking start
   * @param {string|Date} endDate - New booking end
   * @param {Array<string>} roomIds - Room IDs to check
   * @param {Array<Object>} existingBookings - Array of existing bookings
   * @param {string} [excludeBookingId] - Booking ID to exclude (for updates)
   * @returns {{hasConflict: boolean, conflictingBooking: Object|null, roomId: string|null}}
   */
  static checkBookingConflict(
    startDate,
    endDate,
    roomIds,
    existingBookings,
    excludeBookingId = null
  ) {
    for (const roomId of roomIds) {
      for (const booking of existingBookings) {
        // Skip if this is the booking being updated
        if (excludeBookingId && booking.id === excludeBookingId) {
          // eslint-disable-next-line no-continue -- Reduces nesting depth to avoid max-depth error
          continue;
        }

        // Skip if booking doesn't include this room
        if (!booking.rooms || !booking.rooms.includes(roomId)) {
          // eslint-disable-next-line no-continue -- Reduces nesting depth to avoid max-depth error
          continue;
        }

        // Check for date overlap using unified logic
        if (this.checkDateOverlap(startDate, endDate, booking.startDate, booking.endDate)) {
          return {
            hasConflict: true,
            conflictingBooking: booking,
            roomId,
          };
        }
      }
    }

    return { hasConflict: false, conflictingBooking: null, roomId: null };
  }
}

// Export for Node.js (server-side)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookingLogic;
}
