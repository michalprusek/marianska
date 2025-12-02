// Main BookingApp class - orchestrates all modules
class BookingApp {
  constructor() {
    // Initialize state
    this.currentMonth = new Date();
    this.selectedDates = new Set();
    this.selectedRooms = new Set();
    this.roomGuests = new Map();
    this.roomGuestTypes = new Map();
    // Sync with LanguageManager - ensure consistency
    this.currentLanguage = langManager
      ? langManager.currentLang
      : localStorage.getItem('language') || 'cs';
    this.recentlyBookedRooms = [];
    this.tempReservations = [];
    this.editingReservation = null; // Tracks reservation being edited (null = new reservation)

    // Generate or retrieve session ID for proposed bookings
    this.sessionId = sessionStorage.getItem('bookingSessionId');
    if (!this.sessionId) {
      this.sessionId = this.generateSessionId();
      sessionStorage.setItem('bookingSessionId', this.sessionId);
    }

    // Calendar boundaries
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);

    // Year range configuration per mode:
    // - Main calendar (GRID): previous year + current year + next year
    // - Other modes (SINGLE_ROOM, BULK, EDIT): current year + next year only
    const currentYear = this.today.getFullYear();
    this.gridMinYear = currentYear - 1;
    this.gridMaxYear = currentYear + 1;
    this.otherMinYear = currentYear;
    this.otherMaxYear = currentYear + 1;

    // Default to grid mode boundaries (main calendar)
    this.minYear = this.gridMinYear;
    this.maxYear = this.gridMaxYear;
    this.maxMonth = 11; // December

    // Single room booking state
    this.currentBookingRoom = null;
    this.firstSelectedDate = null;
    this.isDragging = false;
    this.dragStartDate = null;
    this.dragEndDate = null;
    this.dragClickStart = null;

