# Shared Components Quick Reference Guide

**Last Updated**: 2025-12-03

## Cheat Sheet: Which Component To Use

### Date Operations
```javascript
// ✅ USE DateUtils.formatDate() - NOT DataManager.formatDate()
const formattedDate = DateUtils.formatDate(new Date());  // "2025-12-03"

// ✅ USE DateUtils.parseDate() for timezone-safe parsing
const dateObj = DateUtils.parseDate("2025-12-03");

// ✅ USE DateUtils.getDaysBetween() for night count
const nights = DateUtils.getDaysBetween("2025-12-03", "2025-12-05");  // 2

// ❌ DON'T manually calculate: Math.floor((end - start) / (1000 * 60 * 60 * 24))
```

### Validation
```javascript
// ✅ USE ValidationUtils for all field validation
if (!ValidationUtils.validateEmail(email)) {
  const error = ValidationUtils.getValidationError('email', email, lang);
  showError(error);
}

// ✅ Check phone with country code
const isValid = ValidationUtils.validatePhoneNumber(phone, '+420');

// ✅ Get formatted/cleaned values
const formatted = ValidationUtils.formatPhone(phone);  // Returns "420 123 456 789"
const formattedZip = ValidationUtils.formatZIP(zip);  // Returns "123 45"

// ❌ DON'T create separate validation methods in your file
```

### Booking Logic
```javascript
// ✅ USE BookingLogic for conflict checking on server
if (BookingLogic.checkDateOverlap(start1, end1, start2, end2)) {
  // Bookings conflict
}

// ✅ Check if date is occupied (inclusive)
if (BookingLogic.isDateOccupied(checkDate, bookingStart, bookingEnd)) {
  // Date is booked
}

// ⚠️ Client-side uses server availability, not this method
```

### Price Calculation
```javascript
// ✅ USE PriceCalculator for all price calculations
const price = PriceCalculator.calculatePerGuestPrice({
  price: 300,          // Base room price
  adults: 2,
  children: 1,
  toddlers: 0,
  nights: 3
});

// ✅ Multi-room with per-room guest types
const prices = PriceCalculator.calculatePriceFromRooms({
  rooms: ['12', '13'],
  guestType: 'utia',    // Default
  adults: 3,
  children: 1,
  nights: 2,
  perRoomGuests: [
    { roomId: '12', guestType: 'utia', adults: 2, children: 0 },
    { roomId: '13', guestType: 'external', adults: 1, children: 1 }
  ],
  settings: settingsObject
});

// ❌ DON'T manually calculate prices
```

### ID Generation
```javascript
// ✅ USE IdGenerator for all IDs and tokens
const sessionId = IdGenerator.generateSessionId();     // SESS + 16 chars
const bookingId = IdGenerator.generateBookingId();     // BK + chars
const editToken = IdGenerator.generateEditToken();     // 30 secure chars
const token = IdGenerator.generateToken(20);           // Custom length

// ❌ DON'T use Math.random() for tokens
```

### Christmas Logic
```javascript
// ✅ USE ChristmasUtils for Christmas period checks
const { codeRequired, bulkBlocked } = ChristmasUtils.checkChristmasAccessRequirement(
  new Date(),
  christmasPeriodStart,
  isBulkBooking
);

// ✅ Check room limits
const isAllowed = ChristmasUtils.validateChristmasRoomLimit(
  startDate,
  endDate,
  christmasPeriodStart,
  numberOfRooms,
  isBulkBooking
);

// ❌ DON'T implement Christmas logic separately
```

### Calendar Rendering
```javascript
// ✅ USE BaseCalendar for all calendar views
const calendar = new BaseCalendar({
  mode: BaseCalendar.MODES.GRID,      // or SINGLE_ROOM, BULK, EDIT
  app: appInstance,
  containerId: 'calendar-container',
  onDateSelect: (date) => handleSelect(date)
});

await calendar.render();

// ❌ DON'T create separate calendar implementations
```

