/* global DOMUtils, DateUtils */
/**
 * Edit Page - Standalone booking edit interface
 * Uses admin-style modal UI for consistent UX
 * Enforces 3-day edit deadline for non-admin users
 */

/**
 * UserModeApp - Stub class providing interfaces for booking modules
 * This enables reuse of SingleRoomBookingModule and BulkBookingModule
 */
class UserModeApp {
  constructor(editPage) {
    this.editPage = editPage;
    // Initialize language from localStorage (default to 'cs')
    this.currentLanguage = localStorage.getItem('language') || 'cs';
    this.selectedDates = new Set();
    this.selectedRooms = new Set();
    this.roomGuests = new Map();
    this.roomGuestTypes = new Map();
    this.sessionId = IdGenerator.generateSessionId();
    this.currentBookingRoom = null;
    this.editingReservation = null;
    this.tempReservations = [];

    // Initialize booking modules
    this.singleRoomBooking = new SingleRoomBookingModule(this);
    this.bulkBooking = new BulkBookingModule(this);
  }

  /**
   * Set language and update UI
   */
  setLanguage(lang) {
    this.currentLanguage = lang;
    localStorage.setItem('language', lang);

    // Update language switch checkbox
    const langSwitch = document.getElementById('languageSwitch');
    if (langSwitch) {
      langSwitch.checked = lang === 'en';
    }

    // Update translations if langManager exists
    if (window.langManager) {
      langManager.switchLanguage(lang);
    }

    // Re-render room selector if it's visible (for dynamic content updates)
    if (this.editPage && this.editPage.roomSelectorContext) {
      const container = document.getElementById('roomSelectorContainer');
      if (container && container.style.display !== 'none') {
        const { booking, settings, callbacks, options } = this.editPage.roomSelectorContext;
        this.editPage.openRoomSelectorModal(booking, settings, callbacks, options);
      }
    }
  }

  async getAllData() {
    return dataManager.getAllData();
  }

  async getSettings() {
    return dataManager.getSettings();
  }

  formatDateDisplay(date, locale = 'cs') {
    return DateUtils.formatDateDisplay(date, locale);
  }

  /**
   * Adjust guest counts for single room modal
   */
  adjustGuests(type, delta) {
    const roomId = this.currentBookingRoom;
    if (!roomId) {
      return;
    }

    const currentGuests = this.roomGuests.get(roomId) || { adults: 1, children: 0, toddlers: 0 };
    const newValue = Math.max(0, (currentGuests[type] || 0) + delta);

    // Ensure at least 1 adult
    if (type === 'adults' && newValue < 1) {
      return;
    }

    currentGuests[type] = newValue;
    this.roomGuests.set(roomId, currentGuests);

    // Update display
    const elementId =
      type === 'adults'
        ? 'singleRoomAdults'
        : type === 'children'
          ? 'singleRoomChildren'
          : 'singleRoomToddlers';
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = newValue.toString();
    }

