/**
 * BookingUtils - Utility functions for booking operations
 *
 * SSOT for booking-related helper functions that are used across
 * multiple components (client-side and server-side).
 *
 * @module bookingUtils
 */

class BookingUtils {
  /**
   * Determine if a booking is for the entire chalet (bulk booking)
   *
   * FIX 2025-12-04: Only use explicit isBulkBooking flag
   * A booking with all 9 rooms is NOT necessarily a bulk booking - it could be
   * a regular multi-room booking. Only bookings created via the bulk booking
   * flow should be considered bulk bookings.
   *
   * @param {Object} booking - Booking object
   * @param {string} booking.id - Booking ID
   * @param {Array<string>} booking.rooms - Array of room IDs
   * @param {boolean} [booking.isBulkBooking] - Explicit bulk booking flag
   * @param {Array<Object>} allRooms - Array of all room configurations (unused, kept for API compatibility)
   * @returns {boolean} True if booking is explicitly marked as bulk booking
   *
   * @example
   * const booking = { rooms: ['12', '13', '14', ...], isBulkBooking: true };
   * const allRooms = await dataManager.getRooms();
   * if (BookingUtils.isBulkBooking(booking, allRooms)) {
   *   // Handle bulk booking special case
   * }
   */
  static isBulkBooking(booking, allRooms) {
    if (!booking || !booking.rooms) {
      return false;
    }

    // FIX 2025-12-04: Only use explicit isBulkBooking flag, NOT room count
    return booking.isBulkBooking === true;
  }

  /**
   * Get total chalet capacity (sum of all room beds)
   *
   * @param {Array<Object>} allRooms - Array of all room configurations
   * @param {number} allRooms[].beds - Number of beds in room
   * @returns {number} Total bed capacity
   */
  static getTotalCapacity(allRooms) {
    if (!allRooms || allRooms.length === 0) {
      return 0;
    }
    return allRooms.reduce((sum, room) => sum + (room.beds || 0), 0);
  }

  /**
   * Validate bulk booking guest capacity
   *
   * @param {number} adults - Number of adults
   * @param {number} children - Number of children
   * @param {number} totalCapacity - Total chalet bed capacity
   * @returns {Object} Validation result
   * @returns {boolean} returns.valid - True if within capacity
   * @returns {string} returns.error - Error message if invalid
   * @returns {number} returns.totalGuests - Total guest count
   */
  static validateBulkCapacity(adults, children, totalCapacity) {
    const totalGuests = adults + children;

    if (totalGuests > totalCapacity) {
      return {
        valid: false,
        error: `Překročena kapacita chaty (${totalCapacity} lůžek). Máte ${totalGuests} hostů.`,
        totalGuests,
      };
    }

    return {
      valid: true,
      error: null,
      totalGuests,
    };
  }
}

// Export for Node.js environment (server-side)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookingUtils;
}
