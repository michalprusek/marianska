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
    await this.app.updatePriceCalculation();

    // Generate guest name input fields based on default guest counts
    this.generateGuestNamesInputs(
      defaultGuests.adults,
      defaultGuests.children,
      defaultGuests.toddlers
    );
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
    // If at least ONE guest is ÚTIA, the entire booking uses ÚTIA pricing
    const hasUtiaGuest = guestNames.some(guest => guest.guestPriceType === 'utia');
    const guestType = hasUtiaGuest ? 'utia' : 'external';

    // FIX 2025-11-06: Construct perRoomGuests with guestType BEFORE price calculation
    const perRoomGuests = {
      [this.app.currentBookingRoom]: {
        adults: guests.adults || 0,
        children: guests.children || 0,
        toddlers: guests.toddlers || 0,
        guestType: guestType  // Use the determined guestType (ÚTIA if ANY guest is ÚTIA)
      }
    };

    // Calculate price using per-guest pricing (NEW 2025-11-04)
    // Each guest can have their own pricing type (ÚTIA vs External)
    const settings = await dataManager.getSettings();
    const price = PriceCalculator.calculatePerGuestPrice({
      rooms: [this.app.currentBookingRoom],
      guestNames: guestNames,
      nights: nights,
      settings: settings,
      fallbackGuestType: fallbackGuestType,
      perRoomGuests: perRoomGuests  // FIX 2025-11-06: Pass perRoomGuests to avoid fallback
    });

    // Validate guest names count matches total guests
    const expectedGuestCount = (guests.adults || 0) + (guests.children || 0) + (guests.toddlers || 0);
    if (guestNames.length !== expectedGuestCount) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? `Počet vyplněných jmen (${guestNames.length}) neodpovídá počtu hostů (${expectedGuestCount})`
          : `Number of filled names (${guestNames.length}) doesn't match guest count (${expectedGuestCount})`,
        'error'
      );
      return;
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

  /**
   * Generate guest name input fields dynamically
   * REQUIRED inputs - all fields must be filled before adding to temp reservations
   * @param {number} adults - Number of adults
   * @param {number} children - Number of children
   * @param {number} toddlers - Number of toddlers (default 0)
   */
  generateGuestNamesInputs(adults, children, toddlers = 0) {
    const section = document.getElementById('singleRoomGuestNamesSection');
    const totalGuests = (adults || 0) + (children || 0) + (toddlers || 0);

    // Show section only if there are guests
    if (totalGuests > 0) {
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
      return;
    }

    // CAPTURE PHASE: Save existing guest data before clearing DOM
    const savedGuestData = new Map();

    // Capture adults
    const existingAdultInputs = section.querySelectorAll('input[data-guest-type="adult"]');
    existingAdultInputs.forEach(input => {
      const index = input.dataset.guestIndex;
      const key = `adult-${index}`;
      if (!savedGuestData.has(key)) {
        savedGuestData.set(key, {});
      }
      const data = savedGuestData.get(key);
      if (input.id.includes('FirstName')) {
        data.firstName = input.value;
      } else if (input.id.includes('LastName')) {
        data.lastName = input.value;
      }
    });

    // Capture adult toggle states
    const existingAdultToggles = section.querySelectorAll('input[data-guest-type="adult"][data-guest-price-type]');
    existingAdultToggles.forEach(toggle => {
      const index = toggle.dataset.guestIndex;
      const key = `adult-${index}`;
      if (savedGuestData.has(key)) {
        savedGuestData.get(key).guestType = toggle.checked ? 'external' : 'utia';
      }
    });

    // Capture children
    const existingChildInputs = section.querySelectorAll('input[data-guest-type="child"]');
    existingChildInputs.forEach(input => {
      const index = input.dataset.guestIndex;
      const key = `child-${index}`;
      if (!savedGuestData.has(key)) {
        savedGuestData.set(key, {});
      }
      const data = savedGuestData.get(key);
      if (input.id.includes('FirstName')) {
        data.firstName = input.value;
      } else if (input.id.includes('LastName')) {
        data.lastName = input.value;
      }
    });

    // Capture children toggle states
    const existingChildToggles = section.querySelectorAll('input[data-guest-type="child"][data-guest-price-type]');
    existingChildToggles.forEach(toggle => {
      const index = toggle.dataset.guestIndex;
      const key = `child-${index}`;
      if (savedGuestData.has(key)) {
        savedGuestData.get(key).guestType = toggle.checked ? 'external' : 'utia';
      }
    });

    // Capture toddlers
    const existingToddlerInputs = section.querySelectorAll('input[data-guest-type="toddler"]');
    existingToddlerInputs.forEach(input => {
      const index = input.dataset.guestIndex;
      const key = `toddler-${index}`;
      if (!savedGuestData.has(key)) {
        savedGuestData.set(key, {});
      }
      const data = savedGuestData.get(key);
      if (input.id.includes('FirstName')) {
        data.firstName = input.value;
      } else if (input.id.includes('LastName')) {
        data.lastName = input.value;
      }
    });

    // Capture toddler toggle states
    const existingToddlerToggles = section.querySelectorAll('input[data-guest-type="toddler"][data-guest-price-type]');
    existingToddlerToggles.forEach(toggle => {
      const index = toggle.dataset.guestIndex;
      const key = `toddler-${index}`;
      if (savedGuestData.has(key)) {
        savedGuestData.get(key).guestType = toggle.checked ? 'external' : 'utia';
      }
    });

    const makeId = (prefix) => prefix;

    // Adults section
    const adultsContainer = document.getElementById('singleRoomAdultsNamesContainer');
    if (adultsContainer) {
      adultsContainer.innerHTML = '';
      if (adults > 0) {
        adultsContainer.style.display = 'block';
        const adultsHeader = document.createElement('h5');
        adultsHeader.style.cssText = 'margin-bottom: 0.5rem; color: #374151; font-size: 0.95rem;';
        adultsHeader.textContent = `${langManager.t('adultsLabel')} (${adults})`;
        adultsContainer.appendChild(adultsHeader);

        for (let i = 1; i <= adults; i++) {
          const row = document.createElement('div');
          row.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; background-color: #f9fafb;';

          // Name inputs
          const firstNameInput = document.createElement('input');
          firstNameInput.type = 'text';
          firstNameInput.id = `${makeId('singleRoomAdultFirstName')}${i}`;
          firstNameInput.placeholder = langManager.t('firstNamePlaceholder');
          firstNameInput.setAttribute('data-guest-type', 'adult');
          firstNameInput.setAttribute('data-guest-index', i);
          firstNameInput.required = true;
          firstNameInput.minLength = 2;
          firstNameInput.maxLength = 50;
          firstNameInput.style.cssText = 'flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; min-width: 0;';

          const lastNameInput = document.createElement('input');
          lastNameInput.type = 'text';
          lastNameInput.id = `${makeId('singleRoomAdultLastName')}${i}`;
          lastNameInput.placeholder = langManager.t('lastNamePlaceholder');
          lastNameInput.setAttribute('data-guest-type', 'adult');
          lastNameInput.setAttribute('data-guest-index', i);
          lastNameInput.required = true;
          lastNameInput.minLength = 2;
          lastNameInput.maxLength = 50;
          lastNameInput.style.cssText = 'flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; min-width: 0;';

          // Add input event listeners to remove red border when user starts typing
          const removeRedBorder = (input) => {
            if (input.style.borderColor === 'rgb(239, 68, 68)' || input.style.borderColor === '#ef4444') {
              input.style.borderColor = '#d1d5db';
            }
          };

          firstNameInput.addEventListener('input', function() {
            removeRedBorder(this);
          });

          lastNameInput.addEventListener('input', function() {
            removeRedBorder(this);
          });

          // Toggle switch container
          const toggleContainer = document.createElement('div');
          toggleContainer.style.cssText = 'display: flex; align-items: center; gap: 0.25rem; white-space: nowrap; flex-shrink: 0;';

          const toggleLabel = document.createElement('label');
          toggleLabel.style.cssText = 'position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer;';

          const toggleInput = document.createElement('input');
          toggleInput.type = 'checkbox';
          toggleInput.id = `adult${i}GuestTypeToggle`;
          toggleInput.setAttribute('data-guest-type', 'adult');
          toggleInput.setAttribute('data-guest-index', i);
          toggleInput.setAttribute('data-guest-price-type', 'true');
          toggleInput.checked = false; // Unchecked = ÚTIA, Checked = External
          toggleInput.style.cssText = 'opacity: 0; width: 0; height: 0;';

          const toggleSlider = document.createElement('span');
          toggleSlider.style.cssText = `
            position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
            background-color: #059669; transition: 0.3s; border-radius: 24px;
          `;

          const toggleThumb = document.createElement('span');
          toggleThumb.style.cssText = `
            position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px;
            background-color: white; transition: 0.3s; border-radius: 50%;
          `;
          toggleSlider.appendChild(toggleThumb);

          // Toggle state change handler
          toggleInput.addEventListener('change', async function() {
            if (this.checked) {
              toggleSlider.style.backgroundColor = '#dc2626'; // Red for External
              toggleThumb.style.transform = 'translateX(20px)';
              toggleText.textContent = 'EXT';
              toggleText.style.color = '#dc2626';
            } else {
              toggleSlider.style.backgroundColor = '#059669'; // Green for ÚTIA
              toggleThumb.style.transform = 'translateX(0)';
              toggleText.textContent = 'ÚTIA';
              toggleText.style.color = '#059669';
            }

            // NOVÝ KÓD - Přepočet ceny po změně typu hosta:
            if (window.app && window.app.singleRoomBooking) {
              try {
                await window.app.singleRoomBooking.updatePriceForCurrentRoom();
              } catch (error) {
                console.error('Failed to update price after guest type change:', error);
              }
            }
          });

          toggleLabel.appendChild(toggleInput);
          toggleLabel.appendChild(toggleSlider);

          const toggleText = document.createElement('span');
          toggleText.textContent = 'ÚTIA';
          toggleText.style.cssText = 'font-size: 0.75rem; font-weight: 600; color: #059669; min-width: 32px;';

          toggleContainer.appendChild(toggleLabel);
          toggleContainer.appendChild(toggleText);

          // RESTORE PHASE: Restore saved data for this guest
          const savedKey = `adult-${i}`;
          if (savedGuestData.has(savedKey)) {
            const saved = savedGuestData.get(savedKey);
            if (saved.firstName) firstNameInput.value = saved.firstName;
            if (saved.lastName) lastNameInput.value = saved.lastName;
            if (saved.guestType) {
              const isExternal = saved.guestType === 'external';
              toggleInput.checked = isExternal;
              // Trigger visual update
              if (isExternal) {
                toggleSlider.style.backgroundColor = '#dc2626';
                toggleThumb.style.transform = 'translateX(20px)';
                toggleText.textContent = 'EXT';
                toggleText.style.color = '#dc2626';
              } else {
                toggleSlider.style.backgroundColor = '#059669';
                toggleThumb.style.transform = 'translateX(0)';
                toggleText.textContent = 'ÚTIA';
                toggleText.style.color = '#059669';
              }
            }
          }

          row.appendChild(firstNameInput);
          row.appendChild(lastNameInput);
          row.appendChild(toggleContainer);
          adultsContainer.appendChild(row);
        }
      } else {
        adultsContainer.style.display = 'none';
      }
    }

    // Children section
    const childrenContainer = document.getElementById('singleRoomChildrenNamesContainer');
    if (childrenContainer) {
      childrenContainer.innerHTML = '';
      if (children > 0) {
        childrenContainer.style.display = 'block';
        const childrenHeader = document.createElement('h5');
        childrenHeader.style.cssText = 'margin-bottom: 0.5rem; color: #374151; font-size: 0.95rem;';
        childrenHeader.textContent = `${langManager.t('childrenLabel')} (${children})`;
        childrenContainer.appendChild(childrenHeader);

        for (let i = 1; i <= children; i++) {
          const row = document.createElement('div');
          row.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; background-color: #f9fafb;';

          // Name inputs
          const firstNameInput = document.createElement('input');
          firstNameInput.type = 'text';
          firstNameInput.id = `${makeId('singleRoomChildFirstName')}${i}`;
          firstNameInput.placeholder = langManager.t('firstNamePlaceholder');
          firstNameInput.setAttribute('data-guest-type', 'child');
          firstNameInput.setAttribute('data-guest-index', i);
          firstNameInput.required = true;
          firstNameInput.minLength = 2;
          firstNameInput.maxLength = 50;
          firstNameInput.style.cssText = 'flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; min-width: 0;';

          const lastNameInput = document.createElement('input');
          lastNameInput.type = 'text';
          lastNameInput.id = `${makeId('singleRoomChildLastName')}${i}`;
          lastNameInput.placeholder = langManager.t('lastNamePlaceholder');
          lastNameInput.setAttribute('data-guest-type', 'child');
          lastNameInput.setAttribute('data-guest-index', i);
          lastNameInput.required = true;
          lastNameInput.minLength = 2;
          lastNameInput.maxLength = 50;
          lastNameInput.style.cssText = 'flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; min-width: 0;';

          // Toggle switch container
          const toggleContainer = document.createElement('div');
          toggleContainer.style.cssText = 'display: flex; align-items: center; gap: 0.25rem; white-space: nowrap; flex-shrink: 0;';

          const toggleLabel = document.createElement('label');
          toggleLabel.style.cssText = 'position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer;';

          const toggleInput = document.createElement('input');
          toggleInput.type = 'checkbox';
          toggleInput.id = `child${i}GuestTypeToggle`;
          toggleInput.setAttribute('data-guest-type', 'child');
          toggleInput.setAttribute('data-guest-index', i);
          toggleInput.setAttribute('data-guest-price-type', 'true');
          toggleInput.checked = false; // Unchecked = ÚTIA, Checked = External
          toggleInput.style.cssText = 'opacity: 0; width: 0; height: 0;';

          const toggleSlider = document.createElement('span');
          toggleSlider.style.cssText = `
            position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
            background-color: #059669; transition: 0.3s; border-radius: 24px;
          `;

          const toggleThumb = document.createElement('span');
          toggleThumb.style.cssText = `
            position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px;
            background-color: white; transition: 0.3s; border-radius: 50%;
          `;
          toggleSlider.appendChild(toggleThumb);

          // Toggle state change handler
          toggleInput.addEventListener('change', async function() {
            if (this.checked) {
              toggleSlider.style.backgroundColor = '#dc2626'; // Red for External
              toggleThumb.style.transform = 'translateX(20px)';
              toggleText.textContent = 'EXT';
              toggleText.style.color = '#dc2626';
            } else {
              toggleSlider.style.backgroundColor = '#059669'; // Green for ÚTIA
              toggleThumb.style.transform = 'translateX(0)';
              toggleText.textContent = 'ÚTIA';
              toggleText.style.color = '#059669';
            }

            // NOVÝ KÓD - Přepočet ceny po změně typu hosta:
            if (window.app && window.app.singleRoomBooking) {
              try {
                await window.app.singleRoomBooking.updatePriceForCurrentRoom();
              } catch (error) {
                console.error('Failed to update price after guest type change:', error);
              }
            }
          });

          toggleLabel.appendChild(toggleInput);
          toggleLabel.appendChild(toggleSlider);

          const toggleText = document.createElement('span');
          toggleText.textContent = 'ÚTIA';
          toggleText.style.cssText = 'font-size: 0.75rem; font-weight: 600; color: #059669; min-width: 32px;';

          toggleContainer.appendChild(toggleLabel);
          toggleContainer.appendChild(toggleText);

          // RESTORE PHASE: Restore saved data for this guest
          const savedKey = `child-${i}`;
          if (savedGuestData.has(savedKey)) {
            const saved = savedGuestData.get(savedKey);
            if (saved.firstName) firstNameInput.value = saved.firstName;
            if (saved.lastName) lastNameInput.value = saved.lastName;
            if (saved.guestType) {
              const isExternal = saved.guestType === 'external';
              toggleInput.checked = isExternal;
              // Trigger visual update
              if (isExternal) {
                toggleSlider.style.backgroundColor = '#dc2626';
                toggleThumb.style.transform = 'translateX(20px)';
                toggleText.textContent = 'EXT';
                toggleText.style.color = '#dc2626';
              } else {
                toggleSlider.style.backgroundColor = '#059669';
                toggleThumb.style.transform = 'translateX(0)';
                toggleText.textContent = 'ÚTIA';
                toggleText.style.color = '#059669';
              }
            }
          }

          // Add input event listeners to remove red border when user starts typing
          const removeRedBorderChild = (input) => {
            if (input.style.borderColor === 'rgb(239, 68, 68)' || input.style.borderColor === '#ef4444') {
              input.style.borderColor = '#d1d5db';
            }
          };

          firstNameInput.addEventListener('input', function() {
            removeRedBorderChild(this);
          });

          lastNameInput.addEventListener('input', function() {
            removeRedBorderChild(this);
          });

          row.appendChild(firstNameInput);
          row.appendChild(lastNameInput);
          row.appendChild(toggleContainer);
          childrenContainer.appendChild(row);
        }
      } else {
        childrenContainer.style.display = 'none';
      }
    }

    // Toddlers section
    const toddlersContainer = document.getElementById('singleRoomToddlersNamesContainer');
    if (toddlersContainer) {
      toddlersContainer.innerHTML = '';
      if (toddlers > 0) {
        toddlersContainer.style.display = 'block';
        const toddlersHeader = document.createElement('h5');
        toddlersHeader.style.cssText = 'margin-bottom: 0.5rem; color: #374151; font-size: 0.95rem;';
        toddlersHeader.textContent = `${langManager.t('toddlersLabel')} (${toddlers})`;
        toddlersContainer.appendChild(toddlersHeader);

        for (let i = 1; i <= toddlers; i++) {
          const row = document.createElement('div');
          row.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; background-color: #f9fafb;';

          // Name inputs
          const firstNameInput = document.createElement('input');
          firstNameInput.type = 'text';
          firstNameInput.id = `${makeId('singleRoomToddlerFirstName')}${i}`;
          firstNameInput.placeholder = langManager.t('firstNamePlaceholder');
          firstNameInput.setAttribute('data-guest-type', 'toddler');
          firstNameInput.setAttribute('data-guest-index', i);
          firstNameInput.required = true;
          firstNameInput.minLength = 2;
          firstNameInput.maxLength = 50;
          firstNameInput.style.cssText = 'flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; min-width: 0;';

          const lastNameInput = document.createElement('input');
          lastNameInput.type = 'text';
          lastNameInput.id = `${makeId('singleRoomToddlerLastName')}${i}`;
          lastNameInput.placeholder = langManager.t('lastNamePlaceholder');
          lastNameInput.setAttribute('data-guest-type', 'toddler');
          lastNameInput.setAttribute('data-guest-index', i);
          lastNameInput.required = true;
          lastNameInput.minLength = 2;
          lastNameInput.maxLength = 50;
          lastNameInput.style.cssText = 'flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; min-width: 0;';

          // Toggle switch container (toddlers are free, but we track type for reporting)
          const toggleContainer = document.createElement('div');
          toggleContainer.style.cssText = 'display: flex; align-items: center; gap: 0.25rem; white-space: nowrap; flex-shrink: 0;';

          const toggleLabel = document.createElement('label');
          toggleLabel.style.cssText = 'position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer;';

          const toggleInput = document.createElement('input');
          toggleInput.type = 'checkbox';
          toggleInput.id = `toddler${i}GuestTypeToggle`;
          toggleInput.setAttribute('data-guest-type', 'toddler');
          toggleInput.setAttribute('data-guest-index', i);
          toggleInput.setAttribute('data-guest-price-type', 'true');
          toggleInput.checked = false; // Unchecked = ÚTIA, Checked = External
          toggleInput.style.cssText = 'opacity: 0; width: 0; height: 0;';

          const toggleSlider = document.createElement('span');
          toggleSlider.style.cssText = `
            position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
            background-color: #059669; transition: 0.3s; border-radius: 24px;
          `;

          const toggleThumb = document.createElement('span');
          toggleThumb.style.cssText = `
            position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px;
            background-color: white; transition: 0.3s; border-radius: 50%;
          `;
          toggleSlider.appendChild(toggleThumb);

          // Toggle state change handler
          toggleInput.addEventListener('change', async function() {
            if (this.checked) {
              toggleSlider.style.backgroundColor = '#dc2626'; // Red for External
              toggleThumb.style.transform = 'translateX(20px)';
              toggleText.textContent = 'EXT';
              toggleText.style.color = '#dc2626';
            } else {
              toggleSlider.style.backgroundColor = '#059669'; // Green for ÚTIA
              toggleThumb.style.transform = 'translateX(0)';
              toggleText.textContent = 'ÚTIA';
              toggleText.style.color = '#059669';
            }

            // NOVÝ KÓD - Přepočet ceny po změně typu hosta:
            if (window.app && window.app.singleRoomBooking) {
              try {
                await window.app.singleRoomBooking.updatePriceForCurrentRoom();
              } catch (error) {
                console.error('Failed to update price after guest type change:', error);
              }
            }
          });

          toggleLabel.appendChild(toggleInput);
          toggleLabel.appendChild(toggleSlider);

          const toggleText = document.createElement('span');
          toggleText.textContent = 'ÚTIA';
          toggleText.style.cssText = 'font-size: 0.75rem; font-weight: 600; color: #059669; min-width: 32px;';

          toggleContainer.appendChild(toggleLabel);
          toggleContainer.appendChild(toggleText);

          // RESTORE PHASE: Restore saved data for this guest
          const savedKey = `toddler-${i}`;
          if (savedGuestData.has(savedKey)) {
            const saved = savedGuestData.get(savedKey);
            if (saved.firstName) firstNameInput.value = saved.firstName;
            if (saved.lastName) lastNameInput.value = saved.lastName;
            if (saved.guestType) {
              const isExternal = saved.guestType === 'external';
              toggleInput.checked = isExternal;
              // Trigger visual update
              if (isExternal) {
                toggleSlider.style.backgroundColor = '#dc2626';
                toggleThumb.style.transform = 'translateX(20px)';
                toggleText.textContent = 'EXT';
                toggleText.style.color = '#dc2626';
              } else {
                toggleSlider.style.backgroundColor = '#059669';
                toggleThumb.style.transform = 'translateX(0)';
                toggleText.textContent = 'ÚTIA';
                toggleText.style.color = '#059669';
              }
            }
          }

          // Add input event listeners to remove red border when user starts typing
          const removeRedBorderToddler = (input) => {
            if (input.style.borderColor === 'rgb(239, 68, 68)' || input.style.borderColor === '#ef4444') {
              input.style.borderColor = '#d1d5db';
            }
          };

          firstNameInput.addEventListener('input', function() {
            removeRedBorderToddler(this);
          });

          lastNameInput.addEventListener('input', function() {
            removeRedBorderToddler(this);
          });

          // Free label
          const freeLabel = document.createElement('span');
          freeLabel.textContent = '(zdarma)';
          freeLabel.style.cssText = 'font-size: 0.7rem; color: #6b7280; white-space: nowrap;';

          row.appendChild(firstNameInput);
          row.appendChild(lastNameInput);
          row.appendChild(toggleContainer);
          row.appendChild(freeLabel);
          toddlersContainer.appendChild(row);
        }
      } else {
        toddlersContainer.style.display = 'none';
      }
    }
  }

  /**
   * Collect guest names from input fields
   * Validates that ALL fields are filled
   * @param {boolean} showValidationErrors - If true, shows error notifications (default: true)
   * @returns {Array|null} Array of guest name objects or null if validation fails
   */
  collectGuestNames(showValidationErrors = true) {
    const guestNames = [];
    const section = document.getElementById('singleRoomGuestNamesSection');

    if (!section || section.style.display === 'none') {
      return []; // No names section visible, return empty array
    }

    // If NOT showing validation errors (price update mode), collect only checkboxes
    if (!showValidationErrors) {
      // Collect guest type from toggle switches (checkboxes) only
      const guestTypeInputs = section.querySelectorAll('input[data-guest-price-type]');
      guestTypeInputs.forEach((input) => {
        const guestType = input.dataset.guestType; // adult, child, toddler
        // UI logic: Unchecked (false) = ÚTIA, Checked (true) = External
        const guestPriceType = input.checked ? 'external' : 'utia';

        // Create dummy guest for price calculation
        guestNames.push({
          personType: guestType,
          guestPriceType: guestPriceType,
          firstName: '', // Empty for price update mode
          lastName: ''
        });
      });

      return guestNames;
    }

    // FULL VALIDATION MODE (when submitting)
    // Collect all inputs with data-guest-type attribute (text inputs for names)
    const inputs = section.querySelectorAll('input[data-guest-type]:not([data-guest-price-type])');

    // Group inputs by guest type and index
    const guestMap = new Map();

    inputs.forEach((input) => {
      const guestType = input.dataset.guestType;
      const guestIndex = input.dataset.guestIndex;
      const key = `${guestType}-${guestIndex}`;

      if (!guestMap.has(key)) {
        guestMap.set(key, { personType: guestType });
      }

      const guest = guestMap.get(key);
      const value = input.value.trim();

      // Validate: all fields must be filled
      if (!value || value.length < 2) {
        input.style.borderColor = '#ef4444';
        return null; // Validation failed
      }

      // Reset border color
      input.style.borderColor = '#d1d5db';

      // Determine if this is firstName or lastName based on ID
      if (input.id.includes('FirstName')) {
        guest.firstName = value;
      } else if (input.id.includes('LastName')) {
        guest.lastName = value;
      }
    });

    // Collect guest type for each guest from toggle switches (checkboxes)
    const guestTypeInputs = section.querySelectorAll('input[data-guest-price-type]');
    guestTypeInputs.forEach((input) => {
      const guestType = input.dataset.guestType;
      const guestIndex = input.dataset.guestIndex;
      const key = `${guestType}-${guestIndex}`;

      if (guestMap.has(key)) {
        const guest = guestMap.get(key);
        // UI logic: Unchecked (false) = ÚTIA, Checked (true) = External
        guest.guestPriceType = input.checked ? 'external' : 'utia';
      }
    });

    // Convert map to array and validate completeness
    for (const [key, guest] of guestMap) {
      if (!guest.firstName || !guest.lastName) {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? 'Vyplňte všechna jména hostů (křestní i příjmení)'
            : 'Fill in all guest names (first and last name)',
          'error'
        );
        return null; // Incomplete guest data
      }

      // Validate that guest type is set
      if (!guest.guestPriceType) {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? 'Vyberte typ hosta (ÚTIA/Externí) pro všechny hosty'
            : 'Select guest type (ÚTIA/External) for all guests',
          'error'
        );
        return null; // Missing guest type
      }

      guestNames.push(guest);
    }

    return guestNames;
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
      const startDate = this.app.selectedDates.size > 0
        ? Array.from(this.app.selectedDates).sort()[0]
        : null;
      const endDate = this.app.selectedDates.size > 0
        ? Array.from(this.app.selectedDates).sort().pop()
        : null;

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
      const adults = guestNames.filter(g => g.type === 'adult').length;
      const children = guestNames.filter(g => g.type === 'child').length;
      const toddlers = guestNames.filter(g => g.type === 'toddler').length;

      // FIX: Determine actual guest type based on whether ANY guest is ÚTIA
      // This MUST be calculated BEFORE creating perRoomGuests
      const hasUtiaGuest = guestNames && guestNames.length > 0
        ? guestNames.some(guest => guest.guestPriceType === 'utia')
        : true;  // FIX 2025-11-07: Default to ÚTIA when no guests yet (matches default radio selection)
      const actualGuestType = hasUtiaGuest ? 'utia' : 'external';

      // FIX 2025-11-07: Store actualGuestType in app.roomGuestTypes so utils.js can access it
      this.app.roomGuestTypes.set(roomId, actualGuestType);

      // Construct perRoomGuests object for single room
      const perRoomGuests = {
        [roomId]: {
          adults,
          children,
          toddlers,
          guestType: actualGuestType  // FIX: Use actualGuestType instead of fallbackGuestType
        }
      };

      // Calculate price using PER-GUEST method
      const price = PriceCalculator.calculatePerGuestPrice({
        rooms: [roomId],
        guestNames: guestNames,
        perRoomGuests: perRoomGuests, // FIX: Pass per-room guest type data to prevent fallback warning
        nights: nights,
        settings: settings,
        fallbackGuestType: fallbackGuestType
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
    const room = settings.rooms?.find(r => r.id === roomId);
    const roomType = room?.type || 'small';

    // Determine actual guest type based on whether ANY guest is ÚTIA
    const hasUtiaGuest = guestNames && guestNames.length > 0
      ? guestNames.some(guest => guest.guestPriceType === 'utia')
      : true;  // FIX 2025-11-07: Default to ÚTIA when no guests yet (matches default radio selection)
    const actualGuestType = hasUtiaGuest ? 'utia' : 'external';

    // Count guests by person type and price type
    let utiaAdults = 0;
    let utiaChildren = 0;
    let externalAdults = 0;
    let externalChildren = 0;
    let toddlers = 0;

    for (const guest of guestNames) {
      const priceType = guest.guestPriceType || 'external';
      const personType = guest.personType;

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

    // Get empty room price (NEW MODEL: base/empty = prázdný pokoj)
    const actualPriceConfig = actualGuestType === 'utia' ? utiaPrices : externalPrices;
    // FIX 2025-11-07: Try both 'base' and 'empty' property names for backward compatibility
    const emptyRoomPrice = actualPriceConfig.base ?? actualPriceConfig.empty ?? 0;

    // Update base price display
    const basePriceElement = document.getElementById('basePrice');
    if (basePriceElement) {
      const basePriceText = `${emptyRoomPrice.toLocaleString('cs-CZ')} Kč${hasUtiaGuest ? ' (ÚTIA)' : ' (EXT)'}`;
      basePriceElement.textContent = basePriceText;
    }

    // Update guest counts summary
    const guestCountsElement = document.getElementById('guestCountsSummary');
    if (guestCountsElement) {
      let text = `${totalAdults} dosp.`;
      if (totalChildren > 0) text += `, ${totalChildren} děti`;
      if (toddlers > 0) text += `, ${toddlers} bat.`;
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
      let text = `${totalAdults} dosp.`;
      if (totalChildren > 0) text += `, ${totalChildren} děti`;
      if (toddlers > 0) text += `, ${toddlers} bat.`;
      guestSummary.textContent = text;
    }

    // Update nights display in header if it exists
    const nightsElement = document.querySelector('#singleRoomBookingModal .nights-count');
    if (nightsElement) {
      nightsElement.textContent = `× ${nights}`;
    }
  }
}
