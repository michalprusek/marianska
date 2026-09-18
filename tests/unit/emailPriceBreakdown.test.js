/**
 * EmailService.generatePriceBreakdown - per-room price breakdown
 *
 * REGRESSION 2026-09-17: booking BKDYP0ILKOSX62J, see FIX 2026-09-17 in emailService.js.
 */

const EmailService = require('../../js/shared/emailService');
const PriceCalculator = require('../../js/shared/priceCalculator');
const { createLogger } = require('../../js/shared/logger');

// Production rates at the time of the report - they reproduce the reported 3325 vs 3850 Kč
const SETTINGS = {
  prices: {
    utia: {
      small: { empty: 250, adult: 50, child: 25 },
      large: { empty: 350, adult: 50, child: 25 },
    },
    external: {
      small: { empty: 400, adult: 100, child: 50 },
      large: { empty: 500, adult: 100, child: 50 },
    },
  },
  rooms: [
    { id: '23', name: 'Pokoj 23', type: 'small', beds: 3 },
    { id: '24', name: 'Pokoj 24', type: 'large', beds: 4 },
  ],
};

// Real-world data from booking BKDYP0ILKOSX62J (2026-08-02 → 2026-08-09, 7 nights)
const MIXED_BOOKING = {
  id: 'BKDYP0ILKOSX62J',
  startDate: '2026-08-02',
  endDate: '2026-08-09',
  rooms: ['23', '24'],
  guestType: 'utia',
  adults: 3,
  children: 3,
  toddlers: 0,
  totalPrice: 6300,
  perRoomDates: {
    23: { startDate: '2026-08-02', endDate: '2026-08-09' },
    24: { startDate: '2026-08-02', endDate: '2026-08-09' },
  },
  perRoomGuests: {
    23: { adults: 2, children: 0, toddlers: 0 },
    24: { adults: 1, children: 3, toddlers: 0 },
  },
  guestNames: [
    { roomId: '23', personType: 'adult', guestPriceType: 'utia' },
    { roomId: '23', personType: 'adult', guestPriceType: 'utia' },
    { roomId: '24', personType: 'adult', guestPriceType: 'external' },
    { roomId: '24', personType: 'child', guestPriceType: 'utia' },
    { roomId: '24', personType: 'child', guestPriceType: 'utia' },
    { roomId: '24', personType: 'child', guestPriceType: 'external' },
  ],
};

const roomBlock = (breakdown, roomId) =>
  breakdown.split('\n\n').find((block) => block.startsWith(`Pokoj ${roomId} `)) || '';

const sumRoomTotals = (breakdown) =>
  [...breakdown.matchAll(/Celkem za pokoj: (\d+) Kč/g)].reduce(
    (sum, match) => sum + Number(match[1]),
    0
  );

