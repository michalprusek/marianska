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

// eslint-disable-next-line no-unused-vars
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
    this.editCalendar = null;
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
  }

  /**
   * Update toggle visual state (ÚTIA vs External)
   * Extracted helper to avoid code duplication
   * @param {HTMLElement} slider - Toggle slider element
   * @param {HTMLElement} thumb - Toggle thumb element
   * @param {HTMLElement|null} toggleText - Text element showing current state
   * @param {boolean} isExternal - true for External (red), false for ÚTIA (green)
   */
  updateToggleVisualState(slider, thumb, toggleText, isExternal) {
    if (!slider || !thumb) {
      return;
    }
    const color = isExternal ? '#dc2626' : '#059669';
    /* eslint-disable no-param-reassign -- DOM element style modification */
    slider.style.backgroundColor = color;
    thumb.style.transform = isExternal ? 'translateX(20px)' : 'translateX(0)';
    if (toggleText) {
      toggleText.textContent = isExternal ? 'EXT' : 'ÚTIA';
      toggleText.style.color = color;
    }
    /* eslint-enable no-param-reassign */
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
    // If perRoomGuests is available, use it directly. Otherwise, fall back to distribution.
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

    // FIX: Check if perRoomGuests has data for ALL rooms AND totals match
    const hasCompletePerRoomGuests =
      booking.perRoomGuests &&
      Object.keys(booking.perRoomGuests).length === (booking.rooms || []).length &&
      perRoomTotalsMatch;

    if (hasCompletePerRoomGuests) {
      // Use per-room guest data from database
      (booking.rooms || []).forEach((roomId) => {
        const roomGuests = booking.perRoomGuests[roomId];
        if (roomGuests) {
          this.editSelectedRooms.set(roomId, {
            guestType: roomGuests.guestType || defaultGuestType,
            // FIX: Respect 0 as valid value (don't use || operator for numbers)
            adults: roomGuests.adults === undefined ? 1 : roomGuests.adults,
            children: roomGuests.children === undefined ? 0 : roomGuests.children,
            toddlers: roomGuests.toddlers === undefined ? 0 : roomGuests.toddlers,
          });
        } else {
          // Fallback for rooms without stored data (shouldn't happen with complete check)
          this.editSelectedRooms.set(roomId, {
            guestType: defaultGuestType,
            adults: 1,
            children: 0,
            toddlers: 0,
          });
        }
      });
    } else {
      // Fallback: Distribute total guests across rooms (for legacy bookings)
      const roomCount = (booking.rooms || []).length;
      const totalAdults = booking.adults || 1;
      const totalChildren = booking.children || 0;
      const totalToddlers = booking.toddlers || 0;

      // FIX: Add validation to ensure we have valid guest counts
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
      // Fallback: initialize all rooms with booking-level dates
      (booking.rooms || []).forEach((roomId) => {
        this.perRoomDates.set(roomId, {
          startDate: booking.startDate,
          endDate: booking.endDate,
        });
      });
    }

    // FIX: Defensive resync - ensure perRoomDates has all rooms from the booking
    // This catches edge cases where initialization might miss some rooms
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
    this.renderPerRoomList();

    // Calendar is hidden by default (will be shown when user clicks "Změnit termín")
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

  /**
   * Check if booking is within 3-day edit deadline
   * @returns {boolean} True if edit is locked (< 3 days)
   */
  checkEditDeadline() {
    if (!this.currentBooking || !this.currentBooking.startDate) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(this.currentBooking.startDate);
    startDate.setHours(0, 0, 0, 0);

    const daysUntilStart = Math.floor((startDate - today) / (1000 * 60 * 60 * 24));

    return daysUntilStart < 3;
  }

  /**
   * Populate form fields with booking data
   */
  populateForm() {
    document.getElementById('editBookingId').value = this.currentBooking.id || '';
    document.getElementById('editName').value = this.currentBooking.name || '';
    document.getElementById('editEmail').value = this.currentBooking.email || '';
    document.getElementById('editPhone').value = this.currentBooking.phone || '';
    document.getElementById('editCompany').value = this.currentBooking.company || '';
    document.getElementById('editAddress').value = this.currentBooking.address || '';
    document.getElementById('editCity').value = this.currentBooking.city || '';
    document.getElementById('editZip').value = this.currentBooking.zip || '';
    document.getElementById('editIco').value = this.currentBooking.ico || '';
    document.getElementById('editDic').value = this.currentBooking.dic || '';
    document.getElementById('editNotes').value = this.currentBooking.notes || '';
    document.getElementById('editPayFromBenefit').checked =
      this.currentBooking.payFromBenefit || false;

    // NOTE: Guest names are populated in renderPerRoomList() after inputs are created
    // DO NOT call populateGuestNamesInRooms() here - inputs don't exist yet!
  }

  /**
   * Generate guest names input fields dynamically based on total guest counts
   * @param {number} adults - Total number of adults across all rooms
   * @param {number} children - Total number of children across all rooms
   * @param {number} toddlers - Total number of toddlers across all rooms
   */
  // eslint-disable-next-line no-unused-vars -- toddlers param kept for API consistency
  generateGuestNamesInputs(adults, children, toddlers = 0) {
    const guestNamesSection = document.getElementById('editGuestNamesSection');
    const adultsNamesList = document.getElementById('editAdultsNamesList');
    const childrenNamesList = document.getElementById('editChildrenNamesList');
    const toddlersNamesList = document.getElementById('editToddlersNamesList');
    const childrenContainer = document.getElementById('editChildrenNamesContainer');
    const toddlersContainer = document.getElementById('editToddlersNamesContainer');

    if (!guestNamesSection || !adultsNamesList || !childrenNamesList) {
      return;
    }

    // Clear existing inputs to prevent HTML5 validation errors on hidden fields
    adultsNamesList.textContent = '';
    childrenNamesList.textContent = '';
    if (toddlersNamesList) {
      toddlersNamesList.textContent = '';
    }

    // ALWAYS hide guest names section in edit window
    // Guest names are now collected from per-room inputs in "Termín a pokoje" tab
    // (generated by renderGuestListForRoom() method)
    guestNamesSection.style.display = 'none';
    if (childrenContainer) {
      childrenContainer.style.display = 'none';
    }
    if (toddlersContainer) {
      toddlersContainer.style.display = 'none';
    }
  }

  /**
   * Collect guest names from the generated form inputs
   * Supports both per-room inputs (room12AdultFirstName1) and bulk inputs (bulkAdultFirstName1)
   * @returns {Array<Object>} Array of guest name objects
   */
  collectGuestNames() {
    const guestNames = [];

    // Collect adult names from per-room inputs (format: room12AdultFirstName1)
    const adultFirstNames = document.querySelectorAll(
      'input[data-guest-type="adult"][id*="AdultFirstName"]'
    );
    const adultLastNames = document.querySelectorAll(
      'input[data-guest-type="adult"][id*="AdultLastName"]'
    );

    for (let i = 0; i < adultFirstNames.length; i++) {
      const firstName = adultFirstNames[i].value.trim();
      const lastName = adultLastNames[i].value.trim();
      if (firstName && lastName) {
        const inputId = adultFirstNames[i].id;
        const isBulk = adultFirstNames[i].dataset.bulk === 'true';

        if (isBulk) {
          // Bulk input format: bulkAdultFirstName1
          const guestIndexMatch = inputId.match(/bulkAdultFirstName(\d+)/);
          if (guestIndexMatch) {
            const guestIndex = guestIndexMatch[1];
            const toggleInput = document.getElementById(`bulkAdult${guestIndex}GuestTypeToggle`);
            const guestPriceType = toggleInput && toggleInput.checked ? 'external' : 'utia';

            guestNames.push({
              personType: 'adult',
              firstName,
              lastName,
              guestPriceType,
            });
          } else {
            console.warn('[EditBookingComponent] Failed to parse bulk adult input ID:', inputId);
          }
        } else {
          // Per-room input format: room12AdultFirstName1
          const roomIdMatch = inputId.match(/room(\d+)/);
          const guestIndexMatch = inputId.match(/AdultFirstName(\d+)/);

          if (roomIdMatch && guestIndexMatch) {
            const roomId = roomIdMatch[1];
            const guestIndex = guestIndexMatch[1];

            const toggleInput = document.getElementById(
              `room${roomId}Adult${guestIndex}GuestTypeToggle`
            );
            const guestPriceType = toggleInput && toggleInput.checked ? 'external' : 'utia';

            guestNames.push({
              personType: 'adult',
              firstName,
              lastName,
              guestPriceType,
            });
          } else {
            console.warn('[EditBookingComponent] Failed to parse per-room adult input ID:', inputId);
          }
        }
      }
    }

    // Collect children names from per-room inputs (format: room12ChildFirstName1)
    const childFirstNames = document.querySelectorAll(
      'input[data-guest-type="child"][id*="ChildFirstName"]'
    );
    const childLastNames = document.querySelectorAll(
      'input[data-guest-type="child"][id*="ChildLastName"]'
    );

    for (let i = 0; i < childFirstNames.length; i++) {
      const firstName = childFirstNames[i].value.trim();
      const lastName = childLastNames[i].value.trim();
      if (firstName && lastName) {
        const inputId = childFirstNames[i].id;
        const isBulk = childFirstNames[i].dataset.bulk === 'true';

        if (isBulk) {
          // Bulk input format: bulkChildFirstName1
          const guestIndexMatch = inputId.match(/bulkChildFirstName(\d+)/);
          if (guestIndexMatch) {
            const guestIndex = guestIndexMatch[1];
            const toggleInput = document.getElementById(`bulkChild${guestIndex}GuestTypeToggle`);
            const guestPriceType = toggleInput && toggleInput.checked ? 'external' : 'utia';

            guestNames.push({
              personType: 'child',
              firstName,
              lastName,
              guestPriceType,
            });
          } else {
            console.warn('[EditBookingComponent] Failed to parse bulk child input ID:', inputId);
          }
        } else {
          // Per-room input format: room12ChildFirstName1
          const roomIdMatch = inputId.match(/room(\d+)/);
          const guestIndexMatch = inputId.match(/ChildFirstName(\d+)/);

          if (roomIdMatch && guestIndexMatch) {
            const roomId = roomIdMatch[1];
            const guestIndex = guestIndexMatch[1];

            const toggleInput = document.getElementById(
              `room${roomId}Child${guestIndex}GuestTypeToggle`
            );
            const guestPriceType = toggleInput && toggleInput.checked ? 'external' : 'utia';

            guestNames.push({
              personType: 'child',
              firstName,
              lastName,
              guestPriceType,
            });
          } else {
            console.warn('[EditBookingComponent] Failed to parse per-room child input ID:', inputId);
          }
        }
      }
    }

    // Collect toddler names from per-room inputs (format: room12ToddlerFirstName1)
    const toddlerFirstNames = document.querySelectorAll(
      'input[data-guest-type="toddler"][id*="ToddlerFirstName"]'
    );
    const toddlerLastNames = document.querySelectorAll(
      'input[data-guest-type="toddler"][id*="ToddlerLastName"]'
    );

    for (let i = 0; i < toddlerFirstNames.length; i++) {
      const firstName = toddlerFirstNames[i].value.trim();
      const lastName = toddlerLastNames[i].value.trim();
      if (firstName && lastName) {
        guestNames.push({
          personType: 'toddler',
          firstName,
          lastName,
          guestPriceType: 'utia', // Default for toddlers (always free, no toggle switch)
        });
      }
    }

    return guestNames;
  }

  /**
   * Validate guest names input fields
   * @param {number} expectedAdults - Expected number of adults
   * @param {number} expectedChildren - Expected number of children
   * @param {number} expectedToddlers - Expected number of toddlers
   * @returns {Object} Validation result with valid flag and error message
   */
  validateGuestNames(expectedAdults, expectedChildren, expectedToddlers = 0) {
    const guestNames = this.collectGuestNames();
    const adultNames = guestNames.filter((g) => g.personType === 'adult');
    const childNames = guestNames.filter((g) => g.personType === 'child');
    const toddlerNames = guestNames.filter((g) => g.personType === 'toddler');

    // Check counts
    if (adultNames.length !== expectedAdults) {
      return {
        valid: false,
        error: `Vyplňte jména všech ${expectedAdults} dospělých v záložce "Termín a pokoje" (v kartách jednotlivých pokojů)`,
      };
    }

    if (childNames.length !== expectedChildren) {
      return {
        valid: false,
        error: `Vyplňte jména všech ${expectedChildren} dětí v záložce "Termín a pokoje" (v kartách jednotlivých pokojů)`,
      };
    }

    if (toddlerNames.length !== expectedToddlers) {
      return {
        valid: false,
        error: `Vyplňte jména všech ${expectedToddlers} batolat v záložce "Termín a pokoje" (v kartách jednotlivých pokojů)`,
      };
    }

    // Check each name for minimum length
    for (const guest of guestNames) {
      if (guest.firstName.length < 2) {
        return {
          valid: false,
          error:
            'Všechna křestní jména musí mít alespoň 2 znaky (zkontrolujte záložku "Termín a pokoje")',
        };
      }
      if (guest.lastName.length < 2) {
        return {
          valid: false,
          error:
            'Všechna příjmení musí mít alespoň 2 znaky (zkontrolujte záložku "Termín a pokoje")',
        };
      }
    }

    return { valid: true, guestNames };
  }

  /**
   * Initialize calendar for date selection
   */
  async initializeCalendar() {
    this.editCalendar = new BaseCalendar({
      mode: BaseCalendar.MODES.EDIT,
      app: {
        getAllData: () => dataManager.getAllData(),
        getSettings: () => this.settings,
      },
      containerId: 'editCalendarContainer',
      enableDrag: true,
      allowPast: this.mode === 'admin', // Admin can edit past dates
      onDateSelect: (dateStr) => this.handleDateSelection(dateStr),
      onDateDeselect: (dateStr) => this.handleDateDeselection(dateStr),
      selectedDates: new Set([this.editStartDate, this.editEndDate]),
      currentEditingBookingId: this.currentBooking.id,
      originalBookingDates: {
        startDate: this.originalStartDate,
        endDate: this.originalEndDate,
        rooms: this.currentBooking.rooms || [],
      },
      sessionId: this.sessionId, // CRITICAL: Pass edit session ID to exclude own proposed bookings
    });

    await this.editCalendar.render();
  }

  /**
   * Handle date selection in calendar
   */
  handleDateSelection(dateStr) {
    // Use positive conditions for better readability
    if (this.editStartDate && this.editEndDate) {
      // Both dates selected - reset selection
      this.editStartDate = dateStr;
      this.editEndDate = null;
    } else if (this.editStartDate) {
      // Start date selected, now selecting end date
      if (dateStr > this.editStartDate) {
        this.editEndDate = dateStr;
      } else {
        this.editEndDate = this.editStartDate;
        this.editStartDate = dateStr;
      }
    } else {
      // No dates selected yet - set start date
      this.editStartDate = dateStr;
    }

    this.updateEditUI();
  }

  /**
   * Handle date deselection in calendar
   */
  handleDateDeselection(dateStr) {
    if (dateStr === this.editStartDate) {
      this.editStartDate = this.editEndDate;
      this.editEndDate = null;
    } else if (dateStr === this.editEndDate) {
      this.editEndDate = null;
    }

    this.updateEditUI();
  }

  /**
   * Update entire edit UI (dates, rooms, price, conflicts)
   */
  updateEditUI() {
    // Update selected dates display
    if (this.editStartDate && this.editEndDate) {
      const startFormatted = DateUtils.formatDateDisplay(
        DateUtils.parseDate(this.editStartDate),
        'cs'
      );
      const endFormatted = DateUtils.formatDateDisplay(DateUtils.parseDate(this.editEndDate), 'cs');
      document.getElementById('editSelectedDates').textContent =
        `${startFormatted} - ${endFormatted}`;
    } else if (this.editStartDate) {
      const startFormatted = DateUtils.formatDateDisplay(
        DateUtils.parseDate(this.editStartDate),
        'cs'
      );
      document.getElementById('editSelectedDates').textContent =
        `${startFormatted} (vyberte konec)`;
    } else {
      document.getElementById('editSelectedDates').textContent = 'Zatím nevybráno';
    }

    // Update rooms list and price
    this.renderRoomsList();
    this.updateTotalPrice();

    // Note: loadExistingBookingsForEdit() removed - no longer needed in new UI
  }

  /**
   * Render rooms list with per-room guest configuration
   */
  renderRoomsList() {
    const roomsList = document.getElementById('editRoomsList');
    const rooms = this.settings?.rooms || [];

    roomsList.innerHTML = '';

    rooms.forEach((room) => {
      const isSelected = this.editSelectedRooms.has(room.id);
      const roomData = this.editSelectedRooms.get(room.id) || {
        guestType: 'external',
        adults: 1,
        children: 0,
        toddlers: 0,
      };

      const roomCard = document.createElement('div');
      roomCard.style.cssText = `
        padding: 1rem;
        border: 2px solid ${isSelected ? '#0d9488' : '#e5e7eb'};
        border-radius: 8px;
        background: ${isSelected ? '#f0fdfa' : 'white'};
        cursor: pointer;
      `;

      const onChangePrefix = this.mode === 'admin' ? 'adminPanel' : 'editPage';

      roomCard.innerHTML = `
        <label style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
          <input type="checkbox" ${isSelected ? 'checked' : ''}
            onchange="${onChangePrefix}.editComponent.toggleRoom('${room.id}')"
            style="width: auto; margin: 0;" />
          <strong>${room.name}</strong>
          <span style="color: #6b7280;">(${room.beds} lůžka)</span>
        </label>
        ${
          isSelected
            ? `
          <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #d1d5db;">
            <!-- Guest type select removed - each guest has individual ÚTIA/EXT toggle in guest names section -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
              <div>
                <label style="font-size: 0.75rem; display: block; margin-bottom: 0.25rem; color: #4b5563; font-weight: 500; height: 2.25rem; line-height: 1.2;">Dospělí (18+):</label>
                <input type="number" min="1" value="${roomData.adults}"
                  onchange="${onChangePrefix}.editComponent.updateRoomGuests('${room.id}', 'adults', parseInt(this.value))"
                  style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
              </div>
              <div>
                <label style="font-size: 0.75rem; display: block; margin-bottom: 0.25rem; color: #4b5563; font-weight: 500; height: 2.25rem; line-height: 1.2;">Děti (3-17 let):</label>
                <input type="number" min="0" value="${roomData.children}"
                  onchange="${onChangePrefix}.editComponent.updateRoomGuests('${room.id}', 'children', parseInt(this.value))"
                  style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
              </div>
              <div>
                <label style="font-size: 0.75rem; display: block; margin-bottom: 0.25rem; color: #4b5563; font-weight: 500; height: 2.25rem; line-height: 1.2;">Batolata (0-2 roky):</label>
                <input type="number" min="0" value="${roomData.toddlers}"
                  onchange="${onChangePrefix}.editComponent.updateRoomGuests('${room.id}', 'toddlers', parseInt(this.value))"
                  style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
              </div>
            </div>
          </div>
        `
            : ''
        }
      `;

      roomsList.appendChild(roomCard);
    });
  }

  /**
   * Toggle room selection
   * ⚠️ EDIT MODE: Users can now REMOVE rooms (with confirmation) but not ADD new ones
   */
  toggleRoom(roomId) {
    // Prevent room toggle for bulk bookings
    if (this.isBulkBooking) {
      this.showNotification(
        'Hromadné rezervace celé chaty nelze měnit po jednotlivých pokojích. ' +
          'Všechny pokoje musí zůstat vybrané společně.',
        'warning',
        4000
      );
      return;
    }

    // 1. Check if ADDING a new room (keep this restriction)
    if (!this.editSelectedRooms.has(roomId) && !this.originalRooms.includes(roomId)) {
      this.showNotification(
        '⚠️ V editaci nelze přidávat nové pokoje. Můžete měnit pouze termíny a počty hostů.',
        'warning',
        4000
      );
      requestAnimationFrame(() => this.renderPerRoomList());
      return;
    }

    // 2. Check if REMOVING an existing room (NEW: allow with confirmation)
    if (this.editSelectedRooms.has(roomId) && this.originalRooms.includes(roomId)) {
      // Last room check: removing would delete entire booking
      if (this.editSelectedRooms.size === 1) {
        this.handleLastRoomRemoval();
        return;
      }

      // Normal room removal: show confirmation dialog
      this.confirmRoomRemoval(roomId);
      return;
    }

    // 3. ADDING back a previously removed room (toggle on again)
    if (!this.editSelectedRooms.has(roomId) && this.originalRooms.includes(roomId)) {
      this.addRoomBack(roomId);
    }
  }

  /**
   * Confirm and handle room removal
   * Shows custom modal dialog with room name, price impact, and remaining rooms
   */
  async confirmRoomRemoval(roomId) {
    const room = this.settings.rooms.find((r) => r.id === roomId);
    const roomData = this.editSelectedRooms.get(roomId);
    const dates = this.perRoomDates.get(roomId);

    if (!room || !roomData || !dates) {
      console.error('Missing room data for removal:', roomId);
      return;
    }

    // Calculate price impact
    const nights = DateUtils.getDaysBetween(dates.startDate, dates.endDate);
    const roomPrice = PriceCalculator.calculatePrice({
      guestType: roomData.guestType,
      adults: roomData.adults,
      children: roomData.children,
      toddlers: roomData.toddlers || 0,
      nights,
      rooms: [roomId],
      roomsCount: 1,
      settings: this.settings,
    });

    const remainingRooms = this.editSelectedRooms.size - 1;

    // Show custom modal dialog
    const confirmed = await modalDialog.confirm({
      title: `Odebrat pokoj ${room.name}?`,
      icon: '🗑️',
      type: 'warning',
      message: `Opravdu chcete odebrat tento pokoj z rezervace?\n\nJména hostů přiřazená k tomuto pokoji budou odstraněna.`,
      details: [
        { label: 'Cena pokoje', value: `${roomPrice.toLocaleString('cs-CZ')} Kč` },
        {
          label: 'Hosté',
          value: `${roomData.adults} dospělých, ${roomData.children} dětí`,
        },
        { label: 'Zbývající pokoje', value: remainingRooms.toString() },
      ],
      confirmText: 'Odebrat pokoj',
      cancelText: 'Zrušit',
    });

    if (!confirmed) {
      // User cancelled - revert checkbox
      requestAnimationFrame(() => this.renderPerRoomList());
      return;
    }

    // Remove the room
    this.removeRoom(roomId);
  }

  /**
   * Handle removal of last room (deletes entire booking)
   * Shows special danger warning about booking deletion
   */
  async handleLastRoomRemoval() {
    // Show custom danger modal
    const confirmed = await modalDialog.confirm({
      title: 'VAROVÁNÍ: Smazání celé rezervace',
      icon: '⚠️',
      type: 'danger',
      message:
        'Odebíráte poslední pokoj z rezervace!\n\n' +
        'Tato akce SMAŽE celou rezervaci včetně všech údajů.\n\n' +
        'Opravdu chcete pokračovat?',
      confirmText: 'Ano, smazat rezervaci',
      cancelText: 'Zrušit',
    });

    if (!confirmed) {
      // User cancelled - revert checkbox
      requestAnimationFrame(() => this.renderPerRoomList());
      return;
    }

    // Delegate to onDelete callback (same as "Delete Booking" button)
    if (this.onDelete && typeof this.onDelete === 'function') {
      try {
        await this.onDelete(this.currentBooking.id);
        // Callback handles success notification + redirect
      } catch (error) {
        this.showNotification(`❌ Chyba při mazání rezervace: ${error.message}`, 'error', 5000);
      }
    }
  }

  /**
   * Remove room from booking (after confirmation)
   * Handles cleanup: state, guest names, proposed bookings, price
   * Saves state to undo stack for 30-second restore window
   */
  removeRoom(roomId) {
    // 0. Save room state to undo stack BEFORE removing
    const roomData = this.editSelectedRooms.get(roomId);
    const roomDates = this.perRoomDates.get(roomId);

    if (roomData && roomDates) {
      // Store complete room state
      const undoState = {
        roomId,
        roomData: { ...roomData }, // Deep copy
        roomDates: { ...roomDates }, // Deep copy
        timestamp: Date.now(),
      };

      this.undoStack.push(undoState);

      // Set auto-expire timeout (30 seconds)
      const timeoutId = setTimeout(() => {
        this.expireUndo(roomId);
      }, this.UNDO_TIME_LIMIT);

      this.undoTimeouts.set(roomId, timeoutId);

      // Create audit log for room removal
      this.logRoomChange('room_removed', roomId, {
        beforeState: { roomData, roomDates },
        afterState: null,
        changeDetails: `Room ${roomId} removed from booking`,
      });
    }

    // 1. Remove from selected rooms Map
    this.editSelectedRooms.delete(roomId);

    // 2. Remove from per-room dates Map
    this.perRoomDates.delete(roomId);

    // 3. Clean up proposed booking for this room (if any)
    // Fire-and-forget: non-blocking cleanup
    if (this.sessionId && typeof dataManager !== 'undefined') {
      dataManager.clearSessionProposedBookings(this.sessionId).catch((err) => {
        console.warn('Failed to clean proposed bookings:', err);
        // Non-critical error, continue
      });
    }

    // 4. Update global booking dates
    this.updateGlobalBookingDates();

    // 5. Recalculate total price
    this.updateTotalPrice();

    // 6. Re-render room list UI
    this.renderPerRoomList();

    // 7. Show success notification with UNDO button
    const room = this.settings.rooms.find((r) => r.id === roomId);
    const roomName = room ? room.name : `Pokoj ${roomId}`;

    this.showNotificationWithUndo(
      `✅ ${roomName} byl odebrán z rezervace`,
      roomId,
      'success',
      this.UNDO_TIME_LIMIT
    );
  }

  /**
   * Add previously removed room back to booking
   * Uses same defaults as when room was initially added
   */
  addRoomBack(roomId) {
    // Get room info
    const room = this.settings.rooms.find((r) => r.id === roomId);
    if (!room) {
      console.error('Room not found:', roomId);
      return;
    }

    // Add to selected rooms with default guest data
    this.editSelectedRooms.set(roomId, {
      guestType: 'utia', // Default to ÚTIA
      adults: 1, // Default to 1 adult
      children: 0,
      toddlers: 0,
    });

    // Copy dates from other rooms (or use booking defaults)
    let defaultDates = {
      startDate: this.editStartDate,
      endDate: this.editEndDate,
    };

    // If other rooms exist, copy their dates for consistency
    if (this.perRoomDates.size > 0) {
      const firstRoomDates = this.perRoomDates.values().next().value;
      defaultDates = firstRoomDates;
    }

    this.perRoomDates.set(roomId, defaultDates);

    // Update UI and price
    this.updateGlobalBookingDates();
    this.updateTotalPrice();
    this.renderPerRoomList();

    // Success notification
    this.showNotification(`✅ ${room.name} byl přidán zpět do rezervace`, 'success', 3000);
  }

  /**
   * Update guest type for a room
   */
  updateRoomGuestType(roomId, guestType) {
    const roomData = this.editSelectedRooms.get(roomId);
    if (roomData) {
      roomData.guestType = guestType;
      // Update price and re-render list to update guest list display
      this.updateTotalPrice();
      this.renderPerRoomList();
    }
  }

  /**
   * Update guest counts for a room with validation
   */
  updateRoomGuests(roomId, field, value) {
    const roomData = this.editSelectedRooms.get(roomId);
    if (!roomData) {
      return;
    }

    // Get room info
    const room = this.settings.rooms.find((r) => r.id === roomId);
    if (!room) {
      console.error('Room not found:', roomId);
      return;
    }

    // Store old value for rollback if validation fails
    const oldValue = roomData[field];

    // Ensure value is a valid number
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) {
      this.showNotification(
        'Počet hostů musí být kladné číslo',
        'warning',
        NOTIFICATION_TIMEOUT.INFO
      );
      // Revert input to old value
      this.revertInputValue(roomId, field, oldValue);
      return;
    }

    // Minimum constraint: at least 1 adult
    if (field === 'adults' && numValue < 1) {
      this.showNotification(
        'Musí být alespoň 1 dospělý v pokoji',
        'warning',
        NOTIFICATION_TIMEOUT.INFO
      );
      // Revert input to old value
      this.revertInputValue(roomId, field, oldValue);
      return;
    }

    // Capacity validation (toddlers don't count towards bed limit)
    if (field === 'adults' || field === 'children') {
      const projectedAdults = field === 'adults' ? numValue : roomData.adults;
      const projectedChildren = field === 'children' ? numValue : roomData.children;
      const totalGuests = projectedAdults + projectedChildren;

      if (totalGuests > room.beds) {
        // Determine correct bed count word form based on Czech grammar
        let bedWord = 'lůžek';
        if (room.beds === 1) {
          bedWord = 'lůžko';
        } else if (room.beds >= 2 && room.beds <= 4) {
          bedWord = 'lůžka';
        }

        this.showNotification(
          `⚠️ Kapacita pokoje ${room.name}: ${room.beds} ${bedWord}. ` +
            `Nelze zadat ${totalGuests} hostů (${projectedAdults} dospělých + ${projectedChildren} dětí).`,
          'error',
          4000
        );
        // Revert input to old value
        this.revertInputValue(roomId, field, oldValue);
        return;
      }
    }

    // All validations passed - update value
    roomData[field] = numValue;
    // Update price
    this.updateTotalPrice();
    // Update guest names fields for this room in real-time
    this.updateGuestNamesForRoom(roomId, roomData);
  }

  /**
   * Update guest names section for a specific room in real-time
   * @param {string} roomId - Room ID
   * @param {Object} roomData - Room data with guest counts
   */
  updateGuestNamesForRoom(roomId, roomData) {
    const container = document.getElementById(`guestNamesRoom${roomId}`);

    // If container doesn't exist, we need to find the room card and insert guest names
    if (!container) {
      // Find the room card by looking for inputs with onchange attribute containing the roomId
      const allInputs = document.querySelectorAll('input[type="number"]');
      let adultsInput = null;
      for (const input of allInputs) {
        const onchange = input.getAttribute('onchange');
        if (onchange && onchange.includes(`'${roomId}'`) && onchange.includes('adults')) {
          adultsInput = input;
          break;
        }
      }

      if (!adultsInput) {
        this.renderPerRoomList();
        setTimeout(() => {
          this.populateGuestNamesInRooms();
        }, 50);
        return;
      }

      const roomCard = adultsInput.closest('div[style*="border: 2px solid"]');

      if (!roomCard) {
        this.renderPerRoomList();
        setTimeout(() => {
          this.populateGuestNamesInRooms();
        }, 50);
        return;
      }

      // Generate and insert guest names HTML for the first time
      const newGuestNamesHTML = this.renderGuestListForRoom(roomId, roomData);

      if (newGuestNamesHTML) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newGuestNamesHTML;
        const newContainer = tempDiv.firstElementChild;

        // Find the guest configuration section (grid with spinbuttons)
        const guestConfigSection = roomCard.querySelector('div[style*="display: grid"]');

        if (guestConfigSection) {
          guestConfigSection.insertAdjacentElement('afterend', newContainer);

          // Populate existing names after inserting
          setTimeout(() => {
            this.populateGuestNamesInRooms();
          }, 10);
        }
      }
      return;
    }

    // Container exists - update it

    // ⚠️ CRITICAL: Find ALL DOM references BEFORE removing container!
    // Once removed, closest() and querySelector() may fail.

    // Find the parent room card (go up TWO levels from container)
    const parent = container.parentElement;
    if (!parent) {
      return;
    }

    // Room card is one more level up
    const roomCard = parent.parentElement;
    if (!roomCard) {
      return;
    }

    // Find the guest configuration section (grid with spinbuttons) BEFORE removing container
    // Strategy: Find the adults spinbutton and walk up to find the grid parent
    let guestConfigSection = null;

    const allInputs = roomCard.querySelectorAll('input[type="number"]');
    const adultsInput = Array.from(allInputs).find((inp) => {
      const onchange = inp.getAttribute('onchange');
      return onchange && onchange.includes(`'${roomId}'`) && onchange.includes('adults');
    });

    if (adultsInput) {
      // Walk up the DOM tree to find grid parent
      let current = adultsInput.parentElement;
      let depth = 0;
      while (current && depth < 5) {
        const style = current.getAttribute('style') || '';
        if (style.includes('display: grid') && style.includes('repeat(3')) {
          guestConfigSection = current;
          break;
        }
        current = current.parentElement;
        depth += 1;
      }
    }

    if (!guestConfigSection) {
      return;
    }

    // ⚠️ CRITICAL: Save current input values BEFORE removing container!
    const currentValues = {};
    const existingInputs = container.querySelectorAll('input[type="text"], input[type="checkbox"]');
    existingInputs.forEach((input) => {
      if (input.type === 'checkbox') {
        currentValues[input.id] = input.checked;
      } else {
        currentValues[input.id] = input.value;
      }
    });

    // Generate new guest names HTML
    const newGuestNamesHTML = this.renderGuestListForRoom(roomId, roomData);

    // NOW we can safely remove old guest names section
    container.remove();

    // Append new guest names section if there are guests
    if (newGuestNamesHTML) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newGuestNamesHTML;
      const newContainer = tempDiv.firstElementChild;

      // Insert after the guest config section we found earlier
      guestConfigSection.insertAdjacentElement('afterend', newContainer);

      // Restore saved input values to new inputs
      setTimeout(() => {
        Object.keys(currentValues).forEach((inputId) => {
          const input = document.getElementById(inputId);
          if (input) {
            if (input.type === 'checkbox') {
              input.checked = currentValues[inputId];
            } else {
              input.value = currentValues[inputId];
            }
          }
        });

        // Then populate any missing names from stored data
        this.populateGuestNamesInRooms();
      }, 10);
    }
  }

  /**
   * Populate existing guest names into room-specific input fields
   * Called after renderPerRoomList() to fill in existing names
   */
  populateGuestNamesInRooms() {
    if (
      !this.currentBooking ||
      !this.currentBooking.guestNames ||
      !Array.isArray(this.currentBooking.guestNames)
    ) {
      return;
    }

    const allGuestNames = this.currentBooking.guestNames;

    // Separate guests by type
    const adultNames = allGuestNames.filter((g) => g.personType === 'adult');
    const childNames = allGuestNames.filter((g) => g.personType === 'child');
    const toddlerNames = allGuestNames.filter((g) => g.personType === 'toddler');

    // Distribute guests across rooms
    let adultIndex = 0;
    let childIndex = 0;
    let toddlerIndex = 0;

    for (const [roomId, roomData] of this.editSelectedRooms.entries()) {
      // Populate adults for this room
      for (let i = 1; i <= roomData.adults; i += 1) {
        const guest = adultNames[adultIndex];
        adultIndex += 1;
        if (!guest) {
          continue; // eslint-disable-line no-continue
        }

        const firstNameInput = document.getElementById(`room${roomId}AdultFirstName${i}`);
        const lastNameInput = document.getElementById(`room${roomId}AdultLastName${i}`);
        const toggleInput = document.getElementById(`room${roomId}Adult${i}GuestTypeToggle`);
        const toggleText = document.getElementById(`room${roomId}Adult${i}ToggleText`);

        // Only populate if input is empty (preserve user edits)
        if (firstNameInput && !firstNameInput.value) {
          firstNameInput.value = guest.firstName || '';
        }
        if (lastNameInput && !lastNameInput.value) {
          lastNameInput.value = guest.lastName || '';
        }

        if (toggleInput && (guest.guestPriceType || guest.guestType)) {
          const type = guest.guestPriceType ?? guest.guestType;
          const isExternal = type === 'external';
          toggleInput.checked = isExternal;

          // Trigger visual update
          const label = toggleInput.closest('label');
          if (label) {
            const slider = label.querySelector('span[style*="background-color"]');
            const thumb = slider?.querySelector('span[style*="border-radius: 50%"]');
            this.updateToggleVisualState(slider, thumb, toggleText, isExternal);
          }
        }
      }

      // Populate children for this room
      for (let i = 1; i <= roomData.children; i += 1) {
        const guest = childNames[childIndex];
        childIndex += 1;
        if (!guest) {
          continue; // eslint-disable-line no-continue
        }

        const firstNameInput = document.getElementById(`room${roomId}ChildFirstName${i}`);
        const lastNameInput = document.getElementById(`room${roomId}ChildLastName${i}`);
        const toggleInput = document.getElementById(`room${roomId}Child${i}GuestTypeToggle`);
        const toggleText = document.getElementById(`room${roomId}Child${i}ToggleText`);

        // Only populate if input is empty (preserve user edits)
        if (firstNameInput && !firstNameInput.value) {
          firstNameInput.value = guest.firstName || '';
        }
        if (lastNameInput && !lastNameInput.value) {
          lastNameInput.value = guest.lastName || '';
        }

        if (toggleInput && (guest.guestPriceType || guest.guestType)) {
          const type = guest.guestPriceType ?? guest.guestType;
          const isExternal = type === 'external';
          toggleInput.checked = isExternal;

          // Trigger visual update
          const label = toggleInput.closest('label');
          if (label) {
            const slider = label.querySelector('span[style*="background-color"]');
            const thumb = slider?.querySelector('span[style*="border-radius: 50%"]');
            this.updateToggleVisualState(slider, thumb, toggleText, isExternal);
          }
        }
      }

      // Populate toddlers for this room
      for (let i = 1; i <= roomData.toddlers; i += 1) {
        const guest = toddlerNames[toddlerIndex];
        toddlerIndex += 1;
        if (!guest) {
          continue; // eslint-disable-line no-continue
        }

        const firstNameInput = document.getElementById(`room${roomId}ToddlerFirstName${i}`);
        const lastNameInput = document.getElementById(`room${roomId}ToddlerLastName${i}`);

        // Only populate if input is empty (preserve user edits)
        if (firstNameInput && !firstNameInput.value) {
          firstNameInput.value = guest.firstName || '';
        }
        if (lastNameInput && !lastNameInput.value) {
          lastNameInput.value = guest.lastName || '';
        }
      }
    }

    // Also populate bulk guest name inputs (for bulk bookings)
    this.populateBulkGuestNames(adultNames, childNames, toddlerNames);

    // FIX 2025-12-03: Recalculate price after populating guest names with their toggle states
    // This ensures the price reflects the correct ÚTIA/External split on modal open
    // Use setTimeout to ensure DOM toggles are fully rendered before reading their states
    setTimeout(() => {
      this.updateTotalPrice();
    }, 100);
  }

  /**
   * Populate existing guest names into bulk booking input fields
   * @param {Array} adultNames - Array of adult guest names
   * @param {Array} childNames - Array of child guest names
   * @param {Array} toddlerNames - Array of toddler guest names
   */
  populateBulkGuestNames(adultNames, childNames, toddlerNames) {
    // Populate bulk adults
    for (let i = 1; i <= adultNames.length; i += 1) {
      const guest = adultNames[i - 1];
      if (!guest) {
        continue; // eslint-disable-line no-continue
      }

      const firstNameInput = document.getElementById(`bulkAdultFirstName${i}`);
      const lastNameInput = document.getElementById(`bulkAdultLastName${i}`);
      const toggleInput = document.getElementById(`bulkAdult${i}GuestTypeToggle`);
      const toggleText = document.getElementById(`bulkAdult${i}ToggleText`);

      if (firstNameInput && !firstNameInput.value) {
        firstNameInput.value = guest.firstName || '';
      }
      if (lastNameInput && !lastNameInput.value) {
        lastNameInput.value = guest.lastName || '';
      }

      if (toggleInput && (guest.guestPriceType || guest.guestType)) {
        const type = guest.guestPriceType ?? guest.guestType;
        const isExternal = type === 'external';
        toggleInput.checked = isExternal;

        const label = toggleInput.closest('label');
        if (label) {
          const slider = label.querySelector('span[style*="background-color"]');
          const thumb = slider?.querySelector('span[style*="border-radius: 50%"]');
          this.updateToggleVisualState(slider, thumb, toggleText, isExternal);
        }
      }
    }

    // Populate bulk children
    for (let i = 1; i <= childNames.length; i += 1) {
      const guest = childNames[i - 1];
      if (!guest) {
        continue; // eslint-disable-line no-continue
      }

      const firstNameInput = document.getElementById(`bulkChildFirstName${i}`);
      const lastNameInput = document.getElementById(`bulkChildLastName${i}`);
      const toggleInput = document.getElementById(`bulkChild${i}GuestTypeToggle`);
      const toggleText = document.getElementById(`bulkChild${i}ToggleText`);

      if (firstNameInput && !firstNameInput.value) {
        firstNameInput.value = guest.firstName || '';
      }
      if (lastNameInput && !lastNameInput.value) {
        lastNameInput.value = guest.lastName || '';
      }

      if (toggleInput && (guest.guestPriceType || guest.guestType)) {
        const type = guest.guestPriceType ?? guest.guestType;
        const isExternal = type === 'external';
        toggleInput.checked = isExternal;

        const label = toggleInput.closest('label');
        if (label) {
          const slider = label.querySelector('span[style*="background-color"]');
          const thumb = slider?.querySelector('span[style*="border-radius: 50%"]');
          this.updateToggleVisualState(slider, thumb, toggleText, isExternal);
        }
      }
    }

    // Populate bulk toddlers
    for (let i = 1; i <= toddlerNames.length; i += 1) {
      const guest = toddlerNames[i - 1];
      if (!guest) {
        continue; // eslint-disable-line no-continue
      }

      const firstNameInput = document.getElementById(`bulkToddlerFirstName${i}`);
      const lastNameInput = document.getElementById(`bulkToddlerLastName${i}`);

      if (firstNameInput && !firstNameInput.value) {
        firstNameInput.value = guest.firstName || '';
      }
      if (lastNameInput && !lastNameInput.value) {
        lastNameInput.value = guest.lastName || '';
      }
    }
  }

  /**
   * Toggle guest type between ÚTIA and External for individual guest
   * @param {string} roomId - Room ID
   * @param {string} guestType - 'adult' or 'child'
   * @param {number} index - Guest index (1-based)
   * @param {boolean} isExternal - true for External, false for ÚTIA
   */
  toggleGuestType(roomId, guestType, index, isExternal) {
    const toggleId = `room${roomId}${guestType.charAt(0).toUpperCase() + guestType.slice(1)}${index}GuestTypeToggle`;
    const toggleTextId = `room${roomId}${guestType.charAt(0).toUpperCase() + guestType.slice(1)}${index}ToggleText`;

    const toggle = document.getElementById(toggleId);
    const toggleText = document.getElementById(toggleTextId);

    if (!toggle || !toggleText) {
      return;
    }

    // Find the toggle slider (parent label -> span child)
    const label = toggle.closest('label');
    if (!label) {
      return;
    }
    const slider = label.querySelector('span[style*="background-color"]');
    const thumb = slider?.querySelector('span[style*="border-radius: 50%"]');

    // Update visual state
    this.updateToggleVisualState(slider, thumb, toggleText, isExternal);

    // ⚠️ CRITICAL: Update room-level guest type based on per-guest toggles
    // Rule: If at least 1 guest is ÚTIA → room is ÚTIA, otherwise External
    this.updateRoomGuestTypeFromToggles(roomId);

    // Recalculate price with updated room guest type
    this.updateTotalPrice();
  }

  /**
   * Update room-level guest type based on per-guest toggles
   * Rule: If at least 1 guest is ÚTIA (toggle unchecked) → room is 'utia', otherwise 'external'
   * @param {string} roomId - Room ID
   */
  updateRoomGuestTypeFromToggles(roomId) {
    const roomData = this.editSelectedRooms.get(roomId);
    if (!roomData) {
      return;
    }

    let hasUtiaGuest = false;

    // Check adult toggles
    const totalAdults = roomData.adults || 0;
    for (let i = 1; i <= totalAdults; i++) {
      const toggleId = `room${roomId}Adult${i}GuestTypeToggle`;
      const toggle = document.getElementById(toggleId);
      if (toggle && !toggle.checked) {
        // Unchecked = ÚTIA
        hasUtiaGuest = true;
        break;
      }
    }

    // Check children toggles if no ÚTIA adult found
    if (!hasUtiaGuest) {
      const totalChildren = roomData.children || 0;
      for (let i = 1; i <= totalChildren; i++) {
        const toggleId = `room${roomId}Child${i}GuestTypeToggle`;
        const toggle = document.getElementById(toggleId);
        if (toggle && !toggle.checked) {
          // Unchecked = ÚTIA
          hasUtiaGuest = true;
          break;
        }
      }
    }

    // Check toddler toggles if no ÚTIA guest found yet
    if (!hasUtiaGuest) {
      const totalToddlers = roomData.toddlers || 0;
      for (let i = 1; i <= totalToddlers; i++) {
        const toggleId = `room${roomId}Toddler${i}GuestTypeToggle`;
        const toggle = document.getElementById(toggleId);
        if (toggle && !toggle.checked) {
          // Unchecked = ÚTIA
          hasUtiaGuest = true;
          break;
        }
      }
    }

    // Update room-level guest type
    const newGuestType = hasUtiaGuest ? 'utia' : 'external';
    if (roomData.guestType !== newGuestType) {
      roomData.guestType = newGuestType;
      this.editSelectedRooms.set(roomId, roomData);
    }
  }

  /**
   * Revert input field to old value
   * Note: Parameters reserved for future targeted input reversion
   * @param {string} _roomId - Room ID (currently unused, for future enhancement)
   * @param {string} _field - Field name (currently unused, for future enhancement)
   * @param {*} _oldValue - Old value (currently unused, for future enhancement)
   */
  // eslint-disable-next-line no-unused-vars
  revertInputValue(_roomId, _field, _oldValue) {
    // Find the input field and reset it to old value
    const container = document.getElementById('editRoomsList');
    if (!container) {
      return;
    }

    // Re-render list using requestAnimationFrame for smoother UX
    requestAnimationFrame(() => {
      this.renderPerRoomList();
    });
  }

  /**
   * Calculate and update total price based on CHECKED rooms only
   * Uses bulk pricing for bulk bookings (all 9 rooms)
   */
  updateTotalPrice() {
    const priceContainer = document.getElementById('editTotalPrice');
    if (!priceContainer) {
      return;
    }

    if (this.editSelectedRooms.size === 0) {
      priceContainer.textContent = '0 Kč';
      return;
    }

    let totalPrice = 0;
    let perRoomPriceHtml = '';

    // Use bulk pricing for bulk bookings
    if (this.isBulkBooking) {
      // FIX 2025-12-03: Count ÚTIA vs External guests separately from toggle states
      // This enables mixed guest type pricing in bulk bookings
      let totalAdults = 0;
      let totalChildren = 0;
      let utiaAdults = 0;
      let externalAdults = 0;
      let utiaChildren = 0;
      let externalChildren = 0;

      for (const roomData of this.editSelectedRooms.values()) {
        totalAdults += roomData.adults || 0;
        totalChildren += roomData.children || 0;
      }

      // Count adults from bulk toggle states
      for (let i = 1; i <= totalAdults; i += 1) {
        const toggleId = `bulkAdult${i}GuestTypeToggle`;
        const toggle = document.getElementById(toggleId);
        if (toggle && toggle.checked) {
          externalAdults += 1;
        } else {
          utiaAdults += 1;
        }
      }

      // Count children from bulk toggle states
      for (let i = 1; i <= totalChildren; i += 1) {
        const toggleId = `bulkChild${i}GuestTypeToggle`;
        const toggle = document.getElementById(toggleId);
        if (toggle && toggle.checked) {
          externalChildren += 1;
        } else {
          utiaChildren += 1;
        }
      }

      // Calculate nights from global booking dates
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

      // FIX: Fallback to original booking dates if perRoomDates is empty
      if (!minStart && this.originalStartDate) {
        minStart = this.originalStartDate;
      }
      if (!maxEnd && this.originalEndDate) {
        maxEnd = this.originalEndDate;
      }

      const nights = minStart && maxEnd ? DateUtils.getDaysBetween(minStart, maxEnd) : 0;

      // FIX 2025-12-03: Calculate bulk price with per-guest breakdown
      // Formula: basePrice + (utiaAdults × utiaAdult) + (externalAdults × externalAdult) +
      //          (utiaChildren × utiaChild) + (externalChildren × externalChild) × nights
      const { bulkPrices } = this.settings;
      if (bulkPrices) {
        totalPrice =
          bulkPrices.basePrice * nights +
          utiaAdults * bulkPrices.utiaAdult * nights +
          externalAdults * bulkPrices.externalAdult * nights +
          utiaChildren * bulkPrices.utiaChild * nights +
          externalChildren * bulkPrices.externalChild * nights;
      } else {
        // Fallback to old method if bulkPrices not configured
        totalPrice = PriceCalculator.calculateBulkPrice({
          guestType: utiaAdults > 0 ? 'utia' : 'external',
          adults: totalAdults,
          children: totalChildren,
          nights,
          settings: this.settings,
        });
      }
    } else {
      // Regular pricing: sum individual room prices AND generate per-room breakdown
      const perRoomGuests = [];

      for (const [roomId, roomData] of this.editSelectedRooms) {
        let dates = this.perRoomDates.get(roomId);

        // FIX: Fallback to original booking dates if per-room dates are missing
        if (!dates && this.originalStartDate && this.originalEndDate) {
          dates = {
            startDate: this.originalStartDate,
            endDate: this.originalEndDate,
          };
        }

        // Skip if room still doesn't have dates (shouldn't happen with fallback)
        if (!dates) {
          // eslint-disable-next-line no-continue
          continue;
        }

        const nights = DateUtils.getDaysBetween(dates.startDate, dates.endDate);

        // FIX 2025-12-03: Count ÚTIA vs External guests BEFORE price calculation
        // This enables mixed guest type pricing (some ÚTIA, some external in same room)
        let utiaAdults = 0;
        let externalAdults = 0;
        let utiaChildren = 0;
        let externalChildren = 0;

        // Count adults from toggle states
        const totalAdults = roomData.adults || 0;
        for (let i = 1; i <= totalAdults; i += 1) {
          const toggleId = `room${roomId}Adult${i}GuestTypeToggle`;
          const toggle = document.getElementById(toggleId);
          if (toggle && toggle.checked) {
            externalAdults += 1;
          } else {
            utiaAdults += 1;
          }
        }

        // Count children from toggle states
        const totalChildren = roomData.children || 0;
        for (let i = 1; i <= totalChildren; i += 1) {
          const toggleId = `room${roomId}Child${i}GuestTypeToggle`;
          const toggle = document.getElementById(toggleId);
          if (toggle && toggle.checked) {
            externalChildren += 1;
          } else {
            utiaChildren += 1;
          }
        }

        // Calculate price using per-guest breakdown - handles mixed ÚTIA/external guests
        const room = this.settings.rooms?.find((r) => r.id === roomId);
        const roomType = room?.type || 'small';
        const defaultPrices = PriceCalculator.getDefaultPrices();

        // FIX 2025-12-03: Log when falling back to default prices (data integrity check)
        let utiaRates = this.settings.prices?.utia?.[roomType];
        let externalRates = this.settings.prices?.external?.[roomType];
        if (!utiaRates || !externalRates) {
          console.error('[EditBookingComponent] Missing price configuration, using defaults:', {
            roomType,
            hasUtia: !!utiaRates,
            hasExternal: !!externalRates,
          });
          utiaRates = utiaRates || defaultPrices.utia[roomType];
          externalRates = externalRates || defaultPrices.external[roomType];
        }

        // Empty room price: Use ÚTIA rate if at least one ÚTIA guest in this room
        const hasUtiaGuest = utiaAdults > 0 || utiaChildren > 0;
        const emptyRoomRate = hasUtiaGuest ? utiaRates.empty : externalRates.empty;

        // Calculate room price with mixed guest types
        const price =
          emptyRoomRate * nights +
          utiaAdults * utiaRates.adult * nights +
          externalAdults * externalRates.adult * nights +
          utiaChildren * utiaRates.child * nights +
          externalChildren * externalRates.child * nights;

        totalPrice += price;

        // Determine effective room guestType based on majority (for roomData consistency)
        const effectiveGuestType = hasUtiaGuest ? 'utia' : 'external';

        // Add to per-room data with ÚTIA/External breakdown
        perRoomGuests.push({
          roomId,
          adults: roomData.adults || 0,
          children: roomData.children || 0,
          toddlers: roomData.toddlers || 0,
          guestType: effectiveGuestType, // FIX 2025-12-03: Use effective guestType based on actual guests
          utiaAdults,
          externalAdults,
          utiaChildren,
          externalChildren,
        });
      }

      // Generate per-room price breakdown (for both single and multi-room bookings)
      if (perRoomGuests.length >= 1 && typeof PriceCalculator !== 'undefined') {
        try {
          // Get the first room's dates to calculate common nights
          const firstDates = Array.from(this.perRoomDates.values())[0];
          const nights = firstDates
            ? DateUtils.getDaysBetween(firstDates.startDate, firstDates.endDate)
            : 0;

          // Determine guest type: ÚTIA if at least one room has ÚTIA guest, otherwise external
          // This determines the empty room price (according to pricing rules)
          const hasUtiaGuest = Array.from(this.editSelectedRooms.values()).some(
            (room) => room.guestType === 'utia'
          );
          const guestType = hasUtiaGuest ? 'utia' : 'external';

          const perRoomPrices = PriceCalculator.calculatePerRoomPrices({
            guestType,
            nights,
            settings: this.settings,
            perRoomGuests,
          });

          perRoomPriceHtml = PriceCalculator.formatPerRoomPricesHTML(perRoomPrices, 'cs');
        } catch (error) {
          console.error('[EditBookingComponent] Failed to generate price breakdown:', {
            error: error.message,
            bookingId: this.currentBooking?.id,
          });
          perRoomPriceHtml = `<div style="color: #dc2626; padding: 0.5rem; font-size: 0.85rem;">
            ⚠️ Chyba při generování rozpisu cen
          </div>`;
        }
      }
    }

    // Add per-room breakdown if available (insert after the total price container)
    const priceSection = priceContainer.closest('div[style*="background: #fef3c7"]');
    if (priceSection) {
      // Remove any existing per-room breakdown
      const existingBreakdown = priceSection.querySelector('.per-room-prices');
      if (existingBreakdown) {
        existingBreakdown.remove();
      }

      // Add new breakdown if available
      if (perRoomPriceHtml) {
        // Hide the "Total Price" label and value when breakdown is shown
        const totalPriceLabel = priceSection.querySelector('strong');
        if (totalPriceLabel) {
          totalPriceLabel.style.display = 'none';
        }
        priceContainer.style.display = 'none';

        // Add breakdown
        const breakdownContainer = document.createElement('div');
        breakdownContainer.innerHTML = perRoomPriceHtml;
        priceSection.appendChild(breakdownContainer.firstElementChild);
      } else {
        // Show total price if no breakdown available
        const totalPriceLabel = priceSection.querySelector('strong');
        if (totalPriceLabel) {
          totalPriceLabel.style.display = '';
        }
        priceContainer.style.display = '';
        priceContainer.innerHTML = `${totalPrice.toLocaleString('cs-CZ')} Kč`;
      }
    }
  }

  // Note: loadExistingBookingsForEdit(), checkBlockedDates(), and renderConflicts()
  // have been removed as they are no longer needed in the new UI.
  // Conflict checking is now done during saveRoomDates() on a per-room basis.

  /**
   * Validate all form data before submission
   */
  validateForm() {
    // Validate required fields
    const name = document.getElementById('editName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const address = document.getElementById('editAddress').value.trim();
    const city = document.getElementById('editCity').value.trim();
    const zip = document.getElementById('editZip').value.trim();

    if (!name || !email || !phone || !address || !city || !zip) {
      throw new Error('Vyplňte prosím všechny povinné údaje');
    }

    // Validate email
    if (!ValidationUtils.validateEmail(email)) {
      throw new Error(ValidationUtils.getValidationError('email', email, 'cs'));
    }

    // Validate ZIP
    if (!ValidationUtils.validateZIP(zip)) {
      throw new Error(ValidationUtils.getValidationError('zip', zip, 'cs'));
    }

    // Validate dates - check multiple sources for valid dates
    const hasPerRoomDates = this.perRoomDates.size > 0;
    const hasEditDates = this.editStartDate && this.editEndDate;
    const hasOriginalDates = this.originalStartDate && this.originalEndDate;

    // FIX: Accept dates from any valid source (perRoomDates, editDates, or originalDates)
    if (!hasPerRoomDates && !hasEditDates && !hasOriginalDates) {
      throw new Error('Vyberte prosím termín rezervace');
    }

    // Validate rooms
    if (this.editSelectedRooms.size === 0) {
      throw new Error('Vyberte prosím alespoň jeden pokoj');
    }

    // Validate bed capacity for all selected rooms
    for (const [selectedRoomId, roomData] of this.editSelectedRooms) {
      const room = this.settings.rooms.find((r) => r.id === selectedRoomId);
      if (!room) {
        throw new Error(langManager.t('roomNotFoundError2').replace('{roomId}', selectedRoomId));
      }

      const totalGuests = roomData.adults + roomData.children;
      if (totalGuests > room.beds) {
        throw new Error(
          langManager
            .t('roomCapacityExceeded2')
            .replace('{roomName}', room.name)
            .replace('{beds}', room.beds)
            .replace('{totalGuests}', totalGuests)
            .replace('{adults}', roomData.adults)
            .replace('{children}', roomData.children)
        );
      }
    }

    // Validate guest names
    let totalAdults = 0;
    let totalChildren = 0;
    let totalToddlers = 0;
    for (const roomData of this.editSelectedRooms.values()) {
      totalAdults += roomData.adults || 0;
      totalChildren += roomData.children || 0;
      totalToddlers += roomData.toddlers || 0;
    }

    if (totalAdults + totalChildren + totalToddlers > 0) {
      const validation = this.validateGuestNames(totalAdults, totalChildren, totalToddlers);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    return true;
  }

  /**
   * Get form data for submission
   */
  getFormData() {
    // Calculate min/max dates from per-room dates
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

    // Collect billing data
    const formData = {
      id: this.currentBooking.id,
      name: document.getElementById('editName').value.trim(),
      email: document.getElementById('editEmail').value.trim(),
      phone: document.getElementById('editPhone').value.trim(),
      company: document.getElementById('editCompany').value.trim(),
      address: document.getElementById('editAddress').value.trim(),
      city: document.getElementById('editCity').value.trim(),
      zip: document.getElementById('editZip').value.trim(),
      ico: document.getElementById('editIco').value.trim(),
      dic: document.getElementById('editDic').value.trim(),
      notes: document.getElementById('editNotes').value.trim(),
      payFromBenefit: document.getElementById('editPayFromBenefit').checked,
      // ✅ FIX: Add originalDates as final fallback for robustness
      startDate: minStart || this.editStartDate || this.originalStartDate,
      endDate: maxEnd || this.editEndDate || this.originalEndDate,
      rooms: Array.from(this.perRoomDates.keys()),
      perRoomDates: Object.fromEntries(this.perRoomDates), // Include per-room dates
      perRoomGuests: Object.fromEntries(this.editSelectedRooms), // Include per-room guest data
      isBulkBooking: this.isBulkBooking, // Include bulk booking flag
    };

    // Aggregate guest data from per-room configuration
    let totalAdults = 0;
    let totalChildren = 0;
    let totalToddlers = 0;
    const guestTypes = new Set();

    for (const roomData of this.editSelectedRooms.values()) {
      totalAdults += roomData.adults || 0;
      totalChildren += roomData.children || 0;
      totalToddlers += roomData.toddlers || 0;
      guestTypes.add(roomData.guestType);
    }

    formData.adults = totalAdults;
    formData.children = totalChildren;
    formData.toddlers = totalToddlers;

    // Determine guest type based on room configurations
    let finalGuestType = 'external';
    if (guestTypes.size === 1) {
      finalGuestType = Array.from(guestTypes)[0];
    } else if (guestTypes.has('utia')) {
      finalGuestType = 'utia';
    }
    formData.guestType = finalGuestType;

    // Calculate total price based on booking type
    let totalPrice = 0;
    if (this.isBulkBooking) {
      // FIX 2025-12-03: Count ÚTIA vs External guests separately from toggle states
      // This enables mixed guest type pricing in bulk bookings
      let utiaAdults = 0;
      let externalAdults = 0;
      let utiaChildren = 0;
      let externalChildren = 0;

      // Count adults from bulk toggle states
      for (let i = 1; i <= totalAdults; i += 1) {
        const toggleId = `bulkAdult${i}GuestTypeToggle`;
        const toggle = document.getElementById(toggleId);
        if (toggle && toggle.checked) {
          externalAdults += 1;
        } else {
          utiaAdults += 1;
        }
      }

      // Count children from bulk toggle states
      for (let i = 1; i <= totalChildren; i += 1) {
        const toggleId = `bulkChild${i}GuestTypeToggle`;
        const toggle = document.getElementById(toggleId);
        if (toggle && toggle.checked) {
          externalChildren += 1;
        } else {
          utiaChildren += 1;
        }
      }

      const nights = DateUtils.getDaysBetween(minStart, maxEnd);

      // Calculate bulk price with per-guest breakdown
      const { bulkPrices } = this.settings;
      if (bulkPrices) {
        totalPrice =
          bulkPrices.basePrice * nights +
          utiaAdults * bulkPrices.utiaAdult * nights +
          externalAdults * bulkPrices.externalAdult * nights +
          utiaChildren * bulkPrices.utiaChild * nights +
          externalChildren * bulkPrices.externalChild * nights;
      } else {
        // Fallback to old method if bulkPrices not configured
        totalPrice = PriceCalculator.calculateBulkPrice({
          guestType: utiaAdults > 0 ? 'utia' : 'external',
          adults: totalAdults,
          children: totalChildren,
          nights,
          settings: this.settings,
        });
      }
    } else {
      // FIX 2025-12-03: Regular pricing with per-guest breakdown for mixed ÚTIA/external
      for (const [roomId, dates] of this.perRoomDates) {
        const roomData = this.editSelectedRooms.get(roomId) || {
          guestType: 'external',
          adults: 1,
          children: 0,
        };

        const nights = DateUtils.getDaysBetween(dates.startDate, dates.endDate);

        // Count ÚTIA vs External guests from toggle states
        let utiaAdults = 0;
        let externalAdults = 0;
        let utiaChildren = 0;
        let externalChildren = 0;

        const roomAdults = roomData.adults || 0;
        for (let i = 1; i <= roomAdults; i += 1) {
          const toggleId = `room${roomId}Adult${i}GuestTypeToggle`;
          const toggle = document.getElementById(toggleId);
          if (toggle && toggle.checked) {
            externalAdults += 1;
          } else {
            utiaAdults += 1;
          }
        }

        const roomChildren = roomData.children || 0;
        for (let i = 1; i <= roomChildren; i += 1) {
          const toggleId = `room${roomId}Child${i}GuestTypeToggle`;
          const toggle = document.getElementById(toggleId);
          if (toggle && toggle.checked) {
            externalChildren += 1;
          } else {
            utiaChildren += 1;
          }
        }

        // Calculate price using per-guest breakdown - handles mixed ÚTIA/external guests
        const room = this.settings.rooms?.find((r) => r.id === roomId);
        const roomType = room?.type || 'small';
        const defaultPrices = PriceCalculator.getDefaultPrices();
        const utiaRates = this.settings.prices?.utia?.[roomType] || defaultPrices.utia[roomType];
        const externalRates = this.settings.prices?.external?.[roomType] || defaultPrices.external[roomType];

        // Empty room price: Use ÚTIA rate if at least one ÚTIA guest
        const hasUtiaGuest = utiaAdults > 0 || utiaChildren > 0;
        const emptyRoomRate = hasUtiaGuest ? utiaRates.empty : externalRates.empty;

        totalPrice +=
          emptyRoomRate * nights +
          utiaAdults * utiaRates.adult * nights +
          externalAdults * externalRates.adult * nights +
          utiaChildren * utiaRates.child * nights +
          externalChildren * externalRates.child * nights;
      }
    }
    formData.totalPrice = totalPrice;

    // Include guest names
    formData.guestNames = this.collectGuestNames();

    return formData;
  }

  /**
   * Switch between tabs (Dates/Billing)
   */
  switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.edit-tab-btn').forEach((button) => {
      const btn = button;
      if (btn.dataset.tab === tab) {
        btn.classList.add('active');
        btn.style.borderBottom = '3px solid #0d9488';
        btn.style.color = '#0d9488';
      } else {
        btn.classList.remove('active');
        btn.style.borderBottom = '3px solid transparent';
        btn.style.color = '#6b7280';
      }
    });

    // Show/hide tab content
    if (tab === 'dates') {
      document.getElementById('editDatesTab').style.display = 'block';
      document.getElementById('editBillingTab').style.display = 'none';
    } else {
      document.getElementById('editDatesTab').style.display = 'none';
      document.getElementById('editBillingTab').style.display = 'block';
    }
  }

  /**
   * Show notification toast
   */
  showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.setProperty('--duration', `${duration / 1000}s`);

    const iconMap = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    // Safe DOM construction
    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    icon.textContent = iconMap[type] || iconMap.info;

    const content = document.createElement('span');
    content.className = 'notification-content';
    content.textContent = message;

    const closeBtn = document.createElement('span');
    closeBtn.className = 'notification-close';
    closeBtn.textContent = '×';

    notification.appendChild(icon);
    notification.appendChild(content);
    notification.appendChild(closeBtn);

    const container =
      document.getElementById('notificationContainer') ||
      (() => {
        const c = document.createElement('div');
        c.id = 'notificationContainer';
        document.body.appendChild(c);
        return c;
      })();

    container.appendChild(notification);

    const handleClose = () => {
      notification.classList.add('removing');
      setTimeout(() => notification.remove(), 300);
    };

    closeBtn.addEventListener('click', handleClose);
    notification.addEventListener('click', handleClose);

    requestAnimationFrame(() => notification.classList.add('show'));

    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.add('removing');
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  /**
   * Show notification with UNDO button for room removal
   * Provides 30-second window to restore removed room
   */
  showNotificationWithUndo(message, roomId, type = 'success', duration = 30000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.setProperty('--duration', `${duration / 1000}s`);
    notification.dataset.roomId = roomId;

    const iconMap = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    // Safe DOM construction
    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    icon.textContent = iconMap[type] || iconMap.info;

    const content = document.createElement('span');
    content.className = 'notification-content';
    content.textContent = message;

    const undoBtn = document.createElement('button');
    undoBtn.className = 'notification-undo-btn';
    undoBtn.textContent = 'Vrátit zpět';
    Object.assign(undoBtn.style, {
      marginLeft: '12px',
      padding: '4px 12px',
      background: 'white',
      color: '#28a745',
      border: '1px solid white',
      borderRadius: '4px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '13px',
    });

    const closeBtn = document.createElement('span');
    closeBtn.className = 'notification-close';
    closeBtn.textContent = '×';

    notification.appendChild(icon);
    notification.appendChild(content);
    notification.appendChild(undoBtn);
    notification.appendChild(closeBtn);

    const container =
      document.getElementById('notificationContainer') ||
      (() => {
        const c = document.createElement('div');
        c.id = 'notificationContainer';
        document.body.appendChild(c);
        return c;
      })();

    container.appendChild(notification);

    // Undo button click handler
    undoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.undoRoomRemoval(roomId);
      notification.classList.add('removing');
      setTimeout(() => notification.remove(), 300);
    });

    // Close button click handler
    const handleClose = () => {
      notification.classList.add('removing');
      setTimeout(() => notification.remove(), 300);
    };

    closeBtn.addEventListener('click', handleClose);

    requestAnimationFrame(() => notification.classList.add('show'));

    // Auto-remove after duration
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.add('removing');
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  /**
   * Undo room removal - restore room from undo stack
   */
  undoRoomRemoval(roomId) {
    // Find undo state for this room
    const undoStateIndex = this.undoStack.findIndex((state) => state.roomId === roomId);

    if (undoStateIndex === -1) {
      this.showNotification('⚠️ Nelze vrátit zpět - časový limit vypršel', 'warning', 3000);
      return;
    }

    const undoState = this.undoStack[undoStateIndex];

    // Clear timeout for this room
    const timeoutId = this.undoTimeouts.get(roomId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.undoTimeouts.delete(roomId);
    }

    // Restore room state
    this.editSelectedRooms.set(roomId, undoState.roomData);
    this.perRoomDates.set(roomId, undoState.roomDates);

    // Remove from undo stack
    this.undoStack.splice(undoStateIndex, 1);

    // Create audit log for room restoration
    this.logRoomChange('room_restored', roomId, {
      beforeState: null,
      afterState: { roomData: undoState.roomData, roomDates: undoState.roomDates },
      changeDetails: `Room ${roomId} restored via undo`,
    });

    // Update UI and price
    this.updateGlobalBookingDates();
    this.updateTotalPrice();
    this.renderPerRoomList();

    // Success notification
    const room = this.settings.rooms.find((r) => r.id === roomId);
    const roomName = room ? room.name : `Pokoj ${roomId}`;
    this.showNotification(`✅ ${roomName} byl vrácen zpět do rezervace`, 'success', 3000);
  }

  /**
   * Expire undo state after timeout
   * Removes undo option after 30 seconds
   */
  expireUndo(roomId) {
    // Remove from undo stack
    const undoStateIndex = this.undoStack.findIndex((state) => state.roomId === roomId);
    if (undoStateIndex !== -1) {
      this.undoStack.splice(undoStateIndex, 1);
    }

    // Remove timeout reference
    this.undoTimeouts.delete(roomId);

    // Note: Don't show notification - silent expiry is better UX
  }

  /**
   * Clear undo stack when booking is saved
   * Call this after successful save to prevent undoing saved changes
   */
  clearUndoStack() {
    // Clear all timeouts
    for (const timeoutId of this.undoTimeouts.values()) {
      clearTimeout(timeoutId);
    }

    // Clear maps and arrays
    this.undoStack = [];
    this.undoTimeouts.clear();
  }

  /**
   * Render room list with per-room date editing and guest configuration
   * For bulk bookings, shows summary view instead of individual rooms
   * ⚠️ EDIT MODE: Only shows rooms from original booking (cannot add/remove)
   */
  renderPerRoomList() {
    const roomsList = document.getElementById('editRoomsList');
    if (!roomsList) {
      return;
    }

    roomsList.textContent = '';

    // ✅ FIX: Initialize per-room dates BEFORE bulk booking check
    // This ensures perRoomDates is populated for ALL booking types, including bulk
    if (this.perRoomDates.size === 0 && this.currentBooking) {
      console.warn(
        '[EditBookingComponent] perRoomDates empty in renderPerRoomList, initializing from currentBooking'
      );
      (this.currentBooking.rooms || []).forEach((roomId) => {
        this.perRoomDates.set(roomId, {
          startDate: this.currentBooking.startDate,
          endDate: this.currentBooking.endDate,
        });
      });
    }

    // Show bulk booking badge if applicable
    if (this.isBulkBooking) {
      const bulkBadge = document.createElement('div');
      bulkBadge.style.cssText = `
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 8px;
        background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
        color: white;
        font-weight: 600;
        text-align: center;
        box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3);
      `;
      bulkBadge.innerHTML = `
        <div style="font-size: 1.25rem; margin-bottom: 0.5rem;">
          🏠 HROMADNÁ REZERVACE CELÉ CHATY
        </div>
        <div style="font-size: 0.875rem; opacity: 0.95;">
          Všech 9 pokojů je rezervováno společně.
        </div>
      `;
      roomsList.appendChild(bulkBadge);

      // Show summary card for bulk booking instead of individual rooms
      this.renderBulkSummaryCard();
      return;
    }

    // NOTE: perRoomDates initialization moved to the beginning of this method
    // to ensure it runs for ALL booking types (including bulk bookings)

    const onChangePrefix = this.mode === 'admin' ? 'adminPanel' : 'editPage';

    // ⚠️ EDIT MODE RESTRICTION: Only show rooms from original booking
    // Filter rooms to show ONLY those in the original booking
    const roomsToShow = this.settings.rooms.filter((r) => this.originalRooms.includes(r.id));

    // Show informational banner about edit restrictions
    if (roomsToShow.length < this.settings.rooms.length) {
      const infoBanner = document.createElement('div');
      infoBanner.style.cssText = `
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
        padding: 1rem 1.25rem;
        background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        border-left: 4px solid #0369a1;
      `;

      const iconContainer = document.createElement('div');
      iconContainer.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        font-size: 20px;
        flex-shrink: 0;
      `;
      iconContainer.textContent = 'ℹ️';

      const textContainer = document.createElement('div');
      textContainer.style.cssText = `
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      `;

      const title = document.createElement('div');
      title.style.cssText = `
        font-weight: 600;
        font-size: 15px;
      `;
      title.textContent = 'Režim editace';

      const description = document.createElement('div');
      description.style.cssText = `
        font-size: 14px;
        opacity: 0.95;
        line-height: 1.4;
      `;
      description.textContent =
        'Režim editace: Pokoje lze odebrat kliknutím na zatržítko (zobrazí se potvrzení). Nové pokoje nelze přidávat.';

      textContainer.appendChild(title);
      textContainer.appendChild(description);
      infoBanner.appendChild(iconContainer);
      infoBanner.appendChild(textContainer);
      roomsList.appendChild(infoBanner);
    }

    // Show ONLY rooms from original booking with per-room configuration
    for (const room of roomsToShow) {
      const isSelected = this.editSelectedRooms.has(room.id);
      const dates = this.perRoomDates.get(room.id);
      const isEditing = this.currentEditingRoom === room.id;
      const roomData = this.editSelectedRooms.get(room.id) || {
        guestType: 'external',
        adults: 1,
        children: 0,
        toddlers: 0,
      };

      // Determine border and background colors based on state
      let borderColor = '#e5e7eb';
      let backgroundColor = 'white';
      if (isEditing) {
        borderColor = '#0d9488';
        backgroundColor = '#f0fdfa';
      } else if (isSelected) {
        borderColor = '#10b981';
        backgroundColor = '#f0fdf4';
      }

      const roomCard = document.createElement('div');
      roomCard.style.cssText = `
        padding: 1rem;
        border: 2px solid ${borderColor};
        border-radius: 8px;
        background: ${backgroundColor};
      `;

      let dateInfo = '';
      if (isSelected && dates) {
        const startFormatted = DateUtils.formatDateDisplay(
          DateUtils.parseDate(dates.startDate),
          'cs'
        );
        const endFormatted = DateUtils.formatDateDisplay(DateUtils.parseDate(dates.endDate), 'cs');
        dateInfo = `
          <div style="margin-top: 0.5rem; color: #059669; font-weight: 600;">
            📅 ${startFormatted} - ${endFormatted}
            <button
              type="button"
              onclick="${onChangePrefix}.editComponent.openRoomCalendar('${room.id}')"
              class="btn btn-primary"
              style="padding: 0.25rem 0.75rem; margin-left: 0.5rem; font-size: 0.875rem;">
              Změnit termín
            </button>
          </div>
        `;
      }

      roomCard.innerHTML = `
        <label style="cursor: ${this.isBulkBooking ? 'not-allowed' : 'pointer'}; display: flex; align-items: flex-start; gap: 0.5rem; opacity: ${this.isBulkBooking ? '0.7' : '1'};">
          <input type="checkbox" ${isSelected ? 'checked' : ''}
            ${this.isBulkBooking ? 'disabled' : ''}
            onchange="${onChangePrefix}.editComponent.toggleRoom('${room.id}')"
            style="width: auto; margin: 0.25rem 0 0 0; flex-shrink: 0; cursor: ${this.isBulkBooking ? 'not-allowed' : 'pointer'};" />
          <div style="flex: 1;">
            <div>
              <strong style="font-size: 1.1rem;">${room.name}</strong>
              <span style="color: #6b7280; margin-left: 0.5rem;">(${room.beds} lůžka)</span>
            </div>
            ${dateInfo}
          </div>
        </label>
        ${
          isSelected
            ? `
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #d1d5db;">
            <!-- Guest type select removed - each guest has individual ÚTIA/EXT toggle in guest names section -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
              <div>
                <label style="font-size: 0.75rem; display: block; margin-bottom: 0.25rem; color: #4b5563; font-weight: 500;">Dospělí (18+):</label>
                <input type="number" min="1" max="${room.beds}" value="${roomData.adults}"
                  onchange="${onChangePrefix}.editComponent.updateRoomGuests('${room.id}', 'adults', parseInt(this.value))"
                  style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
              </div>
              <div>
                <label style="font-size: 0.75rem; display: block; margin-bottom: 0.25rem; color: #4b5563; font-weight: 500;">Děti (3-17 let):</label>
                <input type="number" min="0" max="${room.beds}" value="${roomData.children}"
                  onchange="${onChangePrefix}.editComponent.updateRoomGuests('${room.id}', 'children', parseInt(this.value))"
                  style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
              </div>
              <div>
                <label style="font-size: 0.75rem; display: block; margin-bottom: 0.25rem; color: #4b5563; font-weight: 500;">Batolata (0-2 roky):</label>
                <input type="number" min="0" value="${roomData.toddlers}"
                  onchange="${onChangePrefix}.editComponent.updateRoomGuests('${room.id}', 'toddlers', parseInt(this.value))"
                  style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
              </div>
            </div>
          </div>
        `
            : ''
        }
      `;

      roomsList.appendChild(roomCard);

      // Generate guest name input fields immediately for selected rooms
      if (isSelected) {
        const guestNamesHTML = this.renderGuestListForRoom(room.id, roomData);
        if (guestNamesHTML) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = guestNamesHTML;
          const guestNamesContainer = tempDiv.firstElementChild;

          // Find the guest configuration section (grid with spinbuttons)
          const guestConfigSection = roomCard.querySelector('div[style*="display: grid"]');
          if (guestConfigSection) {
            guestConfigSection.insertAdjacentElement('afterend', guestNamesContainer);
          }
        }
      }
    }

    // Populate existing guest names after rendering all rooms
    setTimeout(() => {
      this.populateGuestNamesInRooms();
    }, 50);
  }

  /**
   * Render guest names input fields for a single room
   * @param {string} roomId - Room identifier
   * @param {Object} roomData - Room data with guest info
   * @returns {string} HTML string for guest names inputs
   */
  renderGuestListForRoom(roomId, roomData) {
    const adults = roomData.adults || 0;
    const children = roomData.children || 0;
    const toddlers = roomData.toddlers || 0;
    const totalGuests = adults + children + toddlers;

    if (totalGuests === 0) {
      return '';
    }

    const onChangePrefix = this.mode === 'admin' ? 'adminPanel' : 'editPage';
    let guestInputs = '';

    // Generate adult name inputs with toggle switches
    if (adults > 0) {
      guestInputs += `
        <div style="margin-bottom: 1rem;">
          <h4 style="font-size: 0.875rem; font-weight: 600; color: #059669; margin-bottom: 0.5rem;">Dospělí (18+ let)</h4>
      `;

      for (let i = 1; i <= adults; i++) {
        guestInputs += `
          <div style="display: flex; align-items: end; gap: 0.75rem; margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; background-color: #f9fafb;">
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Křestní jméno *</label>
              <input type="text"
                id="room${roomId}AdultFirstName${i}"
                placeholder="např. Jan"
                minlength="2"
                maxlength="50"
                data-room-id="${roomId}"
                data-guest-type="adult"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Příjmení *</label>
              <input type="text"
                id="room${roomId}AdultLastName${i}"
                placeholder="např. Novák"
                minlength="2"
                maxlength="50"
                data-room-id="${roomId}"
                data-guest-type="adult"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem; flex-shrink: 0;">
              <label style="position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; margin-top: 1.5rem;">
                <input type="checkbox"
                  id="room${roomId}Adult${i}GuestTypeToggle"
                  data-room-id="${roomId}"
                  data-guest-type="adult"
                  data-guest-index="${i}"
                  onchange="${onChangePrefix}.editComponent.toggleGuestType('${roomId}', 'adult', ${i}, this.checked)"
                  style="opacity: 0; width: 0; height: 0;" />
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #059669; transition: 0.3s; border-radius: 24px;">
                  <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%;"></span>
                </span>
              </label>
              <span id="room${roomId}Adult${i}ToggleText" style="font-size: 0.75rem; font-weight: 600; color: #059669; min-width: 32px; text-align: center;">ÚTIA</span>
            </div>
          </div>
        `;
      }

      guestInputs += `</div>`;
    }

    // Generate children name inputs with toggle switches
    if (children > 0) {
      guestInputs += `
        <div style="margin-bottom: 1rem;">
          <h4 style="font-size: 0.875rem; font-weight: 600; color: #059669; margin-bottom: 0.5rem;">Děti (3-17 let)</h4>
      `;

      for (let i = 1; i <= children; i++) {
        guestInputs += `
          <div style="display: flex; align-items: end; gap: 0.75rem; margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; background-color: #f9fafb;">
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Křestní jméno *</label>
              <input type="text"
                id="room${roomId}ChildFirstName${i}"
                placeholder="např. Anna"
                minlength="2"
                maxlength="50"
                data-room-id="${roomId}"
                data-guest-type="child"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Příjmení *</label>
              <input type="text"
                id="room${roomId}ChildLastName${i}"
                placeholder="např. Nováková"
                minlength="2"
                maxlength="50"
                data-room-id="${roomId}"
                data-guest-type="child"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem; flex-shrink: 0;">
              <label style="position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; margin-top: 1.5rem;">
                <input type="checkbox"
                  id="room${roomId}Child${i}GuestTypeToggle"
                  data-room-id="${roomId}"
                  data-guest-type="child"
                  data-guest-index="${i}"
                  onchange="${onChangePrefix}.editComponent.toggleGuestType('${roomId}', 'child', ${i}, this.checked)"
                  style="opacity: 0; width: 0; height: 0;" />
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #059669; transition: 0.3s; border-radius: 24px;">
                  <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%;"></span>
                </span>
              </label>
              <span id="room${roomId}Child${i}ToggleText" style="font-size: 0.75rem; font-weight: 600; color: #059669; min-width: 32px; text-align: center;">ÚTIA</span>
            </div>
          </div>
        `;
      }

      guestInputs += `</div>`;
    }

    // Generate toddler name inputs (no toggle - always free)
    if (toddlers > 0) {
      guestInputs += `
        <div style="margin-bottom: 1rem;">
          <h4 style="font-size: 0.875rem; font-weight: 600; color: #0284c7; margin-bottom: 0.5rem;">Batolata (0-2 roky) - Zdarma</h4>
      `;

      for (let i = 1; i <= toddlers; i++) {
        guestInputs += `
          <div style="display: flex; align-items: end; gap: 0.75rem; margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e0f2fe; border-radius: 6px; background-color: #f0f9ff;">
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Křestní jméno *</label>
              <input type="text"
                id="room${roomId}ToddlerFirstName${i}"
                placeholder="např. Tomáš"
                minlength="2"
                maxlength="50"
                data-room-id="${roomId}"
                data-guest-type="toddler"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Příjmení *</label>
              <input type="text"
                id="room${roomId}ToddlerLastName${i}"
                placeholder="např. Novák"
                minlength="2"
                maxlength="50"
                data-room-id="${roomId}"
                data-guest-type="toddler"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
          </div>
        `;
      }

      guestInputs += `</div>`;
    }

    return `
      <div id="guestNamesRoom${roomId}" style="margin-top: 1rem; padding: 1rem; background: #f0fdf4; border: 2px solid #10b981; border-radius: 8px;">
        <h3 style="margin: 0 0 1rem 0; color: #047857; font-size: 0.9375rem;">👥 Jména ubytovaných osob</h3>
        ${guestInputs}
      </div>
    `;
  }

  /**
   * Render guest list for bulk bookings with editable input fields
   * @param {number} totalAdults - Total number of adults
   * @param {number} totalChildren - Total number of children
   * @param {number} totalToddlers - Total number of toddlers
   * @param {string} currentGuestType - Guest type ('utia' or 'external')
   * @returns {string} HTML string for guest list
   */
  renderBulkGuestList(totalAdults, totalChildren, totalToddlers, currentGuestType) {
    const totalGuests = totalAdults + totalChildren + totalToddlers;

    if (totalGuests === 0) {
      return '';
    }

    const onChangePrefix = this.mode === 'admin' ? 'adminPanel' : 'editPage';
    let guestInputs = '';

    // Generate adult name inputs with toggle switches
    if (totalAdults > 0) {
      guestInputs += `
        <div style="margin-bottom: 1rem;">
          <h4 style="font-size: 0.875rem; font-weight: 600; color: #059669; margin-bottom: 0.5rem;">Dospělí (18+ let)</h4>
      `;

      for (let i = 1; i <= totalAdults; i++) {
        const isExternal = currentGuestType === 'external';
        guestInputs += `
          <div style="display: flex; align-items: end; gap: 0.75rem; margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; background-color: #f9fafb;">
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Křestní jméno *</label>
              <input type="text"
                id="bulkAdultFirstName${i}"
                placeholder="např. Jan"
                minlength="2"
                maxlength="50"
                data-bulk="true"
                data-guest-type="adult"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Příjmení *</label>
              <input type="text"
                id="bulkAdultLastName${i}"
                placeholder="např. Novák"
                minlength="2"
                maxlength="50"
                data-bulk="true"
                data-guest-type="adult"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem; flex-shrink: 0;">
              <label style="position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; margin-top: 1.5rem;">
                <input type="checkbox"
                  id="bulkAdult${i}GuestTypeToggle"
                  data-bulk="true"
                  data-guest-type="adult"
                  data-guest-index="${i}"
                  ${isExternal ? 'checked' : ''}
                  onchange="${onChangePrefix}.editComponent.toggleBulkGuestType('adult', ${i}, this.checked)"
                  style="opacity: 0; width: 0; height: 0;" />
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isExternal ? '#f59e0b' : '#059669'}; transition: 0.3s; border-radius: 24px;">
                  <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${isExternal ? '23px' : '3px'}; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%;"></span>
                </span>
              </label>
              <span id="bulkAdult${i}ToggleText" style="font-size: 0.75rem; font-weight: 600; color: ${isExternal ? '#f59e0b' : '#059669'}; min-width: 32px; text-align: center;">${isExternal ? 'EXT' : 'ÚTIA'}</span>
            </div>
          </div>
        `;
      }

      guestInputs += `</div>`;
    }

    // Generate children name inputs with toggle switches
    if (totalChildren > 0) {
      guestInputs += `
        <div style="margin-bottom: 1rem;">
          <h4 style="font-size: 0.875rem; font-weight: 600; color: #059669; margin-bottom: 0.5rem;">Děti (3-17 let)</h4>
      `;

      for (let i = 1; i <= totalChildren; i++) {
        const isExternal = currentGuestType === 'external';
        guestInputs += `
          <div style="display: flex; align-items: end; gap: 0.75rem; margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; background-color: #f9fafb;">
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Křestní jméno *</label>
              <input type="text"
                id="bulkChildFirstName${i}"
                placeholder="např. Anna"
                minlength="2"
                maxlength="50"
                data-bulk="true"
                data-guest-type="child"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Příjmení *</label>
              <input type="text"
                id="bulkChildLastName${i}"
                placeholder="např. Nováková"
                minlength="2"
                maxlength="50"
                data-bulk="true"
                data-guest-type="child"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem; flex-shrink: 0;">
              <label style="position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; margin-top: 1.5rem;">
                <input type="checkbox"
                  id="bulkChild${i}GuestTypeToggle"
                  data-bulk="true"
                  data-guest-type="child"
                  data-guest-index="${i}"
                  ${isExternal ? 'checked' : ''}
                  onchange="${onChangePrefix}.editComponent.toggleBulkGuestType('child', ${i}, this.checked)"
                  style="opacity: 0; width: 0; height: 0;" />
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isExternal ? '#f59e0b' : '#059669'}; transition: 0.3s; border-radius: 24px;">
                  <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${isExternal ? '23px' : '3px'}; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%;"></span>
                </span>
              </label>
              <span id="bulkChild${i}ToggleText" style="font-size: 0.75rem; font-weight: 600; color: ${isExternal ? '#f59e0b' : '#059669'}; min-width: 32px; text-align: center;">${isExternal ? 'EXT' : 'ÚTIA'}</span>
            </div>
          </div>
        `;
      }

      guestInputs += `</div>`;
    }

    // Generate toddler name inputs (no toggle - always free)
    if (totalToddlers > 0) {
      guestInputs += `
        <div style="margin-bottom: 1rem;">
          <h4 style="font-size: 0.875rem; font-weight: 600; color: #0284c7; margin-bottom: 0.5rem;">🍼 Batolata (0-2 let) - zdarma</h4>
      `;

      for (let i = 1; i <= totalToddlers; i++) {
        guestInputs += `
          <div style="display: flex; align-items: end; gap: 0.75rem; margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #bae6fd; border-radius: 6px; background-color: #f0f9ff;">
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Křestní jméno</label>
              <input type="text"
                id="bulkToddlerFirstName${i}"
                placeholder="např. Marek"
                maxlength="50"
                data-bulk="true"
                data-guest-type="toddler"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
            <div style="flex: 1; min-width: 0;">
              <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151;">Příjmení</label>
              <input type="text"
                id="bulkToddlerLastName${i}"
                placeholder="např. Novák"
                maxlength="50"
                data-bulk="true"
                data-guest-type="toddler"
                data-guest-index="${i}"
                style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;" />
            </div>
          </div>
        `;
      }

      guestInputs += `</div>`;
    }

    return `
      <div id="bulkGuestNamesSection" style="margin-top: 1.5rem; padding: 1rem; background: #f0fdf4; border: 2px solid #10b981; border-radius: 8px;">
        <h3 style="margin: 0 0 1rem 0; color: #047857; font-size: 0.9375rem;">👥 Jména ubytovaných osob (${totalGuests})</h3>
        ${guestInputs}
      </div>
    `;
  }

  /**
   * Toggle guest type for individual bulk guest
   * @param {string} guestType - 'adult' or 'child'
   * @param {number} index - Guest index
   * @param {boolean} isExternal - Whether guest is external
   */
  toggleBulkGuestType(guestType, index, isExternal) {
    const toggleId = `bulk${guestType.charAt(0).toUpperCase() + guestType.slice(1)}${index}GuestTypeToggle`;
    const textId = `bulk${guestType.charAt(0).toUpperCase() + guestType.slice(1)}${index}ToggleText`;

    const toggleInput = document.getElementById(toggleId);
    const toggleText = document.getElementById(textId);

    if (toggleInput && toggleText) {
      const label = toggleInput.closest('label');
      if (label) {
        const slider = label.querySelector('span[style*="background-color"]');
        const thumb = slider?.querySelector('span[style*="border-radius: 50%"]');
        this.updateToggleVisualState(slider, thumb, toggleText, isExternal);
      }
    }

    // FIX 2025-12-03: Recalculate price when bulk guest type toggles change
    this.updateTotalPrice();
  }

  /**
   * Render summary card for bulk bookings
   * Shows aggregated information instead of individual room cards
   */
  renderBulkSummaryCard() {
    const roomsList = document.getElementById('editRoomsList');
    if (!roomsList) {
      return;
    }

    // Calculate aggregate data
    let minStart = null;
    let maxEnd = null;
    let totalAdults = 0;
    let totalChildren = 0;
    let totalToddlers = 0;
    const guestTypes = new Set();

    for (const dates of this.perRoomDates.values()) {
      if (!minStart || dates.startDate < minStart) {
        minStart = dates.startDate;
      }
      if (!maxEnd || dates.endDate > maxEnd) {
        maxEnd = dates.endDate;
      }
    }

    // FIX: Fallback to original booking dates if perRoomDates is empty
    if (!minStart && this.originalStartDate) {
      minStart = this.originalStartDate;
    }
    if (!maxEnd && this.originalEndDate) {
      maxEnd = this.originalEndDate;
    }

    for (const roomData of this.editSelectedRooms.values()) {
      totalAdults += roomData.adults || 0;
      totalChildren += roomData.children || 0;
      totalToddlers += roomData.toddlers || 0;
      guestTypes.add(roomData.guestType);
    }

    // Determine aggregated guest type
    let currentGuestType = 'external';
    if (guestTypes.size === 1) {
      currentGuestType = Array.from(guestTypes)[0];
    } else if (guestTypes.has('utia')) {
      currentGuestType = 'utia';
    }

    // Format dates for display
    const startFormatted = minStart
      ? DateUtils.formatDateDisplay(DateUtils.parseDate(minStart), 'cs')
      : 'N/A';
    const endFormatted = maxEnd
      ? DateUtils.formatDateDisplay(DateUtils.parseDate(maxEnd), 'cs')
      : 'N/A';

    // Get total chalet capacity
    const totalCapacity = BookingUtils.getTotalCapacity(this.settings.rooms);

    const onChangePrefix = this.mode === 'admin' ? 'adminPanel' : 'editPage';

    // Create summary card
    const summaryCard = document.createElement('div');
    summaryCard.style.cssText = `
      padding: 1.5rem;
      border: 2px solid #7c3aed;
      border-radius: 12px;
      background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.15);
    `;

    summaryCard.innerHTML = `
      <!-- Date Range -->
      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; font-weight: 600; color: #6b21a8; margin-bottom: 0.5rem; font-size: 0.875rem;">
          📅 TERMÍN REZERVACE
        </label>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="
            flex: 1;
            padding: 0.75rem 1rem;
            background: white;
            border: 1px solid #d8b4fe;
            border-radius: 8px;
            font-size: 1.1rem;
            font-weight: 600;
            color: #6b21a8;
          ">
            ${startFormatted} - ${endFormatted}
          </div>
          <button
            type="button"
            onclick="${onChangePrefix}.editComponent.openBulkCalendar()"
            class="btn btn-primary"
            style="padding: 0.75rem 1rem; font-size: 0.875rem; white-space: nowrap;">
            Změnit termín
          </button>
        </div>
      </div>

      <!-- Guest Type removed for bulk bookings - each guest has individual ÚTIA/EXT toggle -->

      <!-- Guest Counts -->
      <div style="margin-bottom: 1rem;">
        <label style="display: block; font-weight: 600; color: #6b21a8; margin-bottom: 0.75rem; font-size: 0.875rem;">
          👥 POČET HOSTŮ
        </label>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
          <div>
            <label style="font-size: 0.75rem; display: block; margin-bottom: 0.5rem; color: #6b21a8; font-weight: 600;">
              Dospělí (18+):
            </label>
            <input
              type="number"
              id="bulkAdults"
              min="1"
              max="${totalCapacity}"
              value="${totalAdults}"
              onchange="${onChangePrefix}.editComponent.updateBulkGuests('adults', parseInt(this.value))"
              style="
                width: 100%;
                padding: 0.75rem;
                border: 1px solid #d8b4fe;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                text-align: center;
                background: white;
              " />
          </div>
          <div>
            <label style="font-size: 0.75rem; display: block; margin-bottom: 0.5rem; color: #6b21a8; font-weight: 600;">
              Děti (3-17 let):
            </label>
            <input
              type="number"
              id="bulkChildren"
              min="0"
              max="${totalCapacity}"
              value="${totalChildren}"
              onchange="${onChangePrefix}.editComponent.updateBulkGuests('children', parseInt(this.value))"
              style="
                width: 100%;
                padding: 0.75rem;
                border: 1px solid #d8b4fe;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                text-align: center;
                background: white;
              " />
          </div>
          <div>
            <label style="font-size: 0.75rem; display: block; margin-bottom: 0.5rem; color: #6b21a8; font-weight: 600;">
              Batolata (0-2 roky):
            </label>
            <input
              type="number"
              id="bulkToddlers"
              min="0"
              value="${totalToddlers}"
              onchange="${onChangePrefix}.editComponent.updateBulkGuests('toddlers', parseInt(this.value))"
              style="
                width: 100%;
                padding: 0.75rem;
                border: 1px solid #d8b4fe;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                text-align: center;
                background: white;
              " />
          </div>
        </div>
      </div>

      <!-- Capacity Info -->
      <div style="
        margin-top: 1rem;
        padding: 0.75rem;
        background: #fef3c7;
        border: 1px solid #fbbf24;
        border-radius: 8px;
        font-size: 0.875rem;
        color: #92400e;
      ">
        💡 <strong>Kapacita chaty:</strong> ${totalCapacity} lůžek<br>
        <span style="font-size: 0.8rem;">Batolata se nepočítají do kapacity lůžek.</span>
      </div>

      ${this.renderBulkGuestList(totalAdults, totalChildren, totalToddlers, currentGuestType)}
    `;

    roomsList.appendChild(summaryCard);

    // Populate existing guest names after rendering bulk card
    // Use setTimeout to ensure DOM elements exist
    setTimeout(() => {
      this.populateGuestNamesInRooms();
    }, 50);
  }

  /**
   * Update guest type for all rooms in bulk booking
   */
  updateBulkGuestType(newGuestType) {
    // Update all rooms with new guest type
    for (const roomData of this.editSelectedRooms.values()) {
      roomData.guestType = newGuestType;
    }

    // Update price and re-render to update guest list display
    this.updateTotalPrice();
    this.renderPerRoomList();
  }

  /**
   * Update guest counts for bulk booking
   * Distributes guests intelligently respecting room capacities
   */
  updateBulkGuests(field, newTotal) {
    // Validate input
    const numValue = parseInt(newTotal, 10);
    if (isNaN(numValue) || numValue < 0) {
      this.showNotification(
        'Počet hostů musí být kladné číslo',
        'warning',
        NOTIFICATION_TIMEOUT.INFO
      );
      this.renderPerRoomList();
      return;
    }

    // Minimum constraint: at least 1 adult total
    if (field === 'adults' && numValue < 1) {
      this.showNotification(
        'Musí být alespoň 1 dospělý v celé rezervaci',
        'warning',
        NOTIFICATION_TIMEOUT.INFO
      );
      this.renderPerRoomList();
      return;
    }

    // Get total capacity
    const totalCapacity = BookingUtils.getTotalCapacity(this.settings.rooms);

    // Capacity validation (toddlers don't count)
    if (field === 'adults' || field === 'children') {
      // Calculate current totals
      let currentAdults = 0;
      let currentChildren = 0;

      for (const roomData of this.editSelectedRooms.values()) {
        currentAdults += roomData.adults || 0;
        currentChildren += roomData.children || 0;
      }

      // Project new totals
      const projectedAdults = field === 'adults' ? numValue : currentAdults;
      const projectedChildren = field === 'children' ? numValue : currentChildren;
      const totalGuests = projectedAdults + projectedChildren;

      if (totalGuests > totalCapacity) {
        this.showNotification(
          `⚠️ Kapacita chaty: ${totalCapacity} lůžek. ` +
            `Nelze zadat ${totalGuests} hostů (${projectedAdults} dospělých + ${projectedChildren} dětí).`,
          'error',
          4000
        );
        this.renderPerRoomList();
        return;
      }
    }

    // Smart distribution that respects individual room capacities
    // Create array of rooms with their IDs, capacities, and current guest counts
    const roomsWithCapacity = Array.from(this.editSelectedRooms.entries()).map(
      ([roomId, roomData]) => {
        const room = this.settings.rooms.find((r) => r.id === roomId);
        return {
          roomId,
          roomData,
          capacity: room ? room.beds : 4, // Default to 4 if not found
        };
      }
    );

    // Sort by capacity DESC (largest rooms first) for optimal distribution
    roomsWithCapacity.sort((a, b) => b.capacity - a.capacity);

    // Distribute guests intelligently
    let remaining = numValue;
    const distribution = new Map();

    // First pass: try to distribute evenly
    const avgPerRoom = Math.floor(numValue / roomsWithCapacity.length);
    for (const room of roomsWithCapacity) {
      const allocated = Math.min(avgPerRoom, room.capacity);
      distribution.set(room.roomId, allocated);
      remaining -= allocated;
    }

    // Second pass: distribute remainder to larger rooms first
    for (const room of roomsWithCapacity) {
      if (remaining === 0) {
        break;
      }
      const currentAllocation = distribution.get(room.roomId);
      const canAdd = Math.min(remaining, room.capacity - currentAllocation);
      if (canAdd > 0) {
        distribution.set(room.roomId, currentAllocation + canAdd);
        remaining -= canAdd;
      }
    }

    // If we still have remaining guests (shouldn't happen if capacity validation passed)
    if (remaining > 0) {
      this.showNotification(
        `⚠️ Nelze distribuovat všechny hosty s ohledem na kapacity jednotlivých pokojů.`,
        'error',
        4000
      );
      this.renderPerRoomList();
      return;
    }

    // Apply distribution to room data
    for (const [roomId, count] of distribution.entries()) {
      const roomData = this.editSelectedRooms.get(roomId);
      if (roomData) {
        roomData[field] = count;
      }
    }

    // Re-render to show updated values
    this.renderPerRoomList();

    // Update price
    this.updateTotalPrice();

    // Update guest names fields to match new guest counts
    this.populateGuestNamesInRooms();
  }

  /**
   * Open calendar for editing a specific room's dates
   */
  async openRoomCalendar(roomId) {
    this.currentEditingRoom = roomId;
    this.tempRoomStartDate = null;
    this.tempRoomEndDate = null;

    // Update room name in header
    const room = this.settings.rooms.find((r) => r.id === roomId);
    const roomNameEl = document.getElementById('editingRoomName');
    if (roomNameEl && room) {
      roomNameEl.textContent = room.name;
    }

    // Show calendar header and container
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

    // Setup event listeners for buttons
    const cancelBtn = document.getElementById('cancelRoomEditBtn');

    if (cancelBtn) {
      cancelBtn.onclick = () => this.cancelRoomEdit();
    }
    if (saveBtn) {
      saveBtn.onclick = () => this.saveRoomDates(roomId);
    }

    // Highlight selected room in list
    this.renderPerRoomList();

    // Initialize calendar
    await this.initializeRoomCalendar(roomId);

    // Reset selected dates display
    this.updateRoomDateDisplay();
  }

  /**
   * Cancel editing a room's dates
   */
  cancelRoomEdit() {
    this.currentEditingRoom = null;
    this.tempRoomStartDate = null;
    this.tempRoomEndDate = null;

    // Hide calendar
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

    // Clear calendar container
    if (containerEl) {
      containerEl.innerHTML = '';
    }

    this.renderPerRoomList();
  }

  /**
   * Initialize calendar for a specific room
   */
  async initializeRoomCalendar(roomId) {
    const containerEl = document.getElementById('editCalendarContainer');
    if (!containerEl) {
      return;
    }

    // Clear previous calendar
    containerEl.innerHTML = '';

    const originalDates = this.perRoomDates.get(roomId);

    const roomCalendar = new BaseCalendar({
      mode: BaseCalendar.MODES.SINGLE_ROOM,
      app: {
        getAllData: () => dataManager.getAllData(),
        getSettings: () => this.settings,
      },
      containerId: 'editCalendarContainer',
      roomId,
      enableDrag: true,
      allowPast: this.mode === 'admin',
      minNights: 1,
      onDateSelect: (dateStr) => this.handleRoomDateSelect(roomId, dateStr),
      onDateDeselect: (dateStr) => this.handleRoomDateDeselect(roomId, dateStr),
      currentEditingBookingId: this.currentBooking.id,
      sessionId: this.sessionId, // CRITICAL: Pass edit session ID to exclude own proposed bookings
      originalBookingDates: {
        startDate: originalDates.startDate,
        endDate: originalDates.endDate,
        rooms: [roomId],
      },
    });

    await roomCalendar.render();

    // Store calendar instance for later use
    // Initialize Map if not already created
    if (this.roomCalendars) {
      this.roomCalendars.set(roomId, roomCalendar);
    } else {
      this.roomCalendars = new Map();
      this.roomCalendars.set(roomId, roomCalendar);
    }
  }

  /**
   * Handle date selection in room calendar
   */
  handleRoomDateSelect(roomId, dateStr) {
    // Use positive conditions for clarity
    if (this.tempRoomStartDate && this.tempRoomEndDate) {
      // Both dates selected - reset selection
      this.tempRoomStartDate = dateStr;
      this.tempRoomEndDate = null;
    } else if (this.tempRoomStartDate) {
      // Start date selected, now selecting end date
      if (dateStr > this.tempRoomStartDate) {
        this.tempRoomEndDate = dateStr;
      } else {
        this.tempRoomEndDate = this.tempRoomStartDate;
        this.tempRoomStartDate = dateStr;
      }
    } else {
      // No dates selected - set start date
      this.tempRoomStartDate = dateStr;
    }

    this.updateRoomDateDisplay();
  }

  /**
   * Handle date deselection in room calendar
   */
  handleRoomDateDeselect(roomId, dateStr) {
    if (dateStr === this.tempRoomStartDate) {
      this.tempRoomStartDate = this.tempRoomEndDate;
      this.tempRoomEndDate = null;
    } else if (dateStr === this.tempRoomEndDate) {
      this.tempRoomEndDate = null;
    }

    this.updateRoomDateDisplay();
  }

  /**
   * Update display of selected dates for a room
   */
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

  /**
   * Save new dates for a room
   */
  async saveRoomDates(roomId) {
    if (!this.tempRoomStartDate || !this.tempRoomEndDate) {
      this.showNotification(
        'Vyberte prosím kompletní termín (začátek i konec)',
        'warning',
        NOTIFICATION_TIMEOUT.INFO
      );
      return;
    }

    // Check for conflicts with other bookings
    const bookings = await dataManager.getAllBookings();
    const conflicts = bookings.filter((b) => {
      if (b.id === this.currentBooking.id) {
        return false;
      }

      // Use per-room dates if available, otherwise fall back to global dates
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

    // Check for blockages
    const currentDate = new Date(this.tempRoomStartDate);
    const endDate = new Date(this.tempRoomEndDate);

    // Loop through each date in the range
    // eslint-disable-next-line no-unmodified-loop-condition
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
      // setDate() mutates currentDate, advancing the loop
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Create proposed booking for this room with new dates
    try {
      const roomData = this.editSelectedRooms.get(roomId) || {
        guestType: 'external',
        adults: 1,
        children: 0,
        toddlers: 0,
      };

      // Use consistent session ID for all proposed bookings in this edit session
      const response = await fetch('/api/proposed-bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
          totalPrice: 0, // Will be calculated later
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Nepodařilo se rezervovat termín');
      }

      const result = await response.json();

      // Save dates locally
      this.perRoomDates.set(roomId, {
        startDate: this.tempRoomStartDate,
        endDate: this.tempRoomEndDate,
        proposalId: result.proposalId, // Store proposal ID for cleanup
      });

      // Update total booking dates (calculate min/max across all rooms)
      this.updateGlobalBookingDates();

      // Close calendar and reset state
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

  /**
   * Update global booking dates based on per-room dates
   */
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

    // FIX: Only update if we have valid values, otherwise keep original dates
    // This prevents losing dates when perRoomDates is temporarily empty
    if (minStart !== null) {
      this.editStartDate = minStart;
    } else if (!this.editStartDate && this.originalStartDate) {
      // Fallback to original if editStartDate was never set
      this.editStartDate = this.originalStartDate;
    }

    if (maxEnd !== null) {
      this.editEndDate = maxEnd;
    } else if (!this.editEndDate && this.originalEndDate) {
      // Fallback to original if editEndDate was never set
      this.editEndDate = this.originalEndDate;
    }

    // Update price
    this.updateTotalPrice();
  }

  /**
   * Open calendar for bulk booking (all rooms at once)
   */
  async openBulkCalendar() {
    this.currentEditingRoom = 'bulk'; // Special marker for bulk editing
    this.tempRoomStartDate = null;
    this.tempRoomEndDate = null;

    // Update header
    const roomNameEl = document.getElementById('editingRoomName');
    if (roomNameEl) {
      roomNameEl.textContent = 'Celá chata (všechny pokoje)';
    }

    // Show calendar UI
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

    // Setup event listeners
    const cancelBtn = document.getElementById('cancelRoomEditBtn');
    if (cancelBtn) {
      cancelBtn.onclick = () => this.cancelBulkEdit();
    }
    if (saveBtn) {
      saveBtn.onclick = () => this.saveBulkDates();
    }

    // Re-render list to highlight bulk editing state
    this.renderPerRoomList();

    // Initialize BULK calendar
    await this.initializeBulkCalendar();

    // Reset display
    this.updateRoomDateDisplay();
  }

  /**
   * Initialize calendar for bulk booking
   */
  async initializeBulkCalendar() {
    const containerEl = document.getElementById('editCalendarContainer');
    if (!containerEl) {
      return;
    }

    containerEl.innerHTML = '';

    // Get current bulk dates (all rooms should have same dates in bulk booking)
    const firstRoomDates = this.perRoomDates.values().next().value;

    const bulkCalendar = new BaseCalendar({
      mode: BaseCalendar.MODES.BULK,
      app: {
        getAllData: () => dataManager.getAllData(),
        getSettings: () => this.settings,
      },
      containerId: 'editCalendarContainer',
      enableDrag: true,
      allowPast: this.mode === 'admin',
      enforceContiguous: true, // Bulk bookings must be contiguous
      minNights: 2,
      onDateSelect: (dateStr) => this.handleBulkDateSelect(dateStr),
      onDateDeselect: (dateStr) => this.handleBulkDateDeselect(dateStr),
      currentEditingBookingId: this.currentBooking.id,
      sessionId: this.sessionId, // CRITICAL: Pass edit session ID to exclude own proposed bookings
      originalBookingDates: {
        startDate: firstRoomDates.startDate,
        endDate: firstRoomDates.endDate,
        rooms: Array.from(this.perRoomDates.keys()),
      },
    });

    await bulkCalendar.render();
  }

  /**
   * Handle date selection in bulk calendar
   */
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

  /**
   * Handle date deselection in bulk calendar
   */
  handleBulkDateDeselect(dateStr) {
    if (dateStr === this.tempRoomStartDate) {
      this.tempRoomStartDate = this.tempRoomEndDate;
      this.tempRoomEndDate = null;
    } else if (dateStr === this.tempRoomEndDate) {
      this.tempRoomEndDate = null;
    }

    this.updateRoomDateDisplay();
  }

  /**
   * Cancel bulk calendar editing
   */
  cancelBulkEdit() {
    this.currentEditingRoom = null;
    this.tempRoomStartDate = null;
    this.tempRoomEndDate = null;

    // Hide calendar UI
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

    this.renderPerRoomList();
  }

  /**
   * Save new dates for bulk booking (all rooms)
   */
  async saveBulkDates() {
    if (!this.tempRoomStartDate || !this.tempRoomEndDate) {
      this.showNotification(
        'Vyberte prosím kompletní termín (začátek i konec)',
        'warning',
        NOTIFICATION_TIMEOUT.INFO
      );
      return;
    }

    // Check for conflicts with other bookings for ALL rooms
    const bookings = await dataManager.getAllBookings();
    const allRoomIds = Array.from(this.editSelectedRooms.keys());

    for (const roomId of allRoomIds) {
      const conflicts = bookings.filter((b) => {
        if (b.id === this.currentBooking.id) {
          return false;
        }

        // Use per-room dates if available, otherwise fall back to global dates
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

    // Check for blockages for all rooms
    const currentDate = new Date(this.tempRoomStartDate);
    const endDate = new Date(this.tempRoomEndDate);

    // eslint-disable-next-line no-unmodified-loop-condition
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

    // Create proposed booking for ALL rooms
    try {
      // Aggregate guest data
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          startDate: this.tempRoomStartDate,
          endDate: this.tempRoomEndDate,
          rooms: allRoomIds,
          guests: {
            adults: totalAdults,
            children: totalChildren,
            toddlers: totalToddlers,
          },
          guestType: 'external', // Will be determined from per-room data
          totalPrice: 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Nepodařilo se rezervovat termín');
      }

      const result = await response.json();

      // Update ALL room dates
      for (const roomId of allRoomIds) {
        this.perRoomDates.set(roomId, {
          startDate: this.tempRoomStartDate,
          endDate: this.tempRoomEndDate,
          proposalId: result.proposalId,
        });
      }

      // Update global dates
      this.updateGlobalBookingDates();

      // Close calendar
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

  /**
   * Log room change for audit trail
   * Sends audit log to server for persistence
   * @param {string} actionType - Type of action (room_removed, room_restored, etc.)
   * @param {string} roomId - Room ID
   * @param {object} options - Additional options (beforeState, afterState, changeDetails)
   */
  logRoomChange(actionType, roomId, options = {}) {
    // Determine user type and identifier
    let userType = 'user';
    let userIdentifier = null;

    // Check if editing via admin session or edit token
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const adminSession = window.sessionStorage.getItem('adminSessionToken');
      if (adminSession) {
        userType = 'admin';
        userIdentifier = adminSession.substring(0, 8); // First 8 chars
      } else if (this.editToken) {
        userType = 'user';
        userIdentifier = this.editToken.substring(0, 8); // First 8 chars
      }
    }

    // Prepare audit log data
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

    // Send to server (fire-and-forget, non-blocking)
    if (typeof fetch !== 'undefined') {
      fetch('/api/audit-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(auditData),
      }).catch((error) => {
        // Log error but don't block user action
        console.warn('Failed to create audit log:', error);
      });
    }
  }

  /**
   * Get session ID for proposed bookings
   * @returns {string} Session ID
   */
  getSessionId() {
    return this.sessionId;
  }
}
