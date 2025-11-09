# Form State Preservation Patterns - Codebase Analysis

## Executive Summary

The Mariánská booking system implements several reusable patterns for preserving form state when DOM elements are re-rendered. These patterns ensure user input is not lost when the UI updates in response to user interactions.

**Key Finding**: The codebase uses a **two-phase approach**:
1. **Generate** input fields with structure (IDs, attributes)
2. **Populate** fields with existing/cached values

This pattern is implemented consistently across multiple components and can be adapted for guest name input preservation.

---

## Pattern 1: The "Generate + Populate" Pattern (RECOMMENDED)

### Overview
This is the primary pattern used throughout the codebase. It separates:
- **Generation**: Creating the input element structure
- **Population**: Filling in the values from cached data

### Real-World Implementation: EditBookingComponent

**Location**: `/js/shared/EditBookingComponent.js` lines 469-526

```javascript
populateGuestNames() {
  // PHASE 1: Generate structure (creates empty input fields)
  this.generateGuestNamesInputs(totalAdults, totalChildren, totalToddlers);

  // PHASE 2: Populate with existing data (fills in values)
  if (this.currentBooking.guestNames && Array.isArray(this.currentBooking.guestNames)) {
    const adultNames = this.currentBooking.guestNames.filter((g) => g.personType === 'adult');

    // Iterate and populate each field by ID
    adultNames.forEach((guest, index) => {
      const firstNameInput = document.getElementById(`editAdultFirstName${index + 1}`);
      if (firstNameInput) {
        firstNameInput.value = guest.firstName || ''; // ← VALUE ASSIGNMENT
      }
    });
  }
}
```

**Why This Works**:
1. IDs are consistent and predictable (e.g., `editAdultFirstName1`, `editAdultFirstName2`)
2. The generate phase creates the DOM structure with correct IDs
3. The populate phase re-attaches values using those same IDs
4. Even if HTML is completely replaced, the same IDs are used, so values survive

### Key Code Path
```
updateRoomGuests() [user changes guest count]
  ↓
renderPerRoomList() [re-renders guest count UI]
  ↓
populateGuestNames() [called at line 248, 482, 989, 1943]
  ↓
generateGuestNamesInputs() [creates new structure with same IDs]
  ↓
Populates from this.currentBooking.guestNames [values re-attached]
```

---

## Pattern 2: ID-Based Recovery (Used in Multiple Components)

### Overview
When form inputs need to survive DOM re-renders, use consistent ID schemes that allow value recovery.

### Examples in Codebase

#### 1. SingleRoomBooking - Guest Names with Map-Based Organization

**Location**: `/js/single-room-booking.js` lines 831-916

```javascript
collectGuestNames() {
  const guestNames = [];
  const guestMap = new Map(); // ← KEY: Map structure for grouping

  inputs.forEach((input) => {
    const guestType = input.dataset.guestType;
    const guestIndex = input.dataset.guestIndex;
    const key = `${guestType}-${guestIndex}`; // ← KEY: Consistent key

    if (!guestMap.has(key)) {
      guestMap.set(key, { personType: guestType });
    }

    const guest = guestMap.get(key);
    guest.firstName = input.value.trim(); // ← VALUE EXTRACTION
  });

  return guestNames;
}
```

**Key Features**:
- Uses `data-guest-type` and `data-guest-index` attributes
- Creates Map with consistent keys (`adult-0`, `adult-1`, etc.)
- Collects input values at submission time

#### 2. Billing Form Fields

**Location**: `/js/shared/EditBookingComponent.js` lines 1256-1266

```javascript
getFormData() {
  const formData = {
    name: document.getElementById('editName').value.trim(),
    email: document.getElementById('editEmail').value.trim(),
    phone: document.getElementById('editPhone').value.trim(),
    company: document.getElementById('editCompany').value.trim(),
    // ... more fields
  };
}
```

**Why This Works**:
- Stable IDs ensure values can be retrieved after re-renders
- No intermediate storage needed (read from DOM on submission)
- Simple and reliable

---

## Pattern 3: Component State Preservation

### Overview
Store critical data in component properties rather than only in DOM.

### Example: EditBookingComponent State Management

**Location**: `/js/shared/EditBookingComponent.js` lines 38-66

```javascript
constructor(config = {}) {
  // Edit state stored in component
  this.currentBooking = null;                        // ← Booking data cache
  this.editSelectedRooms = new Map();                // ← Room/guest structure
  this.perRoomDates = new Map();                     // ← Per-room dates
  this.originalRooms = [];                           // ← Original room list

  // Proposed bookings session
  this.sessionId = null;                             // ← Session tracking
}

loadBooking(booking, settings) {
  this.currentBooking = booking;    // ← CACHE: Store incoming data
  this.originalRooms = [...(booking.rooms || [])]; // ← PRESERVE: Keep original

  // Initialize from cached data
  (booking.rooms || []).forEach((roomId) => {
    const roomGuests = booking.perRoomGuests[roomId];
    this.editSelectedRooms.set(roomId, {
      guestType: roomGuests.guestType,
      adults: roomGuests.adults,
      // ... other fields
    });
  });
}
```

