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
   * Calculate total booking price
   *
   * Pricing model:
   * - Base price per room * number of rooms * nights
   * - Additional adults (beyond one per room) * adult price * nights
   * - Children * child price * nights
   * - Toddlers are free
   *
   * @param {Object} options - Pricing options
   * @param {string} options.guestType - 'utia' or 'external'
   * @param {number} options.adults - Number of adults
   * @param {number} options.children - Number of children (3-17 years)
   * @param {number} options.toddlers - Number of toddlers (0-3 years, free)
   * @param {number} options.nights - Number of nights
   * @param {number} options.roomsCount - Number of rooms
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
      roomsCount = 1,
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

    // Base price per room * number of rooms * nights
    let totalPrice = priceConfig.base * roomsCount * nights;

    // Additional adults (assuming one adult per room is included in base)
    const additionalAdults = Math.max(0, adults - roomsCount);
    totalPrice += additionalAdults * priceConfig.adult * nights;

    // Children price
    totalPrice += children * priceConfig.child * nights;

    // Toddlers are free (no charge)
    // No need to add anything for toddlers

    return Math.round(totalPrice); // Round to nearest CZK
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
      roomsCount: rooms.length,
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
   *
   * @returns {Object} Default prices object
   */
  static getDefaultPrices() {
    return {
      utia: {
        base: 298,
        adult: 49,
        child: 24,
      },
      external: {
        base: 499,
        adult: 99,
        child: 49,
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
