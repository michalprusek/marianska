# New Pricing Model Implementation - Complete Documentation

**Implementation Date**: 2025-11-04
**Status**: ✅ COMPLETED AND TESTED
**Breaking Change**: Yes (backward compatible with price locking)

---

## Executive Summary

Successfully implemented a new pricing model where:
- ✅ Admin sets base price for **EMPTY rooms** (no implicit guests included)
- ✅ **ALL adults and children** pay surcharges (no "first adult free")
- ✅ Per-room guest type pricing (ÚTIA vs External determined per room, not per booking)
- ✅ Existing bookings have frozen prices (no recalculation)
- ✅ Backward compatibility maintained

---

## New Pricing Formula

### Old Formula (Before 2025-11-04)
```
Price = (base - adult_surcharge) + (adults × adult_surcharge) + (children × child_surcharge)
```
- Base price included 1 adult implicitly
- First adult was "free" (already in base)

### New Formula (After 2025-11-04)
```
Price = empty_room + (ALL adults × adult_rate) + (ALL children × child_rate)
```
- Empty room = truly empty (no guests)
- ALL adults pay surcharge (no implicit inclusion)
- ALL children pay surcharge
- Toddlers (0-2 years) always free

---

## Implementation Changes

### Phase 5.1: Database Migration

**File**: `/home/marianska/marianska/database.js` (lines 216-243)

**Changes**:
- Added `price_locked INTEGER DEFAULT 0` column to `bookings` table
- Automatically locked 39 existing bookings (`price_locked = 1`)
- One-time migration ensures old bookings never recalculate

**Migration SQL**:
```sql
ALTER TABLE bookings ADD COLUMN price_locked INTEGER DEFAULT 0;
UPDATE bookings SET price_locked = 1 WHERE price_locked = 0 OR price_locked IS NULL;
```

**Verification**:
```bash
docker exec marianska-chata node /app/verify-price-lock-quick.js
# Output: ✅ SUCCESS: All bookings are locked (39/39)
```

---

### Phase 5.2: PriceCalculator Refactor

**File**: `/home/marianska/marianska/js/shared/priceCalculator.js` (lines 80-178)

**Changes**:
- Complete formula refactor to `empty + (guests × rates)`
- Added per-room guest type support (`perRoomGuests` array parameter)
- Backward compatibility: Falls back to `base - adult` if `empty` not configured

**Key Method**:
```javascript
static calculateRoomSizeBasedPrice(options) {
  const {
    guestType,
    adults = 0,
    children = 0,
    nights = 1,
    rooms = [],
    perRoomGuests = null,  // NEW: Per-room guest breakdown
    settings,
  } = options;

  // If per-room guest breakdown is provided, calculate per-room prices
  if (perRoomGuests && Array.isArray(perRoomGuests) && perRoomGuests.length > 0) {
    for (const roomGuest of perRoomGuests) {
      const { roomId, guestType: roomGuestType, adults: roomAdults, children: roomChildren } = roomGuest;

      const room = settings.rooms?.find((r) => r.id === roomId);
      const roomType = room?.type || 'small';

      const guestKey = roomGuestType === 'utia' ? 'utia' : 'external';
      const roomPriceConfig = prices[guestKey]?.[roomType];

      // Empty room price (no implicit guests)
      // Fallback: if 'empty' not configured, calculate from old format
      const emptyRoomPrice = roomPriceConfig.empty !== undefined
        ? roomPriceConfig.empty
        : roomPriceConfig.base - roomPriceConfig.adult;

      totalPrice += emptyRoomPrice * nights;

      // ALL adults and children pay surcharges
      totalPrice += roomAdults * roomPriceConfig.adult * nights;
      totalPrice += roomChildren * roomPriceConfig.child * nights;
    }
  }

  return Math.round(totalPrice);
}
```

**Test Results**:
```bash
docker exec marianska-chata node /app/test-new-pricing-formula.js
# Output: ✅ All 6 tests passed
```

---

### Phase 5.3: Admin UI Updates

**File**: `/home/marianska/marianska/admin.html` (lines 1340, 1380, 1436, 1476)

**Changes**:
- Changed all 4 base price labels from **"Při obsazení 1 dospělou osobou:"** to **"Prázdný pokoj:"**
- Updated for all combinations:
  - ÚTIA small room
  - ÚTIA large room
  - External small room
  - External large room

