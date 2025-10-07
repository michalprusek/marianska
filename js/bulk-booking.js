/* global IdGenerator */

// Bulk booking module - handles bulk event reservations
class BulkBookingModule {
  constructor(app) {
    this.app = app;
    this.bulkSelectedDates = new Set();
    this.bulkDragStart = null;
    this.bulkDragEnd = null;
    this.bulkIsDragging = false;
    this.bulkDragClickStart = null;
    this.airbnbCalendar = null;
  }

  async showBulkBookingModal() {
    const modal = document.getElementById('bulkBookingModal');

    // Reset state
    this.bulkSelectedDates.clear();
    this.bulkDragStart = null;
    this.bulkDragEnd = null;
    this.bulkIsDragging = false;

    // Reset form - use textContent for span elements, not value
    const bulkAdults = document.getElementById('bulkAdults');
    const bulkChildren = document.getElementById('bulkChildren');

    if (bulkAdults) {
      bulkAdults.textContent = '1';
    }
    if (bulkChildren) {
      bulkChildren.textContent = '0';
    }

    // Set up guest type change handler
    const guestTypeInputs = document.querySelectorAll('input[name="bulkGuestType"]');
    guestTypeInputs.forEach((input) => {
      input.addEventListener('change', () => {
        this.updateBulkPriceCalculation();
      });
    });

    // Reset guest type to external (default for bulk bookings)
    const externalRadio = document.querySelector('input[name="bulkGuestType"][value="external"]');
    if (externalRadio) {
      externalRadio.checked = true;
    }

    // Always use the bulk calendar (not Airbnb calendar)
    await this.renderBulkCalendar();
    this.updateBulkSelectedDatesDisplay();
    await this.updateBulkPriceCalculation();
    this.updateBulkCapacityCheck();

    modal.classList.add('active');
  }

  async renderBulkCalendar() {
    // Initialize BaseCalendar if not exists
    if (!this.bulkCalendar) {
      this.bulkCalendar = new BaseCalendar({
        mode: BaseCalendar.MODES.BULK,
        app: this.app,
        containerId: 'bulkCalendar',
        allowPast: false,
        enforceContiguous: true,
        minNights: 1,
        onDateSelect: async () => {
          // Sync with module's bulkSelectedDates
          this.bulkSelectedDates = this.bulkCalendar.selectedDates;
          this.updateBulkSelectedDatesDisplay();
          await this.updateBulkPriceCalculation();
          this.updateBulkCapacityCheck();
        },
        onDateDeselect: async () => {
          // Sync with module's bulkSelectedDates
          this.bulkSelectedDates = this.bulkCalendar.selectedDates;
          this.updateBulkSelectedDatesDisplay();
          await this.updateBulkPriceCalculation();
          this.updateBulkCapacityCheck();
        },
      });
    }

    // Sync module's bulkSelectedDates with calendar's selectedDates
    this.bulkCalendar.selectedDates = this.bulkSelectedDates;

    // Render calendar
    await this.bulkCalendar.render();
  }

  navigateBulkCalendar(direction) {
    if (this.bulkCalendar) {
      this.bulkCalendar.navigateMonth(direction);
    }
  }

