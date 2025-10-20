# Proposed Bookings System - Edge Day Handling Analysis
## Comprehensive Findings Report

**Analysis Date**: October 20, 2025  
**Status**: ✅ Complete - Critical Issue Identified  
**Priority**: HIGH - Affects user experience with edge day bookings

---

## KEY FINDING

**The proposed bookings system uses INCLUSIVE end date checking while confirmed bookings use EXCLUSIVE end date checking, causing asymmetric behavior on checkout/checkin days.**

### The Problem in One Sentence
Proposed bookings incorrectly block checkout days (last day of stay) from being booked as checkin days, while confirmed bookings correctly allow this back-to-back arrangement.

---

## DETAILED FINDINGS

### 1. Proposed Bookings Storage & Retrieval

**Database Schema** (`database.js:173-187`):
- Table: `proposed_bookings`
- Key field: `end_date` (stored as YYYY-MM-DD)
- Expiration: `expires_at` (NOW + 15 minutes)

**Storage is correct** - the issue is in the CHECKING logic, not storage.

### 2. The Core Issue: Two Different Date Models

#### Confirmed Bookings (CORRECT MODEL)
**File**: `js/shared/dateUtils.js:191-195`

```javascript
static isNightOccupied(nightDate, bookingStart, bookingEnd) {
  // EXCLUSIVE end date check
  return nightDate >= bookingStart && nightDate < bookingEnd;  // LINE 194: < not <=
}
```

**Example**: Booking 2025-10-06 to 2025-10-08
- Night 06→07: OCCUPIED (`06 >= 06 && 06 < 08` = TRUE)
- Night 07→08: OCCUPIED (`07 >= 06 && 07 < 08` = TRUE)
- Night 08→09: **FREE** (`08 >= 06 && 08 < 08` = FALSE) ✅

**Result**: Oct 8 (checkout day) is available for next booking to checkin

---

#### Proposed Bookings (INCORRECT MODEL)
**File 1**: `database.js:1484`

```sql
WHERE ... pbr.room_id = ?
AND ? >= pb.start_date AND ? <= pb.end_date    ← INCLUDES end date
AND pb.expires_at > ? ...
```

**File 2**: `data.js:580`

```javascript
checkDateStr >= pb.start_date && checkDateStr <= pb.end_date  // LINE 580: <= is wrong
```

**Example**: Proposal 2025-10-06 to 2025-10-08
- Date 06: BLOCKED (`06 >= 06 && 06 <= 08` = TRUE)
- Date 07: BLOCKED (`07 >= 06 && 07 <= 08` = TRUE)
- Date 08: **BLOCKED** (`08 >= 06 && 08 <= 08` = TRUE) ❌

**Result**: Oct 8 (checkout day) is blocked from checkout/checkin on same day

---

### 3. Impact on User Experience

| Scenario | Confirmed Bookings | Proposed Bookings | Issue |
|----------|-------------------|------------------|-------|
| Booking 1: Oct 6-8, Booking 2: Oct 8-10 | ✅ WORKS (back-to-back on 8) | ❌ FAILS (blocked on 8) | Asymmetric |
| Edge day (checkout) availability | ✅ Available | ❌ Blocked | Prevents typical turnover |
| Same-day checkout/checkin | ✅ Supported | ❌ Prevented | Bad UX |

### 4. Exact Code Locations

| Component | File | Lines | Issue | Fix |
|-----------|------|-------|-------|-----|
| **Server SQL** | `database.js` | 1484, 1492 | `<= pb.end_date` | Change to `< pb.end_date` |
| **Client JS** | `data.js` | 580 | `<= pb.end_date` | Change to `< pb.end_date` |
| **Documentation** | `data.js` | 581 (comment) | Says "blocks checkout" | Update to explain fix |

### 5. How Calendar Rendering Works

**Color Assignment**:
- 🟢 GREEN: Available (0 nights occupied)
- 🟠 ORANGE: Edge (1 night occupied) - **Still clickable**
- 🔴 RED: Occupied (2 nights occupied) - Not clickable
- 🟡 YELLOW: Proposed (temporary hold)

**Status Determination Priority**:
```
blocked > occupied > proposed > edge > available
```

**Where Rendering Happens** (`js/shared/BaseCalendar.js`):
- Calls `dataManager.getRoomAvailability(date, roomId)` for each cell
- Gets status from availability check (which uses the buggy proposed booking logic)
- Applies CSS class based on status
- Edge days are shown as ORANGE and are clickable

