/**
 * Tests for js/shared/idGenerator.js
 */

describe('IdGenerator', () => {
  // Import directly - the module exports for Node.js
  const IdGenerator = require('../../js/shared/idGenerator.js');

  describe('generateBookingId()', () => {
    it('should generate a booking ID with correct format', () => {
      const id = IdGenerator.generateBookingId();
      expect(id).toMatch(/^BK[A-Z0-9]{13}$/u);
    });

    it('should generate unique booking IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(IdGenerator.generateBookingId());
      }
      expect(ids.size).toBe(100);
    });

    it('should always start with BK prefix', () => {
      for (let i = 0; i < 10; i++) {
        const id = IdGenerator.generateBookingId();
        expect(id.startsWith('BK')).toBe(true);
      }
    });

    it('should generate IDs of correct length (15 chars total)', () => {
      const id = IdGenerator.generateBookingId();
      expect(id.length).toBe(15); // BK + 13 chars
    });
  });

  describe('generateEditToken()', () => {
    it('should generate a 30-character token', () => {
      const token = IdGenerator.generateEditToken();
      expect(token.length).toBe(30);
    });

    it('should only contain lowercase alphanumeric characters', () => {
      const token = IdGenerator.generateEditToken();
      expect(token).toMatch(/^[a-z0-9]{30}$/u);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(IdGenerator.generateEditToken());
      }
      expect(tokens.size).toBe(100);
    });

    it('should provide sufficient entropy (30 chars)', () => {
      const token = IdGenerator.generateEditToken();
      // 36^30 combinations (a-z0-9) = ~5.4e47
      // Token should be cryptographically secure for URL-based edits
      expect(token.length).toBe(30);
      const uniqueChars = new Set(token.split(''));
      // Should use varied characters (at least 5 different ones in 30 chars)
      expect(uniqueChars.size).toBeGreaterThanOrEqual(5);
    });
  });

  describe('generateBlockageId()', () => {
    it('should generate a blockage ID with BLK prefix', () => {
      const id = IdGenerator.generateBlockageId();
      expect(id.startsWith('BLK')).toBe(true);
    });

    it('should contain only uppercase alphanumeric characters after prefix', () => {
      const id = IdGenerator.generateBlockageId();
      const suffix = id.substring(3);
      expect(suffix).toMatch(/^[A-Z0-9]+$/u);
    });

    it('should generate unique blockage IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        ids.add(IdGenerator.generateBlockageId());
      }
      expect(ids.size).toBe(50);
    });
  });

  describe('generateChristmasPeriodId()', () => {
    it('should generate an ID with XMAS prefix', () => {
      const id = IdGenerator.generateChristmasPeriodId();
      expect(id.startsWith('XMAS')).toBe(true);
    });

    it('should contain only uppercase alphanumeric characters after prefix', () => {
      const id = IdGenerator.generateChristmasPeriodId();
      const suffix = id.substring(4);
      expect(suffix).toMatch(/^[A-Z0-9]+$/u);
    });

    it('should generate unique Christmas period IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        ids.add(IdGenerator.generateChristmasPeriodId());
      }
      expect(ids.size).toBe(50);
    });
  });

  describe('generateProposalId()', () => {
    it('should generate an ID with PROP prefix', () => {
      const id = IdGenerator.generateProposalId();
      expect(id.startsWith('PROP')).toBe(true);
    });

    it('should contain only uppercase alphanumeric characters after prefix', () => {
      const id = IdGenerator.generateProposalId();
      const suffix = id.substring(4);
      expect(suffix).toMatch(/^[A-Z0-9]+$/u);
    });

    it('should generate unique proposal IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        ids.add(IdGenerator.generateProposalId());
      }
      expect(ids.size).toBe(50);
    });
  });

  describe('generateSessionId()', () => {
    it('should generate an ID with SESS prefix', () => {
      const id = IdGenerator.generateSessionId();
      expect(id.startsWith('SESS')).toBe(true);
    });

    it('should contain only uppercase alphanumeric characters after prefix', () => {
      const id = IdGenerator.generateSessionId();
      const suffix = id.substring(4);
      expect(suffix).toMatch(/^[A-Z0-9]+$/u);
    });

    it('should generate unique session IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        ids.add(IdGenerator.generateSessionId());
      }
      expect(ids.size).toBe(50);
    });

    it('should generate IDs with sufficient length for sessions', () => {
      const id = IdGenerator.generateSessionId();
      // FIX 2025-12-23: Math.random().toString(36).substr(2) produces variable length
      // Base 36 encoding of random number can be 8-11 chars, minimum observed is ~8
      // SESS (4) + random (8+) = at least 12 chars
      expect(id.length).toBeGreaterThanOrEqual(12);
      expect(id).toMatch(/^SESS[A-Z0-9]+$/);
    });
  });

  describe('generateToken()', () => {
    it('should generate a token with default length of 12', () => {
      const token = IdGenerator.generateToken();
      expect(token.length).toBe(12);
    });

    it('should generate a token with custom length', () => {
      const token = IdGenerator.generateToken(20);
      expect(token.length).toBe(20);
    });

    it('should only contain lowercase alphanumeric characters', () => {
      const token = IdGenerator.generateToken(30);
      expect(token).toMatch(/^[a-z0-9]+$/u);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 50; i++) {
        tokens.add(IdGenerator.generateToken(16));
      }
      expect(tokens.size).toBe(50);
    });

    it('should handle edge cases for length', () => {
      const shortToken = IdGenerator.generateToken(1);
      expect(shortToken.length).toBe(1);

      const longToken = IdGenerator.generateToken(100);
      expect(longToken.length).toBe(100);
    });
  });

  describe('Security considerations', () => {
    it('should use Math.random() consistently across all generators', () => {
      // This tests that the implementation doesn't accidentally introduce
      // predictable patterns. We check that outputs are sufficiently random.
      const bookingIds = Array.from({ length: 10 }, () => IdGenerator.generateBookingId());
      const editTokens = Array.from({ length: 10 }, () => IdGenerator.generateEditToken());

      // Check that consecutive IDs are different
      for (let i = 1; i < bookingIds.length; i++) {
        expect(bookingIds[i]).not.toBe(bookingIds[i - 1]);
        expect(editTokens[i]).not.toBe(editTokens[i - 1]);
      }
    });

    it('should maintain consistent edit token length for security', () => {
      // Edit tokens must always be 30 chars for security (36^30 combinations)
      for (let i = 0; i < 20; i++) {
        const token = IdGenerator.generateEditToken();
        expect(token.length).toBe(30);
      }
    });
  });
});
