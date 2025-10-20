# Proposed Bookings System - Code Flow Analysis

## 1. CREATION FLOW (Detailed Code Paths)

### Step 1: User Selects Dates/Rooms in Calendar

```
File: /js/shared/BaseCalendar.js

User clicks on calendar dates/rooms
  ↓
BaseCalendar.handleDateSelect(dateStr)
  ↓
baseCalendar.app.selectedDates.add(dateStr)
baseCalendar.app.selectedRooms.add(roomId)
  ↓
Updates UI (shows selection visual feedback)
```

### Step 2: User Clicks "Confirm" Button

```
File: /js/shared/BaseCalendar.js OR /js/booking-form.js

User clicks "Book Now" or "Confirm Selection"
  ↓
BaseCalendar.confirmDateSelection()
  ↓
Calls: await dataManager.createProposedBooking(
         startDate,
         endDate,
         rooms,
         guests,
         guestType,
         totalPrice
       )
```

### Step 3: Client Creates Proposed Booking

```
File: /data.js (lines 1096-1146)

async createProposedBooking(
  startDate,
  endDate,
  rooms,
  guests = {},
  guestType = 'external',
  totalPrice = 0
) {
  try {
    const response = await fetch(`${this.apiUrl}/proposed-bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,      // ← CRITICAL: User's session ID
        startDate,
        endDate,
        rooms,
        guests,
        guestType,
        totalPrice,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      this.proposalId = data.proposalId;  // ← Store for later deletion

      // Update local cache
      if (this.proposedBookingsCache && Array.isArray(this.proposedBookingsCache)) {
        this.proposedBookingsCache.push({
          proposal_id: data.proposalId,
          session_id: this.sessionId,
          start_date: startDate,
          end_date: endDate,
          rooms,
          created_at: new Date().toISOString(),
        });
        this.proposedBookingsCacheTime = Date.now();
      }

      return data.proposalId;
    }
  } catch (error) {
    console.error('Error creating proposed booking:', error);
  }
  return null;
}
```

### Step 4: Server Receives & Processes

```
File: /server.js (lines 1968-1990)

app.post('/api/proposed-bookings', writeLimiter, (req, res) => {
  try {
    const {
      sessionId,      // ← Client's session ID
      startDate,
      endDate,
      rooms,
      guests,
      guestType,
      totalPrice
    } = req.body;

    if (!sessionId || !startDate || !endDate || !rooms) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // CRITICAL: One proposal per session only
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
  } catch (error) {
    logger.error('creating proposed booking:', error);
    return res.status(500).json({ error: 'Error creating proposal' });
  }
});
```

### Step 5: Database Stores Proposed Booking

```
File: /database.js (lines 1580-1621)

createProposedBooking(
  sessionId,
  startDate,
  endDate,
  rooms,
  guests = {},
  guestType = 'external',
  totalPrice = 0
) {
  const proposalId = this.generateProposalId();  // "PROP" + random
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();  // +15 min

  const transaction = this.db.transaction(() => {
    // Step A: Insert into proposed_bookings table
    this.statements.insertProposedBooking.run(
      proposalId,
      sessionId,
      startDate,
      endDate,
      now,
      expiresAt,           // ← CRITICAL: Expiration timestamp
      adults,
      children,
      toddlers,
      guestType,
      totalPrice
    );

    // Step B: Insert room associations
    for (const roomId of rooms) {
      this.statements.insertProposedBookingRoom.run(proposalId, roomId);
    }
  });

  transaction();
  return proposalId;
}

// Prepared Statement (line 465-468):
insertProposedBooking: this.db.prepare(`
  INSERT INTO proposed_bookings
    (proposal_id, session_id, start_date, end_date, created_at, expires_at,
     adults, children, toddlers, guest_type, total_price)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`),
```

### Step 6: Client Receives Proposal ID

```
File: /data.js (continues from Step 3)

Server returns: { success: true, proposalId: "PROP1a2b3c4d5" }

Client stores:
  this.proposalId = "PROP1a2b3c4d5"  // For later deletion

Cache updated with new proposal details
```

### Step 7: Calendar Re-renders with YELLOW Cells

```
File: /js/shared/BaseCalendar.js

When rendering calendar cells:

For each date and room:
  availability = await dataManager.getRoomAvailability(date, roomId)

  if (availability.status === 'proposed') {
    cell.style.backgroundColor = '#eab308';  // YELLOW
    cell.style.opacity = '0.7';
    cell.title = 'Navržená rezervace - čeká na potvrzení';
    cell.classList.add('proposed');
  }
