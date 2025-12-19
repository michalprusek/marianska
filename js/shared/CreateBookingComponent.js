/* global DOMUtils */
/**
 * CreateBookingComponent - Manages the booking creation flow
 * Handles single room and bulk booking modals, temporary reservations, and final submission.
 * Uses BookingContactForm for the contact details section.
 */
class CreateBookingComponent {
  constructor(app) {
    this.app = app; // Reference to main BookingApp for shared state (calendar, etc.)
    this.contactForm = null;
    this.isSubmitting = false;
  }

  // FIX 2025-12-08: Delegate to DOMUtils (SSOT for HTML escaping)
  escapeHtml(text) {
    return DOMUtils.escapeHtml(text);
  }

  /**
   * Map technical error messages to user-friendly messages
   * @param {Error} error - The error object
   * @returns {string} - User-friendly error message
   */
  getUserFriendlyError(error) {
    const message = error.message || String(error);

    // Map common technical errors to user-friendly messages
    const errorMappings = [
      {
        pattern: /SQLITE_CONSTRAINT|UNIQUE constraint/i,
        message: 'Termín byl právě zarezervován někým jiným. Zkuste vybrat jiný termín.',
      },
      {
        pattern: /timeout|AbortError|vypršel/i,
        message: 'Server neodpovídá. Zkuste to prosím za chvíli.',
      },
      {
        pattern: /Failed to fetch|NetworkError|network/i,
        message: 'Připojení k serveru selhalo. Zkontrolujte připojení k internetu.',
      },
      {
        pattern: /conflict|obsazen/i,
        message: 'Vybraný termín již není dostupný. Zkuste vybrat jiný termín.',
      },
      {
        pattern: /capacity|kapacita/i,
        message: 'Překročena kapacita pokoje. Zkontrolujte počet hostů.',
      },
      {
        pattern: /validation|validace/i,
        message: 'Některé údaje nejsou správně vyplněny. Zkontrolujte formulář.',
      },
      { pattern: /unauthorized|neautorizovan/i, message: 'Nemáte oprávnění provést tuto akci.' },
    ];

    for (const mapping of errorMappings) {
      if (mapping.pattern.test(message)) {
        return mapping.message;
      }
    }

    // If no mapping found, return a generic message with sanitized original
    return 'Nastala chyba při vytváření rezervace. Zkuste to prosím znovu.';
  }

  /**
   * Initialize the component
   */
  init() {
    // Setup event listeners for global buttons if they exist
    const finalizeBtn = document.getElementById('finalizeReservationsBtn');
    if (finalizeBtn) {
      finalizeBtn.addEventListener('click', () => this.showFinalizeModal());
    }
  }

  /**
   * Show the final booking modal (for single or multiple temp reservations)
   */
  async showFinalizeModal() {
    const modal = document.getElementById('bookingFormModal');
    if (!modal) {
      return;
    }

    // 1. Render Summary
    await this.renderBookingSummary();

    // 2. Render Contact Form
    this.contactForm = new BookingContactForm({
      containerId: 'bookingForm', // The form element itself will be replaced or appended to
      prefix: 'create',
      initialData: {}, // Empty for new booking
      showChristmasCode: await this.checkChristmasCodeRequirement(),
    });

    // We need to clear the form container first because BookingContactForm appends/replaces content
    // But wait, bookingForm is a <form> tag in index.html.
    // BookingContactForm expects a container to render INTO.
    // Let's adjust index.html or the container strategy.
    // For now, let's assume we target a specific div inside the form or the form itself.
    // In index.html, 'bookingForm' is the ID of the <form>.
    // BookingContactForm renders a <div> structure.
    // We should probably render into a div INSIDE the form, or handle the form tag externally.

    // Let's look at index.html again. The form has hardcoded fields.
    // We want to replace those hardcoded fields with our component.
    // So we should clear the form content (except maybe the submit button if we want to keep it separate,
    // but BookingContactForm doesn't render buttons).

    const formContainer = document.getElementById('bookingForm');
    if (formContainer) {
      // Clear existing content but keep the submit buttons if they are inside?
      // Actually, let's look at index.html:
      // <form id="bookingForm"> ... fields ... <div class="form-actions">...buttons...</div> </form>
      // We should probably target a container for fields, and keep buttons separate.
      // Or we can just clear it all and re-render buttons too.
      // For reusable component, it's better if it renders just the fields.

      // Let's create a container for fields if it doesn't exist, or clear the form and re-add buttons.
      // Simpler: Clear form, render fields, render buttons.

      formContainer.innerHTML = ''; // Clear hardcoded fields

      // Create a div for fields
      const fieldsContainer = document.createElement('div');
      fieldsContainer.id = 'createBookingFields';
      formContainer.appendChild(fieldsContainer);

      this.contactForm = new BookingContactForm({
        containerId: 'createBookingFields',
        prefix: 'create',
        showChristmasCode: await this.checkChristmasCodeRequirement(),
      });
      this.contactForm.render();

      // Re-add buttons
      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'form-actions';
      buttonsDiv.style.marginTop = '1.5rem';
      buttonsDiv.style.display = 'flex';
      buttonsDiv.style.gap = '1rem';
      buttonsDiv.innerHTML = `
        <button type="button" class="btn btn-secondary" id="createBookingCancel">
          <span data-translate="cancel">Zrušit</span>
        </button>
        <button type="submit" class="btn btn-primary" id="createBookingSubmit">
          <span data-translate="confirmBooking">Potvrdit rezervaci</span>
        </button>
      `;
      formContainer.appendChild(buttonsDiv);

      // Attach event handlers
      document
        .getElementById('createBookingCancel')
        .addEventListener('click', () => this.hideModal());
      formContainer.onsubmit = (e) => this.handleSubmit(e);
    }

    modal.classList.add('active');
  }

