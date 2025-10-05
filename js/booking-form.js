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

  async checkAndShowChristmasCodeField(dates, isBulkBooking = false) {
    const christmasCodeGroup = document.getElementById('christmasCodeGroup');
    const finalChristmasCodeGroup = document.getElementById('finalChristmasCodeGroup');

    if (!dates || dates.length === 0) {
      return { showCodeField: false, blockBulk: false };
    }

    // Check if any date is in Christmas period
    let isChristmasPeriod = false;
    let christmasPeriodStart = null;

    for (const dateStr of dates) {
      // eslint-disable-next-line no-await-in-loop
      if (await dataManager.isChristmasPeriod(new Date(dateStr))) {
        isChristmasPeriod = true;
        const settings = await dataManager.getSettings();
        christmasPeriodStart = settings.christmasPeriod?.start;
        break;
      }
    }

    if (isChristmasPeriod && christmasPeriodStart) {
      const { codeRequired, bulkBlocked } = dataManager.checkChristmasAccessRequirement(
        christmasPeriodStart,
        isBulkBooking
      );

      // Show/hide the Christmas code field in both forms
      if (christmasCodeGroup) {
        christmasCodeGroup.style.display = codeRequired ? 'block' : 'none';
      }
      if (finalChristmasCodeGroup) {
        finalChristmasCodeGroup.style.display = codeRequired ? 'block' : 'none';
      }

      return { showCodeField: codeRequired, blockBulk: bulkBlocked };
    }

    // Not Christmas period - hide code fields
    if (christmasCodeGroup) {
      christmasCodeGroup.style.display = 'none';
    }
    if (finalChristmasCodeGroup) {
      finalChristmasCodeGroup.style.display = 'none';
    }

    return { showCodeField: false, blockBulk: false };
  }

  async updatePriceSummary() {
    const summaryDiv = document.getElementById('bookingSummary');
    if (!summaryDiv) {
      return;
    }

    const sortedDates = Array.from(this.app.selectedDates).sort();

    // Detect booking mode
    const singleRoomModal = document.getElementById('singleRoomBookingModal');
    const bulkModal = document.getElementById('bulkBookingModal');
    const isBulkBooking = bulkModal && bulkModal.classList.contains('active');

    // Check if any selected date is in Christmas period and if code is required
    await this.checkAndShowChristmasCodeField(sortedDates, isBulkBooking);

    // Get guest type based on which booking mode is active
    let guestType = 'utia'; // default

    if (singleRoomModal && singleRoomModal.classList.contains('active')) {
      // Single room booking mode
      const singleGuestTypeInput = document.querySelector(
        'input[name="singleRoomGuestType"]:checked'
      );
      guestType = singleGuestTypeInput ? singleGuestTypeInput.value : 'utia';
    } else if (isBulkBooking) {
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
    const roomPricePromises = Array.from(this.app.selectedRooms).map(async (roomId) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) {
        return null;
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

      return { room, guests, roomPrice };
    });

    const roomPriceResults = await Promise.all(roomPricePromises);

    for (const result of roomPriceResults) {
      if (result) {
        const { room, guests, roomPrice } = result;
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
    const phoneNumber = document.getElementById('phone').value.trim().replace(/\s/gu, '');
    const phone = phonePrefix + phoneNumber;
    const company = document.getElementById('company')?.value.trim() || '';
    const address = document.getElementById('address')?.value.trim() || '';
    const city = document.getElementById('city')?.value.trim() || '';
    const zip = document.getElementById('zip')?.value.trim() || '';
    const ico = document.getElementById('ico')?.value.trim() || '';
    const dic = document.getElementById('dic')?.value.trim() || '';
    const notes = document.getElementById('notes').value.trim();
    // Check both possible Christmas code inputs (main form and final booking form)
    const christmasCode =
      document.getElementById('christmasCode')?.value.trim() ||
      document.getElementById('finalChristmasCode')?.value.trim() ||
      '';
    // Check both possible checkbox IDs (main form and final booking form)
    const payFromBenefit =
      document.getElementById('payFromBenefit')?.checked ||
      document.getElementById('finalBookingBenefit')?.checked ||
      false;

    // Validate required fields (IČO is optional)
    if (!name || !email || !phoneNumber || !company || !address || !city || !zip) {
      console.warn('[BookingForm] Validation failed - missing required fields:', {
        name: Boolean(name),
        email: Boolean(email),
        phoneNumber: Boolean(phoneNumber),
        company: Boolean(company),
        address: Boolean(address),
        city: Boolean(city),
        zip: Boolean(zip),
      });
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Vyplňte prosím všechna povinná pole označená hvězdičkou (*)'
          : 'Please fill in all required fields marked with asterisk (*)',
        'error'
      );
      return;
    }

    // Validate email using ValidationUtils
    if (!ValidationUtils.validateEmail(email)) {
      const errorMsg = ValidationUtils.getValidationError('email', email, this.app.currentLanguage);
      this.app.showNotification(errorMsg, 'error');
      return;
    }

    // Validate Christmas access code if required
    if (this.app.tempReservations && this.app.tempReservations.length > 0) {
      // Collect all dates from temporary reservations
      const allDates = [];
      let hasBulkBooking = false;

      this.app.tempReservations.forEach((reservation) => {
        const start = new Date(reservation.startDate);
        const end = new Date(reservation.endDate);
        const current = new Date(start);
        // eslint-disable-next-line no-unmodified-loop-condition -- Loop condition correctly uses current date, which is modified inside loop
        while (current <= end) {
          allDates.push(dataManager.formatDate(current));
          current.setDate(current.getDate() + 1);
        }
        if (reservation.isBulkBooking) {
          hasBulkBooking = true;
        }
      });

      // Check if Christmas code is required
      const { showCodeField } = await this.checkAndShowChristmasCodeField(allDates, hasBulkBooking);

      if (showCodeField && !christmasCode) {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? 'Vánoční přístupový kód je vyžadován pro rezervace ve vánočním období'
            : 'Christmas access code is required for bookings during Christmas period',
          'error'
        );
        return;
      }
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
        // Handle bulk booking differently
        if (tempReservation.isBulkBooking) {
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
            rooms: tempReservation.roomIds, // Use all room IDs for bulk booking
            guestType: tempReservation.guestType,
            adults: tempReservation.guests.adults,
            children: tempReservation.guests.children,
            toddlers: tempReservation.guests.toddlers,
            totalPrice: tempReservation.totalPrice,
            notes: notes || 'Hromadná rezervace celé chaty',
            payFromBenefit,
            christmasCode, // Include Christmas access code
            isBulkBooking: true,
            sessionId: this.app.sessionId, // Include sessionId to exclude user's own proposals
          };

          try {
            // eslint-disable-next-line no-await-in-loop -- Sequential processing required: each booking must check room availability before creating
            await dataManager.createBooking(booking);
            successCount += 1;
          } catch (error) {
            console.error('Error creating bulk booking', error);
            errorCount += 1;
          }
        } else {
          // Regular single room booking
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
            totalPrice: tempReservation.totalPrice,
            notes,
            payFromBenefit,
            christmasCode, // Include Christmas access code
            roomGuests: { [tempReservation.roomId]: tempReservation.guests },
            sessionId: this.app.sessionId, // Include sessionId to exclude user's own proposals
          };

          try {
            // eslint-disable-next-line no-await-in-loop -- Sequential processing required: each booking must check room availability before creating
            await dataManager.createBooking(booking);
            successCount += 1;
          } catch (error) {
            console.error('Error creating booking for room', tempReservation.roomName, error);
            errorCount += 1;
          }
        }
      }

      // Delete proposed bookings from database
      const deletePromises = this.app.tempReservations
        .filter((tempReservation) => tempReservation.proposalId)
        .map(async (tempReservation) => {
          try {
            await dataManager.deleteProposedBooking(tempReservation.proposalId);
          } catch (error) {
            console.error('Failed to delete proposed booking:', error);
          }
        });
      await Promise.all(deletePromises);

      // Clear all session proposed bookings (in case any were missed)
      try {
        await dataManager.clearSessionProposedBookings();
      } catch (error) {
        console.error('Failed to clear session proposed bookings:', error);
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
      const tempSection = document.getElementById('tempReservationsSection');
      if (tempSection) {
        tempSection.style.display = 'none';
      }
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

      // Update temp reservations display (will hide the section since array is empty)
      await this.app.displayTempReservations();

      // Reload the calendar to show new bookings
      await this.app.renderCalendar();
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

    // Get dates - use exactly what user selected
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

      // Show success notification with edit link
      if (result.editToken) {
        const editUrl = `${window.location.origin}/edit.html?token=${result.editToken}`;

        // Create success modal with edit link
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
          <div class="modal-content" style="max-width: 600px; text-align: center;">
            <div style="margin-bottom: 2rem;">
              <div style="font-size: 4rem; color: #10b981;">✓</div>
              <h2 style="color: #10b981; margin: 1rem 0;">
                ${this.app.currentLanguage === 'cs' ? 'Rezervace úspěšně vytvořena!' : 'Booking Successfully Created!'}
              </h2>
              <p style="font-size: 1.1rem; color: #4b5563; margin: 1rem 0;">
                ${
                  this.app.currentLanguage === 'cs'
                    ? `Číslo vaší rezervace: <strong>${result.id}</strong>`
                    : `Your booking ID: <strong>${result.id}</strong>`
                }
              </p>
            </div>

            <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0;">
              <p style="font-weight: 600; margin-bottom: 1rem; color: #047857;">
                ${
                  this.app.currentLanguage === 'cs'
                    ? '📧 Uložte si tento odkaz pro budoucí úpravy:'
                    : '📧 Save this link to edit your booking later:'
                }
              </p>
              <div style="background: white; padding: 1rem; border-radius: 4px; word-break: break-all; margin: 0.5rem 0;">
                <a href="${editUrl}" target="_blank" style="color: #0d9488; text-decoration: none; font-weight: 500;">
                  ${editUrl}
                </a>
              </div>
              <button
                id="copyEditLinkBtn"
                style="margin-top: 1rem; padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;"
              >
                ${this.app.currentLanguage === 'cs' ? '📋 Kopírovat odkaz' : '📋 Copy Link'}
              </button>
            </div>

            <div style="background: #fef3c7; border-radius: 8px; padding: 1rem; margin: 1.5rem 0;">
              <p style="color: #92400e; font-size: 0.9rem;">
                <strong>${this.app.currentLanguage === 'cs' ? 'Důležité:' : 'Important:'}</strong>
                ${
                  this.app.currentLanguage === 'cs'
                    ? 'Odkaz pro úpravu rezervace vám bude zaslán e-mailem, jakmile bude e-mailová služba dostupná.'
                    : 'The edit link will be sent to your email once the email service is available.'
                }
              </p>
            </div>

            <button
              id="closeSuccessModal"
              class="btn-primary"
              style="padding: 0.75rem 2rem; font-size: 1rem; background: linear-gradient(135deg, #0d9488, #059669); border: none; color: white; border-radius: 8px; cursor: pointer; font-weight: 600; margin-top: 1rem;"
            >
              ${this.app.currentLanguage === 'cs' ? 'Zavřít' : 'Close'}
            </button>
          </div>
        `;
        document.body.appendChild(modal);

        // Add event listener for copy button
        const copyBtn = document.getElementById('copyEditLinkBtn');
        if (copyBtn) {
          copyBtn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(editUrl);
              const originalText = copyBtn.textContent;
              copyBtn.textContent =
                this.app.currentLanguage === 'cs' ? '✓ Zkopírováno!' : '✓ Copied!';
              setTimeout(() => {
                copyBtn.textContent = originalText;
              }, 2000);
            } catch (error) {
              console.error('Failed to copy to clipboard:', error);
              this.app.showNotification(
                this.app.currentLanguage === 'cs'
                  ? 'Chyba při kopírování odkazu'
                  : 'Failed to copy link',
                'error'
              );
            }
          });
        }

        // Add event listener for close button
        const closeBtn = document.getElementById('closeSuccessModal');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            modal.remove();
            // Reload calendar to show new booking
            this.app.renderCalendar();
          });
        }
      } else {
        // Fallback to simple notification
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? '✓ Rezervace byla úspěšně vytvořena'
            : '✓ Booking created successfully',
          'success'
        );
      }

      // Highlight new booking in calendar
      await this.app.calendar.highlightNewBooking(booking);
    } catch (error) {
      console.error('[BookingForm] Booking creation failed:', error);
      console.error('[BookingForm] Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response,
      });
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? `Chyba při vytváření rezervace: ${error.message || 'Neznámá chyba'}`
          : `Error creating booking: ${error.message || 'Unknown error'}`,
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

  hideBookingFormModal() {
    const modal = document.getElementById('bookingFormModal');
    if (modal) {
      modal.classList.remove('active');
    }

    // Clear form
    const form = document.getElementById('bookingForm');
    if (form) {
      form.reset();
    }

    // Clear summary
    const summaryEl = document.getElementById('bookingSummary');
    if (summaryEl) {
      summaryEl.innerHTML = '';
    }
  }

  validatePhoneNumber(input) {
    const value = input.value.trim();
    const inputElement = input;

    // Allow empty if not required, or validate format
    if (!value) {
      inputElement.setCustomValidity('');
      inputElement.classList.remove('error');
      return;
    }

    // Get country code from the select element (look for sibling or nearby select)
    let countryCode = '+420'; // default
    const countryCodeSelect =
      input.parentElement?.querySelector('select') ||
      document.getElementById('finalBookingCountryCode') ||
      document.getElementById('bulkCountryCode') ||
      document.getElementById('bookingCountryCode');

    if (countryCodeSelect) {
      countryCode = countryCodeSelect.value;
    }

    // Validate phone number without country code using ValidationUtils
    if (ValidationUtils.validatePhoneNumber(value, countryCode)) {
      inputElement.setCustomValidity('');
      inputElement.classList.remove('error');
      // Format for display (spaces every 3 digits)
      const cleanNumber = value.replace(/\s/gu, '');
      if (cleanNumber.length === 9) {
        inputElement.value = `${cleanNumber.slice(0, 3)} ${cleanNumber.slice(3, 6)} ${cleanNumber.slice(6)}`;
      }
    } else {
      const errorMsg = ValidationUtils.getValidationError(
        'phoneNumber',
        value,
        this.app.currentLanguage,
        countryCode
      );
      inputElement.setCustomValidity(errorMsg);
      inputElement.classList.add('error');
    }
  }

  validateZipCode(input) {
    const value = input.value.replace(/\s/gu, '');
    const inputElement = input;

    if (ValidationUtils.validateZIP(value)) {
      inputElement.setCustomValidity('');
      inputElement.classList.remove('error');
      inputElement.value = ValidationUtils.formatZIP(value);
    } else {
      const errorMsg = ValidationUtils.getValidationError('zip', value, this.app.currentLanguage);
      inputElement.setCustomValidity(errorMsg);
      inputElement.classList.add('error');
    }
  }

  validateICO(input) {
    const value = input.value.replace(/\s/gu, '');

    if (ValidationUtils.validateICO(value)) {
      input.setCustomValidity('');
      input.classList.remove('error');
    } else {
      const errorMsg = ValidationUtils.getValidationError('ico', value, this.app.currentLanguage);
      input.setCustomValidity(errorMsg);
      input.classList.add('error');
    }
  }

  validateDIC(input) {
    const value = input.value.toUpperCase();
    const inputElement = input;

    if (ValidationUtils.validateDIC(value)) {
      inputElement.setCustomValidity('');
      inputElement.classList.remove('error');
    } else {
      const errorMsg = ValidationUtils.getValidationError('dic', value, this.app.currentLanguage);
      inputElement.setCustomValidity(errorMsg);
      inputElement.classList.add('error');
    }

    inputElement.value = value;
  }
}
