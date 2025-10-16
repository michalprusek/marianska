# Proposed Bookings System - Complete Analysis

## Overview

The Mariánská booking application implements a **proposed bookings system** to prevent race conditions during the booking process. Proposed bookings are temporary reservations that block room availability for 15 minutes while a user fills out the booking form, preventing other users from booking the same rooms during that time window.

---

## 1. WHERE PROPOSED BOOKINGS ARE CREATED

### 1.1 Client-Side Creation

**File**: `/js/booking-form.js` and `/js/shared/BaseCalendar.js`

When a user selects dates and rooms in the calendar:

1. **Date/Room Selection Trigger**:
   - User clicks on dates and rooms in the calendar (BaseCalendar component)
   - Selected dates/rooms stored in `app.selectedDates` and `app.selectedRooms` sets
   - User clicks "Book Now" or "Confirm" button

2. **Proposed Booking Creation** (in BaseCalendar.js):

   ```javascript
   // When user confirms date/room selection
   const proposalId = await dataManager.createProposedBooking(
     startDate,
     endDate,
     rooms,
     guests, // { adults, children, toddlers }
     guestType, // 'utia' or 'external'
     totalPrice
   );
   ```

3. **Where It Happens**:
   - Single room booking: User selects room → calendar triggers proposed booking creation
   - Bulk booking: User selects date range → proposed booking created for all 9 rooms
   - Multi-room: Each room selection triggers separate proposed booking

### 1.2 Server-Side Creation

**File**: `/server.js` (endpoint at lines 1926-1945)

```javascript
// POST /api/proposed-booking
app.post('/api/proposed-booking', (req, res) => {
  const { sessionId, startDate, endDate, rooms } = req.body;

  // Delete any existing proposals for this session (one per session at a time)
  db.deleteProposedBookingsBySession(sessionId);

  // Create new proposed booking
  const proposalId = db.createProposedBooking(sessionId, startDate, endDate, rooms);

  return res.json({ success: true, proposalId });
});
```

**Also supports fuller data** (lines 1968-1990):

```javascript
// POST /api/proposed-bookings (plural - full data)
app.post('/api/proposed-bookings', writeLimiter, (req, res) => {
  const { sessionId, startDate, endDate, rooms, guests, guestType, totalPrice } = req.body;

  const proposalId = db.createProposedBooking(
    sessionId,
    startDate,
    endDate,
    rooms,
    guests || {},
    guestType || 'external',
    totalPrice || 0
  );
  return res.json({ success: true, proposalId });
});
```

### 1.3 Database Storage

**File**: `/database.js` (lines 1580-1621)

```javascript
createProposedBooking(
  sessionId,
  startDate,
  endDate,
  rooms,
  guests = {},
  guestType = 'external',
  totalPrice = 0
) {
  const proposalId = this.generateProposalId();    // PROP + random string
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // +15 minutes

  const transaction = this.db.transaction(() => {
    // Insert into proposed_bookings table
    this.statements.insertProposedBooking.run(
      proposalId,
      sessionId,
      startDate,
      endDate,
      now,
      expiresAt,     // CRITICAL: Expires in 15 minutes
      adults,
      children,
      toddlers,
      guestType,
      totalPrice
    );

    // Insert room associations
    for (const roomId of rooms) {
      this.statements.insertProposedBookingRoom.run(proposalId, roomId);
    }
  });

  transaction();
  return proposalId;
}
```

**Database Schema** (lines 172-187):

```sql
CREATE TABLE IF NOT EXISTS proposed_bookings (
    proposal_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,              -- CRITICAL: Expiration timestamp
    adults INTEGER DEFAULT 0,
    children INTEGER DEFAULT 0,
    toddlers INTEGER DEFAULT 0,
    guest_type TEXT DEFAULT 'external',
    total_price INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS proposed_booking_rooms (
    proposal_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    FOREIGN KEY (proposal_id) REFERENCES proposed_bookings(proposal_id) ON DELETE CASCADE,
    PRIMARY KEY (proposal_id, room_id)
);
```

---

