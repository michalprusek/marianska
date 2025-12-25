/**
 * Tests for js/shared/validationUtils.js frontend validation utilities
 *
 * FIX 2025-12-23: Updated to match actual ValidationUtils API
 * Only tests methods that actually exist in the class
 */

describe('Frontend ValidationUtils', () => {
  const ValidationUtils = require('../../js/shared/validationUtils.js');

  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'test_123@test-domain.com',
      ];

      validEmails.forEach((email) => {
        expect(ValidationUtils.validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = ['invalid', '@example.com', 'user@', 'user @example.com', ''];

      invalidEmails.forEach((email) => {
        expect(ValidationUtils.validateEmail(email)).toBe(false);
      });
    });

    it('should reject emails exceeding 254 characters (RFC 5321)', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(ValidationUtils.validateEmail(longEmail)).toBe(false);
    });
  });

  describe('Phone Validation', () => {
    it('should validate +420 format (9 digits after country code)', () => {
      expect(ValidationUtils.validatePhone('+420123456789')).toBe(true);
      expect(ValidationUtils.validatePhone('+420987654321')).toBe(true);
    });

    it('should validate +421 format', () => {
      expect(ValidationUtils.validatePhone('+421123456789')).toBe(true);
    });

    it('should reject invalid phone formats', () => {
      expect(ValidationUtils.validatePhone('+42012345678')).toBe(false); // Too short (8 digits)
      expect(ValidationUtils.validatePhone('+4201234567890')).toBe(false); // Too long (10 digits)
      expect(ValidationUtils.validatePhone('123456789')).toBe(false); // No country code
      expect(ValidationUtils.validatePhone('')).toBe(false);
      expect(ValidationUtils.validatePhone(null)).toBe(false);
    });

    it('should validate other international formats (7-15 digits)', () => {
      expect(ValidationUtils.validatePhone('+11234567890')).toBe(true); // US
      expect(ValidationUtils.validatePhone('+4412345678901')).toBe(true); // UK
    });
  });

  describe('Phone Number Validation (without country code)', () => {
    it('should validate 9-digit numbers for Czech/Slovak', () => {
      expect(ValidationUtils.validatePhoneNumber('123456789', '+420')).toBe(true);
      expect(ValidationUtils.validatePhoneNumber('987654321', '+421')).toBe(true);
    });

    it('should reject invalid lengths for Czech/Slovak', () => {
      expect(ValidationUtils.validatePhoneNumber('12345678', '+420')).toBe(false); // 8 digits
      expect(ValidationUtils.validatePhoneNumber('1234567890', '+420')).toBe(false); // 10 digits
    });

    it('should allow 7-13 digits for other countries', () => {
      expect(ValidationUtils.validatePhoneNumber('1234567', '+1')).toBe(true);
      expect(ValidationUtils.validatePhoneNumber('1234567890123', '+44')).toBe(true);
    });
  });

  describe('ZIP Code Validation', () => {
    it('should validate 5-digit ZIP codes', () => {
      // FIX: Method is validateZIP (uppercase)
      expect(ValidationUtils.validateZIP('12345')).toBe(true);
      expect(ValidationUtils.validateZIP('00000')).toBe(true);
      expect(ValidationUtils.validateZIP('99999')).toBe(true);
    });

    it('should validate ZIP with space (will be cleaned)', () => {
      expect(ValidationUtils.validateZIP('123 45')).toBe(true);
    });

    it('should reject invalid ZIP codes', () => {
      expect(ValidationUtils.validateZIP('1234')).toBe(false); // Too short
      expect(ValidationUtils.validateZIP('123456')).toBe(false); // Too long
      expect(ValidationUtils.validateZIP('abcde')).toBe(false); // Letters
      expect(ValidationUtils.validateZIP('')).toBe(false);
      expect(ValidationUtils.validateZIP(null)).toBe(false);
    });
  });

  describe('IČO Validation', () => {
    it('should validate 8-digit IČO', () => {
      // FIX: Method is validateICO (uppercase)
      expect(ValidationUtils.validateICO('12345678')).toBe(true);
      expect(ValidationUtils.validateICO('00000000')).toBe(true);
    });

    it('should accept empty IČO (optional field)', () => {
      expect(ValidationUtils.validateICO('')).toBe(true);
      expect(ValidationUtils.validateICO(null)).toBe(true);
      expect(ValidationUtils.validateICO(undefined)).toBe(true);
    });

    it('should reject invalid IČO', () => {
      expect(ValidationUtils.validateICO('1234567')).toBe(false); // 7 digits
      expect(ValidationUtils.validateICO('123456789')).toBe(false); // 9 digits
      expect(ValidationUtils.validateICO('abcdefgh')).toBe(false); // Letters
    });
  });

  describe('DIČ Validation', () => {
    it('should validate CZ format DIČ (8-10 digits)', () => {
      // FIX: Method is validateDIC (uppercase)
      expect(ValidationUtils.validateDIC('CZ12345678')).toBe(true);
      expect(ValidationUtils.validateDIC('CZ1234567890')).toBe(true);
    });

    it('should accept empty DIČ (optional field)', () => {
      expect(ValidationUtils.validateDIC('')).toBe(true);
      expect(ValidationUtils.validateDIC(null)).toBe(true);
    });

    it('should reject invalid DIČ', () => {
      expect(ValidationUtils.validateDIC('12345678')).toBe(false); // No CZ prefix
      expect(ValidationUtils.validateDIC('CZ1234567')).toBe(false); // Too few digits
      expect(ValidationUtils.validateDIC('SK12345678')).toBe(false); // Wrong country
    });
  });

  describe('Format Phone', () => {
    it('should format Czech phone numbers', () => {
      expect(ValidationUtils.formatPhone('+420123456789')).toBe('+420 123 456 789');
    });

    it('should format Slovak phone numbers', () => {
      expect(ValidationUtils.formatPhone('+421123456789')).toBe('+421 123 456 789');
    });

    it('should handle already formatted numbers', () => {
      expect(ValidationUtils.formatPhone('+420 123 456 789')).toBe('+420 123 456 789');
    });
  });

  describe('Format ZIP', () => {
    it('should format 5-digit ZIP as XXX XX', () => {
      expect(ValidationUtils.formatZIP('12345')).toBe('123 45');
    });

    it('should handle already formatted ZIP', () => {
      expect(ValidationUtils.formatZIP('123 45')).toBe('123 45');
    });
  });

  describe('getValidationError', () => {
    it('should return error message for invalid email', () => {
      const error = ValidationUtils.getValidationError('email', 'invalid', 'cs');
      expect(error).toBeTruthy();
      expect(typeof error).toBe('string');
    });

    it('should return null for valid email', () => {
      const error = ValidationUtils.getValidationError('email', 'test@example.com', 'cs');
      expect(error).toBeNull();
    });

    it('should return error for invalid phone', () => {
      const error = ValidationUtils.getValidationError('phone', '123', 'cs');
      expect(error).toBeTruthy();
    });

    it('should return null for valid phone', () => {
      const error = ValidationUtils.getValidationError('phone', '+420123456789', 'cs');
      expect(error).toBeNull();
    });

    it('should return error for invalid ZIP', () => {
      const error = ValidationUtils.getValidationError('zip', '123', 'cs');
      expect(error).toBeTruthy();
    });

    it('should return null for valid ZIP', () => {
      const error = ValidationUtils.getValidationError('zip', '12345', 'cs');
      expect(error).toBeNull();
    });

    it('should support English error messages', () => {
      const errorCs = ValidationUtils.getValidationError('email', 'invalid', 'cs');
      const errorEn = ValidationUtils.getValidationError('email', 'invalid', 'en');
      expect(errorCs).not.toBe(errorEn);
    });
  });
});