describe('EmailService.generatePriceBreakdown - mixed guest types per room', () => {
  let emailService;

  beforeEach(() => {
    emailService = new EmailService();
  });

  test('prices each guest with their own ÚTIA/external rate', () => {
    const breakdown = emailService.generatePriceBreakdown(MIXED_BOOKING, SETTINGS);

    // Room 24: 1 external adult (100), 2 ÚTIA children (25), 1 external child (50)
    const room24 = roomBlock(breakdown, '24');
    expect(room24).toContain('Dospělí (EXT): 1 × 100 Kč/noc × 7 nocí = 700 Kč');
    expect(room24).toContain('Děti (ÚTIA): 2 × 25 Kč/noc × 7 nocí = 350 Kč');
    expect(room24).toContain('Děti (EXT): 1 × 50 Kč/noc × 7 nocí = 350 Kč');
    expect(room24).toContain('Celkem za pokoj: 3850 Kč');

    // Room 23: 2 ÚTIA adults in a small room
    const room23 = roomBlock(breakdown, '23');
    expect(room23).toContain('Dospělí (ÚTIA): 2 × 50 Kč/noc × 7 nocí = 700 Kč');
    expect(room23).toContain('Celkem za pokoj: 2450 Kč');
  });

  test('empty room rate uses ÚTIA when the room hosts at least one ÚTIA guest', () => {
    const breakdown = emailService.generatePriceBreakdown(MIXED_BOOKING, SETTINGS);

    expect(breakdown).toContain('Základní cena (ÚTIA): 250 Kč/noc × 7 nocí = 1750 Kč');
    expect(breakdown).toContain('Základní cena (ÚTIA): 350 Kč/noc × 7 nocí = 2450 Kč');
  });

  test('room totals add up to the total price shown in the e-mail', () => {
    const breakdown = emailService.generatePriceBreakdown(MIXED_BOOKING, SETTINGS);

    expect(sumRoomTotals(breakdown)).toBe(MIXED_BOOKING.totalPrice);
    expect(breakdown).toContain('CELKOVÁ CENA: 6300 Kč');
  });

  test('room with only external guests uses external rates', () => {
    const externalBooking = {
      ...MIXED_BOOKING,
      guestType: 'utia',
      rooms: ['24'],
      perRoomDates: { 24: { startDate: '2026-08-02', endDate: '2026-08-09' } },
      perRoomGuests: { 24: { adults: 2, children: 0, toddlers: 0 } },
      totalPrice: 4900,
      guestNames: [
        { roomId: '24', personType: 'adult', guestPriceType: 'external' },
        { roomId: '24', personType: 'adult', guestPriceType: 'external' },
      ],
    };

    const breakdown = emailService.generatePriceBreakdown(externalBooking, SETTINGS);

    expect(breakdown).toContain('Základní cena (EXT): 500 Kč/noc × 7 nocí = 3500 Kč');
    expect(breakdown).toContain('Dospělí (EXT): 2 × 100 Kč/noc × 7 nocí = 1400 Kč');
    expect(breakdown).toContain('Celkem za pokoj: 4900 Kč');
  });

  test('toddlers are listed as free and do not change the price', () => {
    const withToddler = {
      ...MIXED_BOOKING,
      toddlers: 1,
      perRoomGuests: {
        23: { adults: 2, children: 0, toddlers: 0 },
        24: { adults: 1, children: 3, toddlers: 1 },
      },
      guestNames: [
        ...MIXED_BOOKING.guestNames,
        { roomId: '24', personType: 'toddler', guestPriceType: 'external' },
      ],
    };

    const breakdown = emailService.generatePriceBreakdown(withToddler, SETTINGS);

    expect(roomBlock(breakdown, '24')).toContain('Batolata (zdarma): 1 × 0 Kč');
    expect(sumRoomTotals(breakdown)).toBe(withToddler.totalPrice);
  });

  test('falls back to per-room counts and booking guest type without guestNames', () => {
    const legacyBooking = {
      ...MIXED_BOOKING,
      guestType: 'utia',
      guestNames: [],
      totalPrice: 5775,
    };

    const breakdown = emailService.generatePriceBreakdown(legacyBooking, SETTINGS);

    expect(breakdown).toContain('Dospělí (ÚTIA): 2 × 50 Kč/noc × 7 nocí = 700 Kč');
    expect(breakdown).toContain('Děti (ÚTIA): 3 × 25 Kč/noc × 7 nocí = 525 Kč');
    expect(sumRoomTotals(breakdown)).toBe(5775);
  });

  test('uses explicit per-room guest type when guestNames are missing', () => {
    const perRoomTypeBooking = {
      ...MIXED_BOOKING,
      guestType: 'utia',
      guestNames: [],
      rooms: ['24'],
      perRoomDates: { 24: { startDate: '2026-08-02', endDate: '2026-08-09' } },
      perRoomGuests: { 24: { adults: 1, children: 0, toddlers: 0, guestType: 'external' } },
      totalPrice: 4200,
    };

    const breakdown = emailService.generatePriceBreakdown(perRoomTypeBooking, SETTINGS);

    expect(breakdown).toContain('Základní cena (EXT): 500 Kč/noc × 7 nocí = 3500 Kč');
    expect(breakdown).toContain('Dospělí (EXT): 1 × 100 Kč/noc × 7 nocí = 700 Kč');
    expect(breakdown).toContain('Celkem za pokoj: 4200 Kč');
  });
  // Stored total computed exactly like server.js does when the booking is edited
  // (perRoomGuests from the database carry no per-room guestType).
  const chargedTotal = (booking) =>
    PriceCalculator.calculatePerGuestPrice({
      rooms: booking.rooms,
      guestNames: booking.guestNames,
      perRoomGuests: booking.perRoomGuests,
      perRoomDates: booking.perRoomDates,
      nights: 7,
      settings: SETTINGS,
      fallbackGuestType: booking.guestType,
    });

  test('all-external room in a booking with an ÚTIA guest elsewhere: e-mail matches the charge', () => {
    const booking = {
      ...MIXED_BOOKING,
      guestType: 'utia',
      perRoomGuests: {
        23: { adults: 2, children: 0, toddlers: 0 },
        24: { adults: 1, children: 0, toddlers: 0 },
      },
      guestNames: [
        { roomId: '23', personType: 'adult', guestPriceType: 'external' },
        { roomId: '23', personType: 'adult', guestPriceType: 'external' },
        { roomId: '24', personType: 'adult', guestPriceType: 'utia' },
      ],
    };
    booking.totalPrice = chargedTotal(booking);

    const breakdown = emailService.generatePriceBreakdown(booking, SETTINGS);

    // Room 23 has only external guests -> external empty-room rate, not the booking-level ÚTIA
    expect(roomBlock(breakdown, '23')).toContain(
      'Základní cena (EXT): 400 Kč/noc × 7 nocí = 2800 Kč'
    );
    expect(booking.totalPrice).toBe(7000);
    expect(sumRoomTotals(breakdown)).toBe(booking.totalPrice);
  });

  test('e-mail matches the charge for the reported booking computed as on edit', () => {
    const booking = { ...MIXED_BOOKING };
    expect(chargedTotal(booking)).toBe(MIXED_BOOKING.totalPrice);
    expect(sumRoomTotals(emailService.generatePriceBreakdown(booking, SETTINGS))).toBe(
      MIXED_BOOKING.totalPrice
    );
  });

  test('rooms with different date ranges use their own nights', () => {
    const booking = {
      ...MIXED_BOOKING,
      perRoomDates: {
        23: { startDate: '2026-08-02', endDate: '2026-08-04' },
        24: { startDate: '2026-08-02', endDate: '2026-08-09' },
      },
      totalPrice: 700 + 3850, // room 23: (250 + 2×50) × 2 nights
    };

    const breakdown = emailService.generatePriceBreakdown(booking, SETTINGS);

    expect(roomBlock(breakdown, '23')).toContain('Dospělí (ÚTIA): 2 × 50 Kč/noc × 2 nocí = 200 Kč');
    expect(roomBlock(breakdown, '24')).toContain('× 7 nocí');
    expect(sumRoomTotals(breakdown)).toBe(booking.totalPrice);
  });

  test('missing price configuration degrades to the total instead of throwing', () => {
    const brokenSettings = {
      ...SETTINGS,
      prices: { ...SETTINGS.prices, utia: { small: SETTINGS.prices.utia.small } },
    };

    const breakdown = emailService.generatePriceBreakdown(MIXED_BOOKING, brokenSettings);

    expect(breakdown).toContain('CELKOVÁ CENA: 6300 Kč');
    expect(breakdown).not.toContain('Pokoj');
  });

  test('legacy flat price table shows the rates that were actually charged', () => {
    const flatSettings = {
      ...SETTINGS,
      prices: {
        utia: { empty: 250, adult: 50, child: 25 },
        external: { empty: 400, adult: 100, child: 50 },
      },
    };

    const breakdown = emailService.generatePriceBreakdown(MIXED_BOOKING, flatSettings);

    expect(breakdown).not.toContain('× 0 Kč/noc');
    expect(roomBlock(breakdown, '24')).toContain('Dospělí (EXT): 1 × 100 Kč/noc');
  });

  test('warns when the breakdown does not match the stored total', () => {
    const warnSpy = jest.spyOn(Object.getPrototypeOf(createLogger('x')), 'warn');

    emailService.generatePriceBreakdown({ ...MIXED_BOOKING, totalPrice: 9999 }, SETTINGS);

    expect(warnSpy).toHaveBeenCalledWith(
      'Price breakdown does not match stored total price',
      expect.objectContaining({ storedTotal: 9999, calculatedTotal: 6300 })
    );
  });
});

