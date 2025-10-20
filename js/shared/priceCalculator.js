/**
 * PriceCalculator - Unified price calculation utility
 *
 * Consolidates all pricing logic into a single source of truth.
 * Replaces duplicate implementations in server.js and data.js.
 *
 * @module PriceCalculator
 */

class PriceCalculator {
  /**
   * Calculate total booking price with room-size-based pricing
   *
   * NEW Pricing model (2025-10-17):
   * - Base price depends on room size (small/large) and occupancy
   * - First person: Base price (different for small/large rooms)
   * - Additional persons: Per-person surcharge
   * - Toddlers (0-3 years) are always free
   *
   * @param {Object} options - Pricing options
   * @param {string} options.guestType - 'utia' or 'external'
   * @param {number} options.adults - Number of adults
   * @param {number} options.children - Number of children (3-17 years)
   * @param {number} options.toddlers - Number of toddlers (0-3 years, free)
   * @param {number} options.nights - Number of nights
   * @param {Array<string>} options.rooms - Array of room IDs (e.g., ['12', '14'])
   * @param {Object} options.settings - Settings object with prices configuration
   * @returns {number} Total price in CZK
   */
  static calculatePrice(options) {
    const {
      guestType,
      adults = 0,
      children = 0,
      // toddlers intentionally destructured but not used (they're free)
      // eslint-disable-next-line no-unused-vars -- Documenting that toddlers are accepted but not used in price calculation
      toddlers = 0,
      nights = 1,
      rooms = [],
      settings,
    } = options;

    if (!settings || !settings.prices) {
      console.warn('[PriceCalculator] Missing settings or prices configuration');
      return 0;
    }

    const { prices } = settings;
    const guestKey = guestType === 'utia' ? 'utia' : 'external';
    const priceConfig = prices[guestKey];

    if (!priceConfig) {
      console.warn(`[PriceCalculator] No price config found for guest type: ${guestType}`);
      return 0;
    }

    // NEW: Check if prices have room-size-based structure
    const hasRoomSizes = priceConfig.small && priceConfig.large;

    if (hasRoomSizes) {
      // NEW PRICING MODEL: Room-size-based pricing
      return this.calculateRoomSizeBasedPrice(options);
    }

    // LEGACY: Flat pricing model (backward compatibility)
    // NEW 2025-10-17: Use same logic as room-size pricing for consistency
    const roomsCount = rooms.length || 1;

    // Empty room price = base - adult surcharge
    const emptyRoomPrice = priceConfig.base - priceConfig.adult;
    let totalPrice = emptyRoomPrice * roomsCount * nights;

    // Add surcharges for ALL guests
    totalPrice += adults * priceConfig.adult * nights;
    totalPrice += children * priceConfig.child * nights;

    return Math.round(totalPrice);
  }

  /**
   * Calculate price using room-size-based pricing model
   * NEW 2025-10-17: Base price now represents "room + 1 adult", so we:
   * 1. Calculate empty room price = base - adult surcharge
   * 2. Add actual guest surcharges
   *
   * @param {Object} options - Pricing options
   * @returns {number} Total price in CZK
   * @private
   */
  static calculateRoomSizeBasedPrice(options) {
    const { guestType, adults = 0, children = 0, nights = 1, rooms = [], settings } = options;

    const { prices } = settings;
    const guestKey = guestType === 'utia' ? 'utia' : 'external';
    const priceConfig = prices[guestKey];

    let totalPrice = 0;

    // Calculate price for each room based on its size
    for (const roomId of rooms) {
      const room = settings.rooms?.find((r) => r.id === roomId);
      const roomType = room?.type || 'small'; // Default to small if type not found

      const roomPriceConfig = priceConfig[roomType];
      if (!roomPriceConfig) {
        console.warn(`[PriceCalculator] No price config for room type: ${roomType}`);
        continue;
      }

      // NEW: Empty room price = base price - adult surcharge
      // This allows rooms with only children (0 adults)
      const emptyRoomPrice = roomPriceConfig.base - roomPriceConfig.adult;
      totalPrice += emptyRoomPrice * nights;
    }

    // Add surcharges for ALL guests (not "additional" guests)
    const totalRooms = rooms.length;
    if (totalRooms > 0) {
      const avgRoomPriceConfig = this.getAverageRoomPriceConfig(rooms, settings, guestKey);

      // All adults pay surcharge
      totalPrice += adults * avgRoomPriceConfig.adult * nights;

      // All children pay surcharge
      totalPrice += children * avgRoomPriceConfig.child * nights;
    }

    return Math.round(totalPrice);
  }

