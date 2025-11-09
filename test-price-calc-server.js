const PriceCalculator = require('./js/shared/priceCalculator.js');
const DatabaseManager = require('./database.js');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'bookings.db');
const db = new DatabaseManager(dbPath);

// Get booking
const bookingId = 'BKOYM48GR9MFUKX';
const booking = db.getBooking(bookingId);

// Get settings
const settings = db.getSettings();

console.log('\n=== BOOKING DATA ===');
console.log('Booking ID:', booking.id);
console.log('Rooms:', booking.rooms);
console.log('Start Date:', booking.startDate);
console.log('End Date:', booking.endDate);
console.log('Guest Names:', booking.guestNames);
console.log('Per Room Guests:', booking.perRoomGuests);

const guestNames = booking.guestNames || [];
const perRoomGuests = booking.perRoomGuests || {};
const rooms = booking.rooms || [];

console.log('\n=== PARSED DATA ===');
console.log('Rooms array:', rooms);
console.log('Guest names count:', guestNames.length);
console.log('Per Room Guests:', JSON.stringify(perRoomGuests, null, 2));

// Calculate nights
const startDate = new Date(booking.startDate);
const endDate = new Date(booking.endDate);
const nights = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));

console.log('\n=== PRICE CALCULATION INPUTS ===');
console.log('Nights:', nights);
console.log('Settings prices:', JSON.stringify(settings.prices, null, 2));

// Determine fallback guest type (same logic as server.js:714-720)
const hasUtiaGuest = guestNames && Array.isArray(guestNames)
  ? guestNames.some(guest => guest.guestPriceType === 'utia')
  : false;
const fallbackGuestType = hasUtiaGuest ? 'utia' : 'external';

console.log('\n=== GUEST TYPE DETERMINATION ===');
console.log('Has ÚTIA guest?', hasUtiaGuest);
console.log('Fallback guest type:', fallbackGuestType);

console.log('\n=== RUNNING PRICE CALCULATOR ===');
const calculatedPrice = PriceCalculator.calculatePerGuestPrice({
  rooms,
  guestNames,
  perRoomGuests,
  nights,
  settings,
  fallbackGuestType,
});

console.log('\n=== RESULTS ===');
console.log('Calculated price:', calculatedPrice, 'Kč');
console.log('Stored price (DB):', booking.totalPrice, 'Kč');
console.log('Match:', calculatedPrice === booking.totalPrice ? '✅ YES' : '❌ NO');

db.close();