    // Initialize modules
    this.calendar = new CalendarModule(this);
    this.singleRoomBooking = new SingleRoomBookingModule(this);
    this.bulkBooking = new BulkBookingModule(this);
    this.bookingForm = new BookingFormModule(this);
    this.utils = new UtilsModule(this);
  }

  /**
   * @deprecated Use IdGenerator.generateSessionId() directly instead.
   * This wrapper exists for backward compatibility only.
   */
  generateSessionId() {
    return IdGenerator.generateSessionId();
  }

  async init() {
    // Initialize data storage
    await dataManager.initData();

    // Load room configuration for bulk booking display
    const settings = await dataManager.getSettings();
    window.roomsConfig = settings.rooms || [];

    // Load proposed bookings from database for this session
    await this.loadSessionProposedBookings();

    // Setup event listeners
    this.setupEventListeners();

    // Initial render
    await this.renderCalendar();
    this.updateTranslations();

    // Display loaded proposed bookings
    await this.displayTempReservations();

    // Setup global mouse up handler for drag selection
    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.dragStartDate = null;
        this.dragEndDate = null;
      }
    });

    // Start periodic check for expired proposed bookings (every 30 seconds)
    this.startProposedBookingCleanupMonitor();

    // Cleanup proposed bookings when user leaves the page (if they didn't finalize)
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  /**
   * Cleanup method called when page is being unloaded
   * Ensures proper cleanup of intervals and proposed bookings
   */
  cleanup() {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Start periodic monitoring for expired proposed bookings
   * Checks every 30 seconds and removes expired proposals from UI + calendar
   */
  startProposedBookingCleanupMonitor() {
    // Check immediately on init
    this.checkAndCleanExpiredProposedBookings();

    // Then check every 30 seconds
    this.cleanupInterval = setInterval(async () => {
      await this.checkAndCleanExpiredProposedBookings();
    }, 30000); // 30 seconds (sync with dataManager auto-sync)
  }

  /**
   * Check for expired proposed bookings and remove them from UI + calendar
   * This ensures that when server deletes expired proposals, the UI reflects the change
   */
  async checkAndCleanExpiredProposedBookings() {
    if (!this.tempReservations || this.tempReservations.length === 0) {
      return; // No temp reservations to check
    }

    try {
      // Fetch active proposed bookings from server
      const response = await fetch(
        `${dataManager.apiUrl}/proposed-bookings/session/${this.sessionId}`
      );

      if (!response.ok) {
        return; // Failed to fetch - skip cleanup
      }

      const activeProposalIds = (await response.json()).map((pb) => pb.proposal_id);

      // Find expired proposals (those that exist in UI but not in server response)
      const expiredProposals = this.tempReservations.filter(
        (tempRes) => tempRes.proposalId && !activeProposalIds.includes(tempRes.proposalId)
      );

      if (expiredProposals.length > 0) {
        // Remove expired proposals from temp reservations
        this.tempReservations = this.tempReservations.filter((tempRes) =>
          activeProposalIds.includes(tempRes.proposalId)
        );

        // Invalidate proposed bookings cache to force fresh fetch
        dataManager.invalidateProposedBookingsCache();

        // Update UI and calendar
        await this.displayTempReservations();

        // Show notification to user
        this.showNotification(
          this.currentLanguage === 'cs'
            ? `${expiredProposals.length} navrhovaná rezervace vypršela a byla odstraněna`
            : `${expiredProposals.length} proposed reservation(s) expired and were removed`,
          'info',
          5000
        );
      }
    } catch (error) {
      console.error('Error checking for expired proposed bookings:', error);
      // Silent fail - will retry on next interval
    }
  }

  async loadSessionProposedBookings() {
    try {
      const response = await fetch(
        `${dataManager.apiUrl}/proposed-bookings/session/${this.sessionId}`
      );
      if (response.ok) {
        const proposedBookings = await response.json();

        // Get all rooms once for efficiency
        const allRooms = await dataManager.getRooms();

        // Convert proposed bookings to tempReservations format
        for (const proposed of proposedBookings) {
          // Rooms is already an array from database.js
          const rooms = Array.isArray(proposed.rooms) ? proposed.rooms : [];

          // Check if this is a bulk booking (all rooms)
          const isBulkBooking = rooms.length === allRooms.length;

          if (isBulkBooking) {
            // Bulk booking format
            this.tempReservations.push({
              id: proposed.proposal_id,
              isBulkBooking: true,
              roomIds: rooms,
              roomNames: allRooms.map((r) => r.name).join(', '),
              startDate: proposed.start_date,
              endDate: proposed.end_date,
              nights: this.calculateNights(proposed.start_date, proposed.end_date),
              proposalId: proposed.proposal_id,
              guests: {
                adults: proposed.adults || 0,
                children: proposed.children || 0,
                toddlers: proposed.toddlers || 0,
              },
              guestType: proposed.guest_type || 'external',
              totalPrice: proposed.total_price || 0,
            });
          } else {
            // Single room booking format
            // eslint-disable-next-line max-depth -- Deep nesting required for nested booking data structure
            for (const roomId of rooms) {
              const room = allRooms.find((r) => r.id === roomId);
              // eslint-disable-next-line max-depth -- Deep nesting required for nested booking data structure
              if (room) {
                this.tempReservations.push({
                  id: `${proposed.proposal_id}-${roomId}`,
                  roomId,
                  roomName: room.name,
                  startDate: proposed.start_date,
                  endDate: proposed.end_date,
                  nights: this.calculateNights(proposed.start_date, proposed.end_date),
                  proposalId: proposed.proposal_id,
                  guests: {
                    adults: proposed.adults || 0,
                    children: proposed.children || 0,
                    toddlers: proposed.toddlers || 0,
                  },
                  guestType: proposed.guest_type || 'external',
                  totalPrice: proposed.total_price || 0,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load session proposed bookings:', error);
    }
  }

  calculateNights(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }

  setupEventListeners() {
    // Navigation buttons
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.calendar.navigateMonth(-1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.calendar.navigateMonth(1));
    }

    // Legend toggle
    const legendToggle = document.getElementById('legendToggle');
    if (legendToggle) {
      legendToggle.addEventListener('click', () => this.calendar.toggleLegend());
    }

    // Booking button
    const bookingBtn = document.getElementById('makeBookingBtn');
    if (bookingBtn) {
      bookingBtn.addEventListener('click', () => this.showBookingModal());
    }

    // Booking form modal close button
    const bookingFormCloseBtn = document.getElementById('bookingFormModalClose');
    if (bookingFormCloseBtn) {
      bookingFormCloseBtn.addEventListener('click', () => this.bookingForm.hideBookingFormModal());
    }

    // Bulk booking button (bulkActionBtn is the actual ID)
    const bulkBtn = document.getElementById('bulkActionBtn');
    if (bulkBtn) {
      bulkBtn.addEventListener('click', () => {
        try {
          this.bulkBooking.showBulkBookingModal();
        } catch (error) {
          console.error('Error showing bulk booking modal:', error);
        }
      });
    } else {
      console.error('Bulk booking button not found');
    }

    // Room info button
    const roomInfoBtn = document.getElementById('roomInfoBtn');
    if (roomInfoBtn) {
      roomInfoBtn.addEventListener('click', async () => {
        await this.loadRoomInfo();
        const modal = document.getElementById('roomInfoModal');
        if (modal) {
          modal.classList.add('active');
        }
      });
    }

    // Admin button
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        window.location.href = '/admin.html';
      });
    }

    // Language switcher
    const languageSwitch = document.getElementById('languageSwitch');
    if (languageSwitch) {
      languageSwitch.addEventListener('change', (e) => {
        const lang = e.target.checked ? 'en' : 'cs';
        // Update language using the LanguageManager
        langManager.switchLanguage(lang);
        // Update app's current language
        this.currentLanguage = lang;
        // Update ARIA state for accessibility
        languageSwitch.setAttribute('aria-checked', e.target.checked ? 'true' : 'false');
        // Refresh dynamic content (room info, calendar)
        this.refreshDynamicContent();
      });
      // Set initial state
      languageSwitch.checked = this.currentLanguage === 'en';
      languageSwitch.setAttribute('aria-checked', this.currentLanguage === 'en' ? 'true' : 'false');
    }

    // Single room booking modal events
    this.setupSingleRoomBookingEvents();

    // Bulk booking modal events
    this.setupBulkBookingEvents();

    // Main booking modal events
    this.setupMainBookingEvents();
  }

  setupSingleRoomBookingEvents() {
    // Mini calendar navigation
    const prevMini = document.getElementById('prevMiniMonth');
    const nextMini = document.getElementById('nextMiniMonth');

    if (prevMini) {
      prevMini.addEventListener('click', () => this.singleRoomBooking.navigateMiniCalendar(-1));
    }
    if (nextMini) {
      nextMini.addEventListener('click', () => this.singleRoomBooking.navigateMiniCalendar(1));
    }

    // Guest type change for booking form
    const guestTypeSelect = document.getElementById('bookingGuestType');
    if (guestTypeSelect) {
      guestTypeSelect.addEventListener('change', async () => {
        if (this.currentBookingRoom) {
          this.roomGuestTypes.set(this.currentBookingRoom, guestTypeSelect.value);
          await this.updatePriceCalculation();
        }
      });
    }

    // Guest type change for single room booking modal
    const singleRoomGuestRadios = document.querySelectorAll('input[name="singleRoomGuestType"]');
    singleRoomGuestRadios.forEach((radio) => {
      radio.addEventListener('change', async () => {
        if (this.currentBookingRoom) {
          this.roomGuestTypes.set(this.currentBookingRoom, radio.value);
          // FIX 2025-11-06: Use single room booking price update method
          if (this.singleRoomBooking) {
            await this.singleRoomBooking.updatePriceForCurrentRoom();
          } else {
            await this.updatePriceCalculation();
          }
        }
      });
    });

    // Guest count controls
    ['adults', 'children', 'toddlers'].forEach((type) => {
      const decreaseBtn = document.querySelector(`[data-action="decrease-${type}"]`);
      const increaseBtn = document.querySelector(`[data-action="increase-${type}"]`);

      if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => this.adjustGuests(type, -1));
      }
      if (increaseBtn) {
        increaseBtn.addEventListener('click', () => this.adjustGuests(type, 1));
      }
    });

    // Confirm and submit buttons
    const confirmDatesBtn = document.getElementById('confirmRoomDates');
    if (confirmDatesBtn) {
      confirmDatesBtn.addEventListener('click', () => this.bookingForm.showBookingForm());
    }

    const submitBtn = document.getElementById('submitRoomBooking');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.bookingForm.submitBooking());
    }

    // Back button
    const backBtn = document.getElementById('backToDateSelection');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.bookingForm.hideBookingForm());
    }

    // Form validation
    this.setupFormValidation();
  }

  setupBulkBookingEvents() {
    // Calendar navigation
    const prevBulk = document.getElementById('prevBulkMonth');
    const nextBulk = document.getElementById('nextBulkMonth');

    if (prevBulk) {
      prevBulk.addEventListener('click', () => this.bulkBooking.navigateBulkCalendar(-1));
    }
    if (nextBulk) {
      nextBulk.addEventListener('click', () => this.bulkBooking.navigateBulkCalendar(1));
    }

    // Guest count controls
    ['adults', 'children', 'toddlers'].forEach((type) => {
      const input = document.getElementById(`bulk${type.charAt(0).toUpperCase() + type.slice(1)}`);
      if (input) {
        input.addEventListener('change', () => {
          this.bulkBooking.updateBulkCapacityCheck();
          this.bulkBooking.updateBulkPriceCalculation();
        });
      }
    });

    // Confirm and submit buttons
    const confirmBtn = document.getElementById('confirmBulkDates');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.bulkBooking.confirmBulkDates());
    }

    const submitBtn = document.getElementById('submitBulkBooking');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.bulkBooking.submitBulkBooking());
    }

    // Back button
    const backBtn = document.getElementById('backToBulkDateSelection');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.bulkBooking.backToBulkDateSelection());
    }
  }

  setupMainBookingEvents() {
    // This would handle the main booking modal if implemented
  }

  setupFormValidation() {
    // Phone validation
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach((input) => {
      input.addEventListener('input', () => this.bookingForm.validatePhoneNumber(input));
    });

    // ZIP code validation
    const zipInput = document.getElementById('bookingZip');
    if (zipInput) {
      zipInput.addEventListener('input', () => this.bookingForm.validateZipCode(zipInput));
    }

    // ICO validation
    const icoInput = document.getElementById('bookingICO');
    if (icoInput) {
      icoInput.addEventListener('input', () => this.bookingForm.validateICO(icoInput));
    }

    // DIC validation
    const dicInput = document.getElementById('bookingDIC');
    if (dicInput) {
      dicInput.addEventListener('input', () => this.bookingForm.validateDIC(dicInput));
    }
  }

  // Guest adjustment
  async adjustGuests(type, change) {
    if (!this.currentBookingRoom) {
      return;
    }

    const guests = this.roomGuests.get(this.currentBookingRoom) || {
      adults: 1,
      children: 0,
      toddlers: 0,
      guestType: 'utia', // NEW 2025-11-04: Default guest type
    };

    // Calculate new value
    const newValue = guests[type] + change;

    // Check minimum values - allow temporarily setting 0 adults/children
    // Validation will happen at proposal creation time
    if (newValue < 0) {
      return; // Can't have negative values
    }

    // Check room capacity (toddlers don't count towards capacity)
    const rooms = await dataManager.getRooms();
    const room = rooms.find((r) => r.id === this.currentBookingRoom);
    if (room && type !== 'toddlers') {
      const currentOthers = type === 'adults' ? guests.children : guests.adults;
      const newTotal = newValue + currentOthers;

      if (newTotal > room.beds) {
        this.showNotification(
          this.currentLanguage === 'cs'
            ? `${room.name} má kapacitu pouze ${room.beds} lůžek (batolata se nepočítají)`
            : `${room.name} has capacity of only ${room.beds} beds (toddlers don't count)`,
          'warning'
        );
        return;
      }
    }

    // Update the value
    guests[type] = newValue;
    this.roomGuests.set(this.currentBookingRoom, guests);

    // Update display - check for both single room and general IDs
    const singleRoomEl = document.getElementById(
      `singleRoom${type.charAt(0).toUpperCase() + type.slice(1)}`
    );
    const generalEl = document.getElementById(`${type}Count`);

    if (singleRoomEl) {
      singleRoomEl.textContent = guests[type].toString();
    }
    if (generalEl) {
      generalEl.value = guests[type].toString();
    }

    // FIX 2025-11-06: Use single room booking price update method instead of general updatePriceCalculation
    // This ensures correct price calculation using NEW pricing model (empty room + ALL guests pay)
    if (this.currentBookingRoom && this.singleRoomBooking) {
      // Regenerate guest name input fields FIRST (before price update)
      this.singleRoomBooking.generateGuestNamesInputs(
        guests.adults,
        guests.children,
        guests.toddlers
      );

      // Then update price using single room booking method
      await this.singleRoomBooking.updatePriceForCurrentRoom();
    } else {
      // Fallback to general price calculation if not in single room booking mode
      await this.updatePriceCalculation();
    }

    // KRITICKÉ: Po změně počtu hostů přepočítat cenu v single room modalu
    // Toto zajistí, že když uživatel odebere ÚTIA hosta a zůstane jen external,
    // cena se automaticky přepočítá na external pricing
    if (this.singleRoomBooking && this.singleRoomBooking.updatePriceForCurrentRoom) {
      try {
        await this.singleRoomBooking.updatePriceForCurrentRoom();
      } catch (error) {
        console.error('Failed to update price after guest count change:', error);
        // Notify user of price update failure
        if (this.showNotification) {
          this.showNotification(
            'Nepodařilo se aktualizovat cenu. Zkuste obnovit stránku.',
            'warning',
            4000
          );
        }
      }
    }
  }

  // Set guest type for current room (NEW 2025-11-04: Per-room guest type)
  async setRoomGuestType(guestType) {
    if (!this.currentBookingRoom) {
      return;
    }

    // Get current guests data
    const guests = this.roomGuests.get(this.currentBookingRoom) || {
      adults: 1,
      children: 0,
      toddlers: 0,
      guestType: 'utia', // Default
    };

    // Update guest type
    guests.guestType = guestType;
    this.roomGuests.set(this.currentBookingRoom, guests);

    // Update price calculation with new guest type
    await this.updatePriceCalculation();
  }

  // Main booking modal
  showBookingModal() {
    if (this.selectedDates.size === 0 || this.selectedRooms.size === 0) {
      this.showNotification(
        this.currentLanguage === 'cs'
          ? 'Vyberte prosím termín a pokoje'
          : 'Please select dates and rooms',
        'warning'
      );
      return;
    }

    const modal = document.getElementById('bookingModal');
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));
  }

  // Delegated methods
  async renderCalendar() {
    await this.calendar.renderCalendar();
    this.updateBookingButton();
  }

  // eslint-disable-next-line no-unused-vars
  async toggleRoomSelection(date, roomId, _element) {
    // Open single room booking modal instead of the old selection
    await this.showRoomBookingModal(roomId);
  }

  // Check if date is in selected range
  isDateInSelectedRange(dateStr) {
    if (!this.firstSelectedDate || !this.dragEndDate) {
      return this.firstSelectedDate === dateStr;
    }

    const date = new Date(dateStr);
    const startDate = new Date(
      Math.min(new Date(this.firstSelectedDate), new Date(this.dragEndDate))
    );
    const endDate = new Date(
      Math.max(new Date(this.firstSelectedDate), new Date(this.dragEndDate))
    );

    return date >= startDate && date <= endDate;
  }

  async showBookingDetails(date, roomId) {
    try {
      await this.utils.showBookingDetails(date, roomId);
    } catch (error) {
      console.error('Error showing booking details:', error);
      this.showNotification(
        this.currentLanguage === 'cs'
          ? 'Chyba při načítání detailu rezervace'
          : 'Error loading booking details',
        'error'
      );
    }
  }

  showBlockedReason(availability) {
    this.utils.showBlockedReason(availability);
  }

  async showBlockedDetails(date, roomId) {
    try {
      const blockedDetails = await dataManager.getBlockedDateDetails(date, roomId);

      if (blockedDetails) {
        this.utils.showBlockedReason(blockedDetails);
      } else {
        // Fallback if no details found
        const fallbackDetails = {
          reason:
            this.currentLanguage === 'cs'
              ? 'Tento termín je administrativně blokován'
              : 'This date is administratively blocked',
        };
        this.utils.showBlockedReason(fallbackDetails);
      }
    } catch (error) {
      console.error('Error showing blocked details:', error);
      this.showNotification(
        this.currentLanguage === 'cs'
          ? 'Chyba při načítání detailu blokace'
          : 'Error loading blocked details',
        'error'
      );
    }
  }

  showNotification(message, type, duration) {
    this.utils.showNotification(message, type, duration);
  }

  updateBookingButton() {
    this.utils.updateBookingButton();
  }

  updateSelectedDatesDisplay() {
    this.utils.updateSelectedDatesDisplay();
  }

  updatePriceCalculation() {
    return this.utils.updatePriceCalculation();
  }

  updateTranslations() {
    this.utils.updateTranslations();
  }

  formatDateDisplay(date) {
    return this.utils.formatDateDisplay(date);
  }

  getDateRanges(dates) {
    return this.utils.getDateRanges(dates);
  }

  showRoomBookingModal(roomId) {
    this.singleRoomBooking.showRoomBookingModal(roomId);
  }

  /**
   * Consolidate consecutive same-room bookings for display
   * @param {Array} reservations - Array of temp reservations
   * @returns {Array} Consolidated reservations
   */
  consolidateTempReservations(reservations) {
    if (!reservations || reservations.length === 0) {
      return [];
    }

    // Group by roomId (or roomIds for bulk bookings)
    const roomGroups = new Map();

    reservations.forEach((booking) => {
      const key = booking.isBulkBooking
        ? `BULK_${booking.roomIds?.sort().join(',')}`
        : booking.roomId;

      if (!roomGroups.has(key)) {
        roomGroups.set(key, []);
      }
      roomGroups.get(key).push(booking);
    });

    // Consolidate each room group if dates are consecutive
    const consolidated = [];

    for (const [, bookings] of roomGroups) {
      if (bookings.length === 1) {
        // No consolidation needed - single booking for this room
        consolidated.push(bookings[0]);
        continue;
      }

      // Sort by start date
      bookings.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

      let current = { ...bookings[0] };
      for (let i = 1; i < bookings.length; i++) {
        const next = bookings[i];

        // Check if dates are consecutive (current.endDate + 1 day === next.startDate)
        const currentEnd = new Date(current.endDate);
        const nextStart = new Date(next.startDate);
        const nextDay = new Date(currentEnd);
        nextDay.setDate(nextDay.getDate() + 1);

        const isConsecutive =
          nextDay.toISOString().split('T')[0] === nextStart.toISOString().split('T')[0];

        if (isConsecutive && current.guestType === next.guestType) {
          // Merge consecutive bookings
          current.endDate = next.endDate;
          current.nights += next.nights;
          current.totalPrice += next.totalPrice;
          // Keep same guests (they should be identical for same room)
          // Store original IDs for potential removal
          if (!current.consolidatedIds) {
            current.consolidatedIds = [current.id];
          }
          current.consolidatedIds.push(next.id);
        } else {
          // Not consecutive or different guest type - push current and start new
          consolidated.push(current);
          current = { ...next };
        }
      }

      // Push the last booking
      consolidated.push(current);
    }

    return consolidated;
  }

  async displayTempReservations() {
    const sectionDiv = document.getElementById('tempReservationsSection');
    const containerDiv = document.getElementById('tempReservationsContainer');
    const listDiv = document.getElementById('tempReservationsList');
    const totalPriceSpan = document.getElementById('tempReservationsTotalPrice');

    if (!containerDiv || !listDiv) {
      return;
    }

    // Show/hide entire section based on whether we have reservations
    if (!this.tempReservations || this.tempReservations.length === 0) {
      // Hide the entire booking section
      if (sectionDiv) {
        sectionDiv.style.display = 'none';
      }
      containerDiv.style.display = 'none';
      if (listDiv) {
        listDiv.innerHTML = '';
      }
      if (totalPriceSpan) {
        totalPriceSpan.textContent = '0 Kč';
      }
      // Update calendar to clear any red highlighting when no temp reservations
      if (this.calendar) {
        await this.calendar.renderCalendar();
      }
      return;
    }

    // Show the entire section and container
    if (sectionDiv) {
      sectionDiv.style.display = 'block';
    }
    containerDiv.style.display = 'block';

    // Consolidate consecutive same-room bookings for display
    const displayBookings = this.consolidateTempReservations(this.tempReservations);

    let html = '';
    let totalPrice = 0;

    displayBookings.forEach((booking) => {
      const dateStart = new Date(booking.startDate);
      const dateEnd = new Date(booking.endDate);
      totalPrice += booking.totalPrice;

      const guestText = [];
      let adultsLabel;
      if (this.currentLanguage === 'cs') {
        adultsLabel = booking.guests.adults === 1 ? 'dospělý' : 'dospělí';
      } else {
        adultsLabel = booking.guests.adults === 1 ? 'adult' : 'adults';
      }
      guestText.push(`${booking.guests.adults} ${adultsLabel}`);
      if (booking.guests.children > 0) {
        let childrenLabel;
        if (this.currentLanguage === 'cs') {
          childrenLabel = booking.guests.children === 1 ? 'dítě' : 'děti';
        } else {
          childrenLabel = booking.guests.children === 1 ? 'child' : 'children';
        }
        guestText.push(`${booking.guests.children} ${childrenLabel}`);
      }
      if (booking.guests.toddlers > 0) {
        let toddlersLabel;
        if (this.currentLanguage === 'cs') {
          toddlersLabel = booking.guests.toddlers === 1 ? 'batole' : 'batolata';
        } else {
          toddlersLabel = booking.guests.toddlers === 1 ? 'toddler' : 'toddlers';
        }
        guestText.push(`${booking.guests.toddlers} ${toddlersLabel}`);
      }

      let nightsLabel;
      if (this.currentLanguage === 'cs') {
        if (booking.nights === 1) {
          nightsLabel = 'noc';
        } else if (booking.nights < 5) {
          nightsLabel = 'noci';
        } else {
          nightsLabel = 'nocí';
        }
      } else {
        nightsLabel = booking.nights === 1 ? 'night' : 'nights';
      }
      const nightsText = `${booking.nights} ${nightsLabel}`;

      let guestTypeText;
      if (booking.guestType === 'utia') {
        guestTypeText = this.currentLanguage === 'cs' ? 'ÚTIA zaměstnanec' : 'ÚTIA employee';
      } else {
        guestTypeText = this.currentLanguage === 'cs' ? 'Externí host' : 'External guest';
      }

      // Different display for bulk bookings
      if (booking.isBulkBooking) {
        html += `
          <div class="temp-reservation-item" style="background: linear-gradient(135deg, #f3e8ff, #fff8f0); border: 2px solid #8b5cf6; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; width: 100%;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <span style="background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${this.currentLanguage === 'cs' ? 'HROMADNÁ' : 'BULK'}</span>
                  <strong style="color: #8b5cf6; font-size: 1.1rem;">🏠 ${this.currentLanguage === 'cs' ? `Celá chata (${booking.roomIds.length} pokojů)` : `Entire chalet (${booking.roomIds.length} rooms)`}</strong>
                </div>
                <div style="background: white; padding: 0.75rem; border-radius: 6px; border: 1px solid #e0e0e0;">
                  <div style="color: var(--gray-700); font-size: 0.95rem; margin-bottom: 0.5rem;">
                    📅 ${dateStart.toLocaleDateString(this.currentLanguage === 'cs' ? 'cs-CZ' : 'en-US')} - ${dateEnd.toLocaleDateString(this.currentLanguage === 'cs' ? 'cs-CZ' : 'en-US')}
                    <span style="color: var(--primary-color); font-weight: 600;">(${nightsText})</span>
                  </div>
                  <div style="font-size: 0.9rem; color: var(--gray-600); margin-bottom: 0.5rem;">
                    👥 ${guestText.join(', ')}
                  </div>
                  ${
                    booking.guestNames && booking.guestNames.length > 0
                      ? `
                  <div style="font-size: 0.9rem; color: var(--gray-600); margin-bottom: 0.5rem;">
                    👤 ${booking.guestNames[0].firstName} ${booking.guestNames[0].lastName}${booking.guestNames.length > 1 ? ` +${booking.guestNames.length - 1} ${this.currentLanguage === 'cs' ? 'další' : 'other'}` : ''}
                  </div>
                  `
                      : ''
                  }
                  <div style="font-size: 0.9rem; color: var(--gray-600);">
                    🏷️ Typ: <span style="font-weight: 600;">${guestTypeText}</span>
                  </div>
                  <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e0e0e0;">
                    <div style="font-size: 0.85rem; color: var(--gray-500);">${this.currentLanguage === 'cs' ? 'Cena za pobyt:' : 'Price for stay:'}</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #8b5cf6;">
                      ${booking.totalPrice.toLocaleString('cs-CZ')} Kč
                    </div>
                  </div>
                </div>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: start;">
                <button
                  onclick="window.app.editTempReservation('${booking.id}')"
                  style="padding: 0.5rem 0.75rem; background: white; color: #8b5cf6; border: 1px solid #8b5cf6; border-radius: 6px; cursor: pointer; transition: all 0.2s; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 600;"
                  title="${this.currentLanguage === 'cs' ? 'Upravit rezervaci' : 'Edit reservation'}"
                  onmouseover="this.style.background='#8b5cf6'; this.style.color='white';"
                  onmouseout="this.style.background='white'; this.style.color='#8b5cf6';"
                >
                  ✏️
                </button>
                <button
                  onclick="window.app.removeTempReservation('${booking.id}')"
                  style="padding: 0.5rem; background: white; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 6px; cursor: pointer; transition: all 0.2s; min-width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"
                  title="${this.currentLanguage === 'cs' ? 'Odebrat rezervaci' : 'Remove reservation'}"
                  onmouseover="this.style.background='var(--danger-color)'; this.style.color='white';"
                  onmouseout="this.style.background='white'; this.style.color='var(--danger-color)';"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        `;
      } else {
        // Regular single room booking display
        html += `
          <div class="temp-reservation-item" style="background: #fff8f0; border: 1px solid #ffd4a3; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; width: 100%;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <span style="background: #ff4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${this.currentLanguage === 'cs' ? 'NAVRHOVANÁ' : 'PROPOSED'}</span>
                  <strong style="color: var(--primary-color); font-size: 1.1rem;">${booking.roomName}</strong>
                </div>
                <div style="background: white; padding: 0.75rem; border-radius: 6px; border: 1px solid #e0e0e0;">
                  <div style="color: var(--gray-700); font-size: 0.95rem; margin-bottom: 0.5rem;">
                    📅 ${dateStart.toLocaleDateString(this.currentLanguage === 'cs' ? 'cs-CZ' : 'en-US')} - ${dateEnd.toLocaleDateString(this.currentLanguage === 'cs' ? 'cs-CZ' : 'en-US')}
                    <span style="color: var(--primary-color); font-weight: 600;">(${nightsText})</span>
                  </div>
                  <div style="font-size: 0.9rem; color: var(--gray-600); margin-bottom: 0.5rem;">
                    👥 ${guestText.join(', ')}
                  </div>
                  ${
                    booking.guestNames && booking.guestNames.length > 0
                      ? `
                  <div style="font-size: 0.9rem; color: var(--gray-600); margin-bottom: 0.5rem;">
                    👤 ${booking.guestNames[0].firstName} ${booking.guestNames[0].lastName}${booking.guestNames.length > 1 ? ` +${booking.guestNames.length - 1} ${this.currentLanguage === 'cs' ? 'další' : 'other'}` : ''}
                  </div>
                  `
                      : ''
                  }
                  <div style="font-size: 0.9rem; color: var(--gray-600);">
                    🏷️ Typ: <span style="font-weight: 600;">${guestTypeText}</span>
                  </div>
                  <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e0e0e0;">
                    <div style="font-size: 0.85rem; color: var(--gray-500);">${this.currentLanguage === 'cs' ? 'Cena za pobyt:' : 'Price for stay:'}</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary-color);">
                      ${booking.totalPrice.toLocaleString('cs-CZ')} Kč
                    </div>
                  </div>
                </div>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: start;">
                <button
                  onclick="window.app.editTempReservation('${booking.id}')"
                  style="padding: 0.5rem 0.75rem; background: white; color: var(--primary-color); border: 1px solid var(--primary-color); border-radius: 6px; cursor: pointer; transition: all 0.2s; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 600;"
                  title="${this.currentLanguage === 'cs' ? 'Upravit rezervaci' : 'Edit reservation'}"
                  onmouseover="this.style.background='var(--primary-color)'; this.style.color='white';"
                  onmouseout="this.style.background='white'; this.style.color='var(--primary-color)';"
                >
                  ✏️
                </button>
                <button
                  onclick="window.app.removeTempReservation('${booking.id}')"
                  style="padding: 0.5rem; background: white; color: var(--danger-color); border: 1px solid var(--danger-color); border-radius: 6px; cursor: pointer; transition: all 0.2s; min-width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"
                  title="${this.currentLanguage === 'cs' ? 'Odebrat rezervaci' : 'Remove reservation'}"
                  onmouseover="this.style.background='var(--danger-color)'; this.style.color='white';"
                  onmouseout="this.style.background='white'; this.style.color='var(--danger-color)';"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        `;
      }
    });

    listDiv.innerHTML = html;

    // Update total price
    if (totalPriceSpan) {
      totalPriceSpan.textContent = `${totalPrice.toLocaleString('cs-CZ')} Kč`;
    }

    // Show finalize button when there are reservations
    const finalizeDiv = document.getElementById('finalizeReservationsDiv');
    if (finalizeDiv) {
      finalizeDiv.style.display = this.tempReservations.length > 0 ? 'block' : 'none';
    }

    // Update calendar to show proposed reservations in red
    await this.calendar.renderCalendar();
  }

  async removeTempReservation(bookingId) {
    if (!this.tempReservations) {
      return;
    }

    // Find the reservation to remove
    const removedReservation = this.tempReservations.find((b) => b.id === bookingId);

    // Delete the proposed booking from database if it has a proposalId
    if (removedReservation && removedReservation.proposalId) {
      try {
        await dataManager.deleteProposedBooking(removedReservation.proposalId);
      } catch (error) {
        console.error('Failed to delete proposed booking:', error);
      }
    }

    // Remove it from the list
    this.tempReservations = this.tempReservations.filter((b) => b.id !== bookingId);

    // Update the display
    await this.displayTempReservations();

    // Hide finalize button and entire section if no reservations left
    if (this.tempReservations.length === 0) {
      const finalizeDiv = document.getElementById('finalizeReservationsDiv');
      if (finalizeDiv) {
        finalizeDiv.style.display = 'none';
      }

      const sectionDiv = document.getElementById('tempReservationsSection');
      if (sectionDiv) {
        sectionDiv.style.display = 'none';
      }

      const containerDiv = document.getElementById('tempReservationsContainer');
      if (containerDiv) {
        containerDiv.style.display = 'none';
      }

      // Clear the calendar highlighting when no temp reservations remain
      // Re-render the calendar to remove red highlighting
      if (this.calendar) {
        await this.calendar.renderCalendar();
      }
    }

    // Show notification with room name
    const roomName = removedReservation ? removedReservation.roomName : '';
    this.showNotification(
      this.currentLanguage === 'cs'
        ? `Rezervace pokoje ${roomName} byla odebrána`
        : `Reservation for room ${roomName} has been removed`,
      'info'
    );
  }

  /**
   * Edit a temporary reservation by re-opening the booking modal with pre-filled data.
   *
   * Flow:
   * 1. Find and remove the temp reservation from the list
   * 2. Delete associated proposed booking from database
   * 3. Restore booking modal state (dates, rooms, guests)
   * 4. Pre-fill guest names after DOM is ready
   *
   * @param {string} bookingId - The temporary reservation ID to edit
   */
  async editTempReservation(bookingId) {
    if (!this.tempReservations) {
      return;
    }

    // Find the reservation to edit
    const reservationToEdit = this.tempReservations.find((b) => b.id === bookingId);
    if (!reservationToEdit) {
      console.error('Temporary reservation not found at index:', bookingId);
      this.showNotification(
        this.currentLanguage === 'cs'
          ? 'Dočasná rezervace nebyla nalezena. Zkuste obnovit stránku.'
          : 'Temporary reservation not found. Please refresh the page.',
        'error',
        3000
      );
      return;
    }

    // FIX 2025-12-02: Store reference to reservation being edited (instead of deleting it)
    // This allows user to cancel edit without losing the reservation
    // Old reservation will be deleted only when user confirms (saves) changes
    this.editingReservation = reservationToEdit;

    // Check if this is a bulk booking or single room
    if (reservationToEdit.isBulkBooking) {
      // Open bulk booking modal with pre-filled data
      const { bulkBooking } = this;
      const modal = document.getElementById('bulkBookingModal');

      if (bulkBooking && modal) {
        // Set the dates
        bulkBooking.selectedStartDate = reservationToEdit.startDate;
        bulkBooking.selectedEndDate = reservationToEdit.endDate;

        // Set guest data
        bulkBooking.currentGuests = reservationToEdit.guests;
        bulkBooking.currentGuestType = reservationToEdit.guestType || 'external';

        // Open the modal
        modal.classList.add('active');

        // Trigger date confirmation to show the form
        await bulkBooking.confirmBulkDates();
      } else {
        console.error('Bulk booking modal or module not available');
        this.showNotification(
          this.currentLanguage === 'cs'
            ? 'Nelze otevřít hromadnou rezervaci. Zkuste obnovit stránku.'
            : 'Cannot open bulk booking. Please refresh the page.',
          'error',
          3000
        );
        return;
      }
    } else {
      // Open single room booking modal with pre-filled data
      const { singleRoomBooking } = this;
      if (singleRoomBooking) {
        const { roomId } = reservationToEdit;

        // Set the current booking room on app
        this.currentBookingRoom = roomId;

        // Clear and populate selectedDates Set with all dates in the range
        this.selectedDates.clear();
        const startDate = new Date(`${reservationToEdit.startDate}T12:00:00`);
        const endDate = new Date(`${reservationToEdit.endDate}T12:00:00`);
        const dayCount = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        for (let i = 0; i < dayCount; i += 1) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);
          const dateStr = DateUtils.formatDate(currentDate);
          this.selectedDates.add(dateStr);
        }

        // Add room to selectedRooms
        this.selectedRooms.clear();
        this.selectedRooms.add(roomId);

        // Set roomGuests Map with guest counts
        this.roomGuests.set(roomId, {
          adults: reservationToEdit.guests.adults || 0,
          children: reservationToEdit.guests.children || 0,
          toddlers: reservationToEdit.guests.toddlers || 0,
          guestType: reservationToEdit.guestType || 'external',
        });

        // Set roomGuestTypes Map
        this.roomGuestTypes.set(roomId, reservationToEdit.guestType || 'external');

        // Open the modal
        const modal = document.getElementById('singleRoomBookingModal');
        if (modal) {
          const modalTitle = document.getElementById('roomBookingTitle');
          const rooms = await dataManager.getRooms();
          const room = rooms.find((r) => r.id === roomId);

          if (room && modalTitle) {
            const roomName =
              this.currentLanguage === 'cs' ? room.name : room.name.replace('Pokoj', 'Room');
            modalTitle.textContent = `${this.currentLanguage === 'cs' ? 'Rezervace' : 'Book'} ${roomName}`;
          }

          modal.classList.add('active');
        }

        // Render the mini calendar
        await singleRoomBooking.renderMiniCalendar(roomId);

        // Update displays
        await this.updateSelectedDatesDisplay();
        await this.updatePriceCalculation();

        // Update guest count displays
        const adultsEl = document.getElementById('singleRoomAdults');
        const childrenEl = document.getElementById('singleRoomChildren');
        const toddlersEl = document.getElementById('singleRoomToddlers');

        if (adultsEl) {
          adultsEl.textContent = (reservationToEdit.guests.adults || 0).toString();
        }
        if (childrenEl) {
          childrenEl.textContent = (reservationToEdit.guests.children || 0).toString();
        }
        if (toddlersEl) {
          toddlersEl.textContent = (reservationToEdit.guests.toddlers || 0).toString();
        }

        // Set guest type radio button
        const guestType = reservationToEdit.guestType || 'external';
        const radioButton = document.querySelector(
          `input[name="singleRoomGuestType"][value="${guestType}"]`
        );
        if (radioButton) {
          radioButton.checked = true;
        }

        // Generate guest name inputs
        singleRoomBooking.generateGuestNamesInputs(
          reservationToEdit.guests.adults || 0,
          reservationToEdit.guests.children || 0,
          reservationToEdit.guests.toddlers || 0
        );

        // Pre-fill guest names if available
        // Note: requestAnimationFrame ensures DOM elements are rendered before we try to populate them.
        // This is more reliable than setTimeout with arbitrary delays, as it waits for the next browser
        // paint cycle when the DOM is guaranteed to be ready.
        if (reservationToEdit.guestNames && reservationToEdit.guestNames.length > 0) {
          requestAnimationFrame(() => {
            reservationToEdit.guestNames.forEach((guestName, index) => {
              const input = document.querySelector(`[data-guest-index="${index}"]`);
              if (input) {
                input.value = guestName.name || '';

                // Set guest type dropdown if it exists
                const guestTypeDropdown = document.querySelector(
                  `[data-guest-type-index="${index}"]`
                );
                if (guestTypeDropdown) {
                  guestTypeDropdown.value = guestName.guestPriceType || 'external';
                }
              }
            });
          });
        }

        // FIX 2025-12-02: Change button text to "Uložit" (Save) when editing
        const confirmBtn = document.getElementById('confirmSingleRoomBtn');
        if (confirmBtn) {
          confirmBtn.textContent = this.currentLanguage === 'cs' ? 'Uložit' : 'Save';
        }
      }
    }

    // Show notification - updated message for edit mode
    this.showNotification(
      this.currentLanguage === 'cs'
        ? 'Upravujete rezervaci - proveďte změny a klikněte Uložit'
        : 'Editing reservation - make changes and click Save',
      'info',
      4000
    );
  }

  // Finalize all temporary reservations - show booking form modal for contact details
  async finalizeAllReservations() {
    // Check if we have any temporary reservations
    if (!this.tempReservations || this.tempReservations.length === 0) {
      this.showNotification(
        this.currentLanguage === 'cs'
          ? 'Nejsou žádné rezervace k dokončení'
          : 'No reservations to finalize',
        'warning'
      );
      return;
    }

    // Show the booking form modal for contact details
    const modal = document.getElementById('bookingFormModal');
    if (!modal) {
      console.error('Booking form modal not found');
      return;
    }

    // Consolidate consecutive same-room bookings for display
    const displayReservations = this.consolidateTempReservations(this.tempReservations);

    // Prepare summary for the booking form modal
    const summaryEl = document.getElementById('bookingSummary');
    if (summaryEl) {
      let summaryHTML = '';
      let totalPrice = 0;

      // Group reservations by type
      displayReservations.forEach((reservation) => {
        totalPrice += reservation.totalPrice;

        if (reservation.isBulkBooking) {
          // Bulk booking summary
          summaryHTML += `
            <div style="padding: 0.75rem; background: linear-gradient(135deg, #f3e8ff, #fef3ff); border: 1px solid #8b5cf6; border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong style="color: #8b5cf6;">🏠 Hromadná rezervace celé chaty</strong><br>
                  <span style="font-size: 0.9rem; color: var(--gray-600);">
                    ${reservation.startDate} → ${reservation.endDate} (${reservation.nights} ${
                      this.currentLanguage === 'cs' ? 'nocí' : 'nights'
                    })
                  </span><br>
                  <span style="font-size: 0.9rem; color: var(--gray-600);">
                    ${reservation.roomIds.length} pokojů, ${reservation.guests.adults} ${
                      this.currentLanguage === 'cs' ? 'dospělí' : 'adults'
                    }${
                      reservation.guests.children > 0
                        ? `, ${reservation.guests.children} ${
                            this.currentLanguage === 'cs' ? 'děti' : 'children'
                          }`
                        : ''
                    }
                  </span>
                </div>
                <div style="text-align: right;">
                  <strong style="color: #8b5cf6; font-size: 1.1rem;">${reservation.totalPrice.toLocaleString(
                    'cs-CZ'
                  )} Kč</strong>
                </div>
              </div>
            </div>
          `;
        } else {
          // Regular room reservation summary
          summaryHTML += `
            <div style="padding: 0.75rem; background: var(--gray-50); border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong>${reservation.roomName}</strong><br>
                  <span style="font-size: 0.9rem; color: var(--gray-600);">
                    ${reservation.startDate} → ${reservation.endDate} (${reservation.nights} ${
                      this.currentLanguage === 'cs' ? 'nocí' : 'nights'
                    })
                  </span><br>
                  <span style="font-size: 0.9rem; color: var(--gray-600);">
                    ${reservation.guests.adults} ${
                      this.currentLanguage === 'cs' ? 'dospělí' : 'adults'
                    }${
                      reservation.guests.children > 0
                        ? `, ${reservation.guests.children} ${
                            this.currentLanguage === 'cs' ? 'děti' : 'children'
                          }`
                        : ''
                    }${
                      reservation.guests.toddlers > 0
                        ? `, ${reservation.guests.toddlers} ${
                            this.currentLanguage === 'cs' ? 'batolata' : 'toddlers'
                          }`
                        : ''
                    }
                  </span>
                </div>
                <div style="text-align: right;">
                  <strong style="color: var(--primary-color);">${reservation.totalPrice.toLocaleString(
                    'cs-CZ'
                  )} Kč</strong>
                </div>
              </div>
            </div>
          `;
        }
      });

      // Add total
      summaryHTML += `
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid var(--gray-200);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="font-size: 1.1rem;">${
              this.currentLanguage === 'cs' ? 'Celkem' : 'Total'
            }:</strong>
            <strong style="font-size: 1.2rem; color: var(--primary-color);">${totalPrice.toLocaleString(
              'cs-CZ'
            )} Kč</strong>
          </div>
        </div>
      `;

      summaryEl.innerHTML = summaryHTML;
    }

    // Clear form fields
    const form = document.getElementById('bookingForm');
    if (form) {
      form.reset();

      // Setup submit handler for the form
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.bookingForm.submitBooking();
      };
    }

    // Check if any reservation is in Christmas period and show/hide Christmas code field
    const allDates = [];
    let hasBulkBooking = false;

    this.tempReservations.forEach((reservation) => {
      const start = new Date(reservation.startDate);
      const end = new Date(reservation.endDate);
      const current = new Date(start);
      // eslint-disable-next-line no-unmodified-loop-condition -- Loop condition correctly uses current date, which is modified inside loop
      while (current <= end) {
        allDates.push(dataManager.formatDate(current));
        current.setDate(current.getDate() + 1);
      }
      // Check if any reservation is bulk booking
      if (reservation.isBulkBooking) {
        hasBulkBooking = true;
      }
    });

    await this.bookingForm.checkAndShowChristmasCodeField(allDates, hasBulkBooking);

    // NOTE: Guest names are already collected in tempReservations during temp reservation creation
    // No need to generate input fields here - collectGuestNames() will read from tempReservations

    // Show the modal
    modal.classList.add('active');

    // Store that we're in finalization mode
    this.isFinalizingReservations = true;
  }

  // Load room information for the modal
  async loadRoomInfo() {
    const rooms = await dataManager.getRooms();
    const settings = await dataManager.getSettings();
    const prices = settings.prices || {
      utia: { base: 298, adult: 49, child: 24 },
      external: { base: 499, adult: 99, child: 49 },
    };

    // Update room capacity grid with floor information
    const capacityGrid = document.getElementById('roomCapacityGrid');
    if (capacityGrid) {
      capacityGrid.innerHTML = '';
      let totalBeds = 0;

      // Get translation function
      const t = (key) => langManager.t(key);

      // Separate rooms by floor
      const lowerFloorRooms = ['12', '13', '14'];
      const upperFloorRooms = ['22', '23', '24', '42', '43', '44'];

      // Create floor sections
      const createFloorSection = (title, roomIds) => {
        const section = document.createElement('div');
        section.style.cssText = 'grid-column: 1 / -1; margin-top: 1rem; margin-bottom: 0.5rem;';
        section.innerHTML = `
          <h4 style="color: var(--primary-color); margin: 0; padding: 0.5rem; background: var(--gray-100); border-radius: 6px; text-align: center; font-size: 1rem;">
            ${title}
          </h4>
        `;
        capacityGrid.appendChild(section);

        // Add rooms for this floor
        const floorRooms = rooms.filter((room) => roomIds.includes(room.id));
        floorRooms.forEach((room) => {
          const roomDiv = document.createElement('div');
          roomDiv.style.textAlign = 'center';

          const roomColor = '#28a745';
          const roomBorder = '#1e7e34';

          let bedsLabel;
          if (this.currentLanguage === 'cs') {
            if (room.beds === 1) {
              bedsLabel = 'lůžko';
            } else if (room.beds < 5) {
              bedsLabel = 'lůžka';
            } else {
              bedsLabel = 'lůžek';
            }
          } else {
            bedsLabel = room.beds === 1 ? 'bed' : 'beds';
          }

          roomDiv.innerHTML = `
            <div style="background: white; padding: 0.75rem; border-radius: var(--radius-lg); box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <span style="display: block; background: ${roomColor}; color: white; padding: 0.75rem; border: 2px solid ${roomBorder}; border-radius: var(--radius-md); font-size: 1.3rem; font-weight: 700; margin-bottom: 0.5rem; box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3); text-align: center;">${room.id}</span>
              <span style="font-size: 0.95rem; color: var(--gray-800); display: block; text-align: center; margin-top: 0.5rem;" class="room-beds" data-beds="${room.beds}">${room.beds} ${bedsLabel}</span>
            </div>
          `;

          capacityGrid.appendChild(roomDiv);
          totalBeds += room.beds;
        });
      };

      // Create lower floor section
      createFloorSection(t('lowerFloorRooms'), lowerFloorRooms);

      // Create upper floor section
      createFloorSection(t('upperFloorRooms'), upperFloorRooms);

      // Update total capacity text
      const totalCapacityText = document.getElementById('totalCapacityText');
      if (totalCapacityText) {
        const capacityText =
          this.currentLanguage === 'cs'
            ? `Celková kapacita: ${totalBeds} lůžek`
            : `Total capacity: ${totalBeds} beds`;
        totalCapacityText.textContent = capacityText;
      }
    }

    // Update price list - NEW (2025-10-17): Room-size-based pricing display
    const priceListContent = document.getElementById('priceListContent');
    if (priceListContent) {
      const t = (key) => langManager.t(key);

      // Check if prices have room-size structure (new model) or flat structure (legacy)
      const hasRoomSizes = prices.utia?.small && prices.utia?.large;

      if (hasRoomSizes) {
        // NEW: Room-size-based pricing display
        priceListContent.innerHTML = `
                <div style="display: grid; gap: 1rem;">
                    <div style="background: var(--info-50); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--info-200);">
                        <h4 style="color: var(--info-800); margin-bottom: 0.75rem;">${t('utiaEmployees')}</h4>

                        <div style="margin-bottom: 0.75rem; padding: 0.5rem; background: white; border-radius: 6px;">
                            <strong style="color: var(--gray-700);">${this.currentLanguage === 'cs' ? 'Malé pokoje' : 'Small rooms'} (12, 13, 22, 23, 42, 43):</strong>
                            <ul style="list-style: none; padding: 0; margin: 0; margin-top: 0.25rem;">
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceBasePrice')}: <strong>${prices.utia.small.empty} Kč${t('perNight')}</strong></li>
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceAdultSurcharge')}: <strong>${prices.utia.small.adult} Kč</strong></li>
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceChildSurcharge')}: <strong>${prices.utia.small.child} Kč</strong></li>
                            </ul>
                        </div>

                        <div style="padding: 0.5rem; background: white; border-radius: 6px;">
                            <strong style="color: var(--gray-700);">${this.currentLanguage === 'cs' ? 'Velké pokoje' : 'Large rooms'} (14, 24, 44):</strong>
                            <ul style="list-style: none; padding: 0; margin: 0; margin-top: 0.25rem;">
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceBasePrice')}: <strong>${prices.utia.large.empty} Kč${t('perNight')}</strong></li>
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceAdultSurcharge')}: <strong>${prices.utia.large.adult} Kč</strong></li>
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceChildSurcharge')}: <strong>${prices.utia.large.child} Kč</strong></li>
                            </ul>
                        </div>

                        <div style="padding: 0.25rem 0; margin-top: 0.5rem; color: var(--success-600); font-size: 0.9rem;"><strong>${t('regularPriceToddlersFree')}</strong></div>
                    </div>

                    <div style="background: var(--warning-50); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--warning-200);">
                        <h4 style="color: var(--warning-800); margin-bottom: 0.75rem;">${t('externalGuests')}</h4>

                        <div style="margin-bottom: 0.75rem; padding: 0.5rem; background: white; border-radius: 6px;">
                            <strong style="color: var(--gray-700);">${this.currentLanguage === 'cs' ? 'Malé pokoje' : 'Small rooms'} (12, 13, 22, 23, 42, 43):</strong>
                            <ul style="list-style: none; padding: 0; margin: 0; margin-top: 0.25rem;">
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceBasePrice')}: <strong>${prices.external.small.empty} Kč${t('perNight')}</strong></li>
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceAdultSurcharge')}: <strong>${prices.external.small.adult} Kč</strong></li>
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceChildSurcharge')}: <strong>${prices.external.small.child} Kč</strong></li>
                            </ul>
                        </div>

                        <div style="padding: 0.5rem; background: white; border-radius: 6px;">
                            <strong style="color: var(--gray-700);">${this.currentLanguage === 'cs' ? 'Velké pokoje' : 'Large rooms'} (14, 24, 44):</strong>
                            <ul style="list-style: none; padding: 0; margin: 0; margin-top: 0.25rem;">
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceBasePrice')}: <strong>${prices.external.large.empty} Kč${t('perNight')}</strong></li>
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceAdultSurcharge')}: <strong>${prices.external.large.adult} Kč</strong></li>
                                <li style="padding: 0.15rem 0; font-size: 0.9rem;">${t('regularPriceChildSurcharge')}: <strong>${prices.external.large.child} Kč</strong></li>
                            </ul>
                        </div>

                        <div style="padding: 0.25rem 0; margin-top: 0.5rem; color: var(--success-600); font-size: 0.9rem;"><strong>${t('regularPriceToddlersFree')}</strong></div>
                    </div>
                </div>
            `;
      }
    }

    // Update bulk booking price list
    const bulkPriceListContent = document.getElementById('bulkPriceListContent');
    if (bulkPriceListContent) {
      // Load bulk prices from admin settings
      const bulkPricesSettings = settings.bulkPrices || {
        basePrice: 2000,
        utiaAdult: 100,
        utiaChild: 0,
        externalAdult: 250,
        externalChild: 50,
      };

      const t = (key) => langManager.t(key);
      bulkPriceListContent.innerHTML = `
                <div style="display: grid; gap: 1rem;">
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(59, 130, 246, 0.3);">
                        <h4 style="color: #1e40af; margin-bottom: 0.5rem; display: flex; align-items: center;">
                            <span style="margin-right: 0.5rem;">🏢</span>
                            ${t('utiaEmployees')}
                        </h4>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="padding: 0.25rem 0;">${t('bulkPriceBasePriceCottage')}: <strong>${bulkPricesSettings.basePrice.toLocaleString('cs-CZ')} Kč${t('perNight')}</strong></li>
                            <li style="padding: 0.25rem 0;">${t('bulkPriceAdultSurcharge')}: <strong>${bulkPricesSettings.utiaAdult} Kč</strong></li>
                            <li style="padding: 0.25rem 0;">${t('bulkPriceChildSurcharge')}: <strong>${bulkPricesSettings.utiaChild} Kč</strong></li>
                            <li style="padding: 0.25rem 0; color: var(--success-600);"><strong>${t('bulkPriceToddlersFree')}</strong></li>
                        </ul>
                    </div>

                    <div style="background: rgba(245, 158, 11, 0.1); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(245, 158, 11, 0.3);">
                        <h4 style="color: #b45309; margin-bottom: 0.5rem; display: flex; align-items: center;">
                            <span style="margin-right: 0.5rem;">👥</span>
                            ${t('externalGuests')}
                        </h4>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="padding: 0.25rem 0;">${t('bulkPriceBasePriceCottage')}: <strong>${bulkPricesSettings.basePrice.toLocaleString('cs-CZ')} Kč${t('perNight')}</strong></li>
                            <li style="padding: 0.25rem 0;">${t('bulkPriceAdultSurcharge')}: <strong>${bulkPricesSettings.externalAdult} Kč</strong></li>
                            <li style="padding: 0.25rem 0;">${t('bulkPriceChildSurcharge')}: <strong>${bulkPricesSettings.externalChild} Kč</strong></li>
                            <li style="padding: 0.25rem 0; color: var(--success-600);"><strong>${t('bulkPriceToddlersFree')}</strong></li>
                        </ul>
                    </div>
                </div>
            `;
    }
  }

  // Refresh dynamic content when language changes
  refreshDynamicContent() {
    // Reload room info modal content (price lists)
    this.loadRoomInfo();

    // Re-render calendar with new language
    this.renderCalendar();
  }

  populateFinalBookingSummary() {
    const summaryDiv = document.getElementById('finalBookingSummary');
    const totalPriceSpan = document.getElementById('finalBookingTotalPrice');

    if (!summaryDiv || !totalPriceSpan) {
      return;
    }

    // Consolidate consecutive same-room bookings for display
    const displayReservations = this.consolidateTempReservations(this.tempReservations);

    let totalPrice = 0;
    let summaryHTML = '';

    displayReservations.forEach((reservation) => {
      const guestTypeLabel = reservation.guestType === 'utia' ? 'ÚTIA' : 'Externí';
      const guestDetails = reservation.guests;

      // Determine nights label
      let nightsLabel;
      if (reservation.nights === 1) {
        nightsLabel = 'noc';
      } else if (reservation.nights < 5) {
        nightsLabel = 'noci';
      } else {
        nightsLabel = 'nocí';
      }

      summaryHTML += `
        <div style="padding: 0.5rem; margin-bottom: 0.5rem; background: white; border-radius: 4px; border-left: 3px solid var(--primary-color);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${reservation.roomName}</strong> | ${guestTypeLabel}
              <div style="font-size: 0.85rem; color: var(--gray-600); margin-top: 0.25rem;">
                ${new Date(reservation.startDate).toLocaleDateString('cs-CZ')} - ${new Date(reservation.endDate).toLocaleDateString('cs-CZ')}
                (${reservation.nights} ${nightsLabel})
              </div>
              <div style="font-size: 0.85rem; color: var(--gray-600);">
                👤 ${guestDetails.adults} ${guestDetails.adults === 1 ? 'dospělý' : 'dospělí'}
                ${guestDetails.children > 0 ? `, ${guestDetails.children} ${guestDetails.children === 1 ? 'dítě' : 'děti'}` : ''}
                ${guestDetails.toddlers > 0 ? `, ${guestDetails.toddlers} ${guestDetails.toddlers === 1 ? 'batole' : 'batolata'}` : ''}
              </div>
            </div>
            <div style="text-align: right;">
              <strong style="color: var(--primary-color);">${reservation.totalPrice.toLocaleString('cs-CZ')} Kč</strong>
            </div>
          </div>
        </div>
      `;
      totalPrice += reservation.totalPrice;
    });

    summaryDiv.innerHTML = summaryHTML;
    totalPriceSpan.textContent = `${totalPrice.toLocaleString('cs-CZ')} Kč`;
  }

  closeFinalBookingModal() {
    const modal = document.getElementById('finalBookingModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  async submitFinalBooking() {
    // Get form values
    const name = document.getElementById('finalBookingName').value.trim();
    const email = document.getElementById('finalBookingEmail').value.trim();
    // Combine phone prefix with number (remove spaces from number)
    const phonePrefix = document.getElementById('finalBookingCountryCode')?.value || '+420';
    const phoneNumber = document
      .getElementById('finalBookingPhone')
      .value.trim()
      .replace(/\s/gu, '');
    const phone = phonePrefix + phoneNumber;
    const company = document.getElementById('finalBookingCompany').value.trim();
    const address = document.getElementById('finalBookingAddress').value.trim();
    const city = document.getElementById('finalBookingCity').value.trim();
    const zip = document.getElementById('finalBookingZip').value.trim();
    const ico = document.getElementById('finalBookingIco').value.trim();
    const dic = document.getElementById('finalBookingDic').value.trim();
    const notes = document.getElementById('finalBookingNotes').value.trim();
    const payFromBenefit = document.getElementById('finalBookingBenefit')?.checked || false;

    // Validate required fields (IČO is optional)
    if (!name || !email || !phoneNumber || !company || !address || !city || !zip) {
      this.showNotification(
        this.currentLanguage === 'cs'
          ? 'Vyplňte prosím všechna povinná pole označená hvězdičkou (*)'
          : 'Please fill in all required fields marked with asterisk (*)',
        'error'
      );
      return;
    }

    // Create bookings for each reservation
    const createdBookings = [];

    for (const tempReservation of this.tempReservations) {
      // Prepare booking data
      const bookingData = {
        name,
        email,
        phone,
        company,
        address,
        city,
        zip,
        ico,
        dic,
        notes,
        payFromBenefit,
        startDate: tempReservation.startDate,
        endDate: tempReservation.endDate,
        rooms: [tempReservation.roomId],
        guestType: tempReservation.guestType,
        adults: tempReservation.guests.adults,
        children: tempReservation.guests.children,
        toddlers: tempReservation.guests.toddlers,
        totalPrice: tempReservation.totalPrice,
        guestNames: tempReservation.guestNames, // Guest names already validated when temp reservation was created
        sessionId: this.sessionId, // Include sessionId to exclude user's own proposals
      };

      // Create the booking
      // eslint-disable-next-line no-await-in-loop -- Sequential processing required: each booking must check room availability before creating
      const booking = await dataManager.createBooking(bookingData);
      if (booking) {
        createdBookings.push(booking);
      } else {
        // If any booking fails, show error
        this.showNotification(
          this.currentLanguage === 'cs'
            ? `Chyba při vytváření rezervace pro ${tempReservation.roomName}`
            : `Error creating booking for ${tempReservation.roomName}`,
          'error'
        );
        return;
      }
    }

    // All bookings created successfully - now clean up proposed bookings
    const deletePromises = this.tempReservations
      .filter((tempReservation) => tempReservation.proposalId)
      .map(async (tempReservation) => {
        try {
          await dataManager.deleteProposedBooking(tempReservation.proposalId);
        } catch (error) {
          console.error('Failed to delete proposed booking:', error);
        }
      });
    await Promise.all(deletePromises);

    // Clear all session proposed bookings (in case any were missed)
    try {
      await dataManager.clearSessionProposedBookings();
    } catch (error) {
      console.error('Failed to clear session proposed bookings:', error);
    }

    this.showNotification(
      this.currentLanguage === 'cs'
        ? `Úspěšně vytvořeno ${createdBookings.length} rezervací`
        : `Successfully created ${createdBookings.length} bookings`,
      'success'
    );

    // Clear temporary reservations
    this.tempReservations = [];
    await this.displayTempReservations();

    // Hide finalize button
    const finalizeDiv = document.getElementById('finalizeReservationsDiv');
    if (finalizeDiv) {
      finalizeDiv.style.display = 'none';
    }

    // Close modal
    this.closeFinalBookingModal();

    // Refresh calendar to show new bookings
    await this.renderCalendar();

    // Clear selected dates
    this.selectedDates.clear();
    this.selectedRooms.clear();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new BookingApp();
  window.app.init();
});

// Make functions globally accessible
window.finalizeAllReservations = function () {
  if (window.app) {
    window.app.finalizeAllReservations();
  }
};

window.closeFinalBookingModal = function () {
  if (window.app) {
    window.app.closeFinalBookingModal();
  }
};
