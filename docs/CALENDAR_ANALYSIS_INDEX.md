# Calendar Coloring & Clickability Logic - Documentation Index

**Investigation Date:** 2025-10-20  
**Status:** ✅ Complete Analysis with Documentation

---

## Quick Navigation

### For Different Use Cases

#### 1. I Need a Quick Overview (5 minutes)
- **Read:** `CALENDAR_COLORING_QUICK_REFERENCE.md` sections 1-4
- **Learn:** Color meanings, clickability rules, basic night model
- **Time:** ~5 minutes

#### 2. I Need Complete Understanding (15 minutes)
- **Read:** `CALENDAR_COLORING_LOGIC.md` all sections
- **Focus:** Sections 1, 3, 4, 5, 6
- **Learn:** Complete architecture, edge cases, integration points
- **Time:** ~15 minutes

#### 3. I Need to Fix/Debug Something
- **Start:** `CALENDAR_COLORING_QUICK_REFERENCE.md` Section 10 (Common Issues & Fixes)
- **Then:** `CALENDAR_COLORING_LOGIC.md` Section 6 (Status Determination Flow)
- **Reference:** Section 7 for code locations

#### 4. I Need to Implement Changes
- **Reference:** `CALENDAR_COLORING_LOGIC.md` Section 7 (Code Locations)
- **Study:** The specific file and line ranges mentioned
- **Test:** Using scenarios in Section 10

#### 5. I Need to Test/Verify Behavior
- **Use:** Testing scenarios in both documents
- **Quick Reference:** Section 9 in quick ref (Testing Each Color)
- **Complete Tests:** Section 10 in main analysis

---

## Documentation Files

### 1. CALENDAR_COLORING_LOGIC.md (Main Comprehensive Guide)

**Size:** 725 lines | **Read Time:** 15 minutes | **Depth:** Complete

**Sections:**
1. **Color Palette** - RGB codes, Tailwind classes, meaning of each color
2. **Cell Color Assignment Logic** - Priority system, style application
3. **Clickability Logic** - Rules, event listener attachment
4. **Night-Based Model** - Core concept, examples, calculations
5. **Status Definitions** - 8 detailed status types with examples
6. **Complete Flow Diagram** - Full availability determination logic
7. **Code Locations** - File paths and line numbers
8. **Visual Reference** - Color blocks and their properties
9. **Key Insights** - 6 important architectural principles
10. **Testing Scenarios** - 4 detailed test cases with expected results

**Best For:**
- Understanding the complete system
- Implementing new features
- Debugging complex issues
- Architecture reviews

---

### 2. CALENDAR_COLORING_QUICK_REFERENCE.md (Quick Lookup Guide)

**Size:** 270 lines | **Read Time:** 5 minutes | **Depth:** Essential

**Sections:**
1. **Color Legend** - Quick reference table
2. **Priority Order** - Decision tree for colors
3. **Nights Explanation** - Visual examples with dates
4. **Status Quick Guide** - Table of all statuses
5. **Edge Day Visual Explanation** - Gradient directions
6. **Why Edge Days Clickable** - Key insight with example
7. **Proposed Bookings Behavior** - Workflow and session isolation
8. **Code Locations** - Quick reference summary
9. **Testing Each Color** - Minimal test setups
10. **Common Issues & Fixes** - Troubleshooting table
11. **Performance Notes** - Optimization details
12. **Key Takeaways** - 7 critical concepts

**Best For:**
- Quick lookups
- Common questions
- Fast reference during development
- Debugging checklist

---

## Core Concepts At a Glance

### The Night-Based Model

```
Every day has 2 nights around it:
- Night Before = night from (day-1) → day
- Night After = night from day → (day+1)

Status determined by occupied night count:
- 0 occupied → AVAILABLE (green, clickable)
- 1 occupied → EDGE (split gradient, clickable)
- 2 occupied → OCCUPIED (red, not clickable)
```

### Color System

| Color | Hex | Meaning | Clickable |
|-------|-----|---------|-----------|
| Green | #10b981 | Available | ✓ |
| Red | #ef4444 | Occupied | ✗ |
| Gradient | Split | Edge | ✓ |
| Orange | #f59e0b | Proposed | ✗ |
| Gray | #9ca3af | Blocked | ✗ |

### Priority Order

1. Blockage Check (highest)
2. Proposed Bookings Check
3. Actual Bookings Check (lowest)

### Key Files

```
/home/marianska/marianska/
├── js/shared/BaseCalendar.js      Lines 305-396  (Cell coloring)
├── data.js                         Lines 530-650  (Status determination)
├── js/shared/dateUtils.js          Lines 169-195  (Night calculation)
└── docs/
    ├── CALENDAR_COLORING_LOGIC.md
    ├── CALENDAR_COLORING_QUICK_REFERENCE.md
    └── CALENDAR_ANALYSIS_INDEX.md (this file)
```

