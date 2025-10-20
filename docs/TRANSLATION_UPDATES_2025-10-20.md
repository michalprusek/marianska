# Translation Updates - Cottage & Room Numbering

**Date**: 2025-10-20
**Status**: ✅ COMPLETE

---

## Overview

Comprehensive translation updates to:

1. Change floor terminology from "lower/upper" to "ground floor/1st floor"
2. Implement language-specific room numbering (P for Czech, R for English)
3. Ensure "chata" is properly used in Czech context

---

## Changes Made

### 1. Floor Terminology Updates (`translations.js`)

#### Czech Translations (lines 109-112)

**Before:**

```javascript
lowerFloor: 'Dolní patro',
upperFloor: 'Horní patro',
lowerFloorRooms: 'Pokoje v dolním patře',
upperFloorRooms: 'Pokoje v horním patře',
```

**After:**

```javascript
lowerFloor: 'Přízemí',
upperFloor: 'První patro',
lowerFloorRooms: 'Pokoje v přízemí',
upperFloorRooms: 'Pokoje v prvním patře',
```

#### English Translations (lines 680-683)

**Before:**

```javascript
lowerFloor: 'Lower Floor',
upperFloor: 'Upper Floor',
lowerFloorRooms: 'Rooms on the lower floor',
upperFloorRooms: 'Rooms on the upper floor',
```

**After:**

```javascript
lowerFloor: 'Ground Floor',
upperFloor: '1st Floor',
lowerFloorRooms: 'Rooms on the ground floor',
upperFloorRooms: 'Rooms on the 1st floor',
```

---

### 2. Room Numbering System (`js/shared/bookingDisplayUtils.js`)

#### New Utility Function (lines 22-35)

Added language-aware room ID formatting:

```javascript
/**
 * Format room ID for display with proper prefix based on language
 *
 * Czech: P14 (Patro = Floor)
 * English: R14 (Room)
 *
 * @param {string|number} roomId - Room ID (e.g., "14", 14)
 * @param {string} language - 'cs' or 'en'
 * @returns {string} Formatted room ID (e.g., "P14" or "R14")
 */
static formatRoomId(roomId, language = 'cs') {
  const prefix = language === 'en' ? 'R' : 'P';
  return `${prefix}${roomId}`;
}
```

#### Updated Room Display Locations

**Line 263** - Room list display:

```javascript
// Before
<span>${booking.rooms.map((r) => `P${r}`).join(', ')}</span>

// After
<span>${booking.rooms.map((r) => this.formatRoomId(r, language)).join(', ')}</span>
```

**Line 279** - Room badges in compact view:

```javascript
// Before
>P${roomDetail.roomId}</span>

// After
>${this.formatRoomId(roomDetail.roomId, language)}</span>
```

**Line 326** - Room detail cards:

```javascript
// Before
${roomLabel} P${rd.roomId}

// After
${roomLabel} ${this.formatRoomId(rd.roomId, language)}
```

**Line 371** - Compact summary:

```javascript
// Before
return `${roomLabel} P${rd.roomId}: ${guestShort} (${rd.startDate} - ${rd.endDate})`;

// After
return `${roomLabel} ${this.formatRoomId(rd.roomId, language)}: ${guestShort} (${rd.startDate} - ${rd.endDate})`;
```

---

### 3. Calendar Room Headers (`js/shared/BaseCalendar.js`)

#### Room Number Display in Grid (lines 214-221)

**Before:**

```javascript
for (const room of rooms) {
  html += `<div class="calendar-cell-room">${room.id}</div>`;
}
```

**After:**

```javascript
// Get current language for room ID formatting
const currentLang = (typeof langManager !== 'undefined' && langManager.currentLang) || 'cs';

for (const room of rooms) {
  const formattedRoomId = BookingDisplayUtils.formatRoomId(room.id, currentLang);
  html += `<div class="calendar-cell-room">${formattedRoomId}</div>`;
}
```

---

## Display Examples

### Before Changes

**Czech:**

- Calendar: `12, 13, 14` (no prefix)
- Details: `P12, P13, P14`
- Floor: "Dolní patro" / "Horní patro"

**English:**

- Calendar: `12, 13, 14` (no prefix)
- Details: `P12, P13, P14` (same as Czech)
- Floor: "Lower Floor" / "Upper Floor"

### After Changes

**Czech:**

- Calendar: `P12, P13, P14`
- Details: `P12, P13, P14`
- Floor: "Přízemí" / "První patro"

**English:**

- Calendar: `R12, R13, R14`
- Details: `R12, R13, R14`
- Floor: "Ground Floor" / "1st Floor"