    // Update guest names and price
    this.singleRoomBooking.generateGuestNamesInputs(
      currentGuests.adults,
      currentGuests.children,
      currentGuests.toddlers || 0
    );
    this.singleRoomBooking.updatePriceForCurrentRoom();
    this.singleRoomBooking.updateCapacityWarning();
  }

  /**
   * Update selected dates display in single room modal
   */
  async updateSelectedDatesDisplay() {
    const dateSelectionSummary = document.getElementById('dateSelectionSummary');
    const selectedDateRange = document.getElementById('selectedDateRange');
    const nightsCount = document.getElementById('nightsCount');
    const confirmBtn = document.getElementById('confirmSingleRoomBtn');

    const totalNights = Math.max(0, this.selectedDates.size - 1);

    if (this.selectedDates.size === 0) {
      if (dateSelectionSummary) {
        dateSelectionSummary.style.display = 'none';
      }
      if (confirmBtn) {
        confirmBtn.disabled = true;
      }
      return;
    }

    if (dateSelectionSummary) {
      dateSelectionSummary.style.display = 'block';
    }
    if (confirmBtn) {
      confirmBtn.disabled = totalNights === 0;
    }

    const sortedDates = Array.from(this.selectedDates).sort();
    const start = new Date(sortedDates[0]);
    const end = new Date(sortedDates[sortedDates.length - 1]);
    const nights = totalNights;

    if (selectedDateRange) {
      if (sortedDates[0] === sortedDates[sortedDates.length - 1]) {
        selectedDateRange.textContent = this.formatDateDisplay(start);
      } else {
        selectedDateRange.textContent = `${this.formatDateDisplay(start)} - ${this.formatDateDisplay(end)}`;
      }
    }
    if (nightsCount) {
      nightsCount.textContent = nights.toString();
    }
  }

  // FIX 2025-12-08: Delegate to DateUtils (SSOT for date ranges)
  getDateRanges(dates) {
    if (!dates || dates.size === 0) {
      return [];
    }
    const sortedDates = Array.from(dates).sort();
    return DateUtils.getDateRanges(sortedDates);
  }

  /**
   * Set room guest type
   */
  setRoomGuestType(guestType) {
    const roomId = this.currentBookingRoom;
    if (roomId) {
      this.roomGuestTypes.set(roomId, guestType);
      this.singleRoomBooking.updatePriceForCurrentRoom();
    }
  }

  /**
   * Update price calculation - delegates to single room booking module
   */
  async updatePriceCalculation() {
    if (this.singleRoomBooking) {
      this.singleRoomBooking.updatePriceForCurrentRoom();
    }
  }
}

/**
 * EditPage - Main controller for guest edit functionality
 */
class EditPage {
  constructor() {
    this.editToken = null;
    this.currentBooking = null;
    this.isEditLocked = false;
    this.settings = null;

    // Create UserModeApp stub for booking modules
    this.app = new UserModeApp(this);

    this.initialize();
  }

  /**
   * Helper to get translation - uses langManager if available
   */
  t(key) {
    if (window.langManager) {
      return window.langManager.t(key);
    }
    return key;
  }

  /**
   * Convert error codes from DataManager to user-friendly messages
   * @param {string} errorCode - Error code from DataManager
   * @returns {string} User-friendly error message
   */
  getErrorMessage(errorCode) {
    const errorMap = {
      TIMEOUT: this.t('errorTimeout'),
      NETWORK_ERROR: this.t('errorNetworkFailure'),
      TOKEN_INVALID: this.t('errorTokenInvalid'),
      TOKEN_EXPIRED: this.t('errorTokenExpired'),
      BOOKING_LOCKED: this.t('editNotPossibleLocked'),
      PARSE_ERROR: this.t('errorServerResponse'),
    };

    // Check if it's a known error code
    if (errorMap[errorCode]) {
      return errorMap[errorCode];
    }

    // Check for UPDATE_FAILED_XXX or DELETE_FAILED_XXX patterns
    if (errorCode.startsWith('UPDATE_FAILED_') || errorCode.startsWith('DELETE_FAILED_')) {
      const statusCode = errorCode.split('_').pop();
      return `${this.t('errorServerError')} (${statusCode})`;
    }

    // Fallback to the error message itself or generic error
    return errorCode || this.t('errorUnknown');
  }

  /**
   * Validate edit token format before making API calls
   * @param {string} token - Token to validate
   * @returns {boolean} True if token format is valid
   */
  isValidTokenFormat(token) {
    // FIX 2025-12-09: Lowered minimum from 20 to 8 for backwards compatibility
    // Old tokens were 12 chars, new tokens are 30 chars
    return token && /^[a-zA-Z0-9_-]{8,}$/u.test(token);
  }

  async initialize() {
    // Initialize language from localStorage
    this.initializeLanguage();

    // Get edit token from URL
    const urlParams = new URLSearchParams(window.location.search);
    this.editToken = urlParams.get('token');

    if (!this.editToken) {
      this.showError(this.t('missingEditToken'));
      return;
    }

    // Validate token format before making API calls
    if (!this.isValidTokenFormat(this.editToken)) {
      this.showError(this.t('errorTokenInvalid'));
      return;
    }

    // Load booking data
    await this.loadBookingData();
  }

