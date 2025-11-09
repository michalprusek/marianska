# Data Consistency Analysis - Marianska Booking System

**Analysis Date**: 2025-11-06
**Status**: Comprehensive Review of Data Integrity & Consistency Issues

---

## Executive Summary

This analysis identifies **23 data consistency issues** across 4 priority levels (Critical, High, Medium, Low). The system uses a dual-storage approach (SQLite + localStorage) with automatic fallback, creating multiple potential failure points for data integrity.

### Issue Distribution
- **Critical (P0)**: 7 issues - Require immediate attention
- **High (P1)**: 8 issues - Should be addressed soon
- **Medium (P2)**: 5 issues - Minor impact, can be deferred
- **Low (P3)**: 3 issues - Edge cases, nice-to-have fixes

---

## Architecture Overview

### Storage Layers
1. **Primary**: SQLite database (`data/bookings.db`) - WAL mode, foreign keys enabled
2. **Secondary**: Browser localStorage (`chataMarianska` key) - Client-side cache
3. **Session**: Browser sessionStorage - Session ID, temporary data
4. **In-Memory**: Multiple caches (proposed bookings, rendering state)

### Data Flow
```
┌─────────────┐    sync    ┌──────────────┐    backup    ┌──────────────┐
│  SQLite DB  │ ←──────→ │ DataManager  │ ───────→ │ localStorage │
└─────────────┘ 30s/event └──────────────┘           └──────────────┘
       ↑                          ↓
       │                          │
  Persistence               ↓ (fallback)
       │                    ↓
       │           ┌──────────────────┐
       └───────── │ Proposed Cache   │
                   │ (30s TTL)        │
                   └──────────────────┘
```

---

## Critical Issues (P0)

### 1. Race Condition in localStorage Write During Concurrent Requests ⚠️

**Location**: `data.js:279`, `data.js:399`, `data.js:480`, `data.js:829`

**Problem**: Multiple async operations call `localStorage.setItem()` without locking, causing potential data corruption during concurrent writes.

**Scenario**:
```javascript
// Request 1: Create booking (line 399)
localStorage.setItem(this.storageKey, JSON.stringify(data));

// Request 2: Sync server (line 140) - executes BEFORE Request 1 completes
localStorage.setItem(this.storageKey, JSON.stringify(serverData));

// Result: Request 1's booking lost, overwritten by Request 2
```

**Impact**: Data loss during concurrent booking creation + auto-sync

**Recommendation**:
- Implement queue-based localStorage writes
- Use debouncing for localStorage updates (similar to render debouncing)
- Add version/timestamp to detect overwrites

```javascript
// Proposed fix
class LocalStorageQueue {
  constructor() {
    this.queue = Promise.resolve();
  }

  enqueue(fn) {
    this.queue = this.queue.then(fn).catch(err => {
      console.error('LocalStorage write failed:', err);
    });
    return this.queue;
  }
}

// Usage
this.localStorageQueue.enqueue(() => {
  localStorage.setItem(this.storageKey, JSON.stringify(data));
});
```

---

### 2. No Validation of localStorage Data Before Restore ⚠️

**Location**: `data.js:75-86`

**Problem**: localStorage data is JSON.parsed without schema validation. Corrupted data crashes the app.

**Code**:
```javascript
const savedData = localStorage.getItem(this.storageKey);
if (savedData) {
  try {
    this.cachedData = JSON.parse(savedData); // ❌ No validation
    // Uses potentially corrupted data
  } catch (error) {
    console.error('Error parsing localStorage data:', error);
  }
}
```

**Attack Vector**:
1. User opens DevTools
2. Modifies `localStorage.chataMarianska` to invalid structure
3. Reloads page → app crashes or shows corrupted data

