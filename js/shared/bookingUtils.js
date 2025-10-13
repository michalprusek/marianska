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
   * Uses hybrid detection approach:
   * 1. Primary: Check explicit isBulkBooking flag
   * 2. Fallback: Check if booking contains all room IDs
   *
   * @param {Object} booking - Booking object
   * @param {string} booking.id - Booking ID
   * @param {Array<string>} booking.rooms - Array of room IDs
   * @param {boolean} [booking.isBulkBooking] - Explicit bulk booking flag
   * @param {Array<Object>} allRooms - Array of all room configurations
   * @param {string} allRooms[].id - Room ID
   * @returns {boolean} True if booking is for entire chalet
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

    // Primary: Check explicit flag
    if (booking.isBulkBooking === true) {
      return true;
    }

    // Fallback: Check if booking contains all room IDs
    if (allRooms && allRooms.length > 0) {
      const allRoomIds = allRooms.map((r) => r.id).sort();
      const bookingRoomIds = [...booking.rooms].sort();

      if (bookingRoomIds.length === allRoomIds.length) {
        // Check if arrays contain same elements
        return bookingRoomIds.every((id, index) => id === allRoomIds[index]);
      }
    }

    return false;
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