  /**
   * Initialize language from localStorage and setup switch
   */
  initializeLanguage() {
    const savedLang = localStorage.getItem('language') || 'cs';

    // Set language in app
    this.app.currentLanguage = savedLang;

    // Update switch state
    const langSwitch = document.getElementById('languageSwitch');

    if (langSwitch) {
      langSwitch.checked = savedLang === 'en';

      // Add event listener for language switch
      langSwitch.addEventListener('change', (e) => {
        const newLang = e.target.checked ? 'en' : 'cs';
        this.app.setLanguage(newLang);
      });
    }

    // Initialize langManager if available
    if (window.langManager) {
      langManager.switchLanguage(savedLang);
    }
  }

  async loadBookingData() {
    try {
      this.currentBooking = await dataManager.getBookingByEditToken(this.editToken);

      if (!this.currentBooking) {
        throw new Error('Rezervace nenalezena nebo neplatn\u00fd token');
      }

      // Load settings
      this.settings = await dataManager.getSettings();
      const contactEmail = this.settings.contactEmail || 'chata@utia.cas.cz';

      // Update contact email display
      const contactEmailDisplay = document.getElementById('contactEmailDisplay');
      if (contactEmailDisplay) {
        contactEmailDisplay.textContent = contactEmail;
      }

      // Check if booking is paid - takes priority over deadline
      if (this.currentBooking.paid) {
        this.isEditLocked = true;
        this.displayPaidBookingWarning();
      } else {
        // Check 3-day edit deadline
        this.isEditLocked = this.checkEditDeadline();

        if (this.isEditLocked) {
          this.displayEditDeadlineWarning();
        } else {
          // Route to appropriate modal based on booking type
          await this.routeToAppropriateModal();
        }
      }

      // Hide loading
      const loadingState = document.getElementById('loadingState');
      if (loadingState) {
        loadingState.style.display = 'none';
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      this.showError(error.message || this.t('errorLoadingBookingFallback'));
    }
  }

  /**
   * Calculate days until booking start using DateUtils (SSOT)
   */
  calculateDaysUntilStart() {
    return DateUtils.calculateDaysUntilStart(this.currentBooking.startDate);
  }

  checkEditDeadline() {
    if (!this.currentBooking || !this.currentBooking.startDate) {
      return false;
    }
    const daysUntilStart = this.calculateDaysUntilStart();
    return daysUntilStart < 3;
  }

  /**
   * Route to appropriate modal based on booking type
   * Similar to AdminBookings.editBooking()
   */
  async routeToAppropriateModal() {
    const booking = this.currentBooking;

    // Detect booking type
    const isBulk = booking.isBulkBooking === true;
    const isSingleRoom = !isBulk && booking.rooms?.length === 1;
    const isMultiRoom = !isBulk && booking.rooms?.length > 1;

    // Set editing reservation so calendar shows these dates as available
    this.app.editingReservation = booking;

    // Define callbacks
    const callbacks = {
      onSubmit: (formData) => this.handleModalSubmit(formData),
      onCancel: () => this.handleModalCancel(),
      onDelete: () => this.handleModalDelete(),
    };

    // User mode options with restrictions
    const options = {
      isUserMode: true,
      restrictions: {
        isLocked: this.isEditLocked,
        isPaid: this.currentBooking.paid,
        enforceDeadline: true,
      },
    };

    if (isBulk) {
      await this.openBulkEditModal(booking, callbacks, options);
    } else if (isSingleRoom) {
      const roomId = booking.rooms[0];
      await this.openSingleRoomEditModal(booking, roomId, callbacks, options);
    } else if (isMultiRoom) {
      await this.openRoomSelectorModal(booking, this.settings, callbacks, options);
    } else {
      // Fallback to legacy edit component
      await this.initializeLegacyEditForm();
    }
  }

  /**
   * Open bulk booking edit modal
   */
  async openBulkEditModal(booking, callbacks, options) {
    await this.app.bulkBooking.openForAdminEdit(booking, callbacks, options);
  }

  /**
   * Open single room edit modal
   */
  async openSingleRoomEditModal(booking, roomId, callbacks, options) {
    await this.app.singleRoomBooking.openForAdminEdit(booking, roomId, callbacks, options);
  }

  /**
   * Open inline room selector for multi-room bookings
   * Uses built-in container instead of modal for better UX
   */
  async openRoomSelectorModal(booking, settings, callbacks, options) {
    // Store context
    this.roomSelectorContext = { booking, settings, callbacks, options };

    // Get inline container elements
    const container = document.getElementById('roomSelectorContainer');
    const roomCardsGrid = document.getElementById('roomCardsGrid');
    const bookingInfoSummary = document.getElementById('bookingInfoSummary');

    if (!container || !roomCardsGrid) {
      console.error('[EditPage] Room selector container not found - DOM may not be ready');
      this.showError(this.t('errorRoomSelectorNotReady'));
      return;
    }

    // Get room count label using translation system
    const roomCount = booking.rooms.length;
    let roomLabel;
    if (roomCount === 1) {
      roomLabel = this.t('roomSingular');
    } else if (roomCount < 5) {
      roomLabel = this.t('roomPlural2to4');
    } else {
      roomLabel = this.t('roomPlural5plus');
    }

    // Build booking info summary
    bookingInfoSummary.innerHTML = `
      <div class="contact-badge">
        <span>👤</span>
        <span>${this.escapeHtml(booking.name)}</span>
      </div>
      <div class="contact-badge">
        <span>📧</span>
        <span>${this.escapeHtml(booking.email)}</span>
      </div>
      <div class="contact-badge">
        <span>🏠</span>
        <span>${roomCount} ${roomLabel}</span>
      </div>
    `;

    // Build room cards HTML
    let roomsHTML = '';
    for (const roomId of booking.rooms) {
      const roomDates = booking.perRoomDates?.[roomId] || {
        startDate: booking.startDate,
        endDate: booking.endDate,
      };
      const roomGuests = booking.perRoomGuests?.[roomId] || {
        adults: 0,
        children: 0,
        toddlers: 0,
      };

      // Get room info - use translation for room name
      const room = settings.rooms?.find((r) => r.id === roomId);
      const roomName = room?.name || `${this.t('room')} ${roomId}`;
      const roomNum = roomId.replace('room', '');

      // Calculate nights
      const startDate = new Date(roomDates.startDate);
      const endDate = new Date(roomDates.endDate);
      const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

      // Format dates based on language
      const locale = this.app.currentLanguage === 'en' ? 'en-GB' : 'cs-CZ';
      const startStr = startDate.toLocaleDateString(locale);
      const endStr = endDate.toLocaleDateString(locale);

      // Guest summary using translation system
      const guestParts = [];
      if (roomGuests.adults > 0) {
        guestParts.push(`${roomGuests.adults} ${this.t('adultsShort')}`);
      }
      if (roomGuests.children > 0) {
        guestParts.push(`${roomGuests.children} ${this.t('childrenShort')}`);
      }
      if (roomGuests.toddlers > 0) {
        guestParts.push(`${roomGuests.toddlers} ${this.t('toddlersShort')}`);
      }
      const guestStr = guestParts.join(', ') || this.t('noGuests');

      // Calculate room price
      let roomPrice = 0;
      try {
        const roomGuestNames = (booking.guestNames || []).filter(
          (g) => String(g.roomId) === String(roomId)
        );
        const hasUtiaGuest = roomGuestNames.some(
          (g) => g.guestPriceType === 'utia' && g.personType !== 'toddler'
        );
        const roomGuestType = hasUtiaGuest ? 'utia' : 'external';

        roomPrice = PriceCalculator.calculatePerGuestPrice({
          rooms: [roomId],
          guestNames: roomGuestNames,
          nights,
          settings,
          fallbackGuestType: roomGuestType,
        });
      } catch (e) {
        console.warn(`[RoomSelector] Could not calculate price for room ${roomId}:`, e);
      }
      const priceStr = roomPrice > 0 ? `${roomPrice.toLocaleString(locale)} Kč` : '';

      // Nights label using translation system
      let nightsLabel;
      if (nights === 1) {
        nightsLabel = this.t('night');
      } else if (nights < 5) {
        nightsLabel = this.t('nights2to4');
      } else {
        nightsLabel = this.t('nights5plus');
      }

      roomsHTML += `
        <div class="room-select-card" onclick="editPage.editSelectedRoom('${roomId}')">
          <div class="room-number">${roomNum}</div>
          <div class="room-details">
            <div class="room-dates">${startStr} - ${endStr}</div>
            <div class="room-info">${nights} ${nightsLabel} • ${guestStr}</div>
          </div>
          ${priceStr ? `<div class="room-price">${priceStr}</div>` : ''}
          <div class="arrow">→</div>
        </div>
      `;
    }

    // Set room cards
    roomCardsGrid.innerHTML = roomsHTML;

    // Show container
    container.style.display = 'block';
  }

  /**
   * Edit a specific room from multi-room booking
   */
  async editSelectedRoom(roomId) {
    // Hide room selector container
    this.hideRoomSelector();

    // Open single room edit modal
    const { booking, callbacks, options } = this.roomSelectorContext;
    await this.openSingleRoomEditModal(booking, roomId, callbacks, options);
  }

  /**
   * Hide room selector container
   */
  hideRoomSelector() {
    const container = document.getElementById('roomSelectorContainer');
    if (container) {
      container.style.display = 'none';
    }
  }

  /**
   * Show room selector container (used when returning from room edit)
   */
  showRoomSelector() {
    const container = document.getElementById('roomSelectorContainer');
    if (container) {
      container.style.display = 'block';
    }
  }

  /**
   * Close room selector - redirects to home page
   * (kept for backwards compatibility with modal approach)
   */
  closeRoomSelector() {
    window.location.href = '/';
  }

  /**
   * Create room badge HTML
   */
  createRoomBadge(roomId) {
    const roomNum = roomId.replace('room', '');
    return `
      <div style="
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0d9488, #14b8a6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 1rem;
      ">${roomNum}</div>
    `;
  }

  // FIX 2025-12-08: Delegate to DOMUtils (SSOT for HTML escaping)
  escapeHtml(text) {
    return DOMUtils.escapeHtml(text);
  }

  /**
   * Handle modal submit (save changes)
   */
  async handleModalSubmit(formData) {
    try {
      // Delete proposed bookings for this session
      if (this.app.sessionId) {
        await dataManager.deleteProposedBookingsForSession(this.app.sessionId);
      }

      // For multi-room bookings edited per-room, preserve original data
      // and only update the specific room's data
      const updateData = { ...formData };
      const isMultiRoom =
        this.currentBooking.rooms?.length > 1 && !this.currentBooking.isBulkBooking;

      // Always preserve the original rooms array - server doesn't allow changing it
      updateData.rooms = this.currentBooking.rooms;

      if (isMultiRoom) {
        // Determine which room was edited (from formData)
        const editedRoomId = formData.rooms?.[0] || Object.keys(formData.perRoomDates || {})[0];

        // Merge perRoomDates with original (only update the edited room)
        if (formData.perRoomDates && editedRoomId) {
          updateData.perRoomDates = {
            ...this.currentBooking.perRoomDates,
            [editedRoomId]: formData.perRoomDates[editedRoomId],
          };
        }

        // Merge perRoomGuests with original (only update the edited room)
        if (formData.perRoomGuests && editedRoomId) {
          updateData.perRoomGuests = {
            ...this.currentBooking.perRoomGuests,
            [editedRoomId]: formData.perRoomGuests[editedRoomId],
          };
        }

        // Merge guestNames - keep names for other rooms, replace names for edited room
        if (formData.guestNames && editedRoomId) {
          // Filter out old names for the edited room
          const otherRoomNames = (this.currentBooking.guestNames || []).filter(
            (g) => String(g.roomId) !== String(editedRoomId)
          );
          // Add new names for the edited room
          const editedRoomNames = formData.guestNames.filter(
            (g) => String(g.roomId) === String(editedRoomId)
          );
          updateData.guestNames = [...otherRoomNames, ...editedRoomNames];
        }

        // Recalculate total guests from all rooms
        const totalGuests = { adults: 0, children: 0, toddlers: 0 };
        for (const roomId of this.currentBooking.rooms) {
          const roomGuests = updateData.perRoomGuests?.[roomId] || {
            adults: 0,
            children: 0,
            toddlers: 0,
          };
          totalGuests.adults += roomGuests.adults || 0;
          totalGuests.children += roomGuests.children || 0;
          totalGuests.toddlers += roomGuests.toddlers || 0;
        }
        updateData.adults = totalGuests.adults;
        updateData.children = totalGuests.children;
        updateData.toddlers = totalGuests.toddlers;

        // Calculate date range from all rooms
        let minDate = null;
        let maxDate = null;
        for (const roomId of this.currentBooking.rooms) {
          const roomDates = updateData.perRoomDates?.[roomId];
          if (roomDates) {
            const start = new Date(roomDates.startDate);
            const end = new Date(roomDates.endDate);
            if (!minDate || start < minDate) {
              minDate = start;
            }
            if (!maxDate || end > maxDate) {
              maxDate = end;
            }
          }
        }
        if (minDate && maxDate) {
          updateData.startDate = minDate.toISOString().split('T')[0];
          updateData.endDate = maxDate.toISOString().split('T')[0];
        }
      }

      // Update booking with token
      await dataManager.updateBookingWithToken(this.currentBooking.id, updateData, this.editToken);

      this.showSuccess(this.t('bookingUpdatedRedirecting'));

      // Redirect after delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('[EditPage] Error updating booking:', error.message);
      this.showError(this.getErrorMessage(error.message));
    }
  }

  /**
   * Handle modal cancel
   */
  handleModalCancel() {
    window.location.href = '/';
  }

  /**
   * Handle modal delete
   */
  async handleModalDelete() {
    this.confirmDeleteBooking();
  }

  /**
   * Confirm and delete booking
   */
  confirmDeleteBooking() {
    this.showConfirm(this.t('confirmDeleteBooking'), async () => {
      try {
        await dataManager.deleteBookingWithToken(this.currentBooking.id, this.editToken);
        this.showSuccess(this.t('bookingDeletedSuccess'));

        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } catch (error) {
        console.error('[EditPage] Error deleting booking:', error.message);
        this.showError(this.getErrorMessage(error.message));
      }
    });
  }

  // =============================================
  // Bulk booking helper methods (used by modals)
  // =============================================

  /**
   * Adjust bulk booking guest counts
   */
  adjustBulkGuests(type, delta) {
    this.app.bulkBooking.adjustBulkGuests(type, delta);
  }

  /**
   * Close bulk modal
   */
  closeBulkModal() {
    this.app.bulkBooking.hideBulkBookingModal();
  }

  /**
   * Add/save bulk booking
   */
  async addBulkBooking() {
    // Get data from bulk module
    const formData = this.app.bulkBooking.collectBulkBookingData();
    if (formData) {
      // Merge with original booking data
      const mergedData = {
        ...this.currentBooking,
        ...formData,
        id: this.currentBooking.id,
      };
      await this.handleModalSubmit(mergedData);
    }
  }

  // =============================================
  // Legacy edit form (fallback)
  // =============================================

  async initializeLegacyEditForm() {
    const bookingIdDisplay = document.getElementById('bookingIdDisplay');
    if (bookingIdDisplay) {
      bookingIdDisplay.textContent = this.currentBooking.id;
    }

    // Initialize EditBookingComponent for user mode
    this.editComponent = new EditBookingComponent({
      mode: 'user',
      enforceDeadline: true,
      validateSession: null,
      onSubmit: (formData) => this.handleEditBookingSubmit(formData),
      onDelete: (bookingId) => this.handleEditBookingDelete(bookingId),
      settings: this.settings,
    });

    // Load booking data into component
    await this.editComponent.loadBooking(this.currentBooking, this.settings);

    // Setup event listeners
    const editBookingForm = document.getElementById('editBookingForm');
    if (editBookingForm) {
      editBookingForm.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Show form
    const editFormContainer = document.getElementById('editFormContainer');
    if (editFormContainer) {
      editFormContainer.style.display = 'block';
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (this.isEditLocked) {
      this.showNotification(this.t('editNotPossibleLocked'), 'error');
      return;
    }

    try {
      await this.editComponent.validateForm();
      const formData = this.editComponent.getFormData();
      await this.handleEditBookingSubmit(formData);
    } catch (error) {
      console.error('Error saving booking:', error);
      this.showError(error.message || this.t('errorSavingBookingFallback'));
    }
  }

  async handleEditBookingSubmit(formData) {
    try {
      const sessionId = this.editComponent?.getSessionId?.();
      if (sessionId) {
        await dataManager.deleteProposedBookingsForSession(sessionId);
      }

      await dataManager.updateBookingWithToken(this.currentBooking.id, formData, this.editToken);
      this.showSuccess(this.t('bookingUpdatedSuccess'));

      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('Error updating booking:', error);
      this.showError(error.message);
    }
  }

  async handleEditBookingDelete(bookingId) {
    try {
      await dataManager.deleteBookingWithToken(bookingId, this.editToken);
      this.showSuccess(this.t('bookingDeletedSuccess'));

      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('Error deleting booking:', error);
      this.showError(error.message);
    }
  }

  deleteBooking() {
    if (this.isEditLocked) {
      this.showNotification(this.t('deleteNotPossibleLocked'), 'error');
      return;
    }

    this.showConfirm(this.t('confirmDeleteBooking'), async () => {
      await this.handleEditBookingDelete(this.currentBooking.id);
    });
  }

  // =============================================
  // Warning displays (locked states)
  // =============================================

  displayEditDeadlineWarning() {
    const daysUntilStart = this.calculateDaysUntilStart();

    let message = '';
    if (daysUntilStart < 0) {
      message = this.t('bookingAlreadyStarted');
    } else {
      let dayWord;
      if (daysUntilStart === 1) {
        dayWord = this.t('daysSingular');
      } else if (daysUntilStart < 5) {
        dayWord = this.t('daysPlural2to4');
      } else {
        dayWord = this.t('daysPlural5plus');
      }
      message = `⏰ ${this.t('daysUntilStart')} <strong>${daysUntilStart} ${dayWord}</strong>`;
    }

    const deadlineMessage = document.getElementById('deadlineMessage');
    if (deadlineMessage) {
      deadlineMessage.innerHTML = `
        ${this.t('editDeadlineExplanation')}<br><br>
        ${message}
      `;
    }

    const editDeadlineWarning = document.getElementById('editDeadlineWarning');
    if (editDeadlineWarning) {
      editDeadlineWarning.style.display = 'block';
    }

    // Show booking details in read-only mode
    const editFormContainer = document.getElementById('editFormContainer');
    if (editFormContainer) {
      editFormContainer.style.display = 'block';
    }
    this.displayReadOnlyBooking();
  }

  displayPaidBookingWarning() {
    const deadlineMessage = document.getElementById('deadlineMessage');
    if (deadlineMessage) {
      deadlineMessage.innerHTML = `
        <strong>${this.t('bookingPaidTitle')}</strong><br><br>
        ${this.t('bookingPaidMessage')}<br><br>
        ${this.t('bookingPaidContactAdmin')}
      `;
    }

    const editDeadlineWarning = document.getElementById('editDeadlineWarning');
    if (editDeadlineWarning) {
      editDeadlineWarning.style.display = 'block';
    }

    const editFormContainer = document.getElementById('editFormContainer');
    if (editFormContainer) {
      editFormContainer.style.display = 'block';
    }
    this.displayReadOnlyBooking();
  }

  async displayReadOnlyBooking() {
    // Initialize EditBookingComponent even in locked mode
    this.editComponent = new EditBookingComponent({
      mode: 'user',
      enforceDeadline: true,
      validateSession: null,
      onSubmit: () => {},
      onDelete: () => {},
      settings: this.settings,
    });

    await this.editComponent.loadBooking(this.currentBooking, this.settings);

    const bookingIdDisplay = document.getElementById('bookingIdDisplay');
    if (bookingIdDisplay) {
      bookingIdDisplay.textContent = this.currentBooking.id;
    }

    // Disable all inputs
    const allInputs = document.querySelectorAll(
      '#editBookingForm input, #editBookingForm textarea, #editBookingForm button[type="button"]'
    );
    allInputs.forEach((input) => {
      input.disabled = true;
      input.style.opacity = '0.5';
      input.style.cursor = 'not-allowed';
    });

    // Hide action buttons
    const editSubmitButton = document.getElementById('editSubmitButton');
    if (editSubmitButton) {
      editSubmitButton.style.display = 'none';
    }

    const deleteBookingButton = document.getElementById('deleteBookingButton');
    if (deleteBookingButton) {
      deleteBookingButton.style.display = 'none';
    }

    // Disable tabs
    const tabButtons = document.querySelectorAll('.edit-tab-btn');
    tabButtons.forEach((btn) => {
      btn.disabled = true;
      btn.style.cursor = 'not-allowed';
      btn.style.opacity = '0.6';
      btn.onclick = null;
    });

    // Show read-only calendar info
    const editCalendarContainer = document.getElementById('editCalendarContainer');
    if (editCalendarContainer) {
      editCalendarContainer.innerHTML = `
        <div style="padding: 2rem; text-align: center; background: #f3f4f6; border-radius: 8px;">
          <p style="color: #6b7280;">📅 ${this.t('readOnlyTerm')} ${this.currentBooking.startDate} - ${this.currentBooking.endDate}</p>
          <p style="color: #6b7280;">🏠 ${this.t('readOnlyRooms')} ${this.currentBooking.rooms.join(', ')}</p>
          <p style="color: #6b7280; margin-top: 1rem;">${this.t('readOnlyEditNotPossible')}</p>
        </div>
      `;
    }

    // Show billing tab
    const editDatesTab = document.getElementById('editDatesTab');
    if (editDatesTab) {
      editDatesTab.style.display = 'none';
    }

    const editBillingTab = document.getElementById('editBillingTab');
    if (editBillingTab) {
      editBillingTab.style.display = 'block';
    }
  }

  // =============================================
  // UI Helpers
  // =============================================

  showError(message) {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
      loadingState.style.display = 'none';
    }

    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');

    if (errorState && errorMessage) {
      errorMessage.textContent = message;
      errorState.style.display = 'block';
    }
  }

  showSuccess(message) {
    if (window.notificationManager) {
      window.notificationManager.show(message, 'success', 5000);
    }
  }

  showNotification(message, type = 'info', duration = 5000) {
    if (window.notificationManager) {
      window.notificationManager.show(message, type, duration);
    }
  }

  showConfirm(message, onConfirm, onCancel = null) {
    if (window.modalDialog) {
      window.modalDialog
        .confirm({
          title: this.t('confirmTitle'),
          message,
          type: 'warning',
          confirmText: this.t('confirmButton'),
          cancelText: this.t('cancel'),
        })
        .then((confirmed) => {
          if (confirmed && onConfirm) {
            onConfirm();
          }
          if (!confirmed && onCancel) {
            onCancel();
          }
        });
    } else {
      // eslint-disable-next-line no-alert
      if (confirm(message)) {
        if (onConfirm) {
          onConfirm();
        }
      } else if (onCancel) {
        onCancel();
      }
    }
  }
}

// Initialize edit page
const editPage = new EditPage();
