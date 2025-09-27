// Utils module - helper functions and utilities
class UtilsModule {
  constructor(app) {
    this.app = app;
  }

  formatDateDisplay(date) {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const dayNames =
      this.app.currentLanguage === 'cs'
        ? ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const monthNames =
      this.app.currentLanguage === 'cs'
        ? ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro']
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return `${dayNames[date.getDay()]} ${day}. ${monthNames[month - 1]}`;
  }

  getDateRanges(dates) {
    if (dates.length === 0) {
      return [];
    }

    const ranges = [];
    let currentRange = { start: dates[0], end: dates[0] };

    for (let i = 1; i < dates.length; i++) {
      const currentDate = new Date(dates[i]);
      const prevDate = new Date(dates[i - 1]);
      const dayDiff = (currentDate - prevDate) / (1000 * 60 * 60 * 24);

      if (dayDiff === 1) {
        currentRange.end = dates[i];
      } else {
        ranges.push({ ...currentRange });
        currentRange = { start: dates[i], end: dates[i] };
      }
    }
    ranges.push(currentRange);

    return ranges;
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
    // Validate inputs
    if (!fromEmail || !message || !fromEmail.includes('@')) {
      this.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Vyplňte prosím všechna pole a zadejte platný email'
          : 'Please fill in all fields and enter a valid email',
        'error'
      );
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
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    const container =
      document.getElementById('notificationContainer') ||
      (() => {
        const c = document.createElement('div');
        c.id = 'notificationContainer';
        c.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
        document.body.appendChild(c);
        return c;
      })();

    container.appendChild(notification);

    requestAnimationFrame(() => notification.classList.add('show'));

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  async updateBookingButton() {
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

  async updateSelectedDatesDisplay() {
    const display = document.getElementById('selectedDatesDisplay');
    if (!display) {
      return;
    }

    if (this.app.selectedDates.size === 0) {
      display.style.display = 'none';
      return;
    }

    display.style.display = 'block';

    const sortedDates = Array.from(this.app.selectedDates).sort();
    const ranges = this.getDateRanges(sortedDates);

    let html = '<div class="selected-dates-list">';
    ranges.forEach((range) => {
      const start = new Date(range.start);
      const end = new Date(range.end);
      const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      if (range.start === range.end) {
        html += `<div class="selected-date-range">
                    <span>${this.formatDateDisplay(start)}</span>
                    <span class="nights-count">1 ${this.app.currentLanguage === 'cs' ? 'noc' : 'night'}</span>
                </div>`;
      } else {
        html += `<div class="selected-date-range">
                    <span>${this.formatDateDisplay(start)} - ${this.formatDateDisplay(end)}</span>
                    <span class="nights-count">${nights} ${this.app.currentLanguage === 'cs' ? (nights === 1 ? 'noc' : nights < 5 ? 'noci' : 'nocí') : nights === 1 ? 'night' : 'nights'}</span>
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

    if (!priceEl) {
      return;
    }

    const nights = this.app.selectedDates.size;
    if (nights === 0) {
      priceEl.textContent = '0 Kč';
      if (nightsEl) {
        nightsEl.textContent = '0';
      }
      return;
    }

    // Calculate total price
    let totalPrice = 0;
    let pricePerNight = 0;

    for (const roomId of this.app.selectedRooms || [this.app.currentBookingRoom]) {
      const guests = this.app.roomGuests.get(roomId) || { adults: 1, children: 0, toddlers: 0 };
      const guestType = this.app.roomGuestTypes.get(roomId) || 'utia';

      const rooms = await dataManager.getRooms();
      const room = rooms.find((r) => r.id === roomId);
      if (!room) {
        continue;
      }

      const roomPrice = await dataManager.calculatePrice(
        room.type,
        guestType,
        guests.adults,
        guests.children,
        guests.toddlers
      );

      pricePerNight += roomPrice;
    }

    totalPrice = pricePerNight * nights;

    priceEl.textContent = `${totalPrice.toLocaleString('cs-CZ')} Kč`;
    if (nightsEl) {
      nightsEl.textContent = nights;
    }
    if (perNightEl) {
      perNightEl.textContent = `${pricePerNight.toLocaleString('cs-CZ')} Kč`;
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
      el.textContent = el.getAttribute(`data-${this.app.currentLanguage}`);
    });
  }
}
