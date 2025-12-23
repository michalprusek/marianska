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

## Docker Build Instructions

**⚠️ POZOR: Aplikace běží v PRODUKCI!**

Při rebuildu NIKDY nemazat data:
- Databáze je v Docker volume `marianska_db-data`
- **NEPOUŽÍVAT** `--volumes` flag při prune (smaže produkční data!)

Bezpečný rebuild:
```bash
docker system prune -af
docker-compose build --no-cache web && docker-compose up -d web
```

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
