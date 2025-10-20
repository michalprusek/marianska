# Proposed Bookings System - Edge Day Handling Analysis

**Analysis Date**: 2025-10-20  
**Focus**: How proposed bookings handle edge days vs confirmed bookings  
**Key Finding**: **CRITICAL DIFFERENCE - Proposed bookings use INCLUSIVE end date checking, while confirmed bookings use EXCLUSIVE end date checking**

---

## Executive Summary

The proposed bookings system currently has **asymmetric edge day handling** compared to confirmed bookings:

- **Confirmed bookings**: Use EXCLUSIVE end date model (checkout day night is FREE for next guest)
- **Proposed bookings**: Use INCLUSIVE end date model (checkout day is BLOCKED as if occupied)

This means:
- Two confirmed bookings can have back-to-back checkout/checkin on same day ✅
- A proposed booking BLOCKS the checkout day entirely ❌ (incorrect - should follow same model)
- Edge days in proposed bookings are unnecessarily restrictive

---

## 1. HOW PROPOSED BOOKINGS ARE STORED AND CHECKED

### Storage Location
- **Database table**: `proposed_bookings` (database.js:173-187)
- **Junction table**: `proposed_booking_rooms` (maps proposal to rooms)
- **Key fields**:
  - `proposal_id`: Unique identifier
  - `session_id`: User's browser session
  - `start_date`: First day of proposed booking (YYYY-MM-DD)
  - `end_date`: Last day of proposed booking (YYYY-MM-DD)
  - `expires_at`: Expiration timestamp (NOW + 15 minutes)

### Server-Side Availability Check
**File**: `database.js:1416-1531`

```javascript
getRoomAvailability(roomId, date, excludeSessionId = null) {
  // ... blockage check ...
  
  // Check for proposed bookings (lines 1476-1509)
  const now = new Date().toISOString();
  const proposedQuery = excludeSessionId
    ? `
        SELECT pb.* FROM proposed_bookings pb
        JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
        WHERE pbr.room_id = ?
        AND ? >= pb.start_date AND ? <= pb.end_date    ← INCLUSIVE check
        AND pb.expires_at > ?
        AND pb.session_id != ?
      `
    : `
        SELECT pb.* FROM proposed_bookings pb
        JOIN proposed_booking_rooms pbr ON pb.proposal_id = pbr.proposal_id
        WHERE pbr.room_id = ?
        AND ? >= pb.start_date AND ? <= pb.end_date    ← INCLUSIVE check
        AND pb.expires_at > ?
      `;

  const proposedBookings = this.db.prepare(proposedQuery).all(...proposedParams);

  if (proposedBookings.length > 0) {
    return {
      available: false,
      status: 'proposed',
      reason: 'proposed',
      proposal: proposedBookings[0],
    };
  }
}
```

**Key Point**: Line 1484 and 1492 use `? <= pb.end_date` which is **INCLUSIVE**.

### Client-Side Availability Check
**File**: `data.js:530-650`

```javascript
async getRoomAvailability(date, roomId, excludeSessionId = null, excludeBookingId = null) {
  // ... blockage check ...
  
  // Check for proposed bookings (lines 571-590)
  try {
    const proposedBookings = await this.getProposedBookings();
    const shouldExcludeSession = excludeSessionId === undefined;
    const sessionToExclude = shouldExcludeSession ? this.sessionId : excludeSessionId;

    const hasProposedBooking = proposedBookings.some(
      (pb) =>
        pb.rooms.includes(roomId) &&
        checkDateStr >= pb.start_date &&
        checkDateStr <= pb.end_date && // INCLUSIVE end date for proposed bookings - blocks checkout day
        (sessionToExclude === '' || pb.session_id !== sessionToExclude)
    );

    if (hasProposedBooking) {
      return { status: 'proposed', email: null };
    }
  } catch (error) {
    console.error('Failed to check proposed bookings:', error);
  }
}
```

**Key Point**: Line 580-581 comment explicitly states "INCLUSIVE end date for proposed bookings - blocks checkout day"

---

## 2. CONFIRMED BOOKING AVAILABILITY LOGIC (FOR COMPARISON)

### The Night-Based Model
**File**: `js/shared/dateUtils.js:169-195`

