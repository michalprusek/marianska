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
    // Note: Guest type is handled by radio buttons in the modal, not here

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

    // Get guest type based on which booking mode is active
    let guestType = 'utia'; // default
    const singleRoomModal = document.getElementById('singleRoomBookingModal');
    const bulkModal = document.getElementById('bulkBookingModal');

    if (singleRoomModal && singleRoomModal.classList.contains('active')) {
      // Single room booking mode
      const singleGuestTypeInput = document.querySelector(
        'input[name="singleRoomGuestType"]:checked'
      );
      guestType = singleGuestTypeInput ? singleGuestTypeInput.value : 'utia';
    } else if (bulkModal && bulkModal.classList.contains('active')) {
      // Bulk booking mode
      const bulkGuestTypeInput = document.querySelector('input[name="bulkGuestType"]:checked');
      guestType = bulkGuestTypeInput ? bulkGuestTypeInput.value : 'utia';
    }

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
        guestType,
        guests.adults,
        guests.children,
        guests.toddlers,
        1, // price per night
        1 // single room
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
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    // Combine phone prefix with number (remove spaces from number)
    const phonePrefix = document.getElementById('phonePrefix')?.value || '+420';
    const phoneNumber = document.getElementById('phone').value.trim().replace(/\s/g, '');
    const phone = phonePrefix + phoneNumber;
    const company = document.getElementById('company')?.value.trim() || '';
    const address = document.getElementById('address')?.value.trim() || '';
    const city = document.getElementById('city')?.value.trim() || '';
    const zip = document.getElementById('zip')?.value.trim() || '';
    const ico = document.getElementById('ico')?.value.trim() || '';
    const dic = document.getElementById('dic')?.value.trim() || '';
    const notes = document.getElementById('notes').value.trim();
    // Check both possible checkbox IDs (main form and final booking form)
    const payFromBenefit =
      document.getElementById('payFromBenefit')?.checked ||
      document.getElementById('finalBookingBenefit')?.checked ||
      false;

    // Validate required fields (IČO is optional)
    if (!name || !email || !phoneNumber || !company || !address || !city || !zip) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Vyplňte prosím všechna povinná pole označená hvězdičkou (*)'
          : 'Please fill in all required fields marked with asterisk (*)',
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

    // Check if we're finalizing temporary reservations
    if (
      this.app.isFinalizingReservations &&
      this.app.tempReservations &&
      this.app.tempReservations.length > 0
    ) {
      // Create bookings for all temporary reservations
      let successCount = 0;
      let errorCount = 0;

      for (const tempReservation of this.app.tempReservations) {
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
          startDate: tempReservation.startDate,
          endDate: tempReservation.endDate,
          rooms: [tempReservation.roomId],
          guestType: tempReservation.guestType,
          adults: tempReservation.guests.adults,
          children: tempReservation.guests.children,
          toddlers: tempReservation.guests.toddlers,
          notes,
          payFromBenefit,
          roomGuests: { [tempReservation.roomId]: tempReservation.guests },
        };

        try {
          await dataManager.createBooking(booking);
          successCount++;
        } catch (error) {
          console.error('Error creating booking for room', tempReservation.roomName, error);
          errorCount++;
        }
      }

      // Clear temporary reservations
      this.app.tempReservations = [];
      this.app.isFinalizingReservations = false;

      // Hide the modal
      const modal = document.getElementById('bookingFormModal');
      if (modal) {
        modal.classList.remove('active');
      }

      // Hide temp reservations container and finalize button
      const tempContainer = document.getElementById('tempReservationsContainer');
      if (tempContainer) {
        tempContainer.style.display = 'none';
      }
      const finalizeDiv = document.getElementById('finalizeReservationsDiv');
      if (finalizeDiv) {
        finalizeDiv.style.display = 'none';
      }

      // Show result notification
      if (successCount > 0 && errorCount === 0) {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? `✓ Všechny rezervace (${successCount}) byly úspěšně vytvořeny`
            : `✓ All reservations (${successCount}) created successfully`,
          'success'
        );
      } else if (successCount > 0 && errorCount > 0) {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? `Částečný úspěch: ${successCount} rezervací vytvořeno, ${errorCount} selhalo`
            : `Partial success: ${successCount} reservations created, ${errorCount} failed`,
          'warning'
        );
      } else {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? 'Chyba při vytváření rezervací'
            : 'Error creating reservations',
          'error'
        );
      }

      // Reload the calendar to show new bookings
      await this.app.calendar.render();
      return;
    }

    // Regular booking flow (not finalization)
    // Get guest type based on which booking mode is active
    let guestType = 'utia'; // default
    const singleRoomModal = document.getElementById('singleRoomBookingModal');
    const bulkModal = document.getElementById('bulkBookingModal');

    if (singleRoomModal && singleRoomModal.classList.contains('active')) {
      // Single room booking mode
      const singleGuestTypeInput = document.querySelector(
        'input[name="singleRoomGuestType"]:checked'
      );
      guestType = singleGuestTypeInput ? singleGuestTypeInput.value : 'utia';
    } else if (bulkModal && bulkModal.classList.contains('active')) {
      // Bulk booking mode
      const bulkGuestTypeInput = document.querySelector('input[name="bulkGuestType"]:checked');
      guestType = bulkGuestTypeInput ? bulkGuestTypeInput.value : 'utia';
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
      payFromBenefit,
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
    const value = input.value.replace(/\s/g, '');

    // Check if the number has exactly 9 digits (ignoring spaces)
    const digitsOnly = value.replace(/[^0-9]/g, '');

    if (digitsOnly.length === 9) {
      input.setCustomValidity('');
      input.classList.remove('error');

      // Format for display (3-3-3 pattern)
      if (digitsOnly.length === 9) {
        input.value = `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 6)} ${digitsOnly.slice(6, 9)}`;
      }
    } else {
      input.setCustomValidity(
        this.app.currentLanguage === 'cs'
          ? 'Zadejte přesně 9 číslic telefonního čísla'
          : 'Enter exactly 9 digits for phone number'
      );
      input.classList.add('error');
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
