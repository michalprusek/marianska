/**
 * ChristmasUtils - Unified Christmas period logic
 *
 * Consolidates all Christmas-related business logic into a single source of truth.
 * Replaces duplicate implementations in server.js and data.js.
 *
 * @module ChristmasUtils
 */

/* eslint-disable no-underscore-dangle -- Private methods use underscore prefix by convention */
class ChristmasUtils {
  /**
   * Check if a date falls within the Christmas period
   *
   * Supports both:
   * - New format: Multiple periods in settings.christmasPeriods array
   * - Legacy format: Single period in settings.christmasPeriod
   * - Fallback: Default dates (Dec 23 - Jan 2)
   *
   * @param {Date|string} date - Date to check
   * @param {Object} settings - Settings object with Christmas configuration
   * @returns {boolean} True if date is in Christmas period
   */
  static isChristmasPeriod(date, settings) {
    if (!settings) {
      return this._isDefaultChristmasPeriod(date);
    }

    const dateStr = this._formatDate(date);

    // Check new format with multiple periods
    if (settings.christmasPeriods && Array.isArray(settings.christmasPeriods)) {
      return settings.christmasPeriods.some(
        (period) => dateStr >= period.start && dateStr <= period.end
      );
    }

    // Check old single period format for backward compatibility
    if (
      settings.christmasPeriod &&
      settings.christmasPeriod.start &&
      settings.christmasPeriod.end
    ) {
      const startDate = settings.christmasPeriod.start;
      const endDate = settings.christmasPeriod.end;
      return dateStr >= startDate && dateStr <= endDate;
    }

    // Fallback to default dates
    return this._isDefaultChristmasPeriod(date);
  }

  /**
   * Validate Christmas access code
   *
   * @param {string} code - Access code to validate
   * @param {Object} settings - Settings object with christmasAccessCodes array
   * @returns {boolean} True if code is valid
   */
  static validateChristmasCode(code, settings) {
    if (!settings || !settings.christmasAccessCodes) {
      return false;
    }
    return settings.christmasAccessCodes.includes(code);
  }

  /**
   * Determine if Christmas access code is required based on current date
   *
   * Rules (implemented 2025-10-05):
   * - Before Oct 1 of Christmas year: Code required for BOTH single and bulk bookings
   * - After Oct 1 of Christmas year:
   *   - Single room bookings: NO code required
   *   - Bulk bookings: COMPLETELY BLOCKED (bulkBlocked = true)
   *
   * @param {Date|string} currentDate - Current date (usually today)
   * @param {string} christmasPeriodStart - First day of Christmas period (YYYY-MM-DD)
   * @param {boolean} isBulkBooking - Whether this is a bulk booking
   * @returns {Object} { codeRequired: boolean, bulkBlocked: boolean }
   *
   * @example
   * // Christmas period: 2025-12-23 to 2026-01-02
   * // Today: 2025-09-15 (before Oct 1)
   * checkChristmasAccessRequirement(new Date('2025-09-15'), '2025-12-23', false)
   * // => { codeRequired: true, bulkBlocked: false }
   *
   * // Today: 2025-10-15 (after Oct 1), single booking
   * checkChristmasAccessRequirement(new Date('2025-10-15'), '2025-12-23', false)
   * // => { codeRequired: false, bulkBlocked: false }
   *
   * // Today: 2025-10-15 (after Oct 1), bulk booking
   * checkChristmasAccessRequirement(new Date('2025-10-15'), '2025-12-23', true)
   * // => { codeRequired: false, bulkBlocked: true }
   */
  static checkChristmasAccessRequirement(currentDate, christmasPeriodStart, isBulkBooking = false) {
    if (!christmasPeriodStart) {
      return { codeRequired: false, bulkBlocked: false };
    }

    const today = currentDate instanceof Date ? currentDate : new Date(currentDate);
    const christmasStartDate = new Date(christmasPeriodStart);
    const christmasYear = christmasStartDate.getFullYear();

    // Sept 30 cutoff at 23:59:59 of the year containing Christmas period start
    const sept30Cutoff = new Date(christmasYear, 8, 30, 23, 59, 59); // Month is 0-indexed (8 = September)

    const isBeforeSept30 = today <= sept30Cutoff;

    if (isBeforeSept30) {
      // Before Oct 1: Code required for both single and bulk
      return { codeRequired: true, bulkBlocked: false };
    }

    // After Oct 1: Single rooms don't need code, bulk is blocked
    return { codeRequired: false, bulkBlocked: isBulkBooking };
  }

  /**
   * Get the first Christmas period from settings (for compatibility)
   *
   * @param {Object} settings - Settings object
   * @returns {Object|null} First Christmas period or null
   */
  static getFirstChristmasPeriod(settings) {
    if (!settings) {
      return null;
    }

    // New format with multiple periods
    if (settings.christmasPeriods && Array.isArray(settings.christmasPeriods)) {
      return settings.christmasPeriods[0] || null;
    }

    // Legacy single period format
    if (settings.christmasPeriod && settings.christmasPeriod.start) {
      return settings.christmasPeriod;
    }

    return null;
  }

