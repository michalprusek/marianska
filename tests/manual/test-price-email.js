#!/usr/bin/env node
/**
 * Test email price breakdown generation
 * Tests that prices are correctly displayed in email (no undefined values)
 */

const EmailService = require('./js/shared/emailService');

// Create email service
const emailService = new EmailService();

// Sample booking data with per-room pricing
const booking = {
  id: 'BK_TEST_123',
  name: 'Test User',
  email: 'test@example.com',
  phone: '+420123456789',
  startDate: '2025-11-20',
  endDate: '2025-11-22',
  rooms: ['13'],
  guestType: 'utia',
  adults: 2,
  children: 1,
  toddlers: 0,
  totalPrice: 750,
  editToken: 'TEST_TOKEN_123456',
  notes: 'Test booking',
};

// Sample settings with room-size based pricing (NEW MODEL 2025-11-10: only 'empty' field)
const settings = {
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
    { id: '12', beds: 2, type: 'small' },
    { id: '13', beds: 3, type: 'small' },
    { id: '14', beds: 4, type: 'large' },
    { id: '22', beds: 2, type: 'small' },
    { id: '23', beds: 3, type: 'small' },
    { id: '24', beds: 4, type: 'large' },
    { id: '42', beds: 2, type: 'small' },
    { id: '43', beds: 2, type: 'small' },
    { id: '44', beds: 4, type: 'large' },
  ],
  contactEmail: 'chata@utia.cas.cz',
};

console.log('=== Testing Email Price Breakdown ===\n');

// Generate price breakdown
const priceBreakdown = emailService.generatePriceBreakdown(booking, settings);

console.log('Price Breakdown:\n');
console.log(priceBreakdown);
console.log('\n');

// Check for undefined values
const hasUndefined = priceBreakdown.includes('undefined');
const hasNaN = priceBreakdown.includes('NaN');

if (hasUndefined || hasNaN) {
  console.error('❌ ERROR: Found undefined or NaN values in price breakdown!');
  process.exit(1);
} else {
  console.log('✅ SUCCESS: No undefined or NaN values found!');
}

// Generate full email text
console.log('\n=== Full Email Preview ===\n');
const editUrl = `http://chata.utia.cas.cz/edit.html?token=${booking.editToken}`;
const emailText = emailService.generateBookingConfirmationText(booking, editUrl, settings);

console.log(emailText);
console.log('\n');

// Check full email
const emailHasUndefined = emailText.includes('undefined');
const emailHasNaN = emailText.includes('NaN');

if (emailHasUndefined || emailHasNaN) {
  console.error('❌ ERROR: Found undefined or NaN values in full email!');
  process.exit(1);
} else {
  console.log('✅ SUCCESS: Full email looks good!');
}

console.log('\n=== Test Complete ===');
