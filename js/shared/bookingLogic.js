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
   * Check if two date ranges overlap (share any nights)
   *
   * CRITICAL FIX 2025-10-07: EXCLUSIVE end date logic for back-to-back bookings
   * - Booking uses nights BETWEEN days (exclusive interval logic)
   * - Jan 1-3 uses nights: Jan 1->2, Jan 2->3 (NOT Jan 3->4)
   * - Jan 3-5 uses nights: Jan 3->4, Jan 4->5 (NOT Jan 5->6)
   * - These DON'T overlap because they don't share a night
   *
   * Examples:
   * - Booking 1: Jan 1-3 → occupies Jan 1 and Jan 2 (days), nights Jan 1->2, 2->3
   * - Booking 2: Jan 3-5 → occupies Jan 3 and Jan 4 (days), nights Jan 3->4, 4->5
   * - Result: NO overlap (Jan 3 is shared but no shared NIGHT)
   *
   * Back-to-back examples:
   * - Guest A: check-out 6.10 → last occupied night is 5.10→6.10
   * - Guest B: check-in 6.10 → first occupied night is 6.10→7.10
   * - NO CONFLICT! Different nights, same day.
   *
   * @param {string|Date} start1 - Start date of first range
   * @param {string|Date} end1 - End date of first range (exclusive for nights)
   * @param {string|Date} start2 - Start date of second range
   * @param {string|Date} end2 - End date of second range (exclusive for nights)
   * @returns {boolean} - True if ranges share a night
   */
  static checkDateOverlap(start1, end1, start2, end2) {
    // Convert to Date objects if strings
    const s1 = typeof start1 === 'string' ? new Date(start1) : start1;
    const e1 = typeof end1 === 'string' ? new Date(end1) : end1;
    const s2 = typeof start2 === 'string' ? new Date(start2) : start2;
    const e2 = typeof end2 === 'string' ? new Date(end2) : end2;

    // EXCLUSIVE interval overlap (allows back-to-back bookings)
    // They overlap if: start1 < end2 AND end1 > start2
    // Note the strict inequalities - this is KEY for back-to-back!
    return s1 < e2 && e1 > s2;
  }

  /**
   * Check if a specific date falls within a booking range
   *
   * UPDATED: Using exclusive end logic (standard interval)
   * - Booking Jan 1-3 occupies Jan 1 and Jan 2 (NOT Jan 3)
   * - Check uses: date >= start AND date < end
   *
   * @param {string|Date} checkDate - Date to check
   * @param {string|Date} bookingStart - Booking start date
   * @param {string|Date} bookingEnd - Booking end date (exclusive)
   * @returns {boolean} - True if date is occupied by this booking
   */
  static isDateOccupied(checkDate, bookingStart, bookingEnd) {
    const check = typeof checkDate === 'string' ? new Date(checkDate) : checkDate;
    const start = typeof bookingStart === 'string' ? new Date(bookingStart) : bookingStart;
    const end = typeof bookingEnd === 'string' ? new Date(bookingEnd) : bookingEnd;

    // Inclusive end: check >= start AND check <= end
    return check >= start && check <= end;
  }

  /**
   * Format date to YYYY-MM-DD string
   * @deprecated Use DateUtils.formatDate() instead
   * @param {Date|string} date - Date to format
   * @returns {string} - Formatted date string
   */
  static formatDate(date) {
    // Delegate to DateUtils for SSOT
    if (typeof DateUtils === 'undefined') {
      // If string in YYYY-MM-DD format, return as is
      if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/u)) {
        return date;
      }
      const d = typeof date === 'string' ? new Date(`${date}T12:00:00`) : new Date(date);
      // Use local date components instead of UTC to avoid timezone issues
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return DateUtils.formatDate(date);
  }

  /**
   * Calculate number of nights between two dates
   * @deprecated Use DateUtils.getDaysBetween() instead
   * @param {string|Date} startDate - Check-in date
   * @param {string|Date} endDate - Check-out date
   * @returns {number} - Number of nights
   */
  static calculateNights(startDate, endDate) {
    // Delegate to DateUtils for SSOT
    if (typeof DateUtils === 'undefined') {
      return Math.ceil(
        Math.abs(
          (typeof endDate === 'string' ? new Date(endDate) : endDate) -
            (typeof startDate === 'string' ? new Date(startDate) : startDate)
        ) /
          (1000 * 60 * 60 * 24)
      );
    }
    return DateUtils.getDaysBetween(startDate, endDate);
  }

  /**
   * Validate booking date range
   *
   * @param {string|Date} startDate - Check-in date
   * @param {string|Date} endDate - Check-out date
   * @param {boolean} [isAdmin=false] - Skip past date validation for admin
   * @param {boolean} [allowSingleDay=false] - Allow same start and end date (for blockages)
   * @returns {{valid: boolean, error: string|null}} - Validation result
   */
  static validateDateRange(startDate, endDate, isAdmin = false, allowSingleDay = false) {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

    // P1 FIX: Validate dates are not invalid
    if (isNaN(start.getTime())) {
      return {
        valid: false,
        error: 'Neplatný formát data příjezdu',
      };
    }

    if (isNaN(end.getTime())) {
      return {
        valid: false,
        error: 'Neplatný formát data odjezdu',
      };
    }

    // P1 FIX: Check for past dates (skip for admin)
    if (!isAdmin) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (start < today) {
        return {
          valid: false,
          error: 'Nelze rezervovat v minulosti',
        };
      }
    }

    // CRITICAL FIX 2025-10-13: Support single-day blockages
    // For blockages, allow start === end (same day)
    // For bookings, require end > start (at least 1 night)
    if (allowSingleDay) {
      if (start > end) {
        return {
          valid: false,
          error: 'Konec období musí být po začátku nebo stejný den',
        };
      }
    } else {
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

        // CRITICAL FIX 2025-10-13: Use per-room dates instead of global dates
        // This fixes the bug where multi-room bookings with different per-room dates
        // were incorrectly showing all rooms blocked for the entire date range
        let bookingStart = booking.startDate;
        let bookingEnd = booking.endDate;

        // Check if this booking has per-room dates for this specific room
        if (booking.perRoomDates && booking.perRoomDates[roomId]) {
          bookingStart = booking.perRoomDates[roomId].startDate;
          bookingEnd = booking.perRoomDates[roomId].endDate;
        }

        // Check for date overlap using unified logic with per-room dates
        if (this.checkDateOverlap(startDate, endDate, bookingStart, bookingEnd)) {
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
