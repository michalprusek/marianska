// Test script to verify multi-room booking functionality
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'bookings.db');
const db = new sqlite3.Database(dbPath);

console.log('=== Testing Multi-Room Booking Functionality ===\n');

// Check recent bookings
db.all(
  `SELECT
    id,
    start_date,
    end_date,
    rooms,
    adults,
    children,
    created_at
  FROM bookings
  ORDER BY created_at DESC
  LIMIT 10`,
  (err, rows) => {
    if (err) {
      console.error('Error querying bookings:', err);
      return;
    }

    console.log('Recent Bookings:');
    console.log('================');

    if (rows.length === 0) {
      console.log('No bookings found.');
    } else {
      rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Booking ID: ${row.id}`);
        console.log(`   Dates: ${row.start_date} to ${row.end_date}`);
        console.log(`   Rooms: ${row.rooms}`);
        console.log(`   Guests: ${row.adults} adults, ${row.children} children`);
        console.log(`   Created: ${row.created_at}`);
      });
    }

    // Check for guest names
    console.log('\n\n=== Checking Guest Names ===');
    db.all(
      `SELECT
        booking_id,
        COUNT(*) as name_count
      FROM booking_guest_names
      GROUP BY booking_id
      ORDER BY booking_id DESC
      LIMIT 10`,
      (err2, guestRows) => {
        if (err2) {
          console.error('Error querying guest names:', err2);
          db.close();
          return;
        }

        if (guestRows.length === 0) {
          console.log('No guest names found.');
        } else {
          console.log('\nGuest Names Count by Booking:');
          guestRows.forEach((row) => {
            console.log(`  Booking ${row.booking_id}: ${row.name_count} guests`);
          });
        }

        // Check proposed bookings
        console.log('\n\n=== Active Proposed Bookings ===');
        db.all(
          `SELECT
            id,
            room_id,
            start_date,
            end_date,
            session_id,
            created_at
          FROM proposed_bookings
          WHERE datetime(expires_at) > datetime('now')
          ORDER BY created_at DESC`,
          (err3, proposedRows) => {
            if (err3) {
              console.error('Error querying proposed bookings:', err3);
              db.close();
              return;
            }

            if (proposedRows.length === 0) {
              console.log('No active proposed bookings.');
            } else {
              console.log('\nActive Proposals:');
              proposedRows.forEach((row, index) => {
                console.log(`\n${index + 1}. Proposal ID: ${row.id}`);
                console.log(`   Room: ${row.room_id}`);
                console.log(`   Dates: ${row.start_date} to ${row.end_date}`);
                console.log(`   Session: ${row.session_id}`);
                console.log(`   Created: ${row.created_at}`);
              });
            }

            db.close();
            console.log('\n=== Test Complete ===');
          }
        );
      }
    );
  }
);
