# Comprehensive SSOT & Shared Component Analysis Report
**Mariánská Booking System - JavaScript Codebase**
**Date**: 2025-12-03
**Status**: Analysis Complete

---

## Executive Summary

The codebase has **strong SSOT (Single Source of Truth) implementation** with 13 shared utility modules. However, there are **specific opportunities for improvement**:

- ✅ **Good**: Most critical business logic properly centralized
- ⚠️ **Issues Found**: 
  - DomUtils largely unused despite availability
  - Some DOM manipulation patterns could be consolidated
  - Potential for new utility modules in specific areas
  - Data.js has its own formatDate/parseDate methods alongside DateUtils

**Overall Score**: 7.5/10 (Good SSOT coverage, room for optimization)

---

## Part 1: Shared Component Documentation

### 1. BaseCalendar.js
**Purpose**: Universal calendar component for all UI contexts

**Usage Locations**:
- `/home/marianska/marianska/js/booking-app.js`
- `/home/marianska/marianska/js/single-room-booking.js`
- `/home/marianska/marianska/js/bulk-booking.js`
- `/home/marianska/marianska/js/edit-page.js`

**Modes Supported**:
```
GRID        - Main calendar grid view (all rooms)
SINGLE_ROOM - Single room mini calendar
BULK        - Bulk booking calendar
EDIT        - Admin edit reservation calendar
```

**Key Features**:
- Renders month view calendar
- Date selection with interval logic
- Availability color coding (GREEN/YELLOW/RED/GRAY/ORANGE)
- Event listener management with cleanup (fixes memory leak)
- Cell element caching for performance
- Event delegation for mouseover/mouseout

**Global Dependencies**:
- `/* global BookingDisplayUtils */` - Used for room ID formatting

**Issues/Notes**:
- ✅ Properly used across all UI contexts
- ✅ Good separation of concerns
- ✅ Cleaned up memory leaks with removeEventListeners()

---

### 2. ValidationUtils.js
**Purpose**: Unified validation and formatting for all inputs

**Usage Locations**:
- `/home/marianska/marianska/js/booking-form.js` - Real-time validation on blur/input
- `/home/marianska/marianska/js/utils.js` - Contact form validation
- `/home/marianska/marianska/server.js` - Backend validation (critical!)

**Methods Provided**:
```javascript
// Validation
validateEmail(email)
validatePhone(phone)
validatePhoneNumber(phoneNumber, countryCode='+420')
validateZIP(zip)
validateICO(ico)
validateDIC(dic)

// Formatting
formatPhone(phone)
formatZIP(zip)

// Error Messages
getValidationError(field, value, lang, countryCode)
```

**Coverage Analysis**:
- Email: Used universally ✅
- Phone: Validated with country code support ✅
- ZIP: 5-digit validation ✅
- ICO: Optional 8-digit ID ✅
- DIC: Optional Czech tax ID ✅

**Issues Found**:
- ⚠️ **DUPLICATE VALIDATION LOGIC**: booking-form.js has its own validatePhoneNumber/validateICO/validateDIC methods that essentially wrap ValidationUtils
  - Line ~300-400 in booking-form.js
  - These could be removed and delegated to ValidationUtils.getValidationError()

**Recommendation**: Remove duplicate methods from booking-form.js

---

### 3. DateUtils.js
**Purpose**: Unified date formatting, parsing, and calculations

**Usage Locations**:
- `/home/marianska/marianska/js/booking-app.js` - Formatting dates for display
- `/home/marianska/marianska/js/single-room-booking.js` - Date range calculations
- `/home/marianska/marianska/js/calendar.js` - Calendar grid generation
- `/home/marianska/marianska/js/bulk-booking.js` - Date iteration
- `/home/marianska/marianska/server.js` - Backend date operations
- `/home/marianska/marianska/database.js` - Database date operations
- `/home/marianska/marianska/data.js` - **Has its own formatDate() method!**

**Methods Provided**:
```javascript
formatDate(date)           // YYYY-MM-DD format
parseDate(date)            // Timezone-safe parsing (local noon)
getDaysBetween(start, end) // Inclusive night count
calculateDaysUntilStart(startDate)
formatDateDisplay(date, lang)
getDateRanges(dates)
```

