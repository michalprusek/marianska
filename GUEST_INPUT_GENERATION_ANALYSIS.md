# Guest Input Generation Logic - Comprehensive Analysis

**Date**: 2025-11-04
**Focus**: Single Room Booking Guest Name Input Generation
**Files Analyzed**:
- `/js/single-room-booking.js` (lines 499-916)
- `/js/booking-app.js` (lines 496-560, 380-401)
- `/index.html` (Guest count controls)

---

## Executive Summary

The guest input generation system creates dynamic input fields for guest names based on guest counts (adults, children, toddlers). The current implementation **DESTROYS and RECREATES all inputs when guest counts change**, resulting in **loss of previously entered data**.

**Critical Issue**: When a user increments/decrements guest counts, all existing input field values are lost because `innerHTML = ''` clears the containers.

---

## 1. FUNCTION DEFINITIONS & LINE NUMBERS

### Core Functions

| Function | File | Line | Purpose |
|----------|------|------|---------|
| `generateGuestNamesInputs()` | single-room-booking.js | 499 | Creates dynamic name input fields for all guest types |
| `adjustGuests()` | booking-app.js | 496 | Increments/decrements guest counts and triggers regeneration |
| `collectGuestNames()` | single-room-booking.js | 831 | Collects and validates all guest names from inputs |
| Event listener setup | booking-app.js | 391-401 | Registers click handlers on +/- buttons |

---

## 2. CURRENT DATA FLOW DIAGRAM

```
USER INTERACTION:
│
├─ User clicks "+" or "-" button on guest count
│  (HTML: onclick="window.app.adjustGuests('adults', 1)")
│
└─ booking-app.js:396-399 (Event listeners)
   │
   ├─ Listener: addEventListener('click', () => this.adjustGuests(type, -1 or 1))
   │
   └─ ajustGuests(type, change) [Line 496]
      │
      ├─ Gets current guests from roomGuests Map
      ├─ Calculates newValue = guests[type] + change
      ├─ Validates room capacity
      ├─ Updates guests[type] = newValue
      ├─ Stores in roomGuests Map: this.roomGuests.set(roomId, guests)
      ├─ Updates DOM display (textContent of singleRoomAdults/Children/Toddlers)
      ├─ Calls await updatePriceCalculation()
      │
      └─ REGENERATES INPUTS [Line 555-559]
         │
         └─ this.singleRoomBooking.generateGuestNamesInputs(
              guests.adults,
              guests.children,
              guests.toddlers
            )
            │
            └─ generateGuestNamesInputs() [single-room-booking.js:499]
               │
               ├─ Gets containers by ID:
               │  ├─ singleRoomAdultsNamesContainer
               │  ├─ singleRoomChildrenNamesContainer
               │  └─ singleRoomToddlersNamesContainer
               │
               ├─ CLEARS EXISTING DATA [Line 516, 618, 720]
               │  └─ container.innerHTML = ''  ← DESTROYS INPUTS!
               │
               ├─ Creates new elements for each guest:
               │  ├─ 1 row per guest (div)
               │  ├─ 2 inputs per guest (firstName + lastName)
               │  ├─ 1 toggle switch per guest (ÚTIA/External type)
               │  ├─ 1 text label per guest (type indicator)
               │  └─ 1 "free" label for toddlers
               │
               ├─ Registers event listeners on toggles [Line 581, 683, 785]
               │  └─ toggleInput.addEventListener('change', function() { ... })
               │
               └─ Appends all rows to containers
```

---

## 3. HOW INPUT FIELDS ARE CREATED

### Structure: Adults Section (Lines 514-613)

