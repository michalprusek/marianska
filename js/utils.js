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


                        ${
                          booking.notes
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
                                ${
                                  this.app.currentLanguage === 'cs'
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
                                        placeholder="${
                                          this.app.currentLanguage === 'cs'
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
                    ${
                      availability.reason
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

    if (!display) {
      return;
    }

    if (this.app.selectedDates.size === 0) {
      display.style.display = 'none';
      // Disable the confirm button when no dates are selected
      if (confirmBtn) {
        confirmBtn.disabled = true;
      }
      return;
    }

    display.style.display = 'block';

    // Calculate total nights (selected days - 1)
    const totalNights = Math.max(0, this.app.selectedDates.size - 1);

    // Enable/disable the confirm button based on nights
    if (confirmBtn) {
      confirmBtn.disabled = totalNights === 0;
    }

    const sortedDates = Array.from(this.app.selectedDates).sort();
    const ranges = this.getDateRanges(sortedDates);

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

      // Get current settings and prices
      const settings = await dataManager.getSettings();
      const prices = settings.prices || PriceCalculator.getDefaultPrices();

      // Determine the current guest type for base price display
      let currentGuestType = 'utia';
      let currentRoomId = null;
      if (this.app.currentBookingRoom) {
        currentGuestType = this.app.roomGuestTypes.get(this.app.currentBookingRoom) || 'utia';
        currentRoomId = this.app.currentBookingRoom;
      } else if (this.app.selectedRooms.size > 0) {
        const firstRoom = Array.from(this.app.selectedRooms)[0];
        currentGuestType = this.app.roomGuestTypes.get(firstRoom) || 'utia';
        currentRoomId = firstRoom;
      }

      // Get base price based on current guest type AND room size (NEW 2025-10-17)
      const guestKey = currentGuestType === 'utia' ? 'utia' : 'external';
      const priceConfig = prices[guestKey];

      // Get rooms list (needed for room-size-based pricing)
      const rooms = await dataManager.getRooms();

      // Check if room-size-based pricing is enabled
      const hasRoomSizes = priceConfig?.small && priceConfig?.large;
      let baseRoomPrice = 298; // Fallback

      if (hasRoomSizes && currentRoomId) {
        // NEW: Get room type (small/large) from settings
        const room = rooms.find((r) => r.id === currentRoomId);
        const roomType = room?.type || 'small';
        const roomPriceConfig = priceConfig[roomType] || priceConfig.small;
        // Calculate base room price: price with 1 person minus adult surcharge
        baseRoomPrice = roomPriceConfig.base - roomPriceConfig.adult;
      } else if (priceConfig?.base && priceConfig?.adult) {
        // LEGACY: Flat pricing model - also subtract adult surcharge
        baseRoomPrice = priceConfig.base - priceConfig.adult;
      }

      // Always update base price display
      if (basePriceEl) {
        basePriceEl.textContent = `${baseRoomPrice.toLocaleString('cs-CZ')} Kč`;
      }

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

      // Calculate total price
      let totalPrice = 0;
      let pricePerNight = 0;

      // Determine which rooms to calculate price for
      let roomsToCalculate;
      if (this.app.selectedRooms.size > 0) {
        roomsToCalculate = this.app.selectedRooms;
      } else if (this.app.currentBookingRoom) {
        roomsToCalculate = new Set([this.app.currentBookingRoom]);
      } else {
        roomsToCalculate = new Set();
      }

      // Calculate price per room using PER-GUEST pricing
      const roomPrices = Array.from(roomsToCalculate).map((roomId) => {
        const guests = this.app.roomGuests.get(roomId) || { adults: 1, children: 0, toddlers: 0 };
        const fallbackGuestType = this.app.roomGuestTypes.get(roomId) || 'utia';

        // Get individual guest names with price types
        const guestNames = collectGuestNamesFromDOM();

        // If we have guest names with price types, use per-guest calculation
        if (guestNames.length > 0) {
          return PriceCalculator.calculatePerGuestPrice({
            rooms: [roomId],
            guestNames,
            nights: 1, // Per night calculation
            settings,
            fallbackGuestType,
          });
        }

        // Fallback to old method if no guest names available
        return dataManager.calculatePrice(
          fallbackGuestType,
          guests.adults,
          guests.children,
          guests.toddlers,
          1,
          [roomId]
        );
      });
      pricePerNight = roomPrices.reduce((sum, price) => sum + price, 0);

      totalPrice = pricePerNight * nights;

      // Update all price displays
      priceEl.textContent = `${totalPrice.toLocaleString('cs-CZ')} Kč`;
      if (nightsEl) {
        nightsEl.textContent = nights;
      }
      if (perNightEl) {
        perNightEl.textContent = `${pricePerNight.toLocaleString('cs-CZ')} Kč`;
      }

      // Also update single room modal price displays
      const modal = document.getElementById('singleRoomBookingModal');
      if (modal && modal.classList.contains('active')) {
        // Find the "Celkem:" element in the modal and update its sibling
        const modalTotalEl = modal.querySelector('#totalPrice');

        if (modalTotalEl) {
          modalTotalEl.textContent = `${totalPrice.toLocaleString('cs-CZ')} Kč`;
        }

        // Update guest counts and surcharges display
        if (this.app.currentBookingRoom) {
          const guests = this.app.roomGuests.get(this.app.currentBookingRoom) || {
            adults: 1,
            children: 0,
            toddlers: 0,
          };
          const guestType = this.app.roomGuestTypes.get(this.app.currentBookingRoom) || 'utia';
          const roomGuestKey = guestType === 'utia' ? 'utia' : 'external';
          let roomPriceConfig = prices[roomGuestKey];

          // NEW 2025-10-17: Get room-size-specific price config
          if (hasRoomSizes && currentRoomId) {
            const roomToFind = rooms.find((r) => r.id === currentRoomId);
            const roomTypeForSurcharge = roomToFind?.type || 'small';
            roomPriceConfig = roomPriceConfig[roomTypeForSurcharge] || roomPriceConfig.small;
          }

          // Update guest counts summary
          const guestCountsSummary = document.getElementById('guestCountsSummary');
          if (guestCountsSummary) {
            const parts = [];
            if (guests.adults > 0) {
              parts.push(`${guests.adults} ${langManager.t('adultsShort')}`);
            }
            if (guests.children > 0) {
              parts.push(`${guests.children} ${langManager.t('childrenShort')}`);
            }
            if (guests.toddlers > 0) {
              parts.push(`${guests.toddlers} ${langManager.t('toddlersShort')}`);
            }
            guestCountsSummary.textContent = parts.join(', ') || '0';
          }

          // Calculate and show adult surcharge
          const adultsPrice = document.getElementById('adultsPrice');
          const adultsSurcharge = document.getElementById('adultsSurcharge');
          if (adultsPrice && adultsSurcharge && roomPriceConfig) {
            // Count surcharge for ALL adults
            const totalAdults = Math.max(0, guests.adults);
            if (totalAdults > 0) {
              const surcharge = totalAdults * roomPriceConfig.adult;
              adultsSurcharge.textContent = `${surcharge.toLocaleString('cs-CZ')} Kč (${totalAdults} × ${roomPriceConfig.adult} Kč)`;
              adultsPrice.style.display = 'flex';
            } else {
              adultsPrice.style.display = 'none';
            }
          }

          // Calculate and show children surcharge
          const childrenPrice = document.getElementById('childrenPrice');
          const childrenSurcharge = document.getElementById('childrenSurcharge');
          if (childrenPrice && childrenSurcharge && roomPriceConfig) {
            if (guests.children > 0) {
              const surcharge = guests.children * roomPriceConfig.child;
              childrenSurcharge.textContent = `${surcharge.toLocaleString('cs-CZ')} Kč (${guests.children} × ${roomPriceConfig.child} Kč)`;
              childrenPrice.style.display = 'flex';
            } else {
              childrenPrice.style.display = 'none';
            }
          }

          // Update toddlers info
          const toddlersSummary = document.getElementById('toddlersSummary');
          const toddlersInfo = document.getElementById('toddlersInfo');
          if (toddlersSummary && toddlersInfo) {
            if (guests.toddlers > 0) {
              // Use translation for "free" label
              const freeLabel = langManager.t('toddlersFreeLabel');
              toddlersSummary.textContent = `${guests.toddlers} ${freeLabel}`;
              toddlersInfo.style.display = 'flex';
            } else {
              toddlersInfo.style.display = 'none';
            }
          }
        }

        // Also enable/disable the confirm button based on selection
        const confirmBtn = document.getElementById('confirmSingleRoomBtn');
        if (confirmBtn) {
          confirmBtn.disabled = nights === 0;
        }

        // KRITICKÉ: Po změně data přepočítat cenu pomocí updatePriceForCurrentRoom()
        // Tato funkce čte aktuální stav UI (toggle přepínače ÚTIA/External)
        // a přepočítá cenu podle aktuálně vybraných typů hostů.
        // Přepínače zůstávají ve svém stavu díky DOM persistenci.
        if (this.app.singleRoomBooking && this.app.singleRoomBooking.updatePriceForCurrentRoom) {
          try {
            await this.app.singleRoomBooking.updatePriceForCurrentRoom();
          } catch (error) {
            console.error('Failed to update price after date change:', error);
            // User notification is handled in the outer catch block
          }
        }
      }
    } catch (error) {
      // CRITICAL: Handle all price calculation errors
      console.error('Price calculation failed:', error);

      // Show user-friendly error in price display
      if (priceEl) {
        priceEl.textContent = 'Chyba při výpočtu ceny';
        priceEl.style.color = 'red';
      }

      // Show notification to user with action
      if (this.showNotification) {
        this.showNotification(
          'Nepodařilo se spočítat cenu. Zkuste obnovit stránku nebo kontaktovat podporu.',
          'error',
          5000
        );
      }

      // Hide price breakdown on error
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