## 2. HOW THE 15-MINUTE EXPIRATION WORKS

### 2.1 Expiration Time Calculation

**When Created** (database.js, line 1591):

```javascript
const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
// Adds 900,000 milliseconds (15 minutes) to current time
// Example: 2025-10-16T14:30:00Z → 2025-10-16T14:45:00Z
```

### 2.2 Expiration Logic in Availability Checks

**File**: `/database.js` (lines 1326-1441, method `getRoomAvailability`)

When checking if a room is available, the system queries proposed bookings:

```javascript
// Check for proposed bookings (excluding current session)
const now = new Date().toISOString(); // Current time in ISO format

const proposedQuery = excludeSessionId
  ? `
    SELECT pb.* FROM proposed_bookings pb
    JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
    WHERE pbr.room_id = ?
    AND ? >= pb.start_date AND ? <= pb.end_date
    AND pb.expires_at > ?                    -- CRITICAL: Only active proposals
    AND pb.session_id != ?
  `
  : `
    SELECT pb.* FROM proposed_bookings pb
    JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
    WHERE pbr.room_id = ?
    AND ? >= pb.start_date AND ? <= pb.end_date
    AND pb.expires_at > ?                    -- CRITICAL: Only active proposals
  `;

const proposedBookings = this.db.prepare(proposedQuery).all(
  roomId,
  date,
  date,
  now, // Current timestamp
  excludeSessionId
);

if (proposedBookings.length > 0) {
  return {
    available: false,
    status: 'proposed',
    reason: 'proposed',
    proposal: proposedBookings[0],
  };
}
```

**Key Point**: The `expires_at > ?` check ensures only non-expired proposals block availability.

### 2.3 Client-Side Expiration Check

**File**: `/data.js` (lines 564-583)

```javascript
// Get proposed bookings with same expiration logic
try {
  const proposedBookings = await this.getProposedBookings();

  const hasProposedBooking = proposedBookings.some(
    (pb) =>
      pb.rooms.includes(roomId) &&
      checkDateStr >= pb.start_date &&
      checkDateStr <= pb.end_date && // INCLUSIVE end date
      (sessionToExclude === '' || pb.session_id !== sessionToExclude)
  );

  if (hasProposedBooking) {
    return { status: 'proposed', email: null };
  }
} catch (error) {
  console.error('Failed to check proposed bookings:', error);
}
```

Note: Client-side doesn't check expiration time (server is source of truth).

### 2.4 Automatic Cleanup Interval

**File**: `/server.js` (lines 2018-2028)

```javascript
// Cleanup expired proposed bookings (run every minute)
setInterval(() => {
  try {
    const result = db.deleteExpiredProposedBookings();
    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} expired proposed bookings`);
    }
  } catch (error) {
    logger.error('cleaning up expired proposed bookings:', error);
  }
}, 60000); // Run every 60 seconds (1 minute)
```

**Cleanup Implementation** (database.js, lines 1627-1630):

```javascript
deleteExpiredProposedBookings() {
  const now = new Date().toISOString();
  return this.statements.deleteExpiredProposedBookings.run(now);
}

// SQL Statement (line 476-478):
deleteExpiredProposedBookings: this.db.prepare(
  'DELETE FROM proposed_bookings WHERE expires_at < ?'
),
```

---

## 3. WHERE PROPOSED BOOKINGS ARE DISPLAYED IN THE UI

### 3.1 Calendar Visual Indication

**File**: `/js/shared/BaseCalendar.js`

When rendering calendar cells:

```javascript
// Check room availability (which includes proposed bookings)
const availability = await dataManager.getRoomAvailability(date, roomId);