  updateBulkSelectedDatesDisplay() {
    const display =
      document.getElementById('bulkSelectedDatesDisplay') ||
      document.getElementById('bulkDateSelectionSummary');
    const datesList =
      document.getElementById('bulkSelectedDatesList') ||
      document.getElementById('bulkSelectedDateRange');
    const confirmBtn =
      document.getElementById('confirmBulkDates') ||
      document.getElementById('confirmBulkBookingBtn');

    if (this.bulkSelectedDates.size === 0) {
      if (display) {
        display.style.display = 'none';
      }
      if (confirmBtn) {
        confirmBtn.disabled = true;
      }
      return;
    }

    if (display) {
      display.style.display = 'block';
    }

    // Calculate total nights (selected days - 1)
    const totalNights = Math.max(0, this.bulkSelectedDates.size - 1);

    // Enable/disable the confirm button based on nights
    if (confirmBtn) {
      confirmBtn.disabled = totalNights === 0;
    }

    const sortedDates = Array.from(this.bulkSelectedDates).sort();
    const ranges = this.app.getDateRanges(sortedDates);

    let html = '';
    ranges.forEach((range) => {
      const start = new Date(range.start);
      const end = new Date(range.end);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const nights = days - 1; // nights = days - 1

      if (range.start === range.end) {
        html += `<div class="selected-date-range">
                    <span>${this.app.formatDateDisplay(start)}</span>
                    <span class="nights-count">0 ${this.app.currentLanguage === 'cs' ? 'nocí' : 'nights'}</span>
                </div>`;
      } else {
        // Determine the correct plural form
        let nightsLabel = 'nights';
        if (this.app.currentLanguage === 'cs') {
          if (nights === 1) {
            nightsLabel = 'noc';
          } else if (nights < 5) {
            nightsLabel = 'noci';
          } else {
            nightsLabel = 'nocí';
          }
        } else if (nights === 1) {
          nightsLabel = 'night';
        }

        html += `<div class="selected-date-range">
                    <span>${this.app.formatDateDisplay(start)} - ${this.app.formatDateDisplay(end)}</span>
                    <span class="nights-count">${nights} ${nightsLabel}</span>
                </div>`;
      }
    });

    if (datesList) {
      if (datesList.tagName === 'DIV') {
        datesList.innerHTML = html;
      } else {
        // For single elements like bulkSelectedDateRange, show just the first range
        const firstRange = ranges[0];
        if (firstRange) {
          const start = new Date(firstRange.start);
          const end = new Date(firstRange.end);
          if (firstRange.start === firstRange.end) {
            datesList.textContent = this.app.formatDateDisplay(start);
          } else {
            datesList.textContent = `${this.app.formatDateDisplay(start)} - ${this.app.formatDateDisplay(end)}`;
          }
        }
      }
    }
  }

  async updateBulkPriceCalculation() {
    const sortedDates = Array.from(this.bulkSelectedDates).sort();
    if (sortedDates.length === 0) {
      // Clear price display when no dates selected
      const priceDisplay = document.getElementById('bulkTotalPrice');
      if (priceDisplay) {
        priceDisplay.textContent = '0 Kč';
      }
      const nightsDisplay = document.getElementById('bulkNightsCount');
      if (nightsDisplay) {
        nightsDisplay.textContent = '0';
      }
      const nightsMultiplier = document.getElementById('bulkNightsMultiplier');
      if (nightsMultiplier) {
        nightsMultiplier.textContent = '× 0';
      }
      const basePriceEl = document.getElementById('bulkBasePrice');
      if (basePriceEl) {
        basePriceEl.textContent = '0 Kč/noc';
      }
      const perNightTotal = document.getElementById('bulkPricePerNightAmount');
      if (perNightTotal) {
        perNightTotal.textContent = '0 Kč';
      }
      const adultsEl = document.getElementById('bulkAdultsSurcharge');
      if (adultsEl) {
        adultsEl.textContent = '0 Kč/noc';
      }
      const childrenEl = document.getElementById('bulkChildrenSurcharge');
      if (childrenEl) {
        childrenEl.textContent = '0 Kč/noc';
      }
      return;
    }

    // Calculate nights as selected days - 1
    const nights = Math.max(0, sortedDates.length - 1);
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent, 10) || 1;
    const children = parseInt(document.getElementById('bulkChildren')?.textContent, 10) || 0;

    // Get guest type from radio buttons
    const guestTypeInput = document.querySelector('input[name="bulkGuestType"]:checked');
    const guestType = guestTypeInput ? guestTypeInput.value : 'external';

    // Get pricing settings from admin configuration
    const settings = await dataManager.getSettings();

    // Default bulk prices if not configured
    const defaultBulkPrices = {
      basePrice: 2000,
      utiaAdult: 100,
      utiaChild: 0,
      externalAdult: 250,
      externalChild: 50,
    };

    // Get bulk price configuration
    const bulkPrices = settings.bulkPrices || defaultBulkPrices;

