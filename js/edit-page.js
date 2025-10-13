/**
 * Edit Page - Standalone booking edit interface
 * Uses admin-style modal UI for consistent UX
 * Enforces 3-day edit deadline for non-admin users
 */

class EditPage {
  constructor() {
    this.editToken = null;
    this.currentBooking = null;
    this.editSelectedRooms = new Map();
    this.editStartDate = null;
    this.editEndDate = null;
    this.originalStartDate = null; // Original booking dates for calendar display
    this.originalEndDate = null;
    this.editCalendar = null;
    this.isEditLocked = false;

    this.initialize();
  }

  async initialize() {
    // Get edit token from URL
    const urlParams = new URLSearchParams(window.location.search);
    this.editToken = urlParams.get('token');

    if (!this.editToken) {
      this.showError('Chybí editační token. Prosím použijte odkaz z potvrzovacího emailu.');
      return;
    }

    // Load booking data
    await this.loadBookingData();
  }

  async loadBookingData() {
    try {
      const response = await fetch(`/api/booking-by-token?token=${this.editToken}`);

      if (!response.ok) {
        throw new Error('Rezervace nenalezena nebo neplatný token');
      }

      this.currentBooking = await response.json();

      // Check 3-day edit deadline
      this.isEditLocked = this.checkEditDeadline();

      if (this.isEditLocked) {
        this.displayEditDeadlineWarning();
      } else {
        await this.initializeEditForm();
      }

      // Hide loading, show form
      document.getElementById('loadingState').style.display = 'none';
    } catch (error) {
      console.error('Error loading booking:', error);
      this.showError(error.message || 'Nepodařilo se načíst rezervaci');
    }
  }

  checkEditDeadline() {
    if (!this.currentBooking || !this.currentBooking.startDate) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(this.currentBooking.startDate);
    startDate.setHours(0, 0, 0, 0);

    const daysUntilStart = Math.floor((startDate - today) / (1000 * 60 * 60 * 24));

    return daysUntilStart < 3; // Lock if less than 3 days
  }

  displayEditDeadlineWarning() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(this.currentBooking.startDate);
    startDate.setHours(0, 0, 0, 0);

    const daysUntilStart = Math.floor((startDate - today) / (1000 * 60 * 60 * 24));

    let message = '';
    if (daysUntilStart < 0) {
      message = '⚠️ Rezervace již začala nebo proběhla.';
    } else {
      // Fix nested ternary - use explicit conditions
      let dayWord = 'dní';
      if (daysUntilStart === 1) {
        dayWord = 'den';
      } else if (daysUntilStart < 5) {
        dayWord = 'dny';
      }
      message = `⏰ Do začátku zbývá: <strong>${daysUntilStart} ${dayWord}</strong>`;
    }

    document.getElementById('deadlineMessage').innerHTML = `
      Úpravy a zrušení rezervace jsou možné pouze <strong>3 dny před začátkem pobytu</strong>.<br><br>
      ${message}
    `;

    document.getElementById('editDeadlineWarning').style.display = 'block';