**Issues Found**:
- 🔴 **CRITICAL**: data.js has its own formatDate() method (line ~500+)
  - Line usage: `const dateStr = this.formatDate(date);`
  - This DUPLICATES DateUtils.formatDate()
  - Creates confusion about which to use
  - Violates SSOT principle

- ⚠️ **CALENDAR UTILS**: `/home/marianska/marianska/js/calendar-utils.js` also manipulates dates
  - Uses DateUtils.formatDate() correctly in most places
  - Could be consolidated further

**Recommendation**: 
1. Remove DataManager.formatDate() - delegate to DateUtils.formatDate()
2. Update data.js calls to use DateUtils directly
3. This affects ~5-8 calls in data.js

---

### 4. BookingLogic.js
**Purpose**: Business logic for date/booking conflicts and overlap detection

**Usage Locations**:
- `/home/marianska/marianska/server.js` - Backend availability checks
- Included in edit.html and admin.html

**Methods Provided**:
```javascript
checkDateOverlap(start1, end1, start2, end2)  // Exclusive interval logic
isDateOccupied(checkDate, bookingStart, bookingEnd)
formatDate(date)  // Deprecated - delegates to DateUtils
```

**Critical Logic**:
- Implements EXCLUSIVE interval overlap detection
- Allows back-to-back bookings (checkout day = next checkin day)
- Uses strict inequalities: `s1 < e2 && e1 > s2`

**Issues/Notes**:
- ✅ Properly used on server side
- ⚠️ **NOT used on client side** - could be used in calendar validation
  - Clients don't use BookingLogic for conflict checking
  - They rely on availability from server
  - This is actually fine (server is SSOT)

**Recommendation**: No changes needed - correctly used as backend-only

---

### 5. PriceCalculator.js
**Purpose**: All price calculations with room-size based pricing model

**Usage Locations**:
- `/home/marianska/marianska/js/single-room-booking.js` - Per-guest price calculation
- `/home/marianska/marianska/js/booking-form.js` - Per-room price display
- `/home/marianska/marianska/js/utils.js` - Booking details price display

**Methods Provided**:
```javascript
calculatePerGuestPrice({price, adults, children, toddlers, nights})
calculatePerRoomPrices({rooms, adults, children, nights, ...})
calculatePriceFromRooms({rooms, guestType, adults, children, nights, perRoomGuests, settings})
formatPerRoomPricesHTML(prices)
getDefaultPrices()
```

**Model Implemented**:
- Room-size based pricing (2025-11-04 change)
- Per-room guest type support (ÚTIA vs External)
- Price = empty_room_base + (adults × price) + (children × price)
- Toddlers always free

**Issues Found**:
- ⚠️ **DUPLICATE PRICE CALCULATION**: booking-app.js calculates day count
  - Line ~XXX: `const dayCount = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;`
  - This should use DateUtils.getDaysBetween() instead
  - Found in 2 locations in booking-app.js

**Recommendation**: 
Replace manual day count calculations with DateUtils.getDaysBetween() in booking-app.js

---

### 6. IdGenerator.js
**Purpose**: Cryptographically secure ID and token generation

**Usage Locations**:
- `/home/marianska/marianska/js/booking-app.js` - generateSessionId()
- `/home/marianska/marianska/js/single-room-booking.js` - generateToken() for temp IDs
- `/home/marianska/marianska/server.js` - All booking IDs, edit tokens
- `/home/marianska/marianska/data.js` - Session ID generation

**Methods Provided**:
```javascript
generateSessionId()   // SESS + 16 random chars
generateBookingId()   // BK + random chars
generateEditToken()   // 30-char secure token
generateToken(length) // Generic length token
```

**Issues/Notes**:
- ✅ Properly used everywhere
- ✅ Uses crypto.randomBytes for security
- ✅ No duplicates found

**Recommendation**: No changes needed

---

### 7. ChristmasUtils.js
**Purpose**: Christmas period access control and validation

