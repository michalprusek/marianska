/**
 * Tests for js/shared/priceCalculator.js
 */

describe('PriceCalculator', () => {
  // Import directly - the module exports for Node.js
  const PriceCalculator = require('../../js/shared/priceCalculator.js');

  const mockSettings = {
    prices: {
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
    },
    bulkPrices: {
      basePrice: 2000,
      utiaAdult: 100,
      utiaChild: 0,
      externalAdult: 250,
      externalChild: 50,
    },
  };

  describe('calculatePrice() - Individual Bookings', () => {
    it('should calculate base price for UTIA guest, 1 room, 1 adult, 1 night', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 1,
        children: 0,
        toddlers: 0,
        nights: 1,
        roomsCount: 1,
        settings: mockSettings,
      });
      // Base price only (1 adult per room included)
      expect(price).toBe(298);
    });

    it('should calculate price for UTIA guest with additional adults', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 3, // 1 included in base, 2 additional
        children: 0,
        toddlers: 0,
        nights: 1,
        roomsCount: 1,
        settings: mockSettings,
      });
      // Base 298 + 2 * 49 (additional adults) = 396
      expect(price).toBe(396);
    });

    it('should calculate price for UTIA guest with children', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 2,
        children: 2,
        toddlers: 0,
        nights: 1,
        roomsCount: 1,
        settings: mockSettings,
      });
      // Base 298 + 1 * 49 (additional adult) + 2 * 24 (children) = 395
      expect(price).toBe(395);
    });

    it('should not charge for toddlers', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 1,
        children: 0,
        toddlers: 3, // Toddlers are free
        nights: 1,
        roomsCount: 1,
        settings: mockSettings,
      });
      // Base price only, toddlers free
      expect(price).toBe(298);
    });

    it('should multiply by number of nights', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 2,
        children: 1,
        toddlers: 0,
        nights: 3,
        roomsCount: 1,
        settings: mockSettings,
      });
      // (Base 298 + 1 * 49 + 1 * 24) * 3 nights = 371 * 3 = 1113
      expect(price).toBe(1113);
    });

    it('should multiply base price by number of rooms', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 2,
        children: 0,
        toddlers: 0,
        nights: 1,
        rooms: ['12', '13'], // NEW: Use rooms array instead of roomsCount
        settings: mockSettings,
      });
      // NEW MODEL: (empty 249 × 2 rooms × 1 night) + (2 adults × 49 × 1 night) = 498 + 98 = 596
      expect(price).toBe(596);
    });

    it('should calculate price for external guests', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'external',
        adults: 2,
        children: 1,
        toddlers: 0,
        nights: 2,
        roomsCount: 1,
        settings: mockSettings,
      });
      // (Base 499 + 1 * 99 + 1 * 49) * 2 nights = 647 * 2 = 1294
      expect(price).toBe(1294);
    });

    it('should handle multiple rooms with multiple guests', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 5,
        children: 2,
        toddlers: 1, // Toddlers are free
        nights: 2,
        rooms: ['12', '13', '14'], // NEW: Use rooms array instead of roomsCount
        settings: mockSettings,
      });
      // NEW MODEL: (empty 249 × 3 rooms × 2 nights) + (5 adults × 49 × 2) + (2 children × 24 × 2)
      // = 1494 + 490 + 96 = 2080
      expect(price).toBe(2080);
    });

    it('should return 0 when settings are missing', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 1,
        children: 0,
        nights: 1,
        roomsCount: 1,
        settings: null,
      });
      expect(price).toBe(0);
    });

    it('should return 0 when prices config is missing', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 1,
        children: 0,
        nights: 1,
        roomsCount: 1,
        settings: { bulkPrices: mockSettings.bulkPrices },
      });
      expect(price).toBe(0);
    });

    it('should default to external prices for unknown guest type', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'unknown',
        adults: 1,
        children: 0,
        nights: 1,
        roomsCount: 1,
        settings: mockSettings,
      });
      // Should use external prices
      expect(price).toBe(499);
    });
  });

  describe('calculatePriceFromRooms() - Legacy Format', () => {
    it('should calculate price from rooms array', () => {
      const price = PriceCalculator.calculatePriceFromRooms({
        rooms: ['12', '13'],
        guestType: 'utia',
        adults: 3,
        children: 1,
        nights: 2,
        settings: mockSettings,
      });
      // 2 rooms, 3 adults (2 included, 1 additional), 1 child, 2 nights
      // (Base 298 * 2 + 1 * 49 + 1 * 24) * 2 = (596 + 49 + 24) * 2 = 669 * 2 = 1338
      expect(price).toBe(1338);
    });

    it('should handle single room', () => {
      const price = PriceCalculator.calculatePriceFromRooms({
        rooms: ['12'],
        guestType: 'external',
        adults: 1,
        children: 0,
        nights: 1,
        settings: mockSettings,
      });
      expect(price).toBe(499); // Base price for external
    });
  });

  describe('calculateBulkPrice() - Bulk Bookings', () => {
    it('should calculate bulk price for UTIA guests', () => {
      const price = PriceCalculator.calculateBulkPrice({
        guestType: 'utia',
        adults: 5,
        children: 3,
        toddlers: 1,
        nights: 2,
        settings: mockSettings,
      });
      // (Base 2000 + 5 * 100 + 3 * 0) * 2 = (2000 + 500 + 0) * 2 = 2500 * 2 = 5000
      expect(price).toBe(5000);
    });

    it('should calculate bulk price for external guests', () => {
      const price = PriceCalculator.calculateBulkPrice({
        guestType: 'external',
        adults: 4,
        children: 2,
        toddlers: 0,
        nights: 3,
        settings: mockSettings,
      });
      // (Base 2000 + 4 * 250 + 2 * 50) * 3 = (2000 + 1000 + 100) * 3 = 3100 * 3 = 9300
      expect(price).toBe(9300);
    });

    it('should not charge UTIA children in bulk bookings', () => {
      const price = PriceCalculator.calculateBulkPrice({
        guestType: 'utia',
        adults: 3,
        children: 5, // Children are free for UTIA bulk
        toddlers: 0,
        nights: 1,
        settings: mockSettings,
      });
      // Base 2000 + 3 * 100 + 5 * 0 = 2300
      expect(price).toBe(2300);
    });

    it('should not charge for toddlers in bulk bookings', () => {
      const price = PriceCalculator.calculateBulkPrice({
        guestType: 'external',
        adults: 2,
        children: 1,
        toddlers: 4, // Toddlers always free
        nights: 1,
        settings: mockSettings,
      });
      // Base 2000 + 2 * 250 + 1 * 50 = 2550
      expect(price).toBe(2550);
    });

    it('should return 0 when settings are missing', () => {
      const price = PriceCalculator.calculateBulkPrice({
        guestType: 'utia',
        adults: 5,
        children: 2,
        nights: 2,
        settings: null,
      });
      expect(price).toBe(0);
    });

    it('should return 0 when bulkPrices config is missing', () => {
      const price = PriceCalculator.calculateBulkPrice({
        guestType: 'utia',
        adults: 5,
        children: 2,
        nights: 2,
        settings: { prices: mockSettings.prices },
      });
      expect(price).toBe(0);
    });
  });

  describe('getDefaultPrices()', () => {
    it('should return default price configuration', () => {
      const defaults = PriceCalculator.getDefaultPrices();
      // NEW room-size-based pricing model (2025-11-04)
      expect(defaults).toEqual({
        utia: {
          small: {
            base: 300,
            adult: 50,
            child: 25,
          },
          large: {
            base: 400,
            adult: 50,
            child: 25,
          },
        },
        external: {
          small: {
            base: 500,
            adult: 100,
            child: 50,
          },
          large: {
            base: 600,
            adult: 100,
            child: 50,
          },
        },
      });
    });
  });

  describe('getDefaultBulkPrices()', () => {
    it('should return default bulk price configuration', () => {
      const defaults = PriceCalculator.getDefaultBulkPrices();
      expect(defaults).toEqual({
        basePrice: 2000,
        utiaAdult: 100,
        utiaChild: 0,
        externalAdult: 250,
        externalChild: 50,
      });
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle zero adults', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 0,
        children: 2,
        nights: 1,
        rooms: ['12'], // NEW: Use rooms array
        settings: mockSettings,
      });
      // NEW MODEL: (empty 249 × 1 room × 1 night) + (0 adults × 49) + (2 children × 24)
      // = 249 + 0 + 48 = 297
      expect(price).toBe(297);
    });

    it('should handle zero nights (edge case)', () => {
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 2,
        children: 1,
        nights: 0,
        roomsCount: 1,
        settings: mockSettings,
      });
      expect(price).toBe(0);
    });

    it('should round prices correctly', () => {
      const customSettings = {
        prices: {
          utia: {
            base: 100.5,
            adult: 25.7,
            child: 10.3,
          },
        },
      };
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 2,
        children: 1,
        nights: 1,
        roomsCount: 1,
        settings: customSettings,
      });
      // 100.5 + 25.7 + 10.3 = 136.5 → rounded to 137
      expect(price).toBe(137);
    });
  });

  describe('Real-world scenarios', () => {
    it('should calculate typical family booking (UTIA)', () => {
      // Family: 2 adults, 2 children (7 and 10 years), 1 toddler (2 years)
      // 1 room, 3 nights
      const price = PriceCalculator.calculatePrice({
        guestType: 'utia',
        adults: 2,
        children: 2,
        toddlers: 1,
        nights: 3,
        roomsCount: 1,
        settings: mockSettings,
      });
      // (298 + 1*49 + 2*24) * 3 = (298 + 49 + 48) * 3 = 395 * 3 = 1185
      expect(price).toBe(1185);
    });

    it('should calculate large group booking (External)', () => {
      // Company retreat: 10 adults, 3 rooms, 2 nights
      const price = PriceCalculator.calculatePrice({
        guestType: 'external',
        adults: 10,
        children: 0,
        toddlers: 0,
        nights: 2,
        rooms: ['12', '13', '14'], // NEW: Use rooms array instead of roomsCount
        settings: mockSettings,
      });
      // NEW MODEL: (empty 400 × 3 rooms × 2 nights) + (10 adults × 99 × 2 nights)
      // = 2400 + 1980 = 4380
      expect(price).toBe(4380);
    });

    it('should calculate weekend bulk booking (UTIA)', () => {
      // Entire chalet for weekend: 8 adults, 4 children, 2 nights
      const price = PriceCalculator.calculateBulkPrice({
        guestType: 'utia',
        adults: 8,
        children: 4,
        toddlers: 0,
        nights: 2,
        settings: mockSettings,
      });
      // (2000 + 8*100 + 4*0) * 2 = 2800 * 2 = 5600
      expect(price).toBe(5600);
    });
  });
});
