// Calendar module - handles main calendar rendering and navigation
class CalendarModule {
  constructor(app) {
    this.app = app;
  }

  async navigateMonth(direction) {
    const newMonth = new Date(this.app.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);

    // Check if we're within allowed range (GRID mode boundaries)
    const newYear = newMonth.getFullYear();

    if (newYear < this.app.gridMinYear || newYear > this.app.gridMaxYear) {
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

    // Update navigation buttons (GRID mode boundaries)
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');

    if (year <= this.app.gridMinYear && month <= 0) {
      prevBtn.style.opacity = '0.3';
      prevBtn.style.cursor = 'not-allowed';
    } else {
      prevBtn.style.opacity = '1';
      prevBtn.style.cursor = 'pointer';
    }

    if (year >= this.app.gridMaxYear && month >= 11) {
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

    // Collect all day elements to create in parallel
    const dayElementPromises = [];

    // Add previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      dayElementPromises.push(
        this.createDayElement(new Date(year, month - 1, daysInPrevMonth - i), true)
      );
    }

    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
      dayElementPromises.push(this.createDayElement(new Date(year, month, day), false));
    }

    // Calculate next month days needed to complete the week
    const totalCells = startDay + daysInMonth;
    const nextMonthDaysNeeded = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= nextMonthDaysNeeded; day++) {
      dayElementPromises.push(this.createDayElement(new Date(year, month + 1, day), true));
    }

    // Create all day elements in parallel
    const dayElements = await Promise.all(dayElementPromises);

    // Now arrange them into weeks
    for (const dayEl of dayElements) {
      if (currentWeek.children.length === 7) {
        calendar.appendChild(currentWeek);
        currentWeek = document.createElement('div');
        currentWeek.className = 'calendar-week';
      }
      currentWeek.appendChild(dayEl);
    }
    if (currentWeek.children.length > 0) {
      calendar.appendChild(currentWeek);
    }
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

    // Add weekday name for mobile display (Po, Út, etc.)
    const weekdaySpan = document.createElement('span');
    weekdaySpan.className = 'calendar-day-weekday';
    const weekdayNames =
      this.app.currentLanguage === 'cs'
        ? ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdaySpan.textContent = weekdayNames[date.getDay()];
    dayHeader.appendChild(weekdaySpan);

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
    const roomElementPromises = rooms.map((room) =>
      this.createRoomElement(date, room, isPast, isOtherMonth)
    );
    const roomElements = await Promise.all(roomElementPromises);

    for (const roomEl of roomElements) {
      roomsContainer.appendChild(roomEl);
    }

    dayEl.appendChild(roomsContainer);

    return dayEl;
  }

  async createRoomElement(date, room, isPast, isOtherMonth) {
    const roomEl = document.createElement('div');
    roomEl.className = 'room-indicator';

    // Pass empty string to show ALL proposed bookings (including current user's)
    const availabilityInfo = await dataManager.getRoomAvailability(date, room.id, '');
    const availability = availabilityInfo.status;
    roomEl.classList.add(availability);

    // NIGHT-BASED MODEL:
    // - available: No nights occupied (green)
    // - edge: Exactly ONE night occupied (orange, clickable)
    // - occupied: BOTH nights occupied (red, shows details)
    // - blocked: Administratively blocked (gray)
    // - proposed: Pending booking (yellow)
    if (availability === 'proposed') {
      roomEl.style.background = '#f59e0b'; // Yellow for proposed bookings
      roomEl.style.color = 'white';
      roomEl.classList.add('proposed');
      roomEl.title = 'Navrhovaná rezervace - dočasně blokováno';
    } else if (availability === 'occupied') {
      // Occupied = both nights around day are occupied (red)
      roomEl.style.background = '#ef4444';
      roomEl.style.color = 'white';
    } else if (availability === 'edge') {
      // Edge = ONE or BOTH nights occupied (with different types)
      // Supports: proposed-only, confirmed-only, AND MIXED (proposed + confirmed)
      roomEl.style.color = 'white';

      // Get detailed night information
      const nightBefore = availabilityInfo?.nightBefore;
      const nightAfter = availabilityInfo?.nightAfter;
      const nightBeforeType = availabilityInfo?.nightBeforeType || 'available';
      const nightAfterType = availabilityInfo?.nightAfterType || 'available';

      // Color map
      const colorMap = {
        proposed: '#f59e0b', // Orange
        confirmed: '#ef4444', // Red
        available: '#10b981', // Green
      };

      // Type label map for tooltip
      const typeLabel = {
        proposed: 'navrhované',
        confirmed: 'potvrzené',
        available: 'volné',
      };

      const leftColor = colorMap[nightBeforeType];
      const rightColor = colorMap[nightAfterType];

      if (nightBefore && !nightAfter) {
        // Only night before occupied
        roomEl.style.background =
          `linear-gradient(90deg, ${leftColor} 0%, ${leftColor} 50%, ${colorMap.available} 50%, ${colorMap.available} 100%)`;
        roomEl.title = `Krajní den (${typeLabel[nightBeforeType]}, noc PŘED dnem) - volný pro novou rezervaci`;
      } else if (!nightBefore && nightAfter) {
        // Only night after occupied
        roomEl.style.background =
          `linear-gradient(90deg, ${colorMap.available} 0%, ${colorMap.available} 50%, ${rightColor} 50%, ${rightColor} 100%)`;
        roomEl.title = `Krajní den (${typeLabel[nightAfterType]}, noc PO dni) - volný pro novou rezervaci`;
      } else if (nightBefore && nightAfter) {
        // BOTH nights occupied but DIFFERENT TYPES (mixed: proposed + confirmed)
        roomEl.style.background =
          `linear-gradient(90deg, ${leftColor} 0%, ${leftColor} 50%, ${rightColor} 50%, ${rightColor} 100%)`;
        roomEl.title = `Smíšený krajní den (noc PŘED: ${typeLabel[nightBeforeType]}, noc PO: ${typeLabel[nightAfterType]}) - volný pro novou rezervaci`;
      } else {
        // Fallback
        roomEl.style.background =
          `linear-gradient(90deg, ${colorMap.available} 0%, ${colorMap.available} 50%, ${colorMap.confirmed} 50%, ${colorMap.confirmed} 100%)`;
        roomEl.title = 'Krajní den rezervace - volný pro novou rezervaci';
      }
    } else if (availability === 'available') {
      roomEl.style.background = '#10b981';
      roomEl.style.color = 'white';
    }
    // Don't set inline styles for blocked - let CSS handle it

    if (availability === 'available' && !isOtherMonth && !isPast) {
      roomEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.app.toggleRoomSelection(date, room.id, roomEl);
      });
      roomEl.style.cursor = 'pointer';
    } else if (availability === 'edge' && !isOtherMonth && !isPast) {
      // Edge days can be clicked for selection OR to view booking details
      roomEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        // Allow both booking selection and showing details
        // Check if shift/ctrl key is pressed to show details instead
        if (e.shiftKey || e.ctrlKey) {
          await this.app.showBookingDetails(date, room.id);
        } else {
          await this.app.toggleRoomSelection(date, room.id, roomEl);
        }
      });
      roomEl.style.cursor = 'pointer';
      roomEl.title += ' | Shift+klik pro detail';
    } else if (availability === 'occupied') {
      roomEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.app.showBookingDetails(date, room.id);
      });
      roomEl.style.cursor = 'pointer';
      roomEl.title = 'Obsazeno (obě noci kolem dne) - klikněte pro detail';
    } else if (availability === 'blocked') {
      // Blocked rooms should be clickable even for past dates
      roomEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.app.showBlockedDetails(date, room.id);
      });
      roomEl.style.cursor = 'pointer';
      roomEl.title = 'Klikněte pro zobrazení důvodu blokace';
    } else if (availability === 'proposed') {
      // Proposed bookings are not clickable - they're temporary
      roomEl.style.cursor = 'not-allowed';
    }

    roomEl.textContent = `P${room.id}`;

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
    // CRITICAL FIX: Force refresh data from server before rendering
    await dataManager.getData(true); // Force refresh

    // Animate newly booked rooms
    this.app.recentlyBookedRooms = [];

    // Use per-room dates if available, otherwise fall back to global dates
    if (booking.perRoomDates && Object.keys(booking.perRoomDates).length > 0) {
      // Highlight each room based on its specific date range
      booking.rooms.forEach((roomId) => {
        const roomDates = booking.perRoomDates[roomId];
        if (roomDates) {
          const checkIn = new Date(roomDates.startDate);
          const checkOut = new Date(roomDates.endDate);
          const current = new Date(checkIn);

          // Highlight all days from start to end date (inclusive) for this room
          while (current.getTime() <= checkOut.getTime()) {
            const dateStr = dataManager.formatDate(current);
            this.app.recentlyBookedRooms.push({ date: dateStr, roomId });
            current.setDate(current.getDate() + 1);
          }
        }
      });
    } else {
      // Fallback: use global dates for all rooms (legacy bookings)
      const checkIn = new Date(booking.startDate);
      const checkOut = new Date(booking.endDate);
      const current = new Date(checkIn);

      // Highlight all days from start to end date (inclusive)
      while (current.getTime() <= checkOut.getTime()) {
        const dateStr = dataManager.formatDate(current);
        booking.rooms.forEach((roomId) => {
          this.app.recentlyBookedRooms.push({ date: dateStr, roomId });
        });
        current.setDate(current.getDate() + 1);
      }
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