**File**: `/home/marianska/marianska/admin.js` (lines 2400-2524)

**Changes**:
- Admin saves prices with `empty` key (not `base`)
- Admin loads prices with backward compatibility:
  ```javascript
  const emptyPrice = prices.utia?.small?.empty !== undefined
    ? prices.utia.small.empty
    : (prices.utia?.small?.base !== undefined
      ? prices.utia.small.base - (prices.utia.small.adult || 0)
      : defaultPrices.utia.small.base - defaultPrices.utia.small.adult);
  ```

**Database Schema**:
```json
{
  "key": "prices",
  "value": {
    "utia": {
      "small": {
        "empty": 250,
        "adult": 50,
        "child": 25
      },
      "large": {
        "empty": 350,
        "adult": 70,
        "child": 35
      }
    },
    "external": {
      "small": {
        "empty": 400,
        "adult": 100,
        "child": 50
      },
      "large": {
        "empty": 500,
        "adult": 120,
        "child": 60
      }
    }
  }
}
```

---

### Phase 5.4: Booking UI - Per-Room Guest Type Selection

**File**: `/home/marianska/marianska/index.html` (lines 1432-1481)

**Changes**:
- Added dropdown UI for selecting per-room guest type:
  ```html
  <select id="singleRoomPerRoomGuestType" onchange="window.app.setRoomGuestType(this.value)">
    <option value="utia">Zaměstnanec ÚTIA</option>
    <option value="external">Externí host</option>
  </select>
  ```

**File**: `/home/marianska/marianska/js/booking-app.js` (lines 561-588)

**Changes**:
- Added `setRoomGuestType(guestType)` method
- Updates `roomGuests` Map with per-room guest type
- Triggers price recalculation on change

**File**: `/home/marianska/marianska/js/single-room-booking.js` (lines 177-179, 221-225)

**Changes**:
- Initialize default `guestType: 'utia'` when creating room guests
- Sync dropdown value with current room's guest type on modal open

**File**: `/home/marianska/marianska/js/booking-form.js` (lines 161-187)

**Changes**:
- Use per-room guest types in price calculation
- Include `guestType` in `perRoomGuests` array passed to PriceCalculator
- Each room can have different guest type in multi-room bookings

---

### Phase 5.5: Server Validation - Price Lock Logic

**File**: `/home/marianska/marianska/server.js` (lines 1135-1190)

**Changes**:
- Added `isPriceLocked` check in `PUT /api/booking/:id` endpoint
- Skip price recalculation if `existingBooking.price_locked === 1`
- Log when price recalculation is skipped

**Implementation**:
```javascript
// NEW 2025-11-04: Check if price is locked (prevent recalculation for old bookings)
const isPriceLocked = existingBooking.price_locked === 1;

// Detect if only payment-related fields are changing
const priceAffectingFieldsChanged =
  bookingData.startDate !== existingBooking.startDate ||
  bookingData.endDate !== existingBooking.endDate ||
  bookingData.adults !== existingBooking.adults ||
  bookingData.children !== existingBooking.children ||
  bookingData.toddlers !== existingBooking.toddlers ||
  bookingData.guestType !== existingBooking.guestType ||
  JSON.stringify(bookingData.rooms?.sort()) !== JSON.stringify(existingBooking.rooms?.sort());

// Only recalculate price if price-affecting fields changed AND price is not locked
if (priceAffectingFieldsChanged && !isPriceLocked) {
  // Recalculate price using shared PriceCalculator
  // ...
} else {
  // Preserve original price
  bookingData.totalPrice = existingBooking.totalPrice;

  if (isPriceLocked && priceAffectingFieldsChanged) {
    logger.info('Price recalculation skipped for locked booking', {
      bookingId,
      originalPrice: existingBooking.totalPrice,
      reason: 'price_locked',
    });
  }
}
```

**Behavior**:
- **Existing bookings** (before 2025-11-04): Price frozen, never recalculates
- **New bookings** (after 2025-11-04): Price recalculates with new formula when edited

---

## Testing Results

### Test 1: Price Lock Verification
```bash
$ docker exec marianska-chata node /app/verify-price-lock-quick.js

=== Price Lock Verification ===

Total bookings: 39
Locked: 39
Unlocked: 0

✅ SUCCESS: All bookings are locked
```