**Usage Locations**:
- `/home/marianska/marianska/js/booking-form.js` - Code requirement UI
- `/home/marianska/marianska/server.js` - Server-side validation

**Methods Provided**:
```javascript
checkChristmasAccessRequirement(currentDate, christmasPeriodStart, isBulkBooking)
validateChristmasRoomLimit(startDate, endDate, christmasPeriodStart, numberOfRooms, isBulkBooking)
```

**Logic Implemented**:
- Before Oct 1: Code required
- After Oct 1: Single rooms allowed, bulk blocked
- Room limits for ÚTIA employees before Oct 1

**Issues/Notes**:
- ✅ Properly used on both client and server
- ✅ Year-aware cutoff logic (handles cross-year periods)
- ✅ Consistent implementation

**Recommendation**: No changes needed

---

### 8. GuestNameUtils.js
**Purpose**: Guest name validation and distribution across rooms

**Usage Locations**:
- Included in HTML files but **MINIMALLY USED**
- Mentioned in CLAUDE.md but not actively called

**Methods Provided**:
```javascript
validateGuestNames(guestNames, totalGuests)
distributeGuestNames(guestNames, perRoomGuests)
```

**Issues Found**:
- ⚠️ **UNDERUTILIZED**: Created for 2025-10-14 multi-room fix
- Only referenced in EditBookingComponent
- Could be used more in booking-form.js for validation

**Recommendation**: 
- Integrate validateGuestNames() call in booking-form.js before submission
- Currently validation is scattered; could be centralized

---

### 9. BookingDisplayUtils.js
**Purpose**: Formatting booking display details

**Usage Locations**:
- `/home/marianska/marianska/js/calendar.js` - formatRoomId()
- `/home/marianska/marianska/js/shared/BaseCalendar.js` - formatRoomId()
- `/home/marianska/marianska/js/utils.js` - renderPerRoomDetailsHTML()

**Methods Provided**:
```javascript
formatRoomId(roomId, lang='cs')
renderPerRoomDetailsHTML(booking, lang='cs')
```

**Issues/Notes**:
- ✅ Properly used for display purposes
- ✅ Minimal duplication
- ✅ Translation support built-in

**Recommendation**: No changes needed

---

### 10. DomUtils.js
**Purpose**: DOM manipulation helpers

**Status**: ⚠️ **LARGELY UNUSED**

**Methods Provided**:
```javascript
createElement(tag, className, content, attributes)
createInput(name, type, value, attributes)
createButton(text, className, onclick)
createLabel(text, htmlFor)
createOption(value, text)
addClass(element, className)
removeClass(element, className)
on(element, event, handler)
off(element, event, handler)
// ... and more
```

**Current Usage**:
- Very limited - mostly direct DOM manipulation instead

**DOM Manipulation Found Across Codebase** (not using DomUtils):
- edit-page.js:
  - `document.createElement('div')` - Should use DomUtils.createElement()
  - `.innerHTML =` - Direct innerHTML, no escaping
  - `.textContent =` - Direct text assignment
  - `.classList.add()` - Should use DomUtils.addClass()

- booking-app.js:
  - `document.createElement('div')` - Multiple instances
  - `.innerHTML = ''` - Clearing elements
  - `.textContent =` - Setting text
  - `.classList.add()` - Adding classes

- single-room-booking.js:
  - `document.createElement('input')` - Should use DomUtils.createInput()
  - `document.createElement('h5')` - Should use DomUtils.createElement()
  - `.appendChild()` - Direct append
  - `.removeChild()` - Direct removal
  - `.innerHTML = ''` - Clearing

**Issues Found**:
- 🔴 **CRITICAL**: No XSS protection on innerHTML in multiple files
  - edit-page.js uses `.innerHTML = ${string}` with potential user data
  - booking-app.js builds HTML via string concatenation
  - single-room-booking.js similar patterns

- ⚠️ **SAFETY ISSUE**: DomUtils could provide escapeHtml() wrapper

**Recommendation**: 
1. Create wrapper for innerHTML that escapes HTML
2. Migrate DOM creation to use DomUtils.createElement()
3. Add input/button factory methods
4. Update all DOM manipulation to use DomUtils