```

---

## 2. CHECKING/BLOCKING FLOW (How Other Users See It)

### Other User Tries to Book Same Room

```
File: /data.js (lines 523-643)

Other User B: getRoomAvailability(date, roomId)
  ↓
Method checks multiple things in order:
  1. Check blockage_instances (admin blocks)
  2. Check blocked_dates (legacy blocks)
  3. Check proposed_bookings ← CRITICAL FOR RACE CONDITIONS
  4. Check actual bookings

PROPOSED BOOKINGS CHECK:

  const now = new Date().toISOString();  // Current time

  const proposedBookings = await this.getProposedBookings();

  const hasProposedBooking = proposedBookings.some(
    (pb) =>
      pb.rooms.includes(roomId) &&           // Same room?
      checkDateStr >= pb.start_date &&       // Date in range?
      checkDateStr <= pb.end_date &&         // (INCLUSIVE end date)
      (sessionToExclude === '' ||
       pb.session_id !== sessionToExclude)   // Not my proposal?
  );

  if (hasProposedBooking) {
    return {
      status: 'proposed',  // ← BLOCKED!
      email: null
    };
  }
```

### Server-Side Availability Check (Booking Creation)

```
File: /database.js (lines 1326-1441)

When User B tries to submit booking:

For each selected room and date:
  getRoomAvailability(roomId, date)
    ↓
    Query proposed_bookings:

    SELECT pb.* FROM proposed_bookings pb
    JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
    WHERE pbr.room_id = ?
    AND ? >= pb.start_date
    AND ? <= pb.end_date
    AND pb.expires_at > ?                  ← CRITICAL: Only non-expired!
    AND pb.session_id != ?;                ← Exclude own proposals

    Parameters: [roomId, date, date, NOW_TIMESTAMP, userSessionId]

    If any rows returned:
      return { available: false, status: 'proposed', reason: 'proposed' }

    Error response (server.js):
      return res.status(409).json({
        error: 'Pokoj ' + roomId + ' není dostupný dne ' + dateStr
      });
```

---

## 3. EXPIRATION & CLEANUP FLOW

### Expiration Calculation at Creation

```
File: /database.js (line 1591)

const now = new Date();
const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

// ISO String Examples:
// Created:  2025-10-16T14:30:00.123Z
// Expires:  2025-10-16T14:45:00.123Z
//           (exactly 15 minutes later)

Database stores: "2025-10-16T14:45:00.123Z"
```

### Automatic Cleanup Interval

```
File: /server.js (lines 2018-2028)

setInterval(() => {
  try {
    // Runs every 60 seconds (every minute)
    const result = db.deleteExpiredProposedBookings();

    if (result.changes > 0) {
      logger.info(
        `🗑️ Cleaned up ${result.changes} expired proposed bookings`
      );
    }
  } catch (error) {
    logger.error('cleaning up expired proposed bookings:', error);
  }
}, 60000);  // ← 60,000 ms = 1 minute interval
```

### Cleanup Implementation

```
File: /database.js (lines 1627-1630)

deleteExpiredProposedBookings() {
  const now = new Date().toISOString();  // Current timestamp

  // Execute prepared statement:
  return this.statements.deleteExpiredProposedBookings.run(now);
}

// SQL (line 476-478):
deleteExpiredProposedBookings: this.db.prepare(
  'DELETE FROM proposed_bookings WHERE expires_at < ?'
),

// Example execution:
// NOW: 2025-10-16T14:46:00Z
// Query: DELETE FROM proposed_bookings
//        WHERE expires_at < '2025-10-16T14:46:00Z'
// Result: Deletes proposal that expired at 14:45:00
```

---

## 4. DELETION FLOW (User Completes Booking)

### User Submits Booking Form

```
File: /js/booking-form.js (lines 213-828)

