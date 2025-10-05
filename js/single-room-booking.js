// Single room booking module - handles individual room reservation modals
class SingleRoomBookingModule {
  constructor(app) {
    this.app = app;
    this.airbnbCalendar = null;
  }

  async showRoomBookingModal(roomId) {
    const modal = document.getElementById('singleRoomBookingModal');
    const modalTitle = document.getElementById('roomBookingTitle');

    const rooms = await dataManager.getRooms();
    const room = rooms.find((r) => r.id === roomId);

    if (!room) {
      console.error('Room not found:', roomId);
      return;
    }

    modalTitle.textContent = `${this.app.currentLanguage === 'cs' ? 'Rezervace' : 'Book'} ${room.name}`;

    this.app.currentBookingRoom = roomId;
    this.app.selectedDates.clear();
    this.app.selectedRooms.clear();
    this.app.roomGuests.clear();
    this.app.roomGuestTypes.clear();

    // Set default guest configuration - ensure it respects room capacity
    const defaultGuests = { adults: 1, children: 0, toddlers: 0 };

    // Validate against room capacity
    const totalGuests = defaultGuests.adults + defaultGuests.children;
    if (totalGuests > room.beds) {
      // Adjust to fit room capacity
      defaultGuests.children = 0;
      defaultGuests.adults = Math.min(1, room.beds);
    }

    this.app.roomGuests.set(roomId, defaultGuests);
    this.app.roomGuestTypes.set(roomId, 'utia');

    // Update display of guest counts
    const adultsEl = document.getElementById('singleRoomAdults');
    const childrenEl = document.getElementById('singleRoomChildren');
    const toddlersEl = document.getElementById('singleRoomToddlers');

    if (adultsEl) {
      adultsEl.textContent = defaultGuests.adults.toString();
    }
    if (childrenEl) {
      childrenEl.textContent = defaultGuests.children.toString();
    }
    if (toddlersEl) {
      toddlersEl.textContent = defaultGuests.toddlers.toString();
    }

    // Reset form - check if elements exist first
    const nameEl = document.getElementById('singleRoomName');
    const emailEl = document.getElementById('singleRoomEmail');
    const phoneEl = document.getElementById('singleRoomPhone');
    const notesEl = document.getElementById('singleRoomNotes');

    if (nameEl) {
      nameEl.value = '';
    }
    if (emailEl) {
      emailEl.value = '';
    }
    if (phoneEl) {
      phoneEl.value = '';
    }
    if (notesEl) {
      notesEl.value = '';
    }

    // Reset guest type radio buttons
    const utiaRadio = document.querySelector('input[name="singleRoomGuestType"][value="utia"]');
    if (utiaRadio) {
      utiaRadio.checked = true;
    }

    // Hide price breakdown initially since no dates are selected
    const priceBreakdownEl = document.getElementById('priceBreakdown');
    if (priceBreakdownEl) {
      priceBreakdownEl.style.display = 'none';
    }

    // Add active class first to make modal visible
    modal.classList.add('active');

    // Use BaseCalendar instead of old implementations
    await this.renderMiniCalendar(roomId);
    await this.app.updateSelectedDatesDisplay();
    await this.app.updatePriceCalculation();

    // Ensure room is selected for price calculation
    this.app.selectedRooms.add(roomId);
    await this.app.updatePriceCalculation();
  }

  async renderMiniCalendar(roomId) {
    // Initialize BaseCalendar if not exists
    if (!this.miniCalendar) {
      this.miniCalendar = new BaseCalendar({
        mode: BaseCalendar.MODES.SINGLE_ROOM,
        app: this.app,
        containerId: 'miniCalendar',
        roomId,
        allowPast: false,
        enforceContiguous: true,
        minNights: 2,
        onDateSelect: async () => {
          // Sync with app's selectedDates
          this.app.selectedDates = this.miniCalendar.selectedDates;
          await this.app.updateSelectedDatesDisplay();
          await this.app.updatePriceCalculation();
        },
        onDateDeselect: async () => {
          // Sync with app's selectedDates
          this.app.selectedDates = this.miniCalendar.selectedDates;
          await this.app.updateSelectedDatesDisplay();
          await this.app.updatePriceCalculation();
        },
      });
    }

    // Update roomId if changed
    this.miniCalendar.config.roomId = roomId;

    // Sync app's selectedDates with calendar's selectedDates
    this.miniCalendar.selectedDates = this.app.selectedDates;

    // Render calendar
    await this.miniCalendar.render();
  }

