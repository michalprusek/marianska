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

    // Set default guest configuration
    this.app.roomGuests.set(roomId, { adults: 1, children: 0, toddlers: 0 });
    this.app.roomGuestTypes.set(roomId, 'utia');

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
        dates.forEach(date => this.app.selectedDates.add(date));
        await this.app.updateSelectedDatesDisplay();
        await this.app.updatePriceCalculation();
      });
    } else {
      // Fallback to original mini calendar
      await this.renderMiniCalendar(roomId);
      await this.app.updateSelectedDatesDisplay();
      await this.app.updatePriceCalculation();
    }
  }

  async renderMiniCalendar(roomId) {
    const miniCalendar = document.getElementById('miniCalendar');
    const monthTitle = document.getElementById('miniCalendarMonth');

    const year = this.app.currentMonth.getFullYear();
    const month = this.app.currentMonth.getMonth();

    // Update month title
    const monthNames =
      this.app.currentLanguage === 'cs'
        ? [
            'Leden',
            'Únor',
            'Březen',
            'Duben',
            'Květen',
            'Červen',
            'Červenec',
            'Srpen',
            'Září',
            'Říjen',
            'Listopad',
            'Prosinec',
          ]
        : [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December',
          ];
    monthTitle.textContent = `${monthNames[month]} ${year}`;

    // Clear and build calendar
    miniCalendar.innerHTML = '';

    // Add day headers
    const dayHeaders =
      this.app.currentLanguage === 'cs'
        ? ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const headerRow = document.createElement('div');
    headerRow.className = 'mini-calendar-week';
    dayHeaders.forEach((day) => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'mini-calendar-day-header';
      dayHeader.textContent = day;
      headerRow.appendChild(dayHeader);
    });
    miniCalendar.appendChild(headerRow);

    // Get first day of month and adjust for Monday start
    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) {
      startDay = 6;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

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
            // Single click - toggle selection
            if (this.app.selectedDates.has(dateStr)) {
              this.app.selectedDates.delete(dateStr);
            } else {
              this.app.selectedDates.add(dateStr);
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
}