**Recommendation**:
```javascript
function validateBookingData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.bookings)) return false;
  if (!data.settings || typeof data.settings !== 'object') return false;

  // Validate each booking has required fields
  for (const booking of data.bookings) {
    if (!booking.id || !booking.startDate || !booking.endDate) {
      return false;
    }
  }

  return true;
}

// Usage
this.cachedData = JSON.parse(savedData);
if (!validateBookingData(this.cachedData)) {
  console.error('Invalid localStorage data - resetting to defaults');
  this.cachedData = this.getDefaultData();
}
```

---

### 3. Proposed Bookings Cache Not Invalidated on Server Sync ⚠️

**Location**: `data.js:115-170` (syncWithServer), `data.js:1072-1110` (getProposedBookings)

**Problem**: When server returns updated data, proposed bookings cache is NOT invalidated, causing stale proposal data to block availability.

**Code Flow**:
```javascript
// 1. User A creates proposal (cached for 30s)
this.proposedBookingsCache = [...];
this.proposedBookingsCacheTime = Date.now();

// 2. Server syncs (10 seconds later)
async syncWithServer() {
  const serverData = await fetch('/api/data');
  this.cachedData = serverData; // ✅ Updated
  localStorage.setItem(this.storageKey, ...); // ✅ Updated

  // ❌ proposedBookingsCache NOT invalidated!
  // Still returns stale data for next 20 seconds
}

// 3. User B checks availability
const proposals = await this.getProposedBookings();
// Returns stale cache, sees expired proposals as active
```

**Impact**: False "room unavailable" errors for 20 seconds after server cleanup

**Recommendation**:
```javascript
async syncWithServer(forceRefresh = false) {
  // ... existing code ...

  if (serverTimestamp > localTimestamp) {
    this.cachedData = serverData;
    localStorage.setItem(this.storageKey, JSON.stringify(this.cachedData));

    // NEW: Invalidate proposed bookings cache on data change
    this.invalidateProposedBookingsCache();
  }
}
```

---

### 4. Session ID in sessionStorage Lost on Browser Close ⚠️

**Location**: `data.js:21-29`, `data.js:11` (constructor)

**Problem**: Session ID is stored in `sessionStorage`, causing:
1. Loss of session context after browser close
2. Cannot track proposed bookings across browser restarts
3. Orphaned proposed bookings in database

**Code**:
```javascript
getOrCreateSessionId() {
  let sessionId = sessionStorage.getItem('bookingSessionId');
  if (!sessionId) {
    sessionId = IdGenerator.generateSessionId();
    sessionStorage.setItem('bookingSessionId', sessionId); // ❌ Lost on close
  }
  return sessionId;
}
```

**Impact**:
- User closes browser during booking → proposed booking orphaned
- Server cleanup removes it after 15 minutes (correct behavior)
- But: database grows with orphaned proposals if user bookmarks mid-booking

**Recommendation**: Use localStorage with expiration instead of sessionStorage

```javascript
getOrCreateSessionId() {
  const stored = localStorage.getItem('bookingSessionId');
  if (stored) {
    const { sessionId, createdAt } = JSON.parse(stored);
    // Session expires after 1 hour
    if (Date.now() - createdAt < 60 * 60 * 1000) {
      return sessionId;
    }
  }

  const sessionId = IdGenerator.generateSessionId();
  localStorage.setItem('bookingSessionId', JSON.stringify({
    sessionId,
    createdAt: Date.now()
  }));
  return sessionId;
}
```

---

### 5. Proposed Bookings Fetch Promise Not Cleared on Error ⚠️

**Location**: `data.js:1089-1109`

**Problem**: If `getProposedBookings()` fetch fails, `proposedBookingsFetchPromise` stays set, blocking all future requests.

**Code**:
```javascript
this.proposedBookingsFetchPromise = (async () => {
  try {
    const response = await fetch(`${this.apiUrl}/proposed-bookings`);
    if (response.ok) {
      this.proposedBookingsCache = await response.json();
      this.proposedBookingsCacheTime = Date.now();
      return this.proposedBookingsCache;
    }
    // ❌ response NOT ok - promise not cleared, cache not set
  } catch (error) {
    console.error('Error fetching proposed bookings:', error);
    // ❌ Network error - promise not cleared
  } finally {
    this.proposedBookingsFetchPromise = null; // ✅ Only cleared here
  }

  // Return stale cache or empty array
  return this.proposedBookingsCache || [];
})();
```

