// Single room booking module - handles individual room reservation modals
class SingleRoomBookingModule {
  constructor(app) {
    this.app = app;
    this.airbnbCalendar = null;
  }

  /**
   * Save selected date range to localStorage for prefilling next time
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   */
  saveLastSelectedDateRange(startDate, endDate) {
    try {
      const dateRange = {
        startDate,
        endDate,
        timestamp: Date.now(),
      };
      localStorage.setItem('lastSelectedDateRange', JSON.stringify(dateRange));
    } catch (error) {
      console.warn('Failed to save last selected date range:', error);
      // Non-critical error - continue without saving
    }
  }

  /**
   * Load last selected date range from localStorage
   * @returns {Object|null} - Object with startDate and endDate, or null if not found/invalid
   */
  loadLastSelectedDateRange() {
    try {
      const stored = localStorage.getItem('lastSelectedDateRange');
      if (!stored) {
        return null;
      }

      const dateRange = JSON.parse(stored);

      // Validate structure
      if (!dateRange.startDate || !dateRange.endDate || !dateRange.timestamp) {
        return null;
      }

      // Check if dates are in the past (don't prefill past dates)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(`${dateRange.startDate}T12:00:00`);

      if (startDate < today) {
        // Dates are in the past, clear them
        localStorage.removeItem('lastSelectedDateRange');
        return null;
      }

      // Optional: Check if dates are too old (e.g., > 30 days)
      const daysSinceStored = (Date.now() - dateRange.timestamp) / (1000 * 60 * 60 * 24);
      if (daysSinceStored > 30) {
        // Too old, clear
        localStorage.removeItem('lastSelectedDateRange');
        return null;
      }

      return {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      };
    } catch (error) {
      console.warn('Failed to load last selected date range:', error);
      return null;
    }
  }

