# Guest Input Generation - Exact Line Number Reference

**Date**: 2025-11-04
**Purpose**: Quick lookup table for all relevant code locations

---

## FILE 1: /home/marianska/marianska/js/single-room-booking.js

### Function Definitions

| Function | Start Line | End Line | Purpose |
|----------|-----------|---------|---------|
| `generateGuestNamesInputs()` | 499 | 824 | Creates dynamic guest name inputs |
| `collectGuestNames()` | 831 | 916 | Collects & validates guest names |
| `showRoomBookingModal()` | 117 | 251 | Modal initialization & guest generation call |
| `confirmRoomBooking()` | 307 | 490 | Confirmation handler |

### Key Code Sections

**generateGuestNamesInputs() Details:**

```
Lines 499-510:     Function signature & total guest count check
Lines 514-515:     Get adults container
Line 516:          ⚠️ CRITICAL: adultsContainer.innerHTML = ''  [DATA LOSS POINT]
Lines 517-613:     Create adult inputs (1 per row)

Lines 616-617:     Get children container
Line 618:          ⚠️ CRITICAL: childrenContainer.innerHTML = ''  [DATA LOSS POINT]
Lines 619-715:     Create children inputs (1 per row)

Lines 718-719:     Get toddlers container
Line 720:          ⚠️ CRITICAL: toddlersContainer.innerHTML = ''  [DATA LOSS POINT]
Lines 721-823:     Create toddler inputs (1 per row)
```

**Adults Section - Input Creation:**

```
Line 514:          const adultsContainer = document.getElementById('singleRoomAdultsNamesContainer');
Line 516:          adultsContainer.innerHTML = '';
Lines 517-522:     Create header "Dospělí (N)"
Line 524:          for (let i = 1; i <= adults; i++)
Line 525:          const row = document.createElement('div');

Lines 529-549:     Create firstName input
  Line 531:        id = 'singleRoomAdultFirstName' + i
  Line 533:        setAttribute('data-guest-type', 'adult')
  Line 534:        setAttribute('data-guest-index', i)

Lines 540-549:     Create lastName input
  Line 542:        id = 'singleRoomAdultLastName' + i
  Line 544:        setAttribute('data-guest-type', 'adult')
  Line 545:        setAttribute('data-guest-index', i)

Lines 551-603:     Create toggle switch
  Line 560:        id = 'adult' + i + 'GuestTypeToggle'
  Line 561:        setAttribute('data-guest-type', 'adult')
  Line 562:        setAttribute('data-guest-index', i)
  Line 563:        setAttribute('data-guest-price-type', 'true')  ← Marker!
  Line 564:        checked = false  (ÚTIA default)
  Lines 581-593:   addEventListener('change', function() { ... })
      Line 582:    if (this.checked)  → External (red)
      Line 588:    else → ÚTIA (green)
```

**Children Section - Input Creation:**

```
Line 616:          const childrenContainer = document.getElementById('singleRoomChildrenNamesContainer');
Line 618:          childrenContainer.innerHTML = '';
Lines 619-715:     Same structure as adults (lines 524-609)
```

**Toddlers Section - Input Creation:**

```
Line 718:          const toddlersContainer = document.getElementById('singleRoomToddlersNamesContainer');
Line 720:          toddlersContainer.innerHTML = '';
Lines 721-823:     Same structure as adults/children, plus free label (line 811)
```

**collectGuestNames() Details:**

```
Lines 831-837:     Get section & early return if empty
Line 840:          const inputs = section.querySelectorAll(
                     'input[data-guest-type]:not([data-guest-price-type])'
                   );
Line 843:          const guestMap = new Map();
Lines 845-873:     Process each name input
  Line 846:        const guestType = input.dataset.guestType;
  Line 847:        const guestIndex = input.dataset.guestIndex;
  Line 848:        const key = `${guestType}-${guestIndex}`;
  Lines 857-862:   Validation: required fields, min length 2
  Lines 868-872:   Extract firstName or lastName

Lines 876-887:     Process toggle switches
Line 876:          const guestTypeInputs = section.querySelectorAll(
                     'input[data-guest-price-type]'
                   );
  Line 878:        const guestType = input.dataset.guestType;
  Line 879:        const guestIndex = input.dataset.guestIndex;
  Line 885:        guest.guestPriceType = input.checked ? 'external' : 'utia';

Lines 890-913:     Validate completeness & return
  Lines 891-898:   Check firstName && lastName exist
  Lines 902-910:   Check guestPriceType exists
  Line 912:        guestNames.push(guest)
  Line 915:        return guestNames
```

