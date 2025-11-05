# Pricing Model Test Plan - Empty Room + Per-Room Guest Types

**Date**: 2025-11-04
**Feature**: New pricing model with empty room base prices and per-room guest type selection
**Status**: Ready for comprehensive testing

---

## Test Environment

- **Application URL**: http://chata.utia.cas.cz
- **Admin Panel**: http://chata.utia.cas.cz/admin.html
- **Database**: SQLite with price_locked migration applied (39 existing bookings locked)

---

## Test Categories

1. [Admin Panel - Price Configuration](#test-category-1-admin-panel)
2. [New Bookings - Per-Room Guest Types](#test-category-2-new-bookings)
3. [Existing Bookings - Price Lock](#test-category-3-existing-bookings)
4. [Price Calculations - Various Combinations](#test-category-4-price-calculations)
5. [Edge Cases](#test-category-5-edge-cases)

---

## Test Category 1: Admin Panel - Price Configuration

### Test 1.1: Empty Room Price Labels

**Objective**: Verify admin UI shows "Prázdný pokoj" labels instead of old "Při obsazení 1 dospělou osobou"

**Steps**:
1. Login to admin panel: http://chata.utia.cas.cz/admin.html
2. Navigate to "Nastavení systému" tab
3. Scroll to "Ceny pro jednotlivé rezervace" section

**Expected Result**:
- ✅ All 4 base price labels show: "Prázdný pokoj:" (not old labels)
- ✅ Labels appear for:
  - ÚTIA - Malý pokoj (small room)
  - ÚTIA - Velký pokoj (large room)
  - Externí - Malý pokoj (small room)
  - Externí - Velký pokoj (large room)

### Test 1.2: Save Empty Room Prices

**Objective**: Verify admin can save new empty room prices

**Test Data**:
```
ÚTIA:
  Small room (empty): 250 Kč
  Small room (adult): 50 Kč
  Small room (child): 25 Kč
  Large room (empty): 350 Kč
  Large room (adult): 70 Kč
  Large room (child): 35 Kč

External:
  Small room (empty): 400 Kč
  Small room (adult): 100 Kč
  Small room (child): 50 Kč
  Large room (empty): 500 Kč
  Large room (adult): 120 Kč
  Large room (child): 60 Kč
```

**Steps**:
1. Enter test data into admin panel price fields
2. Click "Uložit nastavení" (Save settings)
3. Wait for success notification
4. Refresh page
5. Verify prices are persisted

**Expected Result**:
- ✅ Success notification appears: "Nastavení bylo úspěšně uloženo"
- ✅ After refresh, all prices match entered values
- ✅ Database contains prices in new format (with `empty` key)

**Verification Query**:
```sql
SELECT value FROM settings WHERE key = 'prices';
```

Expected JSON structure:
```json
{
  "utia": {
    "small": { "empty": 250, "adult": 50, "child": 25 },
    "large": { "empty": 350, "adult": 70, "child": 35 }
  },
  "external": {
    "small": { "empty": 400, "adult": 100, "child": 50 },
    "large": { "empty": 500, "adult": 120, "child": 60 }
  }
}
```

### Test 1.3: Backward Compatibility (Old Price Format)

**Objective**: Verify admin panel can load old price format and convert to new

**Steps**:
1. Manually update database with old format:
```sql
UPDATE settings SET value = '{"utia":{"small":{"base":300,"adult":50,"child":25}}}' WHERE key = 'prices';
```
2. Refresh admin panel
3. Check displayed values

**Expected Result**:
- ✅ Empty room price displays as: `base - adult` = 300 - 50 = 250 Kč
- ✅ Adult surcharge displays: 50 Kč
- ✅ Child surcharge displays: 25 Kč
- ✅ When saved, converts to new format with `empty: 250`

---

## Test Category 2: New Bookings - Per-Room Guest Types

### Test 2.1: Single Room - ÚTIA Employee

**Objective**: Test booking 1 small room with ÚTIA pricing

**Steps**:
1. Open http://chata.utia.cas.cz
2. Click on small room (P12, P13, P22, P23, P42, or P43)
3. Select dates (e.g., 2025-12-10 to 2025-12-12 = 2 nights)
4. In per-room guest type dropdown, select "Zaměstnanec ÚTIA"
5. Set guests: 2 adults, 1 child, 0 toddlers
6. Complete booking form

**Expected Price Calculation** (using test data from 1.2):
```
Empty room: 250 Kč × 2 nights = 500 Kč
Adults: 2 × 50 Kč × 2 nights = 200 Kč
Children: 1 × 25 Kč × 2 nights = 50 Kč
Total: 750 Kč
```

**Expected Result**:
- ✅ Price preview shows 750 Kč
- ✅ Booking confirmation shows 750 Kč
- ✅ Database `guest_type` = 'utia'
- ✅ Database `total_price` = 750

### Test 2.2: Single Room - External Guest

**Objective**: Test booking 1 small room with External pricing

**Steps**:
1. Open http://chata.utia.cas.cz
2. Click on small room (P12)
3. Select dates (2025-12-10 to 2025-12-12 = 2 nights)
4. In per-room guest type dropdown, select "Externí host"
5. Set guests: 2 adults, 1 child
6. Complete booking form

**Expected Price Calculation** (using test data from 1.2):
```
Empty room: 400 Kč × 2 nights = 800 Kč
Adults: 2 × 100 Kč × 2 nights = 400 Kč
Children: 1 × 50 Kč × 2 nights = 100 Kč
Total: 1300 Kč
```

**Expected Result**:
- ✅ Price preview shows 1300 Kč
- ✅ Booking confirmation shows 1300 Kč
- ✅ Database `guest_type` = 'external'
- ✅ Database `total_price` = 1300

### Test 2.3: Large Room - ÚTIA Employee

**Objective**: Test large room pricing (P14, P24, or P44)

**Steps**:
1. Click on large room (P14)
2. Select dates (2025-12-10 to 2025-12-12 = 2 nights)
3. Select "Zaměstnanec ÚTIA"
4. Set guests: 3 adults, 1 child
5. Complete booking

**Expected Price Calculation**:
```
Empty room: 350 Kč × 2 nights = 700 Kč
Adults: 3 × 70 Kč × 2 nights = 420 Kč
Children: 1 × 35 Kč × 2 nights = 70 Kč
Total: 1190 Kč
```

**Expected Result**:
- ✅ Price preview shows 1190 Kč
- ✅ Large room pricing applied (not small room)

### Test 2.4: Multi-Room - Mixed Guest Types

**Objective**: Test booking 2 rooms with different guest types

**Steps**:
1. Click on P12 (small room)
   - Dates: 2025-12-10 to 2025-12-12
   - Guest type: "Zaměstnanec ÚTIA"
   - Guests: 2 adults
   - Click "Přidat do rezervace"
2. Click on P13 (small room)
   - Dates: 2025-12-10 to 2025-12-12
   - Guest type: "Externí host"
   - Guests: 2 adults, 1 child
   - Click "Přidat do rezervace"
3. Click "Dokončit rezervaci"
4. Fill form and submit

**Expected Price Calculation**:
```
Room P12 (ÚTIA):
  Empty: 250 × 2 = 500 Kč
  Adults: 2 × 50 × 2 = 200 Kč
  Subtotal: 700 Kč

Room P13 (External):
  Empty: 400 × 2 = 800 Kč
  Adults: 2 × 100 × 2 = 400 Kč
  Children: 1 × 50 × 2 = 100 Kč
  Subtotal: 1300 Kč

Total: 2000 Kč
```

**Expected Result**:
- ✅ Total price: 2000 Kč
- ✅ Booking form shows breakdown per room
- ✅ Database stores per-room guest types correctly
- ✅ Server validates and accepts mixed guest types

### Test 2.5: Zero Guests (Edge Case)

**Objective**: Verify empty room can be booked with 0 adults (only toddlers)

**Steps**:
1. Click on P12
2. Select dates
3. Set guests: 0 adults, 0 children, 2 toddlers
4. Attempt to book

**Expected Price Calculation**:
```
Empty room: 250 × 2 = 500 Kč
Adults: 0 × 50 × 2 = 0 Kč
Children: 0 × 25 × 2 = 0 Kč
Toddlers: FREE (always 0 Kč)
Total: 500 Kč
```

**Expected Result**:
- ✅ Price shows 500 Kč (only empty room price)
- ✅ Toddlers don't add to price
- ✅ Booking allowed (at least 1 toddler = valid)

---

## Test Category 3: Existing Bookings - Price Lock

### Test 3.1: Verify Price Lock Flag

**Objective**: Confirm all existing bookings have `price_locked = 1`

**Steps**:
1. Connect to database:
```bash
docker exec -it marianska-chata sqlite3 /app/data/bookings.db
```

2. Run query:
```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN price_locked = 1 THEN 1 ELSE 0 END) as locked,
  SUM(CASE WHEN price_locked = 0 OR price_locked IS NULL THEN 1 ELSE 0 END) as unlocked
FROM bookings;
```

**Expected Result**:
```
total | locked | unlocked
------|--------|----------
  39  |   39   |    0
```
- ✅ All 39 existing bookings have `price_locked = 1`
- ✅ No unlocked bookings

### Test 3.2: Edit Locked Booking - Dates Only

**Objective**: Verify price does NOT recalculate when editing locked booking dates

**Steps**:
1. Open admin panel
2. Find any existing booking (created before 2025-11-04)
3. Note original price (e.g., 1234 Kč)
4. Click "Upravit" (Edit)
5. Change dates (e.g., extend by 1 day)
6. Save changes
7. Check updated booking

**Expected Result**:
- ✅ Success notification appears
- ✅ Price remains UNCHANGED: 1234 Kč (not recalculated)
- ✅ Server logs show: `Price recalculation skipped for locked booking`
- ✅ Dates updated successfully
- ✅ `price_locked` remains 1

**Verification**:
```bash
docker-compose logs web | grep "Price recalculation skipped"
```

### Test 3.3: Edit Locked Booking - Guest Counts

**Objective**: Verify price does NOT recalculate when editing locked booking guest counts

**Steps**:
1. Open existing locked booking
2. Note original: 2 adults, 1 child, price 1234 Kč
3. Edit: Change to 3 adults, 2 children
4. Save
5. Verify

**Expected Result**:
- ✅ Guest counts updated successfully
- ✅ Price remains 1234 Kč (NOT recalculated to new formula)
- ✅ `price_locked = 1` persists

### Test 3.4: Edit Locked Booking - Non-Price Fields

**Objective**: Verify non-price fields can be edited freely

**Steps**:
1. Open existing locked booking
2. Edit: Change name, email, notes, payment status
3. Save

**Expected Result**:
- ✅ All non-price fields update successfully
- ✅ Price remains unchanged
- ✅ No server log about price lock (only logs when price-affecting fields change)

### Test 3.5: New Booking - Not Locked

**Objective**: Verify NEW bookings do NOT have price lock

**Steps**:
1. Create new booking (any room, any dates)
2. Complete booking
3. Check database

**Verification Query**:
```sql
SELECT id, total_price, price_locked, created_at
FROM bookings
WHERE created_at >= '2025-11-04'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result**:
- ✅ New bookings have `price_locked = 0` or `NULL`
- ✅ If edited, prices WILL recalculate with new formula

---

## Test Category 4: Price Calculations - Various Combinations

### Test 4.1: All Guest Type Combinations

**Objective**: Verify all guest type surcharges apply correctly

**Test Matrix**:

| Room Type | Guest Type | Adults | Children | Toddlers | Expected Calculation (2 nights) |
|-----------|------------|--------|----------|----------|----------------------------------|
| Small     | ÚTIA       | 0      | 0        | 2        | 250×2 = 500 Kč                  |
| Small     | ÚTIA       | 1      | 0        | 0        | 250×2 + 1×50×2 = 600 Kč         |
| Small     | ÚTIA       | 2      | 1        | 0        | 250×2 + 2×50×2 + 1×25×2 = 750 Kč|
| Small     | External   | 1      | 0        | 0        | 400×2 + 1×100×2 = 1000 Kč       |
| Large     | ÚTIA       | 3      | 1        | 0        | 350×2 + 3×70×2 + 1×35×2 = 1190 Kč|
| Large     | External   | 4      | 2        | 1        | 500×2 + 4×120×2 + 2×60×2 = 2200 Kč|

**Steps for each row**:
1. Create booking with specified parameters
2. Verify calculated price matches expected
3. Submit and verify final price in database

**Expected Result**:
- ✅ All calculations match table
- ✅ Toddlers always free (0 Kč contribution)
- ✅ ALL adults pay surcharge (no "first adult free")
- ✅ ALL children pay surcharge

### Test 4.2: Multi-Night Bookings

**Objective**: Verify per-night multiplication works correctly

**Test Cases**:
- 1 night: 250 + 50 = 300 Kč
- 2 nights: (250 + 50) × 2 = 600 Kč
- 7 nights: (250 + 50) × 7 = 2100 Kč

**Expected Result**:
- ✅ Linear scaling with nights
- ✅ No bulk discount for long stays (as per requirements)

### Test 4.3: Room Capacity Validation

**Objective**: Verify capacity limits are enforced

**Test Data**:
- Small rooms (P12, P13, P22, P23, P42, P43): Max 3 beds
- Large rooms (P14, P24, P44): Max 4 beds

**Steps**:
1. Try to book small room with 4 adults + 1 child = 5 people (excluding toddlers)
2. Expect error

**Expected Result**:
- ✅ Error: "Pokoj má kapacitu pouze X lůžek"
- ✅ Booking blocked
- ✅ Toddlers don't count toward capacity

---

## Test Category 5: Edge Cases

### Test 5.1: Bulk Booking Pricing

**Objective**: Verify bulk pricing (all 9 rooms) uses correct formula

**Note**: According to previous analysis, bulk pricing already follows empty chalet model, so no changes needed.

**Steps**:
1. Click "Celá chata" (Whole chalet)
2. Select dates
3. Set global guest type and counts
4. Verify price

**Expected Result**:
- ✅ Bulk pricing matches: `empty_chalet + (guests × per_person_rate)`
- ✅ No individual room pricing applied

### Test 5.2: Price Display Consistency

**Objective**: Verify price displayed matches database value

**Steps**:
1. Create booking
2. Note displayed price in confirmation (e.g., 1234 Kč)
3. Check database
4. Check admin panel view
5. Check edit page view

**Expected Result**:
- ✅ All views show same price: 1234 Kč
- ✅ No rounding discrepancies
- ✅ Czech formatting: "1 234 Kč" (space separator)

### Test 5.3: Guest Type Dropdown Initialization

**Objective**: Verify dropdown defaults to correct value

**Steps**:
1. Open single room modal (first time)
2. Check dropdown default

**Expected Result**:
- ✅ Defaults to "Zaměstnanec ÚTIA" (ÚTIA employee)

**Steps**:
1. Select "Externí host"
2. Close modal
3. Reopen same room modal

**Expected Result**:
- ✅ Dropdown remembers "Externí host" (persisted in roomGuests Map)

### Test 5.4: Per-Room Guest Type in Multi-Room Edit

**Objective**: Verify each room retains its own guest type in edit mode

**Steps**:
1. Create multi-room booking:
   - P12: ÚTIA, 2 adults
   - P13: External, 2 adults
2. Open admin edit
3. Verify each room shows correct guest type

**Expected Result**:
- ✅ P12 shows "ÚTIA" selected
- ✅ P13 shows "External" selected
- ✅ Can change individual room guest types independently

---

## Automated Testing Scripts

### Script 1: Price Calculation Validator

Create `/home/marianska/marianska/tests/test-new-pricing.js`:

```javascript
const PriceCalculator = require('../js/shared/priceCalculator');

const testCases = [
  {
    name: 'Small room, ÚTIA, 1 adult, 2 nights',
    options: {
      rooms: ['12'],
      guestType: 'utia',
      adults: 1,
      children: 0,
      toddlers: 0,
      nights: 2,
      settings: {
        rooms: [{ id: '12', type: 'small' }],
        prices: {
          utia: {
            small: { empty: 250, adult: 50, child: 25 }
          }
        }
      }
    },
    expected: 600 // (250 + 50) × 2
  },
  // Add more test cases from Test 4.1 matrix
];

for (const test of testCases) {
  const result = PriceCalculator.calculatePriceFromRooms(test.options);
  console.log(`${test.name}: ${result === test.expected ? '✅ PASS' : '❌ FAIL'} (got ${result}, expected ${test.expected})`);
}
```

Run:
```bash
docker exec marianska-chata node tests/test-new-pricing.js
```

### Script 2: Price Lock Verification

```bash
#!/bin/bash
# test-price-lock.sh

echo "Testing price lock feature..."

# 1. Count locked bookings
LOCKED=$(docker exec marianska-chata sqlite3 /app/data/bookings.db "SELECT COUNT(*) FROM bookings WHERE price_locked = 1;")
echo "Locked bookings: $LOCKED"

# 2. Count new bookings (should not be locked)
NEW=$(docker exec marianska-chata sqlite3 /app/data/bookings.db "SELECT COUNT(*) FROM bookings WHERE price_locked = 0 OR price_locked IS NULL;")
echo "Unlocked bookings: $NEW"

# 3. Check if any old bookings are unlocked (should be 0)
OLD_UNLOCKED=$(docker exec marianska-chata sqlite3 /app/data/bookings.db "SELECT COUNT(*) FROM bookings WHERE created_at < '2025-11-04' AND (price_locked = 0 OR price_locked IS NULL);")

if [ "$OLD_UNLOCKED" -eq 0 ]; then
  echo "✅ All old bookings are locked"
else
  echo "❌ FAIL: $OLD_UNLOCKED old bookings are not locked"
fi
```

Run:
```bash
chmod +x tests/test-price-lock.sh
./tests/test-price-lock.sh
```

---

## Manual Testing Checklist

### Pre-Testing Setup

- [ ] Docker containers running
- [ ] Admin test prices configured (see Test 1.2)
- [ ] Browser cache cleared (Ctrl+Shift+R)
- [ ] Admin panel accessible
- [ ] Database backup created

### Admin Panel Tests

- [ ] Test 1.1: Empty room labels visible
- [ ] Test 1.2: Save empty room prices
- [ ] Test 1.3: Backward compatibility

### New Booking Tests

- [ ] Test 2.1: Single room ÚTIA
- [ ] Test 2.2: Single room External
- [ ] Test 2.3: Large room pricing
- [ ] Test 2.4: Multi-room mixed guest types
- [ ] Test 2.5: Zero adults (only toddlers)

### Existing Booking Tests

- [ ] Test 3.1: Price lock flag verification
- [ ] Test 3.2: Edit dates (price unchanged)
- [ ] Test 3.3: Edit guests (price unchanged)
- [ ] Test 3.4: Edit non-price fields
- [ ] Test 3.5: New bookings not locked

### Price Calculation Tests

- [ ] Test 4.1: All guest type combinations (6 rows)
- [ ] Test 4.2: Multi-night bookings (3 cases)
- [ ] Test 4.3: Room capacity validation

### Edge Case Tests

- [ ] Test 5.1: Bulk booking pricing
- [ ] Test 5.2: Price display consistency
- [ ] Test 5.3: Dropdown initialization
- [ ] Test 5.4: Per-room guest types in edit

---

## Success Criteria

✅ **All tests pass** (100% success rate)
✅ **No price recalculations** for locked bookings
✅ **Correct pricing** for new bookings with per-room guest types
✅ **Admin UI** shows empty room labels
✅ **Backward compatibility** maintained
✅ **No console errors** during testing
✅ **Server logs** confirm price lock behavior

---

## Issue Tracking

If any test fails, document:
1. Test number (e.g., Test 2.3)
2. Expected result
3. Actual result
4. Steps to reproduce
5. Browser/environment details
6. Screenshot/console logs

---

## Post-Testing Actions

After all tests pass:
1. [ ] Document any discovered issues
2. [ ] Update CLAUDE.md with final pricing model documentation
3. [ ] Create production deployment checklist
4. [ ] Notify stakeholders of testing completion
5. [ ] Schedule production deployment

---

**Prepared by**: AI Assistant
**Review by**: Development Team
**Approval**: Pending testing completion