**Benefits**:
- Component state survives DOM recreation
- Can restore from component property vs. DOM query
- Single source of truth for multi-step forms

---

## Pattern 4: Capture-Before-Re-render

### Overview
When DOM will be destroyed and rebuilt, capture current values first.

### Implementation Example

```javascript
// BEFORE re-render: Capture current state
captureFormState() {
  this.savedFormState = {
    guestNames: this.collectGuestNames(), // ← CAPTURE
    billingData: {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
    }
  };
}

// AFTER re-render: Restore saved state
restoreFormState() {
  if (this.savedFormState?.guestNames) {
    this.savedFormState.guestNames.forEach((guest, index) => {
      // Restore each guest name using new DOM structure
    });
  }
}

// In event handler
onUserInteraction() {
  this.captureFormState();      // ← Save before destroying DOM
  this.rerenderForm();          // ← Destroy and recreate DOM
  this.restoreFormState();      // ← Restore from saved state
}
```

---

## Pattern 5: localStorage/sessionStorage for Persistence

### Overview
For longer-lived state that should survive page reloads or tab closures.

### Examples in Codebase

**Location**: `/js/data.js` (various methods)

```javascript
// Store data
localStorage.setItem(this.storageKey, JSON.stringify(this.cachedData));

// Retrieve data
const cachedData = localStorage.getItem(this.storageKey);
if (cachedData) {
  this.cachedData = JSON.parse(cachedData);
}
```

**When to Use**:
- Multi-step forms with page navigation
- Draft data that should persist across sessions
- Temporary booking state (proposed bookings)

**What NOT to Do**:
- Don't store sensitive data (passwords, payment info)
- Don't rely solely on localStorage (use component state as primary)

---

## Pattern Comparison: Advantages & Trade-offs

| Pattern | Pros | Cons | Best For |
|---------|------|------|----------|
| **Generate + Populate** | ✅ Reliable, consistent IDs work across re-renders | ⚠️ Need to generate structure first | Form generation, admin edit modal |
| **ID-Based Recovery** | ✅ Simple, no intermediate storage | ❌ Fails if IDs change | Static form structures |
| **Component State** | ✅ Survives complex interactions | ⚠️ Requires careful lifecycle management | Complex multi-room forms |
| **Capture-Before-Render** | ✅ Explicit control, clear intent | ⚠️ Manual bookkeeping required | Dynamic UI updates |
| **localStorage** | ✅ Survives page reload | ❌ User clears storage or private mode | Draft preservation |

---

## Key Principles from the Codebase

### 1. **Consistent Naming for IDs**
```javascript
// ✅ GOOD: Predictable pattern
`editAdultFirstName${index + 1}`  // editAdultFirstName1, editAdultFirstName2, ...
`editAdultLastName${index + 1}`   // editAdultLastName1, editAdultLastName2, ...

// ❌ BAD: Non-deterministic
`guestName_${Math.random()}`
`input_${Date.now()}`
```

### 2. **Separate Generation from Population**
```javascript
// ✅ GOOD: Two clear phases
generateGuestNamesInputs(5, 2, 0);  // Create structure
populateGuestNames();                // Fill values

// ❌ BAD: Mixing concerns
function renderForm(guestNames) {
  html = '';
  guestNames.forEach(guest => {
    html += `<input value="${guest.firstName}" />`; // Inline value
  });
}
```

### 3. **Data Attributes for Metadata**
```javascript
// ✅ GOOD: Use data attributes for grouping
<input data-guest-type="adult" data-guest-index="0" />

// Allows easy collection
const guestType = input.dataset.guestType;
const guestIndex = input.dataset.guestIndex;

// ❌ BAD: Parse from ID
const match = input.id.match(/adult_(\d+)/);
const index = parseInt(match[1]);
```

### 4. **Cache Structure Before Rendering**
```javascript
// ✅ GOOD: Store data structure in component
this.editSelectedRooms = new Map();
this.editSelectedRooms.set('12', { adults: 2, children: 1 });

// Even if DOM is recreated, Map structure survives
// Populate method can use this structure

// ❌ BAD: Store only in DOM
const adults = document.getElementById('roomAdults').value;
// If element is recreated, value is lost
```

---

## Real-World Scenario: Guest Name Input Updates

### Problem
When a user changes guest counts (3 adults → 2 adults), the UI re-renders with new input fields. The previously entered names should be preserved for remaining guests.

### Solution Using These Patterns

