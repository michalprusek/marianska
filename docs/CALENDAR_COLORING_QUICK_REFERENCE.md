# Calendar Coloring Logic - Quick Reference

## 1. Color Legend

```
🟢 GREEN (#10b981)    = Available      [CLICKABLE]
🔴 RED (#ef4444)      = Occupied       [NOT clickable]
🟠 ORANGE (#f59e0b)   = Proposed       [NOT clickable]
⬜ GRAY (#9ca3af)     = Blocked        [NOT clickable]
🟡 SPLIT Gradient     = Edge           [CLICKABLE]
🔵 BLUE (#2563eb)     = Selected       [override]
⭕ Gold Border        = Christmas      [overlay]
```

---

## 2. How Colors Are Determined

### Priority Order (Top = Highest Priority)

```
1. Past Date? → Light Gray + Not Clickable
2. Other Month? → Light Gray + Not Clickable
3. Christmas? → Add Gold Border (overlay)
4. Blockage? → Gray + Not Clickable
5. Proposed Booking (Other Session)? → Orange + Not Clickable
6. Actual Booking Status:
   ├─ 0 nights occupied → Green + Clickable
   ├─ 1 night occupied → Split Gradient + Clickable
   └─ 2 nights occupied → Red + Not Clickable
7. User Selected? → Blue (with !important) + override all
```

---

## 3. Understanding "Nights Around a Day"

Every day has 2 nights around it:

```
       Day 1    |    Day 2    |    Day 3
         |      |      |      |      |
    Night 1 → Night 2 → Night 3
  (before D1) (before D2) (before D3)
```

### Example: Booking Oct 6 → Oct 8

```
Oct 5          Oct 6          Oct 7          Oct 8          Oct 9
Night 5→6  |   Night 6→7  |   Night 7→8  |   Night 8→9
           |     Check-in |      Middle  |     Check-out  |
           X (occupied)       X (occupied)  ✓ (FREE!)

Result for each day:
- Oct 6: Night before FREE, Night after OCCUPIED → EDGE (Split Color)
- Oct 7: Both nights OCCUPIED → OCCUPIED (Red)
- Oct 8: Night before OCCUPIED, Night after FREE → EDGE (Split Color)
```

---

## 4. Status Quick Guide

| Status | Nights Occupied | Color | Clickable | Use Case |
|--------|-----------------|-------|-----------|----------|
| **Available** | 0 | 🟢 Green | YES | Book freely |
| **Edge** | 1 | 🟡 Split | YES | Checkout/Check-in day |
| **Occupied** | 2 | 🔴 Red | NO | Already booked |
| **Proposed** | - | 🟠 Orange | NO | Someone booking (15 min) |
| **Blocked** | - | ⬜ Gray | NO | Admin blocked |

---

## 5. Edge Day Visual Explanation

### Left Side Red (Night Before Occupied)

```
Guest checking OUT in morning
        ↓
    ┌─────┬─────┐
    │ RED │GREEN│  Day = Can check-in new guest
    │ ►   │ ◄  │
    └─────┴─────┘
   (Occupied)  (Free)
```

### Right Side Red (Night After Occupied)

```
Guest checking IN in evening
        ↓
    ┌─────┬─────┐
    │GREEN│ RED │  Day = Can check-out current guest
    │ ►   │ ◄  │
    └─────┴─────┘
   (Free)   (Occupied)
```

---

## 6. Why Edge Days Are Clickable

**The key insight:** Edge days have ONE free night (checkout night for next guest)

```
Scenario: Booking Oct 6-8
         │ Oct 6          │ Oct 7        │ Oct 8
         │ (check-in)     │ (middle)     │ (check-out)
─────────┼────────────────┼──────────────┼──────────────
 Current │ Can't use      │ Can't use    │ Can't use
 Guest   │ (checking in)  │ (occupying)  │ (checking out)
─────────┼────────────────┼──────────────┼──────────────
 Next    │ CAN'T use      │ CAN'T use    │ CAN use ✓
 Guest   │ (occupied)     │ (occupied)   │ (checkout day)
         │                │              │
         │                │              → Night 8→9 is FREE!
```

