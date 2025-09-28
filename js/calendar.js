// Calendar module - handles main calendar rendering and navigation
class CalendarModule {
  constructor(app) {
    this.app = app;
  }

  async navigateMonth(direction) {
    const newMonth = new Date(this.app.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);

    // Check if we're within allowed range
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
    await this.app.renderCalendar();
  }

  async renderCalendar() {
    const calendar = document.getElementById('calendar');
    const monthTitle = document.getElementById('currentMonth');

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

    // Update navigation buttons
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');

    if (year <= this.app.minYear && month <= 0) {
      prevBtn.style.opacity = '0.3';
      prevBtn.style.cursor = 'not-allowed';
    } else {
      prevBtn.style.opacity = '1';
      prevBtn.style.cursor = 'pointer';
    }

    if (year === this.app.maxYear && month >= this.app.maxMonth) {
      nextBtn.style.opacity = '0.3';
      nextBtn.style.cursor = 'not-allowed';
    } else {
      nextBtn.style.opacity = '1';
      nextBtn.style.cursor = 'pointer';
    }

    // Clear calendar
    calendar.innerHTML = '';

    // Add day headers
    const dayHeaders =
      this.app.currentLanguage === 'cs'
        ? ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const headerRow = document.createElement('div');
    headerRow.className = 'calendar-week';
    dayHeaders.forEach((day) => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-day-header';
      dayHeader.textContent = day;
      headerRow.appendChild(dayHeader);
    });
    calendar.appendChild(headerRow);

