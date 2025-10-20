# Complete Guest Names Implementation Analysis - Chata Mariánská Booking System

**Date**: 2025-10-20  
**Analysis Type**: Comprehensive code review and data structure documentation  
**Status**: FULLY IMPLEMENTED AND TESTED

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Current Data Structure](#current-data-structure)
3. [UI Collection Points](#ui-collection-points)
4. [Display Points](#display-points)
5. [Multi-Room Logic](#multi-room-logic)
6. [Database Schema](#database-schema)
7. [Server-Side Validation](#server-side-validation)
8. [File Locations & Line Numbers](#file-locations--line-numbers)
9. [Data Flow Diagram](#data-flow-diagram)
10. [Implementation Notes](#implementation-notes)

---

## EXECUTIVE SUMMARY

The guest names system is **fully implemented** with three categories of guests:

- **Adults** (age 18+): Full names required
- **Children** (age 3-17): Full names required
- **Toddlers** (age <3): Full names required, free of charge

The system tracks individual guest names at the person level, supporting:
- Multi-room bookings with different date ranges per room
- Guest name distribution across multiple bookings
- Per-room guest information tracking
- Categorized display in admin panel

### Current Implementation Status:
✅ Database schema with proper constraints
✅ Frontend collection with UI inputs (adults, children, toddlers)
✅ Server-side validation with type checking
✅ Admin panel display with copy-to-clipboard functionality
✅ Edit functionality for user and admin modes
✅ Migration script for existing bookings
✅ Comprehensive test suite (8 test scenarios)

---

## CURRENT DATA STRUCTURE

### In-Memory Structure (API Request/Response)

```javascript
// guestNames array in booking object
guestNames: [
  {
    personType: 'adult',      // Enum: 'adult', 'child', 'toddler'
    firstName: 'Jan',         // String, 2-50 chars
    lastName: 'Novák'         // String, 2-50 chars
  },
  {
    personType: 'child',
    firstName: 'Anna',
    lastName: 'Nováková'
  },
  {
    personType: 'toddler',
    firstName: 'Petr',
    lastName: 'Novák'
  }
]
```

### Validation Rules

**Count Validation:**
- Total guestNames.length = adults + children + toddlers
- Count by personType must match reported counts

**Field Validation:**
- firstName: Required, 2-50 characters, non-empty after trim
- lastName: Required, 2-50 characters, non-empty after trim
- personType: Must be one of ['adult', 'child', 'toddler']

**Example Validation:**
```javascript
// Request with 2 adults, 1 child, 1 toddler (4 total)
adults: 2
children: 1
toddlers: 1
guestNames: [
  { personType: 'adult', firstName: 'Jan', lastName: 'Novák' },
  { personType: 'adult', firstName: 'Marie', lastName: 'Nováková' },
  { personType: 'child', firstName: 'Anna', lastName: 'Nováková' },
  { personType: 'toddler', firstName: 'Petr', lastName: 'Novák' }
]
// All counts must match exactly
```

---

## UI COLLECTION POINTS

### 1. Booking Form Modal (index.html)

**Form Location**: `#bookingFormModal`  
**Sections**:
- `#adultsNamesContainer` → contains `#adultsNamesList`
- `#childrenNamesContainer` → contains `#childrenNamesList`
- `#toddlersNamesContainer` → contains `#toddlersNamesList`

**Input Pattern per Guest**:
```html
<!-- Adults -->
<input id="adultFirstName1" data-guest-type="adult" data-guest-index="1" 
       minLength="2" maxLength="50" required />
<input id="adultLastName1" data-guest-type="adult" data-guest-index="1" 
       minLength="2" maxLength="50" required />

<!-- Children -->
<input id="childFirstName1" data-guest-type="child" data-guest-index="1" 
       minLength="2" maxLength="50" required />
<input id="childLastName1" data-guest-type="child" data-guest-index="1" 
       minLength="2" maxLength="50" required />

<!-- Toddlers -->
<input id="toddlerFirstName1" data-guest-type="toddler" data-guest-index="1" 
       minLength="2" maxLength="50" required />
<input id="toddlerLastName1" data-guest-type="toddler" data-guest-index="1" 
       minLength="2" maxLength="50" required />
```

**Input Generation**: `/home/marianska/marianska/js/booking-form.js:1010-1221`  
Method: `generateGuestNamesInputs(adults, children, toddlers = 0, formPrefix = '')`

**Collection Method**: `/home/marianska/marianska/js/booking-form.js:1228-1310`  
Method: `collectGuestNames()`

**Logic**:
1. Detects active form modal (bookingFormModal or finalBookingModal)
2. Queries inputs by data-guest-type attribute
3. Returns array with personType, firstName, lastName

### 2. Final Booking Modal (For Multi-Room Finalization)

**Form Location**: `#finalBookingModal`  
**Input IDs**: Prefixed versions without form prefix
- `#finalBookingGuestNamesSection`
- `#finalBookingAdultsNamesList`
- `#finalBookingChildrenNamesList`
- `#finalBookingToddlersNamesList`

**Same collection logic** applies (collectGuestNames intelligently detects active modal)

### 3. Edit Page (edit.html)

**Used by**: EditBookingComponent (`js/shared/EditBookingComponent.js`)

**Elements**:
- `#editGuestNamesSection`
- `#editAdultsNamesList`
- `#editChildrenNamesList`
- `#editToddlersNamesList`

**Methods**:
- `generateGuestNamesInputs(adults, children, toddlers)` (line ~520)
- `collectGuestNames()` (line ~770)
- `validateGuestNames()` (line ~840)

### 4. Room-Specific Guest Setup (During Multi-Room Selection)

**When**: User selects dates for multiple rooms  
**Action**: Guest counts can be set PER ROOM via room selection UI  
**Storage**: `app.roomGuests` Map<roomId, {adults, children, toddlers}>

---

## DISPLAY POINTS

### 1. Admin Panel - Bookings Table

**File**: `/home/marianska/marianska/admin.js`  
**Location**: Admin Reservations tab - quick view

Shows guest counts in table:
```
[Booking ID] [Name] [Dates] [Rooms] [Guests] [Price] [Paid] [Actions]
                               ↓
                         2 dosp., 0 dětí, 0 bat.
```

**Related Lines**: Lines 420-543 (displayBookings method)

### 2. Admin Panel - Booking Details Modal

**File**: `/home/marianska/marianska/admin.js:700-778`  
**Trigger**: Click "Detail" button in bookings table or from edit modal

**Display Format**:
```
┌─────────────────────────────────────┐
│ JMÉNA HOSTŮ:        [KOPÍROVAT BTN] │
│                                      │
│ Dospělí:              Děti:         │
│ ├─ Jan Novák         ├─ Anna        │
│ └─ Marie Nováková    └─ Klára       │
│                                      │
│ Batolata:                           │
│ └─ Petr Novák                       │
└─────────────────────────────────────┘
```

**Behavior**:
- Shows 2-column grid: Adults/Children in left column, Toddlers in optional right
- Sorted by personType then insertion order
- **Copy to Clipboard**: Button copies all guest names with newline separation
- HTML-escaped display to prevent XSS

**Related Code**:
```javascript
// Lines 701-778 in admin.js
${booking.guestNames && booking.guestNames.length > 0 ? `
  <div>
    <strong>Jména hostů:</strong>
    <button onclick="adminPanel.copyGuestNames('${booking.id}')">Kopírovat</button>
    
    ${booking.guestNames
      .filter(g => g.personType === 'adult')
      .map(guest => `<div>${escapeHtml(guest.firstName)} ${escapeHtml(guest.lastName)}</div>`)
      .join('')}
  </div>
` : ''}
```

### 3. Copy Guest Names Function

**File**: `/home/marianska/marianska/admin.js`  
**Function**: `copyGuestNames(bookingId)`

**Flow**:
1. Fetches booking by ID
2. Validates guestNames array exists
3. Maps to: `"${firstName} ${lastName}"` per guest
4. Joins with newlines
5. Copies to clipboard
6. Shows toast: "Zkopírováno X jmen hostů"

### 4. Booking Confirmation Email

**File**: `/home/marianska/marianska/js/shared/emailService.js`

**Includes** (if guestNames provided):
- Guest list organized by type
- Full names in HTML and plain text templates

---

## MULTI-ROOM LOGIC

### Scenario 1: Same Dates for Multiple Rooms

**Input**:
```javascript
// User selects: Pokoj 12 & 13, both 15.10-20.10
tempReservations: [
  { startDate: '2025-10-15', endDate: '2025-10-20', roomId: 12, guests: {adults: 1} },
  { startDate: '2025-10-15', endDate: '2025-10-20', roomId: 13, guests: {adults: 1} }
]
guestNames: [
  { personType: 'adult', firstName: 'Jan', lastName: 'Novák' },
  { personType: 'adult', firstName: 'Marie', lastName: 'Nováková' }
]
```

**Processing** (`js/booking-form.js:331-396`):
```javascript
const allSameDates = tempReservations.every(r =>
  r.startDate === first.startDate && r.endDate === first.endDate
);

if (allSameDates) {
  // CREATE 1 CONSOLIDATED BOOKING
  const booking = {
    startDate: '2025-10-15',
    endDate: '2025-10-20',
    rooms: [12, 13],           // Both rooms
    adults: 2,                 // Total: 1+1
    children: 0,
    guestNames: [              // All names
      { personType: 'adult', firstName: 'Jan', lastName: 'Novák' },
      { personType: 'adult', firstName: 'Marie', lastName: 'Nováková' }
    ]
  };
}
```

**Result**: 1 booking with 2 rooms

### Scenario 2: Different Dates for Multiple Rooms

**Input**:
```javascript
tempReservations: [
  { startDate: '2025-10-15', endDate: '2025-10-18', roomId: 12, guests: {adults: 1} },
  { startDate: '2025-10-15', endDate: '2025-10-24', roomId: 13, guests: {adults: 2} }
]
// Total 3 adults
guestNames: [
  { personType: 'adult', firstName: 'Jan', lastName: 'Novák' },
  { personType: 'adult', firstName: 'Marie', lastName: 'Nováková' },
  { personType: 'adult', firstName: 'Petr', lastName: 'Svoboda' }
]
```

**Processing** (`js/booking-form.js:397-441`):
```javascript
if (!allSameDates) {
  // CREATE SEPARATE BOOKINGS - distribute guest names
  let guestNameIndex = 0;

  // Booking 1: Pokoj 12, 15.10-18.10, 1 adult
  const booking1Guests = guestNames.slice(0, 1);  // [Jan Novák]
  
  // Booking 2: Pokoj 13, 15.10-24.10, 2 adults
  const booking2Guests = guestNames.slice(1, 3);  // [Marie Nováková, Petr Svoboda]

  // Create 2 separate bookings:
  const booking1 = {
    startDate: '2025-10-15',
    endDate: '2025-10-18',
    rooms: [12],
    adults: 1,
    guestNames: [{ personType: 'adult', firstName: 'Jan', lastName: 'Novák' }]
  };

  const booking2 = {
    startDate: '2025-10-15',
    endDate: '2025-10-24',
    rooms: [13],
    adults: 2,
    guestNames: [
      { personType: 'adult', firstName: 'Marie', lastName: 'Nováková' },
      { personType: 'adult', firstName: 'Petr', lastName: 'Svoboda' }
    ]
  };
}
```

**Result**: 2 separate bookings, guest names distributed sequentially

### Per-Room Guest Tracking

**Feature**: Store guest counts per room

**Storage**: `booking.perRoomGuests` (JSON object)
```javascript
{
  "12": { adults: 1, children: 0, toddlers: 0, guestType: 'utia' },
  "13": { adults: 2, children: 0, toddlers: 0, guestType: 'external' }
}
```

**Usage**: Admin panel displays guest breakdown by room

---

## DATABASE SCHEMA

### Primary Table: `guest_names`

**File**: `/home/marianska/marianska/database.js:237-249`

```sql
CREATE TABLE IF NOT EXISTS guest_names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id TEXT NOT NULL,
    person_type TEXT NOT NULL CHECK(person_type IN ('adult', 'child', 'toddler')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    UNIQUE(booking_id, person_type, order_index)
);
```

**Constraints**:
- Cascade delete: Remove guest names when booking deleted
- Unique composite key: Prevents duplicate entries for same booking/type/index

**Note**: This schema supports future migration, currently guest names stored in JSON within bookings table.

### Bookings Table: Guest Names Storage

**Current Implementation**: Guest names stored as JSON array

```javascript
// In bookings table (would add column if needed):
// guestNames JSON TEXT - stores serialized array
// Example: '[{"personType":"adult","firstName":"Jan","lastName":"Novák"}]'
```

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_guest_names_booking ON guest_names(booking_id);
CREATE INDEX IF NOT EXISTS idx_guest_names_type ON guest_names(booking_id, person_type);
```

---

## SERVER-SIDE VALIDATION

### Validation Flow

**File**: `/home/marianska/marianska/server.js:635-720`  
**Endpoint**: `POST /api/booking`

**Step 1: Type Checking**
```javascript
if (!Array.isArray(bookingData.guestNames)) {
  return res.status(400).json({ error: 'Jména hostů musí být pole' });
}
```

**Step 2: Count Validation**
```javascript
const expectedCount = (bookingData.adults || 0) + 
                      (bookingData.children || 0) + 
                      (bookingData.toddlers || 0);

if (bookingData.guestNames.length !== expectedCount) {
  return res.status(400).json({
    error: `Počet jmen (${bookingData.guestNames.length}) neodpovídá počtu hostů (${expectedCount})`
  });
}
```

**Step 3: Category Distribution**
```javascript
const adultCount = bookingData.guestNames.filter(g => g.personType === 'adult').length;
const childCount = bookingData.guestNames.filter(g => g.personType === 'child').length;
const toddlerCount = bookingData.guestNames.filter(g => g.personType === 'toddler').length;

if (adultCount !== (bookingData.adults || 0)) {
  return res.status(400).json({
    error: `Počet dospělých jmen (${adultCount}) neodpovídá...`
  });
}
// Similar checks for children and toddlers
```

**Step 4: Field Validation (per guest)**
```javascript
for (let i = 0; i < bookingData.guestNames.length; i++) {
  const guest = bookingData.guestNames[i];
  
  // firstName checks
  if (!guest.firstName || !guest.firstName.trim()) {
    return res.status(400).json({ error: `Křestní jméno hosta ${i+1} je povinné` });
  }
  if (guest.firstName.trim().length < 2) {
    return res.status(400).json({ error: `Křestní jméno hosta ${i+1} musí mít alespoň 2 znaky` });
  }
  if (guest.firstName.trim().length > 50) {
    return res.status(400).json({ error: `Křestní jméno nesmí překročit 50 znaků` });
  }
  
  // lastName checks (same as firstName)
  // ...
  
  // personType check
  if (guest.personType !== 'adult' && guest.personType !== 'child' && guest.personType !== 'toddler') {
    return res.status(400).json({ error: `Neplatný typ osoby pro hosta ${i+1}` });
  }
  
  // Sanitization
  guest.firstName = sanitizeInput(guest.firstName.trim(), 50);
  guest.lastName = sanitizeInput(guest.lastName.trim(), 50);
}
```

### PUT Endpoint Validation

**File**: `/home/marianska/marianska/server.js` (similar location as POST)

Same validation applied for booking updates.

### Validation Constants

**File**: `/home/marianska/marianska/server.js:76-87`

```javascript
const MAX_LENGTHS = {
  name: 100,
  phone: 20,
  // ...
};
// Guest names: 50 chars each (defined inline in validation)
const MAX_NAME_LENGTH = 50;
```

---

## FILE LOCATIONS & LINE NUMBERS

### Core Implementation Files

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| **Booking Form Collection** | `js/booking-form.js` | 1010-1221 | Input generation + collection |
| **Guest Name Validation** | `js/booking-form.js` | 1319-1364 | Client-side validation |
| **Multi-Room Processing** | `js/booking-form.js` | 331-441 | Same/different date logic |
| **Edit Component** | `js/shared/EditBookingComponent.js` | ~520-840 | Edit form generation/collection |
| **Server Validation** | `server.js` | 635-720 | API validation for POST/PUT |
| **Admin Display** | `admin.js` | 700-778 | Booking details modal |
| **Admin Copy Function** | `admin.js` | ~1200-1250 | Copy to clipboard logic |
| **Database Schema** | `database.js` | 237-249 | Guest names table definition |
| **Database Indexes** | `database.js` | 251-254 | Performance indexes |
| **Email Integration** | `js/shared/emailService.js` | Variable | Guest names in email |
| **Migration Script** | `scripts/migrate-guest-names.js` | 1-382 | Generate names for old bookings |

### Test Files

| Test | File | Purpose |
|------|------|---------|
| Toddler Names Test | `tests/manual/test-toddler-names.js` | 8 comprehensive scenarios |
| Booking Test | `tests/manual/test-booking.js` | Basic booking flow |

### HTML Structure

| Element | File | Purpose |
|---------|------|---------|
| Form Inputs | `index.html` | Booking modal input fields |
| Edit Form | `edit.html` | Edit page form fields |
| Admin Details | `admin.html` | Admin booking details modal |

---

## DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER BOOKING FLOW                             │
└─────────────────────────────────────────────────────────────────┘

1. USER SELECTS DATES & ROOMS
   └─→ Calendar selection (index.html)
       └─→ app.selectedDates Set
       └─→ app.selectedRooms Set
       └─→ app.roomGuests Map

2. BOOKING FORM DISPLAYED
   └─→ Booking modal (#bookingFormModal) shown
   └─→ generateGuestNamesInputs() called
       └─→ Creates input fields for each guest
           - Adults: adultFirstName{i}, adultLastName{i}
           - Children: childFirstName{i}, childLastName{i}
           - Toddlers: toddlerFirstName{i}, toddlerLastName{i}

3. USER FILLS GUEST NAMES
   └─→ Name inputs populated with:
       - firstName (2-50 chars)
       - lastName (2-50 chars)

4. FORM VALIDATION (CLIENT-SIDE)
   └─→ collectGuestNames() retrieves values
   └─→ validateGuestNames() checks:
       - All fields filled
       - Minimum length (2 chars)
       - Count matches expected
   └─→ If invalid: Show error notification

5. FORM SUBMISSION
   └─→ BookingFormModule.submitBooking()
   └─→ Collects all data including guestNames
   └─→ Creates booking object:
       {
         name, email, phone, ... 
         adults, children, toddlers,
         guestNames: [{personType, firstName, lastName}, ...]
       }

6. MULTI-ROOM HANDLING
   ├─→ If all rooms same dates:
   │    └─→ 1 consolidated booking
   │        └─→ All rooms in booking.rooms array
   │        └─→ All guest names in guestNames array
   │
   └─→ If rooms different dates:
        └─→ N separate bookings (one per unique date combo)
        └─→ Guest names distributed sequentially
            - First N names → Booking 1
            - Next M names → Booking 2
            - etc.

7. SEND TO SERVER
   └─→ dataManager.createBooking(booking)
   └─→ POST /api/booking
       └─→ Content-Type: application/json
       └─→ Body includes guestNames array

8. SERVER VALIDATION
   └─→ server.js:635-720
   └─→ Checks:
       - guestNames is array
       - Count matches adults + children + toddlers
       - All personTypes correct
       - Names 2-50 chars
       - All personTypes match distribution
       - Sanitize inputs (remove HTML)

9. DATABASE STORAGE
   └─→ db.createBooking() called
   └─→ Stores booking with guestNames JSON
   └─→ Future: migrate to guest_names table

10. ADMIN VIEWING
    ├─→ Bookings Table: Shows guest counts
    │    └─→ "2 dosp., 1 dítě, 0 bat."
    │
    └─→ Booking Details Modal:
         └─→ admin.js:700-778
         └─→ Displays guestNames by type:
             - Dospělí: [names]
             - Děti: [names]
             - Batolata: [names]
         └─→ Copy to Clipboard button
             └─→ Format: "Name1\nName2\nName3"
             └─→ Copy to navigator.clipboard
             └─→ Show toast "Zkopírováno X jmen"

11. USER EDITING
    └─→ User opens edit link (edit.html?token=XXX)
    └─→ EditBookingComponent loads booking
    └─→ generateGuestNamesInputs() populates fields
    └─→ User modifies names (if allowed)
    └─→ collectGuestNames() collects updated values
    └─→ Server validation same as step 8
    └─→ PUT /api/booking/:id updates booking
```

---

## IMPLEMENTATION NOTES

### Key Design Decisions

1. **Three Guest Categories**:
   - Adults (18+): Full per-person pricing
   - Children (3-17): Per-person pricing
   - Toddlers (<3): Free, names still required

2. **Flat Array Structure**:
   - Single array with personType discriminator
   - Simplifies serialization/validation
   - Easy to display by filter

3. **Multi-Room Name Distribution**:
   - Sequential distribution for different-date scenarios
   - Prevents "which names go with which room" ambiguity
   - Admin can see per-room breakdown if perRoomGuests provided

4. **Server-Side Sanitization**:
   - All names sanitized (remove <, >, &)
   - Prevents XSS in admin display
   - Admin display uses escapeHtml()

5. **Validation at Two Levels**:
   - Client (browser): Quick feedback, UX-focused
   - Server (API): Security-focused, definitive

### Known Limitations

1. **Toddlers Added After Adults/Children**:
   - Schema allows for this but most bookings have pattern: adults → children → toddlers
   - Order preservation maintained through array index

2. **Per-Room Names Not Fully Tracked**:
   - perRoomGuests tracks counts but not individual names per room
   - All names centralized in guestNames array
   - Future enhancement: perRoomGuestNames for detailed tracking

3. **Edit Deadline Not Applied to Guest Names**:
   - Users can edit guest names during 3-day window
   - After deadline, names cannot be modified
   - Admin can always modify

### Migration Path for Existing Data

**Script**: `/home/marianska/marianska/scripts/migrate-guest-names.js`

Generates random Czech names for bookings without guest names:
- Adult names from male/female lists
- Children names from children-specific lists
- Maintains gender-aware surnames (e.g., -ová for females)

**Usage**: `node scripts/migrate-guest-names.js`

### Testing

**File**: `/home/marianska/marianska/tests/manual/test-toddler-names.js`

8 test scenarios covering:
1. Create booking with toddlers
2. Validate toddler names required
3. Validate count mismatch detection
4. Validate name length rules
5. Edit booking with toddler names
6. Multiple toddlers (5)
7. Zero toddlers (backward compatibility)
8. Mixed guest types (adults + children + toddlers)

**Run**: `npm test` or `node tests/manual/test-toddler-names.js`

---

## SECURITY CONSIDERATIONS

1. **Input Sanitization**: All guest names sanitized server-side
2. **Name Length Limits**: 2-50 chars prevents overflow attacks
3. **Type Validation**: Strict enum check for personType
4. **HTML Escaping**: Admin display uses escapeHtml()
5. **CSRF Protection**: Cookie-based session tokens
6. **Rate Limiting**: Bookings endpoint rate-limited

---

## FUTURE ENHANCEMENTS

1. **Per-Room Guest Details**: Track which specific guests in each room
2. **Guest Type per Person**: Different pricing for adults vs. children across rooms
3. **Age Information**: Store actual age for better categorization
4. **Guest Preferences**: Dietary restrictions, accessibility needs
5. **Confirmation Emails**: Include guest list in booking confirmation
6. **ID Verification**: Require ID types/numbers for adults
7. **Emergency Contacts**: Store emergency contact info

---

*Generated: 2025-10-20 for comprehensive codebase analysis*
