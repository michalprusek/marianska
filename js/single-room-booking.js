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

    // FIX 2025-12-04: Invalidate proposed bookings cache to ensure fresh data
    // This prevents stale cache from hiding user's own proposed bookings
    dataManager.invalidateProposedBookingsCache();

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

    // NEW 2025-11-04: Add default guest type to guests object
    defaultGuests.guestType = 'external'; // Default to External guest
    this.app.roomGuests.set(roomId, defaultGuests);

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

    // CLEAR guest names containers to prevent pre-filling from previous reservation
    // This ensures dates are pre-filled from localStorage, but guest names are NOT
    const adultsNamesContainer = document.getElementById('singleRoomAdultsNamesContainer');
    const childrenNamesContainer = document.getElementById('singleRoomChildrenNamesContainer');
    const toddlersNamesContainer = document.getElementById('singleRoomToddlersNamesContainer');

    if (adultsNamesContainer) {
      while (adultsNamesContainer.firstChild) {
        adultsNamesContainer.removeChild(adultsNamesContainer.firstChild);
      }
    }
    if (childrenNamesContainer) {
      while (childrenNamesContainer.firstChild) {
        childrenNamesContainer.removeChild(childrenNamesContainer.firstChild);
      }
    }
    if (toddlersNamesContainer) {
      while (toddlersNamesContainer.firstChild) {
        toddlersNamesContainer.removeChild(toddlersNamesContainer.firstChild);
      }
    }

    // Reset guest type radio buttons
    const utiaRadio = document.querySelector('input[name="singleRoomGuestType"][value="utia"]');
    if (utiaRadio) {
      utiaRadio.checked = true;
      // FIX 2025-11-05: Explicitly update roomGuestTypes Map to match radio button state
      // This ensures price calculation uses correct guest type on initial modal open
      this.app.roomGuestTypes.set(roomId, 'utia');
    }

    // NEW 2025-11-04: Set per-room guest type dropdown to current value
    const perRoomGuestTypeDropdown = document.getElementById('singleRoomPerRoomGuestType');
    if (perRoomGuestTypeDropdown) {
      perRoomGuestTypeDropdown.value = defaultGuests.guestType || 'utia';
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

    // FIX 2025-12-02: Generate guest name inputs FIRST (before price calculation)
    // This ensures collectGuestNames() can find the toggle switches for counting guests
    // Without this, the price display would show "0 adults" instead of "1 adult"
    this.generateGuestNamesInputs(
      defaultGuests.adults,
      defaultGuests.children,
      defaultGuests.toddlers
    );

    // THEN calculate price (now toggle switches exist for collectGuestNames)
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
        // CRITICAL: Pass sessionId to exclude user's own proposed bookings during edit
        sessionId: this.app.sessionId,
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

      // IMPORTANT: Sync prefilled dates immediately after calendar creation
      // This ensures localStorage prefilled dates are properly transferred to miniCalendar
      this.miniCalendar.selectedDates = this.app.selectedDates;
    }

    // Update roomId if changed
    this.miniCalendar.config.roomId = roomId;

    // Sync app's selectedDates with calendar's selectedDates (for subsequent opens)
    this.miniCalendar.selectedDates = this.app.selectedDates;

    // FIX 2025-12-04: Conditionally exclude session based on whether we're editing or creating
    // When EDITING existing reservation: exclude user's own proposed booking (so they can modify dates)
    // When CREATING new reservation: show ALL proposed bookings including user's own (warning about overlaps)
    this.miniCalendar.config.sessionId = this.app.editingReservation ? this.app.sessionId : '';

    // FIX 2025-12-05: For admin edit of CONFIRMED bookings, exclude the booking's dates from occupied check
    // This allows admin to modify dates of existing confirmed booking (shown as available, not red)
    if (this.app.editingReservation?.id) {
      this.miniCalendar.config.currentEditingBookingId = this.app.editingReservation.id;
    } else {
      this.miniCalendar.config.currentEditingBookingId = null;
    }

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

    // FIX 2025-12-02: If edit was canceled, clear the editing flag
    // The original reservation stays intact since we didn't delete it on edit start
    if (this.app.editingReservation) {
      this.app.editingReservation = null;
    }

    // FIX 2025-12-02: Reset button text to "Přidat rezervaci" (Add Reservation)
    const confirmBtn = document.getElementById('confirmSingleRoomBtn');
    if (confirmBtn) {
      confirmBtn.textContent =
        this.app.currentLanguage === 'cs' ? 'Přidat rezervaci' : 'Add Reservation';
    }

    // FIX 2025-12-04: Clear guest names section DOM to prevent stale data
    // This fixes bug where cancelled edit changes persist when re-editing
    // The generateGuestNamesInputs() captures existing DOM values, so we must clear them
    const adultsContainer = document.getElementById('singleRoomAdultsNamesContainer');
    const childrenContainer = document.getElementById('singleRoomChildrenNamesContainer');
    const toddlersContainer = document.getElementById('singleRoomToddlersNamesContainer');
    if (adultsContainer) {
      adultsContainer.innerHTML = '';
    }
    if (childrenContainer) {
      childrenContainer.innerHTML = '';
    }
    if (toddlersContainer) {
      toddlersContainer.innerHTML = '';
    }

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
      window.notificationManager?.show(
        this.app.currentLanguage === 'cs' ? 'Vyberte prosím termín pobytu' : 'Please select dates',
        'warning'
      );
      return;
    }

    // Validate minimum 2 days (1 night)
    if (this.app.selectedDates.size < 2) {
      window.notificationManager?.show(
        this.app.currentLanguage === 'cs'
          ? 'Minimální rezervace je na 1 noc (2 dny)'
          : 'Minimum booking is for 1 night (2 days)',
        'warning'
      );
      return;
    }

    // Validate room is selected
    if (!this.app.currentBookingRoom) {
      window.notificationManager?.show(
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
        window.notificationManager?.show(
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
      window.notificationManager?.show(
        this.app.currentLanguage === 'cs'
          ? 'Musíte zadat alespoň 1 osobu (dospělého nebo dítě) na pokoji'
          : 'You must specify at least 1 person (adult or child) in the room',
        'warning'
      );
      return;
    }

    // Get dates - use exactly what user selected
    const sortedDates = Array.from(this.app.selectedDates).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    // Calculate price
    const rooms = await dataManager.getRooms();
    const room = rooms.find((r) => r.id === this.app.currentBookingRoom);

    if (!room) {
      window.notificationManager?.show(langManager.t('roomNotFoundError'), 'error');
      return;
    }

    const nights = sortedDates.length - 1;

    // Validate guest names - REQUIRED before creating temp reservation
    const guestNames = this.collectGuestNames();
    if (guestNames === null) {
      // Validation failed - collectGuestNames() already showed error notification
      return;
    }

    // Get guest type (fallback for guests without individual type)
    const guestTypeInput = document.querySelector('input[name="singleRoomGuestType"]:checked');
    const fallbackGuestType = guestTypeInput ? guestTypeInput.value : 'external';

    // Determine actual guest type for the booking:
    // If at least ONE PAYING guest (adult or child) is ÚTIA, the room uses ÚTIA pricing
    // FIX 2025-12-03: Exclude toddlers - they cannot be ÚTIA employees and don't affect pricing
    // (per CLAUDE.md: "Děti do 3 let (toddlers) vždy zdarma")
    const hasUtiaGuest = guestNames.some(
      (guest) => guest.guestPriceType === 'utia' && guest.personType !== 'toddler'
    );
    const guestType = hasUtiaGuest ? 'utia' : 'external';

    // FIX 2025-11-06: Construct perRoomGuests with guestType BEFORE price calculation
    const perRoomGuests = {
      [this.app.currentBookingRoom]: {
        adults: guests.adults || 0,
        children: guests.children || 0,
        toddlers: guests.toddlers || 0,
        guestType, // Use the determined guestType (ÚTIA if ANY guest is ÚTIA)
      },
    };

    // Calculate price using per-guest pricing (NEW 2025-11-04)
    // Each guest can have their own pricing type (ÚTIA vs External)
    const settings = await dataManager.getSettings();
    const price = PriceCalculator.calculatePerGuestPrice({
      rooms: [this.app.currentBookingRoom],
      guestNames,
      nights,
      settings,
      fallbackGuestType,
      perRoomGuests, // FIX 2025-11-06: Pass perRoomGuests to avoid fallback
    });

    // Validate guest names count matches total guests
    const expectedGuestCount =
      (guests.adults || 0) + (guests.children || 0) + (guests.toddlers || 0);
    if (guestNames.length !== expectedGuestCount) {
      window.notificationManager?.show(
        this.app.currentLanguage === 'cs'
          ? `Počet vyplněných jmen (${guestNames.length}) neodpovídá počtu hostů (${expectedGuestCount})`
          : `Number of filled names (${guestNames.length}) doesn't match guest count (${expectedGuestCount})`,
        'error'
      );
      return;
    }

    // FIX 2025-12-02: If editing an existing reservation, delete the old one first
    if (this.app.editingReservation) {
      const oldReservation = this.app.editingReservation;

      // Delete old proposed booking from database
      if (oldReservation.proposalId) {
        try {
          await dataManager.deleteProposedBooking(oldReservation.proposalId);
        } catch (error) {
          // Expected: 404 if reservation already expired
          if (error?.status !== 404 && !error?.message?.includes('not found')) {
            console.error('Failed to delete old proposed booking:', error);
            window.notificationManager?.show(
              this.app.currentLanguage === 'cs'
                ? 'Varování: Nepodařilo se vyčistit předchozí dočasnou rezervaci'
                : 'Warning: Could not clean up previous temporary reservation',
              'warning',
              3000
            );
          }
          // Continue anyway - old reservation may have expired
        }
      }

      // Remove old reservation from tempReservations array
      this.app.tempReservations = this.app.tempReservations.filter(
        (b) => b.id !== oldReservation.id
      );

      // Clear the editing flag
      this.app.editingReservation = null;
    }

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
        guestNames, // Guest names validated and collected earlier
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
      const translatedRoomName =
        this.app.currentLanguage === 'cs' ? room.name : room.name.replace('Pokoj', 'Room');
      window.notificationManager?.show(
        this.app.currentLanguage === 'cs'
          ? `${translatedRoomName} přidán do rezervace`
          : `${translatedRoomName} added to reservation`,
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
      window.notificationManager?.show(
        this.app.currentLanguage === 'cs'
          ? 'Chyba při vytváření dočasné rezervace'
          : 'Error creating temporary reservation',
        'error'
      );
    }
  }

  /**
   * Generate guest name input fields dynamically
   * Delegates to GuestNameUtils SSOT component
   * @param {number} adults - Number of adults
   * @param {number} children - Number of children
   * @param {number} toddlers - Number of toddlers (default 0)
   * @param {Array|null} existingGuestNames - Existing guest names to pre-populate (for edit mode)
   */
  generateGuestNamesInputs(adults, children, toddlers = 0, existingGuestNames = null) {
    // Delegate to GuestNameUtils SSOT component
    GuestNameUtils.generateInputsHTML({
      adults,
      children,
      toddlers,
      sectionId: 'singleRoomGuestNamesSection',
      showPricingToggles: true,
      defaultGuestType: 'utia',
      language: this.app.currentLanguage || 'cs',
      onToggleChange: () => this.updatePriceForCurrentRoom(),
      existingGuestNames,
    });
  }

  /**
   * Collect guest names from input fields
   * Delegates to GuestNameUtils SSOT component
   * @param {boolean} showValidationErrors - If true, shows error notifications (default: true)
   * @returns {Array|null} Array of guest name objects or null if validation fails
   */
  collectGuestNames(showValidationErrors = true) {
    // Delegate to GuestNameUtils SSOT component
    // showValidationErrors=false enables "price update mode" (only collects toggle states)
    return GuestNameUtils.collectGuestNames(
      'singleRoomGuestNamesSection',
      showValidationErrors,
      { showNotification: (msg, type) => window.notificationManager?.show(msg, type) },
      this.app.currentLanguage || 'cs'
    );
  }

  /**
   * Update price for currently selected room and dates
   * Recalculates price based on current guest types and guest counts
   * Called when user changes guest type toggle switches
   */
  async updatePriceForCurrentRoom() {
    if (!this.app.currentBookingRoom) {
      return;
    }

    try {
      const settings = await dataManager.getSettings();
      const roomId = this.app.currentBookingRoom;

      // Get current date selection
      const startDate =
        this.app.selectedDates.size > 0 ? Array.from(this.app.selectedDates).sort()[0] : null;
      const endDate =
        this.app.selectedDates.size > 0 ? Array.from(this.app.selectedDates).sort().pop() : null;

      if (!startDate || !endDate) {
        return; // No dates selected yet
      }

      const nights = DateUtils.getDaysBetween(startDate, endDate);

      // Get guest names with individual price types
      // Don't show validation errors during price updates (only during final submission)
      const guestNames = this.collectGuestNames(false);
      if (!guestNames) {
        return; // Validation failed, don't update price
      }

      // Get fallback guest type (global radio button)
      const guestTypeInput = document.querySelector('input[name="singleRoomGuestType"]:checked');
      const fallbackGuestType = guestTypeInput ? guestTypeInput.value : 'external';

      // Count guests from guestNames
      const adults = guestNames.filter((g) => g.personType === 'adult').length;
      const children = guestNames.filter((g) => g.personType === 'child').length;
      const toddlers = guestNames.filter((g) => g.personType === 'toddler').length;

      // FIX: Determine actual guest type based on whether ANY PAYING guest is ÚTIA
      // This MUST be calculated BEFORE creating perRoomGuests
      // FIX 2025-12-03: Exclude toddlers - they're free and shouldn't affect base room price
      const hasUtiaGuest =
        guestNames && guestNames.length > 0
          ? guestNames.some(
              (guest) => guest.guestPriceType === 'utia' && guest.personType !== 'toddler'
            )
          : true; // FIX 2025-11-07: Default to ÚTIA when no guests yet (matches default radio selection)
      const actualGuestType = hasUtiaGuest ? 'utia' : 'external';

      // FIX 2025-11-07: Store actualGuestType in app.roomGuestTypes so utils.js can access it
      this.app.roomGuestTypes.set(roomId, actualGuestType);

      // Construct perRoomGuests object for single room
      const perRoomGuests = {
        [roomId]: {
          adults,
          children,
          toddlers,
          guestType: actualGuestType, // FIX: Use actualGuestType instead of fallbackGuestType
        },
      };

      // Calculate price using PER-GUEST method
      const price = PriceCalculator.calculatePerGuestPrice({
        rooms: [roomId],
        guestNames,
        perRoomGuests, // FIX: Pass per-room guest type data to prevent fallback warning
        nights,
        settings,
        fallbackGuestType,
      });

      // Update price display
      this.updatePriceSummary(price, nights, guestNames);
    } catch (error) {
      console.error('Error updating price for current room:', error);
    }
  }

  /**
   * Update price summary display in the modal
   * @param {number} totalPrice - Total price in CZK
   * @param {number} nights - Number of nights
   * @param {Array<Object>} guestNames - Array of guest name objects
   */
  async updatePriceSummary(totalPrice, nights, guestNames) {
    // Get settings for price configuration
    const settings = await dataManager.getSettings();
    const roomId = this.app.currentBookingRoom;
    const room = settings.rooms?.find((r) => r.id === roomId);
    const roomType = room?.type || 'small';

    // Determine actual guest type based on whether ANY PAYING guest is ÚTIA
    // FIX 2025-12-03: Exclude toddlers - they're free and shouldn't affect base room price
    const hasUtiaGuest =
      guestNames && guestNames.length > 0
        ? guestNames.some(
            (guest) => guest.guestPriceType === 'utia' && guest.personType !== 'toddler'
          )
        : true; // FIX 2025-11-07: Default to ÚTIA when no guests yet (matches default radio selection)
    const actualGuestType = hasUtiaGuest ? 'utia' : 'external';

    // Count guests by person type and price type
    let utiaAdults = 0;
    let utiaChildren = 0;
    let externalAdults = 0;
    let externalChildren = 0;
    let toddlers = 0;

    for (const guest of guestNames) {
      const priceType = guest.guestPriceType || 'external';
      const { personType } = guest;

      if (personType === 'toddler') {
        toddlers++;
        continue; // Free
      }

      if (priceType === 'utia') {
        if (personType === 'adult') {
          utiaAdults++;
        } else if (personType === 'child') {
          utiaChildren++;
        }
      } else {
        // External
        if (personType === 'adult') {
          externalAdults++;
        } else if (personType === 'child') {
          externalChildren++;
        }
      }
    }

    const totalAdults = utiaAdults + externalAdults;
    const totalChildren = utiaChildren + externalChildren;

    // Get price configurations
    const utiaPrices = settings.prices?.utia?.[roomType] || {};
    const externalPrices = settings.prices?.external?.[roomType] || {};

    // Get empty room price (NEW MODEL 2025-11-10: Only 'empty' field)
    const actualPriceConfig = actualGuestType === 'utia' ? utiaPrices : externalPrices;
    const emptyRoomPrice = actualPriceConfig.empty || 0;

    // Update base price display
    const basePriceElement = document.getElementById('basePrice');
    if (basePriceElement) {
      const basePriceText = `${emptyRoomPrice.toLocaleString('cs-CZ')} Kč${hasUtiaGuest ? ' (ÚTIA)' : ' (EXT)'}`;
      basePriceElement.textContent = basePriceText;
    }

    // Update guest counts summary
    const guestCountsElement = document.getElementById('guestCountsSummary');
    if (guestCountsElement) {
      let text = `${totalAdults} ${langManager.t('adultsShort')}`;
      if (totalChildren > 0) {
        text += `, ${totalChildren} ${langManager.t('childrenShort')}`;
      }
      if (toddlers > 0) {
        text += `, ${toddlers} ${langManager.t('toddlersShort')}`;
      }
      guestCountsElement.textContent = text;
    }

    // Calculate and update adults surcharge
    const adultsPrice = document.getElementById('adultsPrice');
    const adultsSurcharge = document.getElementById('adultsSurcharge');
    if (adultsPrice && adultsSurcharge) {
      if (totalAdults > 0) {
        let adultSurchargeText = '';
        let totalAdultSurcharge = 0;

        if (utiaAdults > 0 && externalAdults > 0) {
          // Mixed pricing
          const utiaAdultSurcharge = utiaAdults * utiaPrices.adult;
          const externalAdultSurcharge = externalAdults * externalPrices.adult;
          totalAdultSurcharge = utiaAdultSurcharge + externalAdultSurcharge;
          adultSurchargeText = `${totalAdultSurcharge.toLocaleString('cs-CZ')} Kč (${utiaAdults} ÚTIA × ${utiaPrices.adult} Kč + ${externalAdults} EXT × ${externalPrices.adult} Kč)`;
        } else if (utiaAdults > 0) {
          // All ÚTIA
          totalAdultSurcharge = utiaAdults * utiaPrices.adult;
          adultSurchargeText = `${totalAdultSurcharge.toLocaleString('cs-CZ')} Kč (${utiaAdults} × ${utiaPrices.adult} Kč)`;
        } else {
          // All External
          totalAdultSurcharge = externalAdults * externalPrices.adult;
          adultSurchargeText = `${totalAdultSurcharge.toLocaleString('cs-CZ')} Kč (${externalAdults} × ${externalPrices.adult} Kč)`;
        }

        adultsSurcharge.textContent = adultSurchargeText;
        adultsPrice.style.display = 'flex';
      } else {
        adultsPrice.style.display = 'none';
      }
    }

    // Calculate and update children surcharge
    const childrenPrice = document.getElementById('childrenPrice');
    const childrenSurcharge = document.getElementById('childrenSurcharge');
    if (childrenPrice && childrenSurcharge) {
      if (totalChildren > 0) {
        let childSurchargeText = '';
        let totalChildSurcharge = 0;

        if (utiaChildren > 0 && externalChildren > 0) {
          // Mixed pricing
          const utiaChildSurcharge = utiaChildren * utiaPrices.child;
          const externalChildSurcharge = externalChildren * externalPrices.child;
          totalChildSurcharge = utiaChildSurcharge + externalChildSurcharge;
          childSurchargeText = `${totalChildSurcharge.toLocaleString('cs-CZ')} Kč (${utiaChildren} ÚTIA × ${utiaPrices.child} Kč + ${externalChildren} EXT × ${externalPrices.child} Kč)`;
        } else if (utiaChildren > 0) {
          // All ÚTIA
          totalChildSurcharge = utiaChildren * utiaPrices.child;
          childSurchargeText = `${totalChildSurcharge.toLocaleString('cs-CZ')} Kč (${utiaChildren} × ${utiaPrices.child} Kč)`;
        } else {
          // All External
          totalChildSurcharge = externalChildren * externalPrices.child;
          childSurchargeText = `${totalChildSurcharge.toLocaleString('cs-CZ')} Kč (${externalChildren} × ${externalPrices.child} Kč)`;
        }

        childrenSurcharge.textContent = childSurchargeText;
        childrenPrice.style.display = 'flex';
      } else {
        childrenPrice.style.display = 'none';
      }
    }

    // Update toddlers info visibility
    const toddlersInfo = document.getElementById('toddlersInfo');
    if (toddlersInfo) {
      toddlersInfo.style.display = toddlers > 0 ? 'flex' : 'none';
    }

    // Update nights multiplier
    const nightsMultiplier = document.getElementById('nightsMultiplier');
    if (nightsMultiplier) {
      nightsMultiplier.textContent = nights;
    }

    // Update total price
    const totalPriceElement = document.getElementById('totalPrice');
    if (totalPriceElement) {
      totalPriceElement.textContent = `${totalPrice.toLocaleString('cs-CZ')} Kč`;
    }

    // Also update the guest summary in modal header if it exists
    const guestSummary = document.querySelector('#singleRoomBookingModal .guest-summary');
    if (guestSummary) {
      let text = `${totalAdults} ${langManager.t('adultsShort')}`;
      if (totalChildren > 0) {
        text += `, ${totalChildren} ${langManager.t('childrenShort')}`;
      }
      if (toddlers > 0) {
        text += `, ${toddlers} ${langManager.t('toddlersShort')}`;
      }
      guestSummary.textContent = text;
    }

    // Update nights display in header if it exists
    const nightsElement = document.querySelector('#singleRoomBookingModal .nights-count');
    if (nightsElement) {
      nightsElement.textContent = `× ${nights}`;
    }
  }

  /**
   * Open single room booking modal in admin edit mode
   * Pre-fills with existing booking data and uses admin callbacks
   * @param {Object} booking - Full booking object from database
   * @param {string} roomId - ID of room to edit
   * @param {Object} callbacks - Admin callbacks {onSubmit, onCancel, onDelete}
   */
  async openForAdminEdit(booking, roomId, callbacks) {
    // Store admin edit context
    this.adminEditContext = {
      booking,
      roomId,
      callbacks,
      isAdminEdit: true,
    };

    const modal = document.getElementById('singleRoomBookingModal');
    const modalTitle = document.getElementById('roomBookingTitle');

    // Get room data
    const rooms = await dataManager.getRooms();
    const room = rooms.find((r) => r.id === roomId);

    if (!room) {
      console.error('Room not found:', roomId);
      callbacks.onCancel?.();
      return;
    }

    // Set title for edit mode
    const roomName = room.name;
    modalTitle.textContent = `Upravit ${roomName}`;

    this.app.currentBookingRoom = roomId;
    this.app.selectedDates.clear();
    this.app.selectedRooms.clear();
    this.app.roomGuests.clear();
    this.app.roomGuestTypes.clear();

    // Pre-fill dates from booking
    const roomDates = booking.perRoomDates?.[roomId] || {
      startDate: booking.startDate,
      endDate: booking.endDate,
    };

    const start = new Date(`${roomDates.startDate}T12:00:00`);
    const end = new Date(`${roomDates.endDate}T12:00:00`);
    const current = new Date(start);

    // Add all dates in range to selectedDates
    while (current <= end) {
      const dateStr = DateUtils.formatDate(current);
      this.app.selectedDates.add(dateStr);
      current.setDate(current.getDate() + 1);
    }

    // Pre-fill guest configuration
    const roomGuests = booking.perRoomGuests?.[roomId] || {
      adults: booking.adults || 1,
      children: booking.children || 0,
      toddlers: booking.toddlers || 0,
      guestType: booking.guestType || 'external',
    };

    this.app.roomGuests.set(roomId, roomGuests);
    this.app.roomGuestTypes.set(roomId, roomGuests.guestType || 'external');

    // Update display of guest counts
    const adultsEl = document.getElementById('singleRoomAdults');
    const childrenEl = document.getElementById('singleRoomChildren');
    const toddlersEl = document.getElementById('singleRoomToddlers');

    if (adultsEl) {
      adultsEl.textContent = roomGuests.adults.toString();
    }
    if (childrenEl) {
      childrenEl.textContent = roomGuests.children.toString();
    }
    if (toddlersEl) {
      toddlersEl.textContent = (roomGuests.toddlers || 0).toString();
    }

    // Set guest type radio button
    const guestTypeRadio = document.querySelector(
      `input[name="singleRoomGuestType"][value="${roomGuests.guestType || 'external'}"]`
    );
    if (guestTypeRadio) {
      guestTypeRadio.checked = true;
    }

    // Add active class to show modal
    modal.classList.add('active');

    // Ensure room is selected for price calculation
    this.app.selectedRooms.add(roomId);

    // FIX 2025-12-05: Set editingReservation flag so calendar excludes this booking's dates
    // This allows user to modify the original reservation dates (shown as available, not red)
    this.app.editingReservation = booking;

    // Use BaseCalendar for rendering
    await this.renderMiniCalendar(roomId);
    await this.app.updateSelectedDatesDisplay();

    // Get room-specific guest names
    const roomGuestNames =
      booking.guestNames?.filter((g) => String(g.roomId) === String(roomId)) || [];

    // Generate guest name inputs with existing data
    this.generateGuestNamesInputs(
      roomGuests.adults,
      roomGuests.children,
      roomGuests.toddlers || 0,
      roomGuestNames
    );

    // Update price
    await this.updatePriceForCurrentRoom();

    // Update confirm button for edit mode
    const confirmBtn = document.getElementById('confirmSingleRoomBtn');
    if (confirmBtn) {
      confirmBtn.textContent = 'Uložit změny';
      // Store original onclick handler
      this._originalConfirmHandler = confirmBtn.onclick;
      // Replace with admin edit handler
      confirmBtn.onclick = () => this.confirmAdminEdit();
    }

    // Update cancel button to use admin callback
    const cancelBtn = modal.querySelector('.modal-close');
    if (cancelBtn) {
      this._originalCancelHandler = cancelBtn.onclick;
      cancelBtn.onclick = () => this.cancelAdminEdit();
    }
  }

  /**
   * Confirm admin edit - collect data and call admin callback
   */
  async confirmAdminEdit() {
    if (!this.adminEditContext) {
      console.error('No admin edit context');
      return;
    }

    // Validate dates
    if (this.app.selectedDates.size < 2) {
      window.notificationManager?.show('Vyberte prosím termín (min. 1 noc)', 'warning');
      return;
    }

    // Get dates
    const sortedDates = Array.from(this.app.selectedDates).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    // Get guests
    const { roomId } = this.adminEditContext;
    const guests = this.app.roomGuests.get(roomId) || { adults: 1, children: 0, toddlers: 0 };

    // Validate guest names
    const guestNames = this.collectGuestNames();
    if (guestNames === null) {
      return; // Validation failed
    }

    // Get guest type from toggle switches
    const hasUtiaGuest = guestNames.some(
      (guest) => guest.guestPriceType === 'utia' && guest.personType !== 'toddler'
    );
    const guestType = hasUtiaGuest ? 'utia' : 'external';

    // Calculate price
    const nights = sortedDates.length - 1;
    const settings = await dataManager.getSettings();
    const price = PriceCalculator.calculatePerGuestPrice({
      rooms: [roomId],
      guestNames,
      nights,
      settings,
      fallbackGuestType: guestType,
    });

    // Build form data
    const formData = {
      startDate,
      endDate,
      adults: guests.adults,
      children: guests.children,
      toddlers: guests.toddlers || 0,
      guestType,
      guestNames: guestNames.map((g) => ({ ...g, roomId })),
      totalPrice: price,
      rooms: [roomId],
    };

    // Call admin callback
    this.adminEditContext.callbacks.onSubmit?.(formData);

    // Clean up
    this.cleanupAdminEdit();
  }

  /**
   * Cancel admin edit - close modal and call cancel callback
   */
  cancelAdminEdit() {
    if (this.adminEditContext?.callbacks?.onCancel) {
      this.adminEditContext.callbacks.onCancel();
    }
    this.cleanupAdminEdit();
  }

  /**
   * Clean up after admin edit (success or cancel)
   */
  cleanupAdminEdit() {
    // Restore original handlers
    const confirmBtn = document.getElementById('confirmSingleRoomBtn');
    if (confirmBtn && this._originalConfirmHandler) {
      confirmBtn.onclick = this._originalConfirmHandler;
      confirmBtn.textContent =
        this.app.currentLanguage === 'cs' ? 'Přidat rezervaci' : 'Add Reservation';
    }

    const modal = document.getElementById('singleRoomBookingModal');
    const cancelBtn = modal?.querySelector('.modal-close');
    if (cancelBtn && this._originalCancelHandler) {
      cancelBtn.onclick = this._originalCancelHandler;
    }

    // Close modal
    modal?.classList.remove('active');

    // Clear context
    this.adminEditContext = null;
    this._originalConfirmHandler = null;
    this._originalCancelHandler = null;

    // Clean up app state
    this.app.currentBookingRoom = null;
    this.app.selectedDates.clear();
    // FIX 2025-12-05: Clear editingReservation flag on cleanup
    this.app.editingReservation = null;
  }
}
