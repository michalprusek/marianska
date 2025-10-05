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
                            <div class="detail-row" style="margin-bottom: 0.5rem;">
                                <strong>${this.app.currentLanguage === 'cs' ? 'Termín:' : 'Dates:'}</strong>
                                <span>${this.formatDateDisplay(new Date(booking.startDate))} - ${this.formatDateDisplay(new Date(booking.endDate))}</span>
                            </div>
                            <div class="detail-row" style="margin-bottom: 0.5rem;">
                                <strong>${this.app.currentLanguage === 'cs' ? 'Pokoje:' : 'Rooms:'}</strong>
                                <span>${booking.rooms.join(', ')}</span>
                            </div>
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


                        <!-- Contact Form Section -->
                        <div class="detail-section" style="border-top: 2px solid var(--gray-200); padding-top: 1.5rem;">
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

                            <form id="contactOwnerForm" onsubmit="return false;">
                                <div style="margin-bottom: 1rem;">
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--gray-700);">
                                        ${this.app.currentLanguage === 'cs' ? 'Váš email:' : 'Your email:'}
                                    </label>
                                    <input
                                        type="email"
                                        id="contactEmail"
                                        required
                                        style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 0.95rem;"
                                        placeholder="${this.app.currentLanguage === 'cs' ? 'vas@email.cz' : 'your@email.com'}"
                                    >
                                </div>

                                <div style="margin-bottom: 1.5rem;">
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--gray-700);">
                                        ${this.app.currentLanguage === 'cs' ? 'Zpráva:' : 'Message:'}
                                    </label>
                                    <textarea
                                        id="contactMessage"
                                        required
                                        rows="4"
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
                                        onclick="window.app.utils.sendContactMessage('${booking.id}', document.getElementById('contactEmail').value, document.getElementById('contactMessage').value, this.closest('.modal'))"
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

    // Disable the button during sending
    const submitButton = modalElement.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = `
            <span style="margin-right: 0.5rem;">⏳</span>
            ${this.app.currentLanguage === 'cs' ? 'Odesílám...' : 'Sending...'}
        `;

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
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending contact message:', error);
      this.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Chyba při odesílání zprávy. Zkuste to prosím znovu.'
          : 'Error sending message. Please try again.',
        'error'
      );

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

    // Get current settings and prices
    const settings = await dataManager.getSettings();
    const prices = settings.prices || {
      utia: { base: 298, adult: 49, child: 24 },
      external: { base: 499, adult: 99, child: 49 },
    };

    // Determine the current guest type for base price display
    let currentGuestType = 'utia';
    if (this.app.currentBookingRoom) {
      currentGuestType = this.app.roomGuestTypes.get(this.app.currentBookingRoom) || 'utia';
    } else if (this.app.selectedRooms.size > 0) {
      const firstRoom = Array.from(this.app.selectedRooms)[0];
      currentGuestType = this.app.roomGuestTypes.get(firstRoom) || 'utia';
    }

    // Get base price based on current guest type
    const guestKey = currentGuestType === 'utia' ? 'utia' : 'external';
    const baseRoomPrice = prices[guestKey].base;

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

    const rooms = await dataManager.getRooms();
    const roomPrices = await Promise.all(
      Array.from(roomsToCalculate).map(async (roomId) => {
        const guests = this.app.roomGuests.get(roomId) || { adults: 1, children: 0, toddlers: 0 };
        const guestType = this.app.roomGuestTypes.get(roomId) || 'utia';

        const room = rooms.find((r) => r.id === roomId);
        if (!room) {
          return 0;
        }

        return await dataManager.calculatePrice(
          guestType,
          guests.adults,
          guests.children,
          guests.toddlers,
          1, // nights per room calculation
          1 // single room
        );
      })
    );
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
        const priceConfig = prices[roomGuestKey];

        // Update guest counts summary
        const guestCountsSummary = document.getElementById('guestCountsSummary');
        if (guestCountsSummary) {
          const parts = [];
          if (guests.adults > 0) {
            parts.push(`${guests.adults} dosp.`);
          }
          if (guests.children > 0) {
            parts.push(`${guests.children} děti`);
          }
          if (guests.toddlers > 0) {
            parts.push(`${guests.toddlers} bat.`);
          }
          guestCountsSummary.textContent = parts.join(', ') || '0';
        }

        // Calculate and show adult surcharge
        const adultsPrice = document.getElementById('adultsPrice');
        const adultsSurcharge = document.getElementById('adultsSurcharge');
        if (adultsPrice && adultsSurcharge) {
          const extraAdults = Math.max(0, guests.adults - 1);
          if (extraAdults > 0) {
            const surcharge = extraAdults * priceConfig.adult;
            adultsSurcharge.textContent = `${surcharge.toLocaleString('cs-CZ')} Kč (${extraAdults} × ${priceConfig.adult} Kč)`;
            adultsPrice.style.display = 'flex';
          } else {
            adultsPrice.style.display = 'none';
          }
        }

        // Calculate and show children surcharge
        const childrenPrice = document.getElementById('childrenPrice');
        const childrenSurcharge = document.getElementById('childrenSurcharge');
        if (childrenPrice && childrenSurcharge) {
          if (guests.children > 0) {
            const surcharge = guests.children * priceConfig.child;
            childrenSurcharge.textContent = `${surcharge.toLocaleString('cs-CZ')} Kč (${guests.children} × ${priceConfig.child} Kč)`;
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
            toddlersSummary.textContent = `${guests.toddlers} zdarma`;
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
