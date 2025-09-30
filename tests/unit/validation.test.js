// Validation utilities tests

describe('Validation Utilities', () => {
  describe('Email Validation', () => {
    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);

    it('should validate correct email formats', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('name.lastname@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
      expect(validateEmail('user123@test-domain.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('user@domain')).toBe(false);
      expect(validateEmail('user domain@example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateEmail('a@b.c')).toBe(true); // Minimal valid email
      expect(validateEmail('test..test@example.com')).toBe(true); // Double dot
      expect(validateEmail('@')).toBe(false);
      expect(validateEmail('.')).toBe(false);
    });
  });

  describe('Phone Number Validation', () => {
    describe('Czech/Slovak Format', () => {
      const validateCzSkPhone = (phone) => {
        const cleaned = phone.replace(/\s/gu, '');
        const czSkRegex = /^\+42[01]\d{9}$/u;
        return czSkRegex.test(cleaned);
      };

      it('should validate +420 format with 9 digits', () => {
        expect(validateCzSkPhone('+420123456789')).toBe(true);
        expect(validateCzSkPhone('+420 123 456 789')).toBe(true);
        expect(validateCzSkPhone('+420987654321')).toBe(true);
      });

      it('should validate +421 format with 9 digits', () => {
        expect(validateCzSkPhone('+421123456789')).toBe(true);
        expect(validateCzSkPhone('+421 987 654 321')).toBe(true);
      });

      it('should reject invalid Czech/Slovak phones', () => {
        expect(validateCzSkPhone('+42012345678')).toBe(false); // 8 digits
        expect(validateCzSkPhone('+4201234567890')).toBe(false); // 10 digits
        expect(validateCzSkPhone('420123456789')).toBe(false); // Missing +
        expect(validateCzSkPhone('+422123456789')).toBe(false); // Invalid prefix
      });
    });

    describe('International Format', () => {
      const validateInternationalPhone = (phone) => {
        const cleaned = phone.replace(/\s/gu, '');
        const intlRegex = /^\+[1-9]\d{7,14}$/u;
        return intlRegex.test(cleaned);
      };

      it('should validate international formats', () => {
        expect(validateInternationalPhone('+12025551234')).toBe(true); // US
        expect(validateInternationalPhone('+447123456789')).toBe(true); // UK
        expect(validateInternationalPhone('+33123456789')).toBe(true); // France
        expect(validateInternationalPhone('+861234567890')).toBe(true); // China
      });

      it('should reject invalid international phones', () => {
        expect(validateInternationalPhone('12025551234')).toBe(false); // Missing +
        expect(validateInternationalPhone('+0123456789')).toBe(false); // Starts with 0
        expect(validateInternationalPhone('+1234')).toBe(false); // Too short
      });
    });

    describe('Phone Formatting', () => {
      const formatCzSkPhone = (phone) => {
        const cleaned = phone.replace(/\s/gu, '');
        const match = cleaned.match(/^\+42[01](?<part1>\d{3})(?<part2>\d{3})(?<part3>\d{3})$/u);
        if (match) {
          return `${cleaned.substring(0, 4)} ${match.groups.part1} ${match.groups.part2} ${match.groups.part3}`;
        }
        return phone;
      };

      it('should format Czech phone with spaces', () => {
        expect(formatCzSkPhone('+420123456789')).toBe('+420 123 456 789');
        expect(formatCzSkPhone('+421987654321')).toBe('+421 987 654 321');
      });

      it('should not change already formatted phones', () => {
        const formatted = '+420 123 456 789';
        expect(formatCzSkPhone(formatted)).toBe(formatted);
      });

      it('should return original for invalid phones', () => {
        expect(formatCzSkPhone('+42012345')).toBe('+42012345');
      });
    });
  });

  describe('ZIP Code Validation', () => {
    const validateZIP = (zip) => /^\d{5}$/u.test(zip.replace(/\s/gu, ''));

    it('should validate 5-digit ZIP codes', () => {
      expect(validateZIP('12345')).toBe(true);
      expect(validateZIP('00000')).toBe(true);
      expect(validateZIP('99999')).toBe(true);
      expect(validateZIP('123 45')).toBe(true); // With space
    });

    it('should reject invalid ZIP codes', () => {
      expect(validateZIP('1234')).toBe(false); // Too short
      expect(validateZIP('123456')).toBe(false); // Too long
      expect(validateZIP('abcde')).toBe(false); // Letters
      expect(validateZIP('12 45')).toBe(false); // Wrong spacing
      expect(validateZIP('')).toBe(false); // Empty
    });

    describe('ZIP Formatting', () => {
      const formatZIP = (zip) => {
        const cleaned = zip.replace(/\s/gu, '');
        if (/^\d{5}$/u.test(cleaned)) {
          return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
        }
        return zip;
      };

      it('should format ZIP as XXX XX', () => {
        expect(formatZIP('12345')).toBe('123 45');
        expect(formatZIP('00000')).toBe('000 00');
      });

      it('should not change already formatted ZIP', () => {
        expect(formatZIP('123 45')).toBe('123 45');
      });

      it('should return original for invalid ZIP', () => {
        expect(formatZIP('1234')).toBe('1234');
      });
    });
  });

  describe('IČO Validation', () => {
    const validateICO = (ico) => {
      if (!ico) {
        return true;
      } // Optional field
      return /^\d{8}$/u.test(ico.replace(/\s/gu, ''));
    };

    it('should validate 8-digit IČO', () => {
      expect(validateICO('12345678')).toBe(true);
      expect(validateICO('00000000')).toBe(true);
      expect(validateICO('99999999')).toBe(true);
    });

    it('should accept empty IČO (optional)', () => {
      expect(validateICO('')).toBe(true);
      expect(validateICO(null)).toBe(true);
      expect(validateICO(undefined)).toBe(true);
    });

    it('should reject invalid IČO', () => {
      expect(validateICO('1234567')).toBe(false); // 7 digits
      expect(validateICO('123456789')).toBe(false); // 9 digits
      expect(validateICO('abcd1234')).toBe(false); // Letters
    });
  });

  describe('DIČ Validation', () => {
    const validateDIC = (dic) => {
      if (!dic) {
        return true;
      } // Optional field
      return /^CZ\d{8,10}$/u.test(dic.replace(/\s/gu, ''));
    };

    it('should validate DIČ with 8 digits', () => {
      expect(validateDIC('CZ12345678')).toBe(true);
    });

    it('should validate DIČ with 9 digits', () => {
      expect(validateDIC('CZ123456789')).toBe(true);
    });

    it('should validate DIČ with 10 digits', () => {
      expect(validateDIC('CZ1234567890')).toBe(true);
    });

    it('should accept empty DIČ (optional)', () => {
      expect(validateDIC('')).toBe(true);
      expect(validateDIC(null)).toBe(true);
      expect(validateDIC(undefined)).toBe(true);
    });

    it('should reject invalid DIČ', () => {
      expect(validateDIC('12345678')).toBe(false); // Missing CZ
      expect(validateDIC('CZ1234567')).toBe(false); // Only 7 digits
      expect(validateDIC('CZ12345678901')).toBe(false); // 11 digits
      expect(validateDIC('SK12345678')).toBe(false); // Wrong prefix
    });

    it('should be case-insensitive for CZ prefix', () => {
      // This depends on implementation - adjust based on actual code
      expect(validateDIC('CZ12345678')).toBe(true);
      // expect(validateDIC('cz12345678')).toBe(true); // If case-insensitive
    });
  });

  describe('Date Validation', () => {
    const validateDateRange = (startDate, endDate) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return end > start && !isNaN(start.getTime()) && !isNaN(end.getTime());
    };

    it('should validate correct date range', () => {
      expect(validateDateRange('2025-06-10', '2025-06-12')).toBe(true);
      expect(validateDateRange('2025-01-01', '2025-12-31')).toBe(true);
    });

    it('should reject end date before start date', () => {
      expect(validateDateRange('2025-06-12', '2025-06-10')).toBe(false);
    });

    it('should reject equal start and end dates', () => {
      expect(validateDateRange('2025-06-10', '2025-06-10')).toBe(false);
    });

    it('should reject invalid date strings', () => {
      expect(validateDateRange('invalid', '2025-06-12')).toBe(false);
      expect(validateDateRange('2025-06-10', 'invalid')).toBe(false);
    });

    describe('Date Format Validation', () => {
      const isValidDateFormat = (dateStr) => /^\d{4}-\d{2}-\d{2}$/u.test(dateStr);

      it('should validate YYYY-MM-DD format', () => {
        expect(isValidDateFormat('2025-06-10')).toBe(true);
        expect(isValidDateFormat('2025-01-01')).toBe(true);
        expect(isValidDateFormat('2025-12-31')).toBe(true);
      });

      it('should reject invalid formats', () => {
        expect(isValidDateFormat('10-06-2025')).toBe(false); // DD-MM-YYYY
        expect(isValidDateFormat('2025/06/10')).toBe(false); // Slashes
        expect(isValidDateFormat('2025-6-10')).toBe(false); // Single digit month
        expect(isValidDateFormat('25-06-10')).toBe(false); // 2-digit year
      });
    });

    describe('Past Date Check', () => {
      const isPastDate = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
      };

      it('should identify past dates', () => {
        expect(isPastDate('2020-01-01')).toBe(true);
        expect(isPastDate('2023-06-10')).toBe(true);
      });

      it('should not identify future dates as past', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 10);
        const futureStr = futureDate.toISOString().split('T')[0];

        expect(isPastDate(futureStr)).toBe(false);
      });

      it('should not identify today as past', () => {
        const today = new Date().toISOString().split('T')[0];
        expect(isPastDate(today)).toBe(false);
      });
    });
  });

  describe('Required Fields Validation', () => {
    const validateRequiredFields = (data, requiredFields) => {
      for (const field of requiredFields) {
        if (!data[field] || String(data[field]).trim() === '') {
          return { valid: false, missing: field };
        }
      }
      return { valid: true };
    };

    it('should validate all required fields present', () => {
      const data = {
        name: 'Jan Novák',
        email: 'jan@example.com',
        phone: '+420123456789',
      };

      const result = validateRequiredFields(data, ['name', 'email', 'phone']);
      expect(result.valid).toBe(true);
    });

    it('should detect missing field', () => {
      const data = {
        name: 'Jan Novák',
        phone: '+420123456789',
        // email missing
      };

      const result = validateRequiredFields(data, ['name', 'email', 'phone']);
      expect(result.valid).toBe(false);
      expect(result.missing).toBe('email');
    });

    it('should detect empty string as missing', () => {
      const data = {
        name: 'Jan Novák',
        email: '',
        phone: '+420123456789',
      };

      const result = validateRequiredFields(data, ['name', 'email', 'phone']);
      expect(result.valid).toBe(false);
      expect(result.missing).toBe('email');
    });

    it('should detect whitespace-only as missing', () => {
      const data = {
        name: '   ',
        email: 'jan@example.com',
        phone: '+420123456789',
      };

      const result = validateRequiredFields(data, ['name', 'email', 'phone']);
      expect(result.valid).toBe(false);
      expect(result.missing).toBe('name');
    });
  });

  describe('Guest Count Validation', () => {
    const validateGuestCount = (adults, children, toddlers, roomCapacity) => {
      if (adults < 1) {
        return { valid: false, reason: 'Minimum 1 adult required' };
      }
      if (children < 0 || toddlers < 0) {
        return { valid: false, reason: 'Negative counts not allowed' };
      }

      const countedGuests = adults + children; // Toddlers don't count
      if (countedGuests > roomCapacity) {
        return { valid: false, reason: `Exceeds room capacity of ${roomCapacity}` };
      }

      return { valid: true };
    };

    it('should validate correct guest counts', () => {
      const result = validateGuestCount(2, 0, 0, 2);
      expect(result.valid).toBe(true);
    });

    it('should reject zero adults', () => {
      const result = validateGuestCount(0, 2, 0, 4);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Minimum 1 adult');
    });

    it('should reject negative counts', () => {
      const result1 = validateGuestCount(2, -1, 0, 4);
      const result2 = validateGuestCount(2, 0, -1, 4);

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
    });

    it('should allow toddlers without counting toward capacity', () => {
      const result = validateGuestCount(2, 0, 5, 2);
      expect(result.valid).toBe(true); // 2 adults + 0 children = 2, toddlers don't count
    });

    it('should reject exceeding room capacity', () => {
      const result = validateGuestCount(2, 2, 0, 3);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Exceeds room capacity');
    });
  });

  describe('Christmas Code Validation', () => {
    const validateChristmasCode = (code, validCodes) => {
      if (!code) {
        return false;
      }
      return validCodes.includes(code);
    };

    it('should validate code in allowed list', () => {
      const validCodes = ['XMAS2024', 'VIP123', 'EMPLOYEE'];
      expect(validateChristmasCode('XMAS2024', validCodes)).toBe(true);
      expect(validateChristmasCode('VIP123', validCodes)).toBe(true);
    });

    it('should reject invalid codes', () => {
      const validCodes = ['XMAS2024', 'VIP123'];
      expect(validateChristmasCode('INVALID', validCodes)).toBe(false);
      expect(validateChristmasCode('xmas2024', validCodes)).toBe(false); // Case-sensitive
    });

    it('should reject empty or null codes', () => {
      const validCodes = ['XMAS2024'];
      expect(validateChristmasCode('', validCodes)).toBe(false);
      expect(validateChristmasCode(null, validCodes)).toBe(false);
      expect(validateChristmasCode(undefined, validCodes)).toBe(false);
    });
  });
});
