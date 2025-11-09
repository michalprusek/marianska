const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'bookings.db');
const db = new Database(dbPath, { readonly: true });

const bookingId = 'BKOYM48GR9MFUKX';

const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

console.log('\n=== BOOKING DATABASE RECORD ===');
console.log('Booking ID:', booking.id);
console.log('Total Price:', booking.total_price, 'Kč');
console.log('Start Date:', booking.start_date);
console.log('End Date:', booking.end_date);
console.log('Rooms:', booking.rooms);
console.log('Per Room Guests (raw):', booking.per_room_guests);

if (booking.per_room_guests) {
  try {
    const perRoomGuests = JSON.parse(booking.per_room_guests);
    console.log('\n=== PER ROOM GUESTS (parsed) ===');
    console.log(JSON.stringify(perRoomGuests, null, 2));
  } catch (e) {
    console.log('Failed to parse per_room_guests:', e.message);
  }
}

db.close();