async submitBooking() {
  // ... validation code ...

  // If finalizing temporary reservations (line 359-596):
  if (this.app.isFinalizingReservations &&
      this.app.tempReservations &&
      this.app.tempReservations.length > 0) {

    // ... booking creation ...

    // CRITICAL: Delete proposed bookings (lines 524-541)
    const deletePromises = this.app.tempReservations
      .filter((tempReservation) => tempReservation.proposalId)
      .map(async (tempReservation) => {
        try {
          await dataManager.deleteProposedBooking(
            tempReservation.proposalId
          );
        } catch (error) {
          console.error('Failed to delete proposed booking:', error);
        }
      });

    await Promise.all(deletePromises);

    // Clear all session proposed bookings (safety net)
    try {
      await dataManager.clearSessionProposedBookings();
    } catch (error) {
      console.error('Failed to clear session proposed bookings:', error);
    }

    // Clear array for next booking
    this.app.tempReservations = [];
    this.app.isFinalizingReservations = false;

    // Hide modals
    // Show success notification
  }
}
```

### Client Deletes Proposed Booking

```
File: /data.js (lines 1148-1175)

async deleteProposedBooking(proposalId) {
  try {
    const response = await fetch(
      `${this.apiUrl}/proposed-booking/${proposalId}`,
      { method: 'DELETE' }
    );

    if (response.ok) {
      // Clear local tracking
      if (this.proposalId === proposalId) {
        this.proposalId = null;
      }

      // Update local cache (in-place, no full invalidation)
      if (this.proposedBookingsCache && Array.isArray(this.proposedBookingsCache)) {
        this.proposedBookingsCache = this.proposedBookingsCache.filter(
          (pb) => pb.proposal_id !== proposalId
        );
        this.proposedBookingsCacheTime = Date.now();  // Keep valid
      }

      return true;
    }
  } catch (error) {
    console.error('Error deleting proposed booking:', error);
  }
  return false;
}
```

### Server Receives Delete Request

```
File: /server.js (lines 1992-2003)

app.delete('/api/proposed-booking/:proposalId', writeLimiter, (req, res) => {
  try {
    const { proposalId } = req.params;

    // Database deletion
    db.deleteProposedBooking(proposalId);

    return res.json({ success: true });
  } catch (error) {
    logger.error('deleting proposed booking:', error);
    return res.status(500).json({
      error: 'Chyba při mazání navrhované rezervace'
    });
  }
});
```

### Database Deletes Record

```
File: /database.js (lines 1623-1625)

deleteProposedBooking(proposalId) {
  return this.statements.deleteProposedBooking.run(proposalId);
}

// Prepared statement (line 474):
deleteProposedBooking: this.db.prepare(
  'DELETE FROM proposed_bookings WHERE proposal_id = ?'
),

// Cascade delete triggers:
// - proposed_booking_rooms records automatically deleted (foreign key cascade)
```

### Calendar Re-renders (Now RED/GREEN)

```
File: /js/booking-app.js

After booking creation or proposal deletion:

await this.app.renderCalendar();
await this.app.updatePriceCalculation();

Calendar now shows:
  - If booking created: RED (booked)
  - If proposal deleted: GREEN (available)
```

---

## 5. CACHE SYNCHRONIZATION FLOW

### Client-Side Cache Management

```
File: /data.js (lines 1050-1094)

getProposedBookings() {
  const now = Date.now();

  // Check if cache is still valid (30 second TTL)
  if (
    this.proposedBookingsCache &&
    this.proposedBookingsCacheTime &&
    now - this.proposedBookingsCacheTime < 30000  // 30 seconds
  ) {
    return this.proposedBookingsCache;  // Return cached version
  }

  // If already fetching, reuse that promise
  if (this.proposedBookingsFetchPromise) {
    return this.proposedBookingsFetchPromise;  // Wait for ongoing fetch
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
      this.proposedBookingsFetchPromise = null;  // Clear promise
    }

    return this.proposedBookingsCache || [];
  })();

  return this.proposedBookingsFetchPromise;
}
```

### Server Auto-Sync Trigger

```
File: /data.js (lines 96-113)

startAutoSync() {
  // Sync every 30 seconds
  this.syncInterval = setInterval(async () => {
    await this.syncWithServer();
  }, 30000);

  // Also sync when tab regains focus
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {  // Tab became visible
      await this.syncWithServer();
    }
  });
}
```

### Debounced Calendar Refresh

```
File: /data.js (lines 115-170)

