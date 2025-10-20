# Calendar Cell Coloring and Clickability Logic - Comprehensive Analysis

**Date:** 2025-10-20  
**Analysis Scope:** Calendar rendering, availability determination, cell coloring, clickability  
**Key Files:**
- `/home/marianska/marianska/js/shared/BaseCalendar.js` - Calendar rendering (createDayCell)
- `/home/marianska/marianska/data.js` - Availability status determination (getRoomAvailability)
- `/home/marianska/marianska/js/shared/dateUtils.js` - Night-based availability model
- `/home/marianska/marianska/server.js` - Backend availability checks

---

## 1. CALENDAR CELL COLORING SYSTEM

### Color Palette

| Status | Color | Hex Code | RGB | CSS | Clickable | Meaning |
|--------|-------|----------|-----|-----|-----------|---------|
| **Available** | Green | `#10b981` | RGB(16, 185, 129) | Tailwind `bg-emerald-500` | ✅ YES | No bookings, both nights free |
| **Occupied** | Red | `#ef4444` | RGB(239, 68, 68) | Tailwind `bg-red-500` | ❌ NO | Both nights around day occupied |
| **Edge** | Split (Green/Red) | Gradient | Linear 90° | Gradient `50%/50%` | ✅ YES | Exactly one night occupied |
| **Proposed** | Orange/Amber | `#f59e0b` | RGB(245, 158, 11) | Tailwind `bg-amber-500` | ❌ NO | Temporary hold (15-min expiry) |
| **Blocked** | Gray | `#9ca3af` | RGB(156, 163, 175) | Tailwind `bg-gray-400` | ❌ NO | Admin-blocked date |
| **Christmas** | Gold border | N/A | N/A | `box-shadow: gold inset` | Varies | Date in Christmas period |
| **Selected** | Blue | `#2563eb` | RGB(37, 99, 235) | Tailwind `bg-blue-600` | N/A | User selected this date |
| **Selected (Anchor)** | Dark Blue | `#1e40af` | RGB(30, 64, 175) | Tailwind `bg-blue-900` | N/A | First clicked date |
| **Past Date** | Light Gray | `#f3f4f6` | RGB(243, 244, 246) | Tailwind `bg-gray-100` | ❌ NO | Date before today |
| **Other Month** | Light Gray | `#e5e7eb` | RGB(229, 231, 235) | Tailwind `bg-gray-200` | ❌ NO | Not in current month |

### Cell Color Assignment Logic

**File:** `/home/marianska/marianska/js/shared/BaseCalendar.js` (lines 305-396)

```javascript
async createDayCell(day, roomId, availability) {
  const classes = ['calendar-day-cell'];
  const styles = [];
  let clickable = true;

  // Priority 1: Other month check (lowest priority)
  if (day.isOtherMonth) {
    classes.push('other-month');
    styles.push('opacity: 0.4; background: #e5e7eb; color: #6b7280;');
    clickable = false;
  }

  // Priority 2: Past date check (TIMEZONE-SAFE: uses string comparison)
  const todayStr = DateUtils.formatDate(app.today || new Date());
  if (!this.config.allowPast && dateStr < todayStr) {
    classes.push('past-date');
    styles.push('opacity: 0.5; background: #f3f4f6; color: #9ca3af;');
    clickable = false;
  }

  // Priority 3: Christmas period indicator (overlay on top)
  if (await dataManager.isChristmasPeriod(date)) {
    classes.push('christmas-period');
    styles.push('box-shadow: 0 0 0 2px gold inset;');  // Gold border
  }

  // Priority 4: Availability-based styling (main logic)
  // ONLY applies if not other month and (allowPast OR not in past)
  if (!day.isOtherMonth && (this.config.allowPast || dateStr >= todayStr)) {
    const status = availability?.status || 'available';

    if (status === 'blocked') {
      // Admin-blocked date
      classes.push('blocked');
      styles.push('background: #9ca3af; color: white;');  // Gray
      clickable = false;

    } else if (status === 'occupied') {
      // BOTH nights around day occupied
      classes.push('occupied');
      styles.push('background: #ef4444; color: white;');  // Red
      clickable = false;

    } else if (status === 'edge') {
      // EXACTLY ONE night occupied
      classes.push('edge-day');
      const nightBefore = availability?.nightBefore;
      const nightAfter = availability?.nightAfter;

      if (nightBefore && !nightAfter) {
        // Left half red (night before), right half green (night after free)
        styles.push(
          'background: linear-gradient(90deg, #ef4444 0%, #ef4444 50%, #10b981 50%, #10b981 100%);'
        );
      } else if (!nightBefore && nightAfter) {
        // Left half green (night before free), right half red (night after)
        styles.push(
          'background: linear-gradient(90deg, #10b981 0%, #10b981 50%, #ef4444 50%, #ef4444 100%);'
        );
      }

      clickable = true;  // Edge days ARE clickable

    } else if (status === 'proposed') {
      // Temporary hold (yellow)
      classes.push('proposed');
      styles.push('background: #f59e0b; color: white;');  // Orange/Amber
      clickable = false;

    } else {
      // status === 'available' (default)
      classes.push('available');
      styles.push('background: #10b981; color: white;');  // Green
    }
  }

  // Priority 5: Selection state (overrides all colors with !important)
  if (this.selectedDates.has(dateStr)) {
    classes.push('selected');
    if (this.intervalState.firstClick === dateStr && !this.intervalState.secondClick) {
      // Anchor point (first click)
      styles.push(
        'background: #1e40af !important; color: white !important;'  // Dark blue
      );
    } else {
      // Regular selected date
      styles.push(
        'background: #2563eb !important; color: white !important;'  // Blue
      );
    }
  }

  // Apply styles
  const cursor = clickable ? 'pointer' : 'not-allowed';
  return `
    <div
      class="${classes.join(' ')}"
      data-date="${dateStr}"
      data-room="${roomId}"
      data-clickable="${clickable}"
      style="${baseStyle} ${styleStr} cursor: ${cursor};"
    >
      ${content}
    </div>
  `;
}
```

