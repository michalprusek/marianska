/**
 * GuestNameUtils - Guest Name Input Management & Organization
 *
 * Unified utilities for:
 * 1. Generating and collecting guest name inputs (NEW - from single-room/bulk refactoring)
 * 2. Organizing guest names by room (EXISTING functionality preserved)
 *
 * SSOT (Single Source of Truth) for:
 * - Guest name input field generation with toggle switches
 * - Data capture and restoration (preserves user input during re-renders)
 * - Guest name validation and collection
 * - Room-based organization of guest names
 *
 * @module GuestNameUtils
 */

class GuestNameUtils {
  // ==================== NEW: INPUT GENERATION & COLLECTION ====================

  /**
   * Generate HTML inputs for guest names with toggle switches
   *
   * Supports two modes:
   * 1. Single room booking: With pricing toggles, data capture/restore
   * 2. Bulk booking: Simple inputs without toggles
   *
   * @param {Object} config - Configuration object
   * @param {number} config.adults - Number of adults
   * @param {number} config.children - Number of children (3-17 years)
   * @param {number} [config.toddlers=0] - Number of toddlers (0-2 years, free)
   * @param {string} config.sectionId - DOM ID of the parent section
   * @param {boolean} [config.showPricingToggles=true] - Show ÚTIA/External toggles (single room)
   * @param {string} [config.defaultGuestType='utia'] - Default guest type for toggles
   * @param {string} [config.language='cs'] - Language for labels ('cs' or 'en')
   * @param {Function} [config.onToggleChange] - Callback when guest type toggle changes (for price updates)
   * @returns {void} - Modifies DOM directly
   */
  static generateInputsHTML(config) {
    const {
      adults,
      children,
      toddlers = 0,
      sectionId,
      showPricingToggles = true,
      defaultGuestType = 'utia',
      language = 'cs',
      onToggleChange = null,
    } = config;

    const section = document.getElementById(sectionId);
    if (!section) {
      console.error(`GuestNameUtils: Section with ID "${sectionId}" not found`);
      return;
    }

    const totalGuests = (adults || 0) + (children || 0) + (toddlers || 0);

    // Show/hide section based on guest count
    if (totalGuests > 0) {
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
      return;
    }

    // CAPTURE PHASE: Save existing guest data before clearing DOM
    // This preserves user input when component re-renders
    const savedGuestData = showPricingToggles ? this._captureExistingData(section) : new Map();

    // Helper for generating IDs (uses sectionId as prefix)
    const makeId = (suffix) => `${sectionId.replace('GuestNamesSection', '')}${suffix}`;

    // Generate adults section
    const adultsContainer = document.getElementById(
      `${sectionId.replace('GuestNamesSection', 'AdultsNamesContainer')}`
    );
    if (adultsContainer) {
      this._generateGuestTypeSection({
        container: adultsContainer,
        count: adults,
        guestType: 'adult',
        headerLabel: this._getLabel('adultsLabel', language),
        makeId,
        showPricingToggles,
        defaultGuestType,
        savedGuestData,
        onToggleChange,
        language,
      });
    }

    // Generate children section
    const childrenContainer = document.getElementById(
      `${sectionId.replace('GuestNamesSection', 'ChildrenNamesContainer')}`
    );
    if (childrenContainer) {
      this._generateGuestTypeSection({
        container: childrenContainer,
        count: children,
        guestType: 'child',
        headerLabel: this._getLabel('childrenLabel', language),
        makeId,
        showPricingToggles,
        defaultGuestType,
        savedGuestData,
        onToggleChange,
        language,
      });
    }

    // Generate toddlers section
    const toddlersContainer = document.getElementById(
      `${sectionId.replace('GuestNamesSection', 'ToddlersNamesContainer')}`
    );
    if (toddlersContainer) {
      this._generateGuestTypeSection({
        container: toddlersContainer,
        count: toddlers,
        guestType: 'toddler',
        headerLabel: this._getLabel('toddlersLabel', language),
        makeId,
        showPricingToggles,
        defaultGuestType,
        savedGuestData,
        onToggleChange,
        language,
        isFree: true, // Toddlers are free
      });
    }
  }