  /**
   * Check if a date range is available for a specific room
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {string} roomId - Room ID to check
   * @returns {Promise<boolean>} - True if range is available, false otherwise
   */
  async isDateRangeAvailableForRoom(startDate, endDate, roomId) {
    try {
      // CRITICAL FIX 2025-10-17: Invalidate proposed bookings cache to ensure fresh data
      dataManager.invalidateProposedBookingsCache();

      const start = new Date(`${startDate}T12:00:00`);
      const end = new Date(`${endDate}T12:00:00`);
      const current = new Date(start);

      // Check each day in the range
      // eslint-disable-next-line no-unmodified-loop-condition -- current is modified inside loop body with setDate
      while (current <= end) {
        // CRITICAL FIX 2025-10-17: Pass empty string '' to NOT exclude any sessions
        // This ensures we check ALL proposed bookings (including own session)
        const availability = await dataManager.getRoomAvailability(current, roomId, '');

        // CRITICAL FIX 2025-10-17: Check for 'proposed' status too!
        // If any day is blocked, occupied, or already proposed, the range is not available
        if (
          availability.status === 'blocked' ||
          availability.status === 'occupied' ||
          availability.status === 'proposed'
        ) {
          return false;
        }

        current.setDate(current.getDate() + 1);
      }

      return true;
    } catch (error) {
      console.warn('Failed to check date range availability:', error);
      return false;
    }
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

    // Translate room name: "Pokoj 24" -> "Room 24" in English
    const roomName =
      this.app.currentLanguage === 'cs' ? room.name : room.name.replace('Pokoj', 'Room');
    modalTitle.textContent = `${this.app.currentLanguage === 'cs' ? 'Rezervace' : 'Book'} ${roomName}`;

    this.app.currentBookingRoom = roomId;
    this.app.selectedDates.clear();
    this.app.selectedRooms.clear();
    this.app.roomGuests.clear();
    this.app.roomGuestTypes.clear();

    // NEW 2025-10-17: Load last selected date range and prefill if available
    const lastDateRange = this.loadLastSelectedDateRange();
    if (lastDateRange) {
      // Validate that dates are still available for this room
      const isRangeAvailable = await this.isDateRangeAvailableForRoom(
        lastDateRange.startDate,
        lastDateRange.endDate,
        roomId
      );

      if (isRangeAvailable) {
        // Prefill the date range
        const start = new Date(`${lastDateRange.startDate}T12:00:00`);
        const end = new Date(`${lastDateRange.endDate}T12:00:00`);
        const current = new Date(start);

        // Add all dates in range to selectedDates
        // eslint-disable-next-line no-unmodified-loop-condition -- current is modified inside loop body with setDate
        while (current <= end) {
          const dateStr = DateUtils.formatDate(current);
          this.app.selectedDates.add(dateStr);
          current.setDate(current.getDate() + 1);
        }
      }
    }

    // Set default guest configuration - ensure it respects room capacity
    const defaultGuests = { adults: 1, children: 0, toddlers: 0 };

    // Validate against room capacity
    const totalGuests = defaultGuests.adults + defaultGuests.children;
    if (totalGuests > room.beds) {
      // Adjust to fit room capacity
      defaultGuests.children = 0;
      defaultGuests.adults = Math.min(1, room.beds);
    }

    this.app.roomGuests.set(roomId, defaultGuests);
    this.app.roomGuestTypes.set(roomId, 'utia');

    // Update display of guest counts
    const adultsEl = document.getElementById('singleRoomAdults');
    const childrenEl = document.getElementById('singleRoomChildren');
    const toddlersEl = document.getElementById('singleRoomToddlers');

    if (adultsEl) {
      adultsEl.textContent = defaultGuests.adults.toString();
    }
    if (childrenEl) {
      childrenEl.textContent = defaultGuests.children.toString();
    }
    if (toddlersEl) {
      toddlersEl.textContent = defaultGuests.toddlers.toString();
    }

    // Reset form - check if elements exist first
    const nameEl = document.getElementById('singleRoomName');
    const emailEl = document.getElementById('singleRoomEmail');
    const phoneEl = document.getElementById('singleRoomPhone');
    const notesEl = document.getElementById('singleRoomNotes');

    if (nameEl) {
      nameEl.value = '';
    }
    if (emailEl) {
      emailEl.value = '';
    }
    if (phoneEl) {
      phoneEl.value = '';
    }
    if (notesEl) {
      notesEl.value = '';
    }

    // Reset guest type radio buttons
    const utiaRadio = document.querySelector('input[name="singleRoomGuestType"][value="utia"]');
    if (utiaRadio) {
      utiaRadio.checked = true;
    }

    // Hide price breakdown initially since no dates are selected
    const priceBreakdownEl = document.getElementById('priceBreakdown');
    if (priceBreakdownEl) {
      priceBreakdownEl.style.display = 'none';
    }

    // Add active class first to make modal visible
    modal.classList.add('active');

    // Use BaseCalendar instead of old implementations
    await this.renderMiniCalendar(roomId);
    await this.app.updateSelectedDatesDisplay();
    await this.app.updatePriceCalculation();

    // Ensure room is selected for price calculation
    this.app.selectedRooms.add(roomId);
    await this.app.updatePriceCalculation();
  }

  async renderMiniCalendar(roomId) {
    // Initialize BaseCalendar if not exists
    if (!this.miniCalendar) {
      this.miniCalendar = new BaseCalendar({
        mode: BaseCalendar.MODES.SINGLE_ROOM,
        app: this.app,
        containerId: 'miniCalendar',
        roomId,
        allowPast: false,
        enforceContiguous: true,
        minNights: 2,
        onDateSelect: async () => {
          // Sync with app's selectedDates
          this.app.selectedDates = this.miniCalendar.selectedDates;
          await this.app.updateSelectedDatesDisplay();
          await this.app.updatePriceCalculation();
        },
        onDateDeselect: async () => {
          // Sync with app's selectedDates
          this.app.selectedDates = this.miniCalendar.selectedDates;
          await this.app.updateSelectedDatesDisplay();
          await this.app.updatePriceCalculation();
        },
      });
    }

    // Update roomId if changed
    this.miniCalendar.config.roomId = roomId;

    // Sync app's selectedDates with calendar's selectedDates
    this.miniCalendar.selectedDates = this.app.selectedDates;

    // Render calendar
    await this.miniCalendar.render();
  }

  navigateMiniCalendar(direction) {
    if (this.miniCalendar) {
      this.miniCalendar.navigateMonth(direction);
    }
  }