  /**
   * Get average price config when multiple rooms are booked
   *
   * @param {Array<string>} rooms - Room IDs
   * @param {Object} settings - Settings object
   * @param {string} guestKey - 'utia' or 'external'
   * @returns {Object} Average price configuration
   * @private
   */
  static getAverageRoomPriceConfig(rooms, settings, guestKey) {
    if (!rooms || rooms.length === 0) {
      return settings.prices[guestKey]?.small || { adult: 50, child: 25 };
    }

    // Calculate average of adult/child surcharges across all booked rooms
    let totalAdult = 0;
    let totalChild = 0;
    let count = 0;

    for (const roomId of rooms) {
      const room = settings.rooms?.find((r) => r.id === roomId);
      const roomType = room?.type || 'small';
      const roomPriceConfig = settings.prices[guestKey]?.[roomType];

      if (roomPriceConfig) {
        totalAdult += roomPriceConfig.adult;
        totalChild += roomPriceConfig.child;
        count += 1;
      }
    }

    return {
      adult: count > 0 ? Math.round(totalAdult / count) : 50,
      child: count > 0 ? Math.round(totalChild / count) : 25,
    };
  }

  /**
   * Calculate price from rooms array (legacy server.js format)
   *
   * @param {Object} params - Price calculation parameters
   * @param {Array<string>} params.rooms - Array of room IDs
   * @param {string} params.guestType - 'utia' or 'external'
   * @param {number} params.adults - Number of adults
   * @param {number} params.children - Number of children
   * @param {number} params.nights - Number of nights
   * @param {Object} params.settings - Settings object
   * @returns {number} Total price in CZK
   */
  static calculatePriceFromRooms({ rooms, guestType, adults, children, nights, settings }) {
    return this.calculatePrice({
      guestType,
      adults,
      children,
      toddlers: 0,
      nights,
      rooms, // Pass rooms array instead of roomsCount
      settings,
    });
  }

  /**
   * Calculate bulk booking price (entire chalet)
   *
   * Bulk pricing uses a different price structure with a base price for the entire chalet
   * plus per-person charges.
   *
   * @param {Object} options - Bulk pricing options
   * @param {string} options.guestType - 'utia' or 'external'
   * @param {number} options.adults - Number of adults
   * @param {number} options.children - Number of children (3-17 years)
   * @param {number} options.toddlers - Number of toddlers (0-3 years, free)
   * @param {number} options.nights - Number of nights
   * @param {Object} options.settings - Settings object with bulkPrices configuration
   * @returns {number} Total price in CZK
   */
  static calculateBulkPrice(options) {
    const {
      guestType,
      adults = 0,
      children = 0,
      // toddlers intentionally destructured but not used (they're free)
      // eslint-disable-next-line no-unused-vars -- Documenting that toddlers are accepted but not used
      toddlers = 0,
      nights = 1,
      settings,
    } = options;

    if (!settings || !settings.bulkPrices) {
      console.warn('[PriceCalculator] Missing settings or bulkPrices configuration');
      return 0;
    }

    const { bulkPrices } = settings;

    // Base price for entire chalet * nights
    let totalPrice = bulkPrices.basePrice * nights;

    // Add per-person charges based on guest type
    if (guestType === 'utia') {
      totalPrice += adults * bulkPrices.utiaAdult * nights;
      totalPrice += children * bulkPrices.utiaChild * nights;
    } else {
      totalPrice += adults * bulkPrices.externalAdult * nights;
      totalPrice += children * bulkPrices.externalChild * nights;
    }

    // Toddlers are free (no charge)

    return Math.round(totalPrice); // Round to nearest CZK
  }

  /**
   * Get default price configuration
   * NEW (2025-10-17): Room-size-based pricing structure
   *
   * @returns {Object} Default prices object
   */
  static getDefaultPrices() {
    return {
      utia: {
        small: {
          base: 300, // Small room, 1 person
          adult: 50, // Per additional adult
          child: 25, // Per child (3-17 years)
        },
        large: {
          base: 400, // Large room, 1 person
          adult: 50, // Per additional adult
          child: 25, // Per child (3-17 years)
        },
      },
      external: {
        small: {
          base: 500, // Small room, 1 person
          adult: 100, // Per additional adult
          child: 50, // Per child (3-17 years)
        },
        large: {
          base: 600, // Large room, 1 person
          adult: 100, // Per additional adult
          child: 50, // Per child (3-17 years)
        },
      },
    };
  }

  /**
   * Get default bulk price configuration
   *
   * @returns {Object} Default bulk prices object
   */
  static getDefaultBulkPrices() {
    return {
      basePrice: 2000,
      utiaAdult: 100,
      utiaChild: 0,
      externalAdult: 250,
      externalChild: 50,
    };
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PriceCalculator;
}

// Also expose globally for browser usage
if (typeof window !== 'undefined') {
  window.PriceCalculator = PriceCalculator;
}
