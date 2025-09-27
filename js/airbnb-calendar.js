// Airbnb-style date selection module for the reservation system
class AirbnbCalendarModule {
  constructor(app) {
    this.app = app;
    this.checkInDate = null;
    this.checkOutDate = null;
    this.hoverDate = null;
    this.mode = 'single'; // 'single' or 'bulk'
    this.roomId = null;
    this.isSelecting = false;
    this.events = new EventTarget();

    // Bind methods to preserve context
    this.handleDateClick = this.handleDateClick.bind(this);
    this.handleDateHover = this.handleDateHover.bind(this);
    this.handleDateLeave = this.handleDateLeave.bind(this);
  }

  /**
   * Initialize the Airbnb-style calendar
   * @param {string} containerId - ID of the calendar container
   * @param {string} roomId - Room ID for single room mode
   * @param {string} mode - 'single' or 'bulk' booking mode
   */
  async initCalendar(containerId, roomId = null, mode = 'single') {
    this.mode = mode;
    this.roomId = roomId;
    this.containerId = containerId;

    // Clear previous state
    this.clearSelection();

    // Render the calendar
    await this.renderCalendar();

    // Emit initialization event
    this.events.dispatchEvent(
      new CustomEvent('calendar-initialized', {
        detail: { mode, roomId, containerId },
      })
    );
  }

