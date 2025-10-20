# Edit Window - Room Restrictions Implementation

**Date**: 2025-10-14
**Issue**: Users were able to add or remove rooms when editing a booking
**Solution**: Restrict edit mode to only allow modifications of existing rooms

## Changes Made

### 1. EditBookingComponent.js

#### A. Added `originalRooms` tracking (line 48)

```javascript
this.originalRooms = []; // Store original rooms that cannot be changed
```

#### B. Store original rooms on loadBooking() (line 80)

```javascript
// ⚠️ CRITICAL: Store original rooms - users CANNOT add/remove rooms in edit mode
this.originalRooms = [...(booking.rooms || [])];
```

#### C. Updated toggleRoom() method (lines 700-770)

Added two new validation checks:

**Check 1**: Prevent adding new rooms

```javascript
if (!this.originalRooms.includes(roomId)) {
  this.showNotification(
    '⚠️ V editaci nelze přidávat nové pokoje. ' +
      'Můžete měnit pouze termíny a počty hostů u již rezervovaných pokojů.',
    'warning',
    4000
  );
  setTimeout(() => this.renderPerRoomList(), 100);
  return;
}
```

**Check 2**: Prevent removing existing rooms

```javascript
if (this.editSelectedRooms.has(roomId) && this.originalRooms.includes(roomId)) {
  this.showNotification(
    '⚠️ V editaci nelze odebírat pokoje z rezervace. ' +
      'Můžete měnit pouze termíny a počty hostů.',
    'warning',
    4000
  );
  setTimeout(() => this.renderPerRoomList(), 100);
  return;
}
```

#### D. Updated renderPerRoomList() method (lines 1266-1289)

- **Filter rooms**: Only show rooms from original booking
- **Add informational notice**: Display message about edit restrictions

```javascript
// Filter rooms to show ONLY those in the original booking
const roomsToShow = this.settings.rooms.filter((r) => this.originalRooms.includes(r.id));

// Show informational notice about edit restrictions
if (roomsToShow.length < this.settings.rooms.length) {
  const notice = document.createElement('div');
  notice.style.cssText = `...`;
  notice.textContent =
    'ℹ️ Režim editace: Zobrazeny jsou pouze pokoje z původní rezervace. ' +
    'V editaci nelze přidávat ani odebírat pokoje.';
  roomsList.appendChild(notice);
}
```

## User Experience

### Before Changes

- ❌ Users could check/uncheck any room in edit mode
- ❌ Users could add rooms not in original booking
- ❌ Users could remove rooms from booking
- ❌ Confusing UX - all rooms shown with checkboxes

### After Changes

- ✅ Only original rooms are displayed
- ✅ Checkboxes for original rooms cannot be unchecked
- ✅ Clear informational message explains restrictions
- ✅ Clicking checkbox shows helpful warning
- ✅ Users can still modify:
  - Dates for each room
  - Guest counts for each room
  - Guest types (ÚTIA vs External)
  - Billing information
  - Guest names

## Applies To

- **User edit page** (`edit.html`) - Users with edit token
- **Admin edit modal** (`admin.html`) - Admin panel edit interface

Both use the same `EditBookingComponent`, so restrictions apply consistently.

## Technical Details

### SSOT Principle

Uses Single Source of Truth pattern:

- One `EditBookingComponent` class handles both user and admin editing
- Changes apply automatically to both contexts
- No code duplication

### Security

- Original rooms stored on component load
- Validations prevent UI manipulation
- Server-side validation still required (not changed)

### Edge Cases Handled

- **Bulk bookings**: Already had restriction - cannot toggle individual rooms
- **Empty original rooms**: Validation prevents this case
- **Room not found**: Error handling in place

## Testing Checklist

- [ ] Load existing single-room booking in user edit page
  - [ ] Verify only original room is shown
  - [ ] Try to uncheck room → warning shown
  - [ ] Modify dates → works correctly
  - [ ] Modify guest counts → works correctly

- [ ] Load existing multi-room booking in user edit page
  - [ ] Verify only original rooms are shown
  - [ ] Notice message is displayed
  - [ ] Try to uncheck any room → warning shown
  - [ ] Can edit dates/guests for each room

- [ ] Load existing booking in admin panel
  - [ ] Same restrictions apply
  - [ ] Only original rooms shown
  - [ ] Cannot add/remove rooms

- [ ] Load bulk booking (all 9 rooms)
  - [ ] All rooms shown (expected)
  - [ ] Bulk booking restrictions still apply
  - [ ] Cannot toggle individual rooms

- [ ] Submit edited booking
  - [ ] Only original rooms included in update
  - [ ] Price calculated correctly
  - [ ] Changes saved successfully

## Files Modified

- `js/shared/EditBookingComponent.js` - Main implementation
- `EDIT-ROOM-RESTRICTIONS.md` - This documentation

## Related Documentation

- See `CLAUDE.md` section "EditBookingComponent" for usage
- See `CLAUDE.md` section "SSOT (Single Source of Truth)" for architecture principles
