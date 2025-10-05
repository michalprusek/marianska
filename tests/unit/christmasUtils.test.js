/**
 * Tests for js/shared/christmasUtils.js
 */

describe('ChristmasUtils', () => {
  // Import directly - the module exports for Node.js
  // DateUtils is loaded as a dependency of ChristmasUtils
  require('../../js/shared/dateUtils.js'); // Load DateUtils first (dependency)
  const ChristmasUtils = require('../../js/shared/christmasUtils.js');

  const mockSettings = {
    christmasPeriod: {
      start: '2025-12-23',
      end: '2026-01-02',
    },
    christmasPeriods: [
      { start: '2025-12-23', end: '2026-01-02' },
      { start: '2026-12-24', end: '2027-01-03' },
    ],
    christmasAccessCodes: ['XMAS2025', 'VIP123', 'SPECIAL2025'],
  };

  describe('isChristmasPeriod()', () => {
    it('should return true for dates within Christmas period (legacy format)', () => {
      const settings = { christmasPeriod: { start: '2025-12-23', end: '2026-01-02' } };

      expect(ChristmasUtils.isChristmasPeriod('2025-12-23', settings)).toBe(true);
      expect(ChristmasUtils.isChristmasPeriod('2025-12-25', settings)).toBe(true);
      expect(ChristmasUtils.isChristmasPeriod('2026-01-01', settings)).toBe(true);
      expect(ChristmasUtils.isChristmasPeriod('2026-01-02', settings)).toBe(true);
    });

    it('should return false for dates outside Christmas period (legacy format)', () => {
      const settings = { christmasPeriod: { start: '2025-12-23', end: '2026-01-02' } };

      expect(ChristmasUtils.isChristmasPeriod('2025-12-22', settings)).toBe(false);
      expect(ChristmasUtils.isChristmasPeriod('2026-01-03', settings)).toBe(false);
      expect(ChristmasUtils.isChristmasPeriod('2025-11-15', settings)).toBe(false);
    });

    it('should work with Date objects', () => {
      const settings = { christmasPeriod: { start: '2025-12-23', end: '2026-01-02' } };

      expect(ChristmasUtils.isChristmasPeriod(new Date('2025-12-25'), settings)).toBe(true);
      expect(ChristmasUtils.isChristmasPeriod(new Date('2025-12-20'), settings)).toBe(false);
    });

    it('should support new format with multiple periods', () => {
      expect(ChristmasUtils.isChristmasPeriod('2025-12-25', mockSettings)).toBe(true);
      expect(ChristmasUtils.isChristmasPeriod('2026-12-25', mockSettings)).toBe(true);
      expect(ChristmasUtils.isChristmasPeriod('2025-07-15', mockSettings)).toBe(false);
    });

    it('should use default Christmas dates when no settings provided', () => {
      // Default: Dec 23 - Jan 2
      expect(ChristmasUtils.isChristmasPeriod('2025-12-25', null)).toBe(true);
      expect(ChristmasUtils.isChristmasPeriod('2025-12-23', null)).toBe(true);
      expect(ChristmasUtils.isChristmasPeriod('2026-01-01', null)).toBe(true);
      expect(ChristmasUtils.isChristmasPeriod('2026-01-02', null)).toBe(true);
      expect(ChristmasUtils.isChristmasPeriod('2025-12-22', null)).toBe(false);
      expect(ChristmasUtils.isChristmasPeriod('2026-01-03', null)).toBe(false);
    });

    it('should handle edge cases at period boundaries', () => {
      const settings = { christmasPeriod: { start: '2025-12-23', end: '2026-01-02' } };

      // First day
      expect(ChristmasUtils.isChristmasPeriod('2025-12-23', settings)).toBe(true);
      // Last day
      expect(ChristmasUtils.isChristmasPeriod('2026-01-02', settings)).toBe(true);
      // Day before
      expect(ChristmasUtils.isChristmasPeriod('2025-12-22', settings)).toBe(false);
      // Day after
      expect(ChristmasUtils.isChristmasPeriod('2026-01-03', settings)).toBe(false);
    });
  });

  describe('validateChristmasCode()', () => {
    it('should return true for valid access codes', () => {
      expect(ChristmasUtils.validateChristmasCode('XMAS2025', mockSettings)).toBe(true);
      expect(ChristmasUtils.validateChristmasCode('VIP123', mockSettings)).toBe(true);
      expect(ChristmasUtils.validateChristmasCode('SPECIAL2025', mockSettings)).toBe(true);
    });

    it('should return false for invalid access codes', () => {
      expect(ChristmasUtils.validateChristmasCode('WRONG', mockSettings)).toBe(false);
      expect(ChristmasUtils.validateChristmasCode('xmas2025', mockSettings)).toBe(false); // Case sensitive
      expect(ChristmasUtils.validateChristmasCode('', mockSettings)).toBe(false);
      expect(ChristmasUtils.validateChristmasCode(null, mockSettings)).toBe(false);
    });

    it('should return false when settings are missing', () => {
      expect(ChristmasUtils.validateChristmasCode('XMAS2025', null)).toBe(false);
      expect(ChristmasUtils.validateChristmasCode('XMAS2025', {})).toBe(false);
    });

    it('should return false when christmasAccessCodes array is empty', () => {
      const settings = { christmasAccessCodes: [] };
      expect(ChristmasUtils.validateChristmasCode('XMAS2025', settings)).toBe(false);
    });
  });

  describe('checkChristmasAccessRequirement()', () => {
    describe('Before October 1st rules', () => {
      it('should require code for single bookings before Oct 1', () => {
        const result = ChristmasUtils.checkChristmasAccessRequirement(
          new Date('2025-09-30'),
          '2025-12-23',
          false // single booking
        );
        expect(result.codeRequired).toBe(true);
        expect(result.bulkBlocked).toBe(false);
      });

      it('should require code for bulk bookings before Oct 1', () => {
        const result = ChristmasUtils.checkChristmasAccessRequirement(
          new Date('2025-09-15'),
          '2025-12-23',
          true // bulk booking
        );
        expect(result.codeRequired).toBe(true);
        expect(result.bulkBlocked).toBe(false);
      });

      it('should require code on exactly Sept 30 at 23:59', () => {
        const result = ChristmasUtils.checkChristmasAccessRequirement(
          new Date('2025-09-30T23:59:59'),
          '2025-12-23',
          false
        );
        expect(result.codeRequired).toBe(true);
        expect(result.bulkBlocked).toBe(false);
      });
    });

    describe('After October 1st rules', () => {
      it('should NOT require code for single bookings after Oct 1', () => {
        const result = ChristmasUtils.checkChristmasAccessRequirement(
          new Date('2025-10-01'),
          '2025-12-23',
          false // single booking
        );
        expect(result.codeRequired).toBe(false);
        expect(result.bulkBlocked).toBe(false);
      });

      it('should block bulk bookings after Oct 1', () => {
        const result = ChristmasUtils.checkChristmasAccessRequirement(
          new Date('2025-10-15'),
          '2025-12-23',
          true // bulk booking
        );
        expect(result.codeRequired).toBe(false);
        expect(result.bulkBlocked).toBe(true);
      });

      it('should block bulk bookings on exactly Oct 1', () => {
        const result = ChristmasUtils.checkChristmasAccessRequirement(
          new Date('2025-10-01T00:00:00'),
          '2025-12-23',
          true
        );
        expect(result.codeRequired).toBe(false);
        expect(result.bulkBlocked).toBe(true);
      });
    });

    it('should return no restrictions when no Christmas period start provided', () => {
      const result = ChristmasUtils.checkChristmasAccessRequirement(
        new Date('2025-10-15'),
        null,
        true
      );
      expect(result.codeRequired).toBe(false);
      expect(result.bulkBlocked).toBe(false);
    });

    it('should handle string dates correctly', () => {
      const result = ChristmasUtils.checkChristmasAccessRequirement(
        '2025-09-15',
        '2025-12-23',
        false
      );
      expect(result.codeRequired).toBe(true);
    });

    it('should use Christmas year for Sept 30 cutoff', () => {
      // Christmas period starting in 2026
      const result1 = ChristmasUtils.checkChristmasAccessRequirement(
        new Date('2025-09-30'), // Before Sept 30, 2026
        '2026-01-05',
        true
      );
      expect(result1.codeRequired).toBe(true);
      expect(result1.bulkBlocked).toBe(false);

      const result2 = ChristmasUtils.checkChristmasAccessRequirement(
        new Date('2026-09-30'), // Sept 30 of Christmas year
        '2026-12-23',
        true
      );
      expect(result2.codeRequired).toBe(true);
      expect(result2.bulkBlocked).toBe(false);

      const result3 = ChristmasUtils.checkChristmasAccessRequirement(
        new Date('2026-10-01'), // After Sept 30 of Christmas year
        '2026-12-23',
        true
      );
      expect(result3.codeRequired).toBe(false);
      expect(result3.bulkBlocked).toBe(true);
    });
  });

  describe('getFirstChristmasPeriod()', () => {
    it('should return first period from new format', () => {
      const period = ChristmasUtils.getFirstChristmasPeriod(mockSettings);
      expect(period).toEqual({ start: '2025-12-23', end: '2026-01-02' });
    });

    it('should return legacy format period', () => {
      const settings = { christmasPeriod: { start: '2025-12-20', end: '2026-01-05' } };
      const period = ChristmasUtils.getFirstChristmasPeriod(settings);
      expect(period).toEqual({ start: '2025-12-20', end: '2026-01-05' });
    });

    it('should return null when no settings provided', () => {
      expect(ChristmasUtils.getFirstChristmasPeriod(null)).toBeNull();
      expect(ChristmasUtils.getFirstChristmasPeriod({})).toBeNull();
    });

    it('should return null when periods array is empty', () => {
      const settings = { christmasPeriods: [] };
      expect(ChristmasUtils.getFirstChristmasPeriod(settings)).toBeNull();
    });
  });

  describe('overlapsChristmasPeriod()', () => {
    it('should detect overlap with Christmas period', () => {
      const settings = { christmasPeriod: { start: '2025-12-23', end: '2026-01-02' } };

      // Booking fully within Christmas
      expect(ChristmasUtils.overlapsChristmasPeriod('2025-12-25', '2025-12-28', settings)).toBe(
        true
      );

      // Booking starts before, ends during
      expect(ChristmasUtils.overlapsChristmasPeriod('2025-12-20', '2025-12-25', settings)).toBe(
        true
      );

      // Booking starts during, ends after
      expect(ChristmasUtils.overlapsChristmasPeriod('2025-12-30', '2026-01-05', settings)).toBe(
        true
      );

      // Booking encompasses entire Christmas period
      expect(ChristmasUtils.overlapsChristmasPeriod('2025-12-01', '2026-01-15', settings)).toBe(
        true
      );
    });

    it('should return false when no overlap', () => {
      const settings = { christmasPeriod: { start: '2025-12-23', end: '2026-01-02' } };

      // Before Christmas
      expect(ChristmasUtils.overlapsChristmasPeriod('2025-12-15', '2025-12-22', settings)).toBe(
        false
      );

      // After Christmas
      expect(ChristmasUtils.overlapsChristmasPeriod('2026-01-03', '2026-01-10', settings)).toBe(
        false
      );
    });

    it('should detect overlap with any of multiple periods', () => {
      // Overlaps with first period
      expect(ChristmasUtils.overlapsChristmasPeriod('2025-12-25', '2025-12-28', mockSettings)).toBe(
        true
      );

      // Overlaps with second period
      expect(ChristmasUtils.overlapsChristmasPeriod('2026-12-25', '2026-12-28', mockSettings)).toBe(
        true
      );

      // No overlap with any period
      expect(ChristmasUtils.overlapsChristmasPeriod('2026-06-01', '2026-06-10', mockSettings)).toBe(
        false
      );
    });

    it('should handle edge case bookings at period boundaries', () => {
      const settings = { christmasPeriod: { start: '2025-12-23', end: '2026-01-02' } };

      // Ends on first day of Christmas
      expect(ChristmasUtils.overlapsChristmasPeriod('2025-12-20', '2025-12-23', settings)).toBe(
        true
      );

      // Starts on last day of Christmas
      expect(ChristmasUtils.overlapsChristmasPeriod('2026-01-02', '2026-01-05', settings)).toBe(
        true
      );
    });

    it('should return false when no settings', () => {
      expect(ChristmasUtils.overlapsChristmasPeriod('2025-12-25', '2025-12-28', null)).toBe(false);
      expect(ChristmasUtils.overlapsChristmasPeriod('2025-12-25', '2025-12-28', {})).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('should correctly handle a booking in early December before Oct 1', () => {
      // User books in April for Christmas period
      const { codeRequired, bulkBlocked } = ChristmasUtils.checkChristmasAccessRequirement(
        new Date('2025-04-15'),
        '2025-12-23',
        false
      );
      expect(codeRequired).toBe(true);
      expect(bulkBlocked).toBe(false);
    });

    it('should correctly handle a bulk booking attempt in November', () => {
      // User tries to book entire chalet in November for Christmas
      const { codeRequired, bulkBlocked } = ChristmasUtils.checkChristmasAccessRequirement(
        new Date('2025-11-20'),
        '2025-12-23',
        true
      );
      expect(codeRequired).toBe(false);
      expect(bulkBlocked).toBe(true);
    });

    it('should validate booking with correct Christmas code', () => {
      const settings = {
        christmasPeriod: { start: '2025-12-23', end: '2026-01-02' },
        christmasAccessCodes: ['XMAS2025'],
      };

      const isInChristmas = ChristmasUtils.isChristmasPeriod('2025-12-25', settings);
      const isValidCode = ChristmasUtils.validateChristmasCode('XMAS2025', settings);

      expect(isInChristmas).toBe(true);
      expect(isValidCode).toBe(true);
    });

    it('should handle year-crossing Christmas periods correctly', () => {
      const settings = { christmasPeriod: { start: '2025-12-28', end: '2026-01-05' } };

      // Last day of old year
      expect(ChristmasUtils.isChristmasPeriod('2025-12-31', settings)).toBe(true);

      // First day of new year
      expect(ChristmasUtils.isChristmasPeriod('2026-01-01', settings)).toBe(true);

      // Overlap check
      expect(ChristmasUtils.overlapsChristmasPeriod('2025-12-29', '2026-01-03', settings)).toBe(
        true
      );
    });
  });
});