### Test 2: New Pricing Formula
```bash
$ docker exec marianska-chata node /app/test-new-pricing-formula.js

=== Testing New Pricing Formula ===

Test: Small room, ÚTIA, 0 adults, 0 children, 2 toddlers (only empty room)
Expected: 500 Kč
Actual: 500 Kč
✅ PASS

Test: Small room, ÚTIA, 1 adult, 0 children, 2 nights
Expected: 600 Kč
Actual: 600 Kč
✅ PASS

Test: Small room, ÚTIA, 2 adults, 1 child, 2 nights
Expected: 750 Kč
Actual: 750 Kč
✅ PASS

Test: Large room, ÚTIA, 3 adults, 1 child, 2 nights
Expected: 1190 Kč
Actual: 1190 Kč
✅ PASS

Test: Small room, External, 1 adult, 0 children, 2 nights
Expected: 1000 Kč
Actual: 1000 Kč
✅ PASS

Test: Large room, External, 4 adults, 2 children, 2 nights
Expected: 2200 Kč
Actual: 2200 Kč
✅ PASS

=== Test Summary ===
Total: 6
Passed: 6 ✅
Failed: 0

✅ All tests passed!
```

---

## Deployment Guide

### Prerequisites
- Docker and docker-compose installed
- Access to production server
- Database backup created

### Deployment Steps

1. **Backup Database**:
```bash
cd /home/marianska/marianska
docker exec marianska-chata cp /app/data/bookings.db /app/data/bookings.backup-$(date +%Y%m%d).db
```

2. **Pull Latest Changes**:
```bash
git pull origin main
```

3. **Rebuild Containers**:
```bash
docker-compose down
docker-compose up --build -d
```

4. **Verify Migration**:
```bash
docker exec marianska-chata node /app/verify-price-lock-quick.js
```

Expected output:
```
✅ SUCCESS: All bookings are locked (39/39)
```

5. **Test Pricing Formula**:
```bash
docker exec marianska-chata node /app/test-new-pricing-formula.js
```

Expected output:
```
✅ All tests passed!
```

6. **Check Server Logs**:
```bash
docker-compose logs -f web | grep "Migration\|price_locked"
```

Expected:
```
[Migration] Locked prices for 39 existing bookings
```

7. **Verify Admin Panel**:
- Open http://chata.utia.cas.cz/admin.html
- Navigate to "Nastavení systému"
- Verify labels show "Prázdný pokoj:" (not old labels)
- Test saving new prices

8. **Verify Frontend**:
- Open http://chata.utia.cas.cz
- Click on any room
- Verify per-room guest type dropdown appears
- Test price calculation updates when changing guest type

### Rollback Procedure

If issues occur:

1. **Restore Database Backup**:
```bash
docker exec marianska-chata cp /app/data/bookings.backup-YYYYMMDD.db /app/data/bookings.db
```

2. **Revert Code**:
```bash
git revert HEAD
docker-compose up --build -d
```

---

## Backward Compatibility

### Price Settings Compatibility

**Old Format** (still supported):
```json
{
  "utia": {
    "small": {
      "base": 300,
      "adult": 50,
      "child": 25
    }
  }
}
```

**New Format** (preferred):
```json
{
  "utia": {
    "small": {
      "empty": 250,
      "adult": 50,
      "child": 25
    }
  }
}
```

**Conversion Logic**:
```javascript
const emptyPrice = roomPriceConfig.empty !== undefined
  ? roomPriceConfig.empty
  : roomPriceConfig.base - roomPriceConfig.adult;
```

Result: Old format automatically converts to new formula without data migration.

---

## Example Price Calculations

### Example 1: Small Room, ÚTIA Employee, 2 Nights

**Configuration**:
- Empty room: 250 Kč
- Adult surcharge: 50 Kč
- Child surcharge: 25 Kč

**Booking**:
- Guests: 2 adults, 1 child, 1 toddler
- Nights: 2

**Calculation**:
```
Empty room: 250 Kč/night × 2 nights = 500 Kč
Adults: 2 × 50 Kč/night × 2 nights = 200 Kč
Children: 1 × 25 Kč/night × 2 nights = 50 Kč
Toddlers: 1 × 0 Kč (always free) = 0 Kč

Total: 500 + 200 + 50 + 0 = 750 Kč
```

