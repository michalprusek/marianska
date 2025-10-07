/**
 * Common test fixtures and helpers for booking system tests
 */

class TestFixtures {
  /**
   * Get mock settings object with default configuration
   * @returns {Object} Mock settings
   */
  static getMockSettings() {
    return {
      adminPassword: 'testPassword123',
      christmasPeriod: {
        start: '2025-12-23',
        end: '2026-01-02',
      },
      christmasPeriods: [
        { start: '2025-12-23', end: '2026-01-02' },
        { start: '2026-12-24', end: '2027-01-03' },
      ],
      christmasAccessCodes: ['XMAS2025', 'VIP123', 'SPECIAL2025'],
      rooms: [
        { id: '12', name: 'Pokoj 12', type: 'small', beds: 2, floor: 1 },
        { id: '13', name: 'Pokoj 13', type: 'medium', beds: 3, floor: 1 },
        { id: '14', name: 'Pokoj 14', type: 'large', beds: 4, floor: 1 },
        { id: '22', name: 'Pokoj 22', type: 'small', beds: 2, floor: 2 },
        { id: '23', name: 'Pokoj 23', type: 'medium', beds: 3, floor: 2 },
        { id: '24', name: 'Pokoj 24', type: 'large', beds: 4, floor: 2 },
        { id: '42', name: 'Pokoj 42', type: 'small', beds: 2, floor: 3 },
        { id: '43', name: 'Pokoj 43', type: 'small', beds: 2, floor: 3 },
        { id: '44', name: 'Pokoj 44', type: 'large', beds: 4, floor: 3 },
      ],
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
  }

  /**
   * Get mock booking data
   * @param {Object} overrides - Override specific fields
   * @returns {Object} Mock booking
   */
  static getMockBooking(overrides = {}) {
    return {
      id: 'BK1234567890ABC',
      name: 'Jan Novák',
      email: 'jan.novak@example.com',
      phone: '+420123456789',
      company: 'Test Company s.r.o.',
      address: 'Hlavní 123',
      city: 'Praha',
      zip: '12345',
      ico: '12345678',
      dic: 'CZ12345678',
      startDate: '2025-03-15',
      endDate: '2025-03-17',
      rooms: ['12'],
      guestType: 'utia',
      adults: 2,
      children: 0,
      toddlers: 0,
      totalPrice: 644,
      notes: 'Test booking',
      editToken: 'abc123def456ghi789jkl012mno345',
      createdAt: '2025-03-01T10:00:00.000Z',
      updatedAt: '2025-03-01T10:00:00.000Z',
      ...overrides,
    };
  }

  /**
   * Get multiple mock bookings with different dates
   * @returns {Array<Object>} Array of mock bookings
   */
  static getMockBookings() {
    return [
      this.getMockBooking({
        id: 'BK1111111111AAA',
        startDate: '2025-03-10',
        endDate: '2025-03-12',
        rooms: ['12'],
      }),
      this.getMockBooking({
        id: 'BK2222222222BBB',
        startDate: '2025-03-15',
        endDate: '2025-03-18',
        rooms: ['13', '14'],
        adults: 5,
        children: 2,
      }),
      this.getMockBooking({
        id: 'BK3333333333CCC',
        startDate: '2025-03-20',
        endDate: '2025-03-22',
        rooms: ['22'],
        guestType: 'external',
      }),
    ];
  }

  /**
   * Get mock blocked dates
   * @returns {Array<Object>} Array of blocked dates
   */
  static getMockBlockedDates() {
    return [
      {
        date: '2025-04-01',
        roomId: '12',
        reason: 'Maintenance',
        blockageId: 'BLK123456789',
        blockedAt: '2025-03-15T10:00:00.000Z',
      },
      {
        date: '2025-04-02',
        roomId: '12',
        reason: 'Maintenance',
        blockageId: 'BLK123456789',
        blockedAt: '2025-03-15T10:00:00.000Z',
      },
    ];
  }

  /**
   * Get mock proposed booking
   * @returns {Object} Mock proposed booking
   */
  static getMockProposedBooking() {
    return {
      id: 'PROP123456789',
      sessionId: 'SESS123456789ABC',
      startDate: '2025-05-01',
      endDate: '2025-05-03',
      rooms: ['14'],
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
    };
  }

  /**
   * Generate date range array
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {number} days - Number of days
   * @returns {Array<string>} Array of date strings
   */
  static generateDateRange(startDate, days) {
    const dates = [];
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }

    return dates;
  }