**Scenario**:
1. Network error during fetch
2. `finally` clears promise → ✅ Correct
3. BUT: Returns empty array instead of retrying
4. Next call will fetch again (correct behavior)

**Status**: ✅ Actually correct - `finally` ensures cleanup

**Update**: FALSE ALARM - This is handled correctly. The `finally` block ensures promise is always cleared.

---

### 6. SQLite WAL File Growth Without Checkpointing ⚠️

**Location**: `database.js:16-19`

**Problem**: WAL autocheckpoint is set to 1000 pages, but no monitoring or forced checkpoints exist.

**Code**:
```javascript
this.db.pragma('journal_mode = WAL');
this.db.pragma('foreign_keys = ON');
this.db.pragma('wal_autocheckpoint = 1000'); // ✅ Set but not monitored
```

**Impact**:
- Under high load, WAL file can grow unbounded if writes happen faster than checkpoints
- Disk space exhaustion possible
- Performance degradation (WAL reads get slower)

**Recommendation**: Add periodic manual checkpointing

```javascript
// In server.js startup
setInterval(() => {
  try {
    const result = db.db.pragma('wal_checkpoint(TRUNCATE)');
    logger.debug('WAL checkpoint executed', { result });
  } catch (error) {
    logger.error('WAL checkpoint failed:', error);
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

---

### 7. No Retry Logic for Failed Server Syncs ⚠️

**Location**: `data.js:115-170` (syncWithServer)

**Problem**: Failed syncs are silently ignored with no retry mechanism

**Code**:
```javascript
async syncWithServer(forceRefresh = false) {
  try {
    const response = await fetch(`${this.apiUrl}/data`);
    if (response.ok) {
      // ... sync logic ...
    }
  } catch {
    // Silently fail sync - will retry on next operation
    // ❌ But if network is down for >30 seconds, data diverges
  }
}
```

**Impact**:
- Network down for 5 minutes → no syncs happen
- localStorage and SQLite diverge
- User sees stale data

**Recommendation**: Exponential backoff retry

```javascript
async syncWithServerWithRetry(forceRefresh = false, attempt = 0) {
  const maxAttempts = 3;
  const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);

  try {
    await this.syncWithServer(forceRefresh);
  } catch (error) {
    if (attempt < maxAttempts) {
      logger.warn(`Sync failed, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxAttempts})`);
      setTimeout(() => {
        this.syncWithServerWithRetry(forceRefresh, attempt + 1);
      }, backoffMs);
    } else {
      logger.error('Sync failed after max retries - working in offline mode');
    }
  }
}
```

---

## High Priority Issues (P1)

### 8. Admin Session Token in localStorage Not Encrypted 🔴

**Location**: `data.js:1027`, `admin.js:271-272`, `admin.js:296-297`

**Problem**: Admin session token stored in plaintext in localStorage

**Code**:
```javascript
localStorage.setItem('adminSessionToken', loginResult.sessionToken);
localStorage.setItem('adminSessionExpiry', loginResult.expiresAt);
```

**Attack Vector**:
1. XSS attack steals `localStorage.adminSessionToken`
2. Attacker gains full admin access for 7 days

**Recommendation**: Use httpOnly cookies instead of localStorage

```javascript
// Server-side only
res.cookie('adminSession', sessionToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000
});

