# Airbnb Calendar Integration Guide

This guide shows how to integrate the new `AirbnbCalendarModule` with the existing reservation system.

## Files Created

1. **`/js/airbnb-calendar.js`** - The main Airbnb-style calendar module
2. **`/js/airbnb-integration-example.js`** - Integration examples and helper classes
3. **This guide** - Step-by-step integration instructions

## Integration Options

### Option 1: Replace Existing Mini Calendar (Single Room Booking)

To replace the existing mini calendar in single room booking modals:

**Step 1: Include the scripts in your HTML**

Add these script tags to `index.html` before the closing `</body>` tag:

```html
<script src="js/airbnb-calendar.js"></script>
<script src="js/airbnb-integration-example.js"></script>
```

**Step 2: Modify the SingleRoomBookingModule**

Replace the existing `showRoomBookingModal` method in `js/single-room-booking.js`:

```javascript
// Replace the existing method with this enhanced version
async showRoomBookingModal(roomId) {
  // Initialize Airbnb calendar integration
  if (!this.airbnbIntegration) {
    this.airbnbIntegration = new AirbnbSingleRoomIntegration(this.app);
  }

  await this.airbnbIntegration.showRoomBookingModal(roomId);
}
```

**Step 3: Update HTML structure**

In your modal HTML, ensure the mini calendar container has the correct ID:

```html
<div
  id="miniCalendar"
  class="mini-calendar"
></div>
<div id="selectedDatesDisplay"></div>
<div id="priceCalculation"></div>
```

### Option 2: Use for Bulk Booking

To integrate with bulk booking:

**Step 1: Modify the BulkBookingModule**

Add this to `js/bulk-booking.js`:

```javascript
async showBulkBookingModal() {
  // Initialize Airbnb calendar integration
  if (!this.airbnbIntegration) {
    this.airbnbIntegration = new AirbnbBulkBookingIntegration(this.app);
  }

  await this.airbnbIntegration.showBulkBookingModal();
}
```

**Step 2: Update HTML structure**

```html
<div
  id="bulkCalendar"
  class="bulk-calendar"
></div>
<div id="roomSelectionContainer"></div>
<div id="bulkPriceCalculation"></div>
```

### Option 3: Standalone Implementation

For a completely custom implementation:

```javascript
// Create a standalone calendar
const calendar = new AirbnbCalendarModule({
  currentMonth: new Date(),
  today: new Date(),
  minYear: new Date().getFullYear(),
  maxYear: new Date().getFullYear() + 1,
  maxMonth: 11,
  currentLanguage: 'cs',
});

// Initialize
await calendar.initCalendar('myCalendarContainer', null, 'single');

// Listen for events
calendar.addEventListener('dates-selected', (event) => {
  const { checkIn, checkOut, nights } = event.detail;
  console.log('Selected:', { checkIn, checkOut, nights });
});
```

## Key Features

### 1. Date Selection Logic

- **First click**: Sets check-in date
- **Second click**: Sets check-out date
- **Click on check-in date**: Clears selection
- **Second click before first**: Automatically swaps dates
- **Minimum 1 night stay**: Enforced automatically

### 2. Visual Features

- **Check-in/Check-out highlighting**: Different colors for start and end dates
- **Range display**: Shows selected range between dates
- **Hover effects**: Preview potential selection while hovering
- **Date labels**: Shows "Check-in" and "Check-out" labels with dates
- **Christmas indicators**: 🎄 icon for Christmas period dates
- **Availability status**: Different colors for available/booked/blocked dates

### 3. Integration Events

The calendar emits these events:

```javascript
// When check-in date is selected
calendar.addEventListener('check-in-selected', (event) => {
  const { checkIn } = event.detail;
  // Handle check-in selection
});

// When both dates are selected
calendar.addEventListener('dates-selected', (event) => {
  const { checkIn, checkOut, nights } = event.detail;
  // Handle complete selection
});

// When selection is cleared
calendar.addEventListener('selection-cleared', () => {
  // Handle cleared selection
});

// When calendar is initialized
calendar.addEventListener('calendar-initialized', (event) => {
  const { mode, roomId, containerId } = event.detail;
  // Handle initialization
});
```

### 4. API Methods

```javascript
// Get current selection
const selection = calendar.getSelectedDates();
// Returns: { checkIn, checkOut, isSelecting, nights }

// Set dates programmatically
await calendar.setSelectedDates('2024-03-15', '2024-03-17');

// Clear selection
calendar.clearSelection();

// Update date range
await calendar.updateDateRange('2024-03-15', '2024-03-17');

// Destroy calendar
calendar.destroy();
```

## CSS Customization

The calendar includes comprehensive CSS styling. You can customize colors by overriding these CSS variables:

```css
.airbnb-calendar {
  --primary-color: #ff385c;
  --hover-color: #f7f7f7;
  --border-color: #e0e0e0;
  --text-color: #222;
  --disabled-color: #ccc;
}
```

## Room Availability Integration

The calendar automatically integrates with the existing `dataManager` for:

- **Single room mode**: Checks availability for the specific room
- **Bulk mode**: Checks if at least one room is available
- **Christmas period detection**: Uses existing `isChristmasPeriod()` method
- **Blocked dates**: Respects existing blocking system

## Compatibility

The calendar is fully compatible with:

- ✅ Existing `dataManager` API
- ✅ Christmas period restrictions
- ✅ Room availability checking
- ✅ Multi-language support (Czech/English)
- ✅ Mobile responsive design
- ✅ Existing booking flow
- ✅ Price calculation system

## Migration Notes

If migrating from the existing calendar:

1. **Date format**: Uses the same `YYYY-MM-DD` format as existing system
2. **Event integration**: Emits events that can be used to update existing UI
3. **Validation**: Maintains all existing business rules
4. **Data structure**: Compatible with existing booking data structure

## Example Usage in Existing System

Here's how to modify your existing `showRoomBookingModal` in `single-room-booking.js`:

```javascript
async showRoomBookingModal(roomId) {
  const modal = document.getElementById('singleRoomBookingModal');
  const modalTitle = document.getElementById('roomBookingTitle');

  const rooms = await dataManager.getRooms();
  const room = rooms.find((r) => r.id === roomId);

  if (!room) {
    console.error('Room not found:', roomId);
    return;
  }

  modalTitle.textContent = `${this.app.currentLanguage === 'cs' ? 'Rezervace' : 'Book'} ${room.name}`;

  // Initialize Airbnb calendar
  if (!this.airbnbCalendar) {
    this.airbnbCalendar = new AirbnbCalendarModule(this.app);
  }

  await this.airbnbCalendar.initCalendar('miniCalendar', roomId, 'single');

  // Set up event listeners
  this.airbnbCalendar.addEventListener('dates-selected', async (event) => {
    const { checkIn, checkOut, nights } = event.detail;

    // Update app state
    this.app.selectedDates.clear();
    const current = new Date(checkIn);
    const endDate = new Date(checkOut);

    while (current < endDate) {
      this.app.selectedDates.add(dataManager.formatDate(current));
      current.setDate(current.getDate() + 1);
    }

    // Update UI
    await this.app.updateSelectedDatesDisplay();
    await this.app.updatePriceCalculation();
  });

  modal.classList.add('active');
}
```

This integration maintains full compatibility with your existing system while providing the enhanced Airbnb-style user experience.