**Modal Initialization & First Generation:**

```
Lines 117-251:     showRoomBookingModal() function
Line 121:          const rooms = await dataManager.getRooms();
Line 122:          const room = rooms.find((r) => r.id === roomId);
Line 167:          defaultGuests = { adults: 1, children: 0, toddlers: 0 };
Line 178:          defaultGuests.guestType = 'utia';
Line 179:          this.app.roomGuests.set(roomId, defaultGuests);
Lines 182-194:     Update display (singleRoomAdults, Children, Toddlers textContent)
Lines 245-250:     Generate initial guest inputs
  Line 246:        this.generateGuestNamesInputs(
  Lines 247-249:   adults, children, toddlers
  Line 250:        );
```

**Confirmation & Collection:**

```
Lines 307-490:     confirmRoomBooking() function
Lines 395-400:     Validate guest names collected
  Line 396:        const guestNames = this.collectGuestNames();
  Line 397:        if (guestNames === null) return;
Lines 413-423:     Validate count matches total guests
  Line 414:        const expectedGuestCount = (guests.adults || 0) + (guests.children || 0) + (guests.toddlers || 0);
  Line 415:        if (guestNames.length !== expectedGuestCount) { error }
```

---

## FILE 2: /home/marianska/marianska/js/booking-app.js

### Function Definitions

| Function | Start Line | End Line | Purpose |
|----------|-----------|---------|---------|
| `adjustGuests()` | 496 | 560 | Adjust guest count & regenerate inputs |
| `setRoomGuestType()` | 563 | 589 | Set per-room guest type |
| Event setup | 391 | 401 | Register button event listeners |

### Key Code Sections

**adjustGuests() - The Trigger Function:**

```
Lines 496-560:     Full function
Line 497:          if (!this.currentBookingRoom) return;

Lines 501-507:     Get current state from Map
  Line 501:        const guests = this.roomGuests.get(this.currentBookingRoom) || { ... }
  Line 502:        defaults: adults: 1, children: 0, toddlers: 0

Line 509:          const newValue = guests[type] + change;

Line 513:          if (newValue < 0) return;

Lines 518-533:     Room capacity validation
  Line 518:        const rooms = await dataManager.getRooms();
  Line 519:        const room = rooms.find((r) => r.id === this.currentBookingRoom);
  Line 520:        if (room && type !== 'toddlers')
  Line 521:        const currentOthers = type === 'adults' ? guests.children : guests.adults;
  Line 522:        const newTotal = newValue + currentOthers;
  Line 524:        if (newTotal > room.beds) { warning; return; }

Lines 536-537:     Update persistent state
  Line 536:        guests[type] = newValue;
  Line 537:        this.roomGuests.set(this.currentBookingRoom, guests);

Lines 540-550:     Update DOM display
  Line 540:        const singleRoomEl = document.getElementById(
  Line 541:        `singleRoom${type.charAt(0).toUpperCase() + type.slice(1)}`
  Line 542:        );
  Line 546:        if (singleRoomEl) singleRoomEl.textContent = guests[type].toString();

Line 552:          await this.updatePriceCalculation();

Lines 555-559:     🔴 REGENERATE INPUTS (TRIGGERS DATA LOSS)
  Line 555:        this.singleRoomBooking.generateGuestNamesInputs(
  Line 556:        guests.adults,
  Line 557:        guests.children,
  Line 558:        guests.toddlers
  Line 559:        );
```

**Event Listener Registration:**