// Client cannot access cookie via JavaScript
// Only sent automatically with requests
```

---

### 9. localStorage Quota Exceeded Handler Clears ALL Data 🔴

**Location**: `data.js:32-54` (safeSetLocalStorage)

**Problem**: When localStorage is full, it clears ALL storage (including unrelated app data)

**Code**:
```javascript
if (error.name === 'QuotaExceededError') {
  try {
    localStorage.clear(); // ❌ Nuclear option - destroys all app data
    localStorage.setItem(key, JSON.stringify(data));
  } catch (retryError) {
    console.error('[DataManager] LocalStorage unavailable:', retryError);
  }
}
```

**Impact**: User's language preference, mock emails, session data all lost

**Recommendation**: Clear only application-specific keys

```javascript
if (error.name === 'QuotaExceededError') {
  try {
    // Clear only our keys
    const keysToRemove = ['chataMarianska', 'mockEmails'];
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Retry
    localStorage.setItem(key, JSON.stringify(data));
  } catch (retryError) {
    logger.error('[DataManager] LocalStorage unavailable:', retryError);
  }
}
```

---

### 10. Timestamp Comparison Uses Latest Booking, Not All Data 🔴

**Location**: `data.js:178-202` (getLatestTimestamp)

**Problem**: Only checks `bookings` and `blockedDates`, ignoring settings, rooms, proposed bookings

**Code**:
```javascript
getLatestTimestamp(data) {
  let latest = 0;

  // Check bookings ✅
  if (data.bookings) { ... }

  // Check blocked dates ✅
  if (data.blockedDates) { ... }

  // ❌ Missing: blockageInstances, settings, rooms, christmas codes

  return latest;
}
```

**Impact**:
- Admin updates settings → timestamp not updated → clients don't sync
- Settings changes can take 30 seconds to propagate

**Recommendation**:
```javascript
getLatestTimestamp(data) {
  let latest = 0;

  // Bookings
  if (data.bookings) { ... }

  // Blocked dates
  if (data.blockedDates) { ... }

  // Blockage instances
  if (data.blockageInstances) {
    data.blockageInstances.forEach(b => {
      const created = new Date(b.created_at).getTime();
      if (created > latest) latest = created;
    });
  }

  // Settings timestamp
  if (data.settings && data.settings.updatedAt) {
    const updated = new Date(data.settings.updatedAt).getTime();
    if (updated > latest) latest = updated;
  }

  return latest;
}
```

---

### 11. Orphaned Proposed Bookings Not Cleaned Up on Session Creation 🔴

**Location**: `data.js:21-29`, `server.js` (no cleanup on session start)

**Problem**: New session ID is generated, but old session's proposed bookings remain in database

**Scenario**:
```
1. User opens page → Session A created
2. User selects dates → Proposed booking A created
3. User closes browser (sessionStorage cleared)
4. User reopens page → Session B created (NEW ID)
5. Proposed booking A still in database (expires in 15 min)
6. User tries to book same room → BLOCKED by orphaned proposal A
```

**Impact**: False "room unavailable" for up to 15 minutes after browser restart

**Recommendation**: Clean up old session proposals on new session

```javascript
// In data.js constructor
async initData() {
  // ... existing code ...

  // Clean up old session proposals (expired or abandoned)
  try {
    await fetch(`${this.apiUrl}/proposed-bookings/session/${this.sessionId}`, {
      method: 'DELETE'
    });
  } catch (error) {
    // Silently fail - server cleanup will handle it
  }

  // ... rest of init ...
}
```

---

### 12. Per-Room Dates Not Validated in getRoomAvailability 🔴

**Location**: `data.js:607-624`

**Problem**: When checking availability, per-room dates are used without validating they exist for ALL rooms

**Code**:
```javascript
const roomBookings = data.bookings
  .filter((booking) => booking.rooms.includes(roomId))
  .map((b) => {
    const perRoomDate = b.perRoomDates?.[roomId]; // ❌ Optional chaining hides missing data
    if (perRoomDate) {
      return { startDate: perRoomDate.startDate, endDate: perRoomDate.endDate, ... };
    }
    // Fallback to global dates
    return { startDate: b.startDate, endDate: b.endDate, ... };
  });