```javascript
// 1. Get container by ID
const adultsContainer = document.getElementById('singleRoomAdultsNamesContainer');

// 2. CLEAR EXISTING DATA (PROBLEM!)
adultsContainer.innerHTML = '';

// 3. Show section if adults > 0
if (adults > 0) {
  adultsContainer.style.display = 'block';

  // 4. Create header
  const adultsHeader = document.createElement('h5');
  adultsHeader.textContent = `Dospělí (${adults})`;
  adultsContainer.appendChild(adultsHeader);

  // 5. Loop for each adult
  for (let i = 1; i <= adults; i++) {
    // 6. Create row container
    const row = document.createElement('div');
    row.style.cssText = '...styles...';

    // 7. Create firstName input
    const firstNameInput = document.createElement('input');
    firstNameInput.type = 'text';
    firstNameInput.id = 'singleRoomAdultFirstName' + i;
    firstNameInput.placeholder = langManager.t('firstNamePlaceholder');
    firstNameInput.setAttribute('data-guest-type', 'adult');
    firstNameInput.setAttribute('data-guest-index', i);
    firstNameInput.required = true;
    firstNameInput.minLength = 2;
    firstNameInput.maxLength = 50;
    row.appendChild(firstNameInput);

    // 8. Create lastName input
    const lastNameInput = document.createElement('input');
    lastNameInput.type = 'text';
    lastNameInput.id = 'singleRoomAdultLastName' + i;
    lastNameInput.setAttribute('data-guest-type', 'adult');
    lastNameInput.setAttribute('data-guest-index', i);
    row.appendChild(lastNameInput);

    // 9. Create toggle switch (see next section)
    const toggleContainer = createToggleSwitch();
    row.appendChild(toggleContainer);

    // 10. Append to container
    adultsContainer.appendChild(row);
  }
} else {
  adultsContainer.style.display = 'none';
}
```

**Children & Toddlers**: Same pattern as adults (lines 616-823)

---

## 4. TOGGLE SWITCH INITIALIZATION

### Structure: Toggle Switch Creation (Lines 552-603 for adults)

```javascript
// 1. Create container for toggle + label
const toggleContainer = document.createElement('div');
toggleContainer.style.cssText = 'display: flex; align-items: center; gap: 0.25rem; ...';

// 2. Create label (visual wrapper)
const toggleLabel = document.createElement('label');
toggleLabel.style.cssText = 'position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer;';

// 3. Create hidden checkbox (actual input)
const toggleInput = document.createElement('input');
toggleInput.type = 'checkbox';
toggleInput.id = `adult${i}GuestTypeToggle`;
toggleInput.setAttribute('data-guest-type', 'adult');
toggleInput.setAttribute('data-guest-index', i);
toggleInput.setAttribute('data-guest-price-type', 'true');  // Marker for collection
toggleInput.checked = false;  // FALSE = ÚTIA (default), TRUE = External
toggleInput.style.cssText = 'opacity: 0; width: 0; height: 0;';  // Hidden

// 4. Create visual slider
const toggleSlider = document.createElement('span');
toggleSlider.style.cssText = `
  position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
  background-color: #059669; transition: 0.3s; border-radius: 24px;
`;

// 5. Create thumb (moving circle)
const toggleThumb = document.createElement('span');
toggleThumb.style.cssText = `
  position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px;
  background-color: white; transition: 0.3s; border-radius: 50%;
`;
toggleSlider.appendChild(toggleThumb);

// 6. ATTACH EVENT LISTENER (Line 581)
toggleInput.addEventListener('change', function() {
  if (this.checked) {
    // External selected
    toggleSlider.style.backgroundColor = '#dc2626';  // Red
    toggleThumb.style.transform = 'translateX(20px)';
    toggleText.textContent = 'EXT';
    toggleText.style.color = '#dc2626';
  } else {
    // ÚTIA selected
    toggleSlider.style.backgroundColor = '#059669';  // Green
    toggleThumb.style.transform = 'translateX(0)';
    toggleText.textContent = 'ÚTIA';
    toggleText.style.color = '#059669';
  }
});

// 7. Add text label
const toggleText = document.createElement('span');
toggleText.textContent = 'ÚTIA';  // Default state
toggleText.style.cssText = 'font-size: 0.75rem; font-weight: 600; color: #059669; min-width: 32px;';

// 8. Assemble hierarchy
toggleLabel.appendChild(toggleInput);
toggleLabel.appendChild(toggleSlider);
toggleContainer.appendChild(toggleLabel);
toggleContainer.appendChild(toggleText);

row.appendChild(toggleContainer);
```

---

## 5. WHAT HAPPENS WHEN REGENERATING (DATA LOSS)

### The Problem: Lines 516, 618, 720

