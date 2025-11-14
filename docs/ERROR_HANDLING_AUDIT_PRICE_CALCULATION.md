# Error Handling Audit - Price Calculation Fix (Commit ee9fc30)

**Date:** 2025-11-14
**Audited by:** Error Handling Analysis Agent
**Severity Classification:** CRITICAL (P0), HIGH (P1), MEDIUM (P2), LOW (P3)

---

## Executive Summary

This audit examines error handling in the price calculation fix introduced in commit ee9fc30. The implementation introduces **7 critical silent failure points** and **3 high-severity error handling gaps** that could lead to hard-to-debug issues in production.

**Key Findings:**
- ❌ **CRITICAL:** Silent failures in parallel price calculation (`Promise.all`)
- ❌ **CRITICAL:** Missing null checks for `settings.rooms.find()`
- ❌ **CRITICAL:** No error handling for malformed `perRoomDates` structure
- ❌ **HIGH:** Missing error logging in async operations
- ❌ **HIGH:** Fallback to incorrect prices without user notification

---

## Critical Issues (P0)

### Issue 1: Silent Failures in Parallel Price Calculation

**Location:** `admin.js:592-597`

**Code:**
```javascript
const pricePromises = bookings.map(async (booking) => ({
  id: booking.id,
  price: await this.calculateActualPrice(booking)
}));
const priceResults = await Promise.all(pricePromises);
priceResults.forEach(({ id, price }) => bookingPrices.set(id, price));
```

**Problem:**
If ANY `calculateActualPrice()` call throws an error, `Promise.all()` rejects entirely, causing:
1. **Complete failure** of `loadBookings()` - admin panel shows nothing
2. **No error message** shown to user
3. **No indication** which booking caused the failure
4. **Lost data** - bookings that calculated successfully are discarded

**Hidden Errors:**
- Network failure fetching settings
- Malformed `perRoomDates` structure
- Missing `settings.prices` keys
- Invalid date strings causing `NaN` in calculations
- Database corruption in booking records

**User Impact:**
Admin opens panel → sees empty booking list → no error message → thinks database is empty → confusion/panic.

**Recommendation:**
```javascript
// Replace Promise.all() with Promise.allSettled() to handle individual failures
const priceResults = await Promise.allSettled(pricePromises);

priceResults.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    const { id, price } = result.value;
    bookingPrices.set(id, price);
  } else {
    // Log error with booking ID for debugging
    const booking = bookings[index];
    console.error(`[PRICE_CALC] Failed to calculate price for booking ${booking.id}:`, result.reason);

    // Use fallback: stored totalPrice
    bookingPrices.set(booking.id, booking.totalPrice || 0);

    // Optionally show warning to admin
    this.showWarning(`Cena pro rezervaci ${booking.id} nemohla být přepočítána. Použita původní cena.`);
  }
});
```

---

### Issue 2: Missing Null Check for `settings.rooms.find()`

**Location:** `admin.js:742-743`

**Code:**
```javascript
const room = settings.rooms.find(r => r.id === roomId);
const isLargeRoom = room && room.capacity >= 4;
```

**Problem:**
If `roomId` from `perRoomDates` doesn't exist in `settings.rooms`:
1. `room` is `undefined`
2. `isLargeRoom` becomes `false` (incorrect - assumes small room)
3. **Wrong price calculation** - uses small room pricing for non-existent room
4. **Silent failure** - no error, just wrong price displayed

**Hidden Errors:**
- Room deleted from settings but still in old bookings
- Database corruption (invalid `room_id` foreign key)
- Admin edited room IDs in settings
- Migration bugs

**Debugging Nightmare Scenario:**
```
Admin: "Why is booking BK123 showing 300 CZK when it should be 500 CZK?"
Dev: *checks database* "Room ID is '14' (large room), price should be correct"
Dev: *checks code* "Calculation looks correct..."
Dev: *2 hours later* "Oh, room '14' was renamed to '24' in settings!"
```

**Recommendation:**
```javascript
const room = settings.rooms.find(r => r.id === roomId);

if (!room) {
  // CRITICAL: Room not found in settings
  console.error(
    `[PRICE_CALC] Room ${roomId} not found in settings for booking ${booking.id}. ` +
    `Available rooms: ${settings.rooms.map(r => r.id).join(', ')}`
  );

  // Log full context for debugging
  console.error('[PRICE_CALC] Booking perRoomDates:', booking.perRoomDates);

  // Cannot calculate price - throw error instead of using wrong price
  throw new Error(
    `Pokoj ${roomId} nebyl nalezen v nastavení systému. ` +
    `Kontaktujte administrátora.`
  );
}

const isLargeRoom = room.capacity >= 4;
```