---

## 2. CLICKABILITY LOGIC

### Clickable vs Non-Clickable Cells

```
CLICKABLE (pointer cursor):
├── Available (green)
├── Edge (split green/red)
└── Selected (blue - overrides all)

NON-CLICKABLE (not-allowed cursor):
├── Occupied (red)
├── Blocked (gray)
├── Proposed (orange)
├── Past dates (light gray)
├── Other month (light gray)
└── Outside of mode boundaries
```

### Clickability Determination

**File:** `/home/marianska/marianska/js/shared/BaseCalendar.js` (lines 305-396)

```javascript
// Clickable is determined by:
let clickable = true;  // Default

// Rule 1: Not clickable if other month
if (day.isOtherMonth) {
  clickable = false;
}

// Rule 2: Not clickable if past (and not allowPast mode)
if (!this.config.allowPast && dateStr < todayStr) {
  clickable = false;
}

// Rule 3: Not clickable if blocked/occupied/proposed
if (status === 'blocked' || status === 'occupied' || status === 'proposed') {
  clickable = false;
}

// Rule 4: IS clickable if edge (exactly one night occupied)
if (status === 'edge') {
  clickable = true;  // CAN book on checkout/check-in day
}

// Apply clickability
const cursor = clickable ? 'pointer' : 'not-allowed';
cell.dataset.clickable = clickable ? 'true' : 'false';
```

### Event Listeners (Only Attached to Clickable Cells)

**File:** `/home/marianska/marianska/js/shared/BaseCalendar.js` (lines 515-575)

```javascript
attachEventListeners() {
  const container = document.getElementById(this.config.containerId);

  // Day cells - click and hover handlers
  container.querySelectorAll('.calendar-day-cell').forEach((cell) => {
    const clickable = cell.dataset.clickable === 'true';

    if (!clickable) {
      return;  // Skip non-clickable cells
    }

    // Only clickable cells get event listeners
    const clickHandler = () => this.handleDateClick(dateStr);
    const enterHandler = () => {
      if (this.intervalState.firstClick && !this.intervalState.secondClick) {
        this.updatePreview(dateStr);  // Show preview on hover
      }
    };
    const leaveHandler = () => {
      if (this.intervalState.firstClick && !this.intervalState.secondClick) {
        this.clearPreview();  // Clear preview on leave
      }
    };

    cell.addEventListener('click', clickHandler);
    cell.addEventListener('mouseenter', enterHandler);
    cell.addEventListener('mouseleave', leaveHandler);
  });
}
```

---

## 3. THE NIGHT-BASED AVAILABILITY MODEL

### Conceptual Overview

The system uses a **"2 nights around each day" model** to determine availability:

```
Day Model (INCLUSIVE):
  Reservation 2025-10-06 to 2025-10-08 = 3 days
  └─ Oct 6 (check-in), Oct 7 (middle), Oct 8 (check-out)

Night Model (per day):
  Each day has 2 nights around it:
  ├─ "Night Before" = night from (day-1) → day
  └─ "Night After" = night from day → (day+1)

Availability Status Determination:
  ├─ Available: 0 nights occupied → GREEN (clickable)
  ├─ Edge: 1 night occupied → SPLIT COLOR (clickable)
  └─ Occupied: 2 nights occupied → RED (NOT clickable)
```

### Example: Day Oct 7 with Bookings

```
Booking 1: Oct 5 → Oct 7
Booking 2: Oct 7 → Oct 9

Oct 7 Night Analysis:
├─ Night Before (Oct 6 → Oct 7): OCCUPIED by Booking 1
└─ Night After (Oct 7 → Oct 8): OCCUPIED by Booking 2
Result: BOTH NIGHTS OCCUPIED = RED (OCCUPIED) = NOT CLICKABLE
```

### Example: Day Oct 7 with Only Morning Checkout

```
Booking: Oct 5 → Oct 7  (ends Oct 7)

Oct 7 Night Analysis:
├─ Night Before (Oct 6 → Oct 7): OCCUPIED by booking
└─ Night After (Oct 7 → Oct 8): FREE (checkout day, guest leaves)
Result: EXACTLY ONE NIGHT = SPLIT COLOR (EDGE) = CLICKABLE for next guest
```

### Night Occupation Detection

**File:** `/home/marianska/marianska/js/shared/dateUtils.js` (lines 169-195)

```javascript
/**
 * Check if a night is occupied by a booking
 *
 * IMPORTANT: Uses EXCLUSIVE end date for nights
 * - A night is the period from date to date+1
 * - Night is occupied if: nightDate >= bookingStart AND nightDate < bookingEnd
 *
 * Example - Booking from 2025-10-06 to 2025-10-08:
 * - Night 2025-10-06 (06→07): OCCUPIED ✓
 * - Night 2025-10-07 (07→08): OCCUPIED ✓
 * - Night 2025-10-08 (08→09): FREE ✗ (checkout day available for next)
 */
static isNightOccupied(nightDate, bookingStart, bookingEnd) {
  // EXCLUSIVE end date: nightDate < bookingEnd
  return nightDate >= bookingStart && nightDate < bookingEnd;
}
```

### Availability Status Determination

**File:** `/home/marianska/marianska/data.js` (lines 530-650)

```javascript
async getRoomAvailability(date, roomId, excludeSessionId = null, excludeBookingId = null) {
  // Step 1: Get all bookings for this room (excluding the one being edited)
  const roomBookings = data.bookings
    .filter(booking => booking.rooms.includes(roomId))
    .filter(booking => !excludeBookingId || booking.id !== excludeBookingId);

  // Step 2: Calculate nights around the day
  const nightBefore = DateUtils.getPreviousDay(checkDateStr);  // night from (day-1) → day
  const nightAfter = checkDateStr;                             // night from day → (day+1)

  let nightBeforeOccupied = false;
  let nightAfterOccupied = false;

  // Step 3: Check if each night is occupied by any booking
  for (const booking of roomBookings) {
    // Night occupied if: nightDate >= bookingStart AND nightDate < bookingEnd
    if (DateUtils.isNightOccupied(nightBefore, booking.startDate, booking.endDate)) {
      nightBeforeOccupied = true;
    }
    if (DateUtils.isNightOccupied(nightAfter, booking.startDate, booking.endDate)) {
      nightAfterOccupied = true;
    }
  }

  // Step 4: Determine status based on occupied night count
  const occupiedCount = (nightBeforeOccupied ? 1 : 0) + (nightAfterOccupied ? 1 : 0);

  if (occupiedCount === 0) {
    return { status: 'available', email: null };
  } else if (occupiedCount === 1) {
    return {
      status: 'edge',
      email: bookingEmail || null,
      nightBefore: nightBeforeOccupied,
      nightAfter: nightAfterOccupied
    };
  }
  // occupiedCount === 2
  return {
    status: 'occupied',
    email: bookingEmail || null
  };
}
```

---

## 4. STATUS DEFINITIONS AND EDGE DETECTION

### Status Types

#### 1. **AVAILABLE** (Green)
- **Condition:** 0 nights occupied
- **Clickable:** YES
- **Color:** `#10b981` (green)
- **Meaning:** Room is free for booking
- **Next State:** Can be selected for interval

#### 2. **OCCUPIED** (Red)
- **Condition:** 2 nights occupied (both night before AND night after)
- **Clickable:** NO
- **Color:** `#ef4444` (red)
- **Meaning:** Guest already occupying room or fully booked
- **Next State:** Cannot be selected