describe('EmailService.generatePriceBreakdown - grouped and bulk bookings', () => {
  test('rooms sharing one date range keep headers without dates', () => {
    const breakdown = new EmailService().generatePriceBreakdown(MIXED_BOOKING, SETTINGS);

    expect(breakdown).toContain('Pokoj 23 (3 lůžka)\n');
    expect(breakdown).toContain('Pokoj 24 (4 lůžka)\n');
  });

  test('bulk booking without bulkPrices shows the total, never a per-room split', () => {
    const bulkBooking = { ...MIXED_BOOKING, isBulkBooking: true, totalPrice: 20000 };

    const breakdown = new EmailService().generatePriceBreakdown(bulkBooking, SETTINGS);

    expect(breakdown).toContain('CELKOVÁ CENA: 20000 Kč');
    expect(breakdown).not.toContain('Pokoj');
  });
});

describe('EmailService.generatePriceBreakdown - bookings without per-room data', () => {
  test('does not throw for a booking with toddlers', () => {
    const emailService = new EmailService();
    const booking = {
      id: 'LEGACY',
      startDate: '2026-08-02',
      endDate: '2026-08-09',
      rooms: ['23'],
      guestType: 'utia',
      adults: 1,
      children: 0,
      toddlers: 1,
      totalPrice: 2100,
      guestNames: [
        { personType: 'adult', guestPriceType: 'utia' },
        { personType: 'toddler', guestPriceType: 'utia' },
      ],
    };

    const breakdown = emailService.generatePriceBreakdown(booking, SETTINGS);

    expect(breakdown).toContain('1 batole = zdarma');
    expect(breakdown).toContain('CELKOVÁ CENA');
  });
});
