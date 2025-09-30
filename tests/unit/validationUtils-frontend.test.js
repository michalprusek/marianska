/**
 * Tests for js/shared/validationUtils.js frontend validation utilities
 */

describe('Frontend ValidationUtils', () => {
  let ValidationUtils;

  beforeAll(() => {
    // Load the validation utils file
    const fs = require('fs');
    const path = require('path');
    const utilsPath = path.join(__dirname, '../../js/shared/validationUtils.js');
    const utilsContent = fs.readFileSync(utilsPath, 'utf8');

    // Execute the file to get ValidationUtils
    // eslint-disable-next-line no-eval
    eval(utilsContent);

    // ValidationUtils should now be available
    ({ ValidationUtils } = global);
  });

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
      const invalidEmails = [
        'invalid',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        '',
      ];

      invalidEmails.forEach((email) => {
        expect(ValidationUtils.validateEmail(email)).toBe(false);
      });
    });
  });

  describe('Phone Validation', () => {
    it('should validate +420 format', () => {
      const validPhones = ['+420123456789', '+420987654321'];

      validPhones.forEach((phone) => {
        expect(ValidationUtils.validatePhone(phone)).toBe(true);
      });
    });

    it('should validate +421 format', () => {
      const validPhones = ['+421123456789', '+421987654321'];

      validPhones.forEach((phone) => {
        expect(ValidationUtils.validatePhone(phone)).toBe(true);
      });
    });

    it('should reject invalid phone formats', () => {
      const invalidPhones = [
        '+42012345678', // Too short
        '+4201234567890', // Too long
        '+420 123 456 789', // Spaces
        '123456789', // No country code
        '+422123456789', // Invalid country code
        '',
      ];

      invalidPhones.forEach((phone) => {
        expect(ValidationUtils.validatePhone(phone)).toBe(false);
      });
    });
  });

  describe('ZIP Code Validation', () => {
    it('should validate 5-digit ZIP codes', () => {
      const validZips = ['12345', '00000', '99999'];

      validZips.forEach((zip) => {
        expect(ValidationUtils.validateZip(zip)).toBe(true);
      });
    });

    it('should reject invalid ZIP codes', () => {
      const invalidZips = ['1234', '123456', 'abcde', '123 45', '', ' 12345'];

      invalidZips.forEach((zip) => {
        expect(ValidationUtils.validateZip(zip)).toBe(false);
      });
    });
  });

  describe('IČO Validation', () => {
    it('should validate 8-digit IČO', () => {
      const validIcos = ['12345678', '00000000', '99999999'];

      validIcos.forEach((ico) => {
        expect(ValidationUtils.validateIco(ico)).toBe(true);
      });
    });

    it('should accept empty IČO (optional)', () => {
      expect(ValidationUtils.validateIco('')).toBe(true);
    });

    it('should reject invalid IČO', () => {
      const invalidIcos = ['1234567', '123456789', 'abcdefgh', '123 456 78'];

      invalidIcos.forEach((ico) => {
        expect(ValidationUtils.validateIco(ico)).toBe(false);
      });
    });
  });

  describe('DIČ Validation', () => {
    it('should validate CZ format DIČ', () => {
      const validDics = ['CZ12345678', 'CZ00000000', 'CZ99999999'];

      validDics.forEach((dic) => {
        expect(ValidationUtils.validateDic(dic)).toBe(true);
      });
    });

    it('should accept empty DIČ (optional)', () => {
      expect(ValidationUtils.validateDic('')).toBe(true);
    });

    it('should reject invalid DIČ', () => {
      const invalidDics = ['12345678', 'CZ123456', 'CZ1234567890', 'SK12345678', 'CZ 12345678'];

      invalidDics.forEach((dic) => {
        expect(ValidationUtils.validateDic(dic)).toBe(false);
      });
    });
  });

  describe('Date Validation', () => {
    it('should validate YYYY-MM-DD format', () => {
      const validDates = ['2025-01-01', '2025-12-31', '2024-02-29']; // Leap year

      validDates.forEach((date) => {
        expect(ValidationUtils.validateDate(date)).toBe(true);
      });
    });

    it('should reject invalid dates', () => {
      const invalidDates = [
        '2025-13-01', // Invalid month
        '2025-01-32', // Invalid day
        '2023-02-29', // Not a leap year
        '01-01-2025', // Wrong format
        '2025/01/01', // Wrong separator
        '',
      ];

      invalidDates.forEach((date) => {
        expect(ValidationUtils.validateDate(date)).toBe(false);
      });
    });
  });

  describe('Date Range Validation', () => {
    it('should validate that end date is after start date', () => {
      expect(ValidationUtils.validateDateRange('2025-01-01', '2025-01-05')).toBe(true);
    });

    it('should reject end date before start date', () => {
      expect(ValidationUtils.validateDateRange('2025-01-05', '2025-01-01')).toBe(false);
    });

    it('should reject same start and end date', () => {
      expect(ValidationUtils.validateDateRange('2025-01-01', '2025-01-01')).toBe(false);
    });
  });

  describe('Guest Count Validation', () => {
    it('should validate positive guest counts', () => {
      expect(ValidationUtils.validateGuestCount(2, 1, 1)).toBe(true);
      expect(ValidationUtils.validateGuestCount(1, 0, 0)).toBe(true);
    });

    it('should reject zero adults', () => {
      expect(ValidationUtils.validateGuestCount(0, 1, 1)).toBe(false);
    });

    it('should reject negative counts', () => {
      expect(ValidationUtils.validateGuestCount(-1, 0, 0)).toBe(false);
      expect(ValidationUtils.validateGuestCount(1, -1, 0)).toBe(false);
      expect(ValidationUtils.validateGuestCount(1, 0, -1)).toBe(false);
    });
  });

  describe('Room Capacity Validation', () => {
    it('should validate within capacity', () => {
      // 2 adults + 1 child = 3 people, capacity 4
      expect(ValidationUtils.validateRoomCapacity(2, 1, 0, 4)).toBe(true);
    });

    it('should allow toddlers without counting toward capacity', () => {
      // 2 adults + 1 child + 2 toddlers = 3 people (toddlers not counted), capacity 4
      expect(ValidationUtils.validateRoomCapacity(2, 1, 2, 4)).toBe(true);
    });

    it('should reject exceeding capacity', () => {
      // 3 adults + 2 children = 5 people, capacity 4
      expect(ValidationUtils.validateRoomCapacity(3, 2, 0, 4)).toBe(false);
    });

    it('should reject exactly at capacity limit', () => {
      // 4 adults = 4 people, capacity 4 (needs at least 1 free space)
      expect(ValidationUtils.validateRoomCapacity(4, 0, 0, 4)).toBe(false);
    });
  });

  describe('Required Fields Validation', () => {
    it('should validate all required fields present', () => {
      const data = {
        name: 'Jan Novák',
        email: 'jan@example.com',
        phone: '+420123456789',
        address: 'Test 123',
        city: 'Praha',
        zip: '12345',
      };

      const required = ['name', 'email', 'phone', 'address', 'city', 'zip'];
      expect(ValidationUtils.validateRequiredFields(data, required)).toBe(true);
    });

    it('should detect missing field', () => {
      const data = {
        name: 'Jan Novák',
        email: 'jan@example.com',
        // phone missing
      };

      const required = ['name', 'email', 'phone'];
      expect(ValidationUtils.validateRequiredFields(data, required)).toBe(false);
    });

    it('should detect empty string as missing', () => {
      const data = {
        name: '',
        email: 'jan@example.com',
      };

      const required = ['name', 'email'];
      expect(ValidationUtils.validateRequiredFields(data, required)).toBe(false);
    });

    it('should detect whitespace-only as missing', () => {
      const data = {
        name: '   ',
        email: 'jan@example.com',
      };

      const required = ['name', 'email'];
      expect(ValidationUtils.validateRequiredFields(data, required)).toBe(false);
    });
  });

  describe('Christmas Code Validation', () => {
    it('should validate code in allowed list', () => {
      const allowedCodes = ['XMAS2024', 'VIP123', 'STAFF2024'];

      expect(ValidationUtils.validateChristmasCode('XMAS2024', allowedCodes)).toBe(true);
      expect(ValidationUtils.validateChristmasCode('VIP123', allowedCodes)).toBe(true);
    });

    it('should be case-sensitive', () => {
      const allowedCodes = ['XMAS2024'];

      expect(ValidationUtils.validateChristmasCode('xmas2024', allowedCodes)).toBe(false);
      expect(ValidationUtils.validateChristmasCode('Xmas2024', allowedCodes)).toBe(false);
    });

    it('should reject invalid codes', () => {
      const allowedCodes = ['XMAS2024'];

      expect(ValidationUtils.validateChristmasCode('INVALID', allowedCodes)).toBe(false);
      expect(ValidationUtils.validateChristmasCode('', allowedCodes)).toBe(false);
    });
  });

  describe('Past Date Detection', () => {
    it('should identify past dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const pastDate = yesterday.toISOString().split('T')[0];

      expect(ValidationUtils.isPastDate(pastDate)).toBe(true);
    });

    it('should not identify future dates as past', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDate = tomorrow.toISOString().split('T')[0];

      expect(ValidationUtils.isPastDate(futureDate)).toBe(false);
    });

    it('should not identify today as past', () => {
      const today = new Date().toISOString().split('T')[0];

      expect(ValidationUtils.isPastDate(today)).toBe(false);
    });
  });

  describe('Booking ID Validation', () => {
    it('should validate correct booking ID format', () => {
      const validIds = ['BKA1B2C3D4E5F6G7H', 'BK0000000000000', 'BKZZZZZZZZZZZZZ'];

      validIds.forEach((id) => {
        expect(ValidationUtils.validateBookingId(id)).toBe(true);
      });
    });

    it('should reject invalid booking ID formats', () => {
      const invalidIds = [
        'BK12345', // Too short
        'BK1234567890ABCDE', // Too long
        'BKabcdefghijklm', // Lowercase
        'AB1234567890ABC', // Wrong prefix
        '1234567890ABCDE', // No prefix
        '',
      ];

      invalidIds.forEach((id) => {
        expect(ValidationUtils.validateBookingId(id)).toBe(false);
      });
    });
  });

  describe('Edit Token Validation', () => {
    it('should validate 30-character tokens', () => {
      const validTokens = [
        'abc123def456ghi789jkl012mno345',
        '000000000000000000000000000000',
        'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
      ];

      validTokens.forEach((token) => {
        expect(ValidationUtils.validateEditToken(token)).toBe(true);
      });
    });

    it('should reject invalid token lengths', () => {
      const invalidTokens = [
        'abc123', // Too short
        'abc123def456ghi789jkl012mno345678', // Too long
        '', // Empty
      ];

      invalidTokens.forEach((token) => {
        expect(ValidationUtils.validateEditToken(token)).toBe(false);
      });
    });

    it('should accept tokens with numbers and letters', () => {
      const token = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5';
      expect(ValidationUtils.validateEditToken(token)).toBe(true);
    });
  });

  describe('Price Validation', () => {
    it('should validate positive prices', () => {
      expect(ValidationUtils.validatePrice(100)).toBe(true);
      expect(ValidationUtils.validatePrice(1500.5)).toBe(true);
    });

    it('should accept zero price', () => {
      expect(ValidationUtils.validatePrice(0)).toBe(true);
    });

    it('should reject negative prices', () => {
      expect(ValidationUtils.validatePrice(-100)).toBe(false);
    });

    it('should reject non-numeric prices', () => {
      expect(ValidationUtils.validatePrice('100')).toBe(false);
      expect(ValidationUtils.validatePrice(NaN)).toBe(false);
      expect(ValidationUtils.validatePrice(null)).toBe(false);
    });
  });

  describe('Error Message Generation', () => {
    it('should generate email error message', () => {
      const message = ValidationUtils.getErrorMessage('email');
      expect(message).toContain('email');
      expect(typeof message).toBe('string');
    });

    it('should generate phone error message', () => {
      const message = ValidationUtils.getErrorMessage('phone');
      expect(message).toContain('telefon');
      expect(typeof message).toBe('string');
    });

    it('should generate generic error for unknown field', () => {
      const message = ValidationUtils.getErrorMessage('unknown');
      expect(typeof message).toBe('string');
    });
  });
});