#### 3. **EDGE** (Split Green/Red)
- **Condition:** Exactly 1 night occupied (either before OR after, but not both)
- **Clickable:** YES
- **Color:** Linear gradient 50% red / 50% green
  - Left half red if night before occupied: `linear-gradient(90deg, #ef4444 50%, #10b981 50%)`
  - Right half red if night after occupied: `linear-gradient(90deg, #10b981 50%, #ef4444 50%)`
- **Meaning:** Checkout or check-in day (guest leaving in morning or arriving in evening)
- **Next State:** Can be selected for new booking (available for next guest)
- **Visual Details:**
  ```javascript
  const nightBefore = availability?.nightBefore;
  const nightAfter = availability?.nightAfter;
  
  if (nightBefore && !nightAfter) {
    // Night before occupied: LEFT RED, RIGHT GREEN
    background: linear-gradient(90deg, #ef4444 0%, #ef4444 50%, #10b981 50%, #10b981 100%);
  } else if (!nightBefore && nightAfter) {
    // Night after occupied: LEFT GREEN, RIGHT RED
    background: linear-gradient(90deg, #10b981 0%, #10b981 50%, #ef4444 50%, #ef4444 100%);
  }
  ```

#### 4. **PROPOSED** (Orange/Amber)
- **Condition:** Temporary hold by another user (expires in 15 minutes)
- **Clickable:** NO
- **Color:** `#f59e0b` (amber)
- **Meaning:** Someone else is filling out booking form for this room/date
- **Session Isolation:** Only blocks OTHER users' proposals (same session excluded)
- **Expiry:** Auto-deleted after 15 minutes
- **Next State:** Converts to OCCUPIED if booking completes, reverts to original status if expires

#### 5. **BLOCKED** (Gray)
- **Condition:** Admin has blocked these dates
- **Clickable:** NO
- **Color:** `#9ca3af` (gray)
- **Meaning:** Room unavailable by admin decision (maintenance, reserved, etc.)
- **Management:** Set via admin panel

#### 6. **PAST DATE** (Light Gray)
- **Condition:** Date before today (unless `allowPast` config enabled)
- **Clickable:** NO
- **Color:** `#f3f4f6` (light gray) with opacity 0.5
- **Meaning:** Historical date
- **Scope:** Applies across all rooms/modes

#### 7. **OTHER MONTH** (Light Gray)
- **Condition:** Date from previous/next month
- **Clickable:** NO
- **Color:** `#e5e7eb` (light gray) with opacity 0.4
- **Meaning:** Outside current calendar view
- **Scope:** Applies to calendar grid only

#### 8. **CHRISTMAS PERIOD** (Gold Border)
- **Condition:** Date falls within configured Christmas period
- **Overlay:** Applied ON TOP of other colors
- **Visual:** `box-shadow: 0 0 0 2px gold inset;`
- **Clickable:** Varies (depends on other status)
- **Meaning:** Special rules apply (access code, room limits)

### Edge Day Detection Algorithm

**File:** `/home/marianska/marianska/data.js` (lines 611-650)

```javascript
// Edge detection logic:
const nightBefore = DateUtils.getPreviousDay(checkDateStr);
const nightAfter = checkDateStr;

// Count occupied nights
let occupiedCount = 0;
if (DateUtils.isNightOccupied(nightBefore, booking.startDate, booking.endDate)) {
  occupiedCount++;
}
if (DateUtils.isNightOccupied(nightAfter, booking.startDate, booking.endDate)) {
  occupiedCount++;
}

// Determine status
if (occupiedCount === 1) {
  status = 'edge';  // Exactly ONE night occupied
  // Store which night for visual indication
  return {
    status: 'edge',
    nightBefore: nightBeforeOccupied,
    nightAfter: nightAfterOccupied
  };
}
```

---

## 5. PROPOSED BOOKINGS INTEGRATION

### How Proposed Bookings Affect Display

**File:** `/home/marianska/marianska/data.js` (lines 571-590)

```javascript
// HIGHEST PRIORITY CHECK - before checking actual bookings
const proposedBookings = await this.getProposedBookings();
const shouldExcludeSession = excludeSessionId === undefined;
const sessionToExclude = shouldExcludeSession ? this.sessionId : excludeSessionId;

const hasProposedBooking = proposedBookings.some(
  (pb) =>
    pb.rooms.includes(roomId) &&
    checkDateStr >= pb.start_date &&
    checkDateStr <= pb.end_date && // INCLUSIVE end date blocks checkout day
    (sessionToExclude === '' || pb.session_id !== sessionToExclude)  // Session isolation
);

if (hasProposedBooking) {
  return { status: 'proposed', email: null };  // YELLOW
}
```