---

## 7. Proposed Bookings Behavior

### What Proposed Bookings Do

```
User A clicks dates 10-15
    ↓
Rooms 10-15 turn ORANGE (proposed)
    ↓
User B sees orange, can't click
    ↓
User A submits form
    ↓
Proposed → Red (permanent booking)
    ↓
After 15 min (if not submitted)
    ↓
Proposed expires → reverts to original status
```

### Session Isolation

```
User A (Session SESS_ABC):
  - Creates proposal → SEES GREEN (same session, excluded)
  - OTHER users SEE ORANGE

User B (Session SESS_XYZ):
  - Can't see/book same room/dates → BLOCKED

User A (Session SESS_ABC):
  - OWN proposal doesn't block themselves
  - CAN SELECT AGAIN to change dates
```

---

## 8. Code Locations

```
Cell Color Assignment:
  └─ BaseCalendar.js:305-396
     • createDayCell() method
     • Determines color + clickability

Availability Determination:
  └─ data.js:530-650
     • getRoomAvailability() method
     • Returns status: 'available'|'edge'|'occupied'|'proposed'|'blocked'

Night Calculation:
  └─ dateUtils.js:169-195
     • isNightOccupied() method
     • getOccupiedNightsAroundDay() method

Proposed Bookings Check:
  └─ data.js:571-590
     • HIGHEST PRIORITY (after blockage)
     • Session isolation logic
```

---

## 9. Testing Each Color

### Green (Available)
```
Setup: No bookings on room/date
Check: room availability
Expected: Green + Clickable
```

### Red (Occupied)
```
Setup: Booking 5→7, Check day 6
Nights: 5→6 (occupied), 6→7 (occupied)
Expected: Red + NOT clickable
```

### Split/Gradient (Edge - Left Red)
```
Setup: Booking 5→7, Check day 7
Nights: 6→7 (occupied), 7→8 (FREE)
Expected: [RED LEFT] [GREEN RIGHT] + Clickable
```

### Split/Gradient (Edge - Right Red)
```
Setup: Booking 7→9, Check day 7
Nights: 6→7 (FREE), 7→8 (occupied)
Expected: [GREEN LEFT] [RED RIGHT] + Clickable
```

### Orange (Proposed)
```
Setup: User A selects room on dates (different session)
Check: Room/date from User B's perspective
Expected: Orange + NOT clickable
```

### Gray (Blocked)
```
Setup: Admin blocks dates via panel
Check: Blocked date/room
Expected: Gray + NOT clickable
```

### Blue (Selected)
```
Setup: User clicks date in calendar
Expected: Blue (#2563eb) + override all colors
```

---

## 10. Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| All cells red | Bug in night calculation | Check `isNightOccupied()` logic |
| Edge cells not split | nightBefore/nightAfter not passed | Check `getRoomAvailability()` return |
| Can't select available | Clickable=false but should be true | Check clickability logic priority |
| Proposed doesn't show | Cache issue | Check proposed bookings cache (30s TTL) |
| Selection color wrong | CSS !important missing | Add `!important` to selection styles |
| Past dates clickable | allowPast config set wrong | Check calendar config initialization |

---

## 11. Performance Notes

- **Event listeners:** Only attached to clickable cells (performance optimization)
- **Cell cache:** DOM references cached in `cellElements` Map
- **Proposed cache:** 30-second TTL to prevent rate limiting
- **Calendar render:** Debounced (max 1 per 10 seconds)
- **Selection preview:** Uses cached cells, only updates affected range

---

## 12. Key Takeaways

1. ✅ **Colors are determined by night occupancy count** (0/1/2)
2. ✅ **Edge days (1 night) are clickable** - allows checkout/check-in overlap
3. ✅ **Proposed bookings have highest priority** (after blocking)
4. ✅ **Session isolation** prevents users from blocking themselves
5. ✅ **Gradients on edges** show which night is occupied
6. ✅ **Selection overrides all** with blue color
7. ✅ **Clickability is binary** - affects cursor + event listeners

