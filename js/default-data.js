/**
 * Default data structure for the booking system
 */
const DEFAULT_ROOMS = [
  { id: '12', name: 'Pokoj 12', beds: 2 },
  { id: '13', name: 'Pokoj 13', beds: 3 },
  { id: '14', name: 'Pokoj 14', beds: 4 },
  { id: '22', name: 'Pokoj 22', beds: 2 },
  { id: '23', name: 'Pokoj 23', beds: 3 },
  { id: '24', name: 'Pokoj 24', beds: 4 },
  { id: '42', name: 'Pokoj 42', beds: 2 },
  { id: '43', name: 'Pokoj 43', beds: 2 },
  { id: '44', name: 'Pokoj 44', beds: 4 },
];

const DEFAULT_PRICES = {
  utia: {
    base: 300,
    adult: 50,
    child: 25,
  },
  external: {
    base: 500,
    adult: 100,
    child: 50,
  },
};

const DEFAULT_BULK_PRICES = {
  basePrice: 2000,
  utiaAdult: 100,
  utiaChild: 0,
  externalAdult: 250,
  externalChild: 50,
};

const DEFAULT_DATA = {
  bookings: [],
  blockedDates: [],
  settings: {
    adminPassword: 'admin123',
    christmasAccessCodes: ['XMAS2024'],
    christmasPeriod: {
      start: '2024-12-23',
      end: '2025-01-02',
    },
    emailSettings: {
      mockMode: true,
    },
    rooms: DEFAULT_ROOMS,
    prices: DEFAULT_PRICES,
    bulkPrices: DEFAULT_BULK_PRICES,
    christmasPeriods: [
      {
        start: '2024-12-23',
        end: '2025-01-02',
        year: 2024,
      },
    ],
    emailTemplate: {
      subject: 'Potvrzení rezervace - Chata Mariánská',
      template: `Dobrý den,

děkujeme za Vaši rezervaci v chatě Mariánská.

DETAIL REZERVACE:
================
Číslo rezervace: {booking_id}
Datum příjezdu: {start_date}
Datum odjezdu: {end_date}
Pokoje: {rooms}
Počet hostů: {adults} dospělých, {children} dětí, {toddlers} batolat
Celková cena: {total_price} Kč

DŮLEŽITÉ INFORMACE:
==================
- minimálně den předem je povinnost se spojit se správci chaty kvůli předání klíčů
- Check-in: od 14:00
- Check-out: do 10:00
- Adresa: Mariánská 1234, 543 21 Pec pod Sněžkou
- Telefon: +420 123 456 789

Pro úpravu nebo zrušení rezervace použijte tento odkaz:
{edit_url}

Bude vystavena faktura a zaslána emailem.

Těšíme se na Vaši návštěvu!

S pozdravem,
Tým Chata Mariánská`,
    },
  },
  rooms: DEFAULT_ROOMS,
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_DATA, DEFAULT_ROOMS, DEFAULT_PRICES, DEFAULT_BULK_PRICES };
}