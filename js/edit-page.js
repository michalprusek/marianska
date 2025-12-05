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
      this.currentBooking = await dataManager.getBookingByEditToken(this.editToken);

      if (!this.currentBooking) {
        throw new Error('Rezervace nenalezena nebo neplatný token');
      }

      // Load settings to get contact email
      const settings = await dataManager.getSettings();
      const contactEmail = settings.contactEmail || 'chata@utia.cas.cz';

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
          await this.initializeEditForm();
        }
      }

      // Hide loading, show form
      const loadingState = document.getElementById('loadingState');
      if (loadingState) {
        loadingState.style.display = 'none';
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      this.showError(error.message || 'Nepodařilo se načíst rezervaci');
    }
  }

  /**
   * Calculate days until booking start using DateUtils (SSOT)
   * @returns {number} Days until start (negative if booking has started)
   */
  calculateDaysUntilStart() {
    return DateUtils.calculateDaysUntilStart(this.currentBooking.startDate);
  }

  checkEditDeadline() {
    if (!this.currentBooking || !this.currentBooking.startDate) {
      return false;
    }

    const daysUntilStart = this.calculateDaysUntilStart();
    return daysUntilStart < 3; // Lock if less than 3 days
  }

  displayEditDeadlineWarning() {
    const daysUntilStart = this.calculateDaysUntilStart();

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

    const deadlineMessage = document.getElementById('deadlineMessage');
    if (deadlineMessage) {
      deadlineMessage.innerHTML = `
        Úpravy a zrušení rezervace jsou možné pouze <strong>3 dny před začátkem pobytu</strong>.<br><br>
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
        <strong>💳 Tato rezervace byla zaplacena.</strong><br><br>
        Úpravy a zrušení zaplacených rezervací nejsou možné prostřednictvím editačního odkazu.<br><br>
        Pro změny nebo zrušení rezervace prosím kontaktujte správce systému (administrátora).
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

  async displayReadOnlyBooking() {
    // Load settings first (needed for component)
    const settings = await dataManager.getSettings();
    this.settings = settings;

    // Initialize EditBookingComponent even in locked mode to populate guest names
    this.editComponent = new EditBookingComponent({
      mode: 'user',
      enforceDeadline: true,
      validateSession: null,
      onSubmit: () => {}, // No-op for locked mode
      onDelete: () => {}, // No-op for locked mode
      settings,
    });

    // Load booking data into component (this populates guest names!)
    await this.editComponent.loadBooking(this.currentBooking, settings);

    // Display booking ID
    const bookingIdDisplay = document.getElementById('bookingIdDisplay');
    if (bookingIdDisplay) {
      bookingIdDisplay.textContent = this.currentBooking.id;
    }

    // Now disable ALL inputs including guest names
    const allInputs = document.querySelectorAll(
      '#editBookingForm input, #editBookingForm textarea, #editBookingForm button[type="button"]'
    );
    allInputs.forEach((input) => {
      input.disabled = true;
      input.style.opacity = '0.5';
      input.style.cursor = 'not-allowed';
    });

    // Disable all buttons except cancel
    const editSubmitButton = document.getElementById('editSubmitButton');
    if (editSubmitButton) {
      editSubmitButton.style.display = 'none'; // Hide instead of disable
    }
    const deleteBookingButton = document.getElementById('deleteBookingButton');
    if (deleteBookingButton) {
      deleteBookingButton.style.display = 'none'; // Hide instead of disable
    }

    // Disable tab switching in read-only mode
    const tabButtons = document.querySelectorAll('.edit-tab-btn');
    tabButtons.forEach((btn) => {
      const button = btn;
      button.disabled = true;
      button.style.cursor = 'not-allowed';
      button.style.opacity = '0.6';
      button.onclick = null;
    });

    // Hide calendar
    const editCalendarContainer = document.getElementById('editCalendarContainer');
    if (editCalendarContainer) {
      editCalendarContainer.innerHTML = `
        <div style="padding: 2rem; text-align: center; background: #f3f4f6; border-radius: 8px;">
          <p style="color: #6b7280;">📅 Termín: ${this.currentBooking.startDate} - ${this.currentBooking.endDate}</p>
          <p style="color: #6b7280;">🏠 Pokoje: ${this.currentBooking.rooms.join(', ')}</p>
          <p style="color: #6b7280; margin-top: 1rem;">Úpravy termínu a pokojů nejsou možné.</p>
        </div>
      `;
    }

    // Show billing tab by default (without tab switching functionality)
    const editDatesTab = document.getElementById('editDatesTab');
    if (editDatesTab) {
      editDatesTab.style.display = 'none';
    }
    const editBillingTab = document.getElementById('editBillingTab');
    if (editBillingTab) {
      editBillingTab.style.display = 'block';
    }
  }

  async initializeEditForm() {
    const bookingIdDisplay = document.getElementById('bookingIdDisplay');
    if (bookingIdDisplay) {
      bookingIdDisplay.textContent = this.currentBooking.id;
    }

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
    const editBookingForm = document.getElementById('editBookingForm');
    if (editBookingForm) {
      editBookingForm.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Show form
    const editFormContainerShow = document.getElementById('editFormContainer');
    if (editFormContainerShow) {
      editFormContainerShow.style.display = 'block';
    }
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
        (error.message.includes('jména') || error.message.includes('jméno'))
      ) {
        // Guest names validation error - switch to billing tab and highlight section
        this.editComponent.switchTab('billing');
        this.highlightGuestNamesSection();
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
        await dataManager.deleteProposedBookingsForSession(sessionId);
      }

      await dataManager.updateBookingWithToken(this.currentBooking.id, formData, this.editToken);

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
      await dataManager.deleteBookingWithToken(bookingId, this.editToken);

      this.showSuccess('Rezervace byla úspěšně zrušena!');

      // Sync with server to update data (force refresh)
      try {
        await dataManager.syncWithServer(true);
      } catch (error) {
        console.warn('[EditPage] Pre-redirect sync failed (non-critical):', error);
      }

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
  showNotification(message, type = 'info', duration = 5000) {
    if (window.notificationManager) {
      window.notificationManager.show(message, type, duration);
    } else {
      console.warn('NotificationManager not found:', message);
    }
  }

  showConfirm(message, onConfirm, onCancel = null) {
    if (window.modalDialog) {
      window.modalDialog
        .confirm({
          title: 'Potvrzení',
          message,
          type: 'warning',
          confirmText: 'Potvrdit',
          cancelText: 'Zrušit',
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
      // Fallback
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