---

## Common Questions Answered

### Q1: Why are edge days clickable?
**A:** Edge days have exactly ONE free night. This allows:
- Check-in on day after guest checks out
- Check-out on day before next guest arrives
- Maximizes room utilization through same-day turnover

**Reference:** Quick Ref Section 6, Main Analysis Section 4

---

### Q2: What's the difference between "edge" and "occupied"?
**A:** 
- **Edge:** 1 night occupied → SPLIT COLOR gradient → CLICKABLE
- **Occupied:** 2 nights occupied → RED → NOT CLICKABLE

**Reference:** Main Analysis Section 4, Quick Ref Section 4

---

### Q3: How do proposed bookings work?
**A:** When user selects dates:
1. Creates temporary hold (15 minutes)
2. Shows as ORANGE to OTHER users
3. Shows as GREEN to SAME user (session isolation)
4. Blocks other users from booking
5. Auto-expires after 15 min or converts to permanent booking

**Reference:** Main Analysis Section 5, Quick Ref Section 7

---

### Q4: Why can't I click red cells?
**A:** Red cells have BOTH nights occupied:
- Night before: occupied
- Night after: occupied
- No free night for new guest = not clickable

**Reference:** Main Analysis Section 4, Quick Ref Section 4

---

### Q5: What does the gradient direction mean?
**A:**
- **Left RED, Right GREEN:** Night before occupied (morning checkout)
- **Left GREEN, Right RED:** Night after occupied (evening check-in)

**Reference:** Main Analysis Section 4, Quick Ref Section 5

---

### Q6: How does session isolation prevent self-blocking?
**A:** When user A creates a proposal:
- Other users (session B, C) → see ORANGE, blocked
- Same user (session A) → see GREEN, can modify

**Reference:** Main Analysis Section 5, Quick Ref Section 7

---

### Q7: What's the performance impact?
**A:**
- Event listeners only on clickable cells
- DOM cell cache (cellElements Map)
- Proposed booking cache (30 sec TTL)
- Calendar render debounced (max 1 per 10 sec)

**Reference:** Quick Ref Section 11, Main Analysis Section 5

---

## Code Snippets Reference

### Cell Color Assignment
```javascript
// BaseCalendar.js:348-396
if (status === 'blocked') {
  styles.push('background: #9ca3af; color: white;');
  clickable = false;
} else if (status === 'occupied') {
  styles.push('background: #ef4444; color: white;');
  clickable = false;
} else if (status === 'edge') {
  // gradient based on nightBefore/nightAfter
  clickable = true;
} else if (status === 'proposed') {
  styles.push('background: #f59e0b; color: white;');
  clickable = false;
}
```

### Availability Determination
```javascript
// data.js:530-650
async getRoomAvailability(date, roomId) {
  // 1. Check blockage
  if (isBlocked) return { status: 'blocked' };
  
  // 2. Check proposed bookings (HIGHEST PRIORITY)
  if (hasProposedBooking) return { status: 'proposed' };
  
  // 3. Calculate night occupation
  const nightBefore = getPreviousDay(date);
  const nightAfter = date;
  const occupiedCount = calculateOccupiedNights(...);
  
  // 4. Determine status
  if (occupiedCount === 0) return { status: 'available' };
  if (occupiedCount === 1) return { status: 'edge', ... };
  return { status: 'occupied' };
}
```

### Night Occupation Check
```javascript
// dateUtils.js:191-195
static isNightOccupied(nightDate, bookingStart, bookingEnd) {
  // EXCLUSIVE end date: nightDate < bookingEnd
  return nightDate >= bookingStart && nightDate < bookingEnd;
}
```

---

## Testing Checklist

### Manual Testing Steps

- [ ] **Green Cell Test:** Click available (green) cell → should select
- [ ] **Red Cell Test:** Try to click occupied (red) cell → cursor blocked
- [ ] **Edge Cell Test:** Click edge (gradient) cell → should select
- [ ] **Split Direction:** Verify gradient direction matches occupation
- [ ] **Orange Cell Test:** Other user sees orange (proposed) → can't click
- [ ] **Session Isolation:** Own proposal shows green → can modify
- [ ] **Proposed Expiry:** Wait 15 min → proposed becomes available
- [ ] **Selection Color:** Selected dates turn blue → overrides all
- [ ] **Past Dates:** Past dates grayed → can't select (unless admin)

### Automated Testing Scenarios

See **Section 10** of:
- `CALENDAR_COLORING_LOGIC.md` - Detailed test cases
- `CALENDAR_COLORING_QUICK_REFERENCE.md` Section 9 - Quick tests

