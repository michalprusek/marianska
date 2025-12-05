// Utils module - helper functions and utilities
class UtilsModule {
  constructor(app) {
    this.app = app;
  }

  formatDateDisplay(date) {
    // Delegate to DateUtils for SSOT
    return DateUtils.formatDateDisplay(date, this.app.currentLanguage);
  }

  getDateRanges(dates) {
    // Delegate to DateUtils for SSOT
    return DateUtils.getDateRanges(dates);
  }

  async showBookingDetails(date, roomId) {
    const booking = await dataManager.getBookingForRoom(date, roomId);
    if (!booking) {
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';

    const isChristmas = await dataManager.isChristmasPeriod(date);

    modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>${this.app.currentLanguage === 'cs' ? 'Detail rezervace' : 'Booking Details'}</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body" style="padding: 2rem;">
                    ${isChristmas ? '<div class="christmas-badge" style="margin-bottom: 1rem;">🎄 Vánoční období</div>' : ''}

                    <div class="booking-detail-grid" style="display: grid; gap: 1.5rem;">
                        <div class="detail-section">
                            <h3 style="color: var(--primary-600); margin-bottom: 1rem;">
                                ${this.app.currentLanguage === 'cs' ? 'Informace o rezervaci' : 'Booking Information'}
                            </h3>
                            <div class="detail-row" style="margin-bottom: 0.5rem;">
                                <strong>${this.app.currentLanguage === 'cs' ? 'Číslo rezervace:' : 'Booking ID:'}</strong>
                                <span style="font-family: monospace;">${booking.id}</span>
                            </div>
                            ${BookingDisplayUtils.renderPerRoomDetailsHTML(booking, this.app.currentLanguage)}
                        </div>


                        ${booking.notes
        ? `
                        <div class="detail-section">
                            <h3 style="color: var(--primary-600); margin-bottom: 1rem;">
                                ${this.app.currentLanguage === 'cs' ? 'Poznámky' : 'Notes'}
                            </h3>
                            <p style="color: var(--gray-600);">${booking.notes}</p>
                        </div>`
        : ''
      }


                        <!-- Public Contact Form Section (for everyone) -->
                        <div class="detail-section public-contact-section" style="border-top: 2px solid var(--gray-200); padding-top: 1.5rem;">
                            <h3 style="color: var(--primary-600); margin-bottom: 1rem;">
                                <span style="margin-right: 0.5rem;">✉️</span>
                                ${this.app.currentLanguage === 'cs' ? 'Kontaktovat vlastníka rezervace' : 'Contact Booking Owner'}
                            </h3>
                            <p style="color: var(--gray-600); margin-bottom: 1rem; font-size: 0.9rem;">
                                ${this.app.currentLanguage === 'cs'
        ? 'Odešlete zprávu vlastníkovi této rezervace. Vaše zpráva bude předána na jejich email.'
        : 'Send a message to the owner of this booking. Your message will be forwarded to their email.'
      }
                            </p>

                            <form id="publicContactForm" onsubmit="return false;">
                                <div style="margin-bottom: 1rem;">
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--gray-700);">
                                        ${this.app.currentLanguage === 'cs' ? 'Váš email:' : 'Your email:'}
                                    </label>
                                    <input
                                        type="email"
                                        id="publicContactEmail"
                                        required
                                        style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 0.95rem;"
                                        placeholder="${this.app.currentLanguage === 'cs' ? 'vas@email.cz' : 'your@email.com'}"
                                    >
                                </div>

                                <div style="margin-bottom: 1.5rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                        <label style="font-weight: 600; color: var(--gray-700);">
                                            ${this.app.currentLanguage === 'cs' ? 'Zpráva:' : 'Message:'}
                                        </label>
                                        <span id="publicCharCounter" style="font-size: 0.85rem; color: var(--gray-500);">0/500</span>
                                    </div>
                                    <textarea
                                        id="publicContactMessage"
                                        required
                                        rows="4"
                                        maxlength="500"
                                        oninput="document.getElementById('publicCharCounter').textContent = this.value.length + '/500'; document.getElementById('publicCharCounter').style.color = this.value.length >= 500 ? 'var(--danger-600)' : 'var(--gray-500)';"
                                        style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 0.95rem; resize: vertical; min-height: 100px;"
                                        placeholder="${this.app.currentLanguage === 'cs'
        ? 'Napište svou zprávu ohledně této rezervace...'
        : 'Write your message regarding this booking...'
      }"
                                    ></textarea>
                                </div>