### Display Formatting
```javascript
// ✅ USE BookingDisplayUtils for display formatting
const roomLabel = BookingDisplayUtils.formatRoomId('12', 'cs');  // "Pokoj 12"
const html = BookingDisplayUtils.renderPerRoomDetailsHTML(booking, 'cs');

// ✅ USE EditBookingComponent for edit forms
const editor = new EditBookingComponent({
  isAdminMode: false,
  onSubmit: handleSave,
  onDelete: handleDelete
});

await editor.loadBooking(bookingId, editToken);
```

### DOM Manipulation (Future Use)
```javascript
// ✅ SHOULD USE DomUtils (currently inconsistent)
const element = DomUtils.createElement('div', 'class-name', 'content');
const button = DomUtils.createButton('Click me', 'btn-class', handleClick);
DomUtils.addClass(element, 'active');
DomUtils.on(element, 'click', handler);

// ❌ AVOID direct manipulation (current code does this, but shouldn't)
const element = document.createElement('div');  // Not recommended
element.innerHTML = content;                     // XSS risk!
element.classList.add('active');                 // Use DomUtils.addClass instead
```

---

## Common Patterns

### Pattern #1: Validate and Display Error
```javascript
// ✅ CORRECT
const { value } = emailInput;
if (!ValidationUtils.validateEmail(value)) {
  const error = ValidationUtils.getValidationError('email', value, currentLanguage);
  emailError.textContent = error;
  return false;
}
```

### Pattern #2: Calculate Price for Booking
```javascript
// ✅ CORRECT
const nights = DateUtils.getDaysBetween(startDate, endDate);
const price = PriceCalculator.calculatePerGuestPrice({
  price: roomSettings.basePrice,
  adults,
  children,
  toddlers,
  nights
});
```

### Pattern #3: Format Date for Display
```javascript
// ✅ CORRECT
const dateString = DateUtils.formatDate(new Date());      // "2025-12-03"
const displayText = DateUtils.formatDateDisplay(date, 'cs');  // Localized
```

### Pattern #4: Check Booking Conflicts
```javascript
// ✅ CORRECT (Server-side)
if (BookingLogic.checkDateOverlap(newStart, newEnd, existingStart, existingEnd)) {
  throw new Error('Dates overlap with existing booking');
}
```

### Pattern #5: Generate Secure Tokens
```javascript
// ✅ CORRECT
const editToken = IdGenerator.generateEditToken();  // 30 characters, secure
const sessionId = IdGenerator.generateSessionId();  // SESS + random
const bookingId = IdGenerator.generateBookingId();  // BK + random
```

---

## File Organization

### Which Files Use Shared Components?

**Frontend Files**:
- `js/booking-app.js` - Uses: BaseCalendar, DateUtils, IdGenerator, PriceCalculator
- `js/single-room-booking.js` - Uses: BaseCalendar, DateUtils, PriceCalculator, IdGenerator
- `js/bulk-booking.js` - Uses: BaseCalendar, DateUtils
- `js/booking-form.js` - Uses: ValidationUtils, PriceCalculator, ChristmasUtils
- `js/calendar.js` - Uses: BookingDisplayUtils, DateUtils
- `js/edit-page.js` - Uses: DateUtils, EditBookingComponent
- `js/utils.js` - Uses: ValidationUtils, BookingDisplayUtils, PriceCalculator

**Backend Files**:
- `server.js` - Uses: All shared components (validation, pricing, logic, etc.)
- `database.js` - Uses: DateUtils, BookingLogic
- `data.js` - Uses: IdGenerator, DateUtils (but also has its own formatDate)

---

## Component Status

### ✅ Well-Integrated
- BaseCalendar
- ValidationUtils
- DateUtils
- BookingLogic
- PriceCalculator
- IdGenerator
- ChristmasUtils
- BookingDisplayUtils
- EditBookingComponent
- EmailService

