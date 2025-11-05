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
   * Calculate price using room-size-based pricing model with per-room guest types
   * NEW 2025-11-04: Admin directly sets empty room price
   * Formula: empty_room + (ALL adults × adult_rate) + (ALL children × child_rate)
   *
   * @param {Object} options - Pricing options
   * @param {string} options.guestType - Guest type: 'utia' or 'external' (used if no per-room types)
   * @param {number} options.adults - Total number of adults (used if no per-room breakdown)
   * @param {number} options.children - Total number of children (used if no per-room breakdown)
   * @param {number} options.nights - Number of nights
   * @param {Array<string>} options.rooms - Array of room IDs
   * @param {Array<Object>} options.perRoomGuests - Per-room guest breakdown (optional)
   * @param {Object} options.settings - Settings object with prices and room configs
   * @returns {number} Total price in CZK
   * @private
   */
  static calculateRoomSizeBasedPrice(options) {
    const {
      guestType,
      adults = 0,
      children = 0,
      nights = 1,
      rooms = [],
      perRoomGuests = null,
      settings,
    } = options;

    const { prices } = settings;

    let totalPrice = 0;

    // If per-room guest breakdown is provided, calculate per-room prices
    if (perRoomGuests && Array.isArray(perRoomGuests) && perRoomGuests.length > 0) {
      for (const roomGuest of perRoomGuests) {
        const { roomId, guestType: roomGuestType, adults: roomAdults = 0, children: roomChildren = 0 } = roomGuest;

        const room = settings.rooms?.find((r) => r.id === roomId);
        const roomType = room?.type || 'small';

        const guestKey = roomGuestType === 'utia' ? 'utia' : 'external';
        const roomPriceConfig = prices[guestKey]?.[roomType];

        if (!roomPriceConfig) {
          console.warn(`[PriceCalculator] No price config for guest type: ${guestKey}, room type: ${roomType}`);
          continue;
        }

        // Empty room price (admin-configured, no implicit guests included)
        // Fallback: if 'empty' not configured, use old formula for backward compatibility
        const emptyRoomPrice = roomPriceConfig.empty !== undefined
          ? roomPriceConfig.empty
          : roomPriceConfig.base - roomPriceConfig.adult;

        totalPrice += emptyRoomPrice * nights;

        // ALL adults and children pay surcharges
        totalPrice += roomAdults * roomPriceConfig.adult * nights;
        totalPrice += roomChildren * roomPriceConfig.child * nights;
      }
    } else {
      // Legacy mode: Single guest type for all rooms (backward compatibility)
      const guestKey = guestType === 'utia' ? 'utia' : 'external';
      const priceConfig = prices[guestKey];

      // Calculate price for each room based on its size
      for (const roomId of rooms) {
        const room = settings.rooms?.find((r) => r.id === roomId);
        const roomType = room?.type || 'small';

        const roomPriceConfig = priceConfig[roomType];
        if (!roomPriceConfig) {
          console.warn(`[PriceCalculator] No price config for room type: ${roomType}`);
          continue;
        }

        // Empty room price (admin-configured)
        // Fallback: if 'empty' not configured, use old formula for backward compatibility
        const emptyRoomPrice = roomPriceConfig.empty !== undefined
          ? roomPriceConfig.empty
          : roomPriceConfig.base - roomPriceConfig.adult;

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

  /**
   * Calculate per-room price breakdown
   *
   * This method provides granular pricing information for each room in a booking,
   * showing the cost breakdown per room including the room base price and guest surcharges.
   *
   * @param {Object} options - Pricing options
   * @param {string} options.guestType - 'utia' or 'external'
   * @param {number} options.nights - Number of nights
   * @param {Object} options.settings - Settings object with prices configuration
   * @param {Array<Object>} options.perRoomGuests - Array of room guest configurations
   *   Example: [
   *     { roomId: '12', adults: 2, children: 1, toddlers: 0 },
   *     { roomId: '13', adults: 1, children: 0, toddlers: 0 }
   *   ]
   * @returns {Object} Per-room price breakdown
   *   {
   *     rooms: [
   *       {
   *         roomId: '12',
   *         roomType: 'small',
   *         basePrice: 300,
   *         adults: 2,
   *         children: 1,
   *         adultsPrice: 100,
   *         childrenPrice: 25,
   *         subtotal: 425,
   *         total: 850 (for 2 nights)
   *       },
   *       ...
   *     ],
   *     grandTotal: 1700
   *   }
   */
  static calculatePerRoomPrices(options) {
    const {
      guestType,
      nights = 1,
      settings,
      perRoomGuests = []
    } = options;

    if (!settings || !settings.prices) {
      console.warn('[PriceCalculator] Missing settings or prices configuration');
      return { rooms: [], grandTotal: 0 };
    }

    const { prices } = settings;
    const guestKey = guestType === 'utia' ? 'utia' : 'external';
    const priceConfig = prices[guestKey];

    if (!priceConfig) {
      console.warn(`[PriceCalculator] No price config found for guest type: ${guestType}`);
      return { rooms: [], grandTotal: 0 };
    }

    // Check if prices have room-size-based structure
    const hasRoomSizes = priceConfig.small && priceConfig.large;

    const roomPrices = [];
    let grandTotal = 0;

    // Calculate price for each room
    for (const roomGuests of perRoomGuests) {
      const { roomId, adults = 0, children = 0, toddlers = 0 } = roomGuests;

      let roomPriceConfig;
      let roomType = 'standard';

      if (hasRoomSizes) {
        // NEW PRICING MODEL: Room-size-based pricing
        const room = settings.rooms?.find((r) => r.id === roomId);
        roomType = room?.type || 'small';
        roomPriceConfig = priceConfig[roomType];

        if (!roomPriceConfig) {
          console.warn(`[PriceCalculator] No price config for room type: ${roomType}`);
          continue;
        }
      } else {
        // LEGACY: Flat pricing model
        roomPriceConfig = priceConfig;
      }

      // Calculate empty room price (base - adult surcharge)
      const emptyRoomPrice = roomPriceConfig.base - roomPriceConfig.adult;

      // Calculate surcharges
      const adultsPrice = adults * roomPriceConfig.adult;
      const childrenPrice = children * roomPriceConfig.child;

      // Subtotal for one night
      const subtotal = emptyRoomPrice + adultsPrice + childrenPrice;

      // Total for all nights
      const total = subtotal * nights;

      grandTotal += total;

      roomPrices.push({
        roomId,
        roomType,
        basePrice: roomPriceConfig.base,
        emptyRoomPrice,
        adults,
        children,
        toddlers,
        adultsPrice,
        childrenPrice,
        subtotal,
        total,
        nights
      });
    }

    return {
      rooms: roomPrices,
      grandTotal: Math.round(grandTotal)
    };
  }

  /**
   * Format per-room prices for display
   *
   * @param {Object} priceBreakdown - Output from calculatePerRoomPrices()
   * @param {string} language - 'cs' or 'en'
   * @returns {string} Formatted HTML string
   */
  static formatPerRoomPricesHTML(priceBreakdown, language = 'cs') {
    const { rooms, grandTotal } = priceBreakdown;

    if (!rooms || rooms.length === 0) {
      return '';
    }

    const translations = {
      cs: {
        perRoom: 'Cena po pokojích',
        room: 'Pokoj',
        basePrice: 'Základní cena pokoje',
        adults: 'Dospělí',
        children: 'Děti',
        toddlers: 'Batolata (zdarma)',
        subtotal: 'Mezisoučet (1 noc)',
        total: 'Celkem za',
        nights: 'nocí',
        grandTotal: 'Celková cena'
      },
      en: {
        perRoom: 'Price per Room',
        room: 'Room',
        basePrice: 'Base room price',
        adults: 'Adults',
        children: 'Children',
        toddlers: 'Toddlers (free)',
        subtotal: 'Subtotal (1 night)',
        total: 'Total for',
        nights: 'nights',
        grandTotal: 'Total Price'
      }
    };

    const t = translations[language] || translations.cs;

    let html = `<div class="per-room-prices" style="margin-top: 1rem;">`;
    html += `<h4 style="margin-bottom: 0.75rem; color: #2c5282; font-size: 1.1rem;">${t.perRoom}</h4>`;

    for (const room of rooms) {
      html += `<div class="room-price-card" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; background: #f8fafc;">`;
      html += `<div style="font-weight: 600; color: #2d3748; margin-bottom: 0.5rem; font-size: 1.05rem;">`;
      html += `<span style="background: #28a745; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; margin-right: 0.5rem;">P${room.roomId}</span>`;
      html += `${t.room} ${room.roomId}`;
      html += `</div>`;

      html += `<div style="font-size: 0.9rem; color: #4a5568; margin-left: 0.5rem;">`;

      // Base price
      html += `<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">`;
      html += `<span>${t.basePrice}:</span>`;
      html += `<span style="font-weight: 500;">${room.emptyRoomPrice.toLocaleString('cs-CZ')} Kč</span>`;
      html += `</div>`;

      // Adults
      if (room.adults > 0) {
        html += `<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">`;
        html += `<span>${t.adults} (${room.adults}×):</span>`;
        html += `<span style="font-weight: 500;">+${room.adultsPrice.toLocaleString('cs-CZ')} Kč</span>`;
        html += `</div>`;
      }

      // Children
      if (room.children > 0) {
        html += `<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">`;
        html += `<span>${t.children} (${room.children}×):</span>`;
        html += `<span style="font-weight: 500;">+${room.childrenPrice.toLocaleString('cs-CZ')} Kč</span>`;
        html += `</div>`;
      }

      // Toddlers (if any)
      if (room.toddlers > 0) {
        html += `<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; color: #38a169;">`;
        html += `<span>${t.toddlers} (${room.toddlers}×):</span>`;
        html += `<span style="font-weight: 500;">0 Kč</span>`;
        html += `</div>`;
      }

      // Subtotal
      html += `<div style="display: flex; justify-content: space-between; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #cbd5e0; font-weight: 600;">`;
      html += `<span>${t.subtotal}:</span>`;
      html += `<span style="color: #2c5282;">${room.subtotal.toLocaleString('cs-CZ')} Kč</span>`;
      html += `</div>`;

      // Total for all nights (if more than 1 night)
      if (room.nights > 1) {
        html += `<div style="display: flex; justify-content: space-between; margin-top: 0.25rem; font-weight: 700; font-size: 1.05rem;">`;
        html += `<span>${t.total} ${room.nights} ${t.nights}:</span>`;
        html += `<span style="color: #28a745;">${room.total.toLocaleString('cs-CZ')} Kč</span>`;
        html += `</div>`;
      }

      html += `</div>`; // Close details
      html += `</div>`; // Close card
    }

    // Grand total (if multiple rooms)
    if (rooms.length > 1) {
      html += `<div style="margin-top: 1rem; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white;">`;
      html += `<div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 700;">`;
      html += `<span>${t.grandTotal}:</span>`;
      html += `<span>${grandTotal.toLocaleString('cs-CZ')} Kč</span>`;
      html += `</div>`;
      html += `</div>`;
    }

    html += `</div>`;

    return html;
  }

  /**
   * Calculate price based on individual guest types
   *
   * NEW (2025-11-04): Per-guest pricing calculation
   * Each guest can have their own pricing type (ÚTIA vs External)
   *
   * Formula per room:
   *   - Empty room price (based on room size)
   *   - For each ÚTIA guest: + ÚTIA adult/child rate
   *   - For each External guest: + External adult/child rate
   *
   * @param {Object} options - Pricing options
   * @param {Array<string>} options.rooms - Array of room IDs
   * @param {Array<Object>} options.guestNames - Array of guest name objects with pricing types
   *   Example: [
   *     { personType: 'adult', firstName: 'Jan', lastName: 'Novák', guestPriceType: 'utia' },
   *     { personType: 'adult', firstName: 'Petr', lastName: 'Svoboda', guestPriceType: 'external' },
   *     { personType: 'child', firstName: 'Anna', lastName: 'Nováková', guestPriceType: 'utia' }
   *   ]
   * @param {number} options.nights - Number of nights
   * @param {Object} options.settings - Settings object with prices configuration
   * @param {string} options.fallbackGuestType - Fallback guest type if not specified per guest
   * @returns {number} Total price in CZK
   */
  static calculatePerGuestPrice(options) {
    const {
      rooms = [],
      guestNames = [],
      nights = 1,
      settings,
      fallbackGuestType = 'external'
    } = options;

    if (!settings || !settings.prices) {
      console.warn('[PriceCalculator] Missing settings or prices configuration');
      return 0;
    }

    const { prices } = settings;
    let totalPrice = 0;

    // CRITICAL FIX: Determine actual guest type based on guest names
    // If at least ONE guest has guestPriceType 'utia', use ÚTIA pricing for empty room
    // Otherwise (all external or no guests yet), use external pricing
    const hasUtiaGuest = guestNames && guestNames.length > 0
      ? guestNames.some(guest => guest.guestPriceType === 'utia')
      : false;
    const actualGuestType = hasUtiaGuest ? 'utia' : 'external';

    // Calculate empty room prices first
    for (const roomId of rooms) {
      const room = settings.rooms?.find((r) => r.id === roomId);
      const roomType = room?.type || 'small';

      // Use ACTUAL guest type (not fallback) to determine empty room price
      const guestKey = actualGuestType;
      const roomPriceConfig = prices[guestKey]?.[roomType];

      if (!roomPriceConfig) {
        console.warn(`[PriceCalculator] No price config for room type: ${roomType}`);
        continue;
      }

      // Empty room price (base accommodation cost)
      const emptyRoomPrice = roomPriceConfig.empty !== undefined
        ? roomPriceConfig.empty
        : roomPriceConfig.base - roomPriceConfig.adult;

      totalPrice += emptyRoomPrice * nights;
    }

    // Now add per-guest surcharges based on individual guest types
    const utiaConfig = prices.utia || {};
    const externalConfig = prices.external || {};

    // Count guests by type and pricing category
    let utiaAdults = 0;
    let utiaChildren = 0;
    let externalAdults = 0;
    let externalChildren = 0;

    for (const guest of guestNames) {
      const priceType = guest.guestPriceType || fallbackGuestType;
      const personType = guest.personType;

      // Skip toddlers (they're free)
      if (personType === 'toddler') {
        continue;
      }

      // Count by pricing type and person type
      if (priceType === 'utia') {
        if (personType === 'adult') {
          utiaAdults++;
        } else if (personType === 'child') {
          utiaChildren++;
        }
      } else {
        // External
        if (personType === 'adult') {
          externalAdults++;
        } else if (personType === 'child') {
          externalChildren++;
        }
      }
    }

    // Calculate average surcharge rates across all rooms
    // (This handles multi-room bookings where rooms might be different sizes)
    const avgUtiaRates = this.getAverageRoomPriceConfig(rooms, settings, 'utia');
    const avgExternalRates = this.getAverageRoomPriceConfig(rooms, settings, 'external');

    // Add ÚTIA guest surcharges
    totalPrice += utiaAdults * avgUtiaRates.adult * nights;
    totalPrice += utiaChildren * avgUtiaRates.child * nights;

    // Add External guest surcharges
    totalPrice += externalAdults * avgExternalRates.adult * nights;
    totalPrice += externalChildren * avgExternalRates.child * nights;

    return Math.round(totalPrice);
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
