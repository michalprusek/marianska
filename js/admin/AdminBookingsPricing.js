/**
 * AdminBookingsPricing - Price calculation and display for admin bookings
 *
 * Extracted from AdminBookings.js for better separation of concerns.
 * Handles price recalculation from current settings (SSOT pattern).
 */
class AdminBookingsPricing {
  constructor(adminBookings) {
    this.adminBookings = adminBookings;
  }

  /**
   * Calculate number of nights for a booking
   * Delegates to DateUtils (SSOT for date calculations)
   * @param {Object} booking - Booking object
   * @returns {number} Number of nights
   */
  calculateNights(booking) {
    return DateUtils.getDaysBetween(booking.startDate, booking.endDate);
  }

  /**
   * Calculate price from current settings (SSOT).
   *
   * Admin panel should ALWAYS show prices calculated from current price settings.
   * The stored booking.totalPrice is historical - what was charged at booking time.
   *
   * @param {Object} booking - Booking object
   * @param {Object} settings - Current settings with prices
   * @returns {number} Recalculated price from current settings
   */
  getBookingPrice(booking, settings) {
    if (!settings || !settings.prices) {
      // Fallback to stored price if settings not available
      return booking.totalPrice || 0;
    }

    try {
      if (booking.isBulkBooking) {
        return this.calculateBulkPrice(booking, settings);
      }

      // Composite booking (multiple rooms with different dates)
      if (booking.rooms && booking.rooms.length > 1 && booking.perRoomDates) {
        return this.calculateCompositePrice(booking, settings);
      }

      // Single room booking - use per-guest pricing if available
      if (booking.guestNames && booking.guestNames.length > 0) {
        return this.calculatePerGuestPrice(booking, settings);
      }

      // Fallback to simple calculation
      return this.calculateSimplePrice(booking, settings);
    } catch (error) {
      console.error('[AdminBookingsPricing] Error calculating price:', error);
      // Fallback to stored price on error
      return booking.totalPrice || 0;
    }
  }

  /**
   * Calculate price for bulk booking
   * @private
   */
  calculateBulkPrice(booking, settings) {
    // FIX 2025-12-06: Derive guestTypeBreakdown from guestNames (SSOT)
    const guestNames = booking.guestNames || [];
    const derivedBreakdown = {
      utiaAdults: guestNames.filter((g) => g.personType === 'adult' && g.guestPriceType === 'utia')
        .length,
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

    return PriceCalculator.calculateMixedBulkPrice({
      utiaAdults: derivedBreakdown.utiaAdults,
      externalAdults: derivedBreakdown.externalAdults,
      utiaChildren: derivedBreakdown.utiaChildren,
      externalChildren: derivedBreakdown.externalChildren,
      nights: this.calculateNights(booking),
      settings,
    });
  }

  /**
   * Calculate price for composite booking (multiple rooms)
   * @private
   */
  calculateCompositePrice(booking, settings) {
    let totalPrice = 0;

    for (const roomId of booking.rooms) {
      const roomGuestNames = (booking.guestNames || []).filter(
        (g) => String(g.roomId) === String(roomId)
      );
      const roomDates = booking.perRoomDates[roomId];
      const nights = roomDates
        ? Math.ceil(
            (new Date(roomDates.endDate) - new Date(roomDates.startDate)) / (1000 * 60 * 60 * 24)
          )
        : this.calculateNights(booking);

      // Determine guest type from guests in this room
      const hasUtiaGuest = roomGuestNames.some(
        (g) => g.guestPriceType === 'utia' && g.personType !== 'toddler'
      );
      const roomGuestType = hasUtiaGuest ? 'utia' : 'external';

      const roomPrice = PriceCalculator.calculatePerGuestPrice({
        rooms: [roomId],
        guestNames: roomGuestNames,
        nights,
        settings,
        fallbackGuestType: roomGuestType,
      });
      totalPrice += roomPrice;
    }

    return totalPrice;
  }

  /**
   * Calculate price using per-guest pricing
   * @private
   */
  calculatePerGuestPrice(booking, settings) {
    return PriceCalculator.calculatePerGuestPrice({
      rooms: booking.rooms || [],
      guestNames: booking.guestNames,
      perRoomDates: booking.perRoomDates || null,
      perRoomGuests: booking.perRoomGuests || {},
      nights: this.calculateNights(booking),
      settings,
      fallbackGuestType: booking.guestType || 'external',
    });
  }

  /**
   * Calculate price using simple calculation (fallback)
   * @private
   */
  calculateSimplePrice(booking, settings) {
    return PriceCalculator.calculatePrice({
      guestType: booking.guestType || 'external',
      adults: booking.adults || 0,
      children: booking.children || 0,
      toddlers: booking.toddlers || 0,
      nights: this.calculateNights(booking),
      rooms: booking.rooms || [],
      settings,
    });
  }

  /**
   * Derive guest type breakdown from guestNames
   * @param {Array} guestNames - Array of guest name objects
   * @returns {Object} Breakdown with utiaAdults, externalAdults, etc.
   */
  deriveGuestTypeBreakdown(guestNames) {
    return {
      utiaAdults: guestNames.filter((g) => g.personType === 'adult' && g.guestPriceType === 'utia')
        .length,
      externalAdults: guestNames.filter(
        (g) => g.personType === 'adult' && g.guestPriceType === 'external'
      ).length,
      utiaChildren: guestNames.filter(
        (g) => g.personType === 'child' && g.guestPriceType === 'utia'
      ).length,
      externalChildren: guestNames.filter(
        (g) => g.personType === 'child' && g.guestPriceType === 'external'
      ).length,
      toddlers: guestNames.filter((g) => g.personType === 'toddler').length,
    };
  }
}

// Export for browser
if (typeof window !== 'undefined') {
  window.AdminBookingsPricing = AdminBookingsPricing;
}
