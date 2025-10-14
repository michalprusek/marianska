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
 *
 * Configuration options allow for admin vs user differences:
 * - Admin: no edit deadline, session validation, allowPast dates
 * - User: 3-day deadline, token-based auth, read-only mode
 */

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
  }

  /**
   * Load booking data and initialize edit form
   * @param {Object} booking - Booking data to edit
   * @param {Object} settings - Application settings
   */
  loadBooking(booking, settings) {
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

    // FIX: Check if perRoomGuests has data for ALL rooms (not just exists)
    const hasCompletePerRoomGuests =
      booking.perRoomGuests &&
      Object.keys(booking.perRoomGuests).length === (booking.rooms || []).length;

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

    // Check edit deadline (user mode only)
    if (this.enforceDeadline && this.mode === 'user') {
      this.isEditLocked = this.checkEditDeadline();
    }

    // Populate form fields
    this.populateForm();

    // Use per-room list UI
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

    // Populate guest names section
    this.populateGuestNames();
  }

  /**
   * Generate guest names input fields dynamically based on total guest counts
   * @param {number} adults - Total number of adults across all rooms
   * @param {number} children - Total number of children across all rooms
   */
  generateGuestNamesInputs(adults, children) {
    const guestNamesSection = document.getElementById('editGuestNamesSection');
    const adultsNamesList = document.getElementById('editAdultsNamesList');
    const childrenNamesList = document.getElementById('editChildrenNamesList');
    const childrenContainer = document.getElementById('editChildrenNamesContainer');

    if (!guestNamesSection || !adultsNamesList || !childrenNamesList) {
      return;
    }

    // Clear existing inputs to prevent HTML5 validation errors on hidden fields
    adultsNamesList.textContent = '';
    childrenNamesList.textContent = '';

    // Show/hide section based on guest counts
    // CRITICAL FIX: Always show section if there are ANY guests across all rooms
    // This prevents HTML5 "invalid form control is not focusable" errors
    if (adults + children > 0) {
      guestNamesSection.style.display = 'block';
    } else {
      // Hide section and ensure no required fields remain in DOM
      guestNamesSection.style.display = 'none';
      // Clear children container visibility as well
      if (childrenContainer) {
        childrenContainer.style.display = 'none';
      }
      return;
    }

    // Generate adult name inputs using safe DOM methods
    for (let i = 1; i <= adults; i++) {
      const guestDiv = document.createElement('div');
      guestDiv.className = 'guest-name-row';
      guestDiv.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;';

      // First name input
      const firstNameGroup = document.createElement('div');
      firstNameGroup.className = 'input-group';

      const firstNameLabel = document.createElement('label');
      firstNameLabel.setAttribute('for', `editAdultFirstName${i}`);
      firstNameLabel.textContent = `Křestní jméno ${i}. dospělého *`;
      firstNameGroup.appendChild(firstNameLabel);

      const firstNameInput = document.createElement('input');
      firstNameInput.type = 'text';
      firstNameInput.id = `editAdultFirstName${i}`;
      firstNameInput.name = `editAdultFirstName${i}`;
      // Note: removed required=true to prevent HTML5 validation errors when field is in hidden tab
      // Validation is handled by validateGuestNames() method instead
      firstNameInput.minLength = 2;
      firstNameInput.maxLength = 50;
      firstNameInput.placeholder = 'např. Jan';
      firstNameInput.setAttribute('data-guest-type', 'adult');
      firstNameInput.setAttribute('data-guest-index', i);
      firstNameGroup.appendChild(firstNameInput);

      // Last name input
      const lastNameGroup = document.createElement('div');
      lastNameGroup.className = 'input-group';

      const lastNameLabel = document.createElement('label');
      lastNameLabel.setAttribute('for', `editAdultLastName${i}`);
      lastNameLabel.textContent = `Příjmení ${i}. dospělého *`;
      lastNameGroup.appendChild(lastNameLabel);

      const lastNameInput = document.createElement('input');
      lastNameInput.type = 'text';
      lastNameInput.id = `editAdultLastName${i}`;
      lastNameInput.name = `editAdultLastName${i}`;
      // Note: removed required=true to prevent HTML5 validation errors when field is in hidden tab
      // Validation is handled by validateGuestNames() method instead
      lastNameInput.minLength = 2;
      lastNameInput.maxLength = 50;
      lastNameInput.placeholder = 'např. Novák';
      lastNameInput.setAttribute('data-guest-type', 'adult');
      lastNameInput.setAttribute('data-guest-index', i);
      lastNameGroup.appendChild(lastNameInput);

      guestDiv.appendChild(firstNameGroup);
      guestDiv.appendChild(lastNameGroup);
      adultsNamesList.appendChild(guestDiv);
    }

    // Generate children name inputs
    if (children > 0) {
      childrenContainer.style.display = 'block';
      for (let i = 1; i <= children; i++) {
        const guestDiv = document.createElement('div');
        guestDiv.className = 'guest-name-row';
        guestDiv.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;';

        // First name input
        const firstNameGroup = document.createElement('div');
        firstNameGroup.className = 'input-group';

        const firstNameLabel = document.createElement('label');
        firstNameLabel.setAttribute('for', `editChildFirstName${i}`);
        firstNameLabel.textContent = `Křestní jméno ${i}. dítěte *`;
        firstNameGroup.appendChild(firstNameLabel);

        const firstNameInput = document.createElement('input');
        firstNameInput.type = 'text';
        firstNameInput.id = `editChildFirstName${i}`;
        firstNameInput.name = `editChildFirstName${i}`;
        // Note: removed required=true to prevent HTML5 validation errors when field is in hidden tab
        // Validation is handled by validateGuestNames() method instead
        firstNameInput.minLength = 2;
        firstNameInput.maxLength = 50;
        firstNameInput.placeholder = 'např. Anna';
        firstNameInput.setAttribute('data-guest-type', 'child');
        firstNameInput.setAttribute('data-guest-index', i);
        firstNameGroup.appendChild(firstNameInput);

        // Last name input
        const lastNameGroup = document.createElement('div');
        lastNameGroup.className = 'input-group';

        const lastNameLabel = document.createElement('label');
        lastNameLabel.setAttribute('for', `editChildLastName${i}`);
        lastNameLabel.textContent = `Příjmení ${i}. dítěte *`;
        lastNameGroup.appendChild(lastNameLabel);

        const lastNameInput = document.createElement('input');
        lastNameInput.type = 'text';
        lastNameInput.id = `editChildLastName${i}`;
        lastNameInput.name = `editChildLastName${i}`;
        // Note: removed required=true to prevent HTML5 validation errors when field is in hidden tab
        // Validation is handled by validateGuestNames() method instead
        lastNameInput.minLength = 2;
        lastNameInput.maxLength = 50;
        lastNameInput.placeholder = 'např. Nováková';
        lastNameInput.setAttribute('data-guest-type', 'child');
        lastNameInput.setAttribute('data-guest-index', i);
        lastNameGroup.appendChild(lastNameInput);

        guestDiv.appendChild(firstNameGroup);
        guestDiv.appendChild(lastNameGroup);
        childrenNamesList.appendChild(guestDiv);
      }
    } else {
      childrenContainer.style.display = 'none';
    }
  }

  /**
   * Populate guest names from existing booking data
   */
  populateGuestNames() {
    // Calculate total guests from per-room configuration
    let totalAdults = 0;
    let totalChildren = 0;

    for (const roomData of this.editSelectedRooms.values()) {
      totalAdults += roomData.adults || 0;
      totalChildren += roomData.children || 0;
    }

    // Generate input fields
    this.generateGuestNamesInputs(totalAdults, totalChildren);

    // Populate existing names if available
    if (this.currentBooking.guestNames && Array.isArray(this.currentBooking.guestNames)) {
      const adultNames = this.currentBooking.guestNames.filter((g) => g.personType === 'adult');
      const childNames = this.currentBooking.guestNames.filter((g) => g.personType === 'child');

      // Populate adult names
      adultNames.forEach((guest, index) => {
        const firstNameInput = document.getElementById(`editAdultFirstName${index + 1}`);
        const lastNameInput = document.getElementById(`editAdultLastName${index + 1}`);
        if (firstNameInput) {
          firstNameInput.value = guest.firstName || '';
        }
        if (lastNameInput) {
          lastNameInput.value = guest.lastName || '';
        }
      });

      // Populate child names
      childNames.forEach((guest, index) => {
        const firstNameInput = document.getElementById(`editChildFirstName${index + 1}`);
        const lastNameInput = document.getElementById(`editChildLastName${index + 1}`);
        if (firstNameInput) {
          firstNameInput.value = guest.firstName || '';
        }
        if (lastNameInput) {
          lastNameInput.value = guest.lastName || '';
        }
      });
    }
  }

  /**
   * Collect guest names from the generated form inputs
   * @returns {Array<Object>} Array of guest name objects
   */
  collectGuestNames() {
    const guestNames = [];

    // Collect adult names
    const adultFirstNames = document.querySelectorAll(
      'input[data-guest-type="adult"][id^="editAdultFirstName"]'
    );
    const adultLastNames = document.querySelectorAll(
      'input[data-guest-type="adult"][id^="editAdultLastName"]'
    );

    for (let i = 0; i < adultFirstNames.length; i++) {
      const firstName = adultFirstNames[i].value.trim();
      const lastName = adultLastNames[i].value.trim();
      if (firstName && lastName) {
        guestNames.push({
          personType: 'adult',
          firstName,
          lastName,
        });
      }
    }

    // Collect children names
    const childFirstNames = document.querySelectorAll(
      'input[data-guest-type="child"][id^="editChildFirstName"]'
    );
    const childLastNames = document.querySelectorAll(
      'input[data-guest-type="child"][id^="editChildLastName"]'
    );

    for (let i = 0; i < childFirstNames.length; i++) {
      const firstName = childFirstNames[i].value.trim();
      const lastName = childLastNames[i].value.trim();
      if (firstName && lastName) {
        guestNames.push({
          personType: 'child',
          firstName,
          lastName,
        });
      }
    }

    return guestNames;
  }

  /**
   * Validate guest names input fields
   * @param {number} expectedAdults - Expected number of adults
   * @param {number} expectedChildren - Expected number of children
   * @returns {Object} Validation result with valid flag and error message
   */
  validateGuestNames(expectedAdults, expectedChildren) {
    const guestNames = this.collectGuestNames();
    const adultNames = guestNames.filter((g) => g.personType === 'adult');
    const childNames = guestNames.filter((g) => g.personType === 'child');

    // Check counts
    if (adultNames.length !== expectedAdults) {
      return {
        valid: false,
        error: `Vyplňte jména všech ${expectedAdults} dospělých v záložce "Fakturační údaje"`,
      };
    }

    if (childNames.length !== expectedChildren) {
      return {
        valid: false,
        error: `Vyplňte jména všech ${expectedChildren} dětí v záložce "Fakturační údaje"`,
      };
    }

    // Check each name for minimum length
    for (const guest of guestNames) {
      if (guest.firstName.length < 2) {
        return {
          valid: false,
          error: 'Všechna křestní jména musí mít alespoň 2 znaky (záložka "Fakturační údaje")',
        };
      }
      if (guest.lastName.length < 2) {
        return {
          valid: false,
          error: 'Všechna příjmení musí mít alespoň 2 znaky (záložka "Fakturační údaje")',
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
            <select onchange="${onChangePrefix}.editComponent.updateRoomGuestType('${room.id}', this.value)"
              style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;">
              <option value="utia" ${roomData.guestType === 'utia' ? 'selected' : ''}>Zaměstnanec ÚTIA</option>
              <option value="external" ${roomData.guestType === 'external' ? 'selected' : ''}>Externí host</option>
            </select>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 0.5rem;">
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
                <label style="font-size: 0.75rem; display: block; margin-bottom: 0.25rem; color: #4b5563; font-weight: 500; height: 2.25rem; line-height: 1.2;">Batolata (0-3 roky):</label>
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
   * ⚠️ EDIT MODE RESTRICTION: Users can ONLY edit rooms that were in the original booking
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

    // ⚠️ NEW: Prevent adding or removing rooms in edit mode
    // Users can only edit dates/guests for rooms that are already in the booking
    if (!this.originalRooms.includes(roomId)) {
      this.showNotification(
        '⚠️ V editaci nelze přidávat nové pokoje. ' +
          'Můžete měnit pouze termíny a počty hostů u již rezervovaných pokojů.',
        'warning',
        4000
      );
      // Revert checkbox state using requestAnimationFrame for smoother UX
      requestAnimationFrame(() => this.renderPerRoomList());
      return;
    }

    // ⚠️ NEW: Prevent removing rooms that are in the original booking
    if (this.editSelectedRooms.has(roomId) && this.originalRooms.includes(roomId)) {
      this.showNotification(
        '⚠️ V editaci nelze odebírat pokoje z rezervace. ' +
          'Můžete měnit pouze termíny a počty hostů.',
        'warning',
        4000
      );
      // Revert checkbox state using requestAnimationFrame for smoother UX
      requestAnimationFrame(() => this.renderPerRoomList());
      return;
    }

    // This code should now be unreachable due to above restrictions
    if (this.editSelectedRooms.has(roomId)) {
      // Uncheck - remove room
      this.editSelectedRooms.delete(roomId);
      this.perRoomDates.delete(roomId);
    } else {
      // Check - add room with default guest data
      this.editSelectedRooms.set(roomId, {
        guestType: 'external',
        adults: 1,
        children: 0,
        toddlers: 0,
      });

      // Add default dates (from original booking or first selected room)
      let defaultDates = {
        startDate: this.currentBooking.startDate,
        endDate: this.currentBooking.endDate,
      };

      // If there are other selected rooms, use their dates
      if (this.perRoomDates.size > 0) {
        const firstRoomDates = this.perRoomDates.values().next().value;
        defaultDates = firstRoomDates;
      }

      this.perRoomDates.set(roomId, defaultDates);
    }

    this.updateGlobalBookingDates();
    this.renderPerRoomList();
  }

  /**
   * Update guest type for a room
   */
  updateRoomGuestType(roomId, guestType) {
    const roomData = this.editSelectedRooms.get(roomId);
    if (roomData) {
      roomData.guestType = guestType;
      // Only update price, don't re-render list
      this.updateTotalPrice();
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
    // Update guest names fields to match new guest counts
    this.populateGuestNames();
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
    if (this.editSelectedRooms.size === 0) {
      document.getElementById('editTotalPrice').textContent = '0 Kč';
      return;
    }

    let totalPrice = 0;

    // Use bulk pricing for bulk bookings
    if (this.isBulkBooking) {
      // Aggregate guest data across all rooms
      let totalAdults = 0;
      let totalChildren = 0;
      const guestTypes = new Set();

      for (const roomData of this.editSelectedRooms.values()) {
        totalAdults += roomData.adults || 0;
        totalChildren += roomData.children || 0;
        guestTypes.add(roomData.guestType);
      }

      // Determine aggregated guest type
      let finalGuestType = 'external';
      if (guestTypes.size === 1) {
        finalGuestType = Array.from(guestTypes)[0];
      } else if (guestTypes.has('utia')) {
        finalGuestType = 'utia';
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

      const nights = minStart && maxEnd ? DateUtils.getDaysBetween(minStart, maxEnd) : 0;

      // Use bulk price calculator
      totalPrice = PriceCalculator.calculateBulkPrice({
        guestType: finalGuestType,
        adults: totalAdults,
        children: totalChildren,
        nights,
        settings: this.settings,
      });
    } else {
      // Regular pricing: sum individual room prices
      for (const [roomId, roomData] of this.editSelectedRooms) {
        const dates = this.perRoomDates.get(roomId);

        // Skip if room doesn't have dates yet - continue is acceptable here
        if (!dates) {
          // eslint-disable-next-line no-continue
          continue;
        }

        const nights = DateUtils.getDaysBetween(dates.startDate, dates.endDate);
        const price = PriceCalculator.calculatePrice({
          guestType: roomData.guestType,
          adults: roomData.adults,
          children: roomData.children,
          nights,
          roomsCount: 1,
          settings: this.settings,
        });

        totalPrice += price;
      }
    }

    document.getElementById('editTotalPrice').textContent =
      `${totalPrice.toLocaleString('cs-CZ')} Kč`;
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

    // Validate dates
    if (!this.editStartDate || !this.editEndDate) {
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
        throw new Error(`Pokoj ${selectedRoomId} nebyl nalezen v konfiguraci`);
      }

      const totalGuests = roomData.adults + roomData.children;
      if (totalGuests > room.beds) {
        throw new Error(
          `Pokoj ${room.name} má kapacitu pouze ${room.beds} lůžek, ` +
            `ale obsahuje ${totalGuests} hostů (${roomData.adults} dospělých + ${roomData.children} dětí). ` +
            `Batolata se do kapacity nepočítají. Upravte prosím počty hostů.`
        );
      }
    }

    // Validate guest names
    let totalAdults = 0;
    let totalChildren = 0;
    for (const roomData of this.editSelectedRooms.values()) {
      totalAdults += roomData.adults || 0;
      totalChildren += roomData.children || 0;
    }

    if (totalAdults + totalChildren > 0) {
      const validation = this.validateGuestNames(totalAdults, totalChildren);
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
      startDate: minStart || this.editStartDate,
      endDate: maxEnd || this.editEndDate,
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
      // Use bulk pricing for bulk bookings
      const nights = DateUtils.getDaysBetween(minStart, maxEnd);
      totalPrice = PriceCalculator.calculateBulkPrice({
        guestType: finalGuestType,
        adults: totalAdults,
        children: totalChildren,
        nights,
        settings: this.settings,
      });
    } else {
      // Regular pricing: sum individual room prices
      for (const [roomId, dates] of this.perRoomDates) {
        const roomData = this.editSelectedRooms.get(roomId) || {
          guestType: 'external',
          adults: 1,
          children: 0,
        };

        const nights = DateUtils.getDaysBetween(dates.startDate, dates.endDate);
        totalPrice += PriceCalculator.calculatePrice({
          guestType: roomData.guestType,
          adults: roomData.adults,
          children: roomData.children,
          nights,
          roomsCount: 1,
          settings: this.settings,
        });
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

    notification.innerHTML = `
      <span class="notification-icon">${iconMap[type] || iconMap.info}</span>
      <span class="notification-content">${message}</span>
      <span class="notification-close">×</span>
    `;

    const container =
      document.getElementById('notificationContainer') ||
      (() => {
        const c = document.createElement('div');
        c.id = 'notificationContainer';
        document.body.appendChild(c);
        return c;
      })();

    container.appendChild(notification);

    notification.addEventListener('click', () => {
      notification.classList.add('removing');
      setTimeout(() => notification.remove(), 300);
    });

    requestAnimationFrame(() => notification.classList.add('show'));

    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.add('removing');
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
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

    // Initialize per-room dates from current booking
    if (this.perRoomDates.size === 0 && this.currentBooking) {
      this.currentBooking.rooms.forEach((roomId) => {
        this.perRoomDates.set(roomId, {
          startDate: this.currentBooking.startDate,
          endDate: this.currentBooking.endDate,
        });
      });
    }

    const onChangePrefix = this.mode === 'admin' ? 'adminPanel' : 'editPage';

    // ⚠️ EDIT MODE RESTRICTION: Only show rooms from original booking
    // Filter rooms to show ONLY those in the original booking
    const roomsToShow = this.settings.rooms.filter((r) => this.originalRooms.includes(r.id));

    // Show informational notice about edit restrictions
    if (roomsToShow.length < this.settings.rooms.length) {
      const notice = document.createElement('div');
      notice.style.cssText = `
        padding: 1rem;
        margin-bottom: 1rem;
        background: #e0f2fe;
        border: 2px solid #0284c7;
        border-radius: 8px;
        color: #075985;
        font-weight: 500;
      `;
      notice.textContent =
        'ℹ️ Režim editace: Zobrazeny jsou pouze pokoje z původní rezervace. ' +
        'V editaci nelze přidávat ani odebírat pokoje.';
      roomsList.appendChild(notice);
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
            <select onchange="${onChangePrefix}.editComponent.updateRoomGuestType('${room.id}', this.value)"
              style="width: 100%; padding: 0.5rem; margin-bottom: 0.75rem; border: 1px solid #d1d5db; border-radius: 4px;">
              <option value="utia" ${roomData.guestType === 'utia' ? 'selected' : ''}>Zaměstnanec ÚTIA</option>
              <option value="external" ${roomData.guestType === 'external' ? 'selected' : ''}>Externí host</option>
            </select>
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
                <label style="font-size: 0.75rem; display: block; margin-bottom: 0.25rem; color: #4b5563; font-weight: 500;">Batolata (0-3 roky):</label>
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
    }
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

      <!-- Guest Type -->
      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; font-weight: 600; color: #6b21a8; margin-bottom: 0.5rem; font-size: 0.875rem;">
          👤 TYP HOSTA
        </label>
        <select
          id="bulkGuestType"
          onchange="${onChangePrefix}.editComponent.updateBulkGuestType(this.value)"
          style="
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #d8b4fe;
            border-radius: 8px;
            font-size: 1rem;
            background: white;
            cursor: pointer;
          ">
          <option value="utia" ${currentGuestType === 'utia' ? 'selected' : ''}>Zaměstnanec ÚTIA</option>
          <option value="external" ${currentGuestType === 'external' ? 'selected' : ''}>Externí host</option>
        </select>
      </div>

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
              Batolata (0-3 roky):
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
    `;

    roomsList.appendChild(summaryCard);
  }

  /**
   * Update guest type for all rooms in bulk booking
   */
  updateBulkGuestType(newGuestType) {
    // Update all rooms with new guest type
    for (const roomData of this.editSelectedRooms.values()) {
      roomData.guestType = newGuestType;
    }

    // Update price
    this.updateTotalPrice();
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
    this.populateGuestNames();
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
        `⚠️ Pokoj ${roomId} je v tomto termínu již obsazený. Zvolte jiný termín.`,
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
          `⚠️ Pokoj ${roomId} je v tomto termínu blokován. Zvolte jiný termín.`,
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

    this.editStartDate = minStart;
    this.editEndDate = maxEnd;

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
   * Get session ID for proposed bookings
   * @returns {string} Session ID
   */
  getSessionId() {
    return this.sessionId;
  }
}
