# Guest Input Generation Logic Analysis - Complete Index

**Analysis Date**: 2025-11-04
**Analysis Scope**: Guest input field creation, state management, and data preservation
**Status**: ✅ COMPLETE

---

## Quick Start

Read these files in this order:

1. **Start here**: `ANALYSIS_COMPLETE.txt` (14 KB)
   - Executive summary of all findings
   - Key issue identification
   - Recommended solutions

2. **Quick reference**: `GUEST_INPUT_ANALYSIS_SUMMARY.txt` (14 KB)
   - Function definitions
   - Current data flow
   - What's preserved vs. lost
   - How to fix recommendations

3. **Detailed analysis**: `GUEST_INPUT_GENERATION_ANALYSIS.md` (24 KB)
   - Complete technical documentation
   - Function-by-function breakdown
   - State preservation mechanisms
   - Proposed solutions with code examples

4. **Visual diagrams**: `GUEST_INPUT_DATAFLOW_DIAGRAM.md` (45 KB)
   - 6 comprehensive data flow diagrams
   - Visual representations of all flows
   - Event lifecycle documentation

5. **Code reference**: `GUEST_INPUT_LINE_REFERENCE.md` (15 KB)
   - Exact line numbers for all code
   - Function start/end mappings
   - Critical code sections
   - Quick navigation guide

---

## Key Findings Summary

### Critical Issue: Data Loss on Guest Count Change

**Problem**: When user clicks +/- button to adjust guest counts, all previously entered guest names and toggle states (ÚTIA/External type selection) are destroyed.

**Root Cause**:
- Line 516: `adultsContainer.innerHTML = ''`
- Line 618: `childrenContainer.innerHTML = ''`
- Line 720: `toddlersContainer.innerHTML = ''`

**Impact**: User must re-enter all guest names and re-toggle their types after any guest count change.

**Severity**: 🔴 HIGH - Affects user experience immediately

### What's Preserved

✓ Guest count (adults, children, toddlers) - stored in `roomGuests Map`
✓ Default guest type (ÚTIA or External) - stored in `roomGuests Map`

### What's Lost

✗ Individual guest names (first and last)
✗ Individual guest type selections (per-guest pricing)
✗ Visual toggle states

---

## Function Reference

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `generateGuestNamesInputs()` | single-room-booking.js | 499-824 | Creates dynamic guest input fields |
| `adjustGuests()` | booking-app.js | 496-560 | Increments/decrements guest count |
| `collectGuestNames()` | single-room-booking.js | 831-916 | Collects & validates guest names |
| Event listeners | booking-app.js | 391-401 | Registers click handlers on buttons |

---

## Critical Line Numbers

**Data Loss Points** (where data is destroyed):
- `/js/single-room-booking.js:516` - Clears adult inputs
- `/js/single-room-booking.js:618` - Clears children inputs
- `/js/single-room-booking.js:720` - Clears toddler inputs

**Regeneration Trigger**:
- `/js/booking-app.js:555` - Calls generateGuestNamesInputs()

**Event Registration**:
- `/js/booking-app.js:396` - Decrement button listener
- `/js/booking-app.js:399` - Increment button listener
- `/js/single-room-booking.js:581, 683, 785` - Toggle switch listeners

**State Management**:
- `/js/booking-app.js:536-537` - Updates roomGuests Map

**Data Collection**:
- `/js/single-room-booking.js:840` - Queries name inputs
- `/js/single-room-booking.js:876` - Queries toggle switches

---

## Input Field Structure

### Name Inputs (firstName & lastName)
```
ID: singleRoomAdult[First|Last]Name{i}
Data attributes: data-guest-type="adult", data-guest-index="1"
Storage: DOM element.value
Status: LOST on regeneration
```

### Toggle Switches (ÚTIA/External type)
```
ID: adult{i}GuestTypeToggle
Type: Hidden checkbox
Data attributes: data-guest-type="adult", data-guest-index="1", data-guest-price-type="true"
Storage: DOM element.checked
Status: LOST on regeneration
```

---

## Recommended Solution

### Option 1: Save Before Clear (Recommended)

**Steps**:
1. Before `innerHTML = ''`, extract and save:
   - Guest first names from each input
   - Guest last names from each input
   - Guest type toggle states (checked property)

2. After creating new inputs, restore saved data:
   - Set `input.value` to saved first/last names
   - Set `toggle.checked` to saved type state
   - Event listeners will automatically update visual state

**Advantages**: Simple, preserves all user data, no complex state management

### Option 2: Use Instance Variables

**Steps**:
1. Create instance variable in SingleRoomBookingModule:
   ```javascript
   this.guestNameData = {
     'adult-1': { firstName, lastName, guestType },
     'adult-2': { firstName, lastName, guestType }
   }
   ```

2. Extract data before clear, restore after create

**Advantages**: Keeps data in instance scope, survives DOM regeneration

---

## File Locations

All analysis files are in:
```
/home/marianska/marianska/
```

Core files analyzed:
- `/js/single-room-booking.js` (918 lines)
- `/js/booking-app.js` (642 lines)
- `/index.html` (guest count controls section)

---

