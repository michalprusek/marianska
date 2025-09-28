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

    // Room capacity initialized with guest defaults

    // Initialize drag selection state
    this.app.isDragging = false;
    this.app.dragStartDate = null;
    this.app.dragEndDate = null;
    this.app.dragClickStart = null;

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

    // Initialize Airbnb calendar if available, otherwise use mini calendar
    if (typeof AirbnbCalendarModule !== 'undefined') {
      if (!this.airbnbCalendar) {
        this.airbnbCalendar = new AirbnbCalendarModule(this.app);
      }
      await this.airbnbCalendar.initCalendar('miniCalendar', roomId, 'single');

      // Listen for date selection events
      this.airbnbCalendar.addEventListener('dates-selected', async (event) => {
        const { checkIn, checkOut, dates } = event.detail;
        this.app.selectedDates.clear();
        dates.forEach((date) => this.app.selectedDates.add(date));
        await this.app.updateSelectedDatesDisplay();
        await this.app.updatePriceCalculation();
      });
    } else {
      // Fallback to original mini calendar
      await this.renderMiniCalendar(roomId);
      await this.app.updateSelectedDatesDisplay();
      await this.app.updatePriceCalculation();
    }

    // Ensure room is selected for price calculation
    this.app.selectedRooms.add(roomId);
    await this.app.updatePriceCalculation();
  }

  async renderMiniCalendar(roomId) {
    const miniCalendar = document.getElementById('miniCalendar');
    const monthTitle = document.getElementById('miniCalendarMonth');

    // Use shared calendar utilities
    const calendarData = CalendarUtils.getCalendarDays(this.app.currentMonth);
    const { year, month, startDay, daysInMonth, daysInPrevMonth } = calendarData;

    // Update month title using shared utility
    const monthName = CalendarUtils.getMonthName(month, this.app.currentLanguage);
    monthTitle.textContent = `${monthName} ${year}`;

    // Clear and build calendar
    miniCalendar.innerHTML = '';

    // Add day headers using shared utility
    const dayHeaders = CalendarUtils.getWeekdayHeaders(this.app.currentLanguage);

    const headerRow = document.createElement('div');
    headerRow.className = 'mini-calendar-week';
    dayHeaders.forEach((day) => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'mini-calendar-day-header';
      dayHeader.textContent = day;
      headerRow.appendChild(dayHeader);
    });
    miniCalendar.appendChild(headerRow);

    // Create calendar grid
    let currentWeek = document.createElement('div');
    currentWeek.className = 'mini-calendar-week';

    // Add previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      const dayEl = await this.createMiniDayElement(date, roomId, true);
      currentWeek.appendChild(dayEl);
    }

    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
      if (currentWeek.children.length === 7) {
        miniCalendar.appendChild(currentWeek);
        currentWeek = document.createElement('div');
        currentWeek.className = 'mini-calendar-week';
      }

      const date = new Date(year, month, day);
      const dayEl = await this.createMiniDayElement(date, roomId, false);
      currentWeek.appendChild(dayEl);
    }

    // Add next month days
    let nextMonthDay = 1;
    while (currentWeek.children.length < 7) {
      const date = new Date(year, month + 1, nextMonthDay);
      const dayEl = await this.createMiniDayElement(date, roomId, true);
      currentWeek.appendChild(dayEl);
      nextMonthDay++;
    }
    miniCalendar.appendChild(currentWeek);
  }

  async createMiniDayElement(date, roomId, isOtherMonth) {
    const dayEl = document.createElement('div');
    dayEl.className = 'mini-calendar-day';

    const dateStr = dataManager.formatDate(date);
    const isPast = date < this.app.today;
    const availability = await dataManager.getRoomAvailability(date, roomId);
    const isChristmas = await dataManager.isChristmasPeriod(date);

    // Styling
    if (isOtherMonth) {
      dayEl.classList.add('other-month');
    }

    if (isPast) {
      dayEl.classList.add('disabled');
    } else if (availability.status === 'booked') {
      dayEl.classList.add('booked');
    } else if (availability.status === 'blocked') {
      dayEl.classList.add('blocked');
    } else {
      dayEl.classList.add('available');
    }

    // Check if day is in selection
    const isSelected = this.app.selectedDates.has(dateStr);
    if (isSelected) {
      dayEl.classList.add('selected');
    }

    // Check if day is in drag range
    if (this.app.isDragging && this.app.dragStartDate && this.app.dragEndDate) {
      const startDate = new Date(
        Math.min(new Date(this.app.dragStartDate), new Date(this.app.dragEndDate))
      );
      const endDate = new Date(
        Math.max(new Date(this.app.dragStartDate), new Date(this.app.dragEndDate))
      );
      if (date >= startDate && date <= endDate && !isPast && availability.status === 'available') {
        dayEl.classList.add('in-range');
      }
    }

    // Content
    if (isChristmas && !isOtherMonth) {
      dayEl.innerHTML = `🎄 ${date.getDate()}`;
      dayEl.classList.add('christmas');
    } else {
      dayEl.textContent = date.getDate();
    }

    // Event handlers for drag selection
    if (!isPast && !isOtherMonth && availability.status === 'available') {
      dayEl.style.cursor = 'pointer';

      // Prevent text selection
      dayEl.style.userSelect = 'none';
      dayEl.style.webkitUserSelect = 'none';
      dayEl.style.mozUserSelect = 'none';
      dayEl.style.msUserSelect = 'none';

      dayEl.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.app.isDragging = true;
        this.app.dragStartDate = dateStr;
        this.app.dragEndDate = dateStr;
        this.app.dragClickStart = Date.now();
        this.updateDragSelection();
        return false;
      };

      dayEl.onmouseenter = () => {
        if (this.app.isDragging) {
          this.app.dragEndDate = dateStr;
          this.updateDragSelection();
        }
      };

      dayEl.onmouseup = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const clickDuration = Date.now() - this.app.dragClickStart;
        const wasDrag = this.app.isDragging && clickDuration > 150;

        if (this.app.isDragging) {
          this.app.isDragging = false;

          if (wasDrag && this.app.dragStartDate && this.app.dragEndDate) {
            // Complete drag selection
            await this.selectMiniCalendarRange(this.app.dragStartDate, this.app.dragEndDate);
          } else {
            // Single click - handle minimum 2 days selection
            if (this.app.selectedDates.size === 0) {
              // First click - select this day and the next day (minimum 1 night)
              const selectedDate = new Date(dateStr);
              const nextDate = new Date(selectedDate);
              nextDate.setDate(nextDate.getDate() + 1);

              // Check if next day is available
              const nextDateStr = dataManager.formatDate(nextDate);
              const nextAvailability = await dataManager.getRoomAvailability(
                nextDate,
                this.app.currentBookingRoom
              );

              if (nextAvailability.status === 'available') {
                this.app.selectedDates.add(dateStr);
                this.app.selectedDates.add(nextDateStr);
              } else {
                // If next day is not available, show warning
                this.app.showNotification(
                  this.app.currentLanguage === 'cs'
                    ? 'Minimální rezervace je na 1 noc (2 dny). Následující den není dostupný.'
                    : 'Minimum booking is for 1 night (2 days). The next day is not available.',
                  'warning'
                );
              }
            } else if (this.app.selectedDates.has(dateStr)) {
              // Clicking on already selected date - check if we can deselect
              const sortedDates = Array.from(this.app.selectedDates).sort();

              // Only allow deselection if it won't leave us with just 1 day
              if (sortedDates.length > 2) {
                // Check if this is an edge date (first or last)
                if (dateStr === sortedDates[0] || dateStr === sortedDates[sortedDates.length - 1]) {
                  this.app.selectedDates.delete(dateStr);
                } else {
                  // Middle date - would break the range, so clear all
                  this.app.selectedDates.clear();
                }
              } else if (sortedDates.length === 2) {
                // Clear both days
                this.app.selectedDates.clear();
              }
            } else {
              // Clicking on unselected date - extend the range
              this.app.selectedDates.add(dateStr);

              // Fill any gaps to maintain continuous range
              const sortedDates = Array.from(this.app.selectedDates).sort();
              const startDate = new Date(sortedDates[0]);
              const endDate = new Date(sortedDates[sortedDates.length - 1]);

              const current = new Date(startDate);
              while (current <= endDate) {
                const currentStr = dataManager.formatDate(current);
                const availability = await dataManager.getRoomAvailability(
                  current,
                  this.app.currentBookingRoom
                );

                if (availability.status === 'available') {
                  this.app.selectedDates.add(currentStr);
                } else {
                  // Can't create continuous range
                  this.app.selectedDates.clear();
                  this.app.selectedDates.add(dateStr);
                  const nextDate = new Date(dateStr);
                  nextDate.setDate(nextDate.getDate() + 1);
                  const nextDateStr = dataManager.formatDate(nextDate);
                  const nextAvail = await dataManager.getRoomAvailability(
                    nextDate,
                    this.app.currentBookingRoom
                  );
                  if (nextAvail.status === 'available') {
                    this.app.selectedDates.add(nextDateStr);
                  }
                  break;
                }

                current.setDate(current.getDate() + 1);
              }
            }
          }

          this.app.dragStartDate = null;
          this.app.dragEndDate = null;
          this.app.dragClickStart = null;

          await this.renderMiniCalendar(roomId);
          await this.app.updateSelectedDatesDisplay();
          await this.app.updatePriceCalculation();
        }

        return false;
      };
    }

    return dayEl;
  }

  updateDragSelection() {
    requestAnimationFrame(async () => {
      await this.renderMiniCalendar(this.app.currentBookingRoom);
    });
  }

  async selectMiniCalendarRange(startStr, endStr) {
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    const actualStart = new Date(Math.min(startDate, endDate));
    const actualEnd = new Date(Math.max(startDate, endDate));

    this.app.selectedDates.clear();

    const currentDate = new Date(actualStart);
    while (currentDate <= actualEnd) {
      const dateStr = dataManager.formatDate(currentDate);
      const availability = await dataManager.getRoomAvailability(
        currentDate,
        this.app.currentBookingRoom
      );
      const isPast = currentDate < this.app.today;

      if (!isPast && availability.status === 'available') {
        this.app.selectedDates.add(dateStr);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  navigateMiniCalendar(direction) {
    const newMonth = new Date(this.app.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);

    const newYear = newMonth.getFullYear();
    const newMonthNum = newMonth.getMonth();

    if (newYear < this.app.minYear) {
      return;
    }
    if (
      newYear > this.app.maxYear ||
      (newYear === this.app.maxYear && newMonthNum > this.app.maxMonth)
    ) {
      return;
    }

    this.app.currentMonth = newMonth;
    this.renderMiniCalendar(this.app.currentBookingRoom);
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

    // Create temporary booking object
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
    };

    // Add to a temporary reservations list
    if (!this.app.tempReservations) {
      this.app.tempReservations = [];
    }
    this.app.tempReservations.push(tempBooking);

    // Show success notification
    this.app.showNotification(
      this.app.currentLanguage === 'cs'
        ? `Pokoj ${room.name} přidán do rezervace`
        : `Room ${room.name} added to reservation`,
      'success'
    );

    // Close the modal
    this.hideRoomBookingModal();

    // Update the main page to show temporary reservations
    this.app.displayTempReservations();

    // Show the finalize button
    const finalizeDiv = document.getElementById('finalizeReservationsDiv');
    if (finalizeDiv && this.app.tempReservations.length > 0) {
      finalizeDiv.style.display = 'block';
    }
  }
}