```javascript
// DESTROYS ALL EXISTING DATA
adultsContainer.innerHTML = '';      // Line 516
childrenContainer.innerHTML = '';    // Line 618
toddlersContainer.innerHTML = '';    // Line 720
```

### Scenario: User enters data, then changes guest count

```
Step 1: User opens modal (1 adult default)
├─ generateGuestNamesInputs(1, 0, 0) called
├─ Creates 1 firstName input + 1 lastName input + 1 toggle
└─ Containers: <div><input id="singleRoomAdultFirstName1"/><input id="singleRoomAdultLastName1"/><toggle/></div>

Step 2: User enters "Jan Novák" and toggles to External
├─ firstName input: value = "Jan"
├─ lastName input: value = "Novák"
├─ toggle: checked = true (External)
└─ All data in DOM

Step 3: User clicks "+" to add second adult
├─ adjustGuests('adults', 1) called
├─ guests.adults = 2
├─ generateGuestNamesInputs(2, 0, 0) called
│  ├─ adultsContainer.innerHTML = ''  ← PROBLEM: ALL DATA DESTROYED!
│  ├─ Creates 2 new empty inputs
│  └─ First adult's "Jan Novák" + toggle state: LOST
└─ User must re-enter data for first adult!
```

---

## 6. EVENT LISTENERS FOR GUEST COUNT CHANGES

### Registration Point: booking-app.js lines 391-401

```javascript
// Setup event listeners for +/- buttons
['adults', 'children', 'toddlers'].forEach((type) => {
  const decreaseBtn = document.querySelector(`[data-action="decrease-${type}"]`);
  const increaseBtn = document.querySelector(`[data-action="increase-${type}"]`);

  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', () => this.adjustGuests(type, -1));
  }
  if (increaseBtn) {
    increaseBtn.addEventListener('click', () => this.adjustGuests(type, 1));
  }
});
```

### Button HTML Elements (index.html)

```html
<!-- Adults section -->
<button class="counter-btn" data-action="decrease-adults" style="...">-</button>
<span id="singleRoomAdults" class="counter-value">1</span>
<button class="counter-btn" onclick="window.app.adjustGuests('adults', 1)" style="...">+</button>

<!-- Children section -->
<button class="counter-btn" data-action="decrease-children" style="...">-</button>
<span id="singleRoomChildren" class="counter-value">0</span>
<button class="counter-btn" onclick="window.app.adjustGuests('children', 1)" style="...">+</button>

<!-- Toddlers section -->
<button class="counter-btn" data-action="decrease-toddlers" style="...">-</button>
<span id="singleRoomToddlers" class="counter-value">0</span>
<button class="counter-btn" onclick="window.app.adjustGuests('toddlers', 1)" style="...">+</button>
```

### Call Chain on Button Click

```
User clicks "+" button (adults)
│
└─ HTML: onclick="window.app.adjustGuests('adults', 1)"
   OR
   Event listener (from line 399): addEventListener('click', () => this.adjustGuests(type, 1))
   │
   └─ adjustGuests('adults', 1) [booking-app.js:496]
      │
      ├─ if (!this.currentBookingRoom) return;  [Line 497]
      │
      ├─ Get guests: const guests = this.roomGuests.get(this.currentBookingRoom)  [Line 501]
      │
      ├─ Calculate new: const newValue = guests['adults'] + 1  [Line 509]
      │
      ├─ Validate capacity: if (newTotal > room.beds) { notify warning; return; }  [Line 524]
      │
      ├─ Update state: guests['adults'] = newValue; this.roomGuests.set(roomId, guests)  [Line 536-537]
      │
      ├─ Update display: singleRoomEl.textContent = newValue.toString()  [Line 546]
      │
      ├─ Recalculate price: await this.updatePriceCalculation()  [Line 552]
      │
      └─ REGENERATE INPUTS: this.singleRoomBooking.generateGuestNamesInputs(...)  [Line 555]
         └─ LOSES ALL ENTERED DATA!
```

---

## 7. EXISTING STATE PRESERVATION MECHANISMS

### Current State Storage: roomGuests Map

**File**: booking-app.js (lines 501-507)

