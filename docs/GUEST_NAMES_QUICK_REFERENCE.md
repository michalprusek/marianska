# Guest Names Implementation - Quick Reference

**Status**: Fully Implemented ✅

---

## Data Structure

```javascript
guestNames: [
  { personType: 'adult', firstName: 'Jan', lastName: 'Novák' },
  { personType: 'child', firstName: 'Anna', lastName: 'Nováková' },
  { personType: 'toddler', firstName: 'Petr', lastName: 'Novák' }
]
```

**Three Categories**:
- **adult** (18+): Full pricing per person
- **child** (3-17): Reduced pricing per person  
- **toddler** (<3): Free

---

## Key Files & Locations

| Task | File | Lines |
|------|------|-------|
| Generate inputs | `js/booking-form.js` | 1010-1221 |
| Collect names | `js/booking-form.js` | 1228-1310 |
| Validate (client) | `js/booking-form.js` | 1319-1364 |
| Validate (server) | `server.js` | 635-720 |
| Admin display | `admin.js` | 700-778 |
| Admin copy button | `admin.js` | ~1200+ |
| Edit component | `js/shared/EditBookingComponent.js` | ~520-840 |

---

## Validation Rules

| Check | Min | Max | Notes |
|-------|-----|-----|-------|
| firstName | 2 chars | 50 chars | Required, trimmed |
| lastName | 2 chars | 50 chars | Required, trimmed |
| Count | = adults + children + toddlers | N/A | Must match exactly |
| Type | 'adult' \| 'child' \| 'toddler' | N/A | Strict enum |

---

## API Examples

### Create Booking with Guest Names

```bash
POST /api/booking
Content-Type: application/json

{
  "name": "Jan Novák",
  "email": "jan@example.com",
  "startDate": "2025-10-15",
  "endDate": "2025-10-20",
  "rooms": [12, 13],
  "adults": 2,
  "children": 1,
  "toddlers": 0,
  "guestNames": [
    { "personType": "adult", "firstName": "Jan", "lastName": "Novák" },
    { "personType": "adult", "firstName": "Marie", "lastName": "Nováková" },
    { "personType": "child", "firstName": "Anna", "lastName": "Nováková" }
  ]
}
```

### Response

```json
{
  "id": "BK1a2b3c4d5e6f",
  "editToken": "abc123def456xyz789...",
  "guestNames": [
    { "personType": "adult", "firstName": "Jan", "lastName": "Novák" },
    { "personType": "adult", "firstName": "Marie", "lastName": "Nováková" },
    { "personType": "child", "firstName": "Anna", "lastName": "Nováková" }
  ]
}
```

---

## Multi-Room Scenarios

### Same Dates → 1 Booking

```
Room 12: 15.10-20.10, 1 adult
Room 13: 15.10-20.10, 1 adult

↓ 

Result: 1 booking with rooms=[12, 13], adults=2
```

### Different Dates → N Bookings

```
Room 12: 15.10-18.10, 1 adult
Room 13: 15.10-24.10, 2 adults

↓

Result: 
  - Booking 1: rooms=[12], adults=1, names=[Jan]
  - Booking 2: rooms=[13], adults=2, names=[Marie, Petr]
```

---

## Testing

Run 8 comprehensive test scenarios:

```bash
node tests/manual/test-toddler-names.js
```

Tests:
1. Create with toddlers
2. Toddler names required
3. Count mismatch detection
4. Name length validation
5. Edit with toddlers
6. Multiple toddlers (5)
7. Zero toddlers (backward compat)
8. Mixed guest types

---

## UI Sections

### Booking Form
- `#adultsNamesContainer` → `#adultsNamesList`
- `#childrenNamesContainer` → `#childrenNamesList`
- `#toddlersNamesContainer` → `#toddlersNamesList`

### Edit Form
- `#editGuestNamesSection`
- `#editAdultsNamesList`
- `#editChildrenNamesList`
- `#editToddlersNamesList`

### Admin Display
- Bookings table: Guest counts summary
- Detail modal: Full names organized by type
- Copy button: Exports all names to clipboard

---

## Validation Flow

```
Client Input
    ↓
generateGuestNamesInputs() creates fields
    ↓
User fills: firstName, lastName for each guest
    ↓
collectGuestNames() gathers values
    ↓
validateGuestNames() checks count & length
    ↓
submitBooking() sends to server
    ↓
server.js:635-720 validates:
  - Is array?
  - Count matches?
  - Types correct?
  - Names 2-50 chars?
  - Sanitize input
    ↓
db.createBooking() stores with guestNames JSON
    ↓
Response includes guestNames array
```

---

## Admin Features

### View Guest Names
1. Admin panel → Reservations
2. Click "Detail" button
3. Scroll to "Jména hostů" section
4. See names organized by type

### Copy Guest Names
1. In detail modal, find "Kopírovat" button
2. Click to copy all names
3. Format: "Name1\nName2\nName3"
4. Toast shows: "Zkopírováno X jmen"

### Edit Guest Names
1. Click "Upravit" button
2. Modify names in edit form
3. Save changes
4. Same validation applied

---

## Errors & Solutions

| Error | Cause | Fix |
|-------|-------|-----|
| "guestNames musí být pole" | Not an array | Send as `guestNames: [...]` |
| "Počet jmen neodpovídá" | Count mismatch | Count must = adults + children + toddlers |
| "Počet dospělých jmen neodpovídá" | Wrong # of adults | Filter guestNames by personType === 'adult' |
| "Křestní jméno musí mít alespoň 2 znaky" | Name too short | Both firstName & lastName min 2 chars |
| "Neplatný typ osoby" | Wrong personType | Must be 'adult', 'child', or 'toddler' |

---

## Security

- ✅ Input sanitized (remove `<`, `>`, `&`)
- ✅ Name length limited (50 chars)
- ✅ Type validated (strict enum)
- ✅ HTML escaped in admin display
- ✅ Server-side validation definitive
- ✅ Rate limiting on booking endpoint

---

## For Developers

### Add a New Guest

```javascript
const guestNames = this.collectGuestNames();
guestNames.push({
  personType: 'adult',
  firstName: 'New',
  lastName: 'Guest'
});
// Validate & submit
```

### Check Guest Count

```javascript
const adults = guestNames.filter(g => g.personType === 'adult').length;
const children = guestNames.filter(g => g.personType === 'child').length;
const toddlers = guestNames.filter(g => g.personType === 'toddler').length;
```

### Display Guest Name

```javascript
const guest = guestNames[0];
const fullName = `${guest.firstName} ${guest.lastName}`;
```

---

**Full Documentation**: See `GUEST_NAMES_IMPLEMENTATION.md`