### ⚠️ Underutilized
- GuestNameUtils - validateGuestNames() not called
- DomUtils - Direct DOM manipulation instead
- ModalDialog - Individual implementations instead of using utility

### ❌ SSOT Violations
- DataManager.formatDate() - Duplicates DateUtils.formatDate()
- booking-form.js validation methods - Duplicate ValidationUtils
- booking-app.js day count - Duplicates DateUtils.getDaysBetween()

---

## Rules for Adding New Features

1. **Check shared components first** - Before writing new utility code
2. **Don't duplicate** - If it exists in js/shared/, use it
3. **Centralize business logic** - Put it in shared, not in page-specific files
4. **Use server as SSOT** - Client shows data from server, doesn't calculate
5. **Validate on both sides** - Client for UX, server for security
6. **Format consistently** - Use DateUtils, ValidationUtils, BookingDisplayUtils
7. **Handle errors safely** - Consider XSS, SQL injection, type errors

---

## Testing Your Code

```javascript
// Test that you're using shared components
console.assert(typeof DateUtils !== 'undefined', 'DateUtils should be loaded');
console.assert(typeof ValidationUtils !== 'undefined', 'ValidationUtils should be loaded');
console.assert(typeof BaseCalendar !== 'undefined', 'BaseCalendar should be loaded');

// Example validation test
const email = 'test@example.com';
const isValid = ValidationUtils.validateEmail(email);
console.assert(isValid === true, 'Email validation should work');

// Example date test
const nights = DateUtils.getDaysBetween('2025-12-03', '2025-12-05');
console.assert(nights === 2, 'Should calculate 2 nights');
```

---

## Migration Guide (For Existing Code)

### To Remove DataManager.formatDate():
```javascript
// Before:
const dateStr = this.formatDate(date);

// After:
const dateStr = DateUtils.formatDate(date);
```

### To Use DomUtils for Elements:
```javascript
// Before:
const div = document.createElement('div');
div.className = 'my-class';
div.textContent = 'Hello';
div.onclick = handler;
container.appendChild(div);

// After:
const div = DomUtils.createElement('div', 'my-class', 'Hello');
DomUtils.on(div, 'click', handler);
DomUtils.append(container, div);
```

### To Consolidate Validation:
```javascript
// Before:
validatePhoneNumber(input) {
  // own implementation
}

// After:
validatePhoneField(input) {
  const value = input.value;
  const countryCode = document.getElementById('countryCode').value;
  const isValid = ValidationUtils.validatePhoneNumber(value, countryCode);
  if (!isValid) {
    const error = ValidationUtils.getValidationError('phoneNumber', value, lang);
    this.showFieldError(input, error);
  }
  return isValid;
}
```

---

## Quick Fixes

### Fix: "DateUtils is not defined"
- Check that `<script src="js/shared/dateUtils.js"></script>` is in HTML

### Fix: "ValidationUtils.validatePhoneNumber() returns wrong value"
- Check that countryCode parameter is passed correctly
- Use '+420' or '+421' for Czech/Slovak

### Fix: "DomUtils methods not available"
- Check that `<script src="js/shared/domUtils.js"></script>` is loaded
- Current code doesn't use DomUtils - plan to migrate

### Fix: "Calendar not rendering"
- Check BaseCalendar mode is correct (GRID, SINGLE_ROOM, BULK, or EDIT)
- Check containerId exists in DOM

### Fix: "Price calculation wrong"
- Verify nights parameter is calculated with DateUtils.getDaysBetween()
- Check room settings are loaded correctly
- Verify per-room guest types are passed correctly

---

## Resources

- See `/docs/SHARED_COMPONENTS_ANALYSIS.md` for detailed analysis
- See `/CLAUDE.md` section "SSOT (Single Source of Truth)" for architecture overview
- See individual shared component files for method documentation