```javascript
// Get guest configuration from Map
const guests = this.roomGuests.get(this.currentBookingRoom) || {
  adults: 1,
  children: 0,
  toddlers: 0,
  guestType: 'utia',  // NEW 2025-11-04: Per-room guest type
};

// Update Map after changing count
guests[type] = newValue;
this.roomGuests.set(this.currentBookingRoom, guests);
```

**What's Preserved**: Only guest **counts** (adults/children/toddlers), NOT guest **names** or **toggle states**

**What's Lost**:
- Guest first names
- Guest last names
- Guest type toggle state (ÚTIA vs External) for each guest
- All form validation state

### No Input Field State Preservation

**Current Implementation**: ZERO mechanisms to preserve input field values before `innerHTML = ''`

Example of what's lost:
```javascript
// These values exist in DOM but are NEVER extracted/stored:
document.getElementById('singleRoomAdultFirstName1').value  // "Jan" → LOST
document.getElementById('singleRoomAdultLastName1').value   // "Novák" → LOST
document.getElementById('adult1GuestTypeToggle').checked     // true (External) → LOST
```

---

## 8. GUEST NAME COLLECTION FLOW

### collectGuestNames() Function (Lines 831-916)

This function runs **AFTER** generateGuestNamesInputs() has recreated the fields, so it only collects what's currently in the DOM (new empty inputs if guest count changed).

```javascript
collectGuestNames() {
  const guestNames = [];
  const section = document.getElementById('singleRoomGuestNamesSection');

  if (!section || section.style.display === 'none') {
    return [];  // No names section visible
  }

  // 1. Query all name input fields (NOT toggle switches)
  const inputs = section.querySelectorAll('input[data-guest-type]:not([data-guest-price-type])');
  //              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //              Selector explanation:
  //              - [data-guest-type]:      Has attribute data-guest-type
  //              - :not([data-guest-price-type]):  NOT toggle switches

  // 2. Group inputs by guest type and index (map each guest)
  const guestMap = new Map();

  inputs.forEach((input) => {
    const guestType = input.dataset.guestType;   // 'adult', 'child', 'toddler'
    const guestIndex = input.dataset.guestIndex; // 1, 2, 3, etc.
    const key = `${guestType}-${guestIndex}`;    // 'adult-1', 'adult-2', etc.

    if (!guestMap.has(key)) {
      guestMap.set(key, { personType: guestType });
    }

    const guest = guestMap.get(key);
    const value = input.value.trim();

    // 3. VALIDATION: All fields required
    if (!value || value.length < 2) {
      input.style.borderColor = '#ef4444';  // Red border
      return null;  // Validation failed
    }

    input.style.borderColor = '#d1d5db';  // Reset

    // 4. Parse firstName or lastName from input ID
    if (input.id.includes('FirstName')) {
      guest.firstName = value;
    } else if (input.id.includes('LastName')) {
      guest.lastName = value;
    }
  });

  // 5. Collect guest type (ÚTIA vs External) from toggle switches
  const guestTypeInputs = section.querySelectorAll('input[data-guest-price-type]');
  //                                                      ^^^^^^^^^^^^^^^^^^^^
  //                                                      This selector finds toggles only

  guestTypeInputs.forEach((input) => {
    const guestType = input.dataset.guestType;
    const guestIndex = input.dataset.guestIndex;
    const key = `${guestType}-${guestIndex}`;

    if (guestMap.has(key)) {
      const guest = guestMap.get(key);
      // unchecked = 'utia', checked = 'external'
      guest.guestPriceType = input.checked ? 'external' : 'utia';
    }
  });

  // 6. Convert map to array and validate completeness
  for (const [key, guest] of guestMap) {
    if (!guest.firstName || !guest.lastName) {
      // VALIDATION ERROR: Missing name
      this.app.showNotification('Vyplňte všechna jména hostů...', 'error');
      return null;
    }

    if (!guest.guestPriceType) {
      // VALIDATION ERROR: Missing guest type
      this.app.showNotification('Vyberte typ hosta (ÚTIA/Externí)...', 'error');
      return null;
    }

    guestNames.push(guest);
  }

  return guestNames;
  // Returns: [
  //   { personType: 'adult', firstName: 'Jan', lastName: 'Novák', guestPriceType: 'utia' },
  //   { personType: 'adult', firstName: 'Petr', lastName: 'Svoboda', guestPriceType: 'external' },
  //   ...
  // ]
}
```