  /**
   * Collect and validate guest names from input fields
   *
   * Validates that:
   * - All first and last name fields are filled
   * - Names are at least 2 characters
   * - Guest types are set (if pricing toggles are present)
   *
   * @param {string} sectionId - DOM ID of the guest names section
   * @param {boolean} [showValidationErrors=true] - Show error notifications on validation failure
   * @param {Object} [appContext=null] - App context for showing notifications (optional)
   * @param {string} [language='cs'] - Language for error messages
   * @returns {Array|null} - Array of guest objects or null if validation fails
   *
   * @example
   * const guests = GuestNameUtils.collectGuestNames('singleRoomGuestNamesSection', true, window.app);
   * // Returns: [
   * //   { firstName: 'Jan', lastName: 'Novák', personType: 'adult', guestPriceType: 'utia' },
   * //   { firstName: 'Marie', lastName: 'Nováková', personType: 'child', guestPriceType: 'external' }
   * // ]
   */
  static collectGuestNames(
    sectionId,
    showValidationErrors = true,
    appContext = null,
    language = 'cs'
  ) {
    const guestNames = [];
    const section = document.getElementById(sectionId);

    if (!section || section.style.display === 'none') {
      return []; // No names section visible, return empty array
    }

    // Collect all text inputs (first/last names) - exclude toggle checkboxes
    const inputs = section.querySelectorAll('input[data-guest-type]:not([data-guest-price-type])');

    // Group inputs by guest type and index
    const guestMap = new Map();
    let hasValidationError = false;

    inputs.forEach((input) => {
      const { guestType } = input.dataset;
      const { guestIndex } = input.dataset;
      const key = `${guestType}-${guestIndex}`;

      if (!guestMap.has(key)) {
        guestMap.set(key, { personType: guestType });
      }

      const guest = guestMap.get(key);
      const value = input.value.trim();

      // Validate: all fields must be filled and at least 2 characters
      if (!value || value.length < 2) {
        // Highlight invalid field (only if showing errors)
        if (showValidationErrors) {
          input.style.borderColor = '#ef4444'; // Red border
        }
        hasValidationError = true;
        return;
      }

      // Reset border color for valid input
      input.style.borderColor = '#d1d5db';

      // Determine if this is firstName or lastName based on ID
      if (input.id.includes('FirstName')) {
        guest.firstName = value;
      } else if (input.id.includes('LastName')) {
        guest.lastName = value;
      }
    });

    // If any validation failed, show error and return null
    if (hasValidationError) {
      if (showValidationErrors && appContext && appContext.showNotification) {
        appContext.showNotification(this._getErrorMessage('fillAllNames', language), 'error');
      }
      return null;
    }

    // Collect guest types from toggle switches (if present)
    const guestTypeInputs = section.querySelectorAll('input[data-guest-price-type]');
    guestTypeInputs.forEach((input) => {
      const { guestType } = input.dataset;
      const { guestIndex } = input.dataset;
      const key = `${guestType}-${guestIndex}`;

      if (guestMap.has(key)) {
        const guest = guestMap.get(key);
        // Checkbox: unchecked = 'utia', checked = 'external'
        guest.guestPriceType = input.checked ? 'external' : 'utia';
      }
    });

    // Convert map to array and validate completeness
    for (const [key, guest] of guestMap) {
      // Validate that both names are present
      if (!guest.firstName || !guest.lastName) {
        if (showValidationErrors && appContext && appContext.showNotification) {
          appContext.showNotification(this._getErrorMessage('fillAllNames', language), 'error');
        }
        return null; // Incomplete guest data
      }

      // Validate that guest type is set (if pricing toggles are enabled)
      if (guestTypeInputs.length > 0 && !guest.guestPriceType) {
        if (showValidationErrors && appContext && appContext.showNotification) {
          appContext.showNotification(this._getErrorMessage('selectGuestType', language), 'error');
        }
        return null;
      }

      guestNames.push(guest);
    }

    return guestNames;
  }

  // ==================== PRIVATE HELPER METHODS (INPUT GENERATION) ====================