// Display status based on availability
if (availability.status === 'proposed') {
  // Mark cell as YELLOW (proposed)
  cell.style.backgroundColor = '#eab308'; // Yellow
  cell.style.opacity = '0.7';
  cell.title = 'Navržená rezervace - čeká na potvrzení'; // Proposed - waiting for confirmation
}
```

**Visual States**:

- **Green**: Available (no proposed bookings)
- **Yellow**: Proposed (temporary hold by another user)
- **Red**: Occupied (confirmed booking)
- **Gray**: Blocked (administrative blockage)
- **Orange**: Edge (one side occupied)

### 3.2 Room Detail Tooltip

When hovering over a cell with proposed booking:

```
"Navržená rezervace - čeká na potvrzení"
(Proposed reservation - waiting for confirmation)
```

### 3.3 Temporary Reservations Section

**File**: `/js/booking-app.js`

When user is in the booking flow:

```javascript
// Display temporary reservations that will become permanent bookings
async displayTempReservations() {
  const tempContainer = document.getElementById('tempReservationsContainer');

  // Show list of selected rooms/dates (visual preview before finalization)
  for (const tempReservation of this.tempReservations) {
    // Display as "pending" bookings in the UI
    // Shows selected dates, rooms, and guest counts
  }
}
```

### 3.4 Admin Panel (if visible)

Proposed bookings are NOT directly shown in the admin panel. They only affect:

- Calendar availability display
- Conflict detection during new booking creation

---

## 4. CLEANUP AND DELETION OF EXPIRED PROPOSED BOOKINGS

### 4.1 Automatic Cleanup (Server-Side)

**Trigger**: Every 60 seconds (1 minute)

**Files**:

- `/server.js` lines 2018-2028 (cleanup interval)
- `/database.js` lines 1627-1630 (cleanup method)

**What Happens**:

```
Current Time: 2025-10-16 14:32:00
Proposed Booking Created: 2025-10-16 14:30:00
Proposed Booking Expires: 2025-10-16 14:45:00

→ At 14:45:01 (or next cleanup interval):
  DELETE FROM proposed_bookings WHERE expires_at < '2025-10-16 14:45:01'
  → This proposed booking is deleted
```

### 4.2 Manual Deletion (User Completes Booking)

**File**: `/js/booking-form.js` (lines 524-541)

When user finalizes the booking:

```javascript
// Delete proposed bookings from database
const deletePromises = this.app.tempReservations
  .filter((tempReservation) => tempReservation.proposalId)
  .map(async (tempReservation) => {
    try {
      await dataManager.deleteProposedBooking(tempReservation.proposalId);
      // POST /api/proposed-booking/:proposalId (DELETE)
    } catch (error) {
      console.error('Failed to delete proposed booking:', error);
    }
  });
await Promise.all(deletePromises);

