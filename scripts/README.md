# Migration Scripts

This directory contains database migration scripts for the Chata Mariánská booking system.

## Available Scripts

### `migrate-guest-names.js`

**Purpose:** Adds guest names to existing bookings that don't have any.

**What it does:**
- Scans all bookings in the database
- Identifies bookings without guest names
- Generates random Czech first and last names for each guest
- Matches the number of adults and children in each booking
- Inserts the generated names into the `guest_names` table

**Usage:**

```bash
# Run the migration
node scripts/migrate-guest-names.js
```

**Important Notes:**
- ⚠️ This script modifies the database
- It adds random Czech names (e.g., "Jan Novák", "Marie Dvořáková")
- Names are generated separately for adults and children
- The script has a 5-second countdown before executing (press Ctrl+C to cancel)
- Bookings with 0 guests (adults + children = 0) are skipped
- Bookings that already have guest names are not modified

**Example Output:**

```
============================================================
Guest Names Migration Script
============================================================

📂 Connecting to database: /home/marianska/marianska/data/bookings.db
✅ Database connected successfully

📊 Found 15 total bookings
🔍 Bookings needing migration: 12

⚠️  WARNING: This will add random Czech names to existing bookings.
   This operation cannot be easily undone.

Press Ctrl+C to cancel, or wait 5 seconds to continue...

🚀 Starting migration...

📝 Migrating booking BK1234567890ABC:
   - Adults: 2, Children: 1
   ✅ Added 3 guest names
   👥 Names: Jan Novák, Marie Nováková, Jakub Novák

...

============================================================
Migration Summary
============================================================
✅ Successfully migrated: 12 bookings
❌ Failed: 0 bookings
📊 Total processed: 12 bookings

✅ Migration completed!
```

**Data Generation:**

The script uses authentic Czech names:

- **Adults:** Mix of common male and female Czech first names (e.g., Jan, Petr, Marie, Eva)
- **Children:** Common Czech children's names (e.g., Jakub, Tereza, Adam, Anna)
- **Last names:** Common Czech surnames with proper feminine forms (e.g., Novák → Nováková for females)

**Database Schema:**

The script inserts data into the `guest_names` table:

```sql
CREATE TABLE IF NOT EXISTS guest_names (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL,
  person_type TEXT NOT NULL CHECK(person_type IN ('adult', 'child')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  UNIQUE(booking_id, person_type, first_name, last_name)
);
```

## Safety Features

- **Countdown:** 5-second delay before execution allows cancellation
- **Idempotent:** Only processes bookings without guest names (safe to run multiple times)
- **Transaction safety:** Uses database transactions for data integrity
- **Error handling:** Continues processing even if individual bookings fail
- **Detailed logging:** Shows progress and errors for each booking

## Rollback

If you need to undo the migration:

```sql
-- Remove all generated guest names
DELETE FROM guest_names;

-- Or remove guest names for specific bookings
DELETE FROM guest_names WHERE booking_id = 'BK1234567890ABC';
```

## Development

The migration script exports helper functions for testing:

```javascript
const { generateCzechName, generateGuestNames } = require('./scripts/migrate-guest-names.js');

// Generate a single name
const adultName = generateCzechName('adult', 'male');
// { firstName: 'Jan', lastName: 'Novák' }

// Generate names for a booking
const names = generateGuestNames(2, 1); // 2 adults, 1 child
// [
//   { personType: 'adult', firstName: 'Jan', lastName: 'Novák' },
//   { personType: 'adult', firstName: 'Marie', lastName: 'Nováková' },
//   { personType: 'child', firstName: 'Jakub', lastName: 'Novák' }
// ]
```