```
Lines 391-401:     Guest count button event setup
Line 391:          ['adults', 'children', 'toddlers'].forEach((type) => {
Line 392:          const decreaseBtn = document.querySelector(
                     `[data-action="decrease-${type}"]`
                   );
Line 393:          const increaseBtn = document.querySelector(
                     `[data-action="increase-${type}"]`
                   );
Line 396:          decreaseBtn.addEventListener('click', () => this.adjustGuests(type, -1));
Line 399:          increaseBtn.addEventListener('click', () => this.adjustGuests(type, 1));
```

**setRoomGuestType() - Per-Room Type:**

```
Lines 563-589:     Function
Lines 568-574:     Get current guests data
Lines 576-578:     Update guest type
Line 577:          guests.guestType = guestType;
Line 578:          this.roomGuests.set(this.currentBookingRoom, guests);
Line 581:          await this.updatePriceCalculation();
```

---

## FILE 3: /home/marianska/marianska/index.html

### Guest Count Controls

```
Location: Single Room Modal section

Guest Count Display & Controls:
  <span id="singleRoomAdults" class="counter-value">1</span>
  <button onclick="window.app.adjustGuests('adults', 1)">+</button>
  <button data-action="decrease-adults">-</button>

  <span id="singleRoomChildren" class="counter-value">0</span>
  <button onclick="window.app.adjustGuests('children', 1)">+</button>
  <button data-action="decrease-children">-</button>

  <span id="singleRoomToddlers" class="counter-value">0</span>
  <button onclick="window.app.adjustGuests('toddlers', 1)">+</button>
  <button data-action="decrease-toddlers">-</button>

Guest Names Input Containers:
  <div id="singleRoomGuestNamesSection">
    <div id="singleRoomAdultsNamesContainer"></div>
    <div id="singleRoomChildrenNamesContainer"></div>
    <div id="singleRoomToddlersNamesContainer"></div>
  </div>

Per-Room Guest Type Dropdown:
  <select id="singleRoomPerRoomGuestType">
    <option value="utia">ÚTIA zaměstnanec</option>
    <option value="external">Externí host</option>
  </select>
```

---

## CRITICAL POINTS - DATA LOSS LOCATIONS

```
File: /home/marianska/marianska/js/single-room-booking.js

Line 516:   adultsContainer.innerHTML = '';      🔴 DESTROYS ADULT INPUT DATA
Line 618:   childrenContainer.innerHTML = '';    🔴 DESTROYS CHILDREN INPUT DATA
Line 720:   toddlersContainer.innerHTML = '';    🔴 DESTROYS TODDLER INPUT DATA

These lines are called from:
  /js/booking-app.js:555 → this.singleRoomBooking.generateGuestNamesInputs(...)
```

---

## EVENT LISTENER REGISTRATION POINTS

```
1. Button Click Listeners
   File: /js/booking-app.js:391-401
   Type: addEventListener('click')
   Handler: this.adjustGuests(type, change)

2. Toggle Switch Change Listeners
   File: /js/single-room-booking.js:581, 683, 785
   Type: addEventListener('change')
   Handler: Updates visual state (colors, position, text)

3. HTML Inline Handlers
   File: /index.html
   Type: onclick="window.app.adjustGuests(...)"
   Handler: Direct call to adjustGuests()
```

---

## INPUT FIELD ID PATTERNS

### Adults
```
Name inputs:
  singleRoomAdultFirstName1, singleRoomAdultFirstName2, singleRoomAdultFirstName3, ...
  singleRoomAdultLastName1, singleRoomAdultLastName2, singleRoomAdultLastName3, ...

Toggle switches:
  adult1GuestTypeToggle, adult2GuestTypeToggle, adult3GuestTypeToggle, ...
```

### Children
```
Name inputs:
  singleRoomChildFirstName1, singleRoomChildFirstName2, ...
  singleRoomChildLastName1, singleRoomChildLastName2, ...

Toggle switches:
  child1GuestTypeToggle, child2GuestTypeToggle, ...
```

### Toddlers
```
Name inputs:
  singleRoomToddlerFirstName1, singleRoomToddlerFirstName2, ...
  singleRoomToddlerLastName1, singleRoomToddlerLastName2, ...

Toggle switches:
  toddler1GuestTypeToggle, toddler2GuestTypeToggle, ...
```