    // Get first day of month and adjust for Monday start
    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) {
      startDay = 6;
    }

    // Get days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Create calendar grid
    let currentWeek = document.createElement('div');
    currentWeek.className = 'calendar-week';

    // Add previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const dayEl = await this.createDayElement(
        new Date(year, month - 1, daysInPrevMonth - i),
        true
      );
      currentWeek.appendChild(dayEl);
    }

    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
      if (currentWeek.children.length === 7) {
        calendar.appendChild(currentWeek);
        currentWeek = document.createElement('div');
        currentWeek.className = 'calendar-week';
      }

      const dayEl = await this.createDayElement(new Date(year, month, day), false);
      currentWeek.appendChild(dayEl);
    }

    // Add next month days to complete the week
    let nextMonthDay = 1;
    while (currentWeek.children.length < 7) {
      const dayEl = await this.createDayElement(new Date(year, month + 1, nextMonthDay), true);
      currentWeek.appendChild(dayEl);
      nextMonthDay++;
    }
    calendar.appendChild(currentWeek);
  }

  async createDayElement(date, isOtherMonth) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    if (isOtherMonth) {
      dayEl.classList.add('other-month');
    }

    const dateStr = dataManager.formatDate(date);
    const isPast = date < this.app.today;
    const isChristmas = await dataManager.isChristmasPeriod(date);

    // Check if date is in the past
    if (isPast) {
      dayEl.classList.add('disabled');
      dayEl.style.opacity = '0.5';
      dayEl.style.cursor = 'not-allowed';
    }

    // Check if this date is in selected range
    if (this.app.isDateInSelectedRange && this.app.isDateInSelectedRange(dateStr)) {
      dayEl.classList.add('selected-date');

      // Check if this is the start or end of range
      if (this.app.firstSelectedDate && this.app.dragEndDate) {
        const startDate = new Date(
          Math.min(new Date(this.app.firstSelectedDate), new Date(this.app.dragEndDate))
        );
        const endDate = new Date(
          Math.max(new Date(this.app.firstSelectedDate), new Date(this.app.dragEndDate))
        );

        if (dataManager.formatDate(startDate) === dateStr) {
          dayEl.classList.add('range-start');
        }
        if (dataManager.formatDate(endDate) === dateStr) {
          dayEl.classList.add('range-end');
        }
      } else if (this.app.firstSelectedDate === dateStr) {
        dayEl.classList.add('range-start', 'range-end');
      }
    }

    // Check if this is Christmas period
    if (isChristmas) {
      dayEl.style.background = 'linear-gradient(135deg, #ffcccc, #ffdddd)';
      dayEl.style.border = '2px solid var(--warning-color)';
    }

    // Day header
    const dayHeader = document.createElement('div');
    dayHeader.className = 'calendar-day-header';

    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = date.getDate();
    dayHeader.appendChild(dayNumber);

    if (isChristmas) {
      const christmasLabel = document.createElement('span');
      christmasLabel.style.fontSize = '0.7rem';
      christmasLabel.style.color = 'var(--danger-color)';
      christmasLabel.textContent = '🎄';
      dayHeader.appendChild(christmasLabel);
    }

    dayEl.appendChild(dayHeader);

    // Room indicators
    const roomsContainer = document.createElement('div');
    roomsContainer.className = 'calendar-day-rooms';

    const rooms = await dataManager.getRooms();
    for (const room of rooms) {
      const roomEl = await this.createRoomElement(date, room, isPast, isOtherMonth);
      roomsContainer.appendChild(roomEl);
    }

    dayEl.appendChild(roomsContainer);

    return dayEl;
  }

  async createRoomElement(date, room, isPast, isOtherMonth) {
    const roomEl = document.createElement('div');
    roomEl.className = 'room-indicator';

    const availabilityInfo = await dataManager.getRoomAvailability(date, room.id);
    const availability = availabilityInfo.status;
    const dateStr = dataManager.formatDate(date);
    roomEl.classList.add(availability);

    // Apply color for booked and available rooms only
    // Blocked rooms use CSS for their styling
    if (availability === 'booked') {
      roomEl.style.background = '#ff8c00';
      roomEl.style.color = 'white';
    } else if (availability === 'available') {
      roomEl.style.background = '#28a745';
      roomEl.style.color = 'white';
    }
    // Don't set inline styles for blocked - let CSS handle it

    if (availability === 'available' && !isOtherMonth && !isPast) {
      roomEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.app.toggleRoomSelection(date, room.id, roomEl);
      });
      roomEl.style.cursor = 'pointer';
    } else if (availability === 'booked') {
      roomEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.app.showBookingDetails(date, room.id);
      });
      roomEl.style.cursor = 'pointer';
      roomEl.title = 'Klikněte pro zobrazení detailu rezervace';
    } else if (availability === 'blocked') {
      // Blocked rooms should be clickable even for past dates
      roomEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.app.showBlockedDetails(date, room.id);
      });
      roomEl.style.cursor = 'pointer';
      roomEl.title = 'Klikněte pro zobrazení důvodu blokace';
    }

    roomEl.textContent = room.id;

    return roomEl;
  }

  getRoomStatusText(status, isSelected) {
    const lang = this.app.currentLanguage;
    if (isSelected) {
      return lang === 'cs' ? 'Vybraný' : 'Selected';
    }
    switch (status) {
      case 'available':
        return lang === 'cs' ? 'Volný' : 'Available';
      case 'booked':
        return lang === 'cs' ? 'Obsazený' : 'Booked';
      case 'blocked':
        return lang === 'cs' ? 'Blokovaný' : 'Blocked';
      default:
        return '';
    }
  }

  async highlightNewBooking(booking) {
    // Animate newly booked rooms
    this.app.recentlyBookedRooms = [];

    const checkIn = new Date(booking.startDate);
    const checkOut = new Date(booking.endDate);
    const current = new Date(checkIn);

    while (current <= checkOut) {
      const dateStr = dataManager.formatDate(current);
      booking.rooms.forEach((roomId) => {
        this.app.recentlyBookedRooms.push({ date: dateStr, roomId });
      });
      current.setDate(current.getDate() + 1);
    }

    // Re-render calendar to show new booking with animation
    await this.renderCalendar();

    // Clear the highlight after animation
    setTimeout(() => {
      this.app.recentlyBookedRooms = [];
    }, 3000);
  }

  // Toggle legend visibility
  toggleLegend() {
    const legend = document.getElementById('calendarLegend');
    const toggleBtn = document.getElementById('legendToggle');
    const toggleText = toggleBtn.querySelector('.legend-toggle-text');
    const isHidden = legend.classList.contains('legend-hidden');

    if (isHidden) {
      // Show legend with smooth animation
      legend.classList.remove('legend-hidden');
      legend.classList.add('legend-visible');
      toggleBtn.setAttribute('aria-expanded', 'true');
      toggleText.textContent = this.app.currentLanguage === 'cs' ? 'Skrýt legendu' : 'Hide legend';

      // Smooth scroll to legend after a slight delay to ensure animation starts
      setTimeout(() => {
        // Wait a bit more for animation to complete and get accurate height
        setTimeout(() => {
          const legendRect = legend.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const viewportHeight = window.innerHeight;
          const legendHeight = legendRect.height;

          // Calculate position to show the entire legend at the bottom of viewport
          let targetPosition;

          if (legendHeight < viewportHeight - 50) {
            // If legend fits in viewport, position it so the bottom is visible with padding
            targetPosition = scrollTop + legendRect.bottom - viewportHeight + 30;
          } else {
            // If legend is too tall, just scroll to the top of it
            targetPosition = scrollTop + legendRect.top - 20;
          }

          // Make sure we don't scroll up if legend is already fully visible
          const legendBottom = legendRect.bottom;
          const viewportBottom = viewportHeight;

          if (legendBottom > viewportBottom) {
            window.scrollTo({
              top: targetPosition,
              behavior: 'smooth',
            });
          }
        }, 300); // Extra delay to let CSS animation complete
      }, 100);
    } else {
      // Hide legend with smooth animation
      legend.classList.add('legend-hidden');
      legend.classList.remove('legend-visible');
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleText.textContent =
        this.app.currentLanguage === 'cs' ? 'Zobrazit legendu' : 'Show legend';
    }
  }
}