### Example 2: Multi-Room with Mixed Guest Types

**Booking**:
- Room P12 (small): ÚTIA, 2 adults, 2 nights
- Room P13 (small): External, 2 adults, 1 child, 2 nights

**Calculation**:

**Room P12 (ÚTIA)**:
```
Empty: 250 × 2 = 500 Kč
Adults: 2 × 50 × 2 = 200 Kč
Subtotal: 700 Kč
```

**Room P13 (External)**:
```
Empty: 400 × 2 = 800 Kč
Adults: 2 × 100 × 2 = 400 Kč
Children: 1 × 50 × 2 = 100 Kč
Subtotal: 1300 Kč
```

**Total**: 700 + 1300 = **2000 Kč**

---

## Files Modified

### Database
- `/home/marianska/marianska/database.js` (lines 216-243)
  - Added `price_locked` column
  - Migration logic

### Backend
- `/home/marianska/marianska/server.js` (lines 1135-1190)
  - Price lock validation in PUT endpoint

### Shared Logic
- `/home/marianska/marianska/js/shared/priceCalculator.js` (lines 80-178)
  - Formula refactor
  - Per-room guest type support

### Admin Panel
- `/home/marianska/marianska/admin.html` (4 label changes)
- `/home/marianska/marianska/admin.js` (lines 2400-2524)
  - Load/save empty prices

### Frontend Booking
- `/home/marianska/marianska/index.html` (lines 1432-1481)
  - Per-room guest type dropdown
- `/home/marianska/marianska/js/booking-app.js` (lines 501-506, 561-588)
  - setRoomGuestType() method
- `/home/marianska/marianska/js/single-room-booking.js` (lines 177-179, 221-225)
  - Initialize and sync guest type
- `/home/marianska/marianska/js/booking-form.js` (lines 161-187)
  - Use per-room guest types in calculations

### Documentation
- `/home/marianska/marianska/docs/NEW_PRICING_MODEL_IMPLEMENTATION.md` (this file)
- `/home/marianska/marianska/docs/PRICING_MODEL_TEST_PLAN.md`

### Test Scripts
- `/home/marianska/marianska/verify-price-lock-quick.js`
- `/home/marianska/marianska/test-new-pricing-formula.js`

---

## Known Limitations

1. **Bulk Pricing**: Bulk pricing (all 9 rooms) already uses correct formula, no changes needed
2. **Price History**: Old booking prices are frozen but not documented historically
3. **UI Validation**: Frontend validation exists, but server-side validation is authoritative

---

## Future Enhancements

1. **Price History Tracking**: Log all price changes for audit trail
2. **Dynamic Pricing**: Seasonal/weekend pricing multipliers
3. **Discount Codes**: Promotional pricing support
4. **Price Breakdown Display**: Show per-guest breakdown in confirmation emails
5. **Admin Analytics**: Price trend analysis and revenue forecasting

---

## Support

### Common Issues

**Issue**: Old bookings show wrong prices after edit
**Solution**: Verify `price_locked = 1` in database. If not, run migration script.

**Issue**: New bookings calculate wrong price
**Solution**: Check admin panel price configuration. Verify `empty` field exists in settings.

**Issue**: Per-room guest type not saving
**Solution**: Check browser console for errors. Verify `roomGuests` Map is updated correctly.

### Contact

For technical questions:
- Developer: AI Assistant
- Documentation: `/home/marianska/marianska/docs/`
- Test Scripts: `/home/marianska/marianska/test-*.js`

---

## Changelog

### 2025-11-04 - Initial Implementation
- ✅ Database migration: Added `price_locked` column
- ✅ PriceCalculator refactor: New empty room formula
- ✅ Admin UI: Updated labels to "Prázdný pokoj"
- ✅ Frontend: Per-room guest type selection
- ✅ Server: Price lock validation
- ✅ Testing: All automated tests passing
- ✅ Documentation: Complete implementation guide

---

**Status**: ✅ PRODUCTION READY
**Deployment**: Pending stakeholder approval
**Breaking Changes**: Backward compatible with price locking
**Migration Required**: Automatic (on first server start)