---

## 9. INPUT FIELD STRUCTURE SUMMARY

### Data Attributes for Tracking

**Name Input Fields** (for collecting)
```html
<input
  type="text"
  id="singleRoomAdultFirstName1"
  data-guest-type="adult"
  data-guest-index="1"
  placeholder="Křestní jméno"
  required
/>
```

**Toggle Input** (for price type)
```html
<input
  type="checkbox"
  id="adult1GuestTypeToggle"
  data-guest-type="adult"
  data-guest-index="1"
  data-guest-price-type="true"  ← Marker to distinguish from name inputs
  checked="false"
  style="opacity: 0; width: 0; height: 0;"
/>
```

**Visual Elements** (generated but not interactive)
```html
<span style="...">ÚTIA</span>  ← Text label showing current state
<span>(zdarma)</span>          ← For toddlers only
```

---

## 10. CRITICAL POINTS FOR PRESERVATION

### Inputs That Need Preservation

1. **Guest Names**
   - Element: `<input id="singleRoom[Adult|Child|Toddler]FirstName${i}">`
   - Data: `element.value`
   - Currently: Lost when `innerHTML = ''`

2. **Guest Type Toggle State**
   - Element: `<input id="[adult|child|toddler]${i}GuestTypeToggle">`
   - Data: `element.checked` (false = ÚTIA, true = External)
   - Currently: Lost when `innerHTML = ''`

3. **Toggle Visual State** (secondary - recalculated from checked state)
   - Element: Toggle slider background color, thumb position, text label
   - Data: Derived from `element.checked`
   - Currently: Lost but can be regenerated

### Where Data Exists Before Deletion

```javascript
// BEFORE innerHTML = ''

// These DOM elements exist and have values:
const firstName1 = document.getElementById('singleRoomAdultFirstName1');
firstName1.value  // "Jan"

const lastName1 = document.getElementById('singleRoomAdultLastName1');
lastName1.value   // "Novák"

const toggle1 = document.getElementById('adult1GuestTypeToggle');
toggle1.checked   // true (External)

// But in the next line:
adultsContainer.innerHTML = '';  // ALL LOST!
```

---

## 11. PROPOSED PRESERVATION MECHANISM

### Option 1: Save Before Clear (Recommended)

```javascript
// In generateGuestNamesInputs() BEFORE innerHTML = ''

// Extract existing values for each guest type
const preservedAdultData = [];
if (adults > 0) {
  for (let i = 1; i <= Math.min(adults, /* max previous adults */); i++) {
    const firstName = document.getElementById(`singleRoomAdultFirstName${i}`)?.value;
    const lastName = document.getElementById(`singleRoomAdultLastName${i}`)?.value;
    const guestTypeToggle = document.getElementById(`adult${i}GuestTypeToggle`);
    const guestType = guestTypeToggle?.checked ? 'external' : 'utia';

    if (firstName || lastName) {
      preservedAdultData.push({
        index: i,
        firstName: firstName || '',
        lastName: lastName || '',
        guestType: guestType
      });
    }
  }
}

// NOW clear
adultsContainer.innerHTML = '';

// Restore when creating new inputs
preservedAdultData.forEach((data) => {
  const firstNameInput = document.getElementById(`singleRoomAdultFirstName${data.index}`);
  const lastNameInput = document.getElementById(`singleRoomAdultLastName${data.index}`);
  const toggleInput = document.getElementById(`adult${data.index}GuestTypeToggle`);

  if (firstNameInput) firstNameInput.value = data.firstName;
  if (lastNameInput) lastNameInput.value = data.lastName;
  if (toggleInput) toggleInput.checked = data.guestType === 'external';
});
```

### Option 2: Use Instance Variables (Alternative)