```javascript
class BookingForm {
  constructor() {
    this.currentGuestNames = []; // ← Pattern 3: Component state
  }

  onGuestCountChange(newCount) {
    // Pattern 4: Capture before re-render
    this.currentGuestNames = this.collectGuestNames();

    // Pattern 1: Generate + Populate
    this.generateGuestNamesInputs(newCount);

    // Populate from captured state
    this.currentGuestNames.forEach((guest, index) => {
      if (index < newCount) { // Only populate fields that still exist
        document.getElementById(`guestFirstName${index}`).value = guest.firstName;
        document.getElementById(`guestLastName${index}`).value = guest.lastName;
      }
    });
  }

  collectGuestNames() {
    // Pattern 2: ID-Based Recovery using consistent naming
    const names = [];
    for (let i = 0; i < 10; i++) {
      const firstName = document.getElementById(`guestFirstName${i}`)?.value || '';
      const lastName = document.getElementById(`guestLastName${i}`)?.value || '';

      if (firstName && lastName) {
        names.push({ firstName, lastName });
      }
    }
    return names;
  }

  generateGuestNamesInputs(count) {
    const container = document.getElementById('guestNamesSection');
    let html = '';

    for (let i = 0; i < count; i++) {
      html += `
        <div class="guest-row">
          <input
            id="guestFirstName${i}"
            data-guest-index="${i}"
            data-guest-type="name-first"
            placeholder="First Name"
          />
          <input
            id="guestLastName${i}"
            data-guest-index="${i}"
            data-guest-type="name-last"
            placeholder="Last Name"
          />
        </div>
      `;
    }

    container.innerHTML = html;
  }
}
```

---

## Reusable Utilities from Codebase

### 1. **Guest Name Collection Utility** (from single-room-booking.js)

```javascript
collectGuestNamesByType(personType) {
  const guestMap = new Map();

  const inputs = document.querySelectorAll(
    `input[data-guest-type="${personType}"][id^="firstName"]`
  );

  inputs.forEach((input, index) => {
    const key = `${personType}-${index}`;
    if (!guestMap.has(key)) {
      guestMap.set(key, { personType });
    }

    const guest = guestMap.get(key);
    guest.firstName = input.value.trim();
  });

  return Array.from(guestMap.values());
}
```

### 2. **Debounced Form Save** (from data.js pattern)

```javascript
saveFormState(formData) {
  // Cache with timestamp to detect if data changed
  this.lastFormState = formData;
  this.lastFormStateTime = Date.now();

  // Store to sessionStorage for recovery
  sessionStorage.setItem('draftFormData', JSON.stringify(formData));
}

recoverFormState() {
  const cached = sessionStorage.getItem('draftFormData');
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}
```

---

## File References

| File | Pattern Used | Key Function |
|------|--------------|--------------|
| `/js/shared/EditBookingComponent.js` | Generate + Populate | `populateGuestNames()` (line 469), `generateGuestNamesInputs()` (line 257) |
| `/js/single-room-booking.js` | ID-Based + Map | `collectGuestNames()` (line 831) |
| `/js/booking-form.js` | Generate + Populate + Validate | `collectGuestNames()` (line 1238), `assignRoomIds()` (line 1328) |
| `/js/data.js` | Component State + localStorage | `syncWithServer()` (line 115), state caching throughout |
| `/js/shared/BaseCalendar.js` | Event Cleanup + Caching | `cellElements` Map, `removeEventListeners()` |

---

## Best Practices Derived

1. **Always use stable, predictable IDs** for form inputs
   - Format: `{prefix}{guestType}{index}` (e.g., `editAdultFirstName1`)

2. **Separate DOM generation from value population**
   - This allows re-rendering without losing data

3. **Store critical data in component state, not DOM**
   - DOM is temporary; component properties are permanent

4. **Use data attributes** to tag elements for collection
   - `data-guest-type`, `data-guest-index`, `data-room-id`

5. **Implement explicit capture before re-render**
   - Call `captureFormState()` before `renderForm()`
   - Call `restoreFormState()` after `renderForm()`

6. **Validate guest names after population**
   - Ensure counts match expectations
   - Highlight missing fields

7. **Use Maps for structured data organization**
   - Easier to track relationships (guest-index pairs)
   - Simpler to iterate and transform

---

## Adaptation for Guest Name Preservation

To implement form state preservation in any booking component:

1. **Add to constructor**:
   ```javascript
   this.savedGuestNames = null;
   this.guestNameInputCache = new Map();
   ```

2. **Before re-render**:
   ```javascript
   // Capture current state
   this.savedGuestNames = this.collectGuestNames();
   ```

3. **After re-render**:
   ```javascript
   // Generate new structure with same IDs
   this.generateGuestNamesInputs(newAdultCount, newChildCount);

   // Populate from saved state
   this.populateGuestNames();
   ```

4. **In populateGuestNames()**:
   ```javascript
   if (this.savedGuestNames) {
     this.savedGuestNames.forEach((guest, index) => {
       const input = document.getElementById(`adult_${index}`);
       if (input) input.value = guest.firstName;
     });
   }
   ```

---

## Conclusion

The Mariánská booking system uses a **robust "Generate + Populate" pattern** for form state preservation. This pattern:

- ✅ Survives DOM re-renders
- ✅ Works with complex forms (multi-room, multi-guest types)
- ✅ Is easy to debug (stable IDs and predictable structure)
- ✅ Integrates with validation (can check counts match)
- ✅ Scales to dynamic guest counts

By following these patterns and examples from the codebase, any form requiring state preservation can be reliably implemented.

