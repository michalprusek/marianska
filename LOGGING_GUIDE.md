# Comprehensive Availability Logging Guide

## Overview

This guide documents the logging infrastructure added to help debug availability issues in the booking system. All critical decision points now have structured logging with consistent formatting.

## Log Format

All logs follow this format:
```
[COMPONENT] Action: { contextData }
```

**Components:**
- `[DB]` - Database layer (database.js)
- `[BOOKING]` - Server booking endpoints (server.js)
- `[DataManager]` - Frontend data layer (data.js)

## Logging Points Added

### 1. Database Layer (database.js)

#### getRoomAvailability() Method

**Location:** `database.js:905-980`

**Logs every check type:**

```javascript
// Initial check log
console.log('[DB] Checking availability:', {
  roomId,
  date,
  excludeSessionId
});

// If blocked
console.log('[DB] Room blocked:', {
  roomId,
  date,
  blockage: blocked.blockage_id
});

// If booked
console.log('[DB] Room booked:', {
  roomId,
  date,
  booking: bookings[0].id
});

// If proposed booking exists
console.log('[DB] Room has proposal:', {
  roomId,
  date,
  proposalSession: proposedBookings[0].session_id,
  excludedSession: excludeSessionId,
});

// If available
console.log('[DB] Room available:', { roomId, date });
```

**Key Features:**
- Logs the `excludeSessionId` parameter to track session exclusions
- Shows which specific booking/blockage/proposal is blocking availability
- Differentiates between proposal from same session vs. other sessions

### 2. Server Booking Endpoint (server.js)

#### POST /api/booking - Availability Check

**Location:** `server.js:444-454`

**Logs when availability check fails:**

```javascript
console.error('[BOOKING] Availability check failed:', {
  roomId,
  date: dateStr,
  reason: availability.reason,
  sessionId: sessionId || 'none',
  existingBooking: availability.booking?.id || 'none',
  proposalId: availability.proposal?.proposal_id || 'none',
  timestamp: new Date().toISOString(),
});
```

**Data Captured:**
- `roomId` - Which room failed availability
- `date` - Specific date that's unavailable
- `reason` - Why it's unavailable (blocked/booked/proposed)
- `sessionId` - Current session making the request
- `existingBooking` - ID of conflicting booking (if reason is 'booked')
- `proposalId` - ID of conflicting proposal (if reason is 'proposed')
- `timestamp` - Exact time of the failure

### 3. Frontend Data Manager (data.js)

#### createBooking() Error Logging

**Location:** `data.js:310-319`

**Enhanced error logging:**

```javascript
console.error('[DataManager] Server returned error:', {
  error: errorData,
  bookingData: {
    rooms: bookingData.rooms,
    startDate: bookingData.startDate,
    endDate: bookingData.endDate,
    sessionId: bookingData.sessionId,
  },
  timestamp: new Date().toISOString(),
});
```

**Data Captured:**
- `error` - Complete error response from server
- `rooms` - Which rooms were being booked
- `startDate`/`endDate` - Date range of booking attempt
- `sessionId` - Session making the request
- `timestamp` - When the error occurred

## Session ID Support

The logging infrastructure now tracks session IDs to differentiate between:
1. **User's own proposals** - Should be excluded from availability checks
2. **Other users' proposals** - Should block availability

**Implementation:**
- Server: `getRoomAvailability(roomId, date, excludeSessionId)`
- Logs show both the proposal's session and the excluded session
- Helps identify when session exclusion logic fails

## Example Log Scenarios

### Scenario 1: Successful Booking (No Conflicts)

```
[DB] Checking availability: { roomId: '12', date: '2025-10-05', excludeSessionId: 'SESSION_123' }
[DB] Room available: { roomId: '12', date: '2025-10-05' }
[DB] Checking availability: { roomId: '12', date: '2025-10-06', excludeSessionId: 'SESSION_123' }
[DB] Room available: { roomId: '12', date: '2025-10-06' }
```

### Scenario 2: Blocked by Another User's Proposal

```
[DB] Checking availability: { roomId: '12', date: '2025-10-05', excludeSessionId: 'SESSION_123' }
[DB] Room has proposal: {
  roomId: '12',
  date: '2025-10-05',
  proposalSession: 'SESSION_456',
  excludedSession: 'SESSION_123'
}
[BOOKING] Availability check failed: {
  roomId: '12',
  date: '2025-10-05',
  reason: 'proposed',
  sessionId: 'SESSION_123',
  existingBooking: 'none',
  proposalId: 'PROP7xy8z9abc',
  timestamp: '2025-10-04T14:30:45.123Z'
}
[DataManager] Server returned error: {
  error: { error: 'Pokoj 12 není dostupný dne 2025-10-05' },
  bookingData: {
    rooms: ['12'],
    startDate: '2025-10-05',
    endDate: '2025-10-07',
    sessionId: 'SESSION_123'
  },
  timestamp: '2025-10-04T14:30:45.456Z'
}
```