```javascript
/**
 * Check if a night is occupied by a booking
 *
 * IMPORTANT: Uses EXCLUSIVE end date for nights (nightDate < bookingEnd)
 * - A night is the period from date to date+1
 * - Example: Night of 2025-10-05 = period from 2025-10-05 to 2025-10-06
 *
 * Date Model:
 * - Days are INCLUSIVE (booking 6.10-8.10 = 3 days: 6.10, 7.10, 8.10)
 * - Nights are EXCLUSIVE on the end (booking 6.10-8.10 = 2 nights: 6→7, 7→8)
 * - Checkout day night (8→9) is FREE for next guest
 *
 * Example - Booking from 2025-10-06 to 2025-10-08:
 * - Night 2025-10-06 (06→07): OCCUPIED ✓
 * - Night 2025-10-07 (07→08): OCCUPIED ✓
 * - Night 2025-10-08 (08→09): FREE ✗ (checkout day, available for next booking)
 */
static isNightOccupied(nightDate, bookingStart, bookingEnd) {
  // EXCLUSIVE end date check: nightDate < bookingEnd    ← KEY DIFFERENCE!
  // This allows back-to-back bookings (checkout day night is free)
  return nightDate >= bookingStart && nightDate < bookingEnd;  // LINE 194
}
```

### How Confirmed Bookings Use This

**File**: `database.js:1461-1472`

```javascript
// Check if each night is occupied by any booking using DateUtils (INCLUSIVE end date model)
for (const booking of allBookings) {
  // Use DateUtils.isNightOccupied for consistent inclusive end date logic
  if (DateUtils.isNightOccupied(nightBefore, booking.startDate, booking.endDate)) {
    nightBeforeOccupied = true;
    bookingEmail = booking.email;
  }
  if (DateUtils.isNightOccupied(nightAfter, booking.startDate, booking.endDate)) {  ← EXCLUSIVE
    nightAfterOccupied = true;
    bookingEmail = booking.email;
  }
}
```

---

## 3. CRITICAL DIFFERENCE: EDGE DAY HANDLING

### Example Scenario

**Confirmed Booking 1**: 2025-10-06 to 2025-10-08 (stays 3 days: 6, 7, 8)
- Night 2025-10-06 (06→07): OCCUPIED
- Night 2025-10-07 (07→08): OCCUPIED
- Night 2025-10-08 (08→09): **FREE** (because 08 < 08 is false)

**Confirmed Booking 2**: 2025-10-08 (check-in on checkout day)
- Night 2025-10-08 (08→09): AVAILABLE (can book on checkout day)
- **Result**: ✅ Back-to-back bookings work!

### But With Proposed Booking

**Proposed Booking 1**: 2025-10-06 to 2025-10-08
- Using INCLUSIVE check: `date >= start AND date <= end`
- 2025-10-06: `06 >= 06 AND 06 <= 08` = TRUE (occupied)
- 2025-10-07: `07 >= 06 AND 07 <= 08` = TRUE (occupied)
- 2025-10-08: `08 >= 06 AND 08 <= 08` = **TRUE** (occupied) ❌

**Proposed Booking 2 on 2025-10-08**:
- Check: `08 >= 06 AND 08 <= 08` = **TRUE** (BLOCKED!)
- **Result**: ❌ Cannot book on same day checkout/checkin!

---

## 4. AVAILABILITY CHECKING CODE LOCATIONS

### Server-Side (Backend)
- **File**: `/home/marianska/marianska/database.js`
- **Method**: `getRoomAvailability(roomId, date, excludeSessionId = null)`
- **Lines**: 1416-1531
- **Proposed booking check**: Lines 1476-1509
- **Confirmed booking check**: Lines 1461-1472 (uses `DateUtils.isNightOccupied`)

### Client-Side (Frontend)
- **File**: `/home/marianska/marianska/data.js`
- **Method**: `getRoomAvailability(date, roomId, excludeSessionId, excludeBookingId)`
- **Lines**: 530-650
- **Proposed booking check**: Lines 571-590
- **Confirmed booking check**: Lines 611-650 (uses `DateUtils.isNightOccupied`)

### Night Logic Utility
- **File**: `/home/marianska/marianska/js/shared/dateUtils.js`
- **Method**: `isNightOccupied(nightDate, bookingStart, bookingEnd)`
- **Lines**: 169-195
- **Logic**: `nightDate >= bookingStart && nightDate < bookingEnd` (EXCLUSIVE end)