  /**
   * Capture existing guest data from DOM before clearing
   * Preserves user input during component re-renders
   *
   * @private
   * @param {HTMLElement} section - Parent section element
   * @returns {Map} - Map of guest data keyed by 'type-index'
   */
  static _captureExistingData(section) {
    const savedGuestData = new Map();

    // Capture all text inputs
    const existingInputs = section.querySelectorAll(
      'input[data-guest-type]:not([data-guest-price-type])'
    );
    existingInputs.forEach((input) => {
      const { guestType } = input.dataset;
      const index = input.dataset.guestIndex;
      const key = `${guestType}-${index}`;

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

    // Capture toggle states
    const existingToggles = section.querySelectorAll('input[data-guest-price-type]');
    existingToggles.forEach((toggle) => {
      const { guestType } = toggle.dataset;
      const index = toggle.dataset.guestIndex;
      const key = `${guestType}-${index}`;

      if (savedGuestData.has(key)) {
        savedGuestData.get(key).guestType = toggle.checked ? 'external' : 'utia';
      }
    });

    return savedGuestData;
  }

  /**
   * Generate inputs for a single guest type (adults, children, or toddlers)
   *
   * @private
   * @param {Object} params - Generation parameters
   */
  static _generateGuestTypeSection(params) {
    const {
      container,
      count,
      guestType,
      headerLabel,
      makeId,
      showPricingToggles,
      defaultGuestType,
      savedGuestData,
      onToggleChange,
      language,
      isFree = false,
    } = params;

    container.innerHTML = '';

    if (count > 0) {
      container.style.display = 'block';
      if (guestType === 'child' || guestType === 'toddler') {
        container.style.marginTop = '1rem';
      }

      // Section header
      const header = document.createElement('h5');
      header.style.cssText = 'margin-bottom: 0.5rem; color: #374151; font-size: 0.95rem;';
      header.textContent = `${headerLabel} (${count})`;
      container.appendChild(header);

      // Generate input rows
      for (let i = 1; i <= count; i++) {
        const row = this._createGuestRow({
          guestType,
          index: i,
          makeId,
          showPricingToggles,
          defaultGuestType,
          savedGuestData,
          onToggleChange,
          language,
          isFree,
        });
        container.appendChild(row);
      }
    } else {
      container.style.display = 'none';
    }
  }

  /**
   * Create a single guest input row with name fields and optional toggle
   *
   * @private
   * @param {Object} params - Row parameters
   * @returns {HTMLElement} - Row element
   */
  static _createGuestRow(params) {
    const {
      guestType,
      index,
      makeId,
      showPricingToggles,
      defaultGuestType,
      savedGuestData,
      onToggleChange,
      language,
      isFree,
    } = params;

    const row = document.createElement('div');

    if (showPricingToggles) {
      // Single room style: with padding, border, and toggles
      row.style.cssText =
        'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; background-color: #f9fafb;';
    } else {
      // Bulk booking style: simple flex layout
      row.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem;';
    }

    // First name input
    const firstNameInput = this._createNameInput({
      id: `${makeId(`${guestType.charAt(0).toUpperCase() + guestType.slice(1)}FirstName`)}${index}`,
      placeholder: this._getLabel('firstNamePlaceholder', language),
      guestType,
      index,
    });

    // Last name input
    const lastNameInput = this._createNameInput({
      id: `${makeId(`${guestType.charAt(0).toUpperCase() + guestType.slice(1)}LastName`)}${index}`,
      placeholder: this._getLabel('lastNamePlaceholder', language),
      guestType,
      index,
    });

    row.appendChild(firstNameInput);
    row.appendChild(lastNameInput);

    // Add pricing toggle if enabled (single room booking)
    if (showPricingToggles) {
      const toggleContainer = this._createToggleSwitch({
        guestType,
        index,
        defaultGuestType,
        onToggleChange,
      });
      row.appendChild(toggleContainer);
    }

    // Add "free" label for toddlers
    if (isFree) {
      const freeLabel = document.createElement('span');
      freeLabel.textContent = language === 'cs' ? '(zdarma)' : '(free)';
      freeLabel.style.cssText = 'font-size: 0.7rem; color: #6b7280; white-space: nowrap;';
      row.appendChild(freeLabel);
    }

    // RESTORE PHASE: Restore saved data for this guest
    const savedKey = `${guestType}-${index}`;
    if (savedGuestData.has(savedKey)) {
      this._restoreSavedData(savedKey, savedGuestData, firstNameInput, lastNameInput, row);
    }

    return row;
  }

  /**
   * Create a name input field (first or last name)
   *
   * @private
   * @param {Object} params - Input parameters
   * @returns {HTMLInputElement} - Input element
   */
  static _createNameInput(params) {
    const { id, placeholder, guestType, index } = params;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.placeholder = placeholder;
    input.setAttribute('data-guest-type', guestType);
    input.setAttribute('data-guest-index', index);
    input.required = true;
    input.minLength = 2;
    input.maxLength = 50;
    input.style.cssText =
      'flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; min-width: 0;';

    return input;
  }

  /**
   * Create ÚTIA/External toggle switch
   *
   * @private
   * @param {Object} params - Toggle parameters
   * @returns {HTMLElement} - Toggle container element
   */
  static _createToggleSwitch(params) {
    const { guestType, index, defaultGuestType, onToggleChange } = params;

    const toggleContainer = document.createElement('div');
    toggleContainer.style.cssText =
      'display: flex; align-items: center; gap: 0.25rem; white-space: nowrap; flex-shrink: 0;';

    const toggleLabel = document.createElement('label');
    toggleLabel.style.cssText =
      'position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer;';

    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.id = `${guestType}${index}GuestTypeToggle`;
    toggleInput.setAttribute('data-guest-type', guestType);
    toggleInput.setAttribute('data-guest-index', index);
    toggleInput.setAttribute('data-guest-price-type', 'true');
    toggleInput.checked = defaultGuestType === 'external'; // Unchecked = ÚTIA, Checked = External
    toggleInput.style.cssText = 'opacity: 0; width: 0; height: 0;';

    const toggleSlider = document.createElement('span');
    toggleSlider.style.cssText = `
      position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
      background-color: ${defaultGuestType === 'external' ? '#dc2626' : '#059669'};
      transition: 0.3s; border-radius: 24px;
    `;

    const toggleThumb = document.createElement('span');
    toggleThumb.style.cssText = `
      position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px;
      background-color: white; transition: 0.3s; border-radius: 50%;
      ${defaultGuestType === 'external' ? 'transform: translateX(20px);' : ''}
    `;
    toggleSlider.appendChild(toggleThumb);

    const toggleText = document.createElement('span');
    toggleText.textContent = defaultGuestType === 'external' ? 'EXT' : 'ÚTIA';
    toggleText.style.cssText = `font-size: 0.75rem; font-weight: 600; color: ${defaultGuestType === 'external' ? '#dc2626' : '#059669'}; min-width: 32px;`;

    // Toggle state change handler
    toggleInput.addEventListener('change', async function () {
      if (this.checked) {
        // External guest
        toggleSlider.style.backgroundColor = '#dc2626'; // Red
        toggleThumb.style.transform = 'translateX(20px)';
        toggleText.textContent = 'EXT';
        toggleText.style.color = '#dc2626';
      } else {
        // ÚTIA guest
        toggleSlider.style.backgroundColor = '#059669'; // Green
        toggleThumb.style.transform = 'translateX(0)';
        toggleText.textContent = 'ÚTIA';
        toggleText.style.color = '#059669';
      }

      // Trigger price recalculation callback (for single room booking)
      if (onToggleChange) {
        try {
          await onToggleChange();
        } catch (error) {
          console.error('Failed to update price after guest type change:', error);
        }
      }
    });

    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(toggleSlider);

    toggleContainer.appendChild(toggleLabel);
    toggleContainer.appendChild(toggleText);

    return toggleContainer;
  }

  /**
   * Restore saved guest data to input fields
   *
   * @private
   * @param {string} savedKey - Key in savedGuestData map
   * @param {Map} savedGuestData - Saved guest data map
   * @param {HTMLInputElement} firstNameInput - First name input element
   * @param {HTMLInputElement} lastNameInput - Last name input element
   * @param {HTMLElement} row - Row element containing toggle
   */
  static _restoreSavedData(savedKey, savedGuestData, firstNameInput, lastNameInput, row) {
    const saved = savedGuestData.get(savedKey);

    // Restore name values
    if (saved.firstName) {
      firstNameInput.value = saved.firstName;
    }
    if (saved.lastName) {
      lastNameInput.value = saved.lastName;
    }

    // Restore toggle state
    if (saved.guestType) {
      const toggleInput = row.querySelector('input[data-guest-price-type]');
      if (toggleInput) {
        const isExternal = saved.guestType === 'external';
        toggleInput.checked = isExternal;

        // Update visual state
        const toggleSlider = row.querySelector('label span:first-of-type');
        const toggleThumb = toggleSlider?.querySelector('span');
        const toggleText = row.querySelector('label + span');

        if (toggleSlider && toggleThumb && toggleText) {
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
    }
  }

  /**
   * Get translated label
   *
   * @private
   * @param {string} key - Label key
   * @param {string} language - Language code ('cs' or 'en')
   * @returns {string} - Translated label
   */
  static _getLabel(key, language) {
    // Try to use global langManager if available
    if (typeof langManager !== 'undefined' && langManager.t) {
      return langManager.t(key);
    }

    // Fallback labels
    const labels = {
      cs: {
        adultsLabel: 'Dospělí',
        childrenLabel: 'Děti (3-17 let)',
        toddlersLabel: 'Batolata (0-2 roky)',
        firstNamePlaceholder: 'Křestní jméno',
        lastNamePlaceholder: 'Příjmení',
      },
      en: {
        adultsLabel: 'Adults',
        childrenLabel: 'Children (3-17 years)',
        toddlersLabel: 'Toddlers (0-2 years)',
        firstNamePlaceholder: 'First name',
        lastNamePlaceholder: 'Last name',
      },
    };

    return labels[language]?.[key] || labels.cs[key];
  }

  /**
   * Get translated error message
   *
   * @private
   * @param {string} key - Error message key
   * @param {string} language - Language code ('cs' or 'en')
   * @returns {string} - Translated error message
   */
  static _getErrorMessage(key, language) {
    const messages = {
      cs: {
        fillAllNames: 'Vyplňte všechna jména hostů (křestní i příjmení)',
        selectGuestType: 'Vyberte typ hosta (ÚTIA/Externí) pro všechny hosty',
      },
      en: {
        fillAllNames: 'Fill in all guest names (first and last name)',
        selectGuestType: 'Select guest type (ÚTIA/External) for all guests',
      },
    };

    return messages[language]?.[key] || messages.cs[key];
  }

  // ==================== EXISTING: ROOM-BASED ORGANIZATION ====================

  /**
   * Organize flat guest names array by room based on perRoomGuests data
   *
   * @param {Array} guestNames - Flat array of guest objects: [{personType, firstName, lastName, roomId?}]
   * @param {Object} perRoomGuests - Per-room guest counts: { '12': {adults: 1, children: 0, toddlers: 0}, '13': {...} }
   * @param {Array} rooms - Array of room IDs in order: ['12', '13', '14']
   * @returns {Object} - Organized by room: { '12': [{personType, firstName, lastName}], '13': [...] }
   *
   * @example
   * const guestNames = [
   *   {personType: 'adult', firstName: 'Jan', lastName: 'Novák'},
   *   {personType: 'adult', firstName: 'Petr', lastName: 'Svoboda'}
   * ];
   * const perRoomGuests = {
   *   '12': {adults: 1, children: 0, toddlers: 0},
   *   '13': {adults: 1, children: 0, toddlers: 0}
   * };
   * const organized = GuestNameUtils.organizeByRoom(guestNames, perRoomGuests, ['12', '13']);
   * // Result: { '12': [{...Jan}], '13': [{...Petr}] }
   */
  static organizeByRoom(guestNames, perRoomGuests, rooms) {
    if (!guestNames || !Array.isArray(guestNames)) {
      return {};
    }

    // If guest names already have roomId, use that directly
    const hasRoomIds = guestNames.some((g) => g.roomId);
    if (hasRoomIds) {
      return this._organizeByExistingRoomId(guestNames);
    }

    // Otherwise, distribute sequentially based on perRoomGuests
    if (!perRoomGuests || !rooms || rooms.length === 0) {
      // Fallback: return all names under first room or 'unknown'
      const roomId = rooms?.[0] || 'unknown';
      return { [roomId]: [...guestNames] };
    }

    return this._organizeByDistribution(guestNames, perRoomGuests, rooms);
  }

  /**
   * Organize guest names that already have roomId property
   *
   * @private
   * @param {Array} guestNames - Guest names with roomId
   * @returns {Object} - Organized by room
   */
  static _organizeByExistingRoomId(guestNames) {
    const organized = {};

    guestNames.forEach((guest) => {
      const roomId = guest.roomId || 'unknown';
      if (!organized[roomId]) {
        organized[roomId] = [];
      }
      // Remove roomId from the guest object copy to keep clean structure
      const { roomId: _, ...guestWithoutRoomId } = guest;
      organized[roomId].push(guestWithoutRoomId);
    });

    return organized;
  }

  /**
   * Distribute guest names sequentially based on per-room guest counts
   *
   * @private
   * @param {Array} guestNames - Flat array of guest names
   * @param {Object} perRoomGuests - Per-room guest counts
   * @param {Array} rooms - Array of room IDs
   * @returns {Object} - Organized by room
   */
  static _organizeByDistribution(guestNames, perRoomGuests, rooms) {
    const organized = {};
    let currentIndex = 0;

    // Process rooms in order
    rooms.forEach((roomId) => {
      const roomGuests = perRoomGuests[roomId];
      if (!roomGuests) {
        organized[roomId] = [];
        return;
      }

      // Calculate total guests for this room
      const roomGuestCount =
        (roomGuests.adults || 0) + (roomGuests.children || 0) + (roomGuests.toddlers || 0);

      // Extract the appropriate number of names
      organized[roomId] = guestNames.slice(currentIndex, currentIndex + roomGuestCount);
      currentIndex += roomGuestCount;
    });

    return organized;
  }

  /**
   * Flatten room-organized guest names back to a flat array with roomId attached
   *
   * @param {Object} perRoomGuestNames - Guest names organized by room: { '12': [{...}], '13': [{...}] }
   * @returns {Array} - Flat array with roomId: [{personType, firstName, lastName, roomId}]
   *
   * @example
   * const perRoomGuestNames = {
   *   '12': [{personType: 'adult', firstName: 'Jan', lastName: 'Novák'}],
   *   '13': [{personType: 'adult', firstName: 'Petr', lastName: 'Svoboda'}]
   * };
   * const flattened = GuestNameUtils.flattenFromRooms(perRoomGuestNames);
   * // Result: [
   * //   {personType: 'adult', firstName: 'Jan', lastName: 'Novák', roomId: '12'},
   * //   {personType: 'adult', firstName: 'Petr', lastName: 'Svoboda', roomId: '13'}
   * // ]
   */
  static flattenFromRooms(perRoomGuestNames) {
    if (!perRoomGuestNames || typeof perRoomGuestNames !== 'object') {
      return [];
    }

    const flattened = [];

    // Iterate rooms in numerical order for consistency
    const sortedRoomIds = Object.keys(perRoomGuestNames).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA - numB;
    });

    sortedRoomIds.forEach((roomId) => {
      const guests = perRoomGuestNames[roomId];
      if (Array.isArray(guests)) {
        guests.forEach((guest) => {
          flattened.push({ ...guest, roomId });
        });
      }
    });

    return flattened;
  }

  /**
   * Format guest names for display grouped by room
   *
   * @param {Object} perRoomGuestNames - Guest names organized by room
   * @param {string} separator - Separator between names (default: ', ')
   * @param {boolean} includeRoomLabel - Include "Pokoj X:" label (default: true)
   * @returns {string} - Formatted string
   *
   * @example
   * const perRoomGuestNames = {
   *   '12': [{firstName: 'Jan', lastName: 'Novák'}],
   *   '13': [{firstName: 'Petr', lastName: 'Svoboda'}, {firstName: 'Marie', lastName: 'Svobodová'}]
   * };
   * const formatted = GuestNameUtils.formatForDisplay(perRoomGuestNames);
   * // Result: "Pokoj 12: Jan Novák\nPokoj 13: Petr Svoboda, Marie Svobodová"
   */
  static formatForDisplay(perRoomGuestNames, separator = ', ', includeRoomLabel = true) {
    if (!perRoomGuestNames || typeof perRoomGuestNames !== 'object') {
      return '';
    }

    const lines = [];

    // Sort room IDs numerically
    const sortedRoomIds = Object.keys(perRoomGuestNames).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA - numB;
    });

    sortedRoomIds.forEach((roomId) => {
      const guests = perRoomGuestNames[roomId];
      if (!Array.isArray(guests) || guests.length === 0) {
        return;
      }

      const guestNamesStr = guests
        .map((guest) => `${guest.firstName} ${guest.lastName}`)
        .join(separator);

      if (includeRoomLabel) {
        lines.push(`Pokoj ${roomId}: ${guestNamesStr}`);
      } else {
        lines.push(guestNamesStr);
      }
    });

    return lines.join('\n');
  }