  /**
   * Render the Airbnb-style calendar
   */
  async renderCalendar() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Calendar container ${this.containerId} not found`);
      return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Add calendar styling class
    container.classList.add('airbnb-calendar');

    // Create calendar structure
    const calendarWrapper = this.createCalendarWrapper();
    container.appendChild(calendarWrapper);

    // Render the current month
    await this.renderMonth(this.app.currentMonth);

    // Add date labels if dates are selected
    this.updateDateLabels();
  }

  /**
   * Create the calendar wrapper structure
   */
  createCalendarWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'airbnb-calendar-wrapper';

    // Header with navigation
    const header = document.createElement('div');
    header.className = 'airbnb-calendar-header';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'airbnb-nav-btn airbnb-nav-prev';
    prevBtn.innerHTML = '❮';
    prevBtn.onclick = () => this.navigateMonth(-1);

    const monthTitle = document.createElement('h3');
    monthTitle.className = 'airbnb-month-title';
    monthTitle.id = `${this.containerId}-month-title`;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'airbnb-nav-btn airbnb-nav-next';
    nextBtn.innerHTML = '❯';
    nextBtn.onclick = () => this.navigateMonth(1);

    header.appendChild(prevBtn);
    header.appendChild(monthTitle);
    header.appendChild(nextBtn);

    // Calendar grid
    const calendar = document.createElement('div');
    calendar.className = 'airbnb-calendar-grid';
    calendar.id = `${this.containerId}-grid`;

    // Date labels
    const dateLabels = document.createElement('div');
    dateLabels.className = 'airbnb-date-labels';
    dateLabels.id = `${this.containerId}-labels`;

    wrapper.appendChild(header);
    wrapper.appendChild(calendar);
    wrapper.appendChild(dateLabels);

    return wrapper;
  }

  /**
   * Render a specific month
   */
  async renderMonth(monthDate) {
    const calendar = document.getElementById(`${this.containerId}-grid`);
    const monthTitle = document.getElementById(`${this.containerId}-month-title`);

    if (!calendar || !monthTitle) {
      return;
    }

    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

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

    // Clear calendar
    calendar.innerHTML = '';

    // Add day headers
    const dayHeaders =
      this.app.currentLanguage === 'cs'
        ? ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const headerRow = document.createElement('div');
    headerRow.className = 'airbnb-calendar-week airbnb-calendar-header-row';

    dayHeaders.forEach((day) => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'airbnb-day-header';
      dayHeader.textContent = day;
      headerRow.appendChild(dayHeader);
    });

    calendar.appendChild(headerRow);

    // Calculate calendar grid
    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1; // Adjust for Monday start
    if (startDay < 0) {
      startDay = 6;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Create calendar weeks
    let currentWeek = document.createElement('div');
    currentWeek.className = 'airbnb-calendar-week';

    // Previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      const dayEl = await this.createDayElement(date, true);
      currentWeek.appendChild(dayEl);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      if (currentWeek.children.length === 7) {
        calendar.appendChild(currentWeek);
        currentWeek = document.createElement('div');
        currentWeek.className = 'airbnb-calendar-week';
      }

      const date = new Date(year, month, day);
      const dayEl = await this.createDayElement(date, false);
      currentWeek.appendChild(dayEl);
    }

    // Next month days
    let nextMonthDay = 1;
    while (currentWeek.children.length < 7) {
      const date = new Date(year, month + 1, nextMonthDay);
      const dayEl = await this.createDayElement(date, true);
      currentWeek.appendChild(dayEl);
      nextMonthDay++;
    }

    calendar.appendChild(currentWeek);
  }

  /**
   * Create a day element with Airbnb-style functionality
   */
  async createDayElement(date, isOtherMonth) {
    const dayEl = document.createElement('div');
    dayEl.className = 'airbnb-calendar-day';

    const dateStr = dataManager.formatDate(date);
    const isPast = date < this.app.today;
    const isChristmas = await dataManager.isChristmasPeriod(date);

    // Store date for event handling
    dayEl.dataset.date = dateStr;

    // Basic styling
    if (isOtherMonth) {
      dayEl.classList.add('other-month');
    }

    if (isPast) {
      dayEl.classList.add('disabled');
    }

    if (isChristmas) {
      dayEl.classList.add('christmas');
    }

    // Check availability
    let isAvailable = true;
    if (this.mode === 'single' && this.roomId) {
      const availability = await dataManager.getRoomAvailability(date, this.roomId);
      isAvailable = availability.status === 'available';

      if (availability.status === 'booked') {
        dayEl.classList.add('booked');
      } else if (availability.status === 'blocked') {
        dayEl.classList.add('blocked');
      }
    } else if (this.mode === 'bulk') {
      // For bulk mode, check if at least one room is available
      const rooms = await dataManager.getRooms();
      isAvailable = false;
      for (const room of rooms) {
        const availability = await dataManager.getRoomAvailability(date, room.id);
        if (availability.status === 'available') {
          isAvailable = true;
          break;
        }
      }
      if (!isAvailable) {
        dayEl.classList.add('no-rooms-available');
      }
    }

    // Selection states
    if (this.checkInDate && dataManager.formatDate(new Date(this.checkInDate)) === dateStr) {
      dayEl.classList.add('check-in');
    }

    if (this.checkOutDate && dataManager.formatDate(new Date(this.checkOutDate)) === dateStr) {
      dayEl.classList.add('check-out');
    }

    // Range styling
    if (this.checkInDate && this.checkOutDate) {
      const checkIn = new Date(this.checkInDate);
      const checkOut = new Date(this.checkOutDate);
      if (date > checkIn && date < checkOut) {
        dayEl.classList.add('in-range');
      }
    } else if (this.checkInDate && this.hoverDate) {
      // Show hover range
      const checkIn = new Date(this.checkInDate);
      const hover = new Date(this.hoverDate);
      const startDate = checkIn < hover ? checkIn : hover;
      const endDate = checkIn < hover ? hover : checkIn;

      if (date > startDate && date < endDate) {
        dayEl.classList.add('hover-range');
      }
    }

    // Day number
    const dayNumber = document.createElement('span');
    dayNumber.className = 'airbnb-day-number';
    dayNumber.textContent = date.getDate();
    dayEl.appendChild(dayNumber);

    // Christmas indicator
    if (isChristmas && !isOtherMonth) {
      const christmasIcon = document.createElement('span');
      christmasIcon.className = 'christmas-icon';
      christmasIcon.textContent = '🎄';
      dayEl.appendChild(christmasIcon);
    }

    // Event handlers for available dates
    if (!isPast && !isOtherMonth && isAvailable) {
      dayEl.classList.add('selectable');
      dayEl.addEventListener('click', this.handleDateClick);
      dayEl.addEventListener('mouseenter', this.handleDateHover);
      dayEl.addEventListener('mouseleave', this.handleDateLeave);
    }

    return dayEl;
  }

  /**
   * Handle date click events
   */
  async handleDateClick(event) {
    const dateStr = event.currentTarget.dataset.date;
    const clickedDate = new Date(dateStr);

    await this.selectDate(clickedDate);
  }

  /**
   * Handle date hover events
   */
  handleDateHover(event) {
    if (!this.checkInDate || this.checkOutDate) {
      return;
    }

    const dateStr = event.currentTarget.dataset.date;
    this.hoverDate = dateStr;

    // Re-render to show hover effects
    this.updateHoverEffects();
  }

  /**
   * Handle date leave events
   */
  handleDateLeave(event) {
    this.hoverDate = null;
    this.updateHoverEffects();
  }

  /**
   * Select a date with Airbnb-style logic
   */
  async selectDate(date) {
    const dateStr = dataManager.formatDate(date);

    if (!this.checkInDate) {
      // First click - set check-in date
      this.checkInDate = dateStr;
      this.isSelecting = true;

      this.events.dispatchEvent(
        new CustomEvent('check-in-selected', {
          detail: { checkIn: this.checkInDate },
        })
      );
    } else if (!this.checkOutDate) {
      // Second click - set check-out date
      const checkInDate = new Date(this.checkInDate);

      if (date < checkInDate) {
        // If second click is before first, swap them
        this.checkOutDate = this.checkInDate;
        this.checkInDate = dateStr;
      } else if (date.getTime() === checkInDate.getTime()) {
        // Clicking on check-in date clears selection
        this.clearSelection();
        return;
      } else {
        // Normal case - set check-out
        this.checkOutDate = dateStr;
      }

      this.isSelecting = false;

      // Validate minimum 1 night stay
      const checkIn = new Date(this.checkInDate);
      const checkOut = new Date(this.checkOutDate);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      if (nights < 1) {
        // Less than 1 night - reset and start over
        this.clearSelection();
        this.checkInDate = dateStr;
        this.isSelecting = true;

        this.events.dispatchEvent(
          new CustomEvent('check-in-selected', {
            detail: { checkIn: this.checkInDate },
          })
        );
      } else {
        // Generate array of all selected dates
        const dates = [];
        const currentDate = new Date(checkIn);
        while (currentDate < checkOut) {
          dates.push(dataManager.formatDate(new Date(currentDate)));
          currentDate.setDate(currentDate.getDate() + 1);
        }

        this.events.dispatchEvent(
          new CustomEvent('dates-selected', {
            detail: {
              checkIn: this.checkInDate,
              checkOut: this.checkOutDate,
              nights,
              dates, // All selected dates for compatibility
            },
          })
        );
      }
    } else {
      // Both dates selected - start new selection
      this.clearSelection();
      this.checkInDate = dateStr;
      this.isSelecting = true;

      this.events.dispatchEvent(
        new CustomEvent('check-in-selected', {
          detail: { checkIn: this.checkInDate },
        })
      );
    }

    await this.renderCalendar();
  }

  /**
   * Update hover effects without full re-render
   */
  updateHoverEffects() {
    const calendar = document.getElementById(`${this.containerId}-grid`);
    if (!calendar) {
      return;
    }

    // Remove existing hover classes
    calendar.querySelectorAll('.hover-range').forEach((el) => {
      el.classList.remove('hover-range');
    });

    // Add hover range if applicable
    if (this.checkInDate && this.hoverDate && !this.checkOutDate) {
      const checkIn = new Date(this.checkInDate);
      const hover = new Date(this.hoverDate);
      const startDate = checkIn < hover ? checkIn : hover;
      const endDate = checkIn < hover ? hover : checkIn;

      calendar.querySelectorAll('.airbnb-calendar-day').forEach((dayEl) => {
        const dayDate = new Date(dayEl.dataset.date);
        if (dayDate > startDate && dayDate < endDate) {
          dayEl.classList.add('hover-range');
        }
      });
    }
  }

  /**
   * Update date labels showing check-in and check-out
   */
  updateDateLabels() {
    const labelsContainer = document.getElementById(`${this.containerId}-labels`);
    if (!labelsContainer) {
      return;
    }

    labelsContainer.innerHTML = '';

    if (this.checkInDate || this.checkOutDate) {
      const labelsWrapper = document.createElement('div');
      labelsWrapper.className = 'date-labels-wrapper';

      if (this.checkInDate) {
        const checkInLabel = document.createElement('div');
        checkInLabel.className = 'date-label check-in-label';

        const label = document.createElement('span');
        label.className = 'label-text';
        label.textContent = this.app.currentLanguage === 'cs' ? 'Příjezd' : 'Check-in';

        const date = document.createElement('span');
        date.className = 'label-date';
        const checkInDate = new Date(this.checkInDate);
        date.textContent = checkInDate.toLocaleDateString(
          this.app.currentLanguage === 'cs' ? 'cs-CZ' : 'en-US'
        );

        checkInLabel.appendChild(label);
        checkInLabel.appendChild(date);
        labelsWrapper.appendChild(checkInLabel);
      }

      if (this.checkOutDate) {
        const checkOutLabel = document.createElement('div');
        checkOutLabel.className = 'date-label check-out-label';

        const label = document.createElement('span');
        label.className = 'label-text';
        label.textContent = this.app.currentLanguage === 'cs' ? 'Odjezd' : 'Check-out';

        const date = document.createElement('span');
        date.className = 'label-date';
        const checkOutDate = new Date(this.checkOutDate);
        date.textContent = checkOutDate.toLocaleDateString(
          this.app.currentLanguage === 'cs' ? 'cs-CZ' : 'en-US'
        );

        checkOutLabel.appendChild(label);
        checkOutLabel.appendChild(date);
        labelsWrapper.appendChild(checkOutLabel);
      }

      labelsContainer.appendChild(labelsWrapper);
    }
  }

  /**
   * Navigate to previous/next month
   */
  async navigateMonth(direction) {
    const newMonth = new Date(this.app.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);

    // Check if within allowed range
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
    await this.renderMonth(newMonth);
    this.updateDateLabels();
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    this.checkInDate = null;
    this.checkOutDate = null;
    this.hoverDate = null;
    this.isSelecting = false;

    this.events.dispatchEvent(new CustomEvent('selection-cleared'));
  }

  /**
   * Get selected dates
   */
  getSelectedDates() {
    return {
      checkIn: this.checkInDate,
      checkOut: this.checkOutDate,
      isSelecting: this.isSelecting,
      nights:
        this.checkInDate && this.checkOutDate
          ? Math.ceil(
              (new Date(this.checkOutDate) - new Date(this.checkInDate)) / (1000 * 60 * 60 * 24)
            )
          : 0,
    };
  }

  /**
   * Set selected dates programmatically
   */
  async setSelectedDates(checkIn, checkOut) {
    this.checkInDate = checkIn ? dataManager.formatDate(new Date(checkIn)) : null;
    this.checkOutDate = checkOut ? dataManager.formatDate(new Date(checkOut)) : null;
    this.isSelecting = Boolean(this.checkInDate && !this.checkOutDate);

    await this.renderCalendar();

    if (this.checkInDate && this.checkOutDate) {
      const nights = Math.ceil(
        (new Date(this.checkOutDate) - new Date(this.checkInDate)) / (1000 * 60 * 60 * 24)
      );

      // Generate array of all selected dates
      const dates = [];
      const currentDate = new Date(this.checkInDate);
      const endDate = new Date(this.checkOutDate);
      while (currentDate < endDate) {
        dates.push(dataManager.formatDate(new Date(currentDate)));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      this.events.dispatchEvent(
        new CustomEvent('dates-selected', {
          detail: {
            checkIn: this.checkInDate,
            checkOut: this.checkOutDate,
            nights,
            dates,
          },
        })
      );
    }
  }

  /**
   * Update calendar for date range
   */
  async updateDateRange(checkIn, checkOut) {
    await this.setSelectedDates(checkIn, checkOut);
  }

  /**
   * Add event listener for calendar events
   */
  addEventListener(eventType, callback) {
    this.events.addEventListener(eventType, callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType, callback) {
    this.events.removeEventListener(eventType, callback);
  }

  /**
   * Destroy the calendar and clean up
   */
  destroy() {
    this.clearSelection();

    const container = document.getElementById(this.containerId);
    if (container) {
      container.innerHTML = '';
      container.classList.remove('airbnb-calendar');
    }

    // Remove all event listeners
    this.events = new EventTarget();
  }
}

// Add CSS styles for Airbnb calendar
function addAirbnbCalendarStyles() {
  if (document.getElementById('airbnb-calendar-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'airbnb-calendar-styles';
  style.textContent = `
    .airbnb-calendar {
      font-family: inherit;
      max-width: 400px;
      margin: 0 auto;
    }

