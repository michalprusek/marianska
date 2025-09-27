// Integration examples for AirbnbCalendarModule with existing booking modules

/**
 * Example 1: Integration with SingleRoomBookingModule
 * This shows how to replace the existing mini-calendar with Airbnb-style selection
 */
class AirbnbSingleRoomIntegration {
  constructor(app) {
    this.app = app;
    this.airbnbCalendar = new AirbnbCalendarModule(app);
    this.currentRoomId = null;
  }

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
    this.currentRoomId = roomId;

    // Reset form data
    this.resetForm();

    // Initialize Airbnb calendar instead of mini calendar
    await this.airbnbCalendar.initCalendar('miniCalendar', roomId, 'single');

    // Set up event listeners
    this.setupEventListeners();

    modal.classList.add('active');
  }

  setupEventListeners() {
    // Listen for date selection events
    this.airbnbCalendar.addEventListener('check-in-selected', (event) => {
      const { checkIn } = event.detail;

      // Update form display
      this.updateSelectedDatesDisplay();
    });

    this.airbnbCalendar.addEventListener('dates-selected', async (event) => {
      const { checkIn, checkOut, nights } = event.detail;

      // Update the app's selected dates
      this.app.selectedDates.clear();
      const current = new Date(checkIn);
      const endDate = new Date(checkOut);

      while (current < endDate) {
        this.app.selectedDates.add(dataManager.formatDate(current));
        current.setDate(current.getDate() + 1);
      }

      // Update UI
      await this.updateSelectedDatesDisplay();
      await this.updatePriceCalculation();
    });

    this.airbnbCalendar.addEventListener('selection-cleared', () => {
      this.app.selectedDates.clear();
      this.updateSelectedDatesDisplay();
      this.updatePriceCalculation();
    });
  }

  async updateSelectedDatesDisplay() {
    const selectedDates = this.airbnbCalendar.getSelectedDates();
    const container = document.getElementById('selectedDatesDisplay');

    if (!container) return;

    if (selectedDates.checkIn && selectedDates.checkOut) {
      const checkInDate = new Date(selectedDates.checkIn);
      const checkOutDate = new Date(selectedDates.checkOut);

      container.innerHTML = `
        <div class="selected-dates-summary">
          <h4>${this.app.currentLanguage === 'cs' ? 'Vybrané datum' : 'Selected Dates'}</h4>
          <p><strong>${this.app.currentLanguage === 'cs' ? 'Příjezd:' : 'Check-in:'}</strong> ${checkInDate.toLocaleDateString()}</p>
          <p><strong>${this.app.currentLanguage === 'cs' ? 'Odjezd:' : 'Check-out:'}</strong> ${checkOutDate.toLocaleDateString()}</p>
          <p><strong>${this.app.currentLanguage === 'cs' ? 'Nocí:' : 'Nights:'}</strong> ${selectedDates.nights}</p>
        </div>
      `;
    } else if (selectedDates.checkIn) {
      container.innerHTML = `
        <div class="selected-dates-summary">
          <h4>${this.app.currentLanguage === 'cs' ? 'Vyberte datum odjezdu' : 'Select checkout date'}</h4>
          <p><strong>${this.app.currentLanguage === 'cs' ? 'Příjezd:' : 'Check-in:'}</strong> ${new Date(selectedDates.checkIn).toLocaleDateString()}</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="selected-dates-summary">
          <p>${this.app.currentLanguage === 'cs' ? 'Vyberte datum příjezdu' : 'Select check-in date'}</p>
        </div>
      `;
    }
  }

  async updatePriceCalculation() {
    const selectedDates = this.airbnbCalendar.getSelectedDates();
    const priceContainer = document.getElementById('priceCalculation');

    if (!priceContainer || !selectedDates.checkIn || !selectedDates.checkOut) {
      if (priceContainer) priceContainer.innerHTML = '';
      return;
    }

    // Get guest configuration
    const guestType = this.app.roomGuestTypes.get(this.currentRoomId) || 'utia';
    const guests = this.app.roomGuests.get(this.currentRoomId) || {
      adults: 1,
      children: 0,
      toddlers: 0,
    };

    // Calculate price
    const totalPrice = await dataManager.calculatePrice(
      guestType,
      guests.adults,
      guests.children,
      guests.toddlers,
      selectedDates.nights,
      1 // single room
    );

    priceContainer.innerHTML = `
      <div class="price-summary">
        <h4>${this.app.currentLanguage === 'cs' ? 'Cena' : 'Price'}</h4>
        <p>${selectedDates.nights} ${this.app.currentLanguage === 'cs' ? 'nocí' : 'nights'} × ${this.currentRoomId}</p>
        <p><strong>${this.app.currentLanguage === 'cs' ? 'Celkem:' : 'Total:'} ${totalPrice} Kč</strong></p>
      </div>
    `;
  }

  resetForm() {
    // Reset form fields and configurations
    this.app.selectedDates.clear();
    this.app.roomGuests.set(this.currentRoomId, { adults: 1, children: 0, toddlers: 0 });
    this.app.roomGuestTypes.set(this.currentRoomId, 'utia');
  }
}

