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
   * Get empty room price (base accommodation cost without guests)
   *
   * NEW MODEL (2025-11-10): Only 'empty' field (room-size based pricing)
   * Admin sets this value in price settings - it represents accommodation cost for 0 guests.
   *
   * @param {Object} roomPriceConfig - Price configuration for specific room type
   * @returns {number} Empty room base price
   * @private
   */
  static getEmptyRoomPrice(roomPriceConfig) {
    // NEW MODEL 2025-11-10: Only 'empty' field - no fallbacks
    if (!roomPriceConfig || typeof roomPriceConfig.empty !== 'number') {
      throw new Error(
        'Chybí nastavení ceny prázdného pokoje ("empty"). Nakonfigurujte ji v administraci.'
      );
    }
    return roomPriceConfig.empty;
  }

  /**
   * Calculate total booking price with room-size-based pricing
   *
   * NEW Pricing model (2025-11-04):
   * - Empty room base price (NO guests included)
   * - ALL adults pay surcharge (no "first person free")
   * - ALL children pay surcharge
   * - Price varies by room size (small 3-bed vs large 4-bed)
   * - Toddlers (0-2 years) are always free
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
    const { guestType, settings } = options;

    // CRITICAL: Validate required configuration exists - throw error instead of returning 0
    if (!settings || !settings.prices) {
      const error = new Error('Chybí cenová konfigurace - nelze spočítat cenu');
      console.error('[PriceCalculator] Missing settings or prices configuration', error);
      throw error;
    }

    const { prices } = settings;
    const guestKey = guestType === 'utia' ? 'utia' : 'external';
    const priceConfig = prices[guestKey];

    if (!priceConfig) {
      const error = new Error(`Chybějící cenová konfigurace pro typ hosta: ${guestType}`);
      console.error(`[PriceCalculator] No price config found for guest type: ${guestType}`, error);
      throw error;
    }

    // NEW MODEL 2025-11-10: Always use room-size-based pricing
    // No legacy flat pricing support - admin must have configured room sizes
    const hasRoomSizes = priceConfig.small && priceConfig.large;

    if (!hasRoomSizes) {
      throw new Error(
        'Chybí konfigurace velikostí pokojů (small/large). ' +
          'Nastavte ceny v administraci pro malé a velké pokoje.'
      );
    }

    return this.calculateRoomSizeBasedPrice(options);
  }

  /**
   * Calculate price using room-size-based pricing model with per-room guest types
   * NEW 2025-11-04: Admin directly sets empty room price
   * Formula: empty_room + (ALL adults × adult_rate) + (ALL children × child_rate)
   *
   * NEW 2025-11-14: Support per-room date ranges for multi-room bookings with different dates
   *
   * @param {Object} options - Pricing options
   * @param {string} options.guestType - Guest type: 'utia' or 'external' (used if no per-room types)
   * @param {number} options.adults - Total number of adults (used if no per-room breakdown)
   * @param {number} options.children - Total number of children (used if no per-room breakdown)
   * @param {number} options.nights - Number of nights (used if no per-room dates)
   * @param {Array<string>} options.rooms - Array of room IDs
   * @param {Array<Object>} options.perRoomGuests - Per-room guest breakdown (optional)
   * @param {Object} options.perRoomDates - Per-room date ranges (optional)
   *   Example: { '12': { startDate: '2025-11-15', endDate: '2025-11-18' }, '13': { ... } }
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
      perRoomDates = null,
      settings,
    } = options;

    const { prices } = settings;

    let totalPrice = 0;

    // If per-room guest breakdown is provided, calculate per-room prices
    if (perRoomGuests && Array.isArray(perRoomGuests) && perRoomGuests.length > 0) {
      for (const roomGuest of perRoomGuests) {
        const {
          roomId,
          guestType: roomGuestType,
          adults: roomAdults = 0,
          children: roomChildren = 0,
        } = roomGuest;

        const room = settings.rooms?.find((r) => r.id === roomId);
        const roomType = room?.type || 'small';

        const guestKey = roomGuestType === 'utia' ? 'utia' : 'external';
        if (!prices[guestKey]) {
          const error = new Error(`Chybějící cenová konfigurace pro typ hosta: ${guestKey}`);
          console.error('[PriceCalculator]', error);
          throw error;
        }

        const roomPriceConfig = prices[guestKey][roomType];

        if (!roomPriceConfig) {
          const error = new Error(
            `Chybějící cenová konfigurace pro typ pokoje: ${roomType} (host: ${guestKey})`
          );
          console.error('[PriceCalculator]', error);
          throw error;
        }

        // NEW 2025-11-14: Calculate nights per room if perRoomDates provided
        let roomNights = nights; // Default to booking-level nights
        if (perRoomDates && perRoomDates[roomId]) {
          const { startDate, endDate } = perRoomDates[roomId];
          const start = new Date(startDate);
          const end = new Date(endDate);
          roomNights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        }

        // Empty room price (admin-configured, no implicit guests included)
        const emptyRoomPrice = this.getEmptyRoomPrice(roomPriceConfig);

        const roomBaseTotal = emptyRoomPrice * roomNights;
        const roomAdultsTotal = roomAdults * roomPriceConfig.adult * roomNights;
        const roomChildrenTotal = roomChildren * roomPriceConfig.child * roomNights;
        const roomTotal = roomBaseTotal + roomAdultsTotal + roomChildrenTotal;

        totalPrice += roomTotal;
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
          const error = new Error(`Chybějící cenová konfigurace pro typ pokoje: ${roomType}`);
          console.error('[PriceCalculator]', error);
          throw error;
        }

        // Empty room price (admin-configured)
        const emptyRoomPrice = this.getEmptyRoomPrice(roomPriceConfig);

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

    // CRITICAL: Validate required configuration exists - throw error instead of returning 0
    if (!settings || !settings.bulkPrices) {
      const error = new Error('Chybí konfigurace cen pro hromadné rezervace');
      console.error('[PriceCalculator] Missing settings or bulkPrices configuration', error);
      throw error;
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
   * NEW MODEL (2025-11-10): Room-size-based pricing with 'empty' field only
   *
   * @returns {Object} Default prices object
   */
  static getDefaultPrices() {
    return {
      utia: {
        small: {
          empty: 250, // Empty small room (0 guests)
          adult: 50, // Per adult (ALL adults pay, no "first free")
          child: 25, // Per child (3-17 years)
        },
        large: {
          empty: 350, // Empty large room (0 guests)
          adult: 50, // Per adult (ALL adults pay, no "first free")
          child: 25, // Per child (3-17 years)
        },
      },
      external: {
        small: {
          empty: 400, // Empty small room (0 guests)
          adult: 100, // Per adult (ALL adults pay, no "first free")
          child: 50, // Per child (3-17 years)
        },
        large: {
          empty: 500, // Empty large room (0 guests)
          adult: 100, // Per adult (ALL adults pay, no "first free")
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
   * NEW 2025-11-14: Support per-room date ranges for multi-room bookings with different dates
   *
   * @param {Object} options - Pricing options
   * @param {string} options.guestType - 'utia' or 'external'
   * @param {number} options.nights - Number of nights (fallback if no per-room dates)
   * @param {Object} options.settings - Settings object with prices configuration
   * @param {Array<Object>} options.perRoomGuests - Array of room guest configurations
   *   Example: [
   *     { roomId: '12', adults: 2, children: 1, toddlers: 0 },
   *     { roomId: '13', adults: 1, children: 0, toddlers: 0 }
   *   ]
   * @param {Object} options.perRoomDates - Per-room date ranges (optional)
   *   Example: { '12': { startDate: '2025-11-15', endDate: '2025-11-18' }, '13': { ... } }
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
    const { guestType, nights = 1, settings, perRoomGuests = [], perRoomDates = null } = options;

    if (!settings || !settings.prices) {
      throw new Error('Missing settings or prices configuration');
    }

    const { prices } = settings;
    const guestKey = guestType === 'utia' ? 'utia' : 'external';
    const priceConfig = prices[guestKey];

    if (!priceConfig) {
      throw new Error(`No price config found for guest type: ${guestType}`);
    }

    // Check if prices have room-size-based structure
    const hasRoomSizes = priceConfig.small && priceConfig.large;

    const roomPrices = [];
    let grandTotal = 0;

    // Calculate price for each room
    for (const roomGuests of perRoomGuests) {
      const {
        roomId,
        adults = 0,
        children = 0,
        toddlers = 0,
        utiaAdults = 0,
        externalAdults = 0,
        utiaChildren = 0,
        externalChildren = 0,
      } = roomGuests;

      let roomPriceConfig;
      let roomType = 'standard';

      if (hasRoomSizes) {
        // NEW PRICING MODEL: Room-size-based pricing
        const room = settings.rooms?.find((r) => r.id === roomId);
        roomType = room?.type || 'small';
        roomPriceConfig = priceConfig[roomType];

        if (!roomPriceConfig) {
          throw new Error(`No price config for room type: ${roomType}`);
        }
      } else {
        // LEGACY: Flat pricing model
        roomPriceConfig = priceConfig;
      }

      // NEW 2025-11-14: Calculate nights per room if perRoomDates provided
      let roomNights = nights; // Default to booking-level nights
      if (perRoomDates && perRoomDates[roomId]) {
        const { startDate, endDate } = perRoomDates[roomId];
        const start = new Date(startDate);
        const end = new Date(endDate);
        roomNights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      }

      // FIX 2025-11-06: Use NEW pricing model - base IS empty room price
      // No need to subtract adult surcharge (that was OLD model)
      const emptyRoomPrice = this.getEmptyRoomPrice(roomPriceConfig);

      // Calculate surcharges - if ÚTIA/External breakdown is provided, use it
      let adultsPrice;
      let childrenPrice;
      let utiaAdultsPrice = 0;
      let externalAdultsPrice = 0;
      let utiaChildrenPrice = 0;
      let externalChildrenPrice = 0;

      if (utiaAdults > 0 || externalAdults > 0 || utiaChildren > 0 || externalChildren > 0) {
        // Use ÚTIA/External breakdown for precise pricing
        const utiaPrices = settings.prices?.utia?.[roomType] || settings.prices?.utia || {};
        const externalPrices =
          settings.prices?.external?.[roomType] || settings.prices?.external || {};

        utiaAdultsPrice = utiaAdults * (utiaPrices.adult || 0);
        externalAdultsPrice = externalAdults * (externalPrices.adult || 0);
        adultsPrice = utiaAdultsPrice + externalAdultsPrice;

        utiaChildrenPrice = utiaChildren * (utiaPrices.child || 0);
        externalChildrenPrice = externalChildren * (externalPrices.child || 0);
        childrenPrice = utiaChildrenPrice + externalChildrenPrice;
      } else {
        // Fallback: use simple calculation (for backward compatibility)
        adultsPrice = adults * roomPriceConfig.adult;
        childrenPrice = children * roomPriceConfig.child;
      }

      // Subtotal for one night
      const subtotal = emptyRoomPrice + adultsPrice + childrenPrice;

      // Total for all nights (using per-room nights)
      const total = subtotal * roomNights;

      grandTotal += total;

      roomPrices.push({
        roomId,
        roomType,
        basePrice: emptyRoomPrice, // Use calculated empty room price (not legacy .base)
        emptyRoomPrice,
        adults,
        children,
        toddlers,
        adultsPrice,
        childrenPrice,
        // ÚTIA/External breakdown
        utiaAdults,
        externalAdults,
        utiaChildren,
        externalChildren,
        utiaAdultsPrice,
        externalAdultsPrice,
        utiaChildrenPrice,
        externalChildrenPrice,
        subtotal,
        total,
        nights: roomNights, // Use per-room nights (not booking-level nights)
      });
    }

    return {
      rooms: roomPrices,
      grandTotal: Math.round(grandTotal),
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
        grandTotal: 'Celková cena',
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
        grandTotal: 'Total Price',
      },
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

      // Adults - show ÚTIA/External breakdown if available
      if (room.adults > 0) {
        html += `<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">`;

        // Check if we have ÚTIA/External breakdown
        if (
          (room.utiaAdults > 0 || room.externalAdults > 0) &&
          (room.utiaAdultsPrice !== undefined || room.externalAdultsPrice !== undefined)
        ) {
          // Show breakdown
          if (room.utiaAdults > 0 && room.externalAdults > 0) {
            // Mixed: both ÚTIA and External
            const utiaRate = room.utiaAdultsPrice / room.utiaAdults;
            const externalRate = room.externalAdultsPrice / room.externalAdults;
            html += `<span>${t.adults}:</span>`;
            html += `<span style="font-weight: 500;">+${room.adultsPrice.toLocaleString('cs-CZ')} Kč <span style="font-size: 0.85em; color: #666;">(${room.utiaAdults} ÚTIA × ${utiaRate} Kč + ${room.externalAdults} EXT × ${externalRate} Kč)</span></span>`;
          } else if (room.utiaAdults > 0) {
            // All ÚTIA
            const utiaRate = room.utiaAdultsPrice / room.utiaAdults;
            html += `<span>${t.adults}:</span>`;
            html += `<span style="font-weight: 500;">+${room.adultsPrice.toLocaleString('cs-CZ')} Kč <span style="font-size: 0.85em; color: #666;">(${room.utiaAdults} × ${utiaRate} Kč)</span></span>`;
          } else {
            // All External
            const externalRate = room.externalAdultsPrice / room.externalAdults;
            html += `<span>${t.adults}:</span>`;
            html += `<span style="font-weight: 500;">+${room.adultsPrice.toLocaleString('cs-CZ')} Kč <span style="font-size: 0.85em; color: #666;">(${room.externalAdults} × ${externalRate} Kč)</span></span>`;
          }
        } else {
          // Fallback: simple display without breakdown
          html += `<span>${t.adults} (${room.adults}×):</span>`;
          html += `<span style="font-weight: 500;">+${room.adultsPrice.toLocaleString('cs-CZ')} Kč</span>`;
        }

        html += `</div>`;
      }

      // Children - show ÚTIA/External breakdown if available
      if (room.children > 0) {
        html += `<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">`;

        // Check if we have ÚTIA/External breakdown
        if (
          (room.utiaChildren > 0 || room.externalChildren > 0) &&
          (room.utiaChildrenPrice !== undefined || room.externalChildrenPrice !== undefined)
        ) {
          // Show breakdown
          if (room.utiaChildren > 0 && room.externalChildren > 0) {
            // Mixed: both ÚTIA and External
            const utiaRate = room.utiaChildrenPrice / room.utiaChildren;
            const externalRate = room.externalChildrenPrice / room.externalChildren;
            html += `<span>${t.children}:</span>`;
            html += `<span style="font-weight: 500;">+${room.childrenPrice.toLocaleString('cs-CZ')} Kč <span style="font-size: 0.85em; color: #666;">(${room.utiaChildren} ÚTIA × ${utiaRate} Kč + ${room.externalChildren} EXT × ${externalRate} Kč)</span></span>`;
          } else if (room.utiaChildren > 0) {
            // All ÚTIA
            const utiaRate = room.utiaChildrenPrice / room.utiaChildren;
            html += `<span>${t.children}:</span>`;
            html += `<span style="font-weight: 500;">+${room.childrenPrice.toLocaleString('cs-CZ')} Kč <span style="font-size: 0.85em; color: #666;">(${room.utiaChildren} × ${utiaRate} Kč)</span></span>`;
          } else {
            // All External
            const externalRate = room.externalChildrenPrice / room.externalChildren;
            html += `<span>${t.children}:</span>`;
            html += `<span style="font-weight: 500;">+${room.childrenPrice.toLocaleString('cs-CZ')} Kč <span style="font-size: 0.85em; color: #666;">(${room.externalChildren} × ${externalRate} Kč)</span></span>`;
          }
        } else {
          // Fallback: simple display without breakdown
          html += `<span>${t.children} (${room.children}×):</span>`;
          html += `<span style="font-weight: 500;">+${room.childrenPrice.toLocaleString('cs-CZ')} Kč</span>`;
        }

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
      perRoomGuests = {}, // FIX #4: Per-room guest type data
      perRoomDates = null, // NEW 2025-11-14: Per-room date ranges for composite bookings
      nights = 1,
      settings,
      fallbackGuestType = 'external',
    } = options;

    // CRITICAL: Validate required configuration exists - throw error instead of returning 0
    if (!settings || !settings.prices) {
      const error = new Error('Chybí cenová konfigurace - nelze spočítat cenu');
      console.error('[PriceCalculator] Missing settings or prices configuration', error);
      throw error;
    }

    const { prices } = settings;

    // Validate that prices configuration has required guest type keys
    if (!prices.utia && !prices.external) {
      const error = new Error('Chybí cenová konfigurace pro typy hostů');
      console.error('[PriceCalculator] Missing utia/external price configuration', error);
      throw error;
    }
    let totalPrice = 0;

    // FIX 2025-12: Normalize perRoomGuests - convert Array to Object format if needed
    // Some code paths pass Array [{roomId, guestType, ...}], but we need Object {roomId: {...}}
    let normalizedPerRoomGuests = perRoomGuests;
    if (perRoomGuests && Array.isArray(perRoomGuests)) {
      normalizedPerRoomGuests = {};
      for (const item of perRoomGuests) {
        if (item && item.roomId) {
          normalizedPerRoomGuests[item.roomId] = item;
        }
      }
    }

    // FIX #4: Calculate empty room prices PER-ROOM based on per-room guest types
    // If perRoomGuests data available, use per-room guest types
    // Otherwise fall back to booking-level logic (for backward compatibility)
    for (const roomId of rooms) {
      const room = settings.rooms?.find((r) => r.id === roomId);
      const roomType = room?.type || 'small';

      // Determine guest type for THIS room specifically
      let roomGuestType;

      if (
        normalizedPerRoomGuests &&
        normalizedPerRoomGuests[roomId] &&
        normalizedPerRoomGuests[roomId].guestType
      ) {
        // Use per-room guest type if available (NEW logic)
        roomGuestType = normalizedPerRoomGuests[roomId].guestType;
      } else {
        // Fallback: Use booking-level guestType (when perRoomGuests data not available)
        // This prevents incorrect pricing when mixing ÚTIA and external guests
        roomGuestType = fallbackGuestType || 'external';
      }

      // CRITICAL: Validate price configuration exists for this guest type and room type
      if (!prices[roomGuestType]) {
        const error = new Error(`Chybějící cenová konfigurace pro typ hosta: ${roomGuestType}`);
        console.error('[PriceCalculator]', error);
        throw error;
      }

      const roomPriceConfig = prices[roomGuestType][roomType];

      if (!roomPriceConfig) {
        const error = new Error(
          `Chybějící cenová konfigurace pro typ pokoje: ${roomType} (host: ${roomGuestType})`
        );
        console.error('[PriceCalculator]', error);
        throw error;
      }

      // Empty room price (base accommodation cost) - NOW PER-ROOM!
      const emptyRoomPrice = this.getEmptyRoomPrice(roomPriceConfig);

      // NEW 2025-11-14: Calculate nights per room if perRoomDates provided
      let roomNights = nights; // Default to booking-level nights
      if (perRoomDates && perRoomDates[roomId]) {
        const { startDate, endDate } = perRoomDates[roomId];
        const start = new Date(startDate);
        const end = new Date(endDate);
        roomNights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      }

      totalPrice += emptyRoomPrice * roomNights;
    }

    // Now add per-guest surcharges based on individual guest types

    // NEW 2025-11-14: If perRoomDates available, calculate surcharges per room
    // Otherwise use the original global averaging approach for backward compatibility
    if (
      perRoomDates &&
      normalizedPerRoomGuests &&
      Object.keys(normalizedPerRoomGuests).length > 0
    ) {
      // Per-room surcharge calculation (for composite bookings)
      for (const roomId of rooms) {
        const room = settings.rooms?.find((r) => r.id === roomId);
        const roomType = room?.type || 'small';

        // Get per-room guest counts
        const roomGuests = normalizedPerRoomGuests[roomId] || {};
        const roomAdults = roomGuests.adults || 0;
        const roomChildren = roomGuests.children || 0;
        const roomGuestType = roomGuests.guestType || fallbackGuestType;

        // Get price config for this room's guest type
        const roomPriceConfig = prices[roomGuestType]?.[roomType];
        if (!roomPriceConfig) {
          console.warn(
            `[PriceCalculator] Missing price config for room ${roomId} (${roomGuestType}/${roomType})`
          );
          continue;
        }

        // Calculate nights for THIS room
        let roomNights = nights;
        if (perRoomDates[roomId]) {
          const { startDate, endDate } = perRoomDates[roomId];
          const start = new Date(startDate);
          const end = new Date(endDate);
          roomNights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        }

        // Add surcharges for this room
        totalPrice += roomAdults * roomPriceConfig.adult * roomNights;
        totalPrice += roomChildren * roomPriceConfig.child * roomNights;
      }
    } else {
      // Original global averaging approach (backward compatibility)
      // Count guests by type and pricing category
      let utiaAdults = 0;
      let utiaChildren = 0;
      let externalAdults = 0;
      let externalChildren = 0;

      for (const guest of guestNames) {
        const priceType = guest.guestPriceType || fallbackGuestType;
        const { personType } = guest;

        // Skip toddlers (they're free)
        if (personType === 'toddler') {
          continue;
        }

        // Count by pricing type and person type
        if (priceType === 'utia') {
          if (personType === 'adult') {
            utiaAdults += 1;
          } else if (personType === 'child') {
            utiaChildren += 1;
          }
        } else if (personType === 'adult') {
          // External adults
          externalAdults += 1;
        } else if (personType === 'child') {
          // External children
          externalChildren += 1;
        }
      }

      // Calculate average surcharge rates across all rooms
      // (This handles multi-room bookings where rooms might be different sizes)
      const avgUtiaRates = this.getAverageRoomPriceConfig(rooms, settings, 'utia');
      const avgExternalRates = this.getAverageRoomPriceConfig(rooms, settings, 'external');

      // Add ÚTIA guest surcharges
      const utiaAdultSurcharge = utiaAdults * avgUtiaRates.adult * nights;
      const utiaChildSurcharge = utiaChildren * avgUtiaRates.child * nights;

      totalPrice += utiaAdultSurcharge;
      totalPrice += utiaChildSurcharge;

      // Add External guest surcharges
      const externalAdultSurcharge = externalAdults * avgExternalRates.adult * nights;
      const externalChildSurcharge = externalChildren * avgExternalRates.child * nights;

      totalPrice += externalAdultSurcharge;
      totalPrice += externalChildSurcharge;
    }

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