---

### Issue 3: Missing Validation for `perRoomDates` Structure

**Location:** `admin.js:729-739`

**Code:**
```javascript
for (const [roomId, dates] of Object.entries(booking.perRoomDates)) {
  const roomGuests = booking.perRoomGuests?.[roomId] || {
    adults: 1,
    children: 0,
    toddlers: 0,
    guestType: 'external'
  };

  const startDate = new Date(dates.startDate);
  const endDate = new Date(dates.endDate);
  const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
```

**Problem:**
If `dates` object is malformed:
- Missing `startDate` or `endDate` keys → `new Date(undefined)` → Invalid Date
- Invalid date strings → `new Date('invalid')` → Invalid Date
- `endDate < startDate` → negative `nights` → **negative price**
- `nights` becomes `NaN` → price becomes `NaN` → display shows "NaN Kč"

**Hidden Errors:**
- Database corruption
- Manual SQL edits
- Bugs in booking creation flow
- JSON parsing errors
- Migration bugs

**User Impact:**
Admin panel shows "NaN Kč" or negative prices → looks like broken code → trust in system destroyed.

**Recommendation:**
```javascript
for (const [roomId, dates] of Object.entries(booking.perRoomDates)) {
  // Validate dates structure
  if (!dates || typeof dates !== 'object') {
    console.error(`[PRICE_CALC] Invalid dates structure for room ${roomId} in booking ${booking.id}:`, dates);
    throw new Error(`Chybná struktura dat pro pokoj ${roomId}`);
  }

  if (!dates.startDate || !dates.endDate) {
    console.error(`[PRICE_CALC] Missing dates for room ${roomId} in booking ${booking.id}:`, dates);
    throw new Error(`Chybějící data termínů pro pokoj ${roomId}`);
  }

  const startDate = new Date(dates.startDate);
  const endDate = new Date(dates.endDate);

  // Validate date parsing
  if (isNaN(startDate.getTime())) {
    console.error(`[PRICE_CALC] Invalid startDate for room ${roomId}: "${dates.startDate}"`);
    throw new Error(`Neplatný formát data začátku pro pokoj ${roomId}`);
  }

  if (isNaN(endDate.getTime())) {
    console.error(`[PRICE_CALC] Invalid endDate for room ${roomId}: "${dates.endDate}"`);
    throw new Error(`Neplatný formát data konce pro pokoj ${roomId}`);
  }

  const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  // Validate nights calculation
  if (nights <= 0) {
    console.error(
      `[PRICE_CALC] Invalid date range for room ${roomId}: ` +
      `${dates.startDate} to ${dates.endDate} (${nights} nights)`
    );
    throw new Error(
      `Neplatný rozsah termínů pro pokoj ${roomId}: ` +
      `začátek musí být před koncem`
    );
  }

  // Rest of calculation...
}
```

---

### Issue 4: Missing Null Checks for `settings.prices`

**Location:** `admin.js:750, 754-758`

**Code:**
```javascript
const basePrice = settings.prices[priceKey] || 0;

const adultCharge = roomGuests.guestType === 'utia'
  ? settings.prices.adultUtia
  : settings.prices.adultExternal;
const childCharge = roomGuests.guestType === 'utia'
  ? settings.prices.childUtia
  : settings.prices.childExternal;
```

**Problem:**
If `settings.prices` is missing keys:
1. `basePrice` becomes `0` (wrong - should be error)
2. `adultCharge` becomes `undefined` (arithmetic with `undefined` → `NaN`)
3. Final price becomes `NaN`
4. **Silent failure** - no error logged

**Hidden Errors:**
- Admin deleted price settings
- Database migration incomplete
- Settings corruption
- API returned partial data

**Recommendation:**
```javascript
// Validate settings.prices structure exists
if (!settings.prices || typeof settings.prices !== 'object') {
  console.error('[PRICE_CALC] Missing or invalid settings.prices:', settings.prices);
  throw new Error('Chybí nastavení cen v systému');
}

// Get base price with validation
const basePrice = settings.prices[priceKey];
if (basePrice === undefined || basePrice === null) {
  console.error(
    `[PRICE_CALC] Missing price key "${priceKey}" in settings.prices. ` +
    `Available keys: ${Object.keys(settings.prices).join(', ')}`
  );
  throw new Error(`Chybí nastavení ceny pro klíč "${priceKey}"`);
}

// Get per-person charges with validation
const adultChargeKey = roomGuests.guestType === 'utia' ? 'adultUtia' : 'adultExternal';
const childChargeKey = roomGuests.guestType === 'utia' ? 'childUtia' : 'childExternal';

const adultCharge = settings.prices[adultChargeKey];
const childCharge = settings.prices[childChargeKey];

if (adultCharge === undefined) {
  console.error(`[PRICE_CALC] Missing price key "${adultChargeKey}"`);
  throw new Error(`Chybí nastavení ceny pro dospělé (${adultChargeKey})`);
}

if (childCharge === undefined) {
  console.error(`[PRICE_CALC] Missing price key "${childChargeKey}"`);
  throw new Error(`Chybí nastavení ceny pro děti (${childChargeKey})`);
}
```

