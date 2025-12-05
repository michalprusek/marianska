/**
 * Comprehensive tests for data.js DataManager (browser-side)
 * Testing the actual implementation, not mocks
 */

// Mock localStorage for browser environment
const localStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  },
};

global.localStorage = localStorageMock;

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock alert
global.alert = jest.fn();

describe('DataManager Browser Implementation', () => {
  let DataManager;
  let dataManager;

  beforeAll(() => {
    // Load the actual data.js file
    const fs = require('fs');
    const path = require('path');
    const dataJsPath = path.join(__dirname, '../../data.js');
    const dataJsContent = fs.readFileSync(dataJsPath, 'utf8');

    // Execute the data.js file in a simulated browser environment
    // eslint-disable-next-line no-eval
    eval(dataJsContent);

    // DataManager should now be available
    ({ DataManager } = global);
  });

  beforeEach(() => {
    localStorage.clear();
    fetch.mockClear();
    alert.mockClear();

    // Create fresh instance
    dataManager = new DataManager();
  });

  describe('Initialization', () => {
    it('should create DataManager instance', () => {
      expect(dataManager).toBeDefined();
      expect(dataManager).toBeInstanceOf(DataManager);
    });

    it('should initialize storage with default structure', async () => {
      await dataManager.initStorage();

      const data = JSON.parse(localStorage.getItem('chataMarianska'));
      expect(data).toHaveProperty('bookings');
      expect(data).toHaveProperty('blockedDates');
      expect(data).toHaveProperty('settings');
      expect(Array.isArray(data.bookings)).toBe(true);
      expect(Array.isArray(data.blockedDates)).toBe(true);
    });

    it('should not overwrite existing data', async () => {
      const existingData = {
        bookings: [{ id: 'TEST1' }],
        blockedDates: [],
        settings: {},
      };
      localStorage.setItem('chataMarianska', JSON.stringify(existingData));

      await dataManager.initStorage();

      const data = JSON.parse(localStorage.getItem('chataMarianska'));
      expect(data.bookings).toHaveLength(1);
      expect(data.bookings[0].id).toBe('TEST1');
    });

    it('should load data from server if available', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            bookings: [{ id: 'SERVER1' }],
            blockedDates: [],
            settings: { adminPassword: 'test' },
          }),
      });

      await dataManager.initStorage();

      expect(fetch).toHaveBeenCalledWith('/api/data');
    });
  });

  describe('ID Generation', () => {
    it('should generate booking ID in correct format', () => {
      const id = dataManager.generateBookingId();

      expect(id).toMatch(/^BK[A-Z0-9]{13}$/u);
      expect(id).toHaveLength(15); // BK + 13 chars
    });

    it('should generate unique booking IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(dataManager.generateBookingId());
      }

      expect(ids.size).toBe(100); // All unique
    });

    it('should generate edit token with correct length', () => {
      const token = dataManager.generateEditToken();

      expect(token).toHaveLength(30);
      expect(token).toMatch(/^[a-z0-9]{30}$/u);
    });

    it('should generate unique edit tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(dataManager.generateEditToken());
      }

      expect(tokens.size).toBe(100);
    });

    it('should generate blockage ID in correct format', () => {
      const id = dataManager.generateBlockageId();

      expect(id).toMatch(/^BLK[A-Z0-9]{10}$/u);
    });
  });

  describe('Booking Operations', () => {
    beforeEach(async () => {
      await dataManager.initStorage();
    });

    describe('Create Booking', () => {
      const validBookingData = {
        name: 'Jan Novák',
        email: 'jan@example.com',
        phone: '+420123456789',
        company: 'Test s.r.o.',
        address: 'Test 123',
        city: 'Praha',
        zip: '12345',
        ico: '12345678',
        dic: 'CZ12345678',
        startDate: '2025-07-01',
        endDate: '2025-07-03',
        rooms: ['12', '13'],
        guestType: 'utia',
        adults: 2,
        children: 1,
        toddlers: 0,
        totalPrice: 1500,
        notes: 'Test booking',
      };

      it('should create booking with all fields', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ...validBookingData, id: 'BK123', editToken: 'token123' },
            }),
        });

        const booking = await dataManager.createBooking(validBookingData);

        expect(booking).toHaveProperty('id');
        expect(booking).toHaveProperty('editToken');
        expect(booking).toHaveProperty('createdAt');
        expect(booking).toHaveProperty('updatedAt');
        expect(booking.name).toBe(validBookingData.name);
        expect(booking.email).toBe(validBookingData.email);
      });

      it('should store booking in localStorage', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ...validBookingData, id: 'BK123', editToken: 'token123' },
            }),
        });

        await dataManager.createBooking(validBookingData);

        const data = JSON.parse(localStorage.getItem('chataMarianska'));
        expect(data.bookings.length).toBeGreaterThan(0);
      });

      it('should handle server error and fallback to localStorage', async () => {
        fetch.mockRejectedValueOnce(new Error('Server error'));

        const booking = await dataManager.createBooking(validBookingData);

        expect(booking).toHaveProperty('id');
        expect(booking.id).toMatch(/^BK[A-Z0-9]{13}$/u);
      });
    });

    describe('Get Booking', () => {
      it('should retrieve booking by ID', async () => {
        const data = {
          bookings: [
            { id: 'BK123', name: 'Test 1' },
            { id: 'BK456', name: 'Test 2' },
          ],
          blockedDates: [],
          settings: {},
        };
        localStorage.setItem('chataMarianska', JSON.stringify(data));

        await dataManager.initStorage();
        const booking = dataManager.getBooking('BK123');

        expect(booking).toBeDefined();
        expect(booking.id).toBe('BK123');
        expect(booking.name).toBe('Test 1');
      });

      it('should return undefined for non-existent booking', async () => {
        await dataManager.initStorage();
        const booking = dataManager.getBooking('NONEXISTENT');

        expect(booking).toBeUndefined();
      });
    });

    describe('Update Booking', () => {
      it('should update booking fields', async () => {
        const originalBooking = {
          id: 'BK123',
          name: 'Original',
          email: 'original@example.com',
          editToken: 'token123',
        };

        const data = {
          bookings: [originalBooking],
          blockedDates: [],
          settings: {},
        };
        localStorage.setItem('chataMarianska', JSON.stringify(data));

        await dataManager.initStorage();

        fetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ...originalBooking, name: 'Updated' },
            }),
        });

        const updated = await dataManager.updateBooking('BK123', {
          name: 'Updated',
        });

        expect(updated.name).toBe('Updated');
        expect(updated.id).toBe('BK123');
      });

      it('should update timestamp', async () => {
        const booking = {
          id: 'BK123',
          name: 'Test',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        };

        const data = {
          bookings: [booking],
          blockedDates: [],
          settings: {},
        };
        localStorage.setItem('chataMarianska', JSON.stringify(data));

        await dataManager.initStorage();

        fetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ...booking, name: 'Updated', updatedAt: new Date().toISOString() },
            }),
        });

        const updated = await dataManager.updateBooking('BK123', { name: 'Updated' });

        expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
          new Date(booking.updatedAt).getTime()
        );
      });
    });

    describe('Delete Booking', () => {
      it('should delete existing booking', async () => {
        const data = {
          bookings: [
            { id: 'BK123', name: 'Test 1' },
            { id: 'BK456', name: 'Test 2' },
          ],
          blockedDates: [],
          settings: {},
        };
        localStorage.setItem('chataMarianska', JSON.stringify(data));

        await dataManager.initStorage();

        fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const result = await dataManager.deleteBooking('BK123');

        expect(result).toBe(true);

        const remaining = JSON.parse(localStorage.getItem('chataMarianska'));
        expect(remaining.bookings).toHaveLength(1);
        expect(remaining.bookings[0].id).toBe('BK456');
      });

      it('should return false for non-existent booking', async () => {
        await dataManager.initStorage();

        fetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ success: false }),
        });

        const result = await dataManager.deleteBooking('NONEXISTENT');

        expect(result).toBe(false);
      });
    });
  });

  describe('Room Availability', () => {
    beforeEach(async () => {
      await dataManager.initStorage();
    });

    it('should detect booked room', async () => {
      const data = {
        bookings: [
          {
            id: 'BK123',
            startDate: '2025-07-01',
            endDate: '2025-07-05',
            rooms: ['12', '13'],
            email: 'test@example.com',
          },
        ],
        blockedDates: [],
        settings: {},
      };
      localStorage.setItem('chataMarianska', JSON.stringify(data));
      await dataManager.initStorage();

      const availability = await dataManager.getRoomAvailability('2025-07-03', '12');

      expect(availability.status).toBe('booked');
      expect(availability.email).toBe('test@example.com');
    });

    it('should detect available room', async () => {
      const data = {
        bookings: [],
        blockedDates: [],
        settings: {},
      };
      localStorage.setItem('chataMarianska', JSON.stringify(data));
      await dataManager.initStorage();

      const availability = await dataManager.getRoomAvailability('2025-07-03', '12');

      expect(availability.status).toBe('available');
      expect(availability.email).toBeNull();
    });

    it('should detect blocked room', async () => {
      const data = {
        bookings: [],
        blockedDates: [
          {
            date: '2025-07-03',
            roomId: '12',
            reason: 'Maintenance',
          },
        ],
        settings: {},
      };
      localStorage.setItem('chataMarianska', JSON.stringify(data));
      await dataManager.initStorage();

      const availability = await dataManager.getRoomAvailability('2025-07-03', '12');

      expect(availability.status).toBe('blocked');
    });

    it('should treat checkout day as available', async () => {
      const data = {
        bookings: [
          {
            id: 'BK123',
            startDate: '2025-07-01',
            endDate: '2025-07-05',
            rooms: ['12'],
            email: 'test@example.com',
          },
        ],
        blockedDates: [],
        settings: {},
      };
      localStorage.setItem('chataMarianska', JSON.stringify(data));
      await dataManager.initStorage();

      const availability = await dataManager.getRoomAvailability('2025-07-05', '12');

      expect(availability.status).toBe('available');
    });
  });



  describe('Christmas Period Detection', () => {
    beforeEach(async () => {
      const data = {
        bookings: [],
        blockedDates: [],
        settings: {
          christmasPeriods: [
            {
              period_id: 'XMAS_2024',
              name: 'Vánoce 2024',
              start_date: '2024-12-23',
              end_date: '2025-01-02',
              year: 2024,
            },
          ],
        },
      };
      localStorage.setItem('chataMarianska', JSON.stringify(data));
      await dataManager.initStorage();
    });

    it('should detect date within Christmas period', () => {
      expect(dataManager.isChristmasPeriod('2024-12-25')).toBe(true);
    });

    it('should detect first day of period', () => {
      expect(dataManager.isChristmasPeriod('2024-12-23')).toBe(true);
    });

    it('should detect last day of period', () => {
      expect(dataManager.isChristmasPeriod('2025-01-02')).toBe(true);
    });

    it('should return false for dates outside period', () => {
      expect(dataManager.isChristmasPeriod('2024-12-22')).toBe(false);
      expect(dataManager.isChristmasPeriod('2025-01-03')).toBe(false);
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-12-25');
      expect(dataManager.isChristmasPeriod(date)).toBe(true);
    });
  });

  describe('Date Formatting', () => {
    it('should format Date to YYYY-MM-DD', () => {
      const date = new Date('2025-07-15T12:00:00.000Z');
      const formatted = dataManager.formatDate(date);

      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    });

    it('should handle date strings', () => {
      const formatted = dataManager.formatDate('2025-07-15');

      expect(formatted).toBe('2025-07-15');
    });
  });

  describe('Email Color Generation', () => {
    it('should generate consistent color for same email', () => {
      const color1 = dataManager.getEmailColor('test@example.com');
      const color2 = dataManager.getEmailColor('test@example.com');

      expect(color1).toBe(color2);
    });

    it('should generate different colors for different emails', () => {
      const color1 = dataManager.getEmailColor('test1@example.com');
      const color2 = dataManager.getEmailColor('test2@example.com');

      expect(color1).not.toBe(color2);
    });

    it('should generate valid hex color', () => {
      const color = dataManager.getEmailColor('test@example.com');

      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/u);
    });
  });

  describe('Data Synchronization', () => {
    it('should sync with server', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            bookings: [{ id: 'BK123' }],
            blockedDates: [],
            settings: {},
          }),
      });

      await dataManager.initStorage();

      expect(fetch).toHaveBeenCalled();
    });

    it('should fallback to localStorage on server error', async () => {
      localStorage.setItem(
        'chataMarianska',
        JSON.stringify({
          bookings: [{ id: 'LOCAL1' }],
          blockedDates: [],
          settings: {},
        })
      );

      fetch.mockRejectedValueOnce(new Error('Network error'));

      await dataManager.initStorage();

      const data = JSON.parse(localStorage.getItem('chataMarianska'));
      expect(data.bookings[0].id).toBe('LOCAL1');
    });
  });

  describe('Blocked Dates Management', () => {
    beforeEach(async () => {
      await dataManager.initStorage();
    });

    it('should add blocked date', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await dataManager.blockDate('2025-07-15', '12', 'Maintenance');

      const data = JSON.parse(localStorage.getItem('chataMarianska'));
      const blocked = data.blockedDates.find(
        (bd) => bd.date === '2025-07-15' && bd.roomId === '12'
      );

      expect(blocked).toBeDefined();
      expect(blocked.reason).toBe('Maintenance');
    });

    it('should remove blocked date', async () => {
      const data = {
        bookings: [],
        blockedDates: [
          {
            date: '2025-07-15',
            roomId: '12',
            blockageId: 'BLK123',
          },
        ],
        settings: {},
      };
      localStorage.setItem('chataMarianska', JSON.stringify(data));
      await dataManager.initStorage();

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await dataManager.unblockDate('BLK123');

      const updatedData = JSON.parse(localStorage.getItem('chataMarianska'));
      expect(updatedData.blockedDates).toHaveLength(0);
    });
  });
});
