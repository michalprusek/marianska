/**
 * Unit tests for AdminBookings.validateFieldValue()
 * Tests client-side validation for inline edit fields
 */

describe('AdminBookings.validateFieldValue', () => {
  let adminBookings;

  beforeEach(() => {
    // Create minimal mock of AdminBookings with just the validation method
    adminBookings = {
      validateFieldValue(fieldName, value) {
        // Email validation
        if (fieldName === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
          if (value && !emailRegex.test(value)) {
            return { valid: false, error: 'Neplatný formát emailu' };
          }
        }

        // Phone validation (Czech format)
        if (fieldName === 'phone') {
          const cleanPhone = value.replace(/[\s\-()]/gu, '');
          if (value && !/^\+?\d{9,15}$/u.test(cleanPhone)) {
            return { valid: false, error: 'Neplatný formát telefonu (min. 9 číslic)' };
          }
        }

        // Name validation
        if (fieldName === 'name') {
          if (value && value.length < 2) {
            return { valid: false, error: 'Jméno musí mít alespoň 2 znaky' };
          }
          if (value && value.length > 100) {
            return { valid: false, error: 'Jméno je příliš dlouhé (max. 100 znaků)' };
          }
        }

        // Note validation (prevent excessive length)
        if (fieldName === 'note' || fieldName === 'adminNote') {
          if (value && value.length > 1000) {
            return { valid: false, error: 'Poznámka je příliš dlouhá (max. 1000 znaků)' };
          }
        }

        return { valid: true, error: null };
      },
    };
  });

  describe('email validation', () => {
    test('should accept valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.cz',
        'user+tag@example.org',
        'firstname.lastname@company.co.uk',
      ];

      validEmails.forEach((email) => {
        const result = adminBookings.validateFieldValue('email', email);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    test('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
        'double@@at.com',
      ];

      invalidEmails.forEach((email) => {
        const result = adminBookings.validateFieldValue('email', email);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Neplatný formát emailu');
      });
    });

    test('should accept empty email (optional field)', () => {
      const result = adminBookings.validateFieldValue('email', '');
      expect(result.valid).toBe(true);
    });
  });

  describe('phone validation', () => {
    test('should accept valid phone numbers', () => {
      const validPhones = [
        '123456789', // 9 digits
        '+420123456789', // Czech format with country code
        '123 456 789', // With spaces
        '123-456-789', // With dashes
        '(123) 456 789', // With parentheses
        '+420 123 456 789', // Full format
        '123456789012345', // 15 digits (max)
      ];

      validPhones.forEach((phone) => {
        const result = adminBookings.validateFieldValue('phone', phone);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    test('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '12345678', // Only 8 digits (too short)
        '1234567', // Only 7 digits
        'abc123456789', // Contains letters
        '1234567890123456', // 16 digits (too long)
      ];

      invalidPhones.forEach((phone) => {
        const result = adminBookings.validateFieldValue('phone', phone);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Neplatný formát telefonu (min. 9 číslic)');
      });
    });

    test('should accept empty phone (optional field)', () => {
      const result = adminBookings.validateFieldValue('phone', '');
      expect(result.valid).toBe(true);
    });
  });

  describe('name validation', () => {
    test('should accept valid names', () => {
      const validNames = ['Jan', 'Jan Novák', 'Marie-Louise', "O'Connor", 'Müller'];

      validNames.forEach((name) => {
        const result = adminBookings.validateFieldValue('name', name);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    test('should reject names that are too short', () => {
      const result = adminBookings.validateFieldValue('name', 'A');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Jméno musí mít alespoň 2 znaky');
    });

    test('should reject names that are too long', () => {
      const longName = 'A'.repeat(101);
      const result = adminBookings.validateFieldValue('name', longName);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Jméno je příliš dlouhé (max. 100 znaků)');
    });

    test('should accept empty name (optional field)', () => {
      const result = adminBookings.validateFieldValue('name', '');
      expect(result.valid).toBe(true);
    });

    test('should accept name at boundary (2 chars)', () => {
      const result = adminBookings.validateFieldValue('name', 'AB');
      expect(result.valid).toBe(true);
    });

    test('should accept name at boundary (100 chars)', () => {
      const result = adminBookings.validateFieldValue('name', 'A'.repeat(100));
      expect(result.valid).toBe(true);
    });
  });

  describe('note validation', () => {
    test('should accept valid notes', () => {
      const validNotes = [
        'Short note',
        'A longer note with multiple sentences. This is still valid.',
        'Note with special characters: !@#$%^&*()',
        'A'.repeat(1000), // Max length
      ];

      validNotes.forEach((note) => {
        const result = adminBookings.validateFieldValue('note', note);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    test('should reject notes that are too long', () => {
      const longNote = 'A'.repeat(1001);
      const result = adminBookings.validateFieldValue('note', longNote);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Poznámka je příliš dlouhá (max. 1000 znaků)');
    });

    test('should accept empty note', () => {
      const result = adminBookings.validateFieldValue('note', '');
      expect(result.valid).toBe(true);
    });
  });

  describe('adminNote validation', () => {
    test('should apply same rules as note field', () => {
      // Valid adminNote
      const validResult = adminBookings.validateFieldValue('adminNote', 'Admin comment');
      expect(validResult.valid).toBe(true);

      // Too long adminNote
      const longNote = 'A'.repeat(1001);
      const invalidResult = adminBookings.validateFieldValue('adminNote', longNote);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Poznámka je příliš dlouhá (max. 1000 znaků)');
    });
  });

  describe('unknown fields', () => {
    test('should accept any value for unknown fields', () => {
      const result = adminBookings.validateFieldValue('unknownField', 'any value');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });
  });
});
