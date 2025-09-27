// Booking form module - handles form validation and submission
class BookingFormModule {
  constructor(app) {
    this.app = app;
  }

  showBookingForm() {
    const step1 = document.getElementById('bookingStep1');
    const step2 = document.getElementById('bookingStep2');

    if (!this.app.selectedDates.size || !this.app.selectedRooms.size) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Vyberte prosím termín a pokoje'
          : 'Please select dates and rooms',
        'warning'
      );
      return;
    }

    step1.style.display = 'none';
    step2.style.display = 'block';

    // Pre-fill guest type if selected
    const guestTypeSelect = document.getElementById('bookingGuestType');
    const firstRoom = Array.from(this.app.selectedRooms)[0];
    const roomGuestType = this.app.roomGuestTypes.get(firstRoom);
    if (roomGuestType) {
      guestTypeSelect.value = roomGuestType;
    }

    this.updatePriceSummary();
  }

  hideBookingForm() {
    const step1 = document.getElementById('bookingStep1');
    const step2 = document.getElementById('bookingStep2');

    step2.style.display = 'none';
    step1.style.display = 'block';
  }

  async updatePriceSummary() {
    const summaryDiv = document.getElementById('bookingSummary');
    if (!summaryDiv) {
      return;
    }

    const sortedDates = Array.from(this.app.selectedDates).sort();
    const guestType = document.getElementById('bookingGuestType').value;

    let html = `
            <div class="booking-summary-section">
                <h4>${this.app.currentLanguage === 'cs' ? 'Shrnutí rezervace' : 'Booking Summary'}</h4>
        `;

    // Dates
    const ranges = this.app.getDateRanges(sortedDates);
    html += `<div class="summary-dates">`;
    ranges.forEach((range) => {
      const start = new Date(range.start);
      const end = new Date(range.end);
      if (range.start === range.end) {
        html += `<div>${this.app.formatDateDisplay(start)}</div>`;
      } else {
        html += `<div>${this.app.formatDateDisplay(start)} - ${this.app.formatDateDisplay(end)}</div>`;
      }
    });
    html += `</div>`;

    // Rooms and guests
    const rooms = await dataManager.getRooms();
    let totalPrice = 0;

    html += `<div class="summary-rooms">`;
    for (const roomId of this.app.selectedRooms) {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) {
        continue;
      }

      const guests = this.app.roomGuests.get(roomId) || { adults: 1, children: 0, toddlers: 0 };
      const roomPrice = await dataManager.calculatePrice(
        room.type,
        guestType,
        guests.adults,
        guests.children,
        guests.toddlers
      );

      totalPrice += roomPrice * sortedDates.length;

      html += `
                <div class="room-summary">
                    <strong>${room.name}</strong>
                    <span>${guests.adults} ${this.app.currentLanguage === 'cs' ? 'dospělí' : 'adults'}`;

      if (guests.children > 0) {
        html += `, ${guests.children} ${this.app.currentLanguage === 'cs' ? 'děti' : 'children'}`;
      }
      if (guests.toddlers > 0) {
        html += `, ${guests.toddlers} ${this.app.currentLanguage === 'cs' ? 'batolata' : 'toddlers'}`;
      }

      html += `</span>
                    <span>${roomPrice * sortedDates.length} Kč</span>
                </div>`;
    }
    html += `</div>`;

    // Total
    html += `
            <div class="summary-total">
                <strong>${this.app.currentLanguage === 'cs' ? 'Celkem' : 'Total'}:</strong>
                <strong>${totalPrice.toLocaleString('cs-CZ')} Kč</strong>
            </div>
        </div>`;

    summaryDiv.innerHTML = html;
  }

  async submitBooking() {
    // Get form values
    const name = document.getElementById('bookingName').value.trim();
    const email = document.getElementById('bookingEmail').value.trim();
    const phone = document.getElementById('bookingPhone').value.trim();
    const company = document.getElementById('bookingCompany')?.value.trim() || '';
    const address = document.getElementById('bookingAddress')?.value.trim() || '';
    const city = document.getElementById('bookingCity')?.value.trim() || '';
    const zip = document.getElementById('bookingZip')?.value.trim() || '';
    const ico = document.getElementById('bookingICO')?.value.trim() || '';
    const dic = document.getElementById('bookingDIC')?.value.trim() || '';
    const guestType = document.getElementById('bookingGuestType').value;
    const notes = document.getElementById('bookingNotes').value.trim();

    // Validate required fields
    if (!name || !email || !phone) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Vyplňte prosím všechna povinná pole'
          : 'Please fill in all required fields',
        'error'
      );
      return;
    }

    // Validate email
    if (!email.includes('@')) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Zadejte prosím platný email'
          : 'Please enter a valid email',
        'error'
      );
      return;
    }

    // Get dates
    const sortedDates = Array.from(this.app.selectedDates).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    // Prepare rooms and guest data
    const roomsData = [];
    let totalAdults = 0;
    let totalChildren = 0;
    let totalToddlers = 0;

    for (const roomId of this.app.selectedRooms) {
      roomsData.push(roomId);
      const guests = this.app.roomGuests.get(roomId) || { adults: 1, children: 0, toddlers: 0 };
      totalAdults += guests.adults;
      totalChildren += guests.children;
      totalToddlers += guests.toddlers;
    }

    // Create booking
    const booking = {
      name,
      email,
      phone,
      company,
      address,
      city,
      zip,
      ico,
      dic,
      startDate,
      endDate,
      rooms: roomsData,
      guestType,
      adults: totalAdults,
      children: totalChildren,
      toddlers: totalToddlers,
      notes,
      roomGuests: Object.fromEntries(this.app.roomGuests),
    };

    try {
      const result = await dataManager.createBooking(booking);

      // Hide modal
      if (this.app.currentBookingRoom) {
        this.app.singleRoomBooking.hideRoomBookingModal();
      } else {
        this.hideBookingModal();
      }

      // Show success notification
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? '✓ Rezervace byla úspěšně vytvořena'
          : '✓ Booking created successfully',
        'success'
      );

      // Highlight new booking in calendar
      await this.app.calendar.highlightNewBooking(booking);

      // Show edit link
      if (result.editToken) {
        const editUrl = `${window.location.origin}/edit.html?token=${result.editToken}`;
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? `Pro úpravu rezervace použijte tento odkaz: ${editUrl}`
            : `To edit your booking, use this link: ${editUrl}`,
          'info',
          10000
        );
      }
    } catch (error) {
      console.error('Booking error:', error);
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Chyba při vytváření rezervace'
          : 'Error creating booking',
        'error'
      );
    }
  }

  hideBookingModal() {
    const modal = document.getElementById('bookingModal');
    modal.classList.remove('show');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);

    // Clean up
    this.app.selectedDates.clear();
    this.app.selectedRooms.clear();
    this.app.roomGuests.clear();
    this.app.roomGuestTypes.clear();
  }

  validatePhoneNumber(input) {
    let value = input.value.replace(/\s/g, '');

    if (!value.startsWith('+')) {
      value = `+420${value.replace(/^\+?420/, '')}`;
    }

    const czechPattern = /^\+420\d{9}$/;
    const slovakPattern = /^\+421\d{9}$/;

    if (czechPattern.test(value) || slovakPattern.test(value)) {
      input.setCustomValidity('');
      input.classList.remove('error');
    } else {
      input.setCustomValidity(
        this.app.currentLanguage === 'cs'
          ? 'Zadejte platné telefonní číslo (9 číslic)'
          : 'Enter a valid phone number (9 digits)'
      );
      input.classList.add('error');
    }

    // Format for display
    if (value.length >= 7) {
      input.value = `${value.slice(0, 4)} ${value.slice(4, 7)} ${value.slice(7, 10)} ${value.slice(
        10,
        13
      )}`;
    }
  }

  validateZipCode(input) {
    const value = input.value.replace(/\s/g, '');

    if (/^\d{5}$/.test(value)) {
      input.setCustomValidity('');
      input.classList.remove('error');
      input.value = `${value.slice(0, 3)} ${value.slice(3)}`;
    } else {
      input.setCustomValidity(
        this.app.currentLanguage === 'cs'
          ? 'PSČ musí obsahovat přesně 5 číslic'
          : 'Postal code must contain exactly 5 digits'
      );
      input.classList.add('error');
    }
  }

  validateICO(input) {
    const value = input.value.replace(/\s/g, '');

    if (value === '' || /^\d{8}$/.test(value)) {
      input.setCustomValidity('');
      input.classList.remove('error');
    } else {
      input.setCustomValidity(
        this.app.currentLanguage === 'cs'
          ? 'IČO musí obsahovat 8 číslic'
          : 'Company ID must contain 8 digits'
      );
      input.classList.add('error');
    }
  }

  validateDIC(input) {
    const value = input.value.toUpperCase();

    if (value === '' || /^CZ\d{8,10}$/.test(value)) {
      input.setCustomValidity('');
      input.classList.remove('error');
    } else {
      input.setCustomValidity(
        this.app.currentLanguage === 'cs'
          ? 'DIČ musí být ve formátu CZ12345678'
          : 'VAT ID must be in format CZ12345678'
      );
      input.classList.add('error');
    }

    input.value = value;
  }
}