### Priority Order for Status Determination

```
1. BLOCKAGE CHECK (highest priority)
   └─ Check blockageInstances (NEW) or blockedDates (legacy)
   └─ Result: status = 'blocked' (gray)

2. PROPOSED BOOKINGS CHECK
   └─ Check if any other session has proposed booking
   └─ Result: status = 'proposed' (orange)
   └─ Session isolation: own proposals excluded

3. ACTUAL BOOKINGS CHECK (lowest priority)
   └─ Calculate occupied nights around day
   └─ Result: status = 'available'|'edge'|'occupied' (green/split/red)
```

### Display Timing

- **Proposed bookings fetched:** Every 30 seconds (auto-sync interval)
- **Cache duration:** 30 seconds (prevents rate limiting)
- **Calendar refresh:** Debounced max 1 per 10 seconds
- **Color update:** Immediate once server responds

### Session Isolation Explained

```
User A: Selects room 12 → Creates proposal (session ID: SESS_ABC)
  → Room 12 shows YELLOW for User B
  → Room 12 shows GREEN for User A (same session)

User B: Looks at room 12
  → Sees YELLOW (blocked by User A's proposal)
  → Cannot click to select
  → Server rejects any booking attempt

User C: Same room 12
  → Also sees YELLOW
  → Also cannot book
```

---

## 6. COMPLETE STATUS DETERMINATION FLOW

```
START: Check availability for (date, roomId)
  ↓
STEP 1: Check blockage
  ├─ Is date in blockageInstances or blockedDates?
  ├─ YES → return { status: 'blocked', email: null }
  └─ NO → continue to Step 2

STEP 2: Check proposed bookings
  ├─ Is there a proposed booking for this room/date?
  ├─ By OTHER session? (session isolation)
  ├─ Is it not expired?
  ├─ YES → return { status: 'proposed', email: null }
  └─ NO → continue to Step 3

STEP 3: Calculate night occupation
  ├─ Get nightBefore = formatDate(date - 1 day)
  ├─ Get nightAfter = formatDate(date)
  ├─ For each booking on this room:
  │  ├─ Is nightBefore occupied? (nightBefore >= start AND nightBefore < end)
  │  ├─ Is nightAfter occupied? (nightAfter >= start AND nightAfter < end)
  │  └─ Count total occupied nights
  └─ continue to Step 4

STEP 4: Determine status from night count
  ├─ occupiedCount === 0
  │  └─ return { status: 'available', email: null }
  ├─ occupiedCount === 1
  │  └─ return { status: 'edge', nightBefore: bool, nightAfter: bool, email: ... }
  └─ occupiedCount === 2
     └─ return { status: 'occupied', email: ... }

END: Apply color based on status
  ├─ 'available' → GREEN (#10b981)
  ├─ 'edge' → GRADIENT (split green/red)
  ├─ 'occupied' → RED (#ef4444)
  ├─ 'proposed' → ORANGE (#f59e0b)
  └─ 'blocked' → GRAY (#9ca3af)
```

---

## 7. CODE LOCATIONS SUMMARY

| Feature | File | Lines | Details |
|---------|------|-------|---------|
| **Cell Color Assignment** | `BaseCalendar.js` | 305-396 | Main logic in `createDayCell()` |
| **Clickability Decision** | `BaseCalendar.js` | 314-395 | `clickable` variable, cursor assignment |
| **Event Listeners** | `BaseCalendar.js` | 515-575 | Only attached if `clickable === true` |
| **Availability Status** | `data.js` | 530-650 | Main logic in `getRoomAvailability()` |
| **Night Calculation** | `dateUtils.js` | 169-232 | `isNightOccupied()`, `getOccupiedNightsAroundDay()` |
| **Proposed Booking Check** | `data.js` | 571-590 | HIGHEST priority check |
| **Edge Detection** | `data.js` | 611-650 | Count occupied nights = 1 |
| **Bulk Mode** | `BaseCalendar.js` | 459-500 | `getBulkDateAvailability()` - checks all rooms |
| **Calendar Render** | `BaseCalendar.js` | 87-135 | `render()` and `_doRender()` methods |

---

## 8. VISUAL COLOR REFERENCE