    // For bulk booking - use flat base price for entire chalet
    const totalBasePricePerNight = bulkPrices.basePrice;

    // Calculate guest surcharges based on guest type
    const guestKey = guestType === 'utia' ? 'utia' : 'external';
    const adultSurcharge = adults * bulkPrices[`${guestKey}Adult`];
    const childrenSurcharge = children * bulkPrices[`${guestKey}Child`];

    // Calculate total
    const pricePerNight = totalBasePricePerNight + adultSurcharge + childrenSurcharge;
    const totalPrice = pricePerNight * nights;

    // Update display elements
    const basePriceEl = document.getElementById('bulkBasePrice');
    if (basePriceEl) {
      basePriceEl.textContent = `${totalBasePricePerNight.toLocaleString('cs-CZ')} Kč/noc`;
    }

    const adultsEl = document.getElementById('bulkAdultsSurcharge');
    if (adultsEl) {
      if (adults > 0 && adultSurcharge > 0) {
        adultsEl.textContent = `+${adultSurcharge.toLocaleString('cs-CZ')} Kč/noc`;
        adultsEl.parentElement.style.display = 'flex';
      } else {
        adultsEl.parentElement.style.display = 'none';
      }
    }

    const childrenEl = document.getElementById('bulkChildrenSurcharge');
    if (childrenEl) {
      if (children > 0 && childrenSurcharge > 0) {
        childrenEl.textContent = `+${childrenSurcharge.toLocaleString('cs-CZ')} Kč/noc`;
        childrenEl.parentElement.style.display = 'flex';
      } else {
        childrenEl.parentElement.style.display = 'none';
      }
    }

    // Update per night total
    const perNightTotal = document.getElementById('bulkPricePerNightAmount');
    if (perNightTotal) {
      perNightTotal.textContent = `${pricePerNight.toLocaleString('cs-CZ')} Kč`;
    }

    const nightsMultiplier = document.getElementById('bulkNightsMultiplier');
    if (nightsMultiplier) {
      nightsMultiplier.textContent = `× ${nights}`;
    }

    const priceDisplay = document.getElementById('bulkTotalPrice');
    if (priceDisplay) {
      priceDisplay.textContent = `${totalPrice.toLocaleString('cs-CZ')} Kč`;
    }