                                <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                                    <button
                                        type="button"
                                        onclick="this.closest('.modal').remove()"
                                        style="padding: 0.75rem 1.5rem; background: var(--gray-100); color: var(--gray-700); border: 1px solid var(--gray-300); border-radius: var(--radius-md); cursor: pointer; font-weight: 500;"
                                    >
                                        ${this.app.currentLanguage === 'cs' ? 'Zrušit' : 'Cancel'}
                                    </button>
                                    <button
                                        type="submit"
                                        onclick="window.app.utils.sendContactMessage('${booking.id}', document.getElementById('publicContactEmail').value, document.getElementById('publicContactMessage').value, this.closest('.modal'))"
                                        style="padding: 0.75rem 1.5rem; background: var(--primary-600); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 500;"
                                    >
                                        <span style="margin-right: 0.5rem;">📤</span>
                                        ${this.app.currentLanguage === 'cs' ? 'Odeslat zprávu' : 'Send Message'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
      modal.classList.add('active');
    });
  }

  async sendContactMessage(bookingId, fromEmail, message, modalElement) {
    // Validate inputs using ValidationUtils
    if (!fromEmail || !message || !ValidationUtils.validateEmail(fromEmail)) {
      let errorMsg;
      if (!fromEmail || !message) {
        errorMsg =
          this.app.currentLanguage === 'cs'
            ? 'Vyplňte prosím všechna pole'
            : 'Please fill in all fields';
      } else {
        errorMsg = ValidationUtils.getValidationError('email', fromEmail, this.app.currentLanguage);
      }
      this.showNotification(errorMsg, 'error');
      return;
    }

    // Validate message length (must be between 10 and 500 characters)
    if (message.length < 10) {
      this.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Zpráva musí mít alespoň 10 znaků'
          : 'Message must be at least 10 characters',
        'error'
      );
      return;
    }

    if (message.length > 500) {
      this.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Zpráva je příliš dlouhá (max 500 znaků)'
          : 'Message is too long (max 500 characters)',
        'error'
      );
      return;
    }

    // Disable the button during sending
    const submitButton = modalElement.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent =
      this.app.currentLanguage === 'cs' ? '⏳ Odesílám...' : '⏳ Sending...';

    try {
      const success = await dataManager.sendContactMessage(bookingId, fromEmail, message);

      if (success) {
        this.showNotification(
          this.app.currentLanguage === 'cs'
            ? '✓ Zpráva byla úspěšně odeslána'
            : '✓ Message sent successfully',
          'success'
        );

        // Close the modal
        modalElement.remove();
      }
    } catch (error) {
      console.error('Error sending contact message:', error);
      // Use the actual error message from server if available
      const errorMessage =
        error.message ||
        (this.app.currentLanguage === 'cs'
          ? 'Chyba při odesílání zprávy. Zkuste to prosím znovu.'
          : 'Error sending message. Please try again.');

      this.showNotification(errorMessage, 'error');

      // Re-enable the button
      submitButton.disabled = false;
      submitButton.innerHTML = originalText;
    }
  }

  showBlockedReason(availability) {
    const modal = document.createElement('div');
    modal.className = 'modal';

    modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>${this.app.currentLanguage === 'cs' ? 'Blokovaný termín' : 'Blocked Date'}</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body" style="padding: 2rem; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🚫</div>
                    <h3 style="color: var(--danger-600); margin-bottom: 1rem;">
                        ${this.app.currentLanguage === 'cs' ? 'Tento termín je blokovaný' : 'This date is blocked'}
                    </h3>
                    ${availability.reason
        ? `
                        <p style="color: var(--gray-600); margin-bottom: 0.5rem;">
                            <strong>${this.app.currentLanguage === 'cs' ? 'Důvod:' : 'Reason:'}</strong>
                        </p>
                        <p style="color: var(--gray-700); font-size: 1.1rem;">
                            ${availability.reason}
                        </p>
                    `
        : ''
      }
                </div>
            </div>
        `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => {
      modal.classList.add('active');
    });
  }

  showNotification(message, type = 'info', duration = 5000) {
    // Delegate to shared SSOT implementation in domUtils.js
    if (window.DOMUtils && window.DOMUtils.showNotification) {
      window.DOMUtils.showNotification(message, type, duration);
    } else {
      // Fallback if DOMUtils not loaded (shouldn't happen)
      console.warn('DOMUtils.showNotification not available:', message);
    }
  }

  updateBookingButton() {
    const bookBtn = document.getElementById('makeBookingBtn');
    if (!bookBtn) {
      return;
    }

    const hasSelection = this.app.selectedDates.size > 0 && this.app.selectedRooms.size > 0;

    if (hasSelection) {
      bookBtn.disabled = false;
      bookBtn.innerHTML = `
                <span>${this.app.currentLanguage === 'cs' ? 'Pokračovat k rezervaci' : 'Continue to Booking'}</span>
                <span class="selection-count">${this.app.selectedDates.size} ${this.app.currentLanguage === 'cs' ? 'nocí' : 'nights'}, ${this.app.selectedRooms.size} ${this.app.currentLanguage === 'cs' ? 'pokojů' : 'rooms'}</span>
            `;
    } else {
      bookBtn.disabled = true;
      bookBtn.innerHTML = `<span>${this.app.currentLanguage === 'cs' ? 'Vyberte termín a pokoje' : 'Select Dates and Rooms'}</span>`;
    }
  }

  updateSelectedDatesDisplay() {
    const display = document.getElementById('selectedDatesDisplay');
    const confirmBtn = document.getElementById('confirmSingleRoomBtn');

    // NEW: Also update dateSelectionSummary in single room booking modal
    const dateSelectionSummary = document.getElementById('dateSelectionSummary');
    const selectedDateRange = document.getElementById('selectedDateRange');
    const nightsCount = document.getElementById('nightsCount');

    // Calculate total nights (selected days - 1)
    const totalNights = Math.max(0, this.app.selectedDates.size - 1);

    if (this.app.selectedDates.size === 0) {
      if (display) {
        display.style.display = 'none';
      }
      // Hide dateSelectionSummary when no dates selected
      if (dateSelectionSummary) {
        dateSelectionSummary.style.display = 'none';
      }
      // Disable the confirm button when no dates are selected
      if (confirmBtn) {
        confirmBtn.disabled = true;
      }
      return;
    }

    if (display) {
      display.style.display = 'block';
    }

    // Show dateSelectionSummary when dates are selected
    if (dateSelectionSummary) {
      dateSelectionSummary.style.display = 'block';
    }

    // Enable/disable the confirm button based on nights
    if (confirmBtn) {
      confirmBtn.disabled = totalNights === 0;
    }

    const sortedDates = Array.from(this.app.selectedDates).sort();
    const ranges = this.getDateRanges(sortedDates);

    // Get the first (and typically only) date range for display
    const firstRange = ranges[0];
    if (firstRange) {
      const start = new Date(firstRange.start);
      const end = new Date(firstRange.end);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const nights = days - 1;

      // Update dateSelectionSummary elements (single room modal)
      if (selectedDateRange) {
        if (firstRange.start === firstRange.end) {
          selectedDateRange.textContent = this.formatDateDisplay(start);
        } else {
          selectedDateRange.textContent = `${this.formatDateDisplay(start)} - ${this.formatDateDisplay(end)}`;
        }
      }
      if (nightsCount) {
        nightsCount.textContent = nights.toString();
      }
    }

    // Update selectedDatesDisplay (if exists - for other modals)
    if (display) {
      let html = '<div class="selected-dates-list">';
      ranges.forEach((range) => {
        const start = new Date(range.start);
        const end = new Date(range.end);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        const nights = days - 1; // nights = days - 1

        if (range.start === range.end) {
          html += `<div class="selected-date-range">
                      <span>${this.formatDateDisplay(start)}</span>
                      <span class="nights-count">0 ${this.app.currentLanguage === 'cs' ? 'nocí' : 'nights'}</span>
                  </div>`;
        } else {
          let nightsLabel;
          if (this.app.currentLanguage === 'cs') {
            if (nights === 1) {
              nightsLabel = 'noc';
            } else if (nights < 5) {
              nightsLabel = 'noci';
            } else {
              nightsLabel = 'nocí';
            }
          } else {
            nightsLabel = nights === 1 ? 'night' : 'nights';
          }

          html += `<div class="selected-date-range">
                      <span>${this.formatDateDisplay(start)} - ${this.formatDateDisplay(end)}</span>
                      <span class="nights-count">${nights} ${nightsLabel}</span>
                  </div>`;
        }
      });
      html += '</div>';

      display.innerHTML = html;
    }
  }

  async updatePriceCalculation() {
    const priceEl = document.getElementById('totalPrice');
    const nightsEl = document.getElementById('nightsMultiplier');
    const perNightEl = document.getElementById('pricePerNight');
    const basePriceEl = document.getElementById('basePrice');
    const priceBreakdownEl = document.getElementById('priceBreakdown');

    if (!priceEl) {
      return;
    }

    try {
      // Hide price breakdown if no dates selected
      if (this.app.selectedDates.size === 0) {
        if (priceBreakdownEl) {
          priceBreakdownEl.style.display = 'none';
        }
        priceEl.textContent = '0 Kč';
        return;
      }

      // Show price breakdown when dates are selected
      if (priceBreakdownEl) {
        priceBreakdownEl.style.display = 'block';
      }

      // Helper: Collect guest names with price types from current selection
      const collectGuestNamesFromDOM = () => {
        // Try to get from single room modal if open
        if (window.app && window.app.singleRoomBooking) {
          // Don't show validation errors during price updates (only during final submission)
          const collected = window.app.singleRoomBooking.collectGuestNames(false);
          if (collected && collected.length > 0) {
            return collected;
          }
        }

        // Fallback: Return empty array (will use fallback guest type)
        return [];
      };

      // Get current settings
      const settings = await dataManager.getSettings();

      // Calculate nights as selected days - 1
      const nights = Math.max(0, this.app.selectedDates.size - 1);

      if (nights === 0) {
        priceEl.textContent = '0 Kč';
        if (nightsEl) {
          nightsEl.textContent = '0';
        }
        if (perNightEl) {
          perNightEl.textContent = '0 Kč';
        }
        return;
      }

      // Determine which rooms to calculate price for
      let roomsToCalculate;
      if (this.app.selectedRooms.size > 0) {
        roomsToCalculate = this.app.selectedRooms;
      } else if (this.app.currentBookingRoom) {
        roomsToCalculate = new Set([this.app.currentBookingRoom]);
      } else {
        roomsToCalculate = new Set();
      }

      // Prepare perRoomGuests data for PriceCalculator
      const perRoomGuests = [];
      const guestNames = collectGuestNamesFromDOM(); // Get specific guest details from modal

      for (const roomId of roomsToCalculate) {
        const guests = this.app.roomGuests.get(roomId) || { adults: 1, children: 0, toddlers: 0 };
        const guestType = this.app.roomGuestTypes.get(roomId) || 'utia';

        // Determine detailed guest counts (ÚTIA vs External)
        let utiaAdults = 0;
        let externalAdults = 0;
        let utiaChildren = 0;
        let externalChildren = 0;

        // If we are in single room modal for this room, use the detailed guest names
        if (this.app.currentBookingRoom === roomId && guestNames.length > 0) {
          guestNames.forEach(g => {
            if (g.personType === 'adult') {
              if (g.guestPriceType === 'utia') utiaAdults++; else externalAdults++;
            } else if (g.personType === 'child') {
              if (g.guestPriceType === 'utia') utiaChildren++; else externalChildren++;
            }
          });
        } else {
          // Fallback to generic counts using the room's guestType
          if (guestType === 'utia') {
            utiaAdults = guests.adults;
            utiaChildren = guests.children;
          } else {
            externalAdults = guests.adults;
            externalChildren = guests.children;
          }
        }

        perRoomGuests.push({
          roomId,
          adults: guests.adults,
          children: guests.children,
          toddlers: guests.toddlers,
          guestType, // Fallback type
          utiaAdults,
          externalAdults,
          utiaChildren,
          externalChildren
        });
      }

      // CALL SSOT: PriceCalculator
      const priceResult = PriceCalculator.calculatePerRoomPrices({
        rooms: Array.from(roomsToCalculate),
        nights,
        settings,
        perRoomGuests
      });

      const { grandTotal, rooms: roomDetails } = priceResult;
      const pricePerNight = Math.round(grandTotal / nights);

      // Update main price displays
      priceEl.textContent = `${grandTotal.toLocaleString('cs-CZ')} Kč`;
      if (nightsEl) {
        nightsEl.textContent = nights;
      }
      if (perNightEl) {
        perNightEl.textContent = `${pricePerNight.toLocaleString('cs-CZ')} Kč`;
      }

      // Update breakdown displays (Base Price, Surcharges)
      // We use the first room's details for the single room modal display
      // (or sum them up if that makes sense, but UI seems designed for single room focus)
      if (roomDetails.length > 0) {
        const mainRoom = roomDetails[0]; // Use first room for display

        // Base Price
        if (basePriceEl) {
          basePriceEl.textContent = `${mainRoom.emptyRoomPrice.toLocaleString('cs-CZ')} Kč`;
        }

        // Update single room modal specific elements
        const modal = document.getElementById('singleRoomBookingModal');
        if (modal && modal.classList.contains('active')) {
          const modalTotalEl = modal.querySelector('#totalPrice');
          if (modalTotalEl) {
            modalTotalEl.textContent = `${grandTotal.toLocaleString('cs-CZ')} Kč`;
          }

          // Update guest counts summary
          const guestCountsSummary = document.getElementById('guestCountsSummary');
          if (guestCountsSummary) {
            const guests = this.app.roomGuests.get(mainRoom.roomId) || { adults: 1, children: 0, toddlers: 0 };
            const parts = [];
            if (guests.adults > 0) parts.push(`${guests.adults} ${langManager.t('adultsShort')}`);
            if (guests.children > 0) parts.push(`${guests.children} ${langManager.t('childrenShort')}`);
            if (guests.toddlers > 0) parts.push(`${guests.toddlers} ${langManager.t('toddlersShort')}`);
            guestCountsSummary.textContent = parts.join(', ') || '0';
          }

          // Update Adult Surcharge
          const adultsPrice = document.getElementById('adultsPrice');
          const adultsSurcharge = document.getElementById('adultsSurcharge');
          if (adultsPrice && adultsSurcharge) {
            if (mainRoom.adultsPrice > 0) {
              // We don't have the exact rate per person easily available here without recalculating
              // or inspecting settings again, but we have the total surcharge.
              // To show "X × Y Kč", we can try to derive it or just show the total.
              // The original code showed breakdown. Let's try to keep it if possible.
              // PriceCalculator returns total adultsPrice.
              // We can show just the total for now to be safe and accurate.
              adultsSurcharge.textContent = `${mainRoom.adultsPrice.toLocaleString('cs-CZ')} Kč`;
              adultsPrice.style.display = 'flex';
            } else {
              adultsPrice.style.display = 'none';
            }
          }

          // Update Children Surcharge
          const childrenPrice = document.getElementById('childrenPrice');
          const childrenSurcharge = document.getElementById('childrenSurcharge');
          if (childrenPrice && childrenSurcharge) {
            if (mainRoom.childrenPrice > 0) {
              childrenSurcharge.textContent = `${mainRoom.childrenPrice.toLocaleString('cs-CZ')} Kč`;
              childrenPrice.style.display = 'flex';
            } else {
              childrenPrice.style.display = 'none';
            }
          }

          // Update Toddlers Info
          const toddlersSummary = document.getElementById('toddlersSummary');
          const toddlersInfo = document.getElementById('toddlersInfo');
          if (toddlersSummary && toddlersInfo) {
            const guests = this.app.roomGuests.get(mainRoom.roomId) || { toddlers: 0 };
            if (guests.toddlers > 0) {
              const freeLabel = langManager.t('toddlersFreeLabel');
              toddlersSummary.textContent = `${guests.toddlers} ${freeLabel}`;
              toddlersInfo.style.display = 'flex';
            } else {
              toddlersInfo.style.display = 'none';
            }
          }

          // Enable/disable confirm button
          const confirmBtn = document.getElementById('confirmSingleRoomBtn');
          if (confirmBtn) {
            confirmBtn.disabled = nights === 0;
          }
        }
      }

    } catch (error) {
      console.error('Price calculation failed:', error);
      if (priceEl) {
        priceEl.textContent = 'Chyba';
        priceEl.style.color = 'red';
      }
      if (this.showNotification) {
        this.showNotification(
          'Nepodařilo se spočítat cenu.',
          'error',
          5000
        );
      }
      if (priceBreakdownEl) {
        priceBreakdownEl.style.display = 'none';
      }
    }
  }

  changeLanguage(lang) {
    this.app.currentLanguage = lang;
    localStorage.setItem('language', lang);
    this.app.updateTranslations();
    this.app.renderCalendar();
  }

  updateTranslations() {
    document.querySelectorAll('[data-cs][data-en]').forEach((el) => {
      const element = el;
      element.textContent = element.getAttribute(`data-${this.app.currentLanguage}`);
    });
  }
}