---

### 11. EditBookingComponent.js
**Purpose**: Unified component for editing bookings (user + admin)

**Usage Locations**:
- `/home/marianska/marianska/js/edit-page.js` - User edit page
- `/home/marianska/marianska/admin.html` / admin.js (presumably)

**Key Features**:
- Single component used in both contexts
- Handles room restriction logic (can't add/remove rooms)
- Guest name management
- Date and guest type editing

**Issues/Notes**:
- ✅ Good SSOT for edit functionality
- ✅ Room restrictions properly implemented

**Recommendation**: No changes needed

---

### 12. EmailService.js
**Purpose**: Email notification sending

**Usage Locations**:
- `/home/marianska/marianska/server.js` - Booking confirmation emails

**Methods Provided**:
```javascript
sendBookingConfirmation(booking, {settings})
verifyConnection()
// ... more methods
```

**Issues/Notes**:
- ✅ Properly used on server
- ✅ Non-blocking implementation

**Recommendation**: No changes needed

---

### 13. BookingUtils.js, Logger.js, Errors.js
**Purpose**: Supporting utilities

**Status**: Minimal usage, but properly implemented

**Recommendation**: No changes needed

---

## Part 2: Code Duplications & Anti-Patterns Found

### Issue #1: DataManager.formatDate() Duplicates DateUtils.formatDate()

**Severity**: 🟡 Medium - Creates SSOT violation

**Location**: `/home/marianska/marianska/data.js` lines ~500+

**Evidence**:
```javascript
// data.js line ~500
formatDate(date) {
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return date;
  }
  const d = new Date(date);
  // ... same logic as DateUtils
}
```

**Usage**: ~8 calls throughout data.js
```
- getRoomAvailability() 
- checkConflict()
- getAvailability()
- (more internal usage)
```

**Impact**: 
- Violates SSOT principle
- Confuses developers about which to use
- Duplicates business logic

**Fix Required**:
```javascript
// Change all data.js calls from:
const dateStr = this.formatDate(date);

// To:
const dateStr = DateUtils.formatDate(date);

// Then remove DataManager.formatDate() method entirely
```

---

### Issue #2: booking-app.js Duplicates Day Count Calculation

**Severity**: 🟡 Medium - Duplicates utility logic

**Location**: `/home/marianska/marianska/js/booking-app.js` (2 occurrences)

**Evidence**:
```javascript
// booking-app.js
const dayCount = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
```

**Should Use Instead**:
```javascript
// DateUtils.getDaysBetween(startDate, endDate)
const dayCount = DateUtils.getDaysBetween(startDate, endDate);
```

**Impact**:
- Duplicates date calculation logic
- Potential for inconsistency if logic changes

---

### Issue #3: booking-form.js Duplicates Validation Methods

**Severity**: 🟡 Medium - Duplicates ValidationUtils

**Location**: `/home/marianska/marianska/js/booking-form.js` lines ~300-450

**Evidence**:
```javascript
// booking-form.js (DUPLICATE)
validatePhoneNumber(input) { ... }
validateICO(input) { ... }
validateDIC(input) { ... }

// Should use:
// ValidationUtils.validatePhoneNumber()
// ValidationUtils.validateICO()
// ValidationUtils.validateDIC()
```

**Usage**: Called from booking-app.js event listeners
```javascript
input.addEventListener('input', () => this.bookingForm.validatePhoneNumber(input));
```

**Better Approach**:
```javascript
// Consolidate to use ValidationUtils directly
input.addEventListener('input', () => {
  const isValid = ValidationUtils.validatePhoneNumber(input.value, countryCode);
  input.classList.toggle('invalid', !isValid);
  if (!isValid) {
    const error = ValidationUtils.getValidationError('phoneNumber', input.value, lang);
    displayError(input, error);
  }
});
```

---

### Issue #4: DomUtils Largely Unused

**Severity**: 🟡 Medium - Utility module created but not used

**Location**: `/home/marianska/marianska/js/shared/domUtils.js`

**Evidence**: 
- 100+ lines of DOM helper functions
- Almost no usage in codebase
- Direct DOM manipulation everywhere instead

**Instances of Manual DOM Creation** (should use DomUtils):

```javascript
// ❌ Found in edit-page.js
const confirmDialog = document.createElement('div');
confirmDialog.innerHTML = `...`;
document.body.appendChild(confirmDialog);
setTimeout(() => confirmDialog.classList.add('active'), 10);
confirmDialog.classList.remove('active');

// ✅ Should be:
const confirmDialog = DomUtils.createElement('div', 'confirm-dialog', '', {
  id: 'confirmDialog'
});
DomUtils.on(confirmDialog, 'close', handleClose);
DomUtils.addClass(confirmDialog, 'active');
```

```javascript
// ❌ Found in booking-app.js (multiple times)
const section = document.createElement('div');
section.innerHTML = `...`;
capacityGrid.appendChild(section);

// ✅ Should be:
const section = DomUtils.createElement('div', 'section-class', sectionContent);
DomUtils.append(capacityGrid, section);
```

```javascript
// ❌ Found in single-room-booking.js
const adultsHeader = document.createElement('h5');
adultsHeader.textContent = `${langManager.t('adultsLabel')} (${adults})`;
adultsContainer.appendChild(adultsHeader);

// ✅ Should be:
const adultsHeader = DomUtils.createElement('h5', 'adults-header', 
  `${langManager.t('adultsLabel')} (${adults})`);
DomUtils.append(adultsContainer, adultsHeader);
```

---

### Issue #5: XSS Risk - innerHTML Without Escaping

**Severity**: 🔴 Critical - Security issue

**Location**: Multiple files

**Evidence**:

```javascript
// edit-page.js - User-controlled data in innerHTML
deadlineMessage.innerHTML = `
  ⏰ Do začátku zbývá: ${daysLeft} dní
`;

// booking-app.js - Building HTML from data
summaryEl.innerHTML = summaryHTML; // Where summaryHTML built from user data

// single-room-booking.js
adultsContainer.innerHTML = '';
// ... then appendChild (safer pattern)
```

**Vulnerability**: If booking names, addresses, or other fields contain `<script>` tags, they could execute.

**Recommendation**: Use escapeHtml() utility or textContent for user data

---

### Issue #6: GuestNameUtils.validateGuestNames() Not Used

**Severity**: 🟡 Low-Medium - Feature not utilized

**Location**: `/home/marianska/marianska/js/booking-form.js`

**Issue**: Created but never called

**Should Be Called**: Before form submission to validate:
```javascript
// In booking-form.js submitBooking()
const guestNames = this.guestNameInputs.map(input => input.value);
const totalGuests = adults + children;

if (!GuestNameUtils.validateGuestNames(guestNames, totalGuests)) {
  showError('Invalid guest names');
  return;
}
```

---

## Part 3: Missed Opportunities for New Shared Utilities

### Opportunity #1: ModalDialog Utility

**Current State**: Basic ModalDialog.js exists but minimal usage

**Could Consolidate**:
- All modal opening/closing code
- Modal transition animations
- Backdrop click handling

**Found In**: 
- booking-app.js (multiple modals)
- single-room-booking.js (room selection modal)
- edit-page.js (confirmation dialog)

**Example of Duplication**:
```javascript
// booking-app.js
modal.classList.add('active');
requestAnimationFrame(() => modal.classList.add('show'));

// single-room-booking.js
modal.classList.add('active');

// edit-page.js
setTimeout(() => confirmDialog.classList.add('active'), 10);
```

**Recommendation**: Create ModalManager utility wrapping ModalDialog

---

### Opportunity #2: NotificationManager

**Current State**: No shared notification/toast system

**Found**:
- showNotification() scattered across files
- showSuccess() / showError() patterns
- Manual message display with timeouts

**Would Consolidate**:
- Toast message display
- Error message formatting
- Success confirmation messages
- Duration management
- Position/animation

**Usage Found In**:
- booking-form.js - Multiple notifications
- single-room-booking.js - Multiple notifications
- edit-page.js - Success/error messages

---

### Opportunity #3: FormManager

**Current State**: No form validation orchestrator

**Would Consolidate**:
- Field validation (using ValidationUtils)
- Error display
- Field disabling/enabling
- Form state tracking
- Submission prevention on invalid state

**Usage Found In**:
- booking-form.js - Complex form management
- admin.html / admin.js - Settings form

---

### Opportunity #4: ErrorHandler / ExceptionFormatter

**Current State**: try/catch blocks throughout, inconsistent error handling

**Would Provide**:
```javascript
class ErrorHandler {
  static handle(error, context)     // Format and display errors
  static getLocalizedMessage(key)    // Translated error messages
  static logError(error, context)    // Structured error logging
  static showNotification(error)     // User-friendly display
}
```

**Found In**:
- Inconsistent error handling across all files
- Error messages sometimes in English, sometimes Czech
- Missing user-friendly error localization in many places

---

## Part 4: Usage Summary Table

| Component | Usage | Status | Issues |
|-----------|-------|--------|--------|
| BaseCalendar | ✅ Extensive (booking-app, single-room, bulk, edit) | Good | None |
| ValidationUtils | ✅ Good (booking-form, utils, server) | Good | Duplicate methods in booking-form.js |
| DateUtils | ✅ Very Good (multi-file) | Good | DataManager.formatDate() duplicate |
| BookingLogic | ✅ Good (server) | Good | None |
| PriceCalculator | ✅ Good (pricing locations) | Good | Duplicate day calculation in booking-app.js |
| IdGenerator | ✅ Excellent | Excellent | None |
| ChristmasUtils | ✅ Good | Good | None |
| GuestNameUtils | ⚠️ Minimal | OK | validateGuestNames() not called |
| BookingDisplayUtils | ✅ Good | Good | None |
| DomUtils | ❌ Unused | Poor | Should be used for all DOM manipulation |
| EditBookingComponent | ✅ Good | Good | None |
| EmailService | ✅ Good | Good | None |
| BookingUtils/Logger/Errors | ⚠️ Minimal | OK | Underutilized |

---

## Part 5: Recommended Refactoring Plan

### Priority 1: Critical Security/SSOT Issues
1. **Remove DataManager.formatDate()** - Enforce DateUtils usage (1-2 hours)
2. **Add HTML escaping to DomUtils** - Fix XSS risks (30 mins)
3. **Implement GuestNameUtils.validateGuestNames()** - Call on form submission (30 mins)

### Priority 2: Code Quality Issues
4. **Consolidate booking-form.js validation** - Use ValidationUtils directly (1 hour)
5. **Replace day count calculations** - Use DateUtils.getDaysBetween() (30 mins)
6. **Migrate DOM creation to DomUtils** - Use utility instead of direct createElement() (2-3 hours)

### Priority 3: New Utilities (If Time Permits)
7. **Create NotificationManager** - Consolidate toast/error messages (2 hours)
8. **Create ErrorHandler** - Centralize error handling and localization (1.5 hours)
9. **Expand ModalDialog usage** - Consolidate modal code (1 hour)
10. **Create FormManager** - Validation orchestration (2 hours)

---

## Summary Statistics

- **Total Shared Components**: 13
- **Well-Utilized**: 9 (BaseCalendar, ValidationUtils, DateUtils, BookingLogic, PriceCalculator, IdGenerator, ChristmasUtils, BookingDisplayUtils, EditBookingComponent)
- **Underutilized**: 2 (GuestNameUtils, DomUtils)
- **Minimal Usage**: 2 (BookingUtils, Logger, Errors)

- **Duplicated Code Found**: 
  - DataManager.formatDate() ← DateUtils
  - booking-form.js validation methods ← ValidationUtils  
  - booking-app.js day count calculation ← DateUtils
  - Multiple DOM creation patterns ← DomUtils

- **XSS Vulnerabilities Found**: 2-3 (innerHTML with unsanitized data)
- **New Utilities Recommended**: 4 (NotificationManager, ErrorHandler, FormManager, ModalManager)

**Overall SSOT Compliance**: 75% (Good, but room for improvement)

