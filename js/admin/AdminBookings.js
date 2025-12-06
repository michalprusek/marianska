/**
 * Admin Bookings Module
 * Handles loading, filtering, and rendering the bookings table.
 */
class AdminBookings {
  constructor(adminPanel) {
    this.adminPanel = adminPanel; // Reference to main AdminPanel for callbacks/delegation
    this.isLoadingBookings = false;
    this.selectedBookings = new Set();
    this.editComponent = null;

    // Sorting state - load from localStorage or use defaults
    const savedSort = localStorage.getItem('adminBookingsSort');
    if (savedSort) {
      try {
        const { column, direction } = JSON.parse(savedSort);
        this.sortColumn = column || 'createdAt';
        this.sortDirection = direction || 'desc';
      } catch (error) {
        console.warn('[AdminBookings] Failed to parse saved sort preferences, using defaults:', error.message);
        this.sortColumn = 'createdAt';
        this.sortDirection = 'desc';
      }
    } else {
      this.sortColumn = 'createdAt';
      this.sortDirection = 'desc';
    }
  }

  // Defense-in-depth: HTML escaping helper
  escapeHtml(unsafe) {
    if (!unsafe) {
      return '';
    }
    return String(unsafe)
      .replace(/&/gu, '&amp;')
      .replace(/</gu, '&lt;')
      .replace(/>/gu, '&gt;')
      .replace(/"/gu, '&quot;')
      .replace(/'/gu, '&#039;');
  }

  // ========== SORTING METHODS ==========

  /**
   * Handle column header click for sorting
   * @param {string} column - Column key to sort by
   */
  handleSort(column) {
    if (this.sortColumn === column) {
      // Toggle direction if same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column - default to ascending
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    // Persist to localStorage
    localStorage.setItem(
      'adminBookingsSort',
      JSON.stringify({
        column: this.sortColumn,
        direction: this.sortDirection,
      })
    );

    // Reload with new sort
    this.loadBookings();
  }

  /**
   * Compare two bookings for sorting
   * @param {Object} a - First booking
   * @param {Object} b - Second booking
   * @param {string} column - Column to sort by
   * @param {string} direction - 'asc' or 'desc'
   * @returns {number} - Comparison result
   */
  compareBookings(a, b, column, direction) {
    let valA;
    let valB;

    switch (column) {
      case 'id':
        valA = a.id || '';
        valB = b.id || '';
        break;
      case 'name':
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
        return direction === 'asc'
          ? valA.localeCompare(valB, 'cs')
          : valB.localeCompare(valA, 'cs');
      case 'email':
        valA = (a.email || '').toLowerCase();
        valB = (b.email || '').toLowerCase();
        return direction === 'asc'
          ? valA.localeCompare(valB, 'cs')
          : valB.localeCompare(valA, 'cs');
      case 'payFromBenefit':
        valA = a.payFromBenefit ? 1 : 0;
        valB = b.payFromBenefit ? 1 : 0;
        break;
      case 'startDate': {
        // Get earliest start date from perRoomDates or fallback to booking.startDate
        const getStartDate = (booking) => {
          if (booking.perRoomDates && Object.keys(booking.perRoomDates).length > 0) {
            const dates = Object.values(booking.perRoomDates).map((d) => d.startDate);
            return Math.min(...dates.map((d) => new Date(d).getTime()));
          }
          return new Date(booking.startDate || 0).getTime();
        };
        valA = getStartDate(a);
        valB = getStartDate(b);
        break;
      }
      case 'rooms':
        // Sort by first room number
        valA = parseInt(a.rooms?.[0], 10) || 0;
        valB = parseInt(b.rooms?.[0], 10) || 0;
        break;
      case 'totalPrice':
        valA = a.totalPrice || 0;
        valB = b.totalPrice || 0;
        break;
      case 'paid':
        valA = a.paid ? 1 : 0;
        valB = b.paid ? 1 : 0;
        break;
      case 'createdAt':
      default:
        valA = new Date(a.createdAt || 0).getTime();
        valB = new Date(b.createdAt || 0).getTime();
        break;
    }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  }

  /**
   * Update sort indicators in table headers
   */
  updateSortIndicators() {
    // Remove all existing indicators
    document.querySelectorAll('#bookingsTable th .sort-indicator').forEach((el) => {
      el.textContent = '';
    });

    // Add indicator to current sort column
    const header = document.querySelector(`#bookingsTable th[data-sort="${this.sortColumn}"]`);
    if (header) {
      const indicator = header.querySelector('.sort-indicator');
      if (indicator) {
        indicator.textContent = this.sortDirection === 'asc' ? ' ▲' : ' ▼';
      }
    }
  }

  // ========== END SORTING METHODS ==========

  /**
   * Create an editable field with pencil icon for inline editing
   * @param {string} bookingId - Booking ID for API calls
   * @param {string} fieldName - Field name (e.g., 'name', 'email', 'phone')
   * @param {string} label - Display label
   * @param {string} value - Current value
   * @param {string} inputType - Input type (text, email, tel)
   * @returns {string} - HTML string
   */
  createEditableField(bookingId, fieldName, label, value, inputType = 'text') {
    const displayValue = this.escapeHtml(value) || '-';
    const escapedBookingId = this.escapeHtml(bookingId);
    const escapedFieldName = this.escapeHtml(fieldName);
    // SECURITY FIX: Escape all parameters to prevent XSS
    const escapedLabel = this.escapeHtml(label);
    const escapedInputType = this.escapeHtml(inputType);

    return `
      <div>
        <strong style="color: var(--gray-600); font-size: 0.9rem;">${escapedLabel}</strong>
        <div class="editable-field" data-booking-id="${escapedBookingId}" data-field="${escapedFieldName}" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
          <span class="field-value">${displayValue}</span>
          <button
            class="edit-field-btn"
            onclick="adminPanel.bookings.startInlineEdit(this.parentElement, '${escapedBookingId}', '${escapedFieldName}', '${escapedInputType}')"
            style="background: none; border: none; cursor: pointer; padding: 0.25rem; opacity: 0.6; transition: opacity 0.2s;"
            onmouseover="this.style.opacity='1'"
            onmouseout="this.style.opacity='0.6'"
            title="Upravit"
          >✏️</button>
        </div>
      </div>
    `;
  }

  /**
   * Create an editable checkbox field for boolean values
   * @param {string} bookingId - Booking ID
   * @param {string} fieldName - Field name in database
   * @param {string} label - Display label
   * @param {boolean} value - Current value
   * @param {string} labelOn - Label when checked
   * @param {string} labelOff - Label when unchecked
   */
  createEditableCheckbox(bookingId, fieldName, label, value, labelOn = 'Ano', labelOff = 'Ne') {
    const escapedBookingId = this.escapeHtml(bookingId);
    const escapedFieldName = this.escapeHtml(fieldName);
    // SECURITY FIX: Escape all label parameters to prevent XSS
    const escapedLabel = this.escapeHtml(label);
    const escapedLabelOn = this.escapeHtml(labelOn);
    const escapedLabelOff = this.escapeHtml(labelOff);
    const isChecked = value ? 'checked' : '';
    const displayLabel = value ? escapedLabelOn : escapedLabelOff;
    const badgeStyle = value
      ? 'background: #17a2b8; color: white;'
      : 'background: #e5e7eb; color: #6b7280;';

    return `
      <div>
        <strong style="color: var(--gray-600); font-size: 0.9rem;">${escapedLabel}</strong>
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-top: 0.25rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none;">
            <input
              type="checkbox"
              ${isChecked}
              onchange="adminPanel.bookings.toggleCheckboxField('${escapedBookingId}', '${escapedFieldName}', this.checked, this)"
              style="width: 18px; height: 18px; cursor: pointer; accent-color: #17a2b8;"
            />
            <span
              class="checkbox-label-badge"
              style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 4px; font-weight: 600; font-size: 0.9rem; ${badgeStyle}"
            >${displayLabel}</span>
          </label>
        </div>
      </div>
    `;
  }

  /**
   * Toggle a checkbox field and save to server
   * @param {string} bookingId - Booking ID
   * @param {string} fieldName - Field name
   * @param {boolean} newValue - New value
   * @param {HTMLInputElement} checkbox - The checkbox element
   */
  async toggleCheckboxField(bookingId, fieldName, newValue, checkbox) {
    const badge = checkbox.parentElement.querySelector('.checkbox-label-badge');
    const originalValue = !newValue;

    try {
      await this.saveInlineEdit(bookingId, fieldName, newValue);

      // Update badge appearance
      if (badge) {
        if (newValue) {
          badge.textContent = fieldName === 'payFromBenefit' ? 'Z benefitů' : 'Ano';
          badge.style.background = '#17a2b8';
          badge.style.color = 'white';
        } else {
          badge.textContent = 'Ne';
          badge.style.background = '#e5e7eb';
          badge.style.color = '#6b7280';
        }
      }

      this.adminPanel.showSuccessMessage('Pole úspěšně aktualizováno');

      // FIX 2025-12-06: Refresh booking list to reflect changes
      await this.loadBookings();
    } catch (error) {
      console.error('Error toggling checkbox field:', error);
      this.adminPanel.showErrorMessage(error.message || 'Chyba při ukládání');

      // Revert checkbox state
      checkbox.checked = originalValue;
    }
  }

  /**
   * Start inline editing of a field
   * @param {HTMLElement} container - The editable-field container
   * @param {string} bookingId - Booking ID
   * @param {string} fieldName - Field name
   * @param {string} inputType - Input type
   */
  startInlineEdit(container, bookingId, fieldName, inputType = 'text') {
    const valueSpan = container.querySelector('.field-value');
    const editBtn = container.querySelector('.edit-field-btn');
    const currentValue = valueSpan.textContent === '-' ? '' : valueSpan.textContent;

    // Track active edit on the modal
    const modal = container.closest('.modal');
    if (modal) {
      modal.dataset.hasUnsavedEdit = 'true';
    }

    // Hide original content
    valueSpan.style.display = 'none';
    editBtn.style.display = 'none';

    // Create input and buttons
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'inline-edit-wrapper';
    inputWrapper.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; flex: 1;';

    inputWrapper.innerHTML = `
      <input
        type="${inputType}"
        value="${this.escapeHtml(currentValue)}"
        class="inline-edit-input"
        style="flex: 1; padding: 0.375rem 0.5rem; border: 1px solid var(--primary-400); border-radius: 4px; font-size: 0.9rem; outline: none;"
      >
      <button
        class="save-btn"
        style="background: #10b981; color: white; border: none; border-radius: 4px; padding: 0.375rem 0.5rem; cursor: pointer; font-size: 0.85rem;"
        title="Uložit"
      >✓</button>
      <button
        class="cancel-btn"
        style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 0.375rem 0.5rem; cursor: pointer; font-size: 0.85rem;"
        title="Zrušit"
      >✕</button>
    `;

    container.appendChild(inputWrapper);

    const input = inputWrapper.querySelector('.inline-edit-input');
    const saveBtn = inputWrapper.querySelector('.save-btn');
    const cancelBtn = inputWrapper.querySelector('.cancel-btn');

    // Focus input
    input.focus();
    input.select();

    // Cancel handler
    const cancelEdit = () => {
      inputWrapper.remove();
      valueSpan.style.display = '';
      editBtn.style.display = '';
      // Clear unsaved edit flag
      if (modal) {
        delete modal.dataset.hasUnsavedEdit;
      }
    };

    // Save handler
    const saveEdit = async () => {
      const newValue = input.value.trim();

      // Don't save if unchanged
      if (newValue === currentValue) {
        cancelEdit();
        return;
      }

      // Show loading state
      saveBtn.textContent = '...';
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      input.disabled = true;

      try {
        await this.saveInlineEdit(bookingId, fieldName, newValue);

        // Update display
        valueSpan.textContent = newValue || '-';
        cancelEdit();

        // Show success notification
        this.adminPanel.showSuccessMessage('Pole úspěšně aktualizováno');
      } catch (error) {
        console.error('Error saving field:', error);
        this.adminPanel.showErrorMessage(error.message || 'Chyba při ukládání');

        // Re-enable buttons
        saveBtn.textContent = '✓';
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        input.disabled = false;
      }
    };

    // Event listeners
    saveBtn.addEventListener('click', saveEdit);
    cancelBtn.addEventListener('click', cancelEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
    });
  }

  /**
   * Close detail modal with unsaved changes confirmation
   * @param {HTMLElement} modal - The modal element to close
   */
  closeDetailModal(modal) {
    if (modal.dataset.hasUnsavedEdit === 'true') {
      const confirmed = window.confirm('Máte neuložené změny. Opravdu chcete zavřít okno?');
      if (!confirmed) {
        return;
      }
    }
    modal.remove();
  }

  /**
   * Validate field value based on field type
   * @param {string} fieldName - Field name
   * @param {string} value - Value to validate
   * @returns {{valid: boolean, error: string|null}} - Validation result
   */
  validateFieldValue(fieldName, value) {
    // Email validation
    if (fieldName === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
      if (value && !emailRegex.test(value)) {
        return { valid: false, error: 'Neplatný formát emailu' };
      }
    }

    // Phone validation (Czech format)
    if (fieldName === 'phone') {
      // Allow empty, or require 9+ digits (with optional +, spaces, dashes)
      const cleanPhone = value.replace(/[\s\-()]/gu, '');
      if (value && !/^\+?\d{9,15}$/u.test(cleanPhone)) {
        return { valid: false, error: 'Neplatný formát telefonu (min. 9 číslic)' };
      }
    }

    // Name validation
    if (fieldName === 'name') {
      if (value && value.length < 2) {
        return { valid: false, error: 'Jméno musí mít alespoň 2 znaky' };
      }
      if (value && value.length > 100) {
        return { valid: false, error: 'Jméno je příliš dlouhé (max. 100 znaků)' };
      }
    }

    // Note validation (prevent excessive length)
    if (fieldName === 'note' || fieldName === 'adminNote') {
      if (value && value.length > 1000) {
        return { valid: false, error: 'Poznámka je příliš dlouhá (max. 1000 znaků)' };
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Save inline edit to the server
   * @param {string} bookingId - Booking ID
   * @param {string} fieldName - Field name
   * @param {string} newValue - New value
   */
  async saveInlineEdit(bookingId, fieldName, newValue) {
    // SECURITY FIX: Client-side validation before sending to server
    const validation = this.validateFieldValue(fieldName, newValue);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const sessionToken = sessionStorage.getItem('adminSessionToken');

    if (!sessionToken) {
      throw new Error('Nejste přihlášeni - obnovte stránku a přihlaste se znovu');
    }

    const response = await fetch(`/api/booking/${bookingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
      },
      credentials: 'include',
      body: JSON.stringify({
        [fieldName]: newValue,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // If session expired, prompt to re-login
      if (response.status === 401) {
        throw new Error('Session vypršela - odhlaste se a znovu přihlaste');
      }
      throw new Error(errorData.error || errorData.details || 'Chyba při ukládání');
    }

    // Refresh data in cache
    await dataManager.syncWithServer(true);
  }

  // Helper function to create styled room badges
  createRoomBadge(roomId, inline = false) {
    return `<span style="
            display: ${inline ? 'inline-block' : 'inline-block'};
            margin: ${inline ? '0 0.25rem' : '0.25rem'};
            padding: 0.4rem 0.7rem;
            background: #28a745;
            color: white;
            border: 2px solid #1e7e34;
            border-radius: 6px;
            font-weight: 700;
            font-size: 0.95rem;
            box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        ">P${roomId}</span>`;
  }

  /**
   * Create room display - shows "Celá chata" for bulk bookings, individual badges otherwise
   * @param {Object} booking - Booking object with rooms array and isBulkBooking flag
   * @param {boolean} inline - Whether to use inline display
   * @returns {string} - HTML string
   */
  createRoomDisplay(booking, inline = false) {
    // FIX 2025-12-04: Only use explicit isBulkBooking flag, NOT room count
    // A booking with 9 rooms is NOT necessarily a bulk booking
    const isBulk = booking.isBulkBooking === true;

    if (isBulk) {
      return `<span style="
              display: inline-block;
              margin: ${inline ? '0 0.25rem' : '0.25rem'};
              padding: 0.4rem 0.7rem;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: 2px solid #5a67d8;
              border-radius: 6px;
              font-weight: 700;
              font-size: 0.95rem;
              box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
              text-shadow: 0 1px 2px rgba(0,0,0,0.2);
          ">🏠 Celá chata</span>`;
    }

    // Regular booking - show individual room badges
    return booking.rooms.map((roomId) => this.createRoomBadge(roomId, inline)).join('');
  }

  /**
   * FIX 2025-12-02: Format guest type display with breakdown for bulk bookings
   * @param {Object} booking - Booking object with guestType and guestTypeBreakdown
   * @returns {string} - Formatted guest type display
   */
  formatGuestTypeDisplay(booking) {
    // Check if we have a breakdown (mixed ÚTIA/external bulk booking)
    const breakdown = booking.guestTypeBreakdown;
    if (
      breakdown &&
      (breakdown.utiaAdults > 0 || breakdown.utiaChildren > 0) &&
      (breakdown.externalAdults > 0 || breakdown.externalChildren > 0)
    ) {
      // Mixed booking - show both types
      const utiaTotal = (breakdown.utiaAdults || 0) + (breakdown.utiaChildren || 0);
      const externalTotal = (breakdown.externalAdults || 0) + (breakdown.externalChildren || 0);

      const parts = [];
      if (utiaTotal > 0) {
        parts.push(`<span style="color: #059669; font-weight: 600;">ÚTIA: ${utiaTotal}</span>`);
      }
      if (externalTotal > 0) {
        parts.push(
          `<span style="color: #dc2626; font-weight: 600;">Externí: ${externalTotal}</span>`
        );
      }
      return parts.join(' / ');
    }

    // Only one type - show as before
    if (breakdown && (breakdown.utiaAdults > 0 || breakdown.utiaChildren > 0)) {
      return '<span style="color: #059669; font-weight: 600;">Zaměstnanec ÚTIA</span>';
    }

    // Fallback to single guestType field
    return booking.guestType === 'utia'
      ? '<span style="color: #059669; font-weight: 600;">Zaměstnanec ÚTIA</span>'
      : '<span style="color: #dc2626; font-weight: 600;">Externí host</span>';
  }

  /**
   * Render guest names organized by room
   * @param {Object} booking - Booking object with guestNames and rooms
   * @returns {string} - HTML string
   */
  renderGuestNamesByRoom(booking) {
    if (!booking.guestNames || booking.guestNames.length === 0) {
      return '<p style="color: #9ca3af;">Žádná jména hostů</p>';
    }

    // Use GuestNameUtils to organize names by room
    const perRoomGuests = booking.perRoomGuests || {};
    const rooms = booking.rooms || [];

    // Organize guest names by room
    const perRoomGuestNames =
      typeof GuestNameUtils === 'undefined'
        ? null
        : GuestNameUtils.organizeByRoom(booking.guestNames, perRoomGuests, rooms); // eslint-disable-line no-undef

    // If we have per-room organization AND multiple rooms, display by room
    // BUT for bulk bookings (whole cabin), show all guests in one list instead
    if (
      perRoomGuestNames &&
      Object.keys(perRoomGuestNames).length > 0 &&
      rooms.length > 1 &&
      !booking.isBulkBooking
    ) {
      let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';

      // Sort room IDs numerically
      const sortedRoomIds = Object.keys(perRoomGuestNames).sort(
        (a, b) => parseInt(a, 10) - parseInt(b, 10)
      );

      sortedRoomIds.forEach((roomId) => {
        const guests = perRoomGuestNames[roomId];
        if (!Array.isArray(guests) || guests.length === 0) {
          return;
        }

        html += `
          <div style="border-left: 3px solid #28a745; padding-left: 0.75rem;">
            <div style="font-weight: 600; color: #4b5563; font-size: 0.9rem; margin-bottom: 0.5rem;">
              ${this.createRoomBadge(roomId, true)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
        `;

        // Group by person type within the room
        const adults = guests.filter((g) => g.personType === 'adult');
        const children = guests.filter((g) => g.personType === 'child');
        const toddlers = guests.filter((g) => g.personType === 'toddler');

        if (adults.length > 0) {
          html += `<div style="color: #6b7280; font-size: 0.85rem; margin-top: 0.25rem;"><strong>Dospělí:</strong> ${adults
            .map((g) => `${this.escapeHtml(g.firstName)} ${this.escapeHtml(g.lastName)}`)
            .join(', ')}</div>`;
        }

        if (children.length > 0) {
          html += `<div style="color: #6b7280; font-size: 0.85rem; margin-top: 0.25rem;"><strong>Děti:</strong> ${children
            .map((g) => `${this.escapeHtml(g.firstName)} ${this.escapeHtml(g.lastName)}`)
            .join(', ')}</div>`;
        }

        if (toddlers.length > 0) {
          html += `<div style="color: #6b7280; font-size: 0.85rem; margin-top: 0.25rem;"><strong>Batolata:</strong> ${toddlers
            .map((g) => `${this.escapeHtml(g.firstName)} ${this.escapeHtml(g.lastName)}`)
            .join(', ')}</div>`;
        }

        html += `
            </div>
          </div>
        `;
      });

      html += '</div>';
      return html;
    }

    // Single room or bulk booking: display by person type only (no per-room breakdown needed)
    let html = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">';

    const adults = booking.guestNames.filter((g) => g.personType === 'adult');
    const children = booking.guestNames.filter((g) => g.personType === 'child');
    const toddlers = booking.guestNames.filter((g) => g.personType === 'toddler');

    if (adults.length > 0) {
      html += `
        <div>
          <div style="font-weight: 600; color: #4b5563; font-size: 0.85rem; margin-bottom: 0.5rem;">Dospělí:</div>
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${adults
              .map(
                (guest) =>
                  `<div style="color: #6b7280; font-size: 0.9rem;">${this.escapeHtml(guest.firstName)} ${this.escapeHtml(guest.lastName)}</div>`
              )
              .join('')}
          </div>
        </div>
      `;
    }

    if (children.length > 0) {
      html += `
        <div>
          <div style="font-weight: 600; color: #4b5563; font-size: 0.85rem; margin-bottom: 0.5rem;">Děti:</div>
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${children
              .map(
                (guest) =>
                  `<div style="color: #6b7280; font-size: 0.9rem;">${this.escapeHtml(guest.firstName)} ${this.escapeHtml(guest.lastName)}</div>`
              )
              .join('')}
          </div>
        </div>
      `;
    }

    if (toddlers.length > 0) {
      html += `
        <div>
          <div style="font-weight: 600; color: #4b5563; font-size: 0.85rem; margin-bottom: 0.5rem;">Batolata:</div>
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${toddlers
              .map(
                (guest) =>
                  `<div style="color: #6b7280; font-size: 0.9rem;">${this.escapeHtml(guest.firstName)} ${this.escapeHtml(guest.lastName)}</div>`
              )
              .join('')}
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  async loadBookings() {
    // Mutex: prevent concurrent calls that cause duplicate rows
    if (this.isLoadingBookings) {
      return;
    }
    this.isLoadingBookings = true;

    try {
      const bookings = await dataManager.getAllBookings();
      const settings = await dataManager.getSettings(); // SSOT FIX 2025-12-04: Fetch current settings
      const tbody = document.getElementById('bookingsTableBody');

      if (!tbody) {
        return;
      }

      tbody.innerHTML = '';

      // Dynamic sorting based on selected column and direction
      bookings.sort((a, b) => this.compareBookings(a, b, this.sortColumn, this.sortDirection));

      // SSOT FIX 2025-12-04: Always recalculate prices using current settings (SSOT)
      // This ensures list view shows the same price as edit view
      const bookingPrices = new Map();
      bookings.forEach((booking) => {
        bookingPrices.set(booking.id, this.getBookingPrice(booking, settings));
      });

      // Process bookings to create table rows
      for (const booking of bookings) {
        // Format date range display
        let dateRangeDisplay = '';

        if (booking.perRoomDates && Object.keys(booking.perRoomDates).length > 0) {
          // Calculate overall range from per-room dates
          let minStart = booking.startDate;
          let maxEnd = booking.endDate;

          Object.values(booking.perRoomDates).forEach((dates) => {
            if (!minStart || dates.startDate < minStart) {
              minStart = dates.startDate;
            }
            if (!maxEnd || dates.endDate > maxEnd) {
              maxEnd = dates.endDate;
            }
          });

          dateRangeDisplay = `${new Date(minStart).toLocaleDateString('cs-CZ')} - ${new Date(maxEnd).toLocaleDateString('cs-CZ')}`;
        } else {
          // Fallback to booking-level dates
          dateRangeDisplay = `${new Date(booking.startDate).toLocaleDateString('cs-CZ')} - ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}`;
        }

        const row = document.createElement('tr');
        row.setAttribute('data-booking-id', booking.id);
        row.innerHTML = `
                <td style="text-align: center;">
                    <input
                        type="checkbox"
                        class="booking-checkbox"
                        data-booking-id="${booking.id}"
                        style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary-color);"
                        onchange="adminPanel.toggleBookingSelection('${booking.id}', this.checked)"
                    />
                </td>
                <td>${this.escapeHtml(booking.id)}</td>
                <td>${this.escapeHtml(booking.name)}</td>
                <td>${this.escapeHtml(booking.email)}</td>
                <td style="text-align: center;">
                    ${booking.payFromBenefit ? '<span style="display: inline-flex; align-items: center; justify-content: center; padding: 0.3rem 0.6rem; background: #17a2b8; color: white; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">💳 Ano</span>' : '<span style="color: #6b7280; font-size: 0.85rem;">Ne</span>'}
                </td>
                <td>${dateRangeDisplay}</td>
                <td>${this.createRoomDisplay(booking, true)}</td>
                <td>
                    ${bookingPrices.get(booking.id).toLocaleString('cs-CZ')} Kč
                </td>
                <td style="text-align: center;">
                    <label style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer; user-select: none;">
                        <input
                            type="checkbox"
                            ${booking.paid ? 'checked' : ''}
                            onchange="adminPanel.togglePaidStatus('${booking.id}', this.checked)"
                            style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--success-color);"
                        />
                        <span style="font-weight: 600; color: ${booking.paid ? '#10b981' : '#ef4444'}; font-size: 0.85rem;">
                            ${booking.paid ? '✓ Ano' : '✗ Ne'}
                        </span>
                    </label>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-modern btn-view" onclick="adminPanel.bookings.viewBookingDetails('${booking.id}')" title="Zobrazit detail">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            Detail
                        </button>
                        <button class="btn-modern btn-edit" onclick="adminPanel.bookings.editBooking('${booking.id}')" title="Upravit rezervaci">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Upravit
                        </button>
                        <button class="btn-modern btn-delete" onclick="adminPanel.bookings.deleteBooking('${booking.id}')" title="Smazat rezervaci">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                            Smazat
                        </button>
                    </div>
                </td>
            `;
        tbody.appendChild(row);
      }

      // Reset selection state
      this.selectedBookings.clear();
      this.updateBulkActionsUI();

      // Update sort indicators in table headers
      this.updateSortIndicators();
    } finally {
      this.isLoadingBookings = false;
    }
  }

  /**
   * FIXED 2025-12-04: Calculate price from current settings (SSOT).
   *
   * Admin panel should ALWAYS show prices calculated from current price settings.
   * The stored booking.totalPrice is historical - what was charged at booking time.
   *
   * @param {Object} booking - Booking object
   * @param {Object} settings - Current settings with prices
   * @returns {number} Recalculated price from current settings
   */
  getBookingPrice(booking, settings) {
    if (!settings || !settings.prices) {
      // Fallback to stored price if settings not available
      return booking.totalPrice || 0;
    }

    try {
      if (booking.isBulkBooking) {
        // Bulk booking - use bulk pricing
        // FIX 2025-12-06: Derive guestTypeBreakdown from guestNames (SSOT)
        const guestNames = booking.guestNames || [];
        const derivedBreakdown = {
          utiaAdults: guestNames.filter(
            (g) => g.personType === 'adult' && g.guestPriceType === 'utia'
          ).length,
          externalAdults: guestNames.filter(
            (g) => g.personType === 'adult' && g.guestPriceType === 'external'
          ).length,
          utiaChildren: guestNames.filter(
            (g) => g.personType === 'child' && g.guestPriceType === 'utia'
          ).length,
          externalChildren: guestNames.filter(
            (g) => g.personType === 'child' && g.guestPriceType === 'external'
          ).length,
        };

        return PriceCalculator.calculateMixedBulkPrice({
          utiaAdults: derivedBreakdown.utiaAdults,
          externalAdults: derivedBreakdown.externalAdults,
          utiaChildren: derivedBreakdown.utiaChildren,
          externalChildren: derivedBreakdown.externalChildren,
          nights: this.calculateNights(booking),
          settings,
        });
      }

      // FIX 2025-12-05: For composite bookings, sum up prices of individual rooms
      // Each room is calculated separately with its own dates and guest types
      if (booking.rooms && booking.rooms.length > 1 && booking.perRoomDates) {
        let totalPrice = 0;
        for (const roomId of booking.rooms) {
          const roomGuestNames = (booking.guestNames || []).filter(
            (g) => String(g.roomId) === String(roomId)
          );
          const roomDates = booking.perRoomDates[roomId];
          const nights = roomDates
            ? Math.ceil(
                (new Date(roomDates.endDate) - new Date(roomDates.startDate)) /
                  (1000 * 60 * 60 * 24)
              )
            : this.calculateNights(booking);

          // Determine guest type from guests in this room
          const hasUtiaGuest = roomGuestNames.some(
            (g) => g.guestPriceType === 'utia' && g.personType !== 'toddler'
          );
          const roomGuestType = hasUtiaGuest ? 'utia' : 'external';

          const roomPrice = PriceCalculator.calculatePerGuestPrice({
            rooms: [roomId],
            guestNames: roomGuestNames,
            nights,
            settings,
            fallbackGuestType: roomGuestType,
          });
          totalPrice += roomPrice;
        }
        return totalPrice;
      }

      // Single room booking - use per-guest pricing if available
      if (booking.guestNames && booking.guestNames.length > 0) {
        return PriceCalculator.calculatePerGuestPrice({
          rooms: booking.rooms || [],
          guestNames: booking.guestNames,
          perRoomDates: booking.perRoomDates || null,
          perRoomGuests: booking.perRoomGuests || {},
          nights: this.calculateNights(booking),
          settings,
          fallbackGuestType: booking.guestType || 'external',
        });
      }
      // Fallback to simple calculation
      return PriceCalculator.calculatePrice({
        guestType: booking.guestType || 'external',
        adults: booking.adults || 0,
        children: booking.children || 0,
        toddlers: booking.toddlers || 0,
        nights: this.calculateNights(booking),
        rooms: booking.rooms || [],
        settings,
      });
    } catch (error) {
      console.error('[AdminBookings] Error calculating price:', error);
      // Fallback to stored price on error
      return booking.totalPrice || 0;
    }
  }

  /**
   * Calculate number of nights for a booking
   * @param {Object} booking - Booking object
   * @returns {number} Number of nights
   */
  calculateNights(booking) {
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  }

  filterBookings(searchTerm) {
    const rows = document.querySelectorAll('#bookingsTableBody tr');
    const term = searchTerm.toLowerCase();

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      const displayRow = row;
      displayRow.style.display = text.includes(term) ? '' : 'none';
    });
  }

  async viewBookingDetails(bookingId) {
    const booking = await dataManager.getBooking(bookingId);
    if (!booking) {
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <button class="modal-close" onclick="adminPanel.bookings.closeDetailModal(this.closest('.modal'))">&times;</button>
                <h2 style="margin-right: 3rem; word-break: break-all;">Detail rezervace<br><span style="font-size: 0.8em; color: var(--gray-600);">${booking.id}</span></h2>

                ${
                  booking.isBulkBooking
                    ? (() => {
                        const createdAt = new Date(booking.createdAt || booking.created_at);
                        const startDate = new Date(booking.startDate || booking.start_date);
                        const msPerDay = 1000 * 60 * 60 * 24;
                        const daysAhead = Math.floor((startDate - createdAt) / msPerDay);
                        const isLessThan3Months = daysAhead < 90;

                        return isLessThan3Months
                          ? `<div style="background: #fef3c7; color: #92400e; padding: 0.75rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #d97706;">
                              <strong>⚠️ Hromadná akce</strong> - Vytvořeno ${daysAhead} dní předem (doporučeno min. 90 dní)
                             </div>`
                          : `<div style="background: #d1fae5; color: #065f46; padding: 0.75rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #10b981;">
                              <strong>✓ Hromadná akce</strong> - Vytvořeno ${daysAhead} dní předem
                             </div>`;
                      })()
                    : ''
                }

                <div style="display: grid; gap: 1.5rem; margin-top: 1.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        ${this.createEditableField(booking.id, 'name', 'Jméno a příjmení:', booking.name, 'text')}
                        ${this.createEditableField(booking.id, 'email', 'Email:', booking.email, 'email')}
                        ${this.createEditableField(booking.id, 'phone', 'Telefon:', booking.phone, 'tel')}
                        ${this.createEditableField(booking.id, 'company', 'Firma:', booking.company, 'text')}
                        ${this.createEditableField(booking.id, 'ico', 'IČO:', booking.ico, 'text')}
                        ${this.createEditableField(booking.id, 'dic', 'DIČ:', booking.dic, 'text')}
                        ${this.createEditableCheckbox(booking.id, 'payFromBenefit', 'Platba benefitem:', booking.payFromBenefit, 'Z benefitů', 'Ne')}
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                        ${this.createEditableField(booking.id, 'address', 'Adresa:', booking.address, 'text')}
                        ${this.createEditableField(booking.id, 'city', 'Město:', booking.city, 'text')}
                        ${this.createEditableField(booking.id, 'zip', 'PSČ:', booking.zip, 'text')}
                    </div>

                    <div>
                        <strong style="color: var(--gray-600); font-size: 0.9rem;">Termín a pokoje:</strong>
                        <div style="margin-top: 0.5rem;">
                            ${
                              // FIX 2025-12-04: Only use explicit isBulkBooking flag
                              booking.isBulkBooking === true
                                ? `
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
                              <span style="color: #4b5563;">
                                ${new Date(booking.startDate).toLocaleDateString('cs-CZ')} - ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}
                              </span>
                              <span style="color: #9ca3af;">•</span>
                              ${this.createRoomDisplay(booking, true)}
                            </div>
                          `
                                : booking.perRoomDates &&
                                    Object.keys(booking.perRoomDates).length > 0
                                  ? booking.rooms
                                      .map((roomId) => {
                                        const dates = booking.perRoomDates[roomId];
                                        if (dates) {
                                          return `
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                      ${this.createRoomBadge(roomId, true)}
                                      <span style="color: #4b5563;">
                                        ${new Date(dates.startDate).toLocaleDateString('cs-CZ')} - ${new Date(dates.endDate).toLocaleDateString('cs-CZ')}
                                      </span>
                                    </div>
                                  `;
                                        }
                                        return `
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                      ${this.createRoomBadge(roomId, true)}
                                      <span style="color: #4b5563;">
                                        ${new Date(booking.startDate).toLocaleDateString('cs-CZ')} - ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}
                                      </span>
                                    </div>
                                  `;
                                      })
                                      .join('')
                                  : `
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
                              <span style="color: #4b5563;">
                                ${new Date(booking.startDate).toLocaleDateString('cs-CZ')} - ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}
                              </span>
                              <span style="color: #9ca3af;">•</span>
                              ${this.createRoomDisplay(booking, true)}
                            </div>
                          `
                            }
                        </div>
                    </div>

                    <div>
                        <strong style="color: var(--gray-600); font-size: 0.9rem;">Hosté:</strong>
                        <div style="margin-top: 0.75rem;">
                            ${
                              // FIX 2025-12-04: Only use explicit isBulkBooking flag
                              booking.isBulkBooking === true
                                ? `
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                              ${this.createRoomDisplay(booking, true)}
                              <span style="color: #4b5563;">
                                ${booking.adults} dosp., ${booking.children} děti, ${booking.toddlers || 0} bat.
                                <span style="color: #9ca3af; margin: 0 0.5rem;">•</span>
                                ${this.formatGuestTypeDisplay(booking)}
                              </span>
                            </div>
                          `
                                : booking.perRoomGuests &&
                                    Object.keys(booking.perRoomGuests).length > 0
                                  ? booking.rooms
                                      .map((roomId) => {
                                        const guests = booking.perRoomGuests[roomId];
                                        if (guests) {
                                          // Skip rooms with no guests (0 adults AND 0 children)
                                          const hasGuests =
                                            guests.adults > 0 || guests.children > 0;
                                          if (!hasGuests) {
                                            return ''; // Don't display empty rooms
                                          }

                                          const guestType = guests.guestType || booking.guestType;
                                          return `
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                      ${this.createRoomBadge(roomId, true)}
                                      <span style="color: #4b5563;">
                                        ${guests.adults} dosp., ${guests.children} děti, ${guests.toddlers} bat.
                                        <span style="color: #9ca3af; margin: 0 0.5rem;">•</span>
                                        ${guestType === 'utia' ? 'ÚTIA' : 'Externí'}
                                      </span>
                                    </div>
                                  `;
                                        }
                                        return `
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                      ${this.createRoomBadge(roomId, true)}
                                      <span style="color: #9ca3af; font-size: 0.85rem;">Bez údajů</span>
                                    </div>
                                  `;
                                      })
                                      .join('')
                                  : `
                            <div style="color: #ef4444; font-size: 0.85rem;">
                              ⚠️ Chybí údaje o hostech v pokojích (celkem: ${booking.adults} dosp., ${booking.children} děti, ${booking.toddlers} bat.)
                            </div>
                          `
                            }
                            <!-- Show totals in gray for reference (only for non-bulk with perRoomGuests) -->
                            ${
                              // FIX 2025-12-04: Only use explicit isBulkBooking flag
                              booking.isBulkBooking !== true &&
                              booking.perRoomGuests &&
                              Object.keys(booking.perRoomGuests).length > 0
                                ? `
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 0.85rem;">
                              Celkem: ${booking.adults} dosp., ${booking.children} děti, ${booking.toddlers} bat.
                            </div>
                          `
                                : ''
                            }
                        </div>
                    </div>

                    ${
                      booking.guestNames && booking.guestNames.length > 0
                        ? `
                    <div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Jména hostů (podle pokojů):</strong>
                            <button
                                onclick="adminPanel.bookings.copyGuestNames('${booking.id}')"
                                style="padding: 0.4rem 0.8rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 0.4rem;"
                                onmouseover="this.style.background='#059669'"
                                onmouseout="this.style.background='#10b981'"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                                </svg>
                                Kopírovat
                            </button>
                        </div>
                        ${this.renderGuestNamesByRoom(booking)}
                    </div>
                    `
                        : ''
                    }

                    <!-- FIXED 2025-12-04: Always show price breakdown with recalculated prices from current settings -->
                    <div style="margin-bottom: 1rem;">
                        ${await this.generatePerRoomPriceBreakdown(booking)}
                    </div>

                    ${
                      booking.notes
                        ? `
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Poznámky:</strong>
                            <div style="margin-top: 0.25rem; padding: 0.75rem; background: var(--gray-50); border-radius: var(--radius-sm); white-space: pre-wrap;">
                                ${this.escapeHtml(booking.notes)}
                            </div>
                        </div>
                    `
                        : ''
                    }

                    <div style="padding-top: 1rem; border-top: 1px solid var(--gray-200);">
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; font-size: 0.85rem; color: var(--gray-500);">
                            <div>
                                <strong>Vytvořeno:</strong> ${new Date(booking.createdAt).toLocaleString('cs-CZ')}
                            </div>
                            ${
                              booking.updatedAt
                                ? `
                                <div>
                                    <strong>Upraveno:</strong> ${new Date(booking.updatedAt).toLocaleString('cs-CZ')}
                                </div>
                            `
                                : ''
                            }
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Zavřít</button>
                    <button class="btn btn-primary" onclick="adminPanel.bookings.editBooking('${booking.id}'); this.closest('.modal').remove()">Upravit rezervaci</button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
  }

  async editBooking(bookingId) {
    try {
      // Force fresh data from server (bypass cache)
      await dataManager.syncWithServer(true);

      const booking = await dataManager.getBooking(bookingId);
      if (!booking) {
        this.adminPanel.showErrorMessage('Rezervace nebyla nalezena. Zkuste obnovit stránku.');
        return;
      }

      // Store booking for reference
      this.adminPanel.currentEditBooking = booking;

      // Get settings
      const settings = await dataManager.getSettings();

      // NEW: Detect booking type and route to appropriate modal
      const isBulk = booking.isBulkBooking === true;
      const isSingleRoom = !isBulk && booking.rooms?.length === 1;
      const isMultiRoom = !isBulk && booking.rooms?.length > 1;

      if (isBulk) {
        // Route to bulk booking modal in edit mode
        await this.openBulkEditModal(booking, settings);
        return;
      }

      if (isSingleRoom) {
        // Route to single room booking modal in edit mode
        await this.openSingleRoomEditModal(booking, booking.rooms[0], settings);
        return;
      }

      if (isMultiRoom) {
        // Route to room selector modal - user chooses which room to edit
        await this.openRoomSelectorModal(booking, settings);
        return;
      }

      // Fallback: No rooms in booking (shouldn't happen, but handle gracefully)
      if (booking.rooms?.length > 0) {
        await this.openSingleRoomEditModal(booking, booking.rooms[0], settings);
        return;
      }

      // Ultimate fallback: Original EditBookingComponent logic
      this.openLegacyEditModal(booking, settings);
    } catch (error) {
      console.error('Error loading booking for edit:', error);
      this.adminPanel.showErrorMessage(
        error.message || 'Chyba při načítání rezervace. Zkuste obnovit stránku.'
      );
    }
  }

  /**
   * Check if a booking is composite (different dates for different rooms)
   * @param {Object} booking - Booking object
   * @returns {boolean} - True if rooms have different date ranges
   */
  isCompositeBooking(booking) {
    if (!booking.perRoomDates || Object.keys(booking.perRoomDates).length <= 1) {
      return false;
    }

    const dates = Object.values(booking.perRoomDates);
    const firstStart = dates[0]?.startDate;
    const firstEnd = dates[0]?.endDate;

    return dates.some((d) => d.startDate !== firstStart || d.endDate !== firstEnd);
  }

  /**
   * Open bulk booking modal in admin edit mode
   * @param {Object} booking - Booking data
   * @param {Object} settings - Application settings
   */
  async openBulkEditModal(booking, settings) {
    // Store context for admin edit
    this.adminEditContext = {
      booking,
      settings,
      isAdminEdit: true,
    };

    // Get the BulkBookingModule from the main app
    const bulkModule = window.app?.bulkBooking;
    if (!bulkModule) {
      this.adminPanel.showErrorMessage('Chyba: Modul hromadné rezervace není dostupný.');
      return;
    }

    // Open bulk modal with admin edit callbacks
    await bulkModule.openForAdminEdit(booking, {
      onSubmit: (formData) => this.handleAdminBulkEditSubmit(formData),
      onCancel: () => this.closeAdminEditModal(),
      onDelete: () => this.handleEditBookingDelete(booking.id),
    });
  }

  /**
   * Open single room booking modal in admin edit mode
   * @param {Object} booking - Full booking data
   * @param {string} roomId - Room ID to edit
   * @param {Object} settings - Application settings
   */
  async openSingleRoomEditModal(booking, roomId, settings) {
    // Store context for admin edit
    this.adminEditContext = {
      booking,
      roomId,
      settings,
      isAdminEdit: true,
    };

    // Get the SingleRoomBookingModule from the main app
    const singleRoomModule = window.app?.singleRoomBooking;
    if (!singleRoomModule) {
      this.adminPanel.showErrorMessage('Chyba: Modul rezervace pokoje není dostupný.');
      return;
    }

    // Open single room modal with admin edit callbacks
    await singleRoomModule.openForAdminEdit(booking, roomId, {
      onSubmit: (formData) => this.handleAdminSingleRoomEditSubmit(formData, roomId),
      onCancel: () => this.closeAdminEditModal(),
      onDelete: () => this.handleEditBookingDelete(booking.id),
    });
  }

  /**
   * Open room selector modal for multi-room bookings
   * Shows all rooms with their dates and lets admin choose which to edit
   * @param {Object} booking - Booking data
   * @param {Object} settings - Application settings
   */
  async openRoomSelectorModal(booking, settings) {
    // Store context
    this.adminEditContext = {
      booking,
      settings,
      isAdminEdit: true,
    };

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

      // Get room info
      const room = settings.rooms?.find((r) => r.id === roomId);
      const roomName = room?.name || `Pokoj ${roomId}`;

      // Calculate nights
      const startDate = new Date(roomDates.startDate);
      const endDate = new Date(roomDates.endDate);
      const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

      // Format dates
      const startStr = startDate.toLocaleDateString('cs-CZ');
      const endStr = endDate.toLocaleDateString('cs-CZ');

      // Guest summary
      const guestParts = [];
      if (roomGuests.adults > 0) {
        guestParts.push(`${roomGuests.adults} dosp.`);
      }
      if (roomGuests.children > 0) {
        guestParts.push(`${roomGuests.children} děti`);
      }
      if (roomGuests.toddlers > 0) {
        guestParts.push(`${roomGuests.toddlers} bat.`);
      }
      const guestStr = guestParts.join(', ') || 'Bez hostů';

      // Calculate room price
      let roomPrice = 0;
      try {
        const roomGuestNames = (booking.guestNames || []).filter(
          (g) => String(g.roomId) === String(roomId)
        );
        // FIX 2025-12-05: Determine guest type from actual guests in this room
        // If any paying guest is ÚTIA, use ÚTIA rate; otherwise External
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
      const priceStr = roomPrice > 0 ? `${roomPrice.toLocaleString('cs-CZ')} Kč` : '';

      roomsHTML += `
                <div class="room-selector-card"
                     onclick="adminPanel.bookings.editSelectedRoom('${roomId}')"
                     style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 1rem 1.25rem;
                        background: white;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        margin-bottom: 0.75rem;
                        cursor: pointer;
                        transition: all 0.2s ease;
                     "
                     onmouseover="this.style.borderColor='#0d9488'; this.style.background='#f0fdfa';"
                     onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='white';">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        ${this.createRoomBadge(roomId, true)}
                        <div>
                            <div style="font-weight: 600; color: #1f2937;">${startStr} - ${endStr}</div>
                            <div style="font-size: 0.875rem; color: #6b7280;">${nights} ${nights === 1 ? 'noc' : nights < 5 ? 'noci' : 'nocí'} • ${guestStr}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        ${priceStr ? `<div style="font-weight: 600; color: #059669; font-size: 1rem;">${priceStr}</div>` : ''}
                        <div style="color: #0d9488; font-size: 1.25rem;">→</div>
                    </div>
                </div>
            `;
    }

    // Create or get the modal
    let modal = document.getElementById('roomSelectorModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'roomSelectorModal';
      modal.className = 'modal';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <button class="modal-close" onclick="adminPanel.bookings.closeRoomSelector()">×</button>
                <h2 style="margin-bottom: 0.5rem;">📅 Vyberte pokoj k úpravě</h2>
                <p style="color: #6b7280; margin-bottom: 1.5rem;">
                    Tato rezervace obsahuje více pokojů. Vyberte pokoj, který chcete upravit.
                </p>
                
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: #fef3c7; border-radius: 8px; border-left: 4px solid #d97706;">
                    <strong style="color: #92400e;">Kontakt:</strong>
                    <span style="color: #78350f;">${this.escapeHtml(booking.name)} (${this.escapeHtml(booking.email)})</span>
                </div>

                <div id="compositeRoomsList">
                    ${roomsHTML}
                </div>

                <div class="modal-actions" style="margin-top: 1.5rem; display: flex; justify-content: space-between;">
                    <button class="btn btn-danger" onclick="adminPanel.bookings.confirmDeleteFromSelector('${booking.id}')"
                            style="background: #dc2626; color: white;">
                        🗑️ Smazat celou rezervaci
                    </button>
                    <button class="btn btn-secondary" onclick="adminPanel.bookings.closeRoomSelector()">
                        Zavřít
                    </button>
                </div>
            </div>
        `;

    modal.classList.add('active');
  }

  /**
   * Edit a specific room from multi-room booking
   * @param {string} roomId - Room ID to edit
   */
  async editSelectedRoom(roomId) {
    const { booking, settings } = this.adminEditContext || {};
    if (!booking) {
      this.adminPanel.showErrorMessage('Chyba: Kontext editace není dostupný.');
      return;
    }

    // Close the room selector
    this.closeRoomSelector();

    // Open single room edit modal for this room
    await this.openSingleRoomEditModal(booking, roomId, settings);
  }

  /**
   * Close room selector modal
   */
  closeRoomSelector() {
    const modal = document.getElementById('roomSelectorModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  /**
   * Confirm delete booking from room selector modal
   * @param {string} bookingId - Booking ID to delete
   */
  confirmDeleteFromSelector(bookingId) {
    this.closeRoomSelector();
    this.deleteBooking(bookingId);
  }

  /**
   * Close any admin edit modal
   */
  closeAdminEditModal() {
    // Close room selector if open
    this.closeRoomSelector();

    // Close bulk modal if open
    const bulkModal = document.getElementById('bulkBookingModal');
    if (bulkModal) {
      bulkModal.classList.remove('active');
    }

    // Close single room modal if open
    const singleRoomModal = document.getElementById('singleRoomBookingModal');
    if (singleRoomModal) {
      singleRoomModal.classList.remove('active');
    }

    // Clear context
    this.adminEditContext = null;
  }

  /**
   * Handle submit from admin bulk edit modal
   * @param {Object} formData - Form data from bulk modal
   */
  async handleAdminBulkEditSubmit(formData) {
    const { booking } = this.adminEditContext || {};
    if (!booking) {
      this.adminPanel.showErrorMessage('Chyba: Kontext editace není dostupný.');
      return;
    }

    // FIX 2025-12-05: Merge original booking data with new form data
    // The original booking has required fields (name, email, phone) that must be preserved
    const updateData = {
      ...booking, // Original booking data (name, email, phone, etc.)
      ...formData, // New data from form (startDate, endDate, guests, etc.) - overrides booking
      id: booking.id,
    };

    await this.handleEditBookingSubmit(updateData);
    this.closeAdminEditModal();
  }

  /**
   * Handle submit from admin single room edit modal
   * @param {Object} formData - Form data from single room modal
   * @param {string} roomId - Room that was edited
   */
  async handleAdminSingleRoomEditSubmit(formData, roomId) {
    const { booking } = this.adminEditContext || {};
    if (!booking) {
      this.adminPanel.showErrorMessage('Chyba: Kontext editace není dostupný.');
      return;
    }

    // Merge form data with booking ID and update only the specific room
    // CRITICAL: Preserve booking.rooms to keep all rooms in composite booking
    // formData.rooms only contains the edited room, which would overwrite the full list
    const updateData = {
      ...booking,
      ...formData,
      id: booking.id,
      rooms: booking.rooms, // Preserve ALL rooms in composite booking
    };

    // Update perRoomDates for this room if dates changed
    if (formData.startDate && formData.endDate) {
      updateData.perRoomDates = {
        ...booking.perRoomDates,
        [roomId]: {
          startDate: formData.startDate,
          endDate: formData.endDate,
        },
      };
    }

    // Update perRoomGuests for this room if guests changed
    if (formData.adults !== undefined || formData.children !== undefined) {
      updateData.perRoomGuests = {
        ...booking.perRoomGuests,
        [roomId]: {
          adults: formData.adults || 0,
          children: formData.children || 0,
          toddlers: formData.toddlers || 0,
          guestType: formData.guestType || 'external',
        },
      };
    }

    // Merge guestNames: keep guests from other rooms, update guests from edited room
    if (formData.guestNames && Array.isArray(formData.guestNames)) {
      const otherRoomGuests = (booking.guestNames || []).filter(
        (g) => String(g.roomId) !== String(roomId)
      );
      updateData.guestNames = [...otherRoomGuests, ...formData.guestNames];
    }

    // CRITICAL: Recalculate total price for entire composite booking
    // formData.totalPrice only contains price for the edited room
    // We need to calculate price for ALL rooms with updated data
    try {
      const settings = await dataManager.getSettings();
      if (settings && booking.rooms.length > 1) {
        // Calculate total price for all rooms
        const totalPrice = PriceCalculator.calculatePerGuestPrice({
          rooms: updateData.rooms,
          guestNames: updateData.guestNames,
          perRoomDates: updateData.perRoomDates,
          perRoomGuests: updateData.perRoomGuests,
          settings,
          fallbackGuestType: updateData.guestType || 'external',
        });
        updateData.totalPrice = totalPrice;
      }
    } catch (error) {
      console.error('[AdminBookings] Failed to recalculate composite price:', error);
      // Keep formData.totalPrice as fallback
    }

    await this.handleEditBookingSubmit(updateData);
    this.closeAdminEditModal();
  }

  /**
   * Open legacy edit modal (fallback for unusual cases)
   * Uses the original EditBookingComponent approach
   * @param {Object} booking - Booking data
   * @param {Object} settings - Application settings
   */
  openLegacyEditModal(booking, settings) {
    // Initialize EditBookingComponent for admin mode
    this.editComponent = new EditBookingComponent({
      mode: 'admin',
      enforceDeadline: false, // Admin can edit any time
      validateSession: () => this.adminPanel.validateSession(),
      onSubmit: (formData) => this.handleEditBookingSubmit(formData),
      onDelete: (id) => this.handleEditBookingDelete(id),
      settings,
    });

    // CRITICAL: Expose editComponent on adminPanel for inline event handlers
    // The EditBookingRooms.js generates handlers like: adminPanel.editComponent.rooms.updateRoomGuests(...)
    this.adminPanel.editComponent = this.editComponent;

    // Load booking data into component
    this.editComponent.loadBooking(booking, settings);

    // Set modal title and button text for edit mode
    document.getElementById('editModalTitle').textContent = 'Upravit rezervaci';
    document.getElementById('editSubmitButton').textContent = 'Uložit změny';

    // Show modal
    this.editComponent.switchTab('dates');
    document.getElementById('editBookingModal').classList.add('active');
  }

  async handleEditBookingSubmit(formData) {
    try {
      const bookingId = formData.id;

      // Delete all proposed bookings for this edit session before saving final booking
      const sessionId = this.editComponent?.getSessionId();
      if (sessionId) {
        try {
          await fetch(`/api/proposed-bookings/session/${sessionId}`, {
            method: 'DELETE',
          });
          // Proposed bookings deleted for session
        } catch (error) {
          console.warn('Failed to delete proposed bookings:', error);
          // Continue with saving - this is not critical
        }
      }

      // Check if we're creating new booking or updating existing
      if (bookingId) {
        // Update existing booking via API (triggers email notification)
        const sessionToken = sessionStorage.getItem('adminSessionToken');
        const response = await fetch(`/api/booking/${bookingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': sessionToken,
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json();

          // FIX 2025-12-05: Handle 401 specifically - session might have expired
          if (response.status === 401) {
            // Try to refresh session instead of immediately failing
            this.adminPanel.showToast('Session možná vypršela, zkuste to znovu', 'warning');
            return; // Don't throw, just return - let user retry
          }

          throw new Error(error.error || 'Nepodařilo se upravit rezervaci');
        }

        // Sync with server to get updated data (force refresh for immediate update)
        await dataManager.syncWithServer(true);

        this.adminPanel.showSuccessMessage('Rezervace byla úspěšně upravena');
      } else {
        // Create new booking via API (triggers email notification)
        const sessionToken = sessionStorage.getItem('adminSessionToken');
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': sessionToken,
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Nepodařilo se vytvořit rezervaci');
        }

        // Sync with server to get updated data (force refresh for immediate update)
        await dataManager.syncWithServer(true);

        this.adminPanel.showSuccessMessage('Rezervace byla úspěšně vytvořena');
      }

      document.getElementById('editBookingModal').classList.remove('active');
      await this.loadBookings();
    } catch (error) {
      console.error('Chyba při ukládání rezervace:', error);
      this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  /**
   * Delete handler called by EditBookingComponent
   */
  async handleEditBookingDelete(bookingId) {
    try {
      // Delete via API (triggers email notification)
      const sessionToken = sessionStorage.getItem('adminSessionToken');
      const response = await fetch(`/api/booking/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'x-session-token': sessionToken,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Nepodařilo se smazat rezervaci');
      }

      // Close modal immediately
      document.getElementById('editBookingModal').classList.remove('active');

      // Remove row from DOM immediately (optimistic update)
      const row = document.querySelector(`tr[data-booking-id="${bookingId}"]`);
      if (row) {
        row.remove();
      }

      // Remove from selection if selected
      this.selectedBookings.delete(bookingId);
      this.updateBulkActionsUI();

      // Sync with server in background (don't block UI)
      dataManager.syncWithServer(true).catch((err) => {
        console.error('[Admin] Background sync failed:', err);
      });

      this.adminPanel.showSuccessMessage('Rezervace byla smazána');
    } catch (error) {
      console.error('Chyba při mazání rezervace:', error);
      this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  async deleteBooking(bookingId) {
    this.adminPanel.showConfirm('Opravdu chcete smazat tuto rezervaci?', async () => {
      // FIX: Validate session before admin operation
      if (!(await this.adminPanel.validateSession())) {
        return;
      }

      // Optimistic UI update: immediately fade out and disable row
      const row = document.querySelector(`tr[data-booking-id="${bookingId}"]`);
      if (row) {
        row.style.transition = 'opacity 0.3s ease';
        row.style.opacity = '0.5';
        row.style.pointerEvents = 'none';
      }

      try {
        // Delete via API (triggers email notification)
        const sessionToken = sessionStorage.getItem('adminSessionToken');
        const response = await fetch(`/api/booking/${bookingId}`, {
          method: 'DELETE',
          headers: {
            'x-session-token': sessionToken,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Nepodařilo se smazat rezervaci');
        }

        // Remove row from DOM immediately
        if (row) {
          row.remove();
        }

        // Remove from selection if selected
        this.selectedBookings.delete(bookingId);
        this.updateBulkActionsUI();

        // Sync with server in background (don't block UI)
        dataManager.syncWithServer(true).catch((err) => {
          console.error('[Admin] Background sync failed:', err);
        });

        this.adminPanel.showSuccessMessage('Rezervace byla smazána');
      } catch (error) {
        console.error('Chyba při mazání rezervace:', error);
        this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');

        // Revert optimistic update on error
        if (row) {
          row.style.opacity = '1';
          row.style.pointerEvents = 'auto';
        }
      }
    });
  }

  /**
   * Copy guest names to clipboard
   * @param {string} bookingId - Booking ID to copy guest names from
   */
  async copyGuestNames(bookingId) {
    try {
      const booking = await dataManager.getBooking(bookingId);
      if (!booking || !booking.guestNames || booking.guestNames.length === 0) {
        this.adminPanel.showToast('Žádná jména hostů k zkopírování', 'warning');
        return;
      }

      // Format: "FirstName LastName\n" for each guest
      const guestNamesText = booking.guestNames
        .map((guest) => `${guest.firstName} ${guest.lastName}`)
        .join('\n');

      // Copy to clipboard
      await navigator.clipboard.writeText(guestNamesText);
      this.adminPanel.showToast(`Zkopírováno ${booking.guestNames.length} jmen hostů`, 'success');
    } catch (error) {
      console.error('Chyba při kopírování jmen hostů:', error);
      this.adminPanel.showToast('Nepodařilo se zkopírovat jména hostů', 'error');
    }
  }

  /**
   * Generate price breakdown HTML
   * For bulk bookings: Shows unified bulk format (base price + guest surcharges)
   * For regular bookings: Shows per-room breakdown
   *
   * @param {Object} booking - Booking object
   * @returns {Promise<string>} HTML string with price breakdown
   */
  async generatePerRoomPriceBreakdown(booking) {
    try {
      const settings = await dataManager.getSettings();
      if (!settings) {
        return '';
      }

      // CRITICAL: Bulk bookings have unified format (NOT per-room breakdown)
      if (booking.isBulkBooking && settings.bulkPrices) {
        return this.generateBulkPriceBreakdownHTML(booking, settings);
      }

      // Check if we have per-room guest data
      if (!booking.perRoomGuests || Object.keys(booking.perRoomGuests).length === 0) {
        return '';
      }

      if (!settings.prices) {
        return '';
      }

      // Calculate nights for each room
      // FIX 2025-12-03: Extract per-room guest type breakdown from guestNames
      // guestNames contains individual guests with their guestPriceType (utia/external)
      const perRoomGuests = [];
      for (const roomId of booking.rooms) {
        const roomGuests = booking.perRoomGuests[roomId];
        if (roomGuests) {
          // Count ÚTIA vs External guests for this room from guestNames
          let utiaAdults = 0;
          let externalAdults = 0;
          let utiaChildren = 0;
          let externalChildren = 0;

          if (booking.guestNames && Array.isArray(booking.guestNames)) {
            // Filter guests assigned to this room
            // FIX 2025-12-03: Use String() for type-safe comparison (roomId may be string or number)
            const roomGuestNames = booking.guestNames.filter(
              (g) => String(g.roomId) === String(roomId)
            );
            for (const guest of roomGuestNames) {
              // FIX 2025-12-03: Log when guestPriceType falls back to 'external' (data integrity check)
              if (!guest.guestPriceType) {
                console.warn(
                  '[AdminPanel] Missing guestPriceType for guest, defaulting to external:',
                  {
                    bookingId: booking.id,
                    guestName: `${guest.firstName} ${guest.lastName}`,
                    roomId: guest.roomId,
                  }
                );
              }
              const priceType = guest.guestPriceType || 'external';
              const personType = guest.personType || 'adult';

              if (personType === 'adult') {
                if (priceType === 'utia') {
                  utiaAdults += 1;
                } else {
                  externalAdults += 1;
                }
              } else if (personType === 'child') {
                if (priceType === 'utia') {
                  utiaChildren += 1;
                } else {
                  externalChildren += 1;
                }
              }
              // toddlers don't affect pricing
            }
          }

          // Determine room guestType: ÚTIA if any ÚTIA guests in this room
          // FIX 2025-12-05: If only external guests, use 'external' explicitly
          // Don't fall back to booking.guestType which may be 'utia' from another room
          const hasUtiaGuest = utiaAdults > 0 || utiaChildren > 0;
          const hasExternalGuest = externalAdults > 0 || externalChildren > 0;
          let roomGuestType;
          if (hasUtiaGuest) {
            roomGuestType = 'utia';
          } else if (hasExternalGuest) {
            roomGuestType = 'external';
          } else {
            // No paying guests counted - fallback to stored value
            roomGuestType = roomGuests.guestType || booking.guestType || 'external';
          }

          perRoomGuests.push({
            roomId,
            adults: roomGuests.adults || 0,
            children: roomGuests.children || 0,
            toddlers: roomGuests.toddlers || 0,
            guestType: roomGuestType,
            utiaAdults,
            externalAdults,
            utiaChildren,
            externalChildren,
          });
        }
      }

      if (perRoomGuests.length === 0) {
        return '';
      }

      // NEW 2025-11-14: Calculate nights per room using perRoomDates if available
      // Fallback to booking-level dates for backward compatibility
      const nights = booking.perRoomDates
        ? null // Will be calculated per room by PriceCalculator
        : Math.ceil(
            (new Date(booking.endDate) - new Date(booking.startDate)) / (1000 * 60 * 60 * 24)
          );

      // Calculate per-room prices
      const perRoomPrices = PriceCalculator.calculatePerRoomPrices({
        guestType: booking.guestType || 'utia',
        nights,
        settings,
        perRoomGuests,
        perRoomDates: booking.perRoomDates || null, // NEW: Pass per-room dates
      });

      // Format HTML - SSOT FIX 2025-12-04: Pass booking.totalPrice as authoritative total
      // This ensures the detail view shows the same price as the booking list (SSOT principle)
      // If recalculated price differs, formatPerRoomPricesHTML() will show an info note
      const html = PriceCalculator.formatPerRoomPricesHTML(perRoomPrices, 'cs', booking.totalPrice);

      return html;
    } catch (error) {
      console.error('[AdminPanel] Failed to generate price breakdown:', {
        error: error.message,
        bookingId: booking?.id,
      });
      return `<div style="color: #dc2626; padding: 0.5rem; font-size: 0.85rem;">
        ⚠️ Chyba při generování rozpisu cen
      </div>`;
    }
  }

  /**
   * Generate unified bulk price breakdown HTML
   * Shows: Base price + ÚTIA guests + External guests + Total
   *
   * @param {Object} booking - Booking object with bulk booking data
   * @param {Object} settings - Settings with bulkPrices configuration
   * @returns {string} HTML string with bulk price breakdown
   */
  generateBulkPriceBreakdownHTML(booking, settings) {
    const { bulkPrices } = settings;

    // Validate bulkPrices configuration
    const requiredFields = [
      'basePrice',
      'utiaAdult',
      'utiaChild',
      'externalAdult',
      'externalChild',
    ];
    const missingFields = requiredFields.filter((f) => typeof bulkPrices?.[f] !== 'number');
    if (missingFields.length > 0) {
      console.error('[AdminPanel] Missing bulkPrices fields:', missingFields);
      return `<div style="color: var(--error-color); padding: 1rem; background: #fef2f2; border-radius: var(--radius-md);">⚠️ Chyba: Neúplná konfigurace hromadných cen</div>`;
    }

    const nights = Math.ceil(
      (new Date(booking.endDate) - new Date(booking.startDate)) / (1000 * 60 * 60 * 24)
    );

    // Count guests by type from guestNames if available
    let utiaAdults = 0;
    let utiaChildren = 0;
    let externalAdults = 0;
    let externalChildren = 0;
    let toddlers = 0;

    if (booking.guestNames && booking.guestNames.length > 0) {
      for (const guest of booking.guestNames) {
        const priceType = guest.guestPriceType || 'external';
        const personType = guest.personType || 'adult';

        if (personType === 'toddler') {
          toddlers++;
        } else if (priceType === 'utia') {
          if (personType === 'child') {
            utiaChildren++;
          } else {
            utiaAdults++;
          }
        } else if (personType === 'child') {
          externalChildren++;
        } else {
          externalAdults++;
        }
      }
    } else {
      // Fallback to booking-level counts
      if (booking.guestType === 'utia') {
        utiaAdults = booking.adults || 0;
        utiaChildren = booking.children || 0;
      } else {
        externalAdults = booking.adults || 0;
        externalChildren = booking.children || 0;
      }
      toddlers = booking.toddlers || 0;
    }

    // SSOT: Use PriceCalculator for total price calculation
    const totalPrice = PriceCalculator.calculateMixedBulkPrice({
      utiaAdults,
      externalAdults,
      utiaChildren,
      externalChildren,
      nights,
      settings,
    });

    // Calculate individual components PER NIGHT for display
    const basePricePerNight = bulkPrices.basePrice;
    const utiaAdultsPricePerNight = utiaAdults * bulkPrices.utiaAdult;
    const utiaChildrenPricePerNight = utiaChildren * bulkPrices.utiaChild;
    const externalAdultsPricePerNight = externalAdults * bulkPrices.externalAdult;
    const externalChildrenPricePerNight = externalChildren * bulkPrices.externalChild;
    const subtotalPerNight =
      basePricePerNight +
      utiaAdultsPricePerNight +
      utiaChildrenPricePerNight +
      externalAdultsPricePerNight +
      externalChildrenPricePerNight;

    // Build HTML
    let html = `
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem;">
        <div style="font-weight: 600; color: #166534; margin-bottom: 1rem; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.2rem;">🏠</span> Hromadná rezervace celé chaty
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <!-- Base price -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 6px;">
            <span style="color: #374151;">Základní cena za chatu</span>
            <span style="font-weight: 600; color: #059669;">${basePricePerNight.toLocaleString('cs-CZ')} Kč/noc</span>
          </div>`;

    // ÚTIA guests
    if (utiaAdults > 0) {
      html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem 0.5rem 1.5rem; color: #374151;">
            <span>ÚTIA ${this._getGuestLabelAdmin(utiaAdults, 'adult')}</span>
            <span style="color: #059669;">+${utiaAdultsPricePerNight.toLocaleString('cs-CZ')} Kč/noc</span>
          </div>`;
    }
    if (utiaChildren > 0) {
      html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem 0.5rem 1.5rem; color: #374151;">
            <span>ÚTIA ${this._getGuestLabelAdmin(utiaChildren, 'child')}</span>
            <span style="color: #059669;">+${utiaChildrenPricePerNight.toLocaleString('cs-CZ')} Kč/noc</span>
          </div>`;
    }

    // External guests
    if (externalAdults > 0) {
      html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem 0.5rem 1.5rem; color: #374151;">
            <span>Externí ${this._getGuestLabelAdmin(externalAdults, 'adult')}</span>
            <span style="color: #059669;">+${externalAdultsPricePerNight.toLocaleString('cs-CZ')} Kč/noc</span>
          </div>`;
    }
    if (externalChildren > 0) {
      html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem 0.5rem 1.5rem; color: #374151;">
            <span>Externí ${this._getGuestLabelAdmin(externalChildren, 'child')}</span>
            <span style="color: #059669;">+${externalChildrenPricePerNight.toLocaleString('cs-CZ')} Kč/noc</span>
          </div>`;
    }

    // Toddlers (free)
    if (toddlers > 0) {
      html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem 0.5rem 1.5rem; color: #6b7280; font-style: italic;">
            <span>${this._getGuestLabelAdmin(toddlers, 'toddler')}</span>
            <span>zdarma</span>
          </div>`;
    }

    // Subtotal per night
    html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #dbeafe; border-radius: 6px; margin-top: 0.5rem; border: 1px solid #93c5fd;">
            <span style="color: #1e40af; font-weight: 600;">Mezisoučet za noc</span>
            <span style="font-weight: 700; color: #1e40af;">${subtotalPerNight.toLocaleString('cs-CZ')} Kč</span>
          </div>`;

    // Nights multiplier
    html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #e5e7eb; border-radius: 6px; margin-top: 0.5rem;">
            <span style="color: #374151; font-weight: 500;">Počet nocí</span>
            <span style="font-weight: 600; color: #374151;">× ${nights}</span>
          </div>`;

    // Total - FIXED 2025-12-04: Always display recalculated price from current settings (SSOT)
    // The stored booking.totalPrice is historical, current price settings are authoritative
    html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; margin-top: 0.5rem;">
            <span style="color: white; font-weight: 600; font-size: 1.1rem;">Celková cena</span>
            <span style="color: white; font-weight: 700; font-size: 1.25rem;">${totalPrice.toLocaleString('cs-CZ')} Kč</span>
          </div>`;

    html += `
        </div>
      </div>`;

    return html;
  }

  /**
   * Get Czech guest label with proper pluralization for admin panel
   * @param {number} count - Number of guests
   * @param {string} type - 'adult', 'child', or 'toddler'
   * @returns {string} Formatted label
   */
  _getGuestLabelAdmin(count, type) {
    if (type === 'adult') {
      if (count === 1) {
        return '1 dospělý';
      }
      if (count >= 2 && count <= 4) {
        return `${count} dospělí`;
      }
      return `${count} dospělých`;
    } else if (type === 'child') {
      if (count === 1) {
        return '1 dítě (3-17 let)';
      }
      if (count >= 2 && count <= 4) {
        return `${count} děti (3-17 let)`;
      }
      return `${count} dětí (3-17 let)`;
    }
    // toddler
    if (count === 1) {
      return '1 batole (0-2 roky)';
    }
    if (count >= 2 && count <= 4) {
      return `${count} batolata (0-2 roky)`;
    }
    return `${count} batolat (0-2 roky)`;
  }

  // Bulk operations
  toggleBookingSelection(bookingId, checked) {
    if (checked) {
      this.selectedBookings.add(bookingId);
    } else {
      this.selectedBookings.delete(bookingId);
    }
    this.updateBulkActionsUI();
  }

  toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.booking-checkbox');
    checkboxes.forEach((checkbox) => {
      const bookingId = checkbox.getAttribute('data-booking-id');
      checkbox.checked = checked;
      if (checked) {
        this.selectedBookings.add(bookingId);
      } else {
        this.selectedBookings.delete(bookingId);
      }
    });
    this.updateBulkActionsUI();
  }

  updateBulkActionsUI() {
    const count = this.selectedBookings.size;
    const bulkActionsContainer = document.getElementById('bulkActionsContainer');
    const selectedCountElement = document.getElementById('selectedCount');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    if (count > 0) {
      if (bulkActionsContainer) {
        bulkActionsContainer.style.display = 'flex';
      }
      if (selectedCountElement) {
        selectedCountElement.textContent = `${count} vybran${count === 1 ? 'á' : count <= 4 ? 'é' : 'ých'}`;
      }

      // Update "select all" checkbox state
      const totalCheckboxes = document.querySelectorAll('.booking-checkbox').length;
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = count === totalCheckboxes;
        selectAllCheckbox.indeterminate = count > 0 && count < totalCheckboxes;
      }
    } else {
      if (bulkActionsContainer) {
        bulkActionsContainer.style.display = 'none';
      }
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      }
    }
  }

  async bulkDeleteBookings() {
    const count = this.selectedBookings.size;
    if (count === 0) {
      return;
    }

    this.adminPanel.showConfirm(
      `Opravdu chcete smazat ${count} vybran${count === 1 ? 'ou rezervaci' : count <= 4 ? 'é rezervace' : 'ých rezervací'}?`,
      async () => {
        // FIX: Validate session before admin operation
        if (!(await this.adminPanel.validateSession())) {
          return;
        }

        // Get button element and store original content
        const deleteBtn = document.getElementById('bulkDeleteBtn');
        const originalHTML = deleteBtn ? deleteBtn.innerHTML : null;

        // Disable button and show loading state
        if (deleteBtn) {
          deleteBtn.disabled = true;
          deleteBtn.style.opacity = '0.6';
          deleteBtn.style.cursor = 'not-allowed';
          deleteBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="0.75"/>
            </svg>
            Mazání...
          `;

          // Add spin animation if not already present
          if (!document.getElementById('spinAnimation')) {
            const style = document.createElement('style');
            style.id = 'spinAnimation';
            style.textContent = `
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `;
            document.head.appendChild(style);
          }
        }

        const sessionToken = sessionStorage.getItem('adminSessionToken');
        const bookingIds = Array.from(this.selectedBookings);

        try {
          // Optimistic UI update: immediately remove rows from table
          for (const bookingId of bookingIds) {
            const row = document.querySelector(`tr[data-booking-id="${bookingId}"]`);
            if (row) {
              row.style.opacity = '0.5';
              row.style.pointerEvents = 'none';
            }
          }

          // Use bulk delete API endpoint (single request, background emails)
          const response = await fetch('/api/bookings/bulk-delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-session-token': sessionToken,
            },
            body: JSON.stringify({ bookingIds }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Bulk delete failed');
          }

          const result = await response.json();

          // Remove deleted rows from DOM immediately
          for (const bookingId of result.deletedIds || bookingIds) {
            const row = document.querySelector(`tr[data-booking-id="${bookingId}"]`);
            if (row) {
              row.remove();
            }
          }

          // Clear selection
          this.selectedBookings.clear();
          this.updateBulkActionsUI();

          // Sync with server in background (don't block UI)
          dataManager.syncWithServer(true).catch((error) => {
            console.error('[Admin] Server sync failed after bulk delete:', error);
          });

          // Refresh main calendar if it exists
          if (window.app && typeof window.app.renderCalendar === 'function') {
            window.app.renderCalendar().catch(() => {});
          }

          // Show success message
          const deletedCount = result.deletedCount || bookingIds.length;
          const notFoundCount = result.notFoundIds?.length || 0;

          if (notFoundCount === 0) {
            this.adminPanel.showSuccessMessage(`Úspěšně smazáno ${deletedCount} rezervací`);
          } else {
            this.adminPanel.showToast(
              `Smazáno ${deletedCount} rezervací, ${notFoundCount} nebylo nalezeno`,
              'warning'
            );
          }
        } catch (error) {
          console.error('Chyba při hromadném mazání:', error);
          this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');

          // Revert optimistic update on error - reload table
          await this.loadBookings();
        } finally {
          // Restore button state
          if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.style.opacity = '1';
            deleteBtn.style.cursor = 'pointer';
            if (originalHTML) {
              deleteBtn.innerHTML = originalHTML;
            }
          }
        }
      }
    );
  }

  /**
   * Print selected bookings
   * Opens a print-friendly view of selected bookings
   */
  async bulkPrintBookings() {
    const count = this.selectedBookings.size;
    if (count === 0) {
      this.adminPanel.showToast('Vyberte alespoň jednu rezervaci k tisku', 'warning');
      return;
    }

    try {
      const settings = await dataManager.getSettings();
      const bookingsToPrint = [];

      for (const bookingId of this.selectedBookings) {
        const booking = await dataManager.getBooking(bookingId);
        if (booking) {
          bookingsToPrint.push(booking);
        }
      }

      if (bookingsToPrint.length === 0) {
        this.adminPanel.showToast('Nepodařilo se načíst vybrané rezervace', 'error');
        return;
      }

      // Sort by start date
      bookingsToPrint.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

      // Create print window
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        this.adminPanel.showToast('Nelze otevřít tiskové okno - povolte vyskakovací okna', 'error');
        return;
      }

      // Generate print content
      let printContent = `
                <!DOCTYPE html>
                <html lang="cs">
                <head>
                    <meta charset="UTF-8">
                    <title>Tisk rezervací - Chata Mariánská</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
                        h1 { font-size: 18px; margin-bottom: 10px; }
                        .booking { border: 1px solid #ccc; padding: 15px; margin-bottom: 15px; page-break-inside: avoid; }
                        .booking-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
                        .booking-id { font-weight: bold; font-size: 14px; }
                        .booking-dates { color: #666; }
                        .booking-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                        .booking-field { margin-bottom: 5px; }
                        .field-label { font-weight: bold; color: #555; }
                        .rooms { display: flex; gap: 5px; flex-wrap: wrap; }
                        .room-badge { background: #28a745; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; }
                        .paid { color: #10b981; font-weight: bold; }
                        .unpaid { color: #ef4444; font-weight: bold; }
                        .print-date { text-align: right; font-size: 10px; color: #999; margin-bottom: 20px; }
                        @media print {
                            .booking { page-break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Rezervace - Chata Mariánská</h1>
                    <div class="print-date">Vytištěno: ${new Date().toLocaleString('cs-CZ')}</div>
            `;

      for (const booking of bookingsToPrint) {
        const price = this.getBookingPrice(booking, settings);
        const startDate = new Date(booking.startDate).toLocaleDateString('cs-CZ');
        const endDate = new Date(booking.endDate).toLocaleDateString('cs-CZ');

        printContent += `
                    <div class="booking">
                        <div class="booking-header">
                            <span class="booking-id">${this.escapeHtml(booking.id)}</span>
                            <span class="booking-dates">${startDate} - ${endDate}</span>
                        </div>
                        <div class="booking-grid">
                            <div class="booking-field">
                                <span class="field-label">Jméno:</span> ${this.escapeHtml(booking.name)}
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Email:</span> ${this.escapeHtml(booking.email)}
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Telefon:</span> ${this.escapeHtml(booking.phone)}
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Hosté:</span> ${booking.adults} dosp., ${booking.children} dětí, ${booking.toddlers || 0} bat.
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Pokoje:</span>
                                <span class="rooms">${booking.rooms.map((r) => `<span class="room-badge">P${r}</span>`).join('')}</span>
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Cena:</span> ${price.toLocaleString('cs-CZ')} Kč
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Zaplaceno:</span>
                                <span class="${booking.paid ? 'paid' : 'unpaid'}">${booking.paid ? 'Ano' : 'Ne'}</span>
                            </div>
                            ${
                              booking.notes
                                ? `
                            <div class="booking-field" style="grid-column: 1 / -1;">
                                <span class="field-label">Poznámky:</span> ${this.escapeHtml(booking.notes)}
                            </div>
                            `
                                : ''
                            }
                        </div>
                    </div>
                `;
      }

      printContent += `
                </body>
                </html>
            `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      // Wait for content to load, then print
      printWindow.onload = () => {
        printWindow.print();
      };

      this.adminPanel.showSuccessMessage(`Připraveno k tisku: ${bookingsToPrint.length} rezervací`);
    } catch (error) {
      console.error('Chyba při přípravě tisku:', error);
      this.adminPanel.showToast('Chyba při přípravě tisku', 'error');
    }
  }

  async togglePaidStatus(bookingId, paid) {
    // Validate session before admin operation
    if (!this.adminPanel.validateSession()) {
      return;
    }

    try {
      const booking = await dataManager.getBooking(bookingId);
      if (!booking) {
        this.adminPanel.showToast('Rezervace nenalezena', 'error');
        return;
      }

      // Update paid status on server via API (triggers email notification)
      const sessionToken = sessionStorage.getItem('adminSessionToken');
      const response = await fetch(`/api/booking/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({
          ...booking,
          paid,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Nepodařilo se aktualizovat stav platby');
      }

      // Sync with server to get updated data
      await dataManager.syncWithServer();

      // Reload bookings table to reflect changes
      await this.loadBookings();

      this.adminPanel.showSuccessMessage(
        `Rezervace ${bookingId} byla označena jako ${paid ? 'zaplacená' : 'nezaplacená'}`
      );
    } catch (error) {
      console.error('Chyba při změně stavu platby:', error);
      this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
      // Revert checkbox state
      await this.loadBookings();
    }
  }
}
