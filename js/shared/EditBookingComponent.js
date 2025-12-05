/**
 * EditBookingComponent - SSOT for Booking Edit Functionality
 *
 * Shared component used by both admin edit modal and user edit page.
 * Eliminates code duplication and provides consistent edit experience.
 *
 * Features:
 * - Per-room guest configuration
 * - Real-time bed capacity validation
 * - Conflict detection and display
 * - Price calculation
 * - Tab switching (Dates/Billing)
 * - Custom modal dialogs for confirmations
 * - Undo functionality for room removal
 *
 * Configuration options allow for admin vs user differences:
 * - Admin: no edit deadline, session validation, allowPast dates
 * - User: 3-day deadline, token-based auth, read-only mode
 */

// Import ModalDialog for custom confirmations
/* global modalDialog */

// Notification timeout constants (milliseconds)
const NOTIFICATION_TIMEOUT = {
  ERROR: 5000,
  WARNING: 4000,
  SUCCESS: 2000,
  INFO: 3000,
};

class EditBookingComponent {
  /**
   * @param {Object} config - Configuration options
   * @param {string} config.mode - 'admin' or 'user'
   * @param {boolean} config.enforceDeadline - Enable 3-day edit deadline (user only)
   * @param {Function} config.validateSession - Session validation callback (admin only)
   * @param {Function} config.onSubmit - Submit callback
   * @param {Function} config.onDelete - Delete callback
   * @param {Object} config.settings - Application settings
   */
  constructor(config = {}) {
    this.mode = config.mode || 'user';
    this.enforceDeadline = config.enforceDeadline !== false;
    this.validateSession = config.validateSession;
    this.onSubmit = config.onSubmit;
    this.onDelete = config.onDelete;
    this.settings = config.settings || null;

    // Edit state
    this.currentBooking = null;
    this.editSelectedRooms = new Map();
    this.editStartDate = null;
    this.editEndDate = null;
    this.originalStartDate = null;
    this.originalEndDate = null;
    this.isEditLocked = false;
    this.isBulkBooking = false; // True if booking contains all rooms
    this.originalRooms = []; // Store original rooms that cannot be changed

    // Per-room editing state
    this.perRoomDates = new Map(); // roomId -> {startDate, endDate}
    this.currentEditingRoom = null;
    this.tempRoomStartDate = null;
    this.tempRoomEndDate = null;

    // Session ID for proposed bookings (consistent across edit session)
    this.sessionId = null;

    // Undo functionality for room removal
    this.undoStack = []; // Stack of removed room states
    this.undoTimeouts = new Map(); // roomId -> timeout ID for auto-expire
    this.UNDO_TIME_LIMIT = 30000; // 30 seconds to undo

    this.contactForm = null; // BookingContactForm instance

    // Initialize sub-modules
    this.calendar = new EditBookingCalendar({
      mode: this.mode,
      getSettings: () => this.settings,
      onDateSelect: (d) => this.handleDateSelect(d),
      onDateDeselect: (d) => this.handleDateDeselect(d),
    });
    this.guests = new EditBookingGuests();
    this.rooms = new EditBookingRooms(this);
  }

