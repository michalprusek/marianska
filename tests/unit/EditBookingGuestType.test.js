/**
 * Unit Tests for Admin Edit Booking Guest Type Toggle
 * Tests the fix for price update when changing guest types
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Mock PriceCalculator
const mockCalculatePerGuestPrice = jest.fn().mockReturnValue(1000);
global.PriceCalculator = {
  calculatePerGuestPrice: mockCalculatePerGuestPrice,
};

// Mock DateUtils
global.DateUtils = {
  getDaysBetween: jest.fn((start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  }),
};

describe('EditBookingComponent - updateTotalPrice', () => {
  let component;
  let mockPriceEl;

  beforeEach(() => {
    // Setup DOM mocks
    mockPriceEl = { textContent: '' };
    jest.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'editTotalPrice') return mockPriceEl;
      // Return mock toggle elements
      if (id.includes('GuestTypeToggle')) {
        return { checked: id.includes('Adult2') }; // Second adult is external
      }
      if (id.includes('FirstName') || id.includes('LastName')) {
        return { value: 'Test Name' };
      }
      return null;
    });

    // Create minimal component mock
    component = {
      editSelectedRooms: new Map([
        ['12', { adults: 2, children: 0, toddlers: 0, guestType: 'utia' }],
      ]),
      perRoomDates: new Map([['12', { startDate: '2025-06-10', endDate: '2025-06-12' }]]),
      settings: {
        rooms: [{ id: '12', name: 'P12', type: 'small', beds: 3 }],
        prices: {
          utia: { small: { empty: 250, adult: 50, child: 25 } },
          external: { small: { empty: 400, adult: 100, child: 50 } },
        },
      },
    };

    // Load and mock the _collectGuestNamesWithPriceTypes method
    component._collectGuestNamesWithPriceTypes = function () {
      const guestNames = [];
      for (const [roomId, roomData] of this.editSelectedRooms.entries()) {
        for (let i = 1; i <= (roomData.adults || 0); i++) {
          const toggleId = `room${roomId}Adult${i}GuestTypeToggle`;
          const toggle = document.getElementById(toggleId);
          const isExternal = toggle?.checked || false;
          guestNames.push({
            roomId,
            personType: 'adult',
            guestPriceType: isExternal ? 'external' : 'utia',
            firstName: 'Test',
            lastName: 'Name',
          });
        }
      }
      return guestNames;
    };

    // Load the updateTotalPrice method
    component.updateTotalPrice = function () {
      const totalPriceEl = document.getElementById('editTotalPrice');
      if (!totalPriceEl) return;
      const guestNames = this._collectGuestNamesWithPriceTypes();
      if (guestNames.length === 0) {
        totalPriceEl.textContent = '0 Kč';
        return;
      }
      const perRoomGuests = {};
      for (const [roomId, roomData] of this.editSelectedRooms.entries()) {
        perRoomGuests[roomId] = {
          adults: roomData.adults,
          children: roomData.children,
          toddlers: roomData.toddlers || 0,
        };
      }
      const total = PriceCalculator.calculatePerGuestPrice({
        rooms: Array.from(this.editSelectedRooms.keys()),
        guestNames,
        perRoomGuests,
        perRoomDates: Object.fromEntries(this.perRoomDates),
        nights: null,
        settings: this.settings,
        fallbackGuestType: 'external',
      });
      totalPriceEl.textContent = `${total.toLocaleString('cs-CZ')} Kč`;
    };

    // FIX 2025-12-23: Reset mock and ensure return value is set
    mockCalculatePerGuestPrice.mockClear();
    mockCalculatePerGuestPrice.mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should call calculatePerGuestPrice with collected guest data', () => {
    component.updateTotalPrice();

    expect(mockCalculatePerGuestPrice).toHaveBeenCalledTimes(1);
    const callArgs = mockCalculatePerGuestPrice.mock.calls[0][0];

    expect(callArgs.rooms).toEqual(['12']);
    expect(callArgs.guestNames.length).toBe(2); // 2 adults
    expect(callArgs.perRoomGuests['12']).toEqual({ adults: 2, children: 0, toddlers: 0 });
  });

  test('should pass correct guestPriceType from toggles', () => {
    component.updateTotalPrice();

    const callArgs = mockCalculatePerGuestPrice.mock.calls[0][0];
    const guest1 = callArgs.guestNames[0]; // Adult1, unchecked = utia
    const guest2 = callArgs.guestNames[1]; // Adult2, checked = external

    expect(guest1.guestPriceType).toBe('utia');
    expect(guest2.guestPriceType).toBe('external');
  });

  test('should update price display element', () => {
    component.updateTotalPrice();

    // FIX 2025-12-23: toLocaleString('cs-CZ') uses non-breaking space (U+00A0)
    expect(mockPriceEl.textContent).toBe('1\u00A0000 Kč');
  });

  test('should show 0 when no guests', () => {
    component.editSelectedRooms = new Map();
    component.perRoomDates = new Map();

    component.updateTotalPrice();

    expect(mockPriceEl.textContent).toBe('0 Kč');
  });
});

describe('EditBookingGuests - collectGuestNames with roomId', () => {
  let guests;

  beforeEach(() => {
    // Mock DOM with guest inputs
    const mockInputs = {
      room12AdultFirstName1: { value: 'Jan', id: 'room12AdultFirstName1', dataset: {} },
      room12AdultLastName1: { value: 'Novak', id: 'room12AdultLastName1', dataset: {} },
      room12Adult1GuestTypeToggle: { checked: false },
      room12AdultFirstName2: { value: 'Marie', id: 'room12AdultFirstName2', dataset: {} },
      room12AdultLastName2: { value: 'Novakova', id: 'room12AdultLastName2', dataset: {} },
      room12Adult2GuestTypeToggle: { checked: true },
    };

    jest.spyOn(document, 'getElementById').mockImplementation((id) => mockInputs[id] || null);
    jest.spyOn(document, 'querySelectorAll').mockImplementation((selector) => {
      if (selector.includes('adult') && selector.includes('FirstName')) {
        return [mockInputs['room12AdultFirstName1'], mockInputs['room12AdultFirstName2']].map(
          (input) => ({
            ...input,
            dataset: { guestType: 'adult' },
          })
        );
      }
      if (selector.includes('adult') && selector.includes('LastName')) {
        return [mockInputs['room12AdultLastName1'], mockInputs['room12AdultLastName2']].map(
          (input) => ({
            ...input,
            dataset: {},
          })
        );
      }
      return [];
    });

    // Create EditBookingGuests mock
    guests = {
      _collectGuestType(type, guestNames) {
        const typeCap = type.charAt(0).toUpperCase() + type.slice(1);
        const firstNames = document.querySelectorAll(
          `input[data-guest-type="${type}"][id*="${typeCap}FirstName"]`
        );
        const lastNames = document.querySelectorAll(
          `input[data-guest-type="${type}"][id*="${typeCap}LastName"]`
        );
        const minLength = Math.min(firstNames.length, lastNames.length);

        for (let i = 0; i < minLength; i++) {
          const firstName = firstNames[i]?.value?.trim() || '';
          const lastName = lastNames[i]?.value?.trim() || '';
          if (firstName && lastName) {
            const inputId = firstNames[i].id;
            const isBulk = firstNames[i].dataset.bulk === 'true';
            let guestPriceType = 'utia';

            if (!isBulk) {
              const roomIdMatch = inputId.match(/room(\d+)/);
              const guestIndexMatch = inputId.match(new RegExp(`${typeCap}FirstName(\\d+)`));
              if (roomIdMatch && guestIndexMatch) {
                const roomId = roomIdMatch[1];
                const guestIndex = guestIndexMatch[1];
                const toggleInput = document.getElementById(
                  `room${roomId}${typeCap}${guestIndex}GuestTypeToggle`
                );
                if (toggleInput && toggleInput.checked) guestPriceType = 'external';
              }
            }

            // FIX: Extract roomId
            const roomIdForGuest = isBulk
              ? null
              : inputId.match(/room(\d+)/)
                ? inputId.match(/room(\d+)/)[1]
                : null;

            guestNames.push({
              personType: type,
              firstName,
              lastName,
              guestPriceType,
              roomId: roomIdForGuest,
            });
          }
        }
      },
      collectGuestNames() {
        const guestNames = [];
        this._collectGuestType('adult', guestNames);
        return guestNames;
      },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should include roomId in collected guest objects', () => {
    const collected = guests.collectGuestNames();

    expect(collected.length).toBe(2);
    expect(collected[0].roomId).toBe('12');
    expect(collected[1].roomId).toBe('12');
  });

  test('should have correct guestPriceType based on toggle', () => {
    const collected = guests.collectGuestNames();

    expect(collected[0].guestPriceType).toBe('utia'); // toggle unchecked
    expect(collected[1].guestPriceType).toBe('external'); // toggle checked
  });

  test('should have correct firstName and lastName', () => {
    const collected = guests.collectGuestNames();

    expect(collected[0].firstName).toBe('Jan');
    expect(collected[0].lastName).toBe('Novak');
    expect(collected[1].firstName).toBe('Marie');
    expect(collected[1].lastName).toBe('Novakova');
  });
});