  hideModal() {
    const modal = document.getElementById('bookingFormModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  async checkChristmasCodeRequirement() {
    if (!this.app.tempReservations || this.app.tempReservations.length === 0) {
      return false;
    }

    // Check all dates
    const allDates = [];
    this.app.tempReservations.forEach((res) => {
      const start = new Date(res.startDate);
      const end = new Date(res.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        allDates.push(new Date(d));
      }
    });

    // Check if any date is in Christmas period
    for (const date of allDates) {
      if (await dataManager.isChristmasPeriod(date)) {
        const settings = await dataManager.getSettings();
        const { codeRequired } = dataManager.checkChristmasAccessRequirement(
          settings.christmasPeriod?.start,
          this.app.tempReservations.some((r) => r.isBulkBooking)
        );
        if (codeRequired) {
          return true;
        }
      }
    }
    return false;
  }

  async renderBookingSummary() {
    const summaryDiv = document.getElementById('bookingSummary');
    if (!summaryDiv) {
      return;
    }

    let html = '';
    let totalPrice = 0;
    const lang = typeof langManager !== 'undefined' ? langManager.currentLang : 'cs';

    // Group by reservation - use escapeHtml to prevent XSS
    for (const res of this.app.tempReservations) {
      // Translate room name - "Pokoj" → "Room"
      let roomName = res.roomName || res.roomNames || (lang === 'cs' ? 'Pokoj' : 'Room');
      if (lang === 'en' && roomName.startsWith('Pokoj')) {
        roomName = roomName.replace('Pokoj', 'Room');
      }
      const safeRoomName = this.escapeHtml(roomName);
      const safeStartDate = this.escapeHtml(
        DateUtils.formatDateDisplay(new Date(res.startDate), lang)
      );
      const safeEndDate = this.escapeHtml(DateUtils.formatDateDisplay(new Date(res.endDate), lang));
      const adults = parseInt(res.guests?.adults, 10) || 0;
      const children = parseInt(res.guests?.children, 10) || 0;
      const toddlers = parseInt(res.guests?.toddlers, 10) || 0;
      const price = parseFloat(res.totalPrice) || 0;

      const adultsLabel = lang === 'cs' ? 'dosp.' : 'adults';
      const childrenLabel = lang === 'cs' ? 'dětí' : 'children';
      const toddlersLabel = lang === 'cs' ? 'batolat' : 'toddlers';

      html += `
        <div class="summary-item" style="border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
          <div style="font-weight: bold;">${safeRoomName}</div>
          <div>${safeStartDate} - ${safeEndDate}</div>
          <div>${adults} ${adultsLabel}, ${children} ${childrenLabel}, ${toddlers} ${toddlersLabel}</div>
          <div style="font-weight: bold; color: var(--primary-color);">${price.toLocaleString('cs-CZ')} Kč</div>
        </div>
      `;
      totalPrice += price;
    }

    const totalLabel = lang === 'en' ? 'Total:' : 'Celkem:';
    html += `
      <div class="summary-total" style="margin-top: 1rem; font-size: 1.2rem; text-align: right;">
        <strong>${totalLabel} <span style="color: var(--primary-color);">${totalPrice.toLocaleString('cs-CZ')} Kč</span></strong>
      </div>
    `;

    summaryDiv.innerHTML = html;
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (this.isSubmitting) {
      return;
    }

    // Validate form
    const validation = this.contactForm.validate();
    if (!validation.valid) {
      this.app.showNotification(validation.error, 'error');
      return;
    }

    const formData = this.contactForm.getData();

    // Additional validation: Christmas code if required
    const christmasCodeRequired = await this.checkChristmasCodeRequirement();
    if (christmasCodeRequired && !formData.christmasCode) {
      this.app.showNotification('Pro vánoční období je vyžadován přístupový kód.', 'error');
      return;
    }

    // Validate Christmas code if provided
    if (christmasCodeRequired && formData.christmasCode) {
      const settings = await dataManager.getSettings();
      const validCodes = settings.christmasAccessCodes || [];
      if (!validCodes.includes(formData.christmasCode.trim().toUpperCase())) {
        this.app.showNotification('Neplatný vánoční přístupový kód.', 'error');
        return;
      }
    }

    // Validate room limits for Christmas period (max 2 rooms before October 1st)
    const isBulkBooking = this.app.tempReservations.some((r) => r.isBulkBooking);
    if (!isBulkBooking && christmasCodeRequired) {
      const totalRooms = this.app.tempReservations.reduce(
        (sum, res) => sum + (res.roomIds ? res.roomIds.length : 1),
        0
      );
      if (totalRooms > 2) {
        this.app.showNotification('V období Vánoc lze rezervovat maximálně 2 pokoje.', 'error');
        return;
      }
    }

    this.isSubmitting = true;
    const submitBtn = document.getElementById('createBookingSubmit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Zpracování...';
    }

    try {
      // Create consolidated booking from temporary reservations
      await this.createBookings(formData);

      this.app.showNotification('Rezervace úspěšně vytvořena!', 'success');
      this.hideModal();

      // Cleanup
      this.app.tempReservations = [];
      await this.app.displayTempReservations(); // Update UI
      await this.app.renderCalendar(); // Refresh calendar
    } catch (error) {
      console.error('Booking creation failed:', error);
      // Use user-friendly error message instead of raw error.message
      const userMessage = this.getUserFriendlyError(error);
      this.app.showNotification(userMessage, 'error');
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Potvrdit rezervaci';
      }
    }
  }

