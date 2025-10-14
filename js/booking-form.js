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

    // Generate guest names inputs based on total guests
    let totalAdults = 0;
    let totalChildren = 0;
    for (const result of roomPriceResults) {
      if (result) {
        const { guests } = result;
        totalAdults += guests.adults;
        totalChildren += guests.children;
      }
    }

    // Call generateGuestNamesInputs for bookingFormModal
    this.generateGuestNamesInputs(totalAdults, totalChildren, 'bookingForm');
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

    // Validate phone using ValidationUtils
    const phoneCountryCode = document.getElementById('phonePrefix')?.value || '+420';
    if (!ValidationUtils.validatePhoneNumber(phoneNumber, phoneCountryCode)) {
      const errorMsg = ValidationUtils.getValidationError(
        'phoneNumber',
        phoneNumber,
        this.app.currentLanguage,
        phoneCountryCode
      );
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

      // Check if Christmas code is required and if bulk is blocked
      const { showCodeField, blockBulk } = await this.checkAndShowChristmasCodeField(
        allDates,
        hasBulkBooking
      );

      // Block bulk bookings if required (after Oct 1 for Christmas period)
      if (blockBulk) {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? 'Hromadné rezervace celé chaty nejsou po 1. říjnu povoleny pro vánoční období. Rezervujte jednotlivé pokoje.'
            : 'Bulk bookings for the entire chalet are not allowed after October 1st for the Christmas period. Please book individual rooms.',
          'error'
        );
        return;
      }

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
      // Calculate total guests for validation
      let totalAdults = 0;
      let totalChildren = 0;

      this.app.tempReservations.forEach((reservation) => {
        totalAdults += reservation.guests.adults || 0;
        totalChildren += reservation.guests.children || 0;
      });

      // Validate guest names if there are any guests
      if (totalAdults + totalChildren > 0) {
        const validation = this.validateGuestNames(totalAdults, totalChildren);
        if (!validation.valid) {
          this.app.showNotification(validation.error, 'error');
          return;
        }
      }

      // Collect guest names
      const guestNames = this.collectGuestNames();

      // Create bookings for all temporary reservations
      let successCount = 0;
      let errorCount = 0;

      // FIX: When creating multiple separate per-room bookings, we need to merge them into ONE booking
      // BUT only if all rooms have the SAME date range - otherwise we can't consolidate
      if (
        this.app.tempReservations.length > 1 &&
        !this.app.tempReservations.some((r) => r.isBulkBooking)
      ) {
        // Check if all temp reservations have the same start and end dates
        const firstReservation = this.app.tempReservations[0];
        const allSameDates = this.app.tempReservations.every(
          (r) =>
            r.startDate === firstReservation.startDate && r.endDate === firstReservation.endDate
        );

        if (allSameDates) {
          // Multiple rooms with SAME date range - create a SINGLE consolidated booking
          const allRoomIds = [];
          let totalAdultsLocal = 0;
          let totalChildrenLocal = 0;
          let totalToddlersLocal = 0;
          let totalPriceLocal = 0;
          const guestTypesSet = new Set();
          const roomGuestsMap = {};

          for (const tempReservation of this.app.tempReservations) {
            allRoomIds.push(tempReservation.roomId);
            totalAdultsLocal += tempReservation.guests.adults || 0;
            totalChildrenLocal += tempReservation.guests.children || 0;
            totalToddlersLocal += tempReservation.guests.toddlers || 0;
            totalPriceLocal += tempReservation.totalPrice || 0;
            guestTypesSet.add(tempReservation.guestType);
            roomGuestsMap[tempReservation.roomId] = tempReservation.guests;
          }

          // Determine guest type (prefer 'utia' if mixed)
          const finalGuestType = guestTypesSet.has('utia') ? 'utia' : 'external';

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
            startDate: firstReservation.startDate,
            endDate: firstReservation.endDate,
            rooms: allRoomIds,
            guestType: finalGuestType,
            adults: totalAdultsLocal,
            children: totalChildrenLocal,
            toddlers: totalToddlersLocal,
            totalPrice: totalPriceLocal,
            notes,
            payFromBenefit,
            christmasCode,
            roomGuests: roomGuestsMap,
            sessionId: this.app.sessionId,
            guestNames, // Include guest names - now matches total guest count
          };

          try {
            await dataManager.createBooking(booking);
            successCount = 1;
          } catch (error) {
            console.error('Error creating consolidated booking', error);
            errorCount = 1;
          }
        } else {
          // Multiple rooms with DIFFERENT date ranges - create separate bookings
          // Distribute guest names among bookings based on guest counts
          let guestNameIndex = 0;
          const formData = {
            name,
            email,
            phone,
            company,
            address,
            city,
            zip,
            ico,
            dic,
            notes,
            payFromBenefit,
            christmasCode,
          };

          for (const tempReservation of this.app.tempReservations) {
            const bookingGuestCount =
              (tempReservation.guests.adults || 0) + (tempReservation.guests.children || 0);
            const bookingGuestNames = guestNames.slice(
              guestNameIndex,
              guestNameIndex + bookingGuestCount
            );
            guestNameIndex += bookingGuestCount;

            // eslint-disable-next-line no-await-in-loop -- Sequential processing required: each booking must check room availability before creating
            const result = await this.processTempReservation(
              tempReservation,
              formData,
              bookingGuestNames
            );
            // Use ternary to avoid max-depth violation
            successCount += result.success ? 1 : 0;
            errorCount += result.success ? 0 : 1;
          }
        }
      } else {
        // Single booking or bulk booking - handle normally
        const formData = {
          name,
          email,
          phone,
          company,
          address,
          city,
          zip,
          ico,
          dic,
          notes,
          payFromBenefit,
          christmasCode,
        };

        for (const tempReservation of this.app.tempReservations) {
          // eslint-disable-next-line no-await-in-loop -- Sequential processing required: each booking must check room availability before creating
          const result = await this.processTempReservation(tempReservation, formData, guestNames);
          // Use ternary to avoid max-depth violation
          successCount += result.success ? 1 : 0;
          errorCount += result.success ? 0 : 1;
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

    // Validate guest names if there are any guests
    if (totalAdults + totalChildren > 0) {
      const validation = this.validateGuestNames(totalAdults, totalChildren);
      if (!validation.valid) {
        this.app.showNotification(validation.error, 'error');
        return;
      }
    }

    // Collect guest names
    const guestNames = this.collectGuestNames();

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
      guestNames, // Include guest names
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

  /**
   * Generate guest names input fields dynamically based on guest counts
   * @param {number} adults - Number of adults
   * @param {number} children - Number of children
   * @param {string} formPrefix - Prefix for element IDs ('bookingForm' for bookingFormModal, '' for finalBookingModal)
   */
  generateGuestNamesInputs(adults, children, formPrefix = '') {
    const prefix = formPrefix ? `${formPrefix}` : '';

    // Helper function to create proper ID with capitalization
    // When prefix is used, capitalize first letter of base name (e.g., "bookingForm" + "GuestNamesSection")
    const makeId = (baseName) => {
      if (!prefix) {
        return baseName;
      }
      return prefix + baseName.charAt(0).toUpperCase() + baseName.slice(1);
    };

    const guestNamesSection = document.getElementById(makeId('guestNamesSection'));
    const adultsNamesList = document.getElementById(makeId('adultsNamesList'));
    const childrenNamesList = document.getElementById(makeId('childrenNamesList'));
    const childrenContainer = document.getElementById(makeId('childrenNamesContainer'));

    if (!guestNamesSection || !adultsNamesList || !childrenNamesList) {
      return;
    }

    // Clear existing inputs
    adultsNamesList.textContent = '';
    childrenNamesList.textContent = '';

    // Show/hide section based on guest counts
    if (adults + children > 0) {
      guestNamesSection.style.display = 'block';
      // Also show parent containers if they exist
      const adultsContainer = document.getElementById(makeId('adultsNamesContainer'));
      if (adultsContainer) {
        adultsContainer.style.display = adults > 0 ? 'block' : 'none';
      }
    } else {
      guestNamesSection.style.display = 'none';
      return;
    }

    // Generate adult name inputs using safe DOM methods
    for (let i = 1; i <= adults; i++) {
      const guestDiv = document.createElement('div');
      guestDiv.className = 'guest-name-row';
      guestDiv.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;';

      // First name input
      const firstNameGroup = document.createElement('div');
      firstNameGroup.className = 'input-group';

      const firstNameLabel = document.createElement('label');
      firstNameLabel.setAttribute('for', `adultFirstName${i}`);
      firstNameLabel.textContent = `Křestní jméno ${i}. dospělého *`;
      firstNameGroup.appendChild(firstNameLabel);

      const firstNameInput = document.createElement('input');
      firstNameInput.type = 'text';
      firstNameInput.id = `adultFirstName${i}`;
      firstNameInput.name = `adultFirstName${i}`;
      firstNameInput.required = true;
      firstNameInput.minLength = 2;
      firstNameInput.maxLength = 50; // SECURITY FIX: Add max length validation
      firstNameInput.placeholder = 'např. Jan';
      firstNameInput.setAttribute('data-guest-type', 'adult');
      firstNameInput.setAttribute('data-guest-index', i);
      firstNameGroup.appendChild(firstNameInput);

      // Last name input
      const lastNameGroup = document.createElement('div');
      lastNameGroup.className = 'input-group';

      const lastNameLabel = document.createElement('label');
      lastNameLabel.setAttribute('for', `adultLastName${i}`);
      lastNameLabel.textContent = `Příjmení ${i}. dospělého *`;
      lastNameGroup.appendChild(lastNameLabel);

      const lastNameInput = document.createElement('input');
      lastNameInput.type = 'text';
      lastNameInput.id = `adultLastName${i}`;
      lastNameInput.name = `adultLastName${i}`;
      lastNameInput.required = true;
      lastNameInput.minLength = 2;
      lastNameInput.maxLength = 50; // SECURITY FIX: Add max length validation
      lastNameInput.placeholder = 'např. Novák';
      lastNameInput.setAttribute('data-guest-type', 'adult');
      lastNameInput.setAttribute('data-guest-index', i);
      lastNameGroup.appendChild(lastNameInput);

      guestDiv.appendChild(firstNameGroup);
      guestDiv.appendChild(lastNameGroup);
      adultsNamesList.appendChild(guestDiv);
    }

    // Generate children name inputs
    if (children > 0) {
      childrenContainer.style.display = 'block';
      for (let i = 1; i <= children; i++) {
        const guestDiv = document.createElement('div');
        guestDiv.className = 'guest-name-row';
        guestDiv.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;';

        // First name input
        const firstNameGroup = document.createElement('div');
        firstNameGroup.className = 'input-group';

        const firstNameLabel = document.createElement('label');
        firstNameLabel.setAttribute('for', `childFirstName${i}`);
        firstNameLabel.textContent = `Křestní jméno ${i}. dítěte *`;
        firstNameGroup.appendChild(firstNameLabel);

        const firstNameInput = document.createElement('input');
        firstNameInput.type = 'text';
        firstNameInput.id = `childFirstName${i}`;
        firstNameInput.name = `childFirstName${i}`;
        firstNameInput.required = true;
        firstNameInput.minLength = 2;
        firstNameInput.maxLength = 50; // SECURITY FIX: Add max length validation
        firstNameInput.placeholder = 'např. Anna';
        firstNameInput.setAttribute('data-guest-type', 'child');
        firstNameInput.setAttribute('data-guest-index', i);
        firstNameGroup.appendChild(firstNameInput);

        // Last name input
        const lastNameGroup = document.createElement('div');
        lastNameGroup.className = 'input-group';

        const lastNameLabel = document.createElement('label');
        lastNameLabel.setAttribute('for', `childLastName${i}`);
        lastNameLabel.textContent = `Příjmení ${i}. dítěte *`;
        lastNameGroup.appendChild(lastNameLabel);

        const lastNameInput = document.createElement('input');
        lastNameInput.type = 'text';
        lastNameInput.id = `childLastName${i}`;
        lastNameInput.name = `childLastName${i}`;
        lastNameInput.required = true;
        lastNameInput.minLength = 2;
        lastNameInput.maxLength = 50; // SECURITY FIX: Add max length validation
        lastNameInput.placeholder = 'např. Nováková';
        lastNameInput.setAttribute('data-guest-type', 'child');
        lastNameInput.setAttribute('data-guest-index', i);
        lastNameGroup.appendChild(lastNameInput);

        guestDiv.appendChild(firstNameGroup);
        guestDiv.appendChild(lastNameGroup);
        childrenNamesList.appendChild(guestDiv);
      }
    } else {
      childrenContainer.style.display = 'none';
    }
  }

  /**
   * Collect guest names from the generated form inputs
   * FIX: Only collect from visible/active form containers to avoid collecting from multiple modals
   * @returns {Array<Object>} Array of guest name objects
   */
  collectGuestNames() {
    const guestNames = [];

    // Determine which form container is active/visible
    // Priority: bookingFormModal (for regular bookings) > finalBookingModal (for temp reservations finalization)
    let formContainer = null;

    const bookingFormModal = document.getElementById('bookingFormModal');
    const finalBookingModal = document.getElementById('finalBookingModal');

    if (bookingFormModal && bookingFormModal.classList.contains('active')) {
      formContainer = bookingFormModal;
    } else if (finalBookingModal && finalBookingModal.classList.contains('active')) {
      formContainer = finalBookingModal;
    }

    // Fall back to document if no modal is active (shouldn't happen but safe fallback)
    if (!formContainer) {
      formContainer = document;
    }

    // Collect adult names - ONLY from the active form container
    const adultFirstNames = formContainer.querySelectorAll(
      'input[data-guest-type="adult"][id^="adultFirstName"]'
    );
    const adultLastNames = formContainer.querySelectorAll(
      'input[data-guest-type="adult"][id^="adultLastName"]'
    );

    for (let i = 0; i < adultFirstNames.length; i++) {
      const firstName = adultFirstNames[i].value.trim();
      const lastName = adultLastNames[i].value.trim();
      if (firstName && lastName) {
        guestNames.push({
          personType: 'adult',
          firstName,
          lastName,
        });
      }
    }

    // Collect children names - ONLY from the active form container
    const childFirstNames = formContainer.querySelectorAll(
      'input[data-guest-type="child"][id^="childFirstName"]'
    );
    const childLastNames = formContainer.querySelectorAll(
      'input[data-guest-type="child"][id^="childLastName"]'
    );

    for (let i = 0; i < childFirstNames.length; i++) {
      const firstName = childFirstNames[i].value.trim();
      const lastName = childLastNames[i].value.trim();
      if (firstName && lastName) {
        guestNames.push({
          personType: 'child',
          firstName,
          lastName,
        });
      }
    }

    return guestNames;
  }

  /**
   * Validate guest names input fields
   * @param {number} expectedAdults - Expected number of adults
   * @param {number} expectedChildren - Expected number of children
   * @returns {Object} Validation result with valid flag and error message
   */
  validateGuestNames(expectedAdults, expectedChildren) {
    const guestNames = this.collectGuestNames();
    const adultNames = guestNames.filter((g) => g.personType === 'adult');
    const childNames = guestNames.filter((g) => g.personType === 'child');

    // Check counts
    if (adultNames.length !== expectedAdults) {
      return {
        valid: false,
        error: `Vyplňte jména všech ${expectedAdults} dospělých`,
      };
    }

    if (childNames.length !== expectedChildren) {
      return {
        valid: false,
        error: `Vyplňte jména všech ${expectedChildren} dětí`,
      };
    }

    // Check each name for minimum length
    for (const guest of guestNames) {
      if (guest.firstName.length < 2) {
        return {
          valid: false,
          error: 'Všechna křestní jména musí mít alespoň 2 znaky',
        };
      }
      if (guest.lastName.length < 2) {
        return {
          valid: false,
          error: 'Všechna příjmení musí mít alespoň 2 znaky',
        };
      }
    }

    return { valid: true, guestNames };
  }

  /**
   * Helper method to attempt booking creation with error handling
   * Reduces nesting depth by extracting try-catch logic
   * @param {Object} booking - Booking data
   * @param {string} roomName - Room name for error logging
   * @returns {Promise<{success: boolean, error?: Error}>} Result object
   */
  async attemptBookingCreation(booking, roomName = '') {
    try {
      await dataManager.createBooking(booking);
      return { success: true };
    } catch (error) {
      const errorMsg = roomName
        ? `Error creating booking for room ${roomName}`
        : 'Error creating booking';
      console.error(errorMsg, error);
      return { success: false, error };
    }
  }

  /**
   * Process a single temp reservation (bulk or single room)
   * Reduces nesting depth by extracting if/else logic
   * @param {Object} tempReservation - Temporary reservation data
   * @param {Object} formData - Form data (name, email, etc.)
   * @param {Array} guestNames - Guest names array
   * @returns {Promise<{success: boolean}>} Result object
   */
  processTempReservation(tempReservation, formData, guestNames) {
    if (tempReservation.isBulkBooking) {
      const booking = {
        ...formData,
        startDate: tempReservation.startDate,
        endDate: tempReservation.endDate,
        rooms: tempReservation.roomIds,
        guestType: tempReservation.guestType,
        adults: tempReservation.guests.adults,
        children: tempReservation.guests.children,
        toddlers: tempReservation.guests.toddlers,
        totalPrice: tempReservation.totalPrice,
        notes: formData.notes || 'Hromadná rezervace celé chaty',
        isBulkBooking: true,
        sessionId: this.app.sessionId,
        guestNames,
      };
      return this.attemptBookingCreation(booking, 'bulk');
    }

    // Single room booking
    const booking = {
      ...formData,
      startDate: tempReservation.startDate,
      endDate: tempReservation.endDate,
      rooms: [tempReservation.roomId],
      guestType: tempReservation.guestType,
      adults: tempReservation.guests.adults,
      children: tempReservation.guests.children,
      toddlers: tempReservation.guests.toddlers,
      totalPrice: tempReservation.totalPrice,
      roomGuests: { [tempReservation.roomId]: tempReservation.guests },
      sessionId: this.app.sessionId,
      guestNames,
    };
    return this.attemptBookingCreation(booking, tempReservation.roomName);
  }
}