---

## 5. CALENDAR RENDERING - HOW COLORS ARE DETERMINED

### Color Assignment Logic
**File**: `js/shared/BaseCalendar.js`

```javascript
// Lines showing status to color mapping:
// - available: Green (#10b981)
// - edge: Orange (with half-colored indicator)
// - occupied: Red (#ef4444)
// - proposed: Amber/Yellow (#f59e0b)
// - blocked: Gray (#9ca3af)

// Status determination logic (PRIORITY ORDER):
// Priority: blocked > occupied > proposed > edge > available

// For multi-room days (grid view):
if (availabilities.some((a) => a.status === 'occupied')) {
  return { status: 'occupied', ... };
}
// Check for proposed bookings
if (availabilities.some((a) => a.status === 'proposed')) {
  return { status: 'proposed', ... };
}
// Check for edge days (at least one room has edge status)
const edgeAvailability = availabilities.find((a) => a.status === 'edge');
if (edgeAvailability) {
  return { status: 'edge', ... };
}
// All rooms available
return { status: 'available', ... };
```

### Cell Rendering with Colors

**File**: `js/shared/BaseCalendar.js` (calendar cell rendering)

```javascript
const status = availability?.status || 'available';

if (status === 'occupied') {
  // Occupied = BOTH nights around day are occupied - red, NOT clickable
  classes.push('occupied');
  styles.push('background: #ef4444; color: white;');
} else if (status === 'edge') {
  // Edge = exactly ONE night occupied - half green (available) / half red (occupied)
  classes.push('edge-day');
  // Edge day IS clickable (available for new booking)
} else if (status === 'proposed') {
  classes.push('proposed');
  styles.push('background: #f59e0b; color: white;');
} else {
  classes.push('available');
  styles.push('background: #10b981; color: white;');
}
```

---

## 6. KEY ISSUES AND DIFFERENCES

### Issue #1: Inconsistent Date Model

| Aspect | Confirmed Bookings | Proposed Bookings |
|--------|-------------------|-------------------|
| **End date model** | EXCLUSIVE (`nightDate < bookingEnd`) | INCLUSIVE (`date <= pb.end_date`) |
| **Line in code** | `dateUtils.js:194` | `database.js:1484`, `data.js:580` |
| **Checkout day available?** | ✅ YES (free for next guest) | ❌ NO (blocked) |
| **Back-to-back bookings?** | ✅ YES (same day checkout/checkin) | ❌ NO (checkout day blocked) |

### Issue #2: Proposal Blocks Edge Day Incorrectly

**Scenario**: 
- Confirmed booking: 2025-10-04 to 2025-10-06
- Proposed booking: 2025-10-06 to 2025-10-08

**What happens**:
- Oct 06 is checkout day for confirmed booking (FREE night)
- Oct 06 is blocked for proposed booking (INCLUSIVE check)
- User cannot create proposal for Oct 06 checkout day

**Should happen**:
- Oct 06 should be available (checkout day is free)
- Proposed booking should use EXCLUSIVE model like confirmed bookings

### Issue #3: Edge Day Handling Different for Proposals

**File**: `database.js:1514-1522`

```javascript
// Confirmed bookings on edge day:
else if (occupiedCount === 1) {
  return {
    available: true,  // ← AVAILABLE on edge day! Can create new booking
    status: 'edge',
    reason: 'edge',
    email: bookingEmail,
    nightBefore: nightBeforeOccupied,
    nightAfter: nightAfterOccupied,
  };
}

// But proposed bookings BLOCK edge days entirely (INCLUSIVE check)
// So edge day is NOT available for new proposed bookings
```

---

## 7. SPECIFIC CODE SNIPPETS SHOWING THE DIFFERENCE

### Proposed Booking Check (INCLUSIVE)
**File**: `database.js:1484`
```sql
AND ? >= pb.start_date AND ? <= pb.end_date
```
Query uses both `>=` and `<=` (INCLUSIVE on both ends)

### Confirmed Booking Check (EXCLUSIVE end)
**File**: `database.js:1464`
```javascript
DateUtils.isNightOccupied(nightBefore, booking.startDate, booking.endDate)
```
Which calls (dateUtils.js:194):
```javascript
return nightDate >= bookingStart && nightDate < bookingEnd;  // < not <=
```

