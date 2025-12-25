/* eslint-disable max-classes-per-file */
// Mock data and utilities for tests

// Sample booking data
const sampleBooking = {
  id: 'BK1234567890ABC',
  name: 'Jan Novák',
  email: 'jan.novak@example.com',
  phone: '+420123456789',
  company: 'Test Firma s.r.o.',
  address: 'Testovací 123',
  city: 'Praha',
  zip: '12345',
  ico: '12345678',
  dic: 'CZ12345678',
  startDate: '2025-06-10',
  endDate: '2025-06-12',
  rooms: ['12', '13'],
  guestType: 'utia',
  adults: 2,
  children: 1,
  toddlers: 0,
  totalPrice: 1500,
  notes: 'Test poznámka',
  editToken: 'abc123def456ghi789jkl012mno345',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Sample settings
const sampleSettings = {
  adminPassword: '$2b$10$testHashedPassword',
  christmasAccessCodes: ['XMAS2024', 'VIP123'],
  christmasPeriods: [
    {
      period_id: 'XMAS_2024_001',
      name: 'Vánoce 2024',
      start_date: '2024-12-23',
      end_date: '2025-01-02',
      year: 2024,
    },
  ],
  rooms: [
    { id: '12', name: 'Pokoj 12', beds: 2, type: 'small' },
    { id: '13', name: 'Pokoj 13', beds: 3, type: 'small' },
    { id: '14', name: 'Pokoj 14', beds: 4, type: 'large' },
    { id: '22', name: 'Pokoj 22', beds: 2, type: 'small' },
    { id: '23', name: 'Pokoj 23', beds: 3, type: 'small' },
    { id: '24', name: 'Pokoj 24', beds: 4, type: 'large' },
    { id: '42', name: 'Pokoj 42', beds: 2, type: 'small' },
    { id: '43', name: 'Pokoj 43', beds: 2, type: 'small' },
    { id: '44', name: 'Pokoj 44', beds: 4, type: 'large' },
  ],
  prices: {
    utia: {
      small: { base: 300, adult: 50, child: 25 },
      large: { base: 400, adult: 50, child: 25 },
    },
    external: {
      small: { base: 500, adult: 100, child: 50 },
      large: { base: 600, adult: 100, child: 50 },
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

// Mock DataManager class
class MockDataManager {
  constructor() {
    this.data = {
      bookings: [],
      blockedDates: [],
      settings: sampleSettings,
    };
  }

  initData() {
    return this.data;
  }

  createBooking(bookingData) {
    const booking = {
      ...bookingData,
      id: this.generateBookingId(),
      editToken: this.generateEditToken(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.bookings.push(booking);
    return booking;
  }

  updateBooking(id, updates) {
    const index = this.data.bookings.findIndex((b) => b.id === id);
    if (index === -1) {
      return null;
    }

    this.data.bookings[index] = {
      ...this.data.bookings[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return this.data.bookings[index];
  }

  deleteBooking(id) {
    const index = this.data.bookings.findIndex((b) => b.id === id);
    if (index === -1) {
      return false;
    }

    this.data.bookings.splice(index, 1);
    return true;
  }

  getBooking(id) {
    return this.data.bookings.find((b) => b.id === id);
  }

  getAllBookings() {
    return this.data.bookings;
  }

  generateBookingId() {
    // Generate BK + 13 uppercase alphanumeric characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'BK';
    for (let i = 0; i < 13; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  generateEditToken() {
    // Generate exactly 30 character token
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 30; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  async getRoomAvailability(date, roomId) {
    // Check blocked dates
    const blocked = this.data.blockedDates.find((bd) => bd.date === date && bd.roomId === roomId);
    if (blocked) {
      return { status: 'blocked', email: null };
    }

    // Check bookings
    const booking = this.data.bookings.find((b) => {
      const start = new Date(b.startDate);
      const end = new Date(b.endDate);
      const check = new Date(date);
      return b.rooms.includes(roomId) && check >= start && check < end;
    });

    if (booking) {
      return { status: 'booked', email: booking.email };
    }

    // FIX 2025-12-23: Check proposed bookings (with EXCLUSIVE end date logic)
    const proposedBookings = this.data.proposedBookings || [];
    const now = Date.now();
    const checkDate = new Date(date);

    for (const pb of proposedBookings) {
      // Skip expired proposals
      if (pb.expires_at && pb.expires_at < now) continue;

      // Check if room matches
      if (!pb.rooms || !pb.rooms.includes(roomId)) continue;

      // EXCLUSIVE end date logic: date must be >= start AND < end
      const start = new Date(pb.start_date);
      const end = new Date(pb.end_date);

      if (checkDate >= start && checkDate < end) {
        return { status: 'proposed', email: null, proposalId: pb.proposal_id };
      }
    }

    return { status: 'available', email: null };
  }

  isChristmasPeriod(date) {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const periods = this.data.settings.christmasPeriods || [];

    return periods.some((period) => dateStr >= period.start_date && dateStr <= period.end_date);
  }
}

// Mock fetch for API testing
function mockFetch(url, _options = {}) {
  return new Promise((resolve) => {
    const response = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: {} }),
      text: () => Promise.resolve(JSON.stringify({ success: true })),
    };
    resolve(response);
  });
}

// Mock localStorage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }

  get length() {
    return Object.keys(this.store).length;
  }

  key(index) {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

// Mock DOM elements
function createMockElement(tag = 'div') {
  const element = {
    tagName: tag.toUpperCase(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn(() => false),
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    getAttribute: jest.fn(),
    setAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    innerHTML: '',
    textContent: '',
    value: '',
    style: {},
    dataset: {},
  };
  return element;
}

module.exports = {
  sampleBooking,
  sampleSettings,
  MockDataManager,
  mockFetch,
  MockLocalStorage,
  createMockElement,
};