---

## High-Priority Issues (P1)

### Issue 5: Missing Error Handling for `getSettings()` Failure

**Location:** `admin.js:724`

**Code:**
```javascript
const settings = await dataManager.getSettings();
```

**Problem:**
`getSettings()` calls chain:
```
getSettings() → getData() → initData()
```

If `initData()` fails (network error, localStorage full, etc.):
1. Returns default data structure
2. May have incomplete/incorrect settings
3. **No error logged in `calculateActualPrice()`**
4. Uses potentially wrong prices

**Debugging Chain:**

Looking at `data.js:984-987`:
```javascript
async getSettings() {
  const data = await this.getData();
  return data.settings;
}
```

Then `data.js:268-273`:
```javascript
async getData(forceRefresh = false) {
  if (!this.cachedData || forceRefresh) {
    await this.initData();
  }
  return this.cachedData;
}
```

Then `data.js:56-94` (initData):
```javascript
async initData() {
  // Try to load from server FIRST
  try {
    const response = await fetch(`${this.apiUrl}/data`);
    if (response.ok) {
      this.cachedData = await response.json();
      // ...
      return;
    }
  } catch (error) {
    console.error('Server not available:', error);
  }

  // Fallback to localStorage if server is not available
  const savedData = localStorage.getItem(this.storageKey);
  if (savedData) {
    try {
      this.cachedData = JSON.parse(savedData);
      return;
    } catch (error) {
      console.error('Error parsing localStorage data:', error);
    }
  }

  // Last resort - use default data
  this.cachedData = this.getDefaultData();
  // ...
}
```

**Hidden Errors:**
- Server down → uses localStorage → localStorage empty → **uses DEFAULT prices** (may be outdated)
- localStorage corrupted → uses DEFAULT prices
- Network timeout → uses DEFAULT prices
- **No indication to admin** that prices might be wrong

**Recommendation:**
```javascript
let settings;
try {
  settings = await dataManager.getSettings();

  // Validate settings structure
  if (!settings || !settings.prices || !settings.rooms) {
    throw new Error('Neúplná struktura nastavení');
  }

  // Optionally check if using fallback data
  if (settings === dataManager.getDefaultData().settings) {
    console.warn(
      '[PRICE_CALC] Using default settings - may not reflect current prices. ' +
      'Server may be unreachable.'
    );
    // Optionally show warning to admin
  }

} catch (error) {
  console.error('[PRICE_CALC] Failed to load settings:', error);
  throw new Error(
    'Nepodařilo se načíst nastavení systému. ' +
    'Zkontrolujte připojení k serveru.'
  );
}

// Continue with calculation using validated settings
```

---

### Issue 6: Fallback Hides Real Problem

**Location:** `admin.js:715-722`

**Code:**
```javascript
// If price-locked, use the stored totalPrice
if (booking.priceLocked) {
  return booking.totalPrice || 0;
}

// If no per-room data, fall back to stored price
if (!booking.perRoomDates || Object.keys(booking.perRoomDates).length === 0) {
  return booking.totalPrice || 0;
}
```

**Problem:**
The `|| 0` fallback masks two different error conditions:

1. **`booking.totalPrice` is `null`/`undefined`** → returns 0
2. **`booking.totalPrice` is legitimately 0** → returns 0

**Cannot distinguish between:**
- Database corruption (missing `total_price`)
- Free booking (totalPrice = 0, e.g., admin override)
- Calculation error

**Debugging Nightmare:**
```
Admin: "Why does booking BK456 show 0 Kč?"
Dev: *checks code* "It's price-locked, so uses stored totalPrice"
Dev: *checks database* "total_price column is NULL - why?"
Dev: *2 hours later* "Database was migrated incorrectly, lost prices"
```