  hideRoomBookingModal() {
    const modal = document.getElementById('singleRoomBookingModal');
    modal.classList.remove('active');

    // Clean up
    this.app.currentBookingRoom = null;
    this.app.selectedDates.clear();
    this.app.isDragging = false;
    this.app.dragStartDate = null;
    this.app.dragEndDate = null;
  }

  async confirmRoomBooking() {
    // Validate that dates are selected
    if (this.app.selectedDates.size === 0) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs' ? 'Vyberte prosím termín pobytu' : 'Please select dates',
        'warning'
      );
      return;
    }

    // Validate minimum 2 days (1 night)
    if (this.app.selectedDates.size < 2) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Minimální rezervace je na 1 noc (2 dny)'
          : 'Minimum booking is for 1 night (2 days)',
        'warning'
      );
      return;
    }

    // Validate room is selected
    if (!this.app.currentBookingRoom) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Chyba: Žádný pokoj není vybrán'
          : 'Error: No room selected',
        'error'
      );
      return;
    }

    // Validate no blocked dates in selection
    const sortedDatesArray = Array.from(this.app.selectedDates).sort();
    for (const dateStr of sortedDatesArray) {
      const date = new Date(`${dateStr}T12:00:00`);
      const availability = await dataManager.getRoomAvailability(date, this.app.currentBookingRoom);

      if (availability.status === 'blocked') {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? 'Vybraný termín obsahuje blokované dny. Vyberte jiný termín.'
            : 'Selected dates include blocked days. Please choose different dates.',
          'error'
        );
        return;
      }
    }

    // Get guest configuration
    const guests = this.app.roomGuests.get(this.app.currentBookingRoom) || {
      adults: 1,
      children: 0,
      toddlers: 0,
    };

    // NEW 2025-10-17: Validate that there is at least 1 person (adult OR child)
    const totalGuests = (guests.adults || 0) + (guests.children || 0);
    if (totalGuests === 0) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Musíte zadat alespoň 1 osobu (dospělého nebo dítě) na pokoji'
          : 'You must specify at least 1 person (adult or child) in the room',
        'warning'
      );
      return;
    }

    // Get guest type
    const guestTypeInput = document.querySelector('input[name="singleRoomGuestType"]:checked');
    const guestType = guestTypeInput ? guestTypeInput.value : 'utia';

    // Get dates - use exactly what user selected
    const sortedDates = Array.from(this.app.selectedDates).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    // Calculate price
    const rooms = await dataManager.getRooms();
    const room = rooms.find((r) => r.id === this.app.currentBookingRoom);

    if (!room) {
      this.app.showNotification(langManager.t('roomNotFoundError'), 'error');
      return;
    }

    const nights = sortedDates.length - 1;
    const price = await dataManager.calculatePrice(
      guestType,
      guests.adults,
      guests.children,
      guests.toddlers,
      nights,
      [this.app.currentBookingRoom] // Pass room ID array for room-size-based pricing
    );

    // Create proposed booking in database
    try {
      const proposalId = await dataManager.createProposedBooking(
        startDate,
        endDate,
        [this.app.currentBookingRoom],
        guests,
        guestType,
        price
      );

      // CRITICAL FIX 2025-10-17: Save selected date range to localStorage AFTER successful creation
      // This ensures dates are only saved if the proposed booking was created successfully
      this.saveLastSelectedDateRange(startDate, endDate);

      // Create temporary booking object with proposal ID
      const tempBooking = {
        roomId: this.app.currentBookingRoom,
        roomName: room.name,
        startDate,
        endDate,
        nights,
        guests,
        guestType,
        totalPrice: price,
        // CRITICAL FIX 2025-10-07: Use IdGenerator (SSOT) for temp IDs
        id: `temp-${IdGenerator.generateToken(9)}`,
        proposalId, // Store the proposal ID for cleanup
      };

      // Add to a temporary reservations list
      if (!this.app.tempReservations) {
        this.app.tempReservations = [];
      }
      this.app.tempReservations.push(tempBooking);

      // Show success notification
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? `${room.name} přidán do rezervace`
          : `${room.name} added to reservation`,
        'success'
      );

      // Close the modal
      this.hideRoomBookingModal();

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
}