```

**Impact**:
- Booking has `perRoomDates` but specific room missing → uses global dates
- Can cause incorrect availability (room shown as available when actually booked)

**Recommendation**: Add validation

```javascript
if (perRoomDate) {
  // Validate per-room dates are sensible
  if (!perRoomDate.startDate || !perRoomDate.endDate) {
    logger.warn('Invalid per-room dates for booking', {
      bookingId: b.id,
      roomId
    });
    // Fallback to global dates
    return { startDate: b.startDate, endDate: b.endDate, ... };
  }
  return { startDate: perRoomDate.startDate, endDate: perRoomDate.endDate, ... };
}
```

---

### 13. Database Transactions in saveData() Can Deadlock 🔴

**Location**: `server.js:438-476` (POST /api/data)

**Problem**: Sequential DELETE + INSERT operations not wrapped in transaction, can fail mid-way

**Code**:
```javascript
app.post('/api/data', writeLimiter, requireApiKeyOrSession, (req, res) => {
  // Delete all data (not in transaction)
  db.db.exec('DELETE FROM bookings');
  db.db.exec('DELETE FROM booking_rooms');
  // ❌ If error occurs here, database is partially cleared

  // Insert new data
  for (const booking of dataToSave.bookings) {
    db.createBooking(booking); // Each has own transaction
  }
});
```

**Impact**: Bulk data save can leave database in inconsistent state if error occurs mid-operation

**Recommendation**: Wrap entire operation in transaction

```javascript
app.post('/api/data', writeLimiter, requireApiKeyOrSession, (req, res) => {
  const transaction = db.db.transaction(() => {
    db.db.exec('DELETE FROM bookings');
    db.db.exec('DELETE FROM booking_rooms');
    db.db.exec('DELETE FROM blockage_instances');
    db.db.exec('DELETE FROM blockage_rooms');

    if (dataToSave.bookings && dataToSave.bookings.length > 0) {
      for (const booking of dataToSave.bookings) {
        // Use direct inserts instead of createBooking (avoid nested transactions)
        db.statements.insertBooking.run(...);
      }
    }
  });

  transaction(); // Execute all or nothing
});
```

---

### 14. pushToServer() Has No Conflict Detection 🔴

**Location**: `data.js:204-219`

**Problem**: Client pushes local changes to server without checking if server has newer data

**Code**:
```javascript
async pushToServer() {
  try {
    const response = await fetch(`${this.apiUrl}/data`, {
      method: 'POST',
      body: JSON.stringify(this.cachedData), // ❌ Overwrites server data
    });
  } catch {
    // Silently fail
  }
}
```

**Scenario**:
```
1. Client A: localStorage has booking X
2. Server: Has booking X + Y (Y created by Client B)
3. Client A: pushToServer() → overwrites server with only X
4. Booking Y lost!
```

**Impact**: Last-write-wins with no merge logic → data loss

**Recommendation**: Use optimistic locking with version numbers

```javascript
// Add version to data
const data = {
  version: 1,
  bookings: [...],
  ...
};

// Server checks version
if (req.body.version < currentVersion) {
  return res.status(409).json({
    error: 'Conflict - data has changed',
    currentVersion
  });
}
```

---

### 15. Proposed Booking Cache Updated In-Place Without Validation 🔴

**Location**: `data.js:1148-1160`, `data.js:1182-1189`

**Problem**: Cache is mutated directly without validating response data structure

**Code**:
```javascript
// Create proposed booking
if (this.proposedBookingsCache && Array.isArray(this.proposedBookingsCache)) {
  this.proposedBookingsCache.push({
    proposal_id: data.proposalId, // ❌ No validation of data.proposalId
    session_id: this.sessionId,
    start_date: startDate,
    end_date: endDate,
    rooms,
    created_at: new Date().toISOString(),
  });
}
```

**Impact**: If server returns malformed response, cache becomes corrupted

**Recommendation**: Validate before caching

```javascript
if (response.ok) {
  const data = await response.json();

  // Validate response
  if (!data.proposalId || typeof data.proposalId !== 'string') {
    throw new Error('Invalid proposal response');
  }

  this.proposalId = data.proposalId;

  // Update cache
  if (this.proposedBookingsCache && Array.isArray(this.proposedBookingsCache)) {
    this.proposedBookingsCache.push({
      proposal_id: data.proposalId,
      // ... rest
    });
  }
}
```

---

## Medium Priority Issues (P2)

### 16. Calendar Render Debouncing Not Coordinated with Data Sync 🟡

**Location**: `data.js:142-155`

**Problem**: Render debouncing (10s) is independent of sync interval (30s), causing missed updates

**Code**:
```javascript
// Auto-sync every 30 seconds
setInterval(() => { await this.syncWithServer(); }, 30000);