**Recommendation:**
```javascript
// If price-locked, use the stored totalPrice
if (booking.priceLocked) {
  if (booking.totalPrice === null || booking.totalPrice === undefined) {
    console.error(
      `[PRICE_CALC] Price-locked booking ${booking.id} has no totalPrice. ` +
      `This indicates database corruption.`
    );
    throw new Error(
      `Rezervace ${booking.id} nemá uloženou cenu (databázová chyba)`
    );
  }
  return booking.totalPrice;
}

// If no per-room data, fall back to stored price
if (!booking.perRoomDates || Object.keys(booking.perRoomDates).length === 0) {
  console.warn(
    `[PRICE_CALC] Booking ${booking.id} has no perRoomDates. ` +
    `Using stored totalPrice as fallback.`
  );

  if (booking.totalPrice === null || booking.totalPrice === undefined) {
    console.error(
      `[PRICE_CALC] Booking ${booking.id} has no totalPrice and no perRoomDates. ` +
      `Cannot calculate price.`
    );
    throw new Error(
      `Rezervace ${booking.id} nemá platná cenová data`
    );
  }

  return booking.totalPrice;
}
```

---

### Issue 7: Missing Logging for Composite Calculations

**Location:** `admin.js:727-768`

**Problem:**
The entire price calculation happens **without any logging** of intermediate results. When the final price is wrong, impossible to debug:

- What was the base price used?
- What were the adult/child charges?
- How many nights?
- What was the calculation per room?

**Debugging Scenario:**
```
Admin: "Booking BK789 shows 3500 Kč but should be 2800 Kč"
Dev: *no logs* "Let me manually recalculate..."
Dev: *30 minutes later* "Found it: room 13 used large room pricing instead of small"
```

**Recommendation:**
```javascript
async calculateActualPrice(booking) {
  console.log(`[PRICE_CALC] Calculating price for booking ${booking.id}`);

  // ... existing checks ...

  const settings = await dataManager.getSettings();

  let grandTotal = 0;
  const priceBreakdown = []; // For debugging

  for (const [roomId, dates] of Object.entries(booking.perRoomDates)) {
    // ... existing calculations ...

    const roomTotal = perNight * nights;
    grandTotal += roomTotal;

    // Log per-room calculation
    priceBreakdown.push({
      roomId,
      roomType: isLargeRoom ? 'large' : 'small',
      nights,
      guestType: roomGuests.guestType,
      adults: roomGuests.adults,
      children: roomGuests.children,
      basePrice,
      adultCharge,
      childCharge,
      perNight,
      roomTotal
    });
  }

  console.log(
    `[PRICE_CALC] Booking ${booking.id} price calculation:`,
    {
      grandTotal,
      breakdown: priceBreakdown
    }
  );

  return grandTotal;
}
```

---

## Medium-Priority Issues (P2)

### Issue 8: No User Notification for Calculation Failures

**Location:** `admin.js:592-597`

**Problem:**
If price calculation fails, user sees:
- Empty booking list (if Promise.all fails)
- Or incorrect price (if fallback used)

**No error message** tells user what happened.

**Recommendation:**
Add error notification system:
```javascript
try {
  const priceResults = await Promise.allSettled(pricePromises);

  const failedCount = priceResults.filter(r => r.status === 'rejected').length;

  if (failedCount > 0) {
    this.showWarning(
      `Nepodařilo se přepočítat ceny pro ${failedCount} rezervací. ` +
      `Zobrazeny jsou původní ceny. Zkontrolujte nastavení systému.`
    );
  }

  // ... rest of processing ...

} catch (error) {
  console.error('[ADMIN] Failed to load bookings:', error);
  this.showError(
    'Nepodařilo se načíst seznam rezervací. ' +
    'Zkontrolujte připojení k serveru a zkuste to znovu.'
  );
}
```

---

### Issue 9: Missing Bounds Checking for Arithmetic

**Location:** `admin.js:761-765`

**Code:**
```javascript
const perNight = basePrice +
  (roomGuests.adults * adultCharge) +
  (roomGuests.children * childCharge);

grandTotal += perNight * nights;
```

**Problem:**
No validation that results are reasonable:
- Negative prices
- Astronomical prices (billion CZK)
- NaN values