  /**
   * Load booking data and initialize edit form
   * @param {Object} booking - Booking data to edit
   * @param {Object} settings - Application settings
   */
  loadBooking(booking, settings) {
    // Defensive check: Validate booking data exists
    if (!booking) {
      console.error('EditBookingComponent.loadBooking: No booking provided');
      throw new Error('Rezervace nebyla nalezena. Zkuste obnovit stránku.');
    }

    if (!booking.startDate || !booking.endDate) {
      console.error('EditBookingComponent.loadBooking: Missing dates', {
        bookingId: booking.id,
        startDate: booking.startDate,
        endDate: booking.endDate,
      });
      throw new Error('Chyba při načítání termínu rezervace. Zkuste obnovit stránku.');
    }

    this.currentBooking = booking;
    this.settings = settings;

    // Generate consistent session ID for proposed bookings in this edit session
    this.sessionId = `edit-${booking.id}-${Date.now()}`;

    // Detect if this is a bulk booking (all rooms reserved)
    this.isBulkBooking = BookingUtils.isBulkBooking(booking, settings.rooms);

    // Store original dates for calendar display
    this.originalStartDate = booking.startDate;
    this.originalEndDate = booking.endDate;

    // ⚠️ CRITICAL: Store original rooms - users CANNOT add/remove rooms in edit mode
    this.originalRooms = [...(booking.rooms || [])];

    // Current edit dates (will be changed by user)
    this.editStartDate = booking.startDate;
    this.editEndDate = booking.endDate;

    // Initialize per-room guest data from database
    const defaultGuestType = booking.guestType || 'external';

    // FIX: Verify perRoomGuests totals match booking totals
    let totalPerRoomAdults = 0;
    let totalPerRoomChildren = 0;
    let totalPerRoomToddlers = 0;

    if (booking.perRoomGuests) {
      Object.values(booking.perRoomGuests).forEach((roomGuests) => {
        totalPerRoomAdults += roomGuests.adults || 0;
        totalPerRoomChildren += roomGuests.children || 0;
        totalPerRoomToddlers += roomGuests.toddlers || 0;
      });
    }

    const perRoomTotalsMatch =
      totalPerRoomAdults === (booking.adults || 0) &&
      totalPerRoomChildren === (booking.children || 0) &&
      totalPerRoomToddlers === (booking.toddlers || 0);

    const hasCompletePerRoomGuests =
      booking.perRoomGuests &&
      Object.keys(booking.perRoomGuests).length === (booking.rooms || []).length &&
      perRoomTotalsMatch;

    if (hasCompletePerRoomGuests) {
      (booking.rooms || []).forEach((roomId) => {
        const roomGuests = booking.perRoomGuests[roomId];
        if (roomGuests) {
          this.editSelectedRooms.set(roomId, {
            guestType: roomGuests.guestType || defaultGuestType,
            adults: roomGuests.adults === undefined ? 1 : roomGuests.adults,
            children: roomGuests.children === undefined ? 0 : roomGuests.children,
            toddlers: roomGuests.toddlers === undefined ? 0 : roomGuests.toddlers,
          });
        } else {
          this.editSelectedRooms.set(roomId, {
            guestType: defaultGuestType,
            adults: 1,
            children: 0,
            toddlers: 0,
          });
        }
      });
    } else {
      const roomCount = (booking.rooms || []).length;
      const totalAdults = booking.adults || 1;
      const totalChildren = booking.children || 0;
      const totalToddlers = booking.toddlers || 0;

      if (roomCount === 0) {
        console.error('EditBookingComponent: No rooms in booking', booking.id);
        return;
      }

      const adultsPerRoom = Math.floor(totalAdults / roomCount);
      const adultsRemainder = totalAdults % roomCount;
      const childrenPerRoom = Math.floor(totalChildren / roomCount);
      const childrenRemainder = totalChildren % roomCount;
      const toddlersPerRoom = Math.floor(totalToddlers / roomCount);
      const toddlersRemainder = totalToddlers % roomCount;

      (booking.rooms || []).forEach((roomId, index) => {
        this.editSelectedRooms.set(roomId, {
          guestType: defaultGuestType,
          adults: adultsPerRoom + (index < adultsRemainder ? 1 : 0),
          children: childrenPerRoom + (index < childrenRemainder ? 1 : 0),
          toddlers: toddlersPerRoom + (index < toddlersRemainder ? 1 : 0),
        });
      });
    }

    // Load per-room dates if available
    if (booking.perRoomDates && Object.keys(booking.perRoomDates).length > 0) {
      Object.entries(booking.perRoomDates).forEach(([roomId, dates]) => {
        this.perRoomDates.set(roomId, {
          startDate: dates.startDate,
          endDate: dates.endDate,
        });
      });
    } else {
      (booking.rooms || []).forEach((roomId) => {
        this.perRoomDates.set(roomId, {
          startDate: booking.startDate,
          endDate: booking.endDate,
        });
      });
    }

    if (this.perRoomDates.size === 0 && (booking.rooms || []).length > 0) {
      console.warn(
        '[EditBookingComponent] perRoomDates empty after initialization, forcing resync'
      );
      (booking.rooms || []).forEach((roomId) => {
        this.perRoomDates.set(roomId, {
          startDate: booking.startDate,
          endDate: booking.endDate,
        });
      });
    }

    // Check edit deadline (user mode only)
    if (this.enforceDeadline && this.mode === 'user') {
      this.isEditLocked = this.checkEditDeadline();
    }

    // Populate form fields
    this.populateForm();

    // Use per-room list UI (now includes guest name fields generation)
    this.rooms.renderPerRoomList();

    // Hide calendar initially
    this.calendar.destroy(); // Ensure clean state
    const calendarHeader = document.getElementById('editCalendarHeader');
    const calendarContainer = document.getElementById('editCalendarContainer');
    const selectedDatesContainer = document.getElementById('editSelectedDatesContainer');
    const saveBtn = document.getElementById('saveRoomDatesBtn');

    if (calendarHeader) {
      calendarHeader.style.display = 'none';
    }
    if (calendarContainer) {
      calendarContainer.style.display = 'none';
    }
    if (selectedDatesContainer) {
      selectedDatesContainer.style.display = 'none';
    }
    if (saveBtn) {
      saveBtn.style.display = 'none';
    }

    // Update price
    this.updateTotalPrice();
  }