  navigateMiniCalendar(direction) {
    if (this.miniCalendar) {
      this.miniCalendar.navigateMonth(direction);
    }
  }

  hideRoomBookingModal() {
    const modal = document.getElementById('singleRoomBookingModal');
    modal.classList.remove('active');

    // Clean up
    this.app.currentBookingRoom = null;
    this.app.selectedDates.clear();
    this.app.isDragging = false;
    this.app.dragStartDate = null;
    this.app.dragEndDate = null;
  }

  async confirmRoomBooking() {
    // Validate that dates are selected
    if (this.app.selectedDates.size === 0) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs' ? 'Vyberte prosím termín pobytu' : 'Please select dates',
        'warning'
      );
      return;
    }

    // Validate minimum 2 days (1 night)
    if (this.app.selectedDates.size < 2) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Minimální rezervace je na 1 noc (2 dny)'
          : 'Minimum booking is for 1 night (2 days)',
        'warning'
      );
      return;
    }

    // Validate room is selected
    if (!this.app.currentBookingRoom) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Chyba: Žádný pokoj není vybrán'
          : 'Error: No room selected',
        'error'
      );
      return;
    }

    // Validate no blocked dates in selection
    const sortedDatesArray = Array.from(this.app.selectedDates).sort();
    for (const dateStr of sortedDatesArray) {
      const date = new Date(`${dateStr}T12:00:00`);
      const availability = await dataManager.getRoomAvailability(date, this.app.currentBookingRoom);

      if (availability.status === 'blocked') {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? 'Vybraný termín obsahuje blokované dny. Vyberte jiný termín.'
            : 'Selected dates include blocked days. Please choose different dates.',
          'error'
        );
        return;
      }
    }

    // Get guest configuration
    const guests = this.app.roomGuests.get(this.app.currentBookingRoom) || {
      adults: 1,
      children: 0,
      toddlers: 0,
    };

    // Get guest type
    const guestTypeInput = document.querySelector('input[name="singleRoomGuestType"]:checked');
    const guestType = guestTypeInput ? guestTypeInput.value : 'utia';

    // Get dates
    const sortedDates = Array.from(this.app.selectedDates).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    // Calculate price
    const rooms = await dataManager.getRooms();
    const room = rooms.find((r) => r.id === this.app.currentBookingRoom);

    if (!room) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs' ? 'Chyba: Pokoj nebyl nalezen' : 'Error: Room not found',
        'error'
      );
      return;
    }

    const nights = sortedDates.length - 1;
    const price = await dataManager.calculatePrice(
      guestType,
      guests.adults,
      guests.children,
      guests.toddlers,
      nights,
      1
    );

    // Create proposed booking in database
    try {
      const proposalId = await dataManager.createProposedBooking(
        startDate,
        endDate,
        [this.app.currentBookingRoom],
        guests,
        guestType,
        price
      );

      // Create temporary booking object with proposal ID
      const tempBooking = {
        roomId: this.app.currentBookingRoom,
        roomName: room.name,
        startDate,
        endDate,
        nights,
        guests,
        guestType,
        totalPrice: price,
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        proposalId, // Store the proposal ID for cleanup
      };

      // Add to a temporary reservations list
      if (!this.app.tempReservations) {
        this.app.tempReservations = [];
      }
      this.app.tempReservations.push(tempBooking);

      // Show success notification
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? `${room.name} přidán do rezervace`
          : `${room.name} added to reservation`,
        'success'
      );

      // Close the modal
      this.hideRoomBookingModal();

      // Update the main page to show temporary reservations (also refreshes calendar)
      await this.app.displayTempReservations();

      // Show the finalize button
      const finalizeDiv = document.getElementById('finalizeReservationsDiv');
      if (finalizeDiv && this.app.tempReservations.length > 0) {
        finalizeDiv.style.display = 'block';
      }
    } catch (error) {
      console.error('Failed to create proposed booking:', error);
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Chyba při vytváření dočasné rezervace'
          : 'Error creating temporary reservation',
        'error'
      );
    }
  }
}