async syncWithServer(forceRefresh = false) {
  // ... fetch server data ...

  if (forceRefresh) {
    // Immediate update + render
    this.cachedData = serverData;
    await window.app.renderCalendar();
  } else {
    // Check if data is newer
    const serverTime = this.getLatestTimestamp(serverData);
    const localTime = this.getLatestTimestamp(this.cachedData);

    if (serverTime > localTime) {
      // Data changed, but debounce render
      const now = Date.now();

      if (
        window.app &&
        !this.renderPending &&           // Not already pending
        now - this.lastRender > 10000    // 10+ seconds since last render
      ) {
        this.renderPending = true;

        // Delay render 1 second to batch multiple changes
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
```

---

## 6. SESSION ISOLATION FLOW

### Session Creation & Management

```
File: /data.js (lines 21-29)

getOrCreateSessionId() {
  let sessionId = sessionStorage.getItem('bookingSessionId');

  if (!sessionId) {
    // Generate unique session for this browser tab
    sessionId = IdGenerator.generateSessionId();  // "SESS" + 16 random chars
    sessionStorage.setItem('bookingSessionId', sessionId);
  }

  return sessionId;  // Unique per tab, persists until tab closes
}
```

### One Proposal Per Session

```
File: /server.js (line 1934-1935)

// When user selects new dates/rooms:
db.deleteProposedBookingsBySession(sessionId);  // Delete old
db.createProposedBooking(...);                  // Create new

Result: Only ONE active proposal per session at any time
```

### Session-Based Availability Check

```
File: /database.js (lines 1389-1404)

const proposedQuery = excludeSessionId
  ? `
    SELECT pb.* FROM proposed_bookings pb
    JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
    WHERE pbr.room_id = ?
    AND ? >= pb.start_date
    AND ? <= pb.end_date
    AND pb.expires_at > ?
    AND pb.session_id != ?           ← Exclude OWN session's proposals
  `
  : `... without session exclusion ...`;

// Usage:
const proposedBookings = this.db.prepare(proposedQuery).all(
  roomId,
  date,
  date,
  now,
  excludeSessionId  // User's own session ID
);

Result: User can see their own proposals but aren't blocked by them
```

---

## 7. COMPLETE SEQUENCE DIAGRAM

```
USER A                    CLIENT                   SERVER              DATABASE
  │                         │                        │                    │
  ├─ Select dates/rooms ──>  │                        │                    │
  │                          ├─ POST /api/           │                    │
  │                          │ proposed-bookings  ──>│                    │
  │                          │                        ├─ Create proposal ─>│
  │                          │                        │  expires_at=+15min │
  │                          │                        │                    │
  │                          │<─ proposalId ─────────┤<─ PROP1a2b3c ─────│
  │                          │                        │                    │
  ├─ Sees YELLOW cells <────┤                        │                    │
  │                          │                        │                    │
  ├─ Fills booking form     │                        │                    │
  │ (up to 15 minutes)       │                        │                    │
  │                          │                        │                    │
USER B (concurrent)          │                        │                    │
  │                          │                        │                    │
  ├─ Try same room ─────────>│                        │                    │
  │                          ├─ getRoomAvailability  │                    │
  │                          ├─ Check proposed ─────>│                    │
  │                          │                        ├─ Query: expires   │
  │                          │                        │  > NOW? Yes!   ───>│
  │                          │                        │<─ Found! ─────────│
  │                          │<─ status='proposed'   │                    │
  │                          │                        │                    │
  ├─ Sees YELLOW cell        │                        │                    │
  ├─ Cannot book         <──┤                        │                    │
  │                          │                        │                    │
USER A (completes form)      │                        │                    │
  │                          │                        │                    │
  ├─ Submit booking ────────>│                        │                    │
  │                          ├─ DELETE /api/         │                    │
  │                          │ proposed-booking/     │                    │
  │                          │ PROP1a2b3c ──────────>│                    │
  │                          │                        ├─ Delete proposal ─>│
  │                          │<─ success ────────────┤<─ OK ─────────────│
  │                          │                        │                    │
  │                          ├─ POST /api/booking   │                    │
  │                          │ (create permanent) ──>│                    │
  │                          │                        ├─ Create booking ──>│
  │                          │<─ booking ID ─────────┤<─ BK1a2b3c ───────│
  │                          │                        │                    │
  │                          ├─ Render calendar     │                    │
  ├─ Sees RED cell       <───┤ → Room now RED       │                    │
  │                          │                        │                    │
USER B (after 30sec sync)    │                        │                    │
  │                          │                        │                    │
  ├─ Refresh page ─────────>│                        │                    │
  │                          ├─ syncWithServer()     │                    │
  │                          ├─ GET /api/data ──────>│                    │
  │                          │                        ├─ Get bookings ────>│
  │                          │<─ bookings[] ────────┤<─ Including new ──│
  │                          │                        │                    │
  │                          ├─ Render calendar     │                    │
  ├─ Sees RED cell       <───┤ → Room now RED       │                    │
  │                          │ (can't book)          │                    │
  │                          │                        │                    │

(If User A doesn't submit within 15 minutes:)
  │                          │                        │                    │
  │                   +15min  │                        │                    │
  │                    (14:45)│ Cleanup runs (every   │                    │
  │                          │ 60 seconds, after      │                    │
  │                          │ 14:45)                 │                    │
  │                          │                        ├─ DELETE WHERE ────>│
  │                          │                        │  expires_at < NOW  │
  │                          │                        │<─ Deleted ────────│
  │                          │                        │                    │
  │                          │ (next sync, 30sec)    │                    │
  │                          ├─ GET /api/data ──────>│                    │
  │                          │                        ├─ Get bookings ────>│
  │                          │<─ bookings[] ────────┤<─ (proposal gone) │
  │                          │                        │                    │
  │                          ├─ Render calendar     │                    │
  ├─ Sees GREEN cell ←───────┤ → Room reverts       │                    │
  │ (can now book!)           │                        │                    │
```

---

## 8. ERROR HANDLING & EDGE CASES

### Cache Invalidation on Error

```
File: /data.js (lines 1091-1094)

invalidateProposedBookingsCache() {
  this.proposedBookingsCache = null;
  this.proposedBookingsCacheTime = null;
  // Next call to getProposedBookings() will fetch fresh data
}

Called when:
  - Booking creation fails
  - Availability check returns error
  - Network disconnection detected
```

### Orphaned Proposals Cleanup

```
File: /js/booking-form.js (lines 536-541)

// Safety net: Clear ALL session proposals
try {
  await dataManager.clearSessionProposedBookings();
  // DELETE /api/proposed-bookings/session/:sessionId
} catch (error) {
  console.error('Failed to clear session proposed bookings:', error);
}

Called when:
  - User completes booking (ensures no orphans)
  - User cancels booking flow
  - Multiple temp reservations finalization
```

### Concurrent Session Handling

```
Database Constraint: One proposal per session at a time

Scenario:
  User opens 2 browser tabs (different sessionIds)
  Tab 1: Selects room 12, creates proposal
  Tab 2: Selects room 12, creates proposal

Result: Both proposals created (different sessions!)
  → Two rows in proposed_bookings table
  → Both block room 12 for each other's session
  → Each user sees room as available for themselves

Why: expiration time ensures cleanup, no deadlock
```

---

## 9. DEBUGGING COMMAND REFERENCE

### Check Active Proposals

```sql
SELECT
  proposal_id,
  session_id,
  start_date,
  end_date,
  expires_at,
  datetime('now') as current_time,
  CAST((julianday(expires_at) - julianday('now')) * 24 * 60 AS INTEGER) as minutes_left
FROM proposed_bookings
WHERE expires_at > datetime('now')
ORDER BY expires_at ASC;
```

### Check Expired Proposals (to be cleaned)

```sql
SELECT
  proposal_id,
  session_id,
  expires_at,
  datetime('now') as current_time
FROM proposed_bookings
WHERE expires_at <= datetime('now')
LIMIT 10;
```

### Check Room Blocking Status

```sql
SELECT DISTINCT
  pbr.room_id,
  pb.proposal_id,
  pb.session_id,
  pb.start_date,
  pb.end_date,
  pb.expires_at,
  CAST((julianday(pb.expires_at) - julianday('now')) * 24 * 60 AS INTEGER) as minutes_left
FROM proposed_bookings pb
JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
WHERE pb.expires_at > datetime('now')
ORDER BY pbr.room_id, pb.expires_at;
```

### Monitor Cleanup Activity

```bash
# Watch server logs for cleanup messages
docker-compose logs -f server | grep "Cleaned up"

# Example output:
# 🗑️ Cleaned up 3 expired proposed bookings
# 🗑️ Cleaned up 1 expired proposed bookings
# 🗑️ Cleaned up 0 expired proposed bookings (no changes)
```

---

## Summary

The proposed bookings system uses:

1. **Session ID** for user tracking (one proposal per session)
2. **Expiration timestamp** for automatic cleanup (15 min TTL)
3. **Database transactions** for race condition prevention
4. **Client-side caching** with server validation for performance
5. **Debounced rendering** to prevent UI thrashing
6. **Cascade deletes** for data integrity

All components work together to prevent double-booking while maintaining responsive UX.