    .airbnb-calendar-wrapper {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .airbnb-calendar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: #f7f7f7;
      border-bottom: 1px solid #e0e0e0;
    }

    .airbnb-nav-btn {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      transition: background-color 0.2s;
      color: #717171;
    }

    .airbnb-nav-btn:hover {
      background: #e0e0e0;
    }

    .airbnb-month-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      color: #222;
    }

    .airbnb-calendar-grid {
      padding: 0;
    }

    .airbnb-calendar-week {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
    }

    .airbnb-calendar-header-row {
      background: #f7f7f7;
      border-bottom: 1px solid #e0e0e0;
    }

    .airbnb-day-header {
      padding: 12px 4px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: #717171;
      text-transform: uppercase;
    }

    .airbnb-calendar-day {
      position: relative;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      border: 1px solid transparent;
      transition: all 0.2s ease;
      cursor: default;
      background: white;
    }

    .airbnb-calendar-day.selectable {
      cursor: pointer;
    }

    .airbnb-calendar-day.selectable:hover {
      background: #f7f7f7;
      border-color: #ddd;
    }

    .airbnb-calendar-day.other-month {
      color: #ccc;
      background: #fafafa;
    }

    .airbnb-calendar-day.disabled {
      color: #ccc;
      background: #f5f5f5;
      cursor: not-allowed;
    }

    .airbnb-calendar-day.booked {
      background: #ff385c;
      color: white;
      cursor: not-allowed;
    }

    .airbnb-calendar-day.blocked {
      background: #6c757d;
      color: white;
      cursor: not-allowed;
    }

    .airbnb-calendar-day.no-rooms-available {
      background: #f8f9fa;
      color: #6c757d;
      cursor: not-allowed;
    }

    .airbnb-calendar-day.check-in {
      background: #ff385c;
      color: white;
      border-radius: 50%;
      font-weight: 600;
    }

    .airbnb-calendar-day.check-out {
      background: #ff385c;
      color: white;
      border-radius: 50%;
      font-weight: 600;
    }

    .airbnb-calendar-day.in-range {
      background: rgba(255, 56, 92, 0.1);
      color: #ff385c;
    }

    .airbnb-calendar-day.hover-range {
      background: rgba(255, 56, 92, 0.05);
      color: #ff385c;
    }

    .airbnb-calendar-day.christmas {
      position: relative;
    }

    .airbnb-calendar-day.christmas::before {
      content: '';
      position: absolute;
      top: 2px;
      right: 2px;
      width: 6px;
      height: 6px;
      background: #ffc107;
      border-radius: 50%;
    }

    .airbnb-day-number {
      font-size: 14px;
      font-weight: 400;
    }

    .christmas-icon {
      position: absolute;
      top: 2px;
      right: 2px;
      font-size: 8px;
    }

    .airbnb-date-labels {
      padding: 16px 20px;
      background: #f7f7f7;
      border-top: 1px solid #e0e0e0;
    }

    .date-labels-wrapper {
      display: flex;
      gap: 20px;
      justify-content: center;
    }

    .date-label {
      text-align: center;
    }

    .label-text {
      display: block;
      font-size: 12px;
      color: #717171;
      margin-bottom: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .label-date {
      display: block;
      font-size: 14px;
      color: #222;
      font-weight: 600;
    }

    .check-in-label .label-text {
      color: #ff385c;
    }

    .check-out-label .label-text {
      color: #ff385c;
    }

    /* Range connectors */
    .airbnb-calendar-day.in-range:not(.check-in):not(.check-out) {
      border-radius: 0;
    }

    .airbnb-calendar-day.check-in.in-range {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }

    .airbnb-calendar-day.check-out.in-range {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  `;

  document.head.appendChild(style);
}

// Initialize styles when module loads
addAirbnbCalendarStyles();