### Client-Side Comparison

**Proposed (INCLUSIVE)**:
```javascript
// data.js:580
checkDateStr >= pb.start_date && checkDateStr <= pb.end_date
```

**Confirmed (EXCLUSIVE)**:
```javascript
// data.js:622
DateUtils.isNightOccupied(nightBefore, booking.startDate, booking.endDate)
```

---

## 8. IMPACT ON EDGE DAY BEHAVIOR

### For Confirmed Bookings
- **Checkout day (2025-10-08 from booking 06-08)**:
  - Night 08→09: FREE
  - Calendar shows: GREEN or EDGE (depending on next booking)
  - Can create new booking starting 2025-10-08: ✅ YES

### For Proposed Bookings
- **Checkout day (2025-10-08 from proposal 06-08)**:
  - Entire day: BLOCKED (due to INCLUSIVE check)
  - Calendar shows: YELLOW (proposed)
  - Can create another proposal starting 2025-10-08: ❌ NO (blocked)

---

## 9. WHERE CHANGES ARE NEEDED

### Change 1: Server-Side Proposed Booking Query
**File**: `/home/marianska/marianska/database.js`  
**Lines**: 1479-1494  
**Issue**: Uses INCLUSIVE end date check `<= pb.end_date`  
**Fix**: Should use EXCLUSIVE end date like confirmed bookings

```diff
- AND ? >= pb.start_date AND ? <= pb.end_date
+ AND ? >= pb.start_date AND ? < pb.end_date
```

### Change 2: Client-Side Proposed Booking Check
**File**: `/home/marianska/marianska/data.js`  
**Lines**: 577-583  
**Issue**: Uses INCLUSIVE check `<= pb.end_date`  
**Fix**: Should use EXCLUSIVE or leverage DateUtils

```diff
  const hasProposedBooking = proposedBookings.some(
    (pb) =>
      pb.rooms.includes(roomId) &&
      checkDateStr >= pb.start_date &&
-     checkDateStr <= pb.end_date &&
+     checkDateStr < pb.end_date &&
      (sessionToExclude === '' || pb.session_id !== sessionToExclude)
  );
```

### Change 3: Documentation Update
**File**: `/home/marianska/marianska/data.js`  
**Lines**: 581 (comment)  
**Issue**: Comment says "blocks checkout day" - this is the bug!  
**Fix**: Update comment to explain new behavior

```diff
- checkDateStr <= pb.end_date && // INCLUSIVE end date for proposed bookings - blocks checkout day
+ checkDateStr < pb.end_date && // EXCLUSIVE end date - allows checkout day for next booking
```

---

## 10. SUMMARY TABLE

| Aspect | Location | Current Logic | Correct Logic | Issue |
|--------|----------|---------------|---------------|-------|
| **Server proposed check** | `database.js:1484` | `<= pb.end_date` | `< pb.end_date` | Blocks checkout day |
| **Client proposed check** | `data.js:580` | `<= pb.end_date` | `< pb.end_date` | Blocks checkout day |
| **Server confirmed check** | `database.js:1464` | `< bookingEnd` (via DateUtils) | ✅ Correct | Allows checkout day |
| **Client confirmed check** | `data.js:626` | `< bookingEnd` (via DateUtils) | ✅ Correct | Allows checkout day |
| **Checkout day availability** | All locations | Proposed: BLOCKED | Proposed: ALLOWED | Asymmetric handling |

---

## 11. TEST CASE TO VERIFY THE BUG

**Setup**:
1. Create confirmed booking: 2025-10-06 to 2025-10-08
2. Try to create proposed booking: 2025-10-08 to 2025-10-10

**Current Behavior**:
- Oct 08 shows as PROPOSED (blocked by proposal)
- User cannot create new proposal starting Oct 08

**Expected Behavior**:
- Oct 08 shows as EDGE (checkout day is free)
- User CAN create new proposal starting Oct 08

**Code Path**:
1. Calendar renders Oct 08 cell
2. Calls `dataManager.getRoomAvailability(oct08, roomId)`
3. Checks proposed bookings (line 577-583)
4. Finds proposal 06-08
5. Checks: `oct08 >= oct06 AND oct08 <= oct08` = TRUE (WRONG!)
6. Should check: `oct08 >= oct06 AND oct08 < oct08` = FALSE (CORRECT)