---

## DATA ATTRIBUTE REFERENCE

### Name Input Fields
```
<input
  id="singleRoomAdultFirstName1"
  data-guest-type="adult"          (value: 'adult', 'child', 'toddler')
  data-guest-index="1"             (value: 1, 2, 3, ... up to count)
/>

Used for:
  - Identifying guest type
  - Grouping by guest
  - collectGuestNames() selection: 'input[data-guest-type]:not([data-guest-price-type])'
```

### Toggle Input Fields
```
<input
  id="adult1GuestTypeToggle"
  type="checkbox"
  data-guest-type="adult"          (value: 'adult', 'child', 'toddler')
  data-guest-index="1"             (value: 1, 2, 3, ...)
  data-guest-price-type="true"     (MARKER - distinguishes from name inputs)
/>

Used for:
  - Identifying price type
  - Grouping by guest
  - collectGuestNames() selection: 'input[data-guest-price-type]'
```

---

## SELECTOR QUICK REFERENCE

### Find Specific Input by Guest
```
Adult 1 firstName:
  document.getElementById('singleRoomAdultFirstName1')
  OR
  document.querySelector('input[data-guest-type="adult"][data-guest-index="1"]:not([data-guest-price-type])')

Adult 1 toggle:
  document.getElementById('adult1GuestTypeToggle')
  OR
  document.querySelector('input[data-guest-type="adult"][data-guest-index="1"][data-guest-price-type]')
```

### Find All Inputs of Type
```
All name inputs (not toggles):
  section.querySelectorAll('input[data-guest-type]:not([data-guest-price-type])')

All toggle switches:
  section.querySelectorAll('input[data-guest-price-type]')

All adult inputs:
  section.querySelectorAll('input[data-guest-type="adult"]')

All adult name inputs:
  section.querySelectorAll('input[data-guest-type="adult"]:not([data-guest-price-type])')

All buttons with decrease:
  document.querySelector('[data-action="decrease-adults"]')
  document.querySelector('[data-action="decrease-children"]')
  document.querySelector('[data-action="decrease-toddlers"]')
```

---

## ROOMGUESTS MAP STRUCTURE

```
File: /js/booking-app.js

Location: this.app.roomGuests (Map object)
Type: Map<roomId, guestData>

Structure:
  roomGuests.get('room12') returns:
  {
    adults: 1,           (number)
    children: 0,         (number)
    toddlers: 0,         (number)
    guestType: 'utia'    (string: 'utia' or 'external') - NEW 2025-11-04
  }

Set operations:
  this.roomGuests.set(roomId, guests)

Get operations:
  const guests = this.roomGuests.get(roomId)

Update operations:
  guests.adults = 2
  guests.guestType = 'external'
  this.roomGuests.set(roomId, guests)

Initialization:
  Line 179 in single-room-booking.js: this.app.roomGuests.set(roomId, defaultGuests)
  Line 501 in booking-app.js: const guests = this.roomGuests.get(...) || { adults: 1, ... }
```

---

## QUICK NAVIGATION

**To find where guest inputs are CREATED:**
  → /js/single-room-booking.js:499 (generateGuestNamesInputs)

**To find where guest inputs are DESTROYED:**
  → /js/single-room-booking.js:516, 618, 720 (innerHTML = '')

**To find what TRIGGERS the destruction:**
  → /js/booking-app.js:555 (generateGuestNamesInputs call from adjustGuests)

**To find what TRIGGERS adjustGuests:**
  → /js/booking-app.js:391-401 (event listener registration)

**To find how guest names are COLLECTED:**
  → /js/single-room-booking.js:831 (collectGuestNames)

**To find what QUERIES the inputs:**
  → /js/single-room-booking.js:840, 876 (querySelectorAll with data attributes)

**To find where toggle events are REGISTERED:**
  → /js/single-room-booking.js:581, 683, 785 (addEventListener on each toggle)

**To find persistent state storage:**
  → /js/booking-app.js:501-507, 536-537 (roomGuests Map get/set)

**To find where HTML inputs are defined:**
  → /index.html (Guest count controls & container divs)
