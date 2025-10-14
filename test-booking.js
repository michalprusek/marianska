// Test script to verify multi-room booking functionality
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'bookings.db');
const db = new sqlite3.Database(dbPath);

console.log('=== Testing Multi-Room Booking Functionality ===\n');

// Check recent bookings
db.all(
  `SELECT
    b.id,
    b.start_date,
    b.end_date,
    GROUP_CONCAT(br.room_id) AS rooms,
    b.adults,
    b.children,
    b.created_at
  FROM bookings b
  LEFT JOIN booking_rooms br ON b.id = br.booking_id
  GROUP BY b.id
  ORDER BY b.created_at DESC
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
        console.log(`   Rooms: ${row.rooms || ''}`);
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
      FROM guest_names
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
            pb.proposal_id,
            GROUP_CONCAT(pbr.room_id) AS rooms,
            pb.start_date,
            pb.end_date,
            pb.session_id,
            pb.created_at
          FROM proposed_bookings pb
          LEFT JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
          WHERE datetime(pb.expires_at) > datetime('now')
          GROUP BY pb.proposal_id
          ORDER BY pb.created_at DESC`,
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
                console.log(`\n${index + 1}. Proposal ID: ${row.proposal_id}`);
                console.log(`   Rooms: ${row.rooms || ''}`);
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