---

## ROOT CAUSE ANALYSIS

### Why This Bug Exists

1. **Confirmed bookings** use `DateUtils.isNightOccupied()` for night-based model (CORRECT)
2. **Proposed bookings** use direct date comparison (INCORRECT)
3. The proposed booking query was likely written before the night-based model was fully understood
4. Code comment on `data.js:581` even documents this as intentional: "INCLUSIVE end date for proposed bookings - blocks checkout day"
   - **This comment reveals the bug was introduced deliberately but should not have been**

### The Intent vs Reality

**The bug appears intentional** based on the comment, but it's **wrong because**:
- Confirmed bookings allow same-day checkout/checkin
- Proposed bookings should follow the same model
- The system explicitly states edge days ARE available for new bookings
- There's no business reason to block checkout days from proposed bookings

---

## THE FIX

### Change 1: Server-Side SQL Query
**File**: `/home/marianska/marianska/database.js`

**Line 1484** (with excludeSessionId):
```diff
- AND ? >= pb.start_date AND ? <= pb.end_date
+ AND ? >= pb.start_date AND ? < pb.end_date
```

**Line 1492** (without excludeSessionId):
```diff
- AND ? >= pb.start_date AND ? <= pb.end_date
+ AND ? >= pb.start_date AND ? < pb.end_date
```

### Change 2: Client-Side JavaScript
**File**: `/home/marianska/marianska/data.js`

**Line 580**:
```diff
- checkDateStr <= pb.end_date &&
+ checkDateStr < pb.end_date &&
```

### Change 3: Documentation
**File**: `/home/marianska/marianska/data.js`

**Line 581** (update comment):
```diff
- checkDateStr <= pb.end_date && // INCLUSIVE end date for proposed bookings - blocks checkout day
+ checkDateStr < pb.end_date && // EXCLUSIVE end date - allows checkout day for next booking
```

---

## VERIFICATION

### Before Fix
```javascript
// Proposal: 2025-10-06 to 2025-10-08
// Checking Oct 8 (checkout day)
08 >= 06 && 08 <= 08  // TRUE - BLOCKED ❌
```

### After Fix
```javascript
// Proposal: 2025-10-06 to 2025-10-08
// Checking Oct 8 (checkout day)
08 >= 06 && 08 < 08   // FALSE - AVAILABLE ✅
```

---

## TEST CASE

### Setup
1. Create confirmed booking: 2025-10-06 to 2025-10-08
2. Observe Oct 8 status on calendar
3. Try to create proposed booking: 2025-10-08 to 2025-10-10
4. Check if Oct 8 can be selected

### Current Behavior (Buggy)
- Oct 8 shows as blocked/occupied
- Cannot create second proposal starting Oct 8
- User sees yellow (proposed) on Oct 8

### Expected Behavior (After Fix)
- Oct 8 shows as edge (partially available)
- Can create second proposal starting Oct 8
- Back-to-back bookings work like confirmed bookings

---

## ARCHITECTURAL NOTES

### Why This Matters
1. **SSOT Principle**: All date models should use the same logic
2. **Consistency**: Proposed and confirmed bookings should behave identically
3. **User Experience**: Standard hotel turnover (checkout → checkin same day) should work
4. **Business Logic**: No reason to block checkout days from temporary reservations

### Why DateUtils.isNightOccupied is the Gold Standard
```javascript
// This is the CORRECT model throughout the entire system
// Should be used for both confirmed AND proposed bookings
nightDate >= bookingStart && nightDate < bookingEnd;  // EXCLUSIVE end
```

---

## RELATED DOCUMENTATION

- See: `PROPOSED_BOOKINGS_SUMMARY.txt` - Quick reference
- See: `PROPOSED_BOOKINGS_ANALYSIS.md` - Complete flow diagrams
- See: `PROPOSED_BOOKINGS_CODE_FLOW.md` - Step-by-step execution paths

---

## SUMMARY

| Aspect | Finding |
|--------|---------|
| **Issue Type** | Logic Error - Inconsistent Date Model |
| **Severity** | HIGH - Affects core booking functionality |
| **Scope** | 2 files, 3 locations |
| **Fix Complexity** | LOW - Simple operator change (≤ to <) |
| **Test Coverage** | Easy to verify with calendar UI |
| **Production Impact** | Fixes edge day availability bug |

---

**Analysis Complete** ✅