  checkEditDeadline() {
    if (!this.currentBooking || !this.currentBooking.startDate) {
      return false;
    }

    const startDate = new Date(this.currentBooking.startDate);
    const now = new Date();
    const diffTime = startDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 3) {
      const warningEl = document.getElementById('editDeadlineWarning');
      const formContainer = document.getElementById('editFormContainer');
      const deadlineMessage = document.getElementById('deadlineMessage');

      if (warningEl) {
        warningEl.style.display = 'block';
      }
      if (formContainer) {
        formContainer.style.display = 'none';
      }
      if (deadlineMessage) {
        deadlineMessage.innerHTML = `Úpravy a zrušení rezervace jsou možné pouze <strong>3 dny před začátkem pobytu</strong>.<br>Do začátku pobytu zbývá: <strong>${diffDays} dní</strong>.`;
      }
      return true;
    }
    return false;
  }

  populateForm() {
    if (!this.currentBooking) {
      return;
    }

    const fields = [
      'Name',
      'Email',
      'Phone',
      'Company',
      'Address',
      'City',
      'Zip',
      'Ico',
      'Dic',
      'Notes',
    ];
    fields.forEach((field) => {
      const el = document.getElementById(`edit${field}`);
      if (el) {
        el.value = this.currentBooking[field.toLowerCase()] || '';
      }
    });

    const payFromBenefit = document.getElementById('editPayFromBenefit');
    if (payFromBenefit) {
      payFromBenefit.checked = this.currentBooking.payFromBenefit || false;
    }

    const bookingIdDisplay = document.getElementById('bookingIdDisplay');
    if (bookingIdDisplay) {
      bookingIdDisplay.textContent = `#${this.currentBooking.id}`;
    }

    // Hide legacy guest names section
    this.guests.hideLegacyGuestSection();
  }

  switchTab(tabName) {
    const tabs = document.querySelectorAll('.edit-tab-btn');
    const contents = document.querySelectorAll('.edit-tab-content');

    tabs.forEach((tab) => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
        tab.style.color = '#0d9488';
        tab.style.borderBottom = '3px solid #0d9488';
      } else {
        tab.classList.remove('active');
        tab.style.color = '#6b7280';
        tab.style.borderBottom = '3px solid transparent';
      }
    });

    contents.forEach((content) => {
      content.style.display =
        content.id === `edit${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`
          ? 'block'
          : 'none';
    });

    if (tabName === 'dates') {
      this.rooms.renderPerRoomList();
    }
  }

  updateTotalPrice() {
    const totalPriceEl = document.getElementById('editTotalPrice');
    if (!totalPriceEl) {
      return;
    }

    // Collect guest types from DOM toggles for per-guest pricing
    const guestNames = this._collectGuestNamesWithPriceTypes();

    // If no guests collected, fall back to 0
    if (guestNames.length === 0) {
      totalPriceEl.textContent = '0 Kč';
      return;
    }

    // Build perRoomGuests with accurate counts per room
    const perRoomGuests = {};
    for (const [roomId, roomData] of this.editSelectedRooms.entries()) {
      perRoomGuests[roomId] = {
        adults: roomData.adults,
        children: roomData.children,
        toddlers: roomData.toddlers || 0,
      };
    }

    // Calculate price using per-guest method (handles mixed ÚTIA/External)
    const total = PriceCalculator.calculatePerGuestPrice({
      rooms: Array.from(this.editSelectedRooms.keys()),
      guestNames,
      perRoomGuests,
      perRoomDates: Object.fromEntries(this.perRoomDates),
      nights: null, // Will be calculated per room from perRoomDates
      settings: this.settings,
      fallbackGuestType: 'external',
    });

    totalPriceEl.textContent = `${total.toLocaleString('cs-CZ')} Kč`;
  }

  /**
   * Collect guest names with their price types from DOM for price calculation
   * FIX 2025-12-05: Read per-guest price types from toggle checkboxes
   * @returns {Array<Object>} Guest objects with roomId, personType, guestPriceType
   */
  _collectGuestNamesWithPriceTypes() {
    const guestNames = [];

    for (const [roomId, roomData] of this.editSelectedRooms.entries()) {
      // Collect adults
      for (let i = 1; i <= (roomData.adults || 0); i++) {
        const toggleId = `room${roomId}Adult${i}GuestTypeToggle`;
        const toggle = document.getElementById(toggleId);
        const isExternal = toggle?.checked || false;

        guestNames.push({
          roomId,
          personType: 'adult',
          guestPriceType: isExternal ? 'external' : 'utia',
          firstName: document.getElementById(`room${roomId}AdultFirstName${i}`)?.value || '',
          lastName: document.getElementById(`room${roomId}AdultLastName${i}`)?.value || '',
        });
      }

      // Collect children
      for (let i = 1; i <= (roomData.children || 0); i++) {
        const toggleId = `room${roomId}Child${i}GuestTypeToggle`;
        const toggle = document.getElementById(toggleId);
        const isExternal = toggle?.checked || false;

        guestNames.push({
          roomId,
          personType: 'child',
          guestPriceType: isExternal ? 'external' : 'utia',
          firstName: document.getElementById(`room${roomId}ChildFirstName${i}`)?.value || '',
          lastName: document.getElementById(`room${roomId}ChildLastName${i}`)?.value || '',
        });
      }

      // Collect toddlers (always free, no price type toggle)
      for (let i = 1; i <= (roomData.toddlers || 0); i++) {
        guestNames.push({
          roomId,
          personType: 'toddler',
          guestPriceType: 'utia',
          firstName: document.getElementById(`room${roomId}ToddlerFirstName${i}`)?.value || '',
          lastName: document.getElementById(`room${roomId}ToddlerLastName${i}`)?.value || '',
        });
      }
    }

    return guestNames;
  }

  handleRoomDateSelect(roomId, dateStr) {
    if (this.tempRoomStartDate && this.tempRoomEndDate) {
      this.tempRoomStartDate = dateStr;
      this.tempRoomEndDate = null;
    } else if (this.tempRoomStartDate) {
      if (dateStr > this.tempRoomStartDate) {
        this.tempRoomEndDate = dateStr;
      } else {
        this.tempRoomEndDate = this.tempRoomStartDate;
        this.tempRoomStartDate = dateStr;
      }
    } else {
      this.tempRoomStartDate = dateStr;
    }
    this.updateRoomDateDisplay();
  }

  handleRoomDateDeselect(roomId, dateStr) {
    if (dateStr === this.tempRoomStartDate) {
      this.tempRoomStartDate = this.tempRoomEndDate;
      this.tempRoomEndDate = null;
    } else if (dateStr === this.tempRoomEndDate) {
      this.tempRoomEndDate = null;
    }
    this.updateRoomDateDisplay();
  }

  updateRoomDateDisplay() {
    const displayEl = document.getElementById('editSelectedDates');
    if (!displayEl) {
      return;
    }

    if (this.tempRoomStartDate && this.tempRoomEndDate) {
      const startFormatted = DateUtils.formatDateDisplay(
        DateUtils.parseDate(this.tempRoomStartDate),
        'cs'
      );
      const endFormatted = DateUtils.formatDateDisplay(
        DateUtils.parseDate(this.tempRoomEndDate),
        'cs'
      );
      displayEl.innerHTML = `${startFormatted} - ${endFormatted}`;
      displayEl.style.color = '#059669';
      displayEl.style.fontWeight = '600';
    } else if (this.tempRoomStartDate) {
      const startFormatted = DateUtils.formatDateDisplay(
        DateUtils.parseDate(this.tempRoomStartDate),
        'cs'
      );
      displayEl.innerHTML = `${startFormatted} (vyberte konec)`;
      displayEl.style.color = '#d97706';
    } else {
      displayEl.innerHTML = 'Zatím nevybráno';
      displayEl.style.color = '#6b7280';
    }
  }

  async saveRoomDates(roomId) {
    if (!this.tempRoomStartDate || !this.tempRoomEndDate) {
      this.showNotification(
        'Vyberte prosím kompletní termín (začátek i konec)',
        'warning',
        NOTIFICATION_TIMEOUT.INFO
      );
      return;
    }

    const bookings = await dataManager.getAllBookings();
    const conflicts = bookings.filter((b) => {
      if (b.id === this.currentBooking.id) {
        return false;
      }
      let compareStartDate = b.startDate;
      let compareEndDate = b.endDate;
      if (b.perRoomDates && b.perRoomDates[roomId]) {
        compareStartDate = b.perRoomDates[roomId].startDate;
        compareEndDate = b.perRoomDates[roomId].endDate;
      }
      const hasDateOverlap = BookingLogic.checkDateOverlap(
        this.tempRoomStartDate,
        this.tempRoomEndDate,
        compareStartDate,
        compareEndDate
      );
      const hasRoomOverlap = b.rooms.includes(roomId);
      return hasDateOverlap && hasRoomOverlap;
    });

    if (conflicts.length > 0) {
      this.showNotification(
        langManager.t('roomOccupiedInPeriod').replace('{roomId}', roomId),
        'error',
        4000
      );
      return;
    }

    const currentDate = new Date(this.tempRoomStartDate);
    const endDate = new Date(this.tempRoomEndDate);
    while (currentDate <= endDate) {
      const availability = await dataManager.getRoomAvailability(currentDate, roomId);
      if (availability.status === 'blocked') {
        this.showNotification(
          langManager.t('roomBlockedInPeriod').replace('{roomId}', roomId),
          'error',
          4000
        );
        return;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    try {
      const roomData = this.editSelectedRooms.get(roomId) || {
        guestType: 'external',
        adults: 1,
        children: 0,
        toddlers: 0,
      };

      const result = await dataManager.createProposedBooking({
        sessionId: this.sessionId,
        startDate: this.tempRoomStartDate,
        endDate: this.tempRoomEndDate,
        rooms: [roomId],
        guests: {
          adults: roomData.adults,
          children: roomData.children,
          toddlers: roomData.toddlers,
        },
        guestType: roomData.guestType,
        totalPrice: 0,
      });

      this.perRoomDates.set(roomId, {
        startDate: this.tempRoomStartDate,
        endDate: this.tempRoomEndDate,
        proposalId: result.proposalId,
      });

      this.updateGlobalBookingDates();
      this.cancelRoomEdit();
      this.showNotification(
        'Termín byl dočasně rezervován',
        'success',
        NOTIFICATION_TIMEOUT.SUCCESS
      );
    } catch (error) {
      console.error('Error creating proposed booking:', error);
      this.showNotification(
        error.message || 'Chyba při rezervaci termínu',
        'error',
        NOTIFICATION_TIMEOUT.ERROR
      );
    }
  }

  updateGlobalBookingDates() {
    let minStart = null;
    let maxEnd = null;

    for (const dates of this.perRoomDates.values()) {
      if (!minStart || dates.startDate < minStart) {
        minStart = dates.startDate;
      }
      if (!maxEnd || dates.endDate > maxEnd) {
        maxEnd = dates.endDate;
      }
    }

    if (minStart !== null) {
      this.editStartDate = minStart;
    } else if (!this.editStartDate && this.originalStartDate) {
      this.editStartDate = this.originalStartDate;
    }

    if (maxEnd !== null) {
      this.editEndDate = maxEnd;
    } else if (!this.editEndDate && this.originalEndDate) {
      this.editEndDate = this.originalEndDate;
    }

    this.updateTotalPrice();
  }

  async openBulkCalendar() {
    this.currentEditingRoom = 'bulk';
    this.tempRoomStartDate = null;
    this.tempRoomEndDate = null;

    const roomNameEl = document.getElementById('editingRoomName');
    if (roomNameEl) {
      roomNameEl.textContent = 'Celá chata (všechny pokoje)';
    }

    const headerEl = document.getElementById('editCalendarHeader');
    const containerEl = document.getElementById('editCalendarContainer');
    const selectedDatesContainer = document.getElementById('editSelectedDatesContainer');
    const saveBtn = document.getElementById('saveRoomDatesBtn');

    if (headerEl) {
      headerEl.style.display = 'block';
    }
    if (containerEl) {
      containerEl.style.display = 'block';
    }
    if (selectedDatesContainer) {
      selectedDatesContainer.style.display = 'block';
    }
    if (saveBtn) {
      saveBtn.style.display = 'block';
    }

    const cancelBtn = document.getElementById('cancelRoomEditBtn');
    if (cancelBtn) {
      cancelBtn.onclick = () => this.cancelBulkEdit();
    }
    if (saveBtn) {
      saveBtn.onclick = () => this.saveBulkDates();
    }

    this.rooms.renderPerRoomList();
    await this.initializeBulkCalendar();
    this.updateRoomDateDisplay();
  }

  async initializeBulkCalendar() {
    const containerEl = document.getElementById('editCalendarContainer');
    if (!containerEl) {
      return;
    }
    containerEl.innerHTML = '';

    const firstRoomDates = this.perRoomDates.values().next().value;
    const bulkCalendar = new BaseCalendar({
      mode: BaseCalendar.MODES.BULK,
      app: { getAllData: () => dataManager.getAllData(), getSettings: () => this.settings },
      containerId: 'editCalendarContainer',
      enableDrag: true,
      allowPast: this.mode === 'admin',
      enforceContiguous: true,
      minNights: 2,
      onDateSelect: (d) => this.handleBulkDateSelect(d),
      onDateDeselect: (d) => this.handleBulkDateDeselect(d),
      currentEditingBookingId: this.currentBooking.id,
      sessionId: this.sessionId,
      originalBookingDates: {
        startDate: firstRoomDates.startDate,
        endDate: firstRoomDates.endDate,
        rooms: Array.from(this.perRoomDates.keys()),
      },
    });

    await bulkCalendar.render();
  }

  handleBulkDateSelect(dateStr) {
    if (this.tempRoomStartDate && this.tempRoomEndDate) {
      this.tempRoomStartDate = dateStr;
      this.tempRoomEndDate = null;
    } else if (this.tempRoomStartDate) {
      if (dateStr > this.tempRoomStartDate) {
        this.tempRoomEndDate = dateStr;
      } else {
        this.tempRoomEndDate = this.tempRoomStartDate;
        this.tempRoomStartDate = dateStr;
      }
    } else {
      this.tempRoomStartDate = dateStr;
    }
    this.updateRoomDateDisplay();
  }

  handleBulkDateDeselect(dateStr) {
    if (dateStr === this.tempRoomStartDate) {
      this.tempRoomStartDate = this.tempRoomEndDate;
      this.tempRoomEndDate = null;
    } else if (dateStr === this.tempRoomEndDate) {
      this.tempRoomEndDate = null;
    }
    this.updateRoomDateDisplay();
  }

  cancelBulkEdit() {
    this.currentEditingRoom = null;
    this.tempRoomStartDate = null;
    this.tempRoomEndDate = null;

    const headerEl = document.getElementById('editCalendarHeader');
    const containerEl = document.getElementById('editCalendarContainer');
    const selectedDatesContainer = document.getElementById('editSelectedDatesContainer');
    const saveBtn = document.getElementById('saveRoomDatesBtn');

    if (headerEl) {
      headerEl.style.display = 'none';
    }
    if (containerEl) {
      containerEl.style.display = 'none';
    }
    if (selectedDatesContainer) {
      selectedDatesContainer.style.display = 'none';
    }
    if (saveBtn) {
      saveBtn.style.display = 'none';
    }

    if (containerEl) {
      containerEl.innerHTML = '';
    }
    this.rooms.renderPerRoomList();
  }

  async saveBulkDates() {
    if (!this.tempRoomStartDate || !this.tempRoomEndDate) {
      this.showNotification(
        'Vyberte prosím kompletní termín (začátek i konec)',
        'warning',
        NOTIFICATION_TIMEOUT.INFO
      );
      return;
    }

    const bookings = await dataManager.getAllBookings();
    const allRoomIds = Array.from(this.editSelectedRooms.keys());

    for (const roomId of allRoomIds) {
      const conflicts = bookings.filter((b) => {
        if (b.id === this.currentBooking.id) {
          return false;
        }
        let compareStartDate = b.startDate;
        let compareEndDate = b.endDate;
        if (b.perRoomDates && b.perRoomDates[roomId]) {
          compareStartDate = b.perRoomDates[roomId].startDate;
          compareEndDate = b.perRoomDates[roomId].endDate;
        }
        const hasDateOverlap = BookingLogic.checkDateOverlap(
          this.tempRoomStartDate,
          this.tempRoomEndDate,
          compareStartDate,
          compareEndDate
        );
        const hasRoomOverlap = b.rooms.includes(roomId);
        return hasDateOverlap && hasRoomOverlap;
      });

      if (conflicts.length > 0) {
        const room = this.settings.rooms.find((r) => r.id === roomId);
        this.showNotification(
          `⚠️ ${room?.name || roomId} je v tomto termínu již obsazený. Zvolte jiný termín.`,
          'error',
          4000
        );
        return;
      }
    }

    const currentDate = new Date(this.tempRoomStartDate);
    const endDate = new Date(this.tempRoomEndDate);
    while (currentDate <= endDate) {
      for (const roomId of allRoomIds) {
        const availability = await dataManager.getRoomAvailability(currentDate, roomId);
        if (availability.status === 'blocked') {
          const room = this.settings.rooms.find((r) => r.id === roomId);
          this.showNotification(
            `⚠️ ${room?.name || roomId} je v tomto termínu blokován. Zvolte jiný termín.`,
            'error',
            4000
          );
          return;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    try {
      let totalAdults = 0;
      let totalChildren = 0;
      let totalToddlers = 0;
      for (const roomData of this.editSelectedRooms.values()) {
        totalAdults += roomData.adults || 0;
        totalChildren += roomData.children || 0;
        totalToddlers += roomData.toddlers || 0;
      }

      const response = await fetch('/api/proposed-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          startDate: this.tempRoomStartDate,
          endDate: this.tempRoomEndDate,
          rooms: allRoomIds,
          guests: { adults: totalAdults, children: totalChildren, toddlers: totalToddlers },
          guestType: 'external',
          totalPrice: 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Nepodařilo se rezervovat termín');
      }

      const result = await response.json();
      for (const roomId of allRoomIds) {
        this.perRoomDates.set(roomId, {
          startDate: this.tempRoomStartDate,
          endDate: this.tempRoomEndDate,
          proposalId: result.proposalId,
        });
      }

      this.updateGlobalBookingDates();
      this.cancelBulkEdit();
      this.showNotification(
        'Termín byl dočasně rezervován pro všechny pokoje',
        'success',
        NOTIFICATION_TIMEOUT.SUCCESS
      );
    } catch (error) {
      console.error('Error creating bulk proposed booking:', error);
      this.showNotification(
        error.message || 'Chyba při rezervaci termínu',
        'error',
        NOTIFICATION_TIMEOUT.ERROR
      );
    }
  }

  logRoomChange(actionType, roomId, options = {}) {
    let userType = 'user';
    let userIdentifier = null;

    if (typeof window !== 'undefined' && window.sessionStorage) {
      const adminSession = window.sessionStorage.getItem('adminSessionToken');
      if (adminSession) {
        userType = 'admin';
        userIdentifier = adminSession.substring(0, 8);
      } else if (this.editToken) {
        userType = 'user';
        userIdentifier = this.editToken.substring(0, 8);
      }
    }

    const auditData = {
      bookingId: this.bookingId,
      actionType,
      userType,
      userIdentifier,
      roomId,
      beforeState: options.beforeState || null,
      afterState: options.afterState || null,
      changeDetails: options.changeDetails || null,
    };

    if (typeof fetch !== 'undefined') {
      fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditData),
      }).catch((error) => {
        console.warn('Failed to create audit log:', error);
      });
    }
  }

  getSessionId() {
    return this.sessionId;
  }

  cancelRoomEdit() {
    this.currentEditingRoom = null;
    this.tempRoomStartDate = null;
    this.tempRoomEndDate = null;

    const headerEl = document.getElementById('editCalendarHeader');
    const containerEl = document.getElementById('editCalendarContainer');
    const selectedDatesContainer = document.getElementById('editSelectedDatesContainer');
    const saveBtn = document.getElementById('saveRoomDatesBtn');

    if (headerEl) {
      headerEl.style.display = 'none';
    }
    if (containerEl) {
      containerEl.style.display = 'none';
    }
    if (selectedDatesContainer) {
      selectedDatesContainer.style.display = 'none';
    }
    if (saveBtn) {
      saveBtn.style.display = 'none';
    }

    if (containerEl) {
      containerEl.innerHTML = '';
    }
    this.rooms.renderPerRoomList();
  }

  showNotification(message, type = 'info', duration = 3000) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }

    const container = document.getElementById('notificationContainer');
    if (!container) {
      return;
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
      background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
      color: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.innerHTML = `<span>${message}</span>`;

    container.appendChild(notification);
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  showNotificationWithUndo(message, roomId, type = 'success', duration = 30000) {
    const container = document.getElementById('notificationContainer');
    if (!container) {
      return;
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.id = `undo-notification-${roomId}`;
    notification.style.cssText = `
      background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
      color: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      min-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      <span>${message}</span>
      <button onclick="editPage.editComponent.undoRemoveRoom('${roomId}')" 
        style="background: white; color: #10b981; border: none; padding: 0.25rem 0.75rem; border-radius: 4px; font-weight: 600; cursor: pointer;">
        ZRUŠIT (UNDO)
      </button>
    `;

    container.appendChild(notification);
    setTimeout(() => {
      if (document.getElementById(`undo-notification-${roomId}`)) {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  undoRemoveRoom(roomId) {
    const undoIndex = this.undoStack.findIndex((state) => state.roomId === roomId);
    if (undoIndex === -1) {
      return;
    }

    const undoState = this.undoStack[undoIndex];
    this.undoStack.splice(undoIndex, 1);

    if (this.undoTimeouts.has(roomId)) {
      clearTimeout(this.undoTimeouts.get(roomId));
      this.undoTimeouts.delete(roomId);
    }

    this.editSelectedRooms.set(roomId, undoState.roomData);
    this.perRoomDates.set(roomId, undoState.roomDates);

    this.logRoomChange('room_restored', roomId, {
      beforeState: null,
      afterState: { roomData: undoState.roomData, roomDates: undoState.roomDates },
      changeDetails: `Room ${roomId} restored from undo`,
    });

    this.updateGlobalBookingDates();
    this.updateTotalPrice();
    this.rooms.renderPerRoomList();

    const notification = document.getElementById(`undo-notification-${roomId}`);
    if (notification) {
      notification.remove();
    }

    this.showNotification(`✅ Pokoj byl obnoven`, 'success');
  }

  expireUndo(roomId) {
    const undoIndex = this.undoStack.findIndex((state) => state.roomId === roomId);
    if (undoIndex !== -1) {
      this.undoStack.splice(undoIndex, 1);
    }
    this.undoTimeouts.delete(roomId);
    const notification = document.getElementById(`undo-notification-${roomId}`);
    if (notification) {
      notification.remove();
    }
  }

  revertInputValue(roomId, field, oldValue) {
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll(
        `input[onchange*="updateRoomGuests('${roomId}', '${field}'"]`
      );
      inputs.forEach((input) => {
        input.value = oldValue;
      });
    });
  }

  async onSubmit(e) {
    e.preventDefault();
    if (this.isEditLocked) {
      return;
    }

    const validation = this.guests.validateGuestNames(
      Array.from(this.editSelectedRooms.values()).reduce((sum, r) => sum + (r.adults || 0), 0),
      Array.from(this.editSelectedRooms.values()).reduce((sum, r) => sum + (r.children || 0), 0),
      Array.from(this.editSelectedRooms.values()).reduce((sum, r) => sum + (r.toddlers || 0), 0)
    );

    if (!validation.valid) {
      this.showNotification(validation.error, 'error', 5000);
      return;
    }

    if (this.onSubmit && typeof this.onSubmit === 'function') {
      const formData = {
        ...this.currentBooking,
        startDate: this.editStartDate,
        endDate: this.editEndDate,
        rooms: Array.from(this.editSelectedRooms.keys()),
        perRoomGuests: Object.fromEntries(this.editSelectedRooms),
        perRoomDates: Object.fromEntries(this.perRoomDates),
        guestNames: validation.guestNames,
        // Collect other form fields
        name: document.getElementById('editName')?.value,
        email: document.getElementById('editEmail')?.value,
        phone: document.getElementById('editPhone')?.value,
        company: document.getElementById('editCompany')?.value,
        address: document.getElementById('editAddress')?.value,
        city: document.getElementById('editCity')?.value,
        zip: document.getElementById('editZip')?.value,
        ico: document.getElementById('editIco')?.value,
        dic: document.getElementById('editDic')?.value,
        notes: document.getElementById('editNotes')?.value,
        payFromBenefit: document.getElementById('editPayFromBenefit')?.checked,
      };

      await this.onSubmit(formData);
    }
  }
}

window.EditBookingComponent = EditBookingComponent;
