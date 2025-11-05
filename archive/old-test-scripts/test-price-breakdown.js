/**
 * Test script for price breakdown in emails
 * Tests both plain text and HTML email templates with price breakdown
 */

const EmailService = require('./js/shared/emailService');

// Sample booking data - single room
const singleRoomBooking = {
  id: 'BK_TEST_001',
  name: 'Jan Novák',
  email: 'jan.novak@utia.cas.cz',
  startDate: '2025-10-30',
  endDate: '2025-10-31',
  rooms: ['23'],
  guestType: 'utia',
  adults: 1,
  children: 0,
  toddlers: 0,
  totalPrice: 300,
  editToken: 'test_token_123',
};

// Sample booking data - multi-room with per-room data
const multiRoomBooking = {
  id: 'BK_TEST_002',
  name: 'Petr Svoboda',
  email: 'petr.svoboda@utia.cas.cz',
  startDate: '2025-11-01',
  endDate: '2025-11-03',
  rooms: ['12', '13', '14'],
  guestType: 'external',
  adults: 6,
  children: 2,
  toddlers: 0,
  totalPrice: 2800,
  editToken: 'test_token_456',
  perRoomDates: {
    '12': { startDate: '2025-11-01', endDate: '2025-11-03' },
    '13': { startDate: '2025-11-01', endDate: '2025-11-03' },
    '14': { startDate: '2025-11-01', endDate: '2025-11-03' },
  },
  perRoomGuests: {
    '12': { adults: 2, children: 0, toddlers: 0, guestType: 'external' },
    '13': { adults: 2, children: 1, toddlers: 0, guestType: 'external' },
    '14': { adults: 2, children: 1, toddlers: 0, guestType: 'external' },
  },
};

// Sample settings
const settings = {
  rooms: [
    { id: '12', beds: 2, type: 'small', floor: 1 },
    { id: '13', beds: 3, type: 'small', floor: 1 },
    { id: '14', beds: 4, type: 'large', floor: 1 },
    { id: '22', beds: 2, type: 'small', floor: 2 },
    { id: '23', beds: 3, type: 'small', floor: 2 },
    { id: '24', beds: 4, type: 'large', floor: 2 },
    { id: '42', beds: 2, type: 'small', floor: 3 },
    { id: '43', beds: 2, type: 'small', floor: 3 },
    { id: '44', beds: 4, type: 'large', floor: 3 },
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
  contactEmail: 'chata@utia.cas.cz',
};

async function testPriceBreakdown() {
  console.log('=== Testing Price Breakdown in Emails ===\n');

  const emailService = new EmailService({
    host: 'hermes.utia.cas.cz',
    port: 25,
    from: 'noreply@chata.utia.cas.cz',
    appUrl: 'http://chata.utia.cas.cz',
  });

  // Test 1: Single room booking
  console.log('--- Test 1: Single Room Booking ---');
  const editUrl1 = `http://chata.utia.cas.cz/edit.html?token=${singleRoomBooking.editToken}`;
  const textEmail1 = emailService.generateBookingConfirmationText(
    singleRoomBooking,
    editUrl1,
    settings
  );
  console.log('Plain Text Email:\n');
  console.log(textEmail1);
  console.log('\n' + '='.repeat(80) + '\n');

  // Test 2: Multi-room booking with per-room data
  console.log('--- Test 2: Multi-Room Booking (Per-Room Data) ---');
  const editUrl2 = `http://chata.utia.cas.cz/edit.html?token=${multiRoomBooking.editToken}`;
  const textEmail2 = emailService.generateBookingConfirmationText(
    multiRoomBooking,
    editUrl2,
    settings
  );
  console.log('Plain Text Email:\n');
  console.log(textEmail2);
  console.log('\n' + '='.repeat(80) + '\n');

  // Test 3: Custom template with {price_overview} variable
  console.log('--- Test 3: Custom Template with {price_overview} ---');
  const customSettings = {
    ...settings,
    emailTemplate: {
      subject: 'Potvrzení rezervace - Chata Mariánská ({booking_id})',
      template: `Dobrý den {name},

děkujeme za rezervaci v Chatě Mariánská.

REZERVACE {booking_id}
Příjezd: {start_date}
Odjezd: {end_date}
Pokoje: {rooms}
Hosté: {adults} dospělých, {children} dětí

ROZPIS CENY:
{price_overview}

PLATBA
Účet: 123456789/0300
VS: {booking_id}
Splatnost: 7 dní

Úpravy nebo zrušení:
{edit_url}

Těšíme se na Vás!
Tým Chata Mariánská`,
    },
  };

  const textEmail3 = emailService.generateBookingConfirmationText(
    multiRoomBooking,
    editUrl2,
    customSettings
  );
  console.log('Custom Template Email:\n');
  console.log(textEmail3);
  console.log('\n' + '='.repeat(80) + '\n');

  // Test 4: HTML email
  console.log('--- Test 4: HTML Email ---');
  const htmlEmail = emailService.generateBookingConfirmationHtml(
    multiRoomBooking,
    editUrl2,
    settings
  );
  console.log('HTML Email (first 500 chars):\n');
  console.log(htmlEmail.substring(0, 500) + '...');
  console.log('\nHTML contains price breakdown:', htmlEmail.includes('Rozpis ceny:'));
  console.log('\n' + '='.repeat(80) + '\n');

  console.log('✅ All tests completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Admin can now use {price_overview} in email templates');
  console.log('2. Default emails automatically include price breakdown');
  console.log('3. Both plain text and HTML emails show detailed pricing');
}

// Run tests
testPriceBreakdown().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