  /**
   * Generate HTML display for guest names grouped by room
   *
   * @param {Object} perRoomGuestNames - Guest names organized by room
   * @param {Object} options - Display options
   * @param {boolean} options.showPersonType - Show person type badges (default: false)
   * @param {string} options.layout - 'list' or 'grid' (default: 'list')
   * @returns {string} - HTML string
   *
   * @example
   * const html = GuestNameUtils.renderHTML(perRoomGuestNames, {showPersonType: true, layout: 'list'});
   */
  static renderHTML(perRoomGuestNames, options = {}) {
    const { showPersonType = false, layout = 'list' } = options;

    if (!perRoomGuestNames || typeof perRoomGuestNames !== 'object') {
      return '<p>Žádná jména hostů</p>';
    }

    const sortedRoomIds = Object.keys(perRoomGuestNames).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA - numB;
    });

    if (sortedRoomIds.length === 0) {
      return '<p>Žádná jména hostů</p>';
    }

    let html = '';

    if (layout === 'grid') {
      html += '<div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem;">';
    }

    sortedRoomIds.forEach((roomId) => {
      const guests = perRoomGuestNames[roomId];
      if (!Array.isArray(guests) || guests.length === 0) {
        return;
      }

      // Room badge
      const roomBadge = `<span style="display: inline-block; padding: 0.3rem 0.6rem; background: #28a745; color: white; border-radius: 4px; font-weight: 600; font-size: 0.9rem;">P${roomId}</span>`;

      // Guest names list
      const guestsList = guests
        .map((guest) => {
          let name = `${guest.firstName} ${guest.lastName}`;

          if (showPersonType) {
            const badge = this._getPersonTypeBadge(guest.personType);
            name = `${badge} ${name}`;
          }

          return name;
        })
        .join(', ');

      if (layout === 'grid') {
        html += `<div>${roomBadge}</div><div>${guestsList}</div>`;
      } else {
        html += `<div style="margin-bottom: 0.5rem;"><strong>${roomBadge}</strong> ${guestsList}</div>`;
      }
    });

    if (layout === 'grid') {
      html += '</div>';
    }

    return html;
  }

  /**
   * Get person type badge HTML
   *
   * @private
   * @param {string} personType - 'adult', 'child', or 'toddler'
   * @returns {string} - Badge HTML
   */
  static _getPersonTypeBadge(personType) {
    const badges = {
      adult:
        '<span style="background: #007bff; color: white; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.75rem;">Dosp.</span>',
      child:
        '<span style="background: #ffc107; color: black; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.75rem;">Dítě</span>',
      toddler:
        '<span style="background: #fd7e14; color: white; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.75rem;">Bat.</span>',
    };

    return badges[personType] || '';
  }

  /**
   * Validate guest names structure and counts
   *
   * @param {Array} guestNames - Guest names array
   * @param {Object} perRoomGuests - Per-room guest counts
   * @returns {Object} - {valid: boolean, errors: string[]}
   *
   * @example
   * const validation = GuestNameUtils.validate(guestNames, perRoomGuests);
   * if (!validation.valid) {
   *   console.error('Validation errors:', validation.errors);
   * }
   */
  static validate(guestNames, perRoomGuests) {
    const errors = [];

    if (!guestNames || !Array.isArray(guestNames)) {
      errors.push('Guest names must be an array');
      return { valid: false, errors };
    }

    if (!perRoomGuests || typeof perRoomGuests !== 'object') {
      errors.push('Per-room guests data is missing');
      return { valid: false, errors };
    }

    // Calculate expected total
    let expectedTotal = 0;
    Object.values(perRoomGuests).forEach((roomGuests) => {
      expectedTotal +=
        (roomGuests.adults || 0) + (roomGuests.children || 0) + (roomGuests.toddlers || 0);
    });

    // Check if counts match
    if (guestNames.length !== expectedTotal) {
      errors.push(`Guest name count mismatch: expected ${expectedTotal}, got ${guestNames.length}`);
    }

    // Validate each guest name
    guestNames.forEach((guest, index) => {
      if (!guest.firstName || !guest.lastName) {
        errors.push(`Guest ${index + 1} missing firstName or lastName`);
      }

      if (!guest.personType || !['adult', 'child', 'toddler'].includes(guest.personType)) {
        errors.push(`Guest ${index + 1} has invalid personType: ${guest.personType}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GuestNameUtils;
}