  /**
   * Get validation test cases for email
   * @returns {Object} Valid and invalid emails
   */
  static getEmailTestCases() {
    return {
      valid: [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'test_123@test-domain.com',
        'admin@utia.cas.cz',
      ],
      invalid: [
        'invalid.email',
        '@example.com',
        'test@',
        'test @example.com',
        'test@example',
        '',
        null,
        undefined,
      ],
    };
  }

  /**
   * Get validation test cases for phone numbers
   * @returns {Object} Valid and invalid phone numbers
   */
  static getPhoneTestCases() {
    return {
      valid: ['+420123456789', '+421987654321', '+420 123 456 789', '123456789'],
      invalid: [
        '12345678', // Too short
        '1234567890', // Too long
        '+420 12345678', // Too short for +420
        'abcdefghi',
        '',
        null,
      ],
    };
  }

  /**
   * Get validation test cases for ZIP codes
   * @returns {Object} Valid and invalid ZIP codes
   */
  static getZipTestCases() {
    return {
      valid: ['12345', '10000', '99999'],
      invalid: ['1234', '123456', 'abcde', '123 45', '', null],
    };
  }

  /**
   * Get validation test cases for IČO (Czech business ID)
   * @returns {Object} Valid and invalid IČO
   */
  static getIcoTestCases() {
    return {
      valid: ['12345678', '00000000', '99999999'],
      invalid: ['1234567', '123456789', 'abcdefgh', '', null],
    };
  }

  /**
   * Get validation test cases for DIČ (Czech VAT ID)
   * @returns {Object} Valid and invalid DIČ
   */
  static getDicTestCases() {
    return {
      valid: ['CZ12345678', 'CZ00000000', 'CZ99999999'],
      invalid: [
        'CZ1234567', // Too short
        'CZ123456789', // Too long
        '12345678', // Missing CZ prefix
        'SK12345678', // Wrong country code
        '',
        null,
      ],
    };
  }

  /**
   * Get Christmas period test scenarios
   * @returns {Array<Object>} Test scenarios
   */
  static getChristmasTestScenarios() {
    return [
      {
        description: 'Before Oct 1 - single booking',
        currentDate: new Date('2025-09-15'),
        christmasStart: '2025-12-23',
        isBulk: false,
        expected: { codeRequired: true, bulkBlocked: false },
      },
      {
        description: 'Before Oct 1 - bulk booking',
        currentDate: new Date('2025-09-15'),
        christmasStart: '2025-12-23',
        isBulk: true,
        expected: { codeRequired: true, bulkBlocked: false },
      },
      {
        description: 'After Oct 1 - single booking',
        currentDate: new Date('2025-10-15'),
        christmasStart: '2025-12-23',
        isBulk: false,
        expected: { codeRequired: false, bulkBlocked: false },
      },
      {
        description: 'After Oct 1 - bulk booking',
        currentDate: new Date('2025-10-15'),
        christmasStart: '2025-12-23',
        isBulk: true,
        expected: { codeRequired: false, bulkBlocked: true },
      },
    ];
  }

  /**
   * Get price calculation test scenarios
   * @returns {Array<Object>} Test scenarios
   */
  static getPriceTestScenarios() {
    const settings = this.getMockSettings();

    return [
      {
        description: 'UTIA - 1 room, 1 adult, 1 night',
        input: {
          guestType: 'utia',
          adults: 1,
          children: 0,
          toddlers: 0,
          nights: 1,
          roomsCount: 1,
          settings,
        },
        expected: 298,
      },
      {
        description: 'UTIA - 1 room, 2 adults, 1 child, 3 nights',
        input: {
          guestType: 'utia',
          adults: 2,
          children: 1,
          toddlers: 0,
          nights: 3,
          roomsCount: 1,
          settings,
        },
        expected: 1113, // (298 + 49 + 24) * 3 = 1113
      },
      {
        description: 'External - 1 room, 2 adults, 1 child, 2 nights',
        input: {
          guestType: 'external',
          adults: 2,
          children: 1,
          toddlers: 0,
          nights: 2,
          roomsCount: 1,
          settings,
        },
        expected: 1294, // (499 + 99 + 49) * 2 = 1294
      },
      {
        description: 'UTIA bulk - 5 adults, 3 children, 2 nights',
        input: {
          guestType: 'utia',
          adults: 5,
          children: 3,
          toddlers: 1,
          nights: 2,
          settings,
        },
        expectedBulk: 5000, // (2000 + 5*100 + 3*0) * 2 = 5000
      },
    ];
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TestFixtures;
}

// Also expose globally for browser usage
if (typeof window !== 'undefined') {
  window.TestFixtures = TestFixtures;
}