    const nightsDisplay = document.getElementById('bulkNightsCount');
    if (nightsDisplay) {
      nightsDisplay.textContent = nights;
    }
  }

  updateBulkCapacityCheck() {
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent, 10) || 0;
    const children = parseInt(document.getElementById('bulkChildren')?.textContent, 10) || 0;
    const totalGuests = adults + children;

    const capacityWarning = document.getElementById('bulkCapacityWarning');
    const confirmBtn = document.getElementById('confirmBulkBooking');

    if (totalGuests > 26) {
      if (capacityWarning) {
        capacityWarning.style.display = 'block';
      }
      if (confirmBtn) {
        confirmBtn.disabled = true;
      }
    } else {
      if (capacityWarning) {
        capacityWarning.style.display = 'none';
      }
      if (confirmBtn && this.bulkSelectedDates.size > 0) {
        confirmBtn.disabled = false;
      }
    }
  }

  adjustBulkGuests(type, change) {
    const element = document.getElementById(`bulk${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (!element) {
      return;
    }

    let value = parseInt(element.textContent, 10) || 0;
    value = Math.max(0, value + change);

    if (type === 'adults') {
      value = Math.max(1, value);
    }

    element.textContent = value;
    this.updateBulkCapacityCheck();
    this.updateBulkPriceCalculation();
  }

  hideBulkBookingModal() {
    const modal = document.getElementById('bulkBookingModal');
    modal.classList.remove('active');

    // Clean up
    this.bulkSelectedDates.clear();
    this.bulkDragStart = null;
    this.bulkDragEnd = null;
    this.bulkIsDragging = false;
  }

  async confirmBulkDates() {
    // Validate minimum selection
    if (this.bulkSelectedDates.size === 0) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs' ? 'Vyberte prosím termín pobytu' : 'Please select dates',
        'warning'
      );
      return;
    }

    // Validate minimum 2 days (1 night)
    if (this.bulkSelectedDates.size < 2) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Minimální rezervace je na 1 noc (2 dny)'
          : 'Minimum booking is for 1 night (2 days)',
        'warning'
      );
      return;
    }

    // Check Christmas period restrictions for bulk bookings
    const sortedDatesArray = Array.from(this.bulkSelectedDates).sort();

    // Optimize: Check all dates in parallel instead of sequentially
    const christmasChecks = await Promise.all(
      sortedDatesArray.map((dateStr) => dataManager.isChristmasPeriod(new Date(dateStr)))
    );
    const isChristmasPeriod = christmasChecks.some(Boolean);

    let christmasPeriodStart = null;
    if (isChristmasPeriod) {
      const settings = await dataManager.getSettings();
      christmasPeriodStart = settings.christmasPeriod?.start;
    }

    if (isChristmasPeriod && christmasPeriodStart) {
      const { bulkBlocked } = dataManager.checkChristmasAccessRequirement(
        christmasPeriodStart,
        true // isBulkBooking
      );

      if (bulkBlocked) {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? 'Hromadné rezervace celé chaty nejsou po 1. říjnu povoleny pro vánoční období. Rezervujte jednotlivé pokoje.'
            : 'Bulk bookings are not allowed after October 1st for Christmas period. Please book individual rooms.',
          'error'
        );
        return;
      }
    }

    // Validate no blocked dates in selection for any room
    const rooms = await dataManager.getRooms();

    for (const dateStr of sortedDatesArray) {
      const date = new Date(`${dateStr}T12:00:00`);

      // Check each room for this date
      for (const room of rooms) {
        const availability = await dataManager.getRoomAvailability(date, room.id);

        if (availability.status === 'blocked') {
          this.app.showNotification(
            this.app.currentLanguage === 'cs'
              ? `Pokoj ${room.name} je blokován dne ${dateStr}. Pro hromadnou rezervaci musí být všechny pokoje volné.`
              : `Room ${room.name} is blocked on ${dateStr}. All rooms must be available for bulk booking.`,
            'error'
          );
          return;
        }
      }
    }

    // Get guest configuration
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent, 10) || 1;
    const children = parseInt(document.getElementById('bulkChildren')?.textContent, 10) || 0;

    // Get guest type
    const guestTypeInput = document.querySelector('input[name="bulkGuestType"]:checked');
    const guestType = guestTypeInput ? guestTypeInput.value : 'external';

    // Get dates - use exactly what user selected
    const sortedDates = Array.from(this.bulkSelectedDates).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];
    const nights = sortedDates.length - 1;

    // Get all rooms for bulk booking
    const allRooms = await dataManager.getRooms();
    const roomIds = allRooms.map((r) => r.id);

    // Calculate price using bulk pricing
    const settings = await dataManager.getSettings();
    const defaultBulkPrices = {
      basePrice: 2000,
      utiaAdult: 100,
      utiaChild: 0,
      externalAdult: 250,
      externalChild: 50,
    };
    const bulkPrices = settings.bulkPrices || defaultBulkPrices;
    const priceGuestKey = guestType === 'utia' ? 'utia' : 'external';
    const pricePerNight =
      bulkPrices.basePrice +
      adults * bulkPrices[`${priceGuestKey}Adult`] +
      children * bulkPrices[`${priceGuestKey}Child`];
    const totalPrice = pricePerNight * nights;

    // Create proposed booking in database for all rooms
    try {
      const proposalId = await dataManager.createProposedBooking(
        startDate,
        endDate,
        roomIds,
        { adults, children, toddlers: 0 },
        guestType,
        totalPrice
      );

      // Create temporary bulk booking object with proposal ID
      const tempBulkBooking = {
        isBulkBooking: true,
        roomIds,
        roomNames: allRooms.map((r) => r.name).join(', '),
        startDate,
        endDate,
        nights,
        guests: { adults, children, toddlers: 0 },
        guestType,
        totalPrice,
        // CRITICAL FIX 2025-10-07: Use IdGenerator (SSOT) for temp IDs
        id: `temp-bulk-${IdGenerator.generateToken(9)}`,
        proposalId, // Store the proposal ID for cleanup
      };

      // Store the bulk booking temporarily
      if (!this.app.tempReservations) {
        this.app.tempReservations = [];
      }

      // Clear any existing temp reservations for bulk booking
      this.app.tempReservations = this.app.tempReservations.filter((r) => !r.isBulkBooking);

      // Add the new bulk booking
      this.app.tempReservations.push(tempBulkBooking);

      // Close the bulk modal
      this.hideBulkBookingModal();

      // Show success notification
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? `Hromadná rezervace přidána do seznamu rezervací`
          : `Bulk booking added to reservation list`,
        'success'
      );

      // Update the main page to show temporary reservations (also refreshes calendar)
      await this.app.displayTempReservations();

      // Show the finalize button
      const finalizeDiv = document.getElementById('finalizeReservationsDiv');
      if (finalizeDiv && this.app.tempReservations.length > 0) {
        finalizeDiv.style.display = 'block';
      }
    } catch (error) {
      console.error('Failed to create proposed booking:', error);
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Chyba při vytváření dočasné rezervace'
          : 'Error creating temporary reservation',
        'error'
      );
    }
  }

  backToBulkDateSelection() {
    // Not used in current HTML structure
  }

  async submitBulkBooking() {
    // For now, use dummy data since the current HTML doesn't have the form fields
    // In the future, these should be actual form inputs
    const name = 'Bulk Booking';
    const email = 'bulk@example.com';
    const phone = '+420123456789';
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent, 10) || 1;
    const children = parseInt(document.getElementById('bulkChildren')?.textContent, 10) || 0;
    const notes = 'Hromadná rezervace všech pokojů';

    // Validate
    if (!name || !email || !phone) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Vyplňte prosím všechna povinná pole'
          : 'Please fill in all required fields',
        'error'
      );
      return;
    }

    // Get all rooms for bulk booking (reuse from above scope if possible)
    const allRoomsForBooking = await dataManager.getRooms();
    const roomIds = allRoomsForBooking.map((r) => r.id);

    // Get date range
    const sortedDates = Array.from(this.bulkSelectedDates).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    // Christmas validation already performed in confirmBulkDates() - no need to duplicate
    // (uses ChristmasUtils.checkChristmasAccessRequirement for consistent logic)

    // Create booking
    const booking = {
      name,
      email,
      phone,
      startDate,
      endDate,
      rooms: roomIds,
      guestType: 'external', // Bulk bookings are external
      adults,
      children,
      toddlers: 0, // Bulk bookings don't track toddlers separately
      notes:
        notes || `${this.app.currentLanguage === 'cs' ? 'Hromadná rezervace' : 'Bulk booking'}`,
      isBulkBooking: true,
      sessionId: this.app.sessionId, // Include sessionId to exclude user's own proposals
    };

    try {
      await dataManager.createBooking(booking);

      this.hideBulkBookingModal();

      // Show success and refresh
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? '✓ Hromadná rezervace byla úspěšně vytvořena'
          : '✓ Bulk booking created successfully',
        'success'
      );

      await this.app.renderCalendar();
    } catch (error) {
      console.error('Bulk booking error:', error);
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Chyba při vytváření rezervace'
          : 'Error creating booking',
        'error'
      );
    }
  }
}

// Global functions for HTML onclick events
window.adjustBulkGuests = function (type, change) {
  if (window.app && window.app.bulkBooking) {
    window.app.bulkBooking.adjustBulkGuests(type, change);
  }
};

window.closeBulkModal = function () {
  if (window.app && window.app.bulkBooking) {
    window.app.bulkBooking.hideBulkBookingModal();
  }
};

window.addBulkBooking = async function () {
  if (window.app && window.app.bulkBooking) {
    await window.app.bulkBooking.confirmBulkDates();
  }
};