    // Show booking details in read-only mode
    document.getElementById('editFormContainer').style.display = 'block';
    this.displayReadOnlyBooking();
  }

  displayReadOnlyBooking() {
    // Display booking details but disable all inputs
    document.getElementById('bookingIdDisplay').textContent = this.currentBooking.id;

    // Populate billing info in read-only mode
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
      const element = document.getElementById(`edit${field}`);
      if (element) {
        element.value = this.currentBooking[field.toLowerCase()] || '';
        element.disabled = true;
      }
    });

    // Display dates and rooms as text only
    const startDateFormatted = DateUtils.formatDateDisplay(
      DateUtils.parseDate(this.currentBooking.startDate),
      'cs'
    );
    const endDateFormatted = DateUtils.formatDateDisplay(
      DateUtils.parseDate(this.currentBooking.endDate),
      'cs'
    );

    document.getElementById('editSelectedDates').textContent =
      `${startDateFormatted} - ${endDateFormatted}`;

    // Disable all buttons except cancel
    document.getElementById('editSubmitButton').disabled = true;
    document.getElementById('deleteBookingButton').disabled = true;
    document.querySelector('.edit-tab-btn[data-tab="dates"]').disabled = true;

    // Hide calendar
    document.getElementById('editCalendarContainer').innerHTML = `
      <div style="padding: 2rem; text-align: center; background: #f3f4f6; border-radius: 8px;">
        <p style="color: #6b7280;">📅 Termín: ${this.currentBooking.startDate} - ${this.currentBooking.endDate}</p>
        <p style="color: #6b7280;">🏠 Pokoje: ${this.currentBooking.rooms.join(', ')}</p>
        <p style="color: #6b7280; margin-top: 1rem;">Úpravy termínu a pokojů nejsou možné.</p>
      </div>
    `;

    // Switch to billing tab by default
    this.switchTab('billing');
  }

  async initializeEditForm() {
    document.getElementById('bookingIdDisplay').textContent = this.currentBooking.id;

    // Load settings first (needed for component)
    const settings = await dataManager.getSettings();
    this.settings = settings;

    // Initialize EditBookingComponent for user mode
    this.editComponent = new EditBookingComponent({
      mode: 'user',
      enforceDeadline: true, // User must respect 3-day deadline
      validateSession: null, // No session validation for user
      onSubmit: (formData) => this.handleEditBookingSubmit(formData),
      onDelete: (bookingId) => this.handleEditBookingDelete(bookingId),
      settings,
    });

    // Load booking data into component
    await this.editComponent.loadBooking(this.currentBooking, settings);

    // Setup event listeners
    document
      .getElementById('editBookingForm')
      .addEventListener('submit', (e) => this.handleSubmit(e));

    // Show form
    document.getElementById('editFormContainer').style.display = 'block';
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (this.isEditLocked) {
      this.showNotification('Úpravy rezervace nejsou možné. Rezervace je uzamčena.', 'error');
      return;
    }

    try {
      // Use EditBookingComponent for validation and data collection
      await this.editComponent.validateForm();
      const formData = this.editComponent.getFormData();

      // Submit using component's data
      await this.handleEditBookingSubmit(formData);
    } catch (error) {
      console.error('Chyba při ukládání rezervace:', error);
      this.showError(error.message || 'Nepodařilo se uložit rezervaci');
      // Switch to appropriate tab based on error
      if (error.message && error.message.includes('povinné údaje')) {
        this.editComponent.switchTab('billing');
      } else if (
        error.message &&
        (error.message.includes('termín') || error.message.includes('pokoj'))
      ) {
        this.editComponent.switchTab('dates');
      }
    }
  }

  /**
   * Submit handler called by EditBookingComponent
   */
  async handleEditBookingSubmit(formData) {
    try {
      // Delete all proposed bookings for this edit session before saving final booking
      const sessionId = this.editComponent.getSessionId();
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

      const response = await fetch(`/api/booking/${this.currentBooking.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Edit-Token': this.editToken,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Nepodařilo se aktualizovat rezervaci');
      }

      // Verify that changes were saved to database
      const verifyResponse = await fetch(`/api/booking-by-token?token=${this.editToken}`, {
        method: 'GET',
      });

      if (!verifyResponse.ok) {
        throw new Error('Nepodařilo se ověřit uložení změn');
      }

      const savedBooking = await verifyResponse.json();

      // Verify key fields were updated correctly
      const fieldsToVerify = ['startDate', 'endDate', 'name', 'email', 'phone'];
      const allFieldsMatch = fieldsToVerify.every((field) => {
        const expected = formData[field];
        const actual = savedBooking[field];
        return expected === actual;
      });

      if (!allFieldsMatch) {
        console.error('Data verification failed:', { formData, savedBooking });
        throw new Error('Změny nebyly správně uloženy do databáze');
      }

      this.showSuccess('Rezervace byla úspěšně aktualizována! Přesměrování na hlavní stránku...');

      // Redirect to home page after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('Error updating booking:', error);
      this.showError(error.message);
    }
  }

  /**
   * Delete handler called by EditBookingComponent
   */
  async handleEditBookingDelete(bookingId) {
    try {
      const response = await fetch(`/api/booking/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'X-Edit-Token': this.editToken,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Nepodařilo se zrušit rezervaci');
      }

      this.showSuccess('Rezervace byla úspěšně zrušena!');

      // Redirect to homepage after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('Error deleting booking:', error);
      this.showError(error.message);
    }
  }

  /**
   * Delete booking wrapper for button onclick
   */
  deleteBooking() {
    if (this.isEditLocked) {
      this.showNotification('Zrušení rezervace není možné. Rezervace je uzamčena.', 'error');
      return;
    }

    this.showConfirm(
      'Opravdu chcete zrušit tuto rezervaci? Tuto akci nelze vrátit zpět.',
      async () => {
        await this.handleEditBookingDelete(this.currentBooking.id);
      }
    );
  }

  // Confirm dialog replacement for no-alert ESLint rule
  showConfirm(message, onConfirm, onCancel = null) {
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'confirm-overlay';
    confirmDialog.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-message">${message}</div>
        <div class="confirm-buttons">
          <button class="confirm-cancel">Zrušit</button>
          <button class="confirm-ok">Potvrdit</button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmDialog);
    setTimeout(() => confirmDialog.classList.add('active'), 10);

    const removeDialog = () => {
      confirmDialog.classList.remove('active');
      setTimeout(() => confirmDialog.remove(), 300);
    };

    confirmDialog.querySelector('.confirm-ok').addEventListener('click', () => {
      removeDialog();
      if (onConfirm) {
        onConfirm();
      }
    });

    confirmDialog.querySelector('.confirm-cancel').addEventListener('click', () => {
      removeDialog();
      if (onCancel) {
        onCancel();
      }
    });

    confirmDialog.addEventListener('click', (e) => {
      if (e.target === confirmDialog) {
        removeDialog();
        if (onCancel) {
          onCancel();
        }
      }
    });
  }

  showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('editFormContainer').style.display = 'none';
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorState').style.display = 'block';
  }

  showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    successMessage.textContent = message;
    successMessage.style.display = 'block';

    setTimeout(() => {
      successMessage.style.display = 'none';
    }, 5000);
  }

  showNotification(message, type = 'info', duration = 5000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.setProperty('--duration', `${duration / 1000}s`);

    // Create icon based on type
    const iconMap = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    // Build notification HTML structure
    notification.innerHTML = `
      <span class="notification-icon">${iconMap[type] || iconMap.info}</span>
      <span class="notification-content">${message}</span>
      <span class="notification-close">×</span>
    `;

    // Get or create container
    const container =
      document.getElementById('notificationContainer') ||
      (() => {
        const c = document.createElement('div');
        c.id = 'notificationContainer';
        document.body.appendChild(c);
        return c;
      })();

    container.appendChild(notification);

    // Click to dismiss functionality
    notification.addEventListener('click', () => {
      notification.classList.add('removing');
      setTimeout(() => notification.remove(), 300);
    });

    // Animate in
    requestAnimationFrame(() => notification.classList.add('show'));

    // Auto dismiss after duration
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.add('removing');
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }
}

// Initialize edit page
// eslint-disable-next-line no-unused-vars
const editPage = new EditPage();
