# Proposed Bookings Edge Day Handling - Quick Fix Guide

## Problem Statement
**Proposed bookings block checkout days, while confirmed bookings allow same-day checkout/checkin.**

## Root Cause
- **Confirmed bookings**: Use EXCLUSIVE end date (`<`)  
- **Proposed bookings**: Use INCLUSIVE end date (`<=`)  

This creates asymmetric behavior on edge days.

## The Fix (3 Changes)

### Change 1: database.js Line 1484
```diff
- AND ? >= pb.start_date AND ? <= pb.end_date
+ AND ? >= pb.start_date AND ? < pb.end_date
```

### Change 2: database.js Line 1492  
```diff
- AND ? >= pb.start_date AND ? <= pb.end_date
+ AND ? >= pb.start_date AND ? < pb.end_date
```

### Change 3: data.js Line 580
```diff
- checkDateStr <= pb.end_date &&
+ checkDateStr < pb.end_date &&
```

### Change 4: data.js Line 581 (Comment Update)
```diff
- checkDateStr <= pb.end_date && // INCLUSIVE end date for proposed bookings - blocks checkout day
+ checkDateStr < pb.end_date && // EXCLUSIVE end date - allows checkout day for next booking
```

## Before/After

### Before (Buggy)
```
Confirmed Booking: 2025-10-06 to 2025-10-08
  Oct 8: Can book? YES ✅

Proposed Booking: 2025-10-06 to 2025-10-08
  Oct 8: Can book? NO ❌
```

### After (Fixed)
```
Confirmed Booking: 2025-10-06 to 2025-10-08
  Oct 8: Can book? YES ✅

Proposed Booking: 2025-10-06 to 2025-10-08
  Oct 8: Can book? YES ✅
```

## Test Case

1. Create confirmed booking: 2025-10-06 to 2025-10-08
2. Try to create proposed booking: 2025-10-08 to 2025-10-10
3. Oct 8 should be clickable/available after fix

## Why This Matters

- **Standard hotel operations** rely on same-day checkout/checkin
- **Proposed bookings** should follow the same model as confirmed
- **No business reason** to block checkout days for temporary reservations
- **Follows SSOT principle** - single date model for all booking types

## Files to Change

- `/home/marianska/marianska/database.js` (2 locations)
- `/home/marianska/marianska/data.js` (2 locations)

## Complexity

- **Scope**: 2 files, 4 lines total
- **Difficulty**: LOW (simple operator change)
- **Risk**: LOW (aligns with proven model)
- **Impact**: HIGH (fixes core functionality)

## Related Documentation

- `PROPOSED_BOOKINGS_EDGE_DAY_ANALYSIS.md` - Full technical analysis
- `PROPOSED_BOOKINGS_EDGE_DAY_FINDINGS.md` - Detailed findings
- `PROPOSED_VS_CONFIRMED_EDGE_DAY_DIAGRAM.txt` - Visual comparison

---

**Summary**: Change 4 instances of `<=` to `<` in proposed booking date checks to match confirmed booking model.
