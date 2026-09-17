/**
 * EmailService.generatePriceBreakdown - per-room price breakdown
 *
 * REGRESSION 2026-09-17: Reported by user (booking BKDYP0ILKOSX62J).
 * The e-mail breakdown priced every guest with the booking-level guest type,
 * so a room with mixed ÚTIA/external guests showed ÚTIA rates for everyone
 * and the per-room totals did not add up to the (correct) total price.
 */

const EmailService = require('../../js/shared/emailService');

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
    expect(breakdown).toContain('Dospělí (EXT): 1 × 100 Kč/noc × 7 nocí = 700 Kč');
    expect(breakdown).toContain('Děti (ÚTIA): 2 × 25 Kč/noc × 7 nocí = 350 Kč');
    expect(breakdown).toContain('Děti (EXT): 1 × 50 Kč/noc × 7 nocí = 350 Kč');
    expect(breakdown).toContain('Celkem za pokoj: 3850 Kč');

    // Room 23: 2 ÚTIA adults in a small room
    expect(breakdown).toContain('Dospělí (ÚTIA): 2 × 50 Kč/noc × 7 nocí = 700 Kč');
    expect(breakdown).toContain('Celkem za pokoj: 2450 Kč');
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

    expect(breakdown).toContain('Batolata (zdarma): 1 × 0 Kč');
    expect(sumRoomTotals(breakdown)).toBe(6300);
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
});