```
Available (clickable):
  ████ GREEN (#10b981)
  
Occupied (not clickable):
  ████ RED (#ef4444)
  
Edge (clickable):
  ████ GRADIENT - depends on which night occupied
  ├─ Night before occupied: ████ [RED 50%] [GREEN 50%]
  └─ Night after occupied:  ████ [GREEN 50%] [RED 50%]
  
Proposed (not clickable):
  ████ AMBER (#f59e0b)
  
Blocked (not clickable):
  ████ GRAY (#9ca3af)
  
Selected (overrides all):
  ████ BLUE (#2563eb)
  
Selected Anchor (first click):
  ████ DARK BLUE (#1e40af)
  
Past Date (not clickable):
  ████ LIGHT GRAY (#f3f4f6) with opacity 0.5
  
Other Month (not clickable):
  ████ LIGHT GRAY (#e5e7eb) with opacity 0.4
  
Christmas (overlay):
  ████ [Base Color] + 🟨 Gold border (inset box-shadow)
```

---

## 9. KEY INSIGHTS

### 1. Edge Days Are Clickable
Unlike full occupancy, edge days (exactly one night occupied) are **still clickable** and available for new bookings. This allows guests to:
- Check in on day after another guest checks out
- Check out on same day another guest checks in

### 2. Night-Based Model is Asymmetric
- **Days are INCLUSIVE:** Booking Oct 6-8 includes Oct 6, 7, and 8
- **Nights are EXCLUSIVE on end:** Booking Oct 6-8 includes nights 6→7 and 7→8, but NOT 8→9
- This allows checkout-day overlap for next guest

### 3. Visual Gradient Direction Indicates Which Night
- **Left side red** = Previous guest checking out in morning
- **Right side red** = Next guest checking in in evening
- This helps users understand the occupation pattern

### 4. Proposed Bookings Have Highest Priority (After Blocking)
- Checked BEFORE actual bookings
- Prevents race conditions
- 15-minute expiry ensures temporary holds don't lock up rooms
- Session isolation prevents users from blocking themselves

### 5. Clickability is Binary
A cell is either clickable (pointer cursor) or non-clickable (not-allowed cursor). Event listeners are only attached to clickable cells for performance.

### 6. Selection Overrides All Colors
Once selected (blue), the cell color takes priority with `!important` to show user's chosen dates clearly.

---

## 10. TESTING SCENARIOS

### Test 1: Edge Day Before (Morning Checkout)
```
Setup: Booking 1 = Oct 5 → Oct 7
Query: Check Oct 7
Expected: 
  - Night before (Oct 6→7): OCCUPIED (by Booking 1)
  - Night after (Oct 7→8): FREE
  - Status: edge ✓
  - Color: GRADIENT [50% red LEFT] [50% green RIGHT]
  - Clickable: YES ✓
```

### Test 2: Edge Day After (Evening Check-in)
```
Setup: Booking 1 = Oct 7 → Oct 9
Query: Check Oct 7
Expected:
  - Night before (Oct 6→7): FREE
  - Night after (Oct 7→8): OCCUPIED (by Booking 1)
  - Status: edge ✓
  - Color: GRADIENT [50% green LEFT] [50% red RIGHT]
  - Clickable: YES ✓
```

### Test 3: Fully Occupied
```
Setup: Booking 1 = Oct 5 → Oct 7
       Booking 2 = Oct 7 → Oct 9
Query: Check Oct 7
Expected:
  - Night before (Oct 6→7): OCCUPIED (by Booking 1)
  - Night after (Oct 7→8): OCCUPIED (by Booking 2)
  - Status: occupied
  - Color: RED (#ef4444)
  - Clickable: NO ✗
```

### Test 4: Proposed Booking Blocks Other User
```
Setup: User A creates proposal for Oct 7-9
Query: User B checks Oct 7 (different session)
Expected:
  - Status: proposed
  - Color: ORANGE (#f59e0b)
  - Clickable: NO ✗
  - But User A sees GREEN (same session excluded)
```

---

## CONCLUSION

The calendar cell coloring and clickability system is built on a sophisticated **night-based availability model** that:

1. Divides each day into 2 surrounding nights
2. Checks both nights for occupation
3. Determines status based on night count (0/1/2 occupied)
4. Applies colors and clickability based on status
5. Integrates proposed bookings as highest-priority check
6. Uses gradients on edge days to show which night is occupied

This model elegantly handles the checkout/check-in day overlap while preventing actual double-bookings through night-level granularity.