### Scenario 3: Own Proposal Should Be Ignored

```
[DB] Checking availability: { roomId: '12', date: '2025-10-05', excludeSessionId: 'SESSION_123' }
[DB] Room has proposal: {
  roomId: '12',
  date: '2025-10-05',
  proposalSession: 'SESSION_123',  // Same as excluded session - should skip
  excludedSession: 'SESSION_123'
}
// ⚠️ BUG: If this causes failure, the session exclusion logic is broken
```

### Scenario 4: Blocked by Existing Booking

```
[DB] Checking availability: { roomId: '12', date: '2025-10-05', excludeSessionId: null }
[DB] Room booked: { roomId: '12', date: '2025-10-05', booking: 'BK1234567890ABC' }
[BOOKING] Availability check failed: {
  roomId: '12',
  date: '2025-10-05',
  reason: 'booked',
  sessionId: 'none',
  existingBooking: 'BK1234567890ABC',
  proposalId: 'none',
  timestamp: '2025-10-04T14:30:45.123Z'
}
```

### Scenario 5: Blocked Date

```
[DB] Checking availability: { roomId: '12', date: '2025-12-25', excludeSessionId: null }
[DB] Room blocked: { roomId: '12', date: '2025-12-25', blockage: 'BLK5abc6def7' }
[BOOKING] Availability check failed: {
  roomId: '12',
  date: '2025-12-25',
  reason: 'blocked',
  sessionId: 'none',
  existingBooking: 'none',
  proposalId: 'none',
  timestamp: '2025-10-04T14:30:45.123Z'
}
```

## How to Use These Logs

### 1. Debugging Availability Issues

**When a user reports "room shows available but booking fails":**

1. Check browser console for `[DataManager]` logs
2. Check server logs for `[BOOKING]` and `[DB]` logs
3. Correlate timestamps to find the failing request
4. Look at the `reason` field to identify the issue type
5. Check `sessionId` to verify session exclusion is working

### 2. Tracing Proposal Conflicts

**When investigating proposal-related issues:**

1. Look for logs showing `proposalSession` and `excludedSession`
2. If they match but availability still fails → session exclusion bug
3. If they differ and availability fails → correct behavior (another user has proposal)
4. Check proposal expiration times in database

### 3. Performance Monitoring

**Watch for excessive logging:**

- Too many `[DB] Checking availability` logs → calendar refreshing too often
- Multiple checks for same room/date → inefficient code
- Long gaps between log entries → slow database queries

## Testing Availability Logging

### Test 1: Own Proposal Exclusion

```bash
# Terminal 1: Watch server logs
npm start

# Terminal 2: Open browser console and run
# 1. Select dates in calendar (creates proposal)
# 2. Try to book same dates
# Expected: Should succeed without "proposed" conflict
# Logs should show: excludedSession === proposalSession
```

### Test 2: Conflict Detection

```bash
# Browser 1: Select dates (creates proposal with SESSION_A)
# Browser 2 (different session): Try to book same dates
# Expected: Should fail with "proposed" conflict
# Logs should show: excludedSession !== proposalSession
```

### Test 3: Log Correlation

```bash
# Watch all three log sources simultaneously:
# 1. Browser console → [DataManager] logs
# 2. Server stdout → [BOOKING] logs
# 3. Server stdout → [DB] logs
# Trace a single booking attempt through all layers using timestamps
```

## Key Improvements

1. **Structured Data:** All logs use JSON objects for easy parsing
2. **Consistent Format:** `[COMPONENT] Action: { data }` pattern throughout
3. **Correlation IDs:** Timestamps and sessionIds help trace requests
4. **Diagnostic Info:** Each log includes all context needed for debugging
5. **No Sensitive Data:** Logs don't include passwords, tokens, or personal info

## Future Enhancements

Consider adding:
- Request ID for tracing across distributed systems
- Log aggregation (e.g., Winston, Pino)
- Structured logging library
- Performance metrics (response times)
- Error rate monitoring
- Alert thresholds

## Common Issues & Solutions

### Issue: "Proposed" blocks own booking

**Symptoms:**
```
[DB] Room has proposal: { proposalSession: 'SESSION_123', excludedSession: 'SESSION_123' }
[BOOKING] Availability check failed: { reason: 'proposed' }
```

**Cause:** Session exclusion not working

**Fix:** Check that sessionId is passed to getRoomAvailability()

### Issue: Excessive logging

**Symptoms:** Console flooded with `[DB] Checking availability` logs

**Cause:** Calendar auto-refresh too frequent

**Fix:** Increase debounce time in auto-sync logic

### Issue: Timestamps don't match

**Symptoms:** Frontend timestamp differs from server by >1s

**Cause:** Clock skew between client and server

**Fix:** Use server-generated timestamps for correlation

## Log Retention

- **Development:** Console logs only (ephemeral)
- **Production:** Consider log aggregation service
- **Recommended:** Keep 30 days for debugging
- **Privacy:** Rotate/delete logs containing booking details per GDPR