  async createBookings(formData) {
    // Validate we have reservations to process
    if (!this.app.tempReservations || this.app.tempReservations.length === 0) {
      throw new Error('Žádné rezervace k vytvoření');
    }

    // FIX 2025-12-09: Use grouped booking API to create all reservations in one transaction
    // This enables composite bookings where multiple intervals are linked together
    const reservations = this.app.tempReservations.map((res) => {
      const roomIds = res.isBulkBooking ? res.roomIds || [] : [res.roomId];

      const perRoomGuests = {};
      const perRoomDates = {};

      roomIds.forEach((rid) => {
        if (!rid) {
          return;
        }

        perRoomGuests[rid] = {
          adults: res.guests?.adults || 0,
          children: res.guests?.children || 0,
          toddlers: res.guests?.toddlers || 0,
          guestType: res.guestType || 'utia',
        };

        perRoomDates[rid] = {
          startDate: res.startDate,
          endDate: res.endDate,
        };
      });

      // Collect guest names for this reservation
      const guestNames = [];
      if (res.guestNames && Array.isArray(res.guestNames)) {
        const defaultRoomId = res.isBulkBooking ? roomIds[0] || null : res.roomId;
        res.guestNames.forEach((guest) => {
          guestNames.push({
            ...guest,
            roomId: guest.roomId || defaultRoomId,
          });
        });
      }

      return {
        rooms: roomIds,
        startDate: res.startDate,
        endDate: res.endDate,
        totalPrice: res.totalPrice || 0,
        isBulkBooking: res.isBulkBooking || false,
        guestNames,
        perRoomGuests,
        perRoomDates,
      };
    });

    // Build grouped payload
    const groupedPayload = {
      sessionId: this.app.sessionId,
      reservations,
      contact: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        company: formData.company || '',
        address: formData.address || '',
        city: formData.city || '',
        zip: formData.zip || '',
        ico: formData.ico || '',
        dic: formData.dic || '',
        notes: formData.notes || '',
      },
      christmasCode: formData.christmasCode || null,
    };

    // Call grouped booking API
    const result = await dataManager.createGroupedBooking(groupedPayload);

    // Cleanup proposed bookings client-side as a fallback
    // (Server cleans up via deleteProposedBookingsBySession, but network issues may prevent that)
    for (const res of this.app.tempReservations) {
      if (res.proposalId) {
        try {
          await dataManager.deleteProposedBooking(res.proposalId);
        } catch (cleanupError) {
          // Log for debugging - server should have cleaned up, but track if it didn't
          console.warn('[CreateBookingComponent] Failed to cleanup proposed booking:', {
            proposalId: res.proposalId,
            error: cleanupError.message,
          });
          // Don't throw - booking was successful, cleanup is best-effort
        }
      }
    }

    // Return result from grouped API
    return result;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CreateBookingComponent;
} else if (typeof window !== 'undefined') {
  window.CreateBookingComponent = CreateBookingComponent;
}