## Data Flow Overview

```
User clicks +/- button
  ↓
adjustGuests('adults', 1) called [booking-app.js:496]
  ├─ Get current state from roomGuests Map
  ├─ Calculate new value
  ├─ Validate room capacity
  ├─ Update roomGuests Map with new count
  ├─ Update DOM display
  ├─ Recalculate price
  └─ Call generateGuestNamesInputs() [booking-app.js:555]
      └─ Get containers
      ├─ Clear with innerHTML = '' ⚠️ DATA LOSS
      ├─ Create new inputs (EMPTY)
      └─ Register event listeners on toggles

User submits form
  ↓
confirmRoomBooking() called
  ├─ Validate guest names collected
  └─ collectGuestNames() [single-room-booking.js:831]
      ├─ Query all name inputs
      ├─ Query all toggle switches
      ├─ Validate all fields filled
      └─ Return array of guest objects
```

---

## Event Listener Lifecycle

### Button Click Listeners (Lines 391-401)
- Registered once during app initialization
- Persistent across modal open/close
- Handlers call `adjustGuests(type, change)`

### Toggle Switch Change Listeners (Lines 581, 683, 785)
- Registered every time `generateGuestNamesInputs()` runs
- Recreated on each guest count change
- Handlers update visual state (colors, position, text)

---

## State Storage

### Level 1: Persistent (roomGuests Map)
```javascript
this.roomGuests = Map<roomId, {
  adults: N,
  children: M,
  toddlers: K,
  guestType: 'utia' | 'external'
}>
```
- Preserved across modal operations
- Lost when modal closes
- Only stores COUNTS, not individual guest names

### Level 2: Ephemeral (DOM Elements)
```
input.value → Guest first/last names
input.checked → Guest type toggle state
```
- Preserved only during current input field set
- DESTROYED when `innerHTML = ''` is executed
- No backup in persistent storage

---

## Testing the Issue

### Scenario to Reproduce Data Loss

1. Open modal for single room
2. Increment adults to 2 (1 → 2)
3. Enter "Jan Novák" in first adult fields
4. Toggle first adult to External
5. Click "+" to add third adult
6. **Result**: First adult's name and toggle state are LOST
7. User must re-enter data

### Expected Result After Fix

1. Open modal for single room
2. Increment adults to 2
3. Enter "Jan Novák" and toggle to External
4. Click "+" to add third adult
5. **Result**: First adult's data preserved, third adult empty
6. User only fills in new guest, doesn't repeat

---

## Validation Logic

### Validation Points

1. **At Collection Time** (`collectGuestNames`):
   - First name required: `value.trim().length >= 2`
   - Last name required: `value.trim().length >= 2`
   - Guest type required: Must be set via toggle

2. **At Submit Time** (`confirmRoomBooking`):
   - All names must be filled
   - Guest count must match total names
   - All guests must have a price type

3. **At Input Time** (UI feedback):
   - Visual error: Border turns red for invalid fields

---

## Document Reference

### ANALYSIS_COMPLETE.txt
- 500 lines of comprehensive summary
- All key findings consolidated
- Recommended next steps
- Testing instructions

### GUEST_INPUT_ANALYSIS_SUMMARY.txt
- Quick reference guide
- Function definitions
- Data flow overview
- Known limitations
- Testing notes

### GUEST_INPUT_GENERATION_ANALYSIS.md
- Detailed technical analysis
- Complete code documentation
- State preservation mechanisms
- 2 proposed solutions with examples
- File/line mapping

### GUEST_INPUT_DATAFLOW_DIAGRAM.md
- 6 comprehensive ASCII diagrams
- Complete flow visualization
- State comparison diagram
- Collection process flow
- Event listener lifecycle
- Key insights

### GUEST_INPUT_LINE_REFERENCE.md
- Function start/end line numbers
- Code section mappings
- Critical line references
- Data attribute guide
- Selector quick reference
- roomGuests Map documentation
- Navigation guide

---

## Next Steps

1. **Review** the critical issue identified
2. **Choose** preferred solution (Option 1 or Option 2)
3. **Implement** data preservation mechanism
4. **Test** with multiple guest count changes
5. **Verify** no data loss occurs
6. **Consider** adding localStorage backup

---

## Contact & Questions

All analysis completed on: **2025-11-04**

For detailed information on any aspect:
- Technical details → See GUEST_INPUT_GENERATION_ANALYSIS.md
- Visual flows → See GUEST_INPUT_DATAFLOW_DIAGRAM.md
- Code locations → See GUEST_INPUT_LINE_REFERENCE.md
- Quick answers → See GUEST_INPUT_ANALYSIS_SUMMARY.txt

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Files analyzed | 3 |
| Functions documented | 4 |
| Lines of code reviewed | 1,560+ |
| Critical issues found | 1 (data loss) |
| Data loss points | 3 (lines 516, 618, 720) |
| Analysis documents | 5 |
| Total documentation | 112 KB |
| Diagrams created | 6 |
| Recommended solutions | 2 |

---

**Status**: ✅ Analysis Complete
**Ready for**: Implementation & Testing
**Estimated fix time**: 1-2 hours
