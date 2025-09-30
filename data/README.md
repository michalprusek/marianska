# Data Directory

This directory contains the SQLite database for the booking system.

## Files

- `bookings.db` - SQLite database (auto-created on first run)
- `*.db-shm`, `*.db-wal` - SQLite temporary files (WAL mode)

## Important Notes

⚠️ **Database files are NOT tracked in git** for security and to prevent conflicts.

### First Run

The database will be automatically created when you start the server:

```bash
npm start
```

### Data Migration

If a `bookings.json` file exists, it will be automatically migrated to SQLite on first run and backed up as `bookings.json.migrated-{timestamp}`.

### Backup Strategy

To backup your database:

```bash
# Manual backup
cp data/bookings.db data/bookings.backup-$(date +%Y%m%d).db

# Or use SQLite command
sqlite3 data/bookings.db ".backup data/bookings.backup-$(date +%Y%m%d).db"
```

### Database Schema

The database uses WAL (Write-Ahead Logging) mode for better concurrency:

- **bookings** - Main booking information
- **booking_rooms** - Many-to-many relationship between bookings and rooms
- **blocked_dates** - Date blockages for maintenance
- **christmas_periods** - Christmas period definitions
- **christmas_codes** - Access codes for Christmas bookings
- **settings** - System settings
- **proposed_bookings** - Temporary bookings (15min TTL)

### Development

For development, you can inspect the database:

```bash
sqlite3 data/bookings.db
```

Common queries:

```sql
-- List all tables
.tables

-- Show schema
.schema bookings

-- Count bookings
SELECT COUNT(*) FROM bookings;

-- List recent bookings
SELECT id, name, email, start_date, end_date FROM bookings
ORDER BY created_at DESC LIMIT 10;
```

### Production

In production:
1. Set up automated backups (daily recommended)
2. Monitor database file size
3. Consider log rotation for WAL files
4. Ensure proper file permissions (600)

```bash
chmod 600 data/bookings.db
```