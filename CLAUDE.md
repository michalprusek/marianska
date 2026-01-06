# CLAUDE.md - Mariánská Chata Development Guide

## Project Overview
**Rezervační systém Chata Mariánská** - booking/reservation system for a mountain cottage.

### Tech Stack
- **Backend:** Node.js (Express), SQLite database
- **Frontend:** Vanilla JS/CSS/HTML (no frameworks)
- **Deployment:** Docker + docker-compose, nginx reverse proxy

### Key Features
- Room booking with calendar visualization
- Admin panel for booking management
- Guest type pricing (UTIA members vs external)
- Email notifications for bookings
- Bulk booking (all rooms at once)

## Architecture

### Important Files
- `server.js` - Express API server, all endpoints
- `database.js` - SQLite database operations
- `data.js` - Client-side data manager with caching
- `js/admin/AdminBookings.js` - Admin panel booking management
- `js/booking-app.js` - Main booking flow application
- `js/shared/priceCalculator.js` - Price calculation logic (SSOT)

### Data Flow
1. Client → `dataManager` (data.js) → API → `server.js` → `database.js` → SQLite
2. Prices are calculated client-side using `PriceCalculator` class

## Pricing Model (SSOT - Single Source of Truth)

### Formula
```
price = empty_room_rate + (adult_rate * adults) + (child_rate * children)
```

### Guest Types
- **utia** - UTIA members (discounted rates)
- **external** - External guests (standard rates)

### Best Practices
1. **Always use PriceCalculator** - Never calculate prices manually
2. **Recalculate from settings** - Admin panel recalculates prices from current settings (SSOT)
3. **Per-room pricing** - Each room calculates its own price based on guests
4. **perRoomGuests structure** - Store guest counts per room:
   ```javascript
   perRoomGuests: {
     "12": { adults: 2, children: 1, toddlers: 0, guestType: "utia" }
   }
   ```

### Price Settings (in admin)
- `prices.utia.adults` - UTIA adult rate per night
- `prices.utia.children` - UTIA child rate per night
- `prices.utia.emptyRoom` - UTIA empty room base rate
- `prices.external.*` - Same structure for external guests

## ⚠️ KRITICKÉ: PRODUKČNÍ PROSTŘEDÍ

**APLIKACE BĚŽÍ V PRODUKCI S REÁLNÝMI DATY UŽIVATELŮ!**

### Ochrana dat - ABSOLUTNÍ PRIORITA
1. **NIKDY nemazat Docker volumes** - databáze je v `marianska_db-data`
2. **NIKDY nepoužívat** `--volumes` flag při prune
3. **VŽDY vytvořit backup před deploy** (viz níže)
4. **NIKDY nepouštět destruktivní SQL** bez WHERE klauzule

### Email Queue System (2026-01-06)
- Emaily se ukládají do perzistentní fronty (`email_queue` tabulka)
- **Deduplikace**: Stejný email (booking + typ + příjemce + den) = 1 záznam
- **Při rebuildu se NEposílají duplicitní emaily** - už odeslané mají status 'sent'
- Background worker zpracovává frontu každých 30s
- 5 pokusů s exponenciálním backoff (1, 5, 15, 30 min)

### Bezpečný Deploy Postup

```bash
# 1. VŽDY nejprve backup databáze
docker exec marianska-chata node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/data/bookings.db', { readonly: true });
console.log('Integrity:', db.pragma('integrity_check'));
const bookings = db.prepare('SELECT COUNT(*) as count FROM bookings').get();
console.log('Bookings:', bookings.count);
db.close();
"

# 2. Stáhnout backup lokálně (pro jistotu)
docker cp marianska-chata:/app/data/bookings.db ./backup-$(date +%Y%m%d-%H%M%S).db

# 3. Build bez mazání volumes
docker-compose build --no-cache web

# 4. Deploy s minimálním downtime
docker-compose up -d web

# 5. Ověřit že aplikace běží
docker-compose ps
docker-compose logs --tail=20 web
```

### Co NIKDY nedělat
- `docker-compose down -v` (smaže volumes!)
- `docker system prune --volumes` (smaže DB!)
- Mazat soubory v `/app/data/` uvnitř kontejneru
- Spouštět DELETE bez WHERE
- Ručně měnit databázi bez backupu

### Automatické zálohy
- Denní backup v 00:00 do `/app/backups/`
- Uchovává se posledních 3 dny
- Při startu se ověřuje integrita databáze

## Booking Structure

### Single Room Booking
Each reservation = one room, one date range. Do NOT consolidate multiple bookings.

### Key Fields
```javascript
{
  id: "booking-uuid",
  name: "Guest Name",
  email: "guest@email.com",
  phone: "+420...",
  rooms: ["12"],           // Array of room IDs
  startDate: "2025-01-01", // YYYY-MM-DD
  endDate: "2025-01-05",
  guestType: "utia",       // or "external"
  adults: 2,
  children: 1,
  toddlers: 0,
  totalPrice: 5000,
  paid: false,
  payFromBenefit: false,
  perRoomDates: { ... },   // Per-room date ranges
  perRoomGuests: { ... },  // Per-room guest counts
  guestNames: [...]        // Array of guest name objects
}
```

## Admin Panel

### Sorting
- Table columns are sortable (click header)
- Sort state persists in localStorage (`adminBookingsSort`)

### Inline Editing
- Fields can be edited inline in detail modal
- Changes trigger `loadBookings()` to refresh list

## Code Conventions

### Date Format
Always use `YYYY-MM-DD` format for dates in code and API.

### Comments
Use dated comments for fixes: `// FIX 2025-12-06: description`

### Error Handling
- Show user-friendly messages via `showErrorMessage()` / `showSuccessMessage()`
- Log technical details to console