  /**
   * Check if booking dates overlap with any Christmas period
   *
   * @param {string} startDate - Booking start date (YYYY-MM-DD)
   * @param {string} endDate - Booking end date (YYYY-MM-DD)
   * @param {Object} settings - Settings object
   * @returns {boolean} True if booking overlaps with Christmas period
   */
  static overlapsChristmasPeriod(startDate, endDate, settings) {
    if (!settings) {
      return false;
    }

    // Check new format with multiple periods
    if (settings.christmasPeriods && Array.isArray(settings.christmasPeriods)) {
      return settings.christmasPeriods.some((period) =>
        this._dateRangesOverlap(startDate, endDate, period.start, period.end)
      );
    }

    // Check old single period format
    if (settings.christmasPeriod && settings.christmasPeriod.start) {
      return this._dateRangesOverlap(
        startDate,
        endDate,
        settings.christmasPeriod.start,
        settings.christmasPeriod.end
      );
    }

    return false;
  }

  /**
   * Validate Christmas room limit for ÚTIA employees
   *
   * Official ÚTIA rules (implemented 2025-10-16):
   * 1. Before Sept 30: ÚTIA employees can book:
   *    - 1 room: Always allowed
   *    - 2 rooms: Only if both fully occupied by family (guestType === 'utia')
   *    - 3+ rooms: Not allowed
   * 2. After Oct 1: No room limit (subject to availability and access code)
   *
   * @param {Object} bookingData - Booking data with rooms, guestType
   * @param {Date|string} currentDate - Current date (usually today)
   * @param {string} christmasPeriodStart - First day of Christmas period (YYYY-MM-DD)
   * @returns {Object} { valid: boolean, error?: string, warning?: string }
   *
   * @example
   * // Before Oct 1, ÚTIA employee, 1 room
   * validateChristmasRoomLimit({ rooms: ['12'], guestType: 'utia' }, new Date('2025-09-15'), '2025-12-23')
   * // => { valid: true }
   *
   * // Before Oct 1, ÚTIA employee, 2 rooms
   * validateChristmasRoomLimit({ rooms: ['12', '13'], guestType: 'utia' }, new Date('2025-09-15'), '2025-12-23')
   * // => { valid: true, warning: '...' }
   *
   * // Before Oct 1, ÚTIA employee, 3 rooms
   * validateChristmasRoomLimit({ rooms: ['12', '13', '14'], guestType: 'utia' }, new Date('2025-09-15'), '2025-12-23')
   * // => { valid: false, error: '...' }
   *
   * // After Oct 1, any number of rooms
   * validateChristmasRoomLimit({ rooms: ['12', '13', '14'], guestType: 'utia' }, new Date('2025-10-15'), '2025-12-23')
   * // => { valid: true }
   */
  static validateChristmasRoomLimit(bookingData, currentDate, christmasPeriodStart) {
    // No Christmas period configured - no restrictions
    if (!christmasPeriodStart) {
      return { valid: true };
    }

    // Check if before Oct 1 of Christmas year
    const { codeRequired } = this.checkChristmasAccessRequirement(
      currentDate,
      christmasPeriodStart,
      false
    );

    // After Oct 1: No room limit
    if (!codeRequired) {
      return { valid: true };
    }

    // Before Oct 1: Apply ÚTIA rules
    const roomCount = bookingData.rooms ? bookingData.rooms.length : 0;
    const isUtia = bookingData.guestType === 'utia';

    // External guests: No special restrictions (they can book with code)
    if (!isUtia) {
      return { valid: true };
    }

    // ÚTIA employee rules:
    if (roomCount === 0) {
      return { valid: false, error: 'Musíte vybrat alespoň jeden pokoj' };
    }

    if (roomCount === 1) {
      // 1 room: Always allowed for ÚTIA employees
      return { valid: true };
    }

    if (roomCount === 2) {
      // 2 rooms: Allowed, but with warning about family occupancy rule
      return {
        valid: true,
        warning:
          'Pamatujte: Dva pokoje lze rezervovat pouze pokud budou oba plně obsazeny příslušníky Vaší rodiny (osoby oprávněné využívat zlevněnou cenu za ubytování).',
      };
    }

    // 3+ rooms: Not allowed for ÚTIA employees before Oct 1
    return {
      valid: false,
      error:
        'Zaměstnanci ÚTIA mohou do 30. září rezervovat maximálně 2 pokoje. ' +
        'Více pokojů můžete rezervovat od 1. října (podle dostupnosti).',
    };
  }

  // ========== PRIVATE HELPER METHODS ==========

  /**
   * Check if date falls in default Christmas period (Dec 23 - Jan 2)
   * @private
   */
  static _isDefaultChristmasPeriod(date) {
    const d = date instanceof Date ? date : new Date(date);
    const month = d.getMonth();
    const day = d.getDate();

    if (month === 11 && day >= 23) {
      return true; // Dec 23-31
    }
    if (month === 0 && day <= 2) {
      return true; // Jan 1-2
    }

    return false;
  }

  /**
   * Format date to YYYY-MM-DD string
   * @deprecated Use DateUtils.formatDate() directly instead (SSOT principle)
   * @private
   */
  static _formatDate(date) {
    // Delegate to DateUtils for SSOT
    if (typeof DateUtils !== 'undefined') {
      return DateUtils.formatDate(date);
    }
    // Fallback (should not be needed in practice)
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/u)) {
      return date;
    }
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Check if two date ranges overlap (inclusive)
   * @private
   */
  static _dateRangesOverlap(start1, end1, start2, end2) {
    return start1 <= end2 && end1 >= start2;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChristmasUtils;
}

// Also expose globally for browser usage
if (typeof window !== 'undefined') {
  window.ChristmasUtils = ChristmasUtils;
}
/* eslint-enable no-underscore-dangle */