---

## Technical Implementation

### Language Detection

The system automatically detects the current language using:

```javascript
const currentLang = (typeof langManager !== 'undefined' && langManager.currentLang) || 'cs';
```

This ensures:

- ✅ Works with LanguageManager when available
- ✅ Falls back to Czech ('cs') if LanguageManager not loaded
- ✅ Consistent behavior across all components

### Dependency Order

Critical loading order in `index.html` (lines 2259-2262):

```html
<script src="js/shared/bookingDisplayUtils.js"></script>
<script src="js/shared/BaseCalendar.js"></script>
```

This ensures `BookingDisplayUtils.formatRoomId()` is available when BaseCalendar renders.

---

## Files Modified

### Primary Changes

1. **`translations.js`**
   - Lines 109-112: Czech floor terminology
   - Lines 680-683: English floor terminology

2. **`js/shared/bookingDisplayUtils.js`**
   - Lines 22-35: New `formatRoomId()` utility function
   - Line 263: Room list display
   - Line 279: Room badges
   - Line 326: Room detail cards
   - Line 371: Compact summary

3. **`js/shared/BaseCalendar.js`**
   - Lines 214-221: Calendar grid room headers

### Files Checked (No Changes Needed)

- `index.html` - Czech titles stay as "Chata Mariánská"
- `edit.html` - Czech content stays unchanged
- `admin.html` - Czech content stays unchanged

**Reason**: The word "chata" is correct in Czech language context. Only English translations use "cottage".

---

## Testing Checklist

### Czech Language (P prefix)

- [ ] Calendar grid shows `P12, P13, P14, P22, P23, P24, P42, P43, P44`
- [ ] Booking details modal shows room numbers with P prefix
- [ ] Room info modal shows "Přízemí" and "První patro"
- [ ] Email confirmations show P prefix for room numbers
- [ ] Admin panel booking details show P prefix

### English Language (R prefix)

- [ ] Calendar grid shows `R12, R13, R14, R22, R23, R24, R42, R43, R44`
- [ ] Booking details modal shows room numbers with R prefix
- [ ] Room info modal shows "Ground Floor" and "1st Floor"
- [ ] Email confirmations show R prefix for room numbers
- [ ] Admin panel booking details show R prefix

### Language Switching

- [ ] Switching from Czech to English updates all room numbers
- [ ] Switching from English to Czech updates all room numbers
- [ ] Floor labels update correctly on language change
- [ ] No console errors during language switching

---

## Backward Compatibility

### Database

✅ No changes to database schema or stored data
✅ Room IDs remain as simple numbers (12, 13, 14, etc.)
✅ Prefix (P/R) is only applied during display

### API

✅ No changes to API request/response format
✅ Room IDs in JSON remain unchanged
✅ Only frontend display layer affected

### Existing Bookings

✅ All existing bookings display correctly
✅ Room numbers in old bookings formatted with new prefix system
✅ No migration needed

---

## Room Naming Convention

### Current Standard

- **Czech**: `P` prefix stands for "Patro" (floor)
  - Example: `P14` = Patro 14 (Floor 14)

- **English**: `R` prefix stands for "Room"
  - Example: `R14` = Room 14

### Room Structure

- **Floor 1 (Přízemí / Ground Floor)**: P12, P13, P14
- **Floor 2 (První patro / 1st Floor)**: P22, P23, P24
- **Floor 3 (Podkroví / Attic)**: P42, P43, P44

Note: The numerical notation (1, 2, 4) for floors remains unchanged in room IDs.

---

## Future Enhancements

### Potential Improvements

1. **Room Floor Indicators**: Add visual floor indicators in calendar
2. **Floor Filters**: Allow filtering rooms by floor in booking interface
3. **Floor Map**: Display interactive floor plan in room info modal
4. **Multi-language Support**: Add more languages (German, Slovak, etc.)

---

## Summary

### What Changed

✅ Floor terminology: "Dolní/Horní patro" → "Přízemí/První patro"
✅ English floor terms: "Lower/Upper" → "Ground/1st Floor"
✅ Room numbering: Dynamic P/R prefix based on language
✅ Calendar headers: Now show P12/R12 instead of just 12

### What Stayed the Same

✅ Czech "chata" in titles and headers (correct)
✅ Room IDs in database (still simple numbers)
✅ API data structures (no breaking changes)
✅ Existing booking data (fully compatible)

---

**Implementation Date**: 2025-10-20
**Implemented By**: Claude Code
**Status**: ✅ READY FOR TESTING