// Clear all session proposed bookings (in case any were missed)
try {
  await dataManager.clearSessionProposedBookings();
  // DELETE /api/proposed-bookings/session/:sessionId
} catch (error) {
  console.error('Failed to clear session proposed bookings:', error);
}
```

### 4.3 Manual Deletion (Cancel Before Booking)

**File**: `/data.js` (lines 1148-1175)

```javascript
async deleteProposedBooking(proposalId) {
  try {
    const response = await fetch(`${this.apiUrl}/proposed-booking/${proposalId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      if (this.proposalId === proposalId) {
        this.proposalId = null;
      }

      // Update local cache
      if (this.proposedBookingsCache && Array.isArray(this.proposedBookingsCache)) {
        this.proposedBookingsCache = this.proposedBookingsCache.filter(
          (pb) => pb.proposal_id !== proposalId
        );
      }

      return true;
    }
  } catch (error) {
    console.error('Error deleting proposed booking:', error);
  }
  return false;
}
```

### 4.4 Deletion Endpoints (Server)

**File**: `/server.js`

```javascript
// Delete specific proposed booking (lines 1992-2003)
app.delete('/api/proposed-booking/:proposalId', writeLimiter, (req, res) => {
  const { proposalId } = req.params;
  db.deleteProposedBooking(proposalId);
  return res.json({ success: true });
});

// Delete all proposed bookings for a session (lines 2005-2016)
app.delete('/api/proposed-bookings/session/:sessionId', writeLimiter, (req, res) => {
  const { sessionId } = req.params;
  db.deleteProposedBookingsBySession(sessionId);
  return res.json({ success: true });
});
```

---

## 5. CALENDAR REFRESH AFTER PROPOSED BOOKING CHANGES

### 5.1 When Calendar Refreshes

**Triggers**:

1. **User creates proposed booking** → calendar re-renders immediately
2. **User deletes proposed booking** → calendar re-renders immediately
3. **Another user's proposed booking expires** → calendar refresh at next sync (every 30 seconds)
4. **User confirms booking** → calendar re-renders immediately
5. **Server data syncs** → calendar may refresh (debounced, max once per 10 seconds)

### 5.2 Client-Side Refresh Mechanism

**File**: `/data.js` (lines 115-170)

```javascript
async syncWithServer(forceRefresh = false) {
  try {
    const response = await fetch(`${this.apiUrl}/data`);
    if (response.ok) {
      const serverData = await response.json();

      if (forceRefresh) {
        // Force refresh - update immediately
        this.cachedData = serverData;
        localStorage.setItem(this.storageKey, JSON.stringify(this.cachedData));

        // Trigger UI update
        if (window.app) {
          await window.app.renderCalendar();          // Re-render calendar
          await window.app.updatePriceCalculation();  // Update prices
        }
      } else {
        // Check if server has newer data
        const serverTimestamp = this.getLatestTimestamp(serverData);
        const localTimestamp = this.getLatestTimestamp(this.cachedData);

        if (serverTimestamp > localTimestamp) {
          this.cachedData = serverData;
          localStorage.setItem(this.storageKey, JSON.stringify(this.cachedData));

          // Debounce calendar re-renders
          const now = Date.now();
          if (window.app && !this.renderPending && now - this.lastRender > 10000) {
            this.renderPending = true;
            setTimeout(async () => {
              this.renderPending = false;
              this.lastRender = Date.now();
              await window.app.renderCalendar();
              await window.app.updatePriceCalculation();
            }, 1000);
          }
        }
      }
    }
  } catch {
    // Silently fail sync
  }
}
```

### 5.3 Proposed Bookings Cache

**File**: `/data.js` (lines 1050-1088)

```javascript
getProposedBookings() {
  const now = Date.now();

  // Return cached data if still valid (30 seconds)
  if (
    this.proposedBookingsCache &&
    this.proposedBookingsCacheTime &&
    now - this.proposedBookingsCacheTime < this.proposedBookingsCacheDuration  // 30 seconds
  ) {
    return this.proposedBookingsCache;
  }

  // If a fetch is already in progress, wait for it
  if (this.proposedBookingsFetchPromise) {
    return this.proposedBookingsFetchPromise;
  }

  // Fetch fresh data
  this.proposedBookingsFetchPromise = (async () => {
    try {
      const response = await fetch(`${this.apiUrl}/proposed-bookings`);
      if (response.ok) {
        this.proposedBookingsCache = await response.json();
        this.proposedBookingsCacheTime = Date.now();
        return this.proposedBookingsCache;
      }
    } catch (error) {
      console.error('Error fetching proposed bookings:', error);
    } finally {
      this.proposedBookingsFetchPromise = null;
    }

    return this.proposedBookingsCache || [];
  })();

  return this.proposedBookingsFetchPromise;
}

// Invalidate cache when needed
invalidateProposedBookingsCache() {
  this.proposedBookingsCache = null;
  this.proposedBookingsCacheTime = null;
}
```

### 5.4 Auto-Sync Interval

**File**: `/data.js` (lines 96-113)

```javascript
startAutoSync() {
  if (this.syncInterval) {
    clearInterval(this.syncInterval);
  }

  // Sync every 30 seconds
  this.syncInterval = setInterval(async () => {
    await this.syncWithServer();
  }, 30000);  // 30 second sync interval

  // Also sync on visibility change (when user returns to tab)
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      await this.syncWithServer();
    }
  });
}
```

### 5.5 Debouncing Logic

**Problem**: Prevent excessive calendar re-renders when multiple proposed bookings change

**Solution** (data.js, lines 146-155):

```javascript
// Only render if:
// 1. No render already pending AND
// 2. At least 10 seconds since last render

if (window.app && !this.renderPending && now - this.lastRender > 10000) {
  this.renderPending = true;

  // Delay render by 1 second to batch multiple sync events
  setTimeout(async () => {
    this.renderPending = false;
    this.lastRender = Date.now();
    await window.app.renderCalendar();
    await window.app.updatePriceCalculation();
  }, 1000);
}
```

**Timeline**:

```
14:30:00 - User selects date/room → proposed booking created → calendar renders
14:30:05 - Another user's booking expires → sync detects change
          → renderPending = true, calendars doesn't re-render
14:30:06 - Batched render executes (after 1 second delay)
          → renderPending = false, lastRender = 14:30:06
14:30:20 - (10+ seconds later) Next sync triggers
          → Can render again if data changed
```

---

## 6. COMPLETE FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER STARTS BOOKING                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  User Selects Dates & Rooms in Calendar                          │
│  • Dates stored in app.selectedDates (Set)                       │
│  • Rooms stored in app.selectedRooms (Set)                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  "Confirm Selection" / "Book Now" Button Clicked                │
│  → BaseCalendar.confirmDateSelection()                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT: Create Proposed Booking                                 │
│  dataManager.createProposedBooking(                              │
│    startDate, endDate, rooms, guests, guestType, totalPrice      │
│  )                                                                │
│  ↓                                                               │
│  POST /api/proposed-bookings                                     │
│  └→ sessionId (from dataManager.sessionId)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  SERVER: Database Creates Proposed Booking                       │
│  • proposal_id = "PROP1a2b3c4d5"                                │
│  • session_id = "SESS..."                                        │
│  • expires_at = NOW + 15 minutes                                 │
│  • Insert into proposed_bookings table                           │
│  • Insert room associations into proposed_booking_rooms table   │
│  ↓                                                               │
│  Return: { success: true, proposalId: "PROP1a2b3c4d5" }        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT: Calendar Re-renders (YELLOW cells for proposed rooms)   │
│  • Color change: Green → Yellow                                  │
│  • Prevents other users from selecting these rooms              │
│  • Other users see: "Proposed - waiting for confirmation"       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
         ┌────────────────────┴──────────────────┐
         ↓                                       ↓
    USER COMPLETES              USER CANCELS OR LEAVES
    BOOKING FORM                (15 min timeout)
         ↓                                       ↓
    ┌────────────┐                    ┌──────────────┐
    │ Finalizes  │                    │  Automatic   │
    │ Booking    │                    │  Cleanup     │
    │ (Submit)   │                    │  (Every 1m)  │
    └────┬───────┘                    └──────┬───────┘
         ↓                                    ↓
    ┌────────────────────────────────────────────────────────┐
    │  DELETE Proposed Booking                               │
    │  • dataManager.deleteProposedBooking(proposalId)        │
    │  • DELETE /api/proposed-booking/:proposalId             │
    │  • db.deleteProposedBooking(proposalId)                │
    │  • Removes from proposed_bookings table                │
    └────┬───────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────────────────┐
    │  Create PERMANENT Booking                              │
    │  • If completing: POST /api/booking                    │
    │  • Creates booking record with confirmed status        │
    │                                                         │
    │  If not completing: Nothing (proposed booking deleted) │
    └────┬───────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────────────────┐
    │  Calendar Re-renders                                   │
    │  • YELLOW → RED (for confirmed booking)               │
    │  • YELLOW → GREEN (if user cancelled)                 │
    │  • Color now reflects final state                      │
    └────────────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────────────────┐
    │  Other Users See Updated Calendar                      │
    │  • Next sync (every 30s): Calendar refreshes           │
    │  • Proposed room now shows: Red (booked) or Green      │
    └────────────────────────────────────────────────────────┘
```

---

## 7. KEY ARCHITECTURAL DETAILS

### 7.1 Session Isolation

**Critical**: One proposed booking per session at a time

```javascript
// When creating new proposed booking:
db.deleteProposedBookingsBySession(sessionId);  // Delete old ones
db.createProposedBooking(sessionId, ...);       // Create new one
```

**Why?**: If user selects different dates/rooms, old proposal is removed before creating new one.

### 7.2 Database-Backed Persistence

**Advantage**: Survives server restarts (unlike in-memory storage)

- Proposed bookings stored in SQLite database
- Survives across browser sessions/restarts
- All instances of the app see the same proposed bookings

### 7.3 Inclusive Date Model

**Critical**: Proposed bookings block CHECKOUT DAY (inclusive end date)

```javascript
// A proposed booking from 2025-10-06 to 2025-10-08 blocks:
// - All of 2025-10-06 (check-in day)
// - All of 2025-10-07 (middle day)
// - All of 2025-10-08 (check-out day) ← INCLUDED!

checkDateStr >= pb.start_date && checkDateStr <= pb.end_date; // Inclusive
```

### 7.4 Debounced Calendar Refresh

**Why?**: Prevent 60+ calendar re-renders per second when multiple proposed bookings expire

- Max 1 refresh per 10 seconds
- Batches multiple changes into single render
- Uses pending flag + timestamp throttling

### 7.5 Race Condition Prevention

**Timeline**:

```
User A: Selects room 12 on 2025-10-06
  → Creates proposed booking A
  → Room 12 blocked (YELLOW)

User B: Tries to select room 12 on 2025-10-06
  → Server checks availability
  → Proposed booking A is NOT expired (< expires_at)
  → Status = 'proposed'
  → Room marked as unavailable (YELLOW)
  → User B cannot complete booking for room 12

User A: Completes booking within 15 minutes
  → Proposed booking A deleted
  → Permanent booking created
  → Room 12 marked as RED (occupied)

OR

User A: Doesn't complete within 15 minutes
  → Proposed booking A auto-deleted (after 14:45)
  → Room 12 reverts to GREEN
  → User B can now book
```

---

## 8. MONITORING AND DEBUGGING

### 8.1 Server Logs

Check for cleanup and creation:

```
logger.info(`Cleaned up ${result.changes} expired proposed bookings`);
logger.info('creating proposed booking:', error);
```

### 8.2 Database Query

View active proposed bookings:

```sql
SELECT
  proposal_id,
  session_id,
  start_date,
  end_date,
  expires_at,
  created_at,
  datetime('now') as current_time
FROM proposed_bookings
WHERE expires_at > datetime('now')
ORDER BY expires_at ASC;
```

### 8.3 Client-Side Debugging

```javascript
// Check proposed bookings cache
console.log('Proposed bookings:', dataManager.proposedBookingsCache);
console.log('Cache time:', dataManager.proposedBookingsCacheTime);
console.log('Cache valid:', Date.now() - dataManager.proposedBookingsCacheTime < 30000);
```

---

## 9. SUMMARY TABLE

| Component  | Location                       | Purpose                 | Duration                  |
| ---------- | ------------------------------ | ----------------------- | ------------------------- |
| Creation   | `createProposedBooking()`      | Temporary hold on rooms | 15 minutes                |
| Expiration | `expires_at` field             | Auto-cleanup timestamp  | SET at creation           |
| Cleanup    | Server interval every 60s      | Remove expired records  | Every minute              |
| Display    | Calendar YELLOW cells          | Visual indicator        | Until deletion/expiration |
| Refresh    | Every 30 seconds (client sync) | Update availability     | Continuously              |
| Check      | `getRoomAvailability()`        | Prevent double-booking  | Per request               |
| Deletion   | Manual on booking complete     | Convert to permanent    | On form submit            |

---

## 10. FLOW SUMMARY

1. **CREATE**: User selects dates/rooms → Proposed booking created (15-min expiration)
2. **DISPLAY**: Calendar shows YELLOW cells for proposed rooms
3. **CHECK**: Other users see rooms as unavailable (can't book)
4. **MAINTAIN**: Proposed booking active for 15 minutes
5. **REFRESH**: Calendar syncs every 30 seconds (debounced)
6. **CLEANUP**: Expired proposals auto-deleted every 1 minute
7. **CONVERSION**: User submits form → Proposed booking deleted → Permanent booking created
8. **REVERT**: If user abandons, proposed booking auto-expires after 15 minutes