**Recommendation:**
```javascript
const perNight = basePrice +
  (roomGuests.adults * adultCharge) +
  (roomGuests.children * childCharge);

// Validate perNight
if (isNaN(perNight)) {
  console.error(
    `[PRICE_CALC] NaN price calculated for room ${roomId}:`,
    { basePrice, adults: roomGuests.adults, adultCharge, children: roomGuests.children, childCharge }
  );
  throw new Error(`Chybný výpočet ceny pro pokoj ${roomId}`);
}

if (perNight < 0) {
  console.error(`[PRICE_CALC] Negative price for room ${roomId}: ${perNight} Kč`);
  throw new Error(`Záporná cena pro pokoj ${roomId}`);
}

const roomTotal = perNight * nights;

// Sanity check: max 100,000 CZK per room (reasonable upper bound)
if (roomTotal > 100000) {
  console.warn(
    `[PRICE_CALC] Unusually high price for room ${roomId}: ${roomTotal} Kč ` +
    `(${nights} nights × ${perNight} Kč/night)`
  );
}

grandTotal += roomTotal;
```

---

## Summary Table

| Issue | Severity | Location | Impact | Fix Effort |
|-------|----------|----------|--------|------------|
| Silent failures in Promise.all | CRITICAL | admin.js:592-597 | Complete UI failure, no bookings shown | Medium - replace with Promise.allSettled |
| Missing null check for room | CRITICAL | admin.js:742-743 | Wrong prices, silent failure | Low - add null check + error |
| Missing validation for perRoomDates | CRITICAL | admin.js:729-739 | NaN prices, negative prices | Medium - add validation |
| Missing null checks for settings.prices | CRITICAL | admin.js:750-758 | NaN prices, silent failure | Low - add null checks |
| Missing error handling for getSettings | HIGH | admin.js:724 | Wrong prices from default data | Low - add try-catch |
| Fallback hides real problem | HIGH | admin.js:715-722 | Cannot distinguish errors from valid data | Low - replace || 0 with explicit checks |
| Missing calculation logging | HIGH | admin.js:727-768 | Impossible to debug wrong prices | Low - add console.log |
| No user notification | MEDIUM | admin.js:592-597 | User confusion | Medium - add error UI |
| Missing bounds checking | MEDIUM | admin.js:761-765 | NaN/negative prices undetected | Low - add validation |

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Deploy ASAP)

1. ✅ Replace `Promise.all()` with `Promise.allSettled()` + error handling
2. ✅ Add null check for `settings.rooms.find()` with proper error
3. ✅ Validate `perRoomDates` structure before calculations
4. ✅ Add null checks for `settings.prices` keys

**Estimated effort:** 2-3 hours
**Risk reduction:** Eliminates 4/7 critical issues

### Phase 2: Error Visibility (Next sprint)

5. ✅ Add comprehensive logging to `calculateActualPrice()`
6. ✅ Add user notifications for calculation failures
7. ✅ Replace `|| 0` fallbacks with explicit error handling

**Estimated effort:** 2-4 hours
**Risk reduction:** Makes debugging 10x faster

### Phase 3: Robustness (Future)

8. ✅ Add bounds checking for arithmetic results
9. ✅ Add monitoring/alerting for price calculation failures
10. ✅ Add unit tests for `calculateActualPrice()` edge cases

**Estimated effort:** 4-6 hours
**Risk reduction:** Catches errors before production

---

## Testing Recommendations

### Manual Test Cases

Test these scenarios to verify error handling:

1. **Missing room in settings:**
   - Manually edit database: change `room_id` to '99' in `booking_rooms`
   - Expected: Error logged, booking shows fallback price or error message

2. **Malformed perRoomDates:**
   - Manually edit database: set `start_date` to `NULL` in `booking_rooms`
   - Expected: Error logged, booking shows fallback or error

3. **Missing settings.prices keys:**
   - Temporarily delete `settings.prices.adultUtia` in admin panel
   - Expected: Error logged when calculating ÚTIA booking price

4. **Network failure during settings load:**
   - Disconnect server, reload admin panel
   - Expected: Warning shown that default prices are used

5. **One booking fails price calculation:**
   - Create malformed booking manually
   - Expected: Other bookings still load, error shown for failed one

---

## Conclusion

The price calculation fix introduces **critical error handling gaps** that could lead to:

1. ❌ Complete admin panel failures with no error message
2. ❌ Wrong prices displayed silently
3. ❌ Impossible-to-debug issues (no logs)
4. ❌ User confusion and loss of trust in system

**Recommendation:** Implement Phase 1 fixes IMMEDIATELY before this code reaches production. The current implementation follows the "fail silently" anti-pattern, which violates the project's documented principle:

> "Silent failures are unacceptable - Any error that occurs without proper logging and user feedback is a critical defect"
> — CLAUDE.md, Error Handling section

All issues identified are fixable with low to medium effort. Priority should be given to:
1. Preventing complete UI failure (Promise.allSettled)
2. Preventing silent wrong prices (null checks + validation)
3. Making debugging possible (logging)
