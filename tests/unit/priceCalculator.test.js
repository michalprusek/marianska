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

  // NEW: Room-size based pricing settings (2025-11-04)
  // NEW MODEL: base = empty room price, adult/child = surcharges
  const mockSettingsWithRoomSizes = {
    prices: {
      utia: {
        small: {
          base: 250, // Empty room price
          adult: 50, // Surcharge per adult
          child: 25, // Surcharge per child
        },
        large: {
          base: 350, // Empty room price
          adult: 70, // Surcharge per adult
          child: 35, // Surcharge per child
        },
      },
      external: {
        small: {
          base: 400, // Empty room price
          adult: 100, // Surcharge per adult
          child: 50, // Surcharge per child
        },
        large: {
          base: 500, // Empty room price
          adult: 120, // Surcharge per adult
          child: 60, // Surcharge per child
        },
      },
    },
    rooms: [
      { id: '12', name: 'Pokoj 12', beds: 3, type: 'small' },
      { id: '13', name: 'Pokoj 13', beds: 3, type: 'small' },
      { id: '14', name: 'Pokoj 14', beds: 4, type: 'large' },
      { id: '22', name: 'Pokoj 22', beds: 2, type: 'small' },
      { id: '23', name: 'Pokoj 23', beds: 3, type: 'small' },
      { id: '24', name: 'Pokoj 24', beds: 4, type: 'large' },
    ],
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

    it('should throw error when settings are missing', () => {
      expect(() => {
        PriceCalculator.calculatePrice({
          guestType: 'utia',
          adults: 1,
          children: 0,
          nights: 1,
          roomsCount: 1,
          settings: null,
        });
      }).toThrow('Chybí cenová konfigurace');
    });

    it('should throw error when prices config is missing', () => {
      expect(() => {
        PriceCalculator.calculatePrice({
          guestType: 'utia',
          adults: 1,
          children: 0,
          nights: 1,
          roomsCount: 1,
          settings: { bulkPrices: mockSettings.bulkPrices },
        });
      }).toThrow('Chybí cenová konfigurace');
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

    it('should throw error when settings are missing', () => {
      expect(() => {
        PriceCalculator.calculateBulkPrice({
          guestType: 'utia',
          adults: 5,
          children: 2,
          nights: 2,
          settings: null,
        });
      }).toThrow('Chybí konfigurace cen pro hromadné rezervace');
    });

    it('should throw error when bulkPrices config is missing', () => {
      expect(() => {
        PriceCalculator.calculateBulkPrice({
          guestType: 'utia',
          adults: 5,
          children: 2,
          nights: 2,
          settings: { prices: mockSettings.prices },
        });
      }).toThrow('Chybí konfigurace cen pro hromadné rezervace');
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

  // NEW: Room-size based pricing tests (2025-11-04)
  describe('Room-size based pricing', () => {
    it('should calculate price for small room with ÚTIA guests', () => {
      const price = PriceCalculator.calculatePriceFromRooms({
        rooms: ['12'], // Small room
        guestType: 'utia',
        adults: 2,
        children: 1,
        nights: 2,
        settings: mockSettingsWithRoomSizes,
      });
      // Empty room: 250 × 2 nights = 500
      // Adults: 2 × 50 × 2 nights = 200
      // Children: 1 × 25 × 2 nights = 50
      // Total: 500 + 200 + 50 = 750
      expect(price).toBe(750);
    });

    it('should calculate price for large room with ÚTIA guests', () => {
      const price = PriceCalculator.calculatePriceFromRooms({
        rooms: ['14'], // Large room
        guestType: 'utia',
        adults: 2,
        children: 1,
        nights: 2,
        settings: mockSettingsWithRoomSizes,
      });
      // Empty room: 350 × 2 nights = 700
      // Adults: 2 × 70 × 2 nights = 280
      // Children: 1 × 35 × 2 nights = 70
      // Total: 700 + 280 + 70 = 1050
      expect(price).toBe(1050);
    });

    it('should calculate price for small room with external guests', () => {
      const price = PriceCalculator.calculatePriceFromRooms({
        rooms: ['13'], // Small room
        guestType: 'external',
        adults: 3,
        children: 2,
        nights: 1,
        settings: mockSettingsWithRoomSizes,
      });
      // Empty room: 400 × 1 night = 400
      // Adults: 3 × 100 × 1 night = 300
      // Children: 2 × 50 × 1 night = 100
      // Total: 400 + 300 + 100 = 800
      expect(price).toBe(800);
    });

    it('should calculate price for large room with external guests', () => {
      const price = PriceCalculator.calculatePriceFromRooms({
        rooms: ['24'], // Large room
        guestType: 'external',
        adults: 3,
        children: 2,
        nights: 1,
        settings: mockSettingsWithRoomSizes,
      });
      // Empty room: 500 × 1 night = 500
      // Adults: 3 × 120 × 1 night = 360
      // Children: 2 × 60 × 1 night = 120
      // Total: 500 + 360 + 120 = 980
      expect(price).toBe(980);
    });

    it('should calculate mixed small and large rooms', () => {
      const price = PriceCalculator.calculatePriceFromRooms({
        rooms: ['12', '14'], // 1 small + 1 large
        guestType: 'utia',
        adults: 4,
        children: 0,
        nights: 3,
        settings: mockSettingsWithRoomSizes,
      });
      // Small empty: 250 × 3 = 750
      // Large empty: 350 × 3 = 1050
      // Adults: 4 × 60 × 3 = 720 (averaged: (50+70)/2 = 60)
      // Total: 750 + 1050 + 720 = 2520
      expect(price).toBe(2520);
    });

    it('should use fallback formula when empty price not configured', () => {
      const settingsWithoutEmpty = {
        prices: {
          utia: {
            small: {
              base: 300,
              adult: 50,
              child: 25,
              // NO empty field - should use base - adult
            },
            large: {
              base: 400,
              adult: 70,
              child: 35,
              // NO empty field
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
              adult: 120,
              child: 60,
            },
          },
        },
        rooms: [
          { id: '12', name: 'Pokoj 12', beds: 3, type: 'small' },
          { id: '13', name: 'Pokoj 13', beds: 3, type: 'small' },
          { id: '14', name: 'Pokoj 14', beds: 4, type: 'large' },
        ],
        bulkPrices: mockSettingsWithRoomSizes.bulkPrices,
      };
      const price = PriceCalculator.calculatePriceFromRooms({
        rooms: ['12'],
        guestType: 'utia',
        adults: 1,
        children: 0,
        nights: 1,
        settings: settingsWithoutEmpty,
      });
      // Empty room (fallback): 300 - 50 = 250
      // Adults: 1 × 50 = 50
      // Total: 250 + 50 = 300
      expect(price).toBe(300);
    });
  });

  // NEW: Per-room guest types tests
  describe('Per-room guest types (mixed ÚTIA and External)', () => {
    it('should calculate price with mixed guest types - 2 rooms', () => {
      const price = PriceCalculator.calculatePrice({
        rooms: ['12', '13'], // 2 small rooms
        guestType: 'utia', // Default (fallback)
        adults: 3,
        children: 1,
        toddlers: 0,
        nights: 2,
        perRoomGuests: [
          { roomId: '12', guestType: 'utia', adults: 2, children: 0 },
          { roomId: '13', guestType: 'external', adults: 1, children: 1 },
        ],
        settings: mockSettingsWithRoomSizes,
      });
      // Room 12 (ÚTIA): empty 250 + (2 adults × 50) = 250 + 100 = 350 per night
      // Room 13 (External): empty 400 + (1 adult × 100) + (1 child × 50) = 400 + 100 + 50 = 550 per night
      // Total per night: 350 + 550 = 900
      // Total for 2 nights: 900 × 2 = 1800
      expect(price).toBe(1800);
    });

    it('should apply ÚTIA pricing when at least one ÚTIA guest per room', () => {
      const price = PriceCalculator.calculatePrice({
        rooms: ['14'], // Large room
        guestType: 'utia',
        adults: 3,
        children: 0,
        toddlers: 0,
        nights: 1,
        perRoomGuests: [{ roomId: '14', guestType: 'utia', adults: 3, children: 0 }],
        settings: mockSettingsWithRoomSizes,
      });
      // ÚTIA pricing: empty 350 + (3 adults × 70) = 350 + 210 = 560
      expect(price).toBe(560);
    });

    it('should use external pricing when no ÚTIA guests', () => {
      const price = PriceCalculator.calculatePrice({
        rooms: ['14'], // Large room
        guestType: 'external',
        adults: 3,
        children: 0,
        toddlers: 0,
        nights: 1,
        perRoomGuests: [{ roomId: '14', guestType: 'external', adults: 3, children: 0 }],
        settings: mockSettingsWithRoomSizes,
      });
      // External pricing: empty 500 + (3 adults × 120) = 500 + 360 = 860
      expect(price).toBe(860);
    });

    it('should handle complex multi-room booking with mixed types', () => {
      const price = PriceCalculator.calculatePrice({
        rooms: ['12', '14', '23'], // 2 small, 1 large
        guestType: 'utia',
        adults: 7,
        children: 3,
        toddlers: 0,
        nights: 3,
        perRoomGuests: [
          { roomId: '12', guestType: 'utia', adults: 2, children: 1 },
          { roomId: '14', guestType: 'external', adults: 3, children: 1 },
          { roomId: '23', guestType: 'utia', adults: 2, children: 1 },
        ],
        settings: mockSettingsWithRoomSizes,
      });
      // Room 12 (ÚTIA small): (250 + 2×50 + 1×25) × 3 = 375 × 3 = 1125
      // Room 14 (External large): (500 + 3×120 + 1×60) × 3 = 920 × 3 = 2760
      // Room 23 (ÚTIA small): (250 + 2×50 + 1×25) × 3 = 375 × 3 = 1125
      // Total: 1125 + 2760 + 1125 = 5010
      expect(price).toBe(5010);
    });
  });

  // NEW: calculatePerGuestPrice() tests
  describe('calculatePerGuestPrice() - Individual guest pricing', () => {
    it('should calculate price based on individual guest names', () => {
      const guestNames = [
        { name: 'Jan Novák', personType: 'adult', guestPriceType: 'utia' },
        { name: 'Petr Svoboda', personType: 'adult', guestPriceType: 'utia' },
        { name: 'Marie Svobodová', personType: 'child', guestPriceType: 'utia' },
      ];
      const price = PriceCalculator.calculatePerGuestPrice({
        rooms: ['12'], // Small room
        guestNames,
        nights: 2,
        settings: mockSettingsWithRoomSizes,
        fallbackGuestType: 'external',
      });
      // Empty room: 250 × 2 = 500 (ÚTIA because at least 1 ÚTIA guest)
      // 2 ÚTIA adults: 2 × 50 × 2 = 200
      // 1 ÚTIA child: 1 × 25 × 2 = 50
      // Total: 500 + 200 + 50 = 750
      expect(price).toBe(750);
    });

    it('should count mixed ÚTIA and external guests correctly', () => {
      const guestNames = [
        { name: 'Jan Novák', personType: 'adult', guestPriceType: 'utia' },
        { name: 'John Smith', personType: 'adult', guestPriceType: 'external' },
        { name: 'Anna Smith', personType: 'child', guestPriceType: 'external' },
      ];
      const price = PriceCalculator.calculatePerGuestPrice({
        rooms: ['14'], // Large room
        guestNames,
        nights: 1,
        settings: mockSettingsWithRoomSizes,
        fallbackGuestType: 'external',
      });
      // Empty room: 350 (ÚTIA pricing because at least 1 ÚTIA guest)
      // 1 ÚTIA adult: 1 × 70 = 70
      // 1 External adult: 1 × 120 = 120
      // 1 External child: 1 × 60 = 60
      // Total: 350 + 70 + 120 + 60 = 600
      expect(price).toBe(600);
    });

    it('should use external pricing when no ÚTIA guests present', () => {
      const guestNames = [
        { name: 'John Smith', personType: 'adult', guestPriceType: 'external' },
        { name: 'Jane Smith', personType: 'adult', guestPriceType: 'external' },
      ];
      const price = PriceCalculator.calculatePerGuestPrice({
        rooms: ['12'], // Small room
        guestNames,
        nights: 2,
        settings: mockSettingsWithRoomSizes,
        fallbackGuestType: 'external',
      });
      // Empty room: 400 × 2 = 800 (External pricing - no ÚTIA guests)
      // 2 External adults: 2 × 100 × 2 = 400
      // Total: 800 + 400 = 1200
      expect(price).toBe(1200);
    });

    it('should not charge for toddlers in per-guest pricing', () => {
      const guestNames = [
        { name: 'Jan Novák', personType: 'adult', guestPriceType: 'utia' },
        { name: 'Emma Nováková', personType: 'toddler', guestPriceType: 'utia' },
        { name: 'Adam Novák', personType: 'toddler', guestPriceType: 'utia' },
      ];
      const price = PriceCalculator.calculatePerGuestPrice({
        rooms: ['12'],
        guestNames,
        nights: 3,
        settings: mockSettingsWithRoomSizes,
        fallbackGuestType: 'external',
      });
      // Empty room: 250 × 3 = 750
      // 1 ÚTIA adult: 1 × 50 × 3 = 150
      // Toddlers: FREE
      // Total: 750 + 150 = 900
      expect(price).toBe(900);
    });

    it('should handle multi-room booking with per-guest pricing', () => {
      const guestNames = [
        { name: 'Jan Novák', personType: 'adult', guestPriceType: 'utia' },
        { name: 'Petr Svoboda', personType: 'adult', guestPriceType: 'external' },
        { name: 'Marie Svobodová', personType: 'child', guestPriceType: 'external' },
      ];
      const price = PriceCalculator.calculatePerGuestPrice({
        rooms: ['12', '13'], // 2 small rooms
        guestNames,
        nights: 2,
        settings: mockSettingsWithRoomSizes,
        fallbackGuestType: 'external',
      });
      // 2 empty rooms: 2 × 250 × 2 = 1000 (ÚTIA because 1 ÚTIA guest)
      // 1 ÚTIA adult: 1 × 50 × 2 = 100
      // 1 External adult: 1 × 100 × 2 = 200
      // 1 External child: 1 × 50 × 2 = 100
      // Total: 1000 + 100 + 200 + 100 = 1400
      expect(price).toBe(1400);
    });

    it('should throw error when settings are missing', () => {
      const guestNames = [{ name: 'Jan Novák', personType: 'adult', guestPriceType: 'utia' }];
      expect(() => {
        PriceCalculator.calculatePerGuestPrice({
          rooms: ['12'],
          guestNames,
          nights: 1,
          settings: null,
          fallbackGuestType: 'external',
        });
      }).toThrow('Chybí cenová konfigurace');
    });

    it('should throw error when price configuration is missing', () => {
      const guestNames = [{ name: 'Jan Novák', personType: 'adult', guestPriceType: 'utia' }];
      expect(() => {
        PriceCalculator.calculatePerGuestPrice({
          rooms: ['12'],
          guestNames,
          nights: 1,
          settings: { rooms: [] }, // Missing prices
          fallbackGuestType: 'external',
        });
      }).toThrow('Chybí cenová konfigurace');
    });

    it('should use fallback guest type when guestPriceType not specified', () => {
      const guestNames = [
        { name: 'Mystery Guest', personType: 'adult' }, // No guestPriceType
      ];
      const price = PriceCalculator.calculatePerGuestPrice({
        rooms: ['12'],
        guestNames,
        nights: 1,
        settings: mockSettingsWithRoomSizes,
        fallbackGuestType: 'external', // Should use this
      });
      // External fallback: empty 400 + 1 adult × 100 = 500
      expect(price).toBe(500);
    });
  });

  // NEW: CLAUDE.md example validation test
  describe('CLAUDE.md example validation', () => {
    it('should match the example from CLAUDE.md documentation', () => {
      // Example from CLAUDE.md lines 207-213:
      // Malý pokoj, ÚTIA, 2 dospělí, 1 dítě, 2 noci:
      // = 250 × 2 + (2 × 50 × 2) + (1 × 25 × 2)
      // = 500 + 200 + 50
      // = 750 Kč
      const price = PriceCalculator.calculatePriceFromRooms({
        rooms: ['12'], // Small room
        guestType: 'utia',
        adults: 2,
        children: 1,
        nights: 2,
        settings: mockSettingsWithRoomSizes,
      });
      expect(price).toBe(750);
    });
  });
});