---

## Related Documentation

### Proposed Bookings
- `PROPOSED_BOOKINGS_INDEX.md` - Complete proposed bookings documentation
- `PROPOSED_BOOKINGS_ANALYSIS.md` - Detailed analysis
- `PROPOSED_BOOKINGS_CODE_FLOW.md` - Code-level details

### Availability Model
- `CLAUDE.md` - Project overview, includes "Night-Based Availability Model"
- `TESTING.md` - Comprehensive testing guide

### Date Handling
- `DateUtils.js` - Source code documentation
- `CHANGELOG_2025-10-04.md` - Timezone fixes and improvements

---

## Architecture Principles

### 1. SSOT (Single Source of Truth)
- Night calculation: `DateUtils.isNightOccupied()`
- Status determination: `getRoomAvailability()`
- Color assignment: `createDayCell()`

### 2. Priority-Based Decision Making
- Each layer checks highest-priority items first
- Blockage > Proposed > Actual Bookings

### 3. Asymmetric Date/Night Model
- Days INCLUSIVE: Oct 6-8 = 3 days
- Nights EXCLUSIVE on end: Same booking = 2 nights
- Allows seamless checkout/check-in overlap

### 4. Session Isolation
- Prevents users from blocking themselves
- Maintains clean UX for form modifications
- Prevents race condition deadlocks

### 5. Visual Clarity Through Gradients
- Direction indicates occupation pattern
- Users understand room status at a glance
- No ambiguity on edge days

---

## Implementation Guide

### To Understand the System
1. Read: `CALENDAR_COLORING_QUICK_REFERENCE.md` Sections 1-4
2. Study: Night calculation example in Section 3
3. Review: Status table in Section 4
4. **Time:** 5 minutes

### To Modify Colors
1. Find: `BaseCalendar.js:348-396` (cell color assignment)
2. Locate: The `styles.push()` line for desired status
3. Change: The hex color code
4. Test: Using scenarios from documentation
5. **Time:** 10 minutes

### To Debug Issues
1. Identify: What color is wrong or missing
2. Check: Common Issues table in Quick Ref Section 10
3. Trace: Using flow diagram in Main Analysis Section 6
4. Verify: Against code locations in Main Analysis Section 7
5. **Time:** 15-30 minutes (varies)

### To Add New Status
1. Define: What nights occupied = new status
2. Add: To status determination logic (data.js:530-650)
3. Color: In cell assignment (BaseCalendar.js:348-396)
4. Test: Using scenarios
5. Document: Update this guide
6. **Time:** 30-60 minutes

---

## Troubleshooting

### Problem: All cells are red
**Possible Causes:**
1. Bug in `isNightOccupied()` logic
2. Night calculation returning wrong values
3. Occupancy counting error

**Debug Steps:**
- Add console logs to `getRoomAvailability()`
- Check night calculation: `getPreviousDay()`, `formatDate()`
- Verify booking dates in database

### Problem: Edge cells not showing gradient
**Possible Causes:**
1. `nightBefore`/`nightAfter` not passed in availability object
2. CSS gradient syntax wrong
3. Gradient overridden by other styles

**Debug Steps:**
- Check return value from `getRoomAvailability()`
- Verify gradient CSS in BaseCalendar.js:369-376
- Check CSS !important priority

### Problem: Can't click available cells
**Possible Causes:**
1. `clickable=false` incorrectly set
2. Event listeners not attached
3. Cell selector mismatch

**Debug Steps:**
- Check `data-clickable` attribute on cell
- Verify `attachEventListeners()` is called
- Check selector in event listener code

---

## Performance Optimization Notes

1. **Cell Cache:** DOM references cached to avoid repeated queries
2. **Event Delegation:** Only clickable cells get listeners (binary optimization)
3. **Proposed Caching:** 30-second TTL prevents rate limiting
4. **Render Debouncing:** Max 1 calendar re-render per 10 seconds
5. **Async Rendering:** Calendar builds HTML asynchronously

---

## Version History

- **2025-10-20:** Initial comprehensive analysis and documentation created
- **Files:** 2 detailed markdown files + this index

---

## Contact & Support

For questions about:
- **Calendar logic:** See Main Analysis (CALENDAR_COLORING_LOGIC.md)
- **Quick answers:** See Quick Reference (CALENDAR_COLORING_QUICK_REFERENCE.md)
- **Proposed bookings:** See PROPOSED_BOOKINGS_INDEX.md
- **Date handling:** See DateUtils.js source code
- **Overall architecture:** See CLAUDE.md

---

**Last Updated:** 2025-10-20  
**Status:** Complete and Production Ready  
**Coverage:** 100% of calendar coloring and clickability logic