/**
 * Example 2: Integration with BulkBookingModule
 * This shows how to use Airbnb calendar for bulk room selection
 */
class AirbnbBulkBookingIntegration {
  constructor(app) {
    this.app = app;
    this.airbnbCalendar = new AirbnbCalendarModule(app);
  }

  async showBulkBookingModal() {
    const modal = document.getElementById('bulkBookingModal');

    // Initialize Airbnb calendar for bulk booking
    await this.airbnbCalendar.initCalendar('bulkCalendar', null, 'bulk');

    // Set up event listeners
    this.setupBulkEventListeners();

    modal.classList.add('active');
  }

  setupBulkEventListeners() {
    this.airbnbCalendar.addEventListener('dates-selected', async (event) => {
      const { checkIn, checkOut, nights } = event.detail;

      // Update the global selected dates
      this.updateGlobalSelectedDates(checkIn, checkOut);

      // Trigger room selection update
      await this.updateAvailableRooms(checkIn, checkOut);

      // Update price calculation
      await this.updateBulkPriceCalculation(nights);
    });

    this.airbnbCalendar.addEventListener('selection-cleared', () => {
      this.app.selectedDates.clear();
      this.app.selectedRooms.clear();
      this.updateRoomSelection();
      this.updateBulkPriceCalculation(0);
    });
  }

  updateGlobalSelectedDates(checkIn, checkOut) {
    this.app.selectedDates.clear();
    const current = new Date(checkIn);
    const endDate = new Date(checkOut);

    while (current < endDate) {
      this.app.selectedDates.add(dataManager.formatDate(current));
      current.setDate(current.getDate() + 1);
    }
  }

  async updateAvailableRooms(checkIn, checkOut) {
    const rooms = await dataManager.getRooms();
    const roomContainer = document.getElementById('roomSelectionContainer');

    if (!roomContainer) return;

    roomContainer.innerHTML = '';

    for (const room of rooms) {
      const isAvailable = await this.checkRoomAvailabilityForRange(room.id, checkIn, checkOut);

      const roomElement = document.createElement('div');
      roomElement.className = `room-option ${isAvailable ? 'available' : 'unavailable'}`;
      roomElement.innerHTML = `
        <div class="room-info">
          <h4>${room.name}</h4>
          <p>${room.beds} ${this.app.currentLanguage === 'cs' ? 'lůžek' : 'beds'}</p>
        </div>
        <div class="room-status">
          ${
            isAvailable
              ? `<button class="btn btn-outline" onclick="this.toggleRoomSelection('${room.id}')">${this.app.currentLanguage === 'cs' ? 'Vybrat' : 'Select'}</button>`
              : `<span class="unavailable-text">${this.app.currentLanguage === 'cs' ? 'Nedostupný' : 'Unavailable'}</span>`
          }
        </div>
      `;

      roomContainer.appendChild(roomElement);
    }
  }