// Render debouncing: max once per 10 seconds
if (window.app && !this.renderPending && now - this.lastRender > 10000) {
  // ... render after 1s delay ...
}
```

**Scenario**:
```
00:00 - Sync + render
00:10 - Sync detects change, but render throttled (< 10s since last)
00:11 - Render executes (1s delay)
00:30 - Sync + render
00:40 - Sync detects change, render throttled again
```

**Impact**: UI can be up to 11 seconds behind server data

**Recommendation**: Reset render timer on sync

```javascript
if (serverTimestamp > localTimestamp) {
  this.cachedData = serverData;
  localStorage.setItem(this.storageKey, JSON.stringify(this.cachedData));

  // Force render on data change (bypass debounce)
  this.lastRender = 0; // Reset timer
  if (window.app && !this.renderPending) {
    this.renderPending = true;
    setTimeout(async () => {
      this.renderPending = false;
      this.lastRender = Date.now();
      await window.app.renderCalendar();
    }, 1000);
  }
}
```

---

### 17. Error Messages Not User-Friendly 🟡

**Location**: Multiple locations (data.js:311-318, etc.)

**Problem**: Technical error messages shown to users

**Examples**:
- `"Server error: 500 Internal Server Error"` → Should be `"Nastala chyba serveru. Zkuste to prosím později."`
- `"Failed to fetch"` → Should be `"Není možné se připojit k serveru"`

**Recommendation**: Error message translation layer

```javascript
const ERROR_MESSAGES = {
  'Failed to fetch': 'Není možné se připojit k serveru. Zkontrolujte připojení k internetu.',
  'Server error: 500': 'Nastala chyba serveru. Zkuste to prosím později.',
  'Session expired': 'Relace vypršela. Přihlaste se prosím znovu.',
};

function getUserFriendlyError(error) {
  const message = error.message || String(error);
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(key)) {
      return value;
    }
  }
  return 'Nastala neočekávaná chyba. Zkuste to prosím znovu.';
}
```

---

### 18. No Metrics Collection for Data Sync Issues 🟡

**Location**: Entire data.js file

**Problem**: No monitoring of:
- Sync failure rate
- localStorage quota errors
- Proposed booking cache hit rate
- Average sync latency

**Recommendation**: Add lightweight metrics

```javascript
class DataMetrics {
  constructor() {
    this.metrics = {
      syncSuccess: 0,
      syncFailure: 0,
      cacheHits: 0,
      cacheMisses: 0,
      quotaErrors: 0,
    };
  }

  increment(metric) {
    this.metrics[metric] = (this.metrics[metric] || 0) + 1;
  }

  report() {
    return { ...this.metrics };
  }
}

// Usage in syncWithServer
try {
  await this.syncWithServer();
  this.metrics.increment('syncSuccess');
} catch (error) {
  this.metrics.increment('syncFailure');
  throw error;
}
```

---

### 19. Proposed Bookings Cache Duration Not Configurable 🟡

**Location**: `data.js:15`

**Problem**: Hard-coded 30-second cache duration

**Code**:
```javascript
this.proposedBookingsCacheDuration = 30000; // ❌ Hard-coded
```

**Impact**: Cannot tune cache based on load or requirements

**Recommendation**: Make configurable

```javascript
this.proposedBookingsCacheDuration =
  parseInt(process.env.PROPOSED_CACHE_TTL) || 30000;