```javascript
// Store in class instance
class SingleRoomBookingModule {
  constructor(app) {
    this.app = app;
    this.guestNameData = {};  // { 'adult-1': { firstName, lastName, guestType }, ... }
  }

  generateGuestNamesInputs(adults, children, toddlers = 0) {
    // Save existing data from inputs
    const container = document.getElementById('singleRoomAdultsNamesContainer');
    const inputs = container.querySelectorAll('input[data-guest-type]');

    inputs.forEach((input) => {
      const key = `${input.dataset.guestType}-${input.dataset.guestIndex}`;
      if (!this.guestNameData[key]) {
        this.guestNameData[key] = {};
      }

      if (!input.dataset.guestPriceType) {
        // Name input
        if (input.id.includes('FirstName')) {
          this.guestNameData[key].firstName = input.value;
        } else if (input.id.includes('LastName')) {
          this.guestNameData[key].lastName = input.value;
        }
      } else {
        // Toggle input
        this.guestNameData[key].guestType = input.checked ? 'external' : 'utia';
      }
    });

    // NOW regenerate with preserved data
    // ...create new inputs...

    // Restore preserved data
    Object.entries(this.guestNameData).forEach(([key, data]) => {
      const [type, index] = key.split('-');
      // Restore values
    });
  }
}
```

---

## SUMMARY TABLE

| Aspect | Current Status | Details |
|--------|----------------|---------|
| **Function Name** | `generateGuestNamesInputs()` | Line 499, single-room-booking.js |
| **Called From** | `adjustGuests()` | Line 555, booking-app.js |
| **Call Trigger** | +/- button click | Lines 396-399, booking-app.js |
| **Input Creation** | Dynamic via createElement() | Lines 524-823 |
| **Inline Styles** | Heavy CSS styling | Lines 520-753 |
| **Data Attributes** | `data-guest-type`, `data-guest-index`, `data-guest-price-type` | Lines 533-544, etc. |
| **Toggle Switches** | Hidden checkbox + visual slider | Lines 558-603 |
| **Event Listeners** | addEventListener('change', ...) | Lines 581, 683, 785 |
| **Data Preservation** | NONE - innerHTML = '' destroys all | Lines 516, 618, 720 |
| **State Storage** | roomGuests Map (counts only) | Line 537, booking-app.js |
| **Collection Method** | querySelectorAll with data attributes | Lines 840, 876 |
| **Validation** | Required fields, min length 2 | Lines 857-909 |

---

## FILES & KEY SECTIONS

```
/home/marianska/marianska/js/single-room-booking.js
├─ Lines 499-824:  generateGuestNamesInputs() - Field creation
├─ Lines 514-613:  Adults section creation
├─ Lines 616-715:  Children section creation
├─ Lines 718-823:  Toddlers section creation
├─ Lines 831-916:  collectGuestNames() - Data collection & validation
└─ Lines 395-398:  Validation in confirmRoomBooking()

/home/marianska/marianska/js/booking-app.js
├─ Lines 391-401:  Event listener registration for +/- buttons
├─ Lines 496-560:  adjustGuests() function with regeneration call
├─ Lines 540-550:  DOM display update
├─ Lines 554-559:  Call to generateGuestNamesInputs()
└─ Lines 562-589:  setRoomGuestType() for per-room guest types

/home/marianska/marianska/index.html
├─ Guest count controls with data-action attributes
├─ <div id="singleRoomAdultsNamesContainer">
├─ <div id="singleRoomChildrenNamesContainer">
└─ <div id="singleRoomToddlersNamesContainer">
```

---

## CONCLUSIONS

1. **No State Preservation**: Input field values are destroyed every time guest count changes
2. **Map-Based Count Storage**: Only guest counts (not names) persist via roomGuests Map
3. **Dynamic Element Creation**: All fields created via createElement() on each regeneration
4. **Event Listener Registration**: Toggle switches get fresh listeners on each regeneration
5. **Selector-Based Collection**: Uses CSS selectors with data attributes to find and collect fields
6. **Validation Timing**: Validation happens at collection time, not at input time
7. **Single Source for Counts**: roomGuests Map is the only persistent state for guest counts
8. **No Partial Preservation**: When regenerating for count changes, ALL inputs are deleted

**Recommendation**: Implement Option 1 (Save Before Clear) to preserve user-entered guest names and toggle states when they adjust guest counts.