  async checkRoomAvailabilityForRange(roomId, checkIn, checkOut) {
    const current = new Date(checkIn);
    const endDate = new Date(checkOut);

    while (current < endDate) {
      const availability = await dataManager.getRoomAvailability(current, roomId);
      if (availability.status !== 'available') {
        return false;
      }
      current.setDate(current.getDate() + 1);
    }

    return true;
  }

  async updateBulkPriceCalculation(nights) {
    const priceContainer = document.getElementById('bulkPriceCalculation');

    if (!priceContainer || nights === 0 || this.app.selectedRooms.size === 0) {
      if (priceContainer) priceContainer.innerHTML = '';
      return;
    }

    let totalPrice = 0;
    const guestType = this.app.bulkGuestType || 'utia';

    for (const roomId of this.app.selectedRooms) {
      const guests = this.app.roomGuests.get(roomId) || { adults: 1, children: 0, toddlers: 0 };
      const roomPrice = await dataManager.calculatePrice(
        guestType,
        guests.adults,
        guests.children,
        guests.toddlers,
        nights,
        1
      );
      totalPrice += roomPrice;
    }

    priceContainer.innerHTML = `
      <div class="bulk-price-summary">
        <h4>${this.app.currentLanguage === 'cs' ? 'Celková cena' : 'Total Price'}</h4>
        <p>${this.app.selectedRooms.size} ${this.app.currentLanguage === 'cs' ? 'pokojů' : 'rooms'} × ${nights} ${this.app.currentLanguage === 'cs' ? 'nocí' : 'nights'}</p>
        <p><strong>${totalPrice} Kč</strong></p>
      </div>
    `;
  }
}

/**
 * Example 3: Standalone Airbnb Calendar Usage
 * This shows how to use the calendar as a standalone component
 */
class StandaloneAirbnbCalendarExample {
  constructor() {
    this.calendar = null;
  }

  async initStandaloneCalendar(containerId) {
    // Create a minimal app-like object for the calendar
    const mockApp = {
      currentMonth: new Date(),
      today: new Date(),
      minYear: new Date().getFullYear(),
      maxYear: new Date().getFullYear() + 1,
      maxMonth: 11,
      currentLanguage: 'cs',
    };

    this.calendar = new AirbnbCalendarModule(mockApp);
    await this.calendar.initCalendar(containerId, null, 'single');

    // Set up event listeners
    this.calendar.addEventListener('dates-selected', (event) => {
      const { checkIn, checkOut, nights } = event.detail;

      // Handle the selection...
      this.handleDateSelection(checkIn, checkOut, nights);
    });

    this.calendar.addEventListener('check-in-selected', (event) => {
      const { checkIn } = event.detail;
    });
  }

  handleDateSelection(checkIn, checkOut, nights) {
    // Custom logic for handling date selection
    const summary = document.getElementById('dateSummary');
    if (summary) {
      summary.innerHTML = `
        <h3>Selected Dates</h3>
        <p>Check-in: ${new Date(checkIn).toLocaleDateString()}</p>
        <p>Check-out: ${new Date(checkOut).toLocaleDateString()}</p>
        <p>Nights: ${nights}</p>
      `;
    }
  }

  // Programmatically set dates
  async setDates(checkIn, checkOut) {
    if (this.calendar) {
      await this.calendar.setSelectedDates(checkIn, checkOut);
    }
  }

  // Clear selection
  clearDates() {
    if (this.calendar) {
      this.calendar.clearSelection();
    }
  }

  // Get current selection
  getSelection() {
    return this.calendar ? this.calendar.getSelectedDates() : null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AirbnbSingleRoomIntegration,
    AirbnbBulkBookingIntegration,
    StandaloneAirbnbCalendarExample,
  };
}