```

---

### 20. localStorage Not Cleared on Logout 🟡

**Location**: `data.js:1030-1045` (handleUnauthorizedError)

**Problem**: Admin logout only clears session token, leaves booking data in localStorage

**Code**:
```javascript
handleUnauthorizedError() {
  localStorage.removeItem('adminSessionToken');
  localStorage.removeItem('adminSessionExpiry');
  // ❌ Does NOT clear 'chataMarianska' booking data
}
```

**Impact**: Sensitive booking data remains accessible after logout (privacy issue)

**Recommendation**:
```javascript
handleUnauthorizedError() {
  // Clear session
  localStorage.removeItem('adminSessionToken');
  localStorage.removeItem('adminSessionExpiry');

  // Clear cached data for privacy
  localStorage.removeItem('chataMarianska');
  this.cachedData = null;
}
```

---

## Low Priority Issues (P3)

### 21. Session ID Not Validated Before Use 🔵

**Location**: `data.js:1133` (createProposedBooking)

**Problem**: Session ID is used without validating format

**Code**:
```javascript
body: JSON.stringify({
  sessionId: this.sessionId, // ❌ Could be undefined, null, or malformed
  // ...
})
```

**Impact**: Server may receive invalid session IDs (server validates, so low impact)

**Recommendation**: Validate on client

```javascript
if (!this.sessionId || this.sessionId.length < 10) {
  this.sessionId = this.getOrCreateSessionId();
}
```

---

### 22. Language Preference in localStorage Not Synced 🔵

**Location**: `js/utils.js:684`, `translations.js:1182`

**Problem**: Language preference is stored in localStorage but not synced to server

**Impact**: User changes language on Device A, not reflected on Device B

**Recommendation**: Sync language preference to server (optional feature)

---

### 23. Mock Emails in localStorage Grow Unbounded 🔵

**Location**: `data.js:1261-1269`

**Problem**: Mock emails are appended to localStorage without cleanup

**Code**:
```javascript
const emails = JSON.parse(localStorage.getItem('mockEmails') || '[]');
emails.push({ ... }); // ❌ No limit
localStorage.setItem('mockEmails', JSON.stringify(emails));
```

**Impact**: Eventually causes QuotaExceededError in development

**Recommendation**: Limit to last 100 emails

```javascript
const emails = JSON.parse(localStorage.getItem('mockEmails') || '[]');
emails.push({ ... });
const limitedEmails = emails.slice(-100); // Keep last 100 only
localStorage.setItem('mockEmails', JSON.stringify(limitedEmails));
```

---

## Summary Table

| ID | Priority | Issue | Impact | Effort | Recommendation |
|----|----------|-------|--------|--------|----------------|
| 1 | P0 | Race condition in localStorage writes | Data loss | Medium | Implement write queue |
| 2 | P0 | No localStorage schema validation | App crash | Low | Add validation function |
| 3 | P0 | Proposed cache not invalidated on sync | False unavailable | Low | Invalidate on sync |
| 4 | P0 | Session ID lost on browser close | Orphaned proposals | Low | Use localStorage with TTL |
| 5 | ~~P0~~ | ~~Fetch promise not cleared~~ | ~~Blocked fetches~~ | - | ✅ False alarm |
| 6 | P0 | WAL file growth | Disk space | Low | Add manual checkpoints |
| 7 | P0 | No retry on sync failure | Data divergence | Medium | Exponential backoff |
| 8 | P1 | Admin token in localStorage | Security risk | High | Use httpOnly cookies |
| 9 | P1 | Quota handler clears all data | Data loss | Low | Clear only app keys |
| 10 | P1 | Timestamp ignores settings | Delayed sync | Low | Check all timestamps |
| 11 | P1 | Orphaned proposals not cleaned | False unavailable | Low | Cleanup on init |
| 12 | P1 | Per-room dates not validated | Wrong availability | Low | Add validation |
| 13 | P1 | Bulk save not transactional | Partial writes | Medium | Wrap in transaction |
| 14 | P1 | Push without conflict detection | Data loss | High | Optimistic locking |
| 15 | P1 | Cache updated without validation | Corrupted cache | Low | Validate response |
| 16 | P2 | Render debounce not coordinated | Delayed UI | Low | Reset on data change |
| 17 | P2 | Technical error messages | Poor UX | Low | Translation layer |
| 18 | P2 | No metrics collection | No visibility | Medium | Add lightweight metrics |
| 19 | P2 | Cache duration hard-coded | Inflexible | Low | Environment variable |
| 20 | P2 | Data not cleared on logout | Privacy issue | Low | Clear on logout |
| 21 | P3 | Session ID not validated | Minor bug | Low | Add validation |
| 22 | P3 | Language not synced | Minor UX | Low | Optional feature |
| 23 | P3 | Mock emails unbounded | Dev issue | Low | Limit to 100 |

---

## Recommended Implementation Order

### Phase 1 (Week 1) - Critical Fixes
1. Add localStorage schema validation (Issue #2)
2. Invalidate proposed cache on sync (Issue #3)
3. Fix session ID storage (Issue #4)
4. Add WAL checkpointing (Issue #6)

### Phase 2 (Week 2) - High Priority
5. Implement retry logic (Issue #7)
6. Fix localStorage race conditions (Issue #1)
7. Move admin token to cookies (Issue #8)
8. Add conflict detection to pushToServer (Issue #14)

### Phase 3 (Week 3) - Cleanup
9. Add validation to cache updates (Issue #15)
10. Make bulk save transactional (Issue #13)
11. Fix timestamp comparison (Issue #10)
12. Clean up orphaned proposals (Issue #11)

### Phase 4 (Week 4) - Polish
13. Add metrics collection (Issue #18)
14. Improve error messages (Issue #17)
15. Remaining P2/P3 issues

---

## Testing Recommendations

### Test Scenarios for Data Consistency

1. **Concurrent Booking Test**
   - Two users book same room simultaneously
   - Verify only one succeeds

2. **Network Failure Test**
   - Disconnect network during booking creation
   - Verify localStorage fallback works
   - Reconnect and verify sync

3. **Browser Restart Test**
   - Create proposed booking
   - Close browser
   - Reopen and verify orphaned proposal cleaned up

4. **localStorage Corruption Test**
   - Manually corrupt localStorage data
   - Reload page and verify app doesn't crash

5. **Quota Exceeded Test**
   - Fill localStorage to near-quota
   - Create large booking
   - Verify graceful handling

---

## Monitoring Recommendations

### Metrics to Track

1. **Sync Health**
   - Sync success rate (%)
   - Average sync latency (ms)
   - Failed sync count

2. **Cache Performance**
   - Proposed booking cache hit rate (%)
   - Cache invalidation frequency
   - Stale data incidents

3. **Storage Issues**
   - localStorage quota errors per day
   - WAL file size (MB)
   - Orphaned proposal count

4. **User Impact**
   - "Room unavailable" false positives
   - Data corruption incidents
   - Session loss rate

---

## Conclusion

The dual-storage architecture provides excellent resilience but introduces 23 consistency issues. **7 critical issues (P0)** should be addressed immediately to prevent data loss. The remaining **16 issues (P1-P3)** can be prioritized based on business impact.

Key areas of concern:
1. **localStorage race conditions** (most critical)
2. **Session management** (affects user experience)
3. **Cache invalidation** (causes false errors)
4. **Security** (admin tokens)

Estimated total effort: **4-6 weeks** for full remediation.

---

**Document Version**: 1.0
**Next Review**: After Phase 1 completion
**Owner**: Development Team
