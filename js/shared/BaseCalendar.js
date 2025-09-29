/**
 * BaseCalendar - Universal Calendar Component
 *
 * Single calendar implementation used across all booking contexts:
 * - Main calendar (grid view)
 * - Single room booking
 * - Bulk booking (entire chalet)
 * - Admin edit reservation
 *
 * Configurable modes with behavior customization via config object.
 */

class BaseCalendar {
  /**
   * Calendar modes
   */
  static MODES = {
    GRID: 'grid', // Main calendar - grid view of all rooms
    SINGLE_ROOM: 'single', // Single room booking - mini calendar
    BULK: 'bulk', // Bulk booking - entire chalet
    EDIT: 'edit', // Admin edit - modify existing booking
  };

  /**
   * Initialize calendar with configuration
   *
   * @param {Object} config - Calendar configuration
   * @param {string} config.mode - Calendar mode (see MODES)
   * @param {Object} config.app - Reference to main app instance
   * @param {string} [config.containerId] - Container element ID
   * @param {string} [config.roomId] - Room ID (for single room mode)
   * @param {Array<string>} [config.roomIds] - Room IDs (for bulk mode)
   * @param {Function} [config.onDateSelect] - Date selection callback
   * @param {Function} [config.onDateDeselect] - Date deselection callback
   * @param {boolean} [config.enableDrag] - Enable drag selection
   * @param {boolean} [config.allowPast] - Allow selecting past dates
   * @param {boolean} [config.enforceContiguous] - Enforce contiguous date ranges (bulk)
   * @param {number} [config.minNights] - Minimum nights for selection
   * @param {number} [config.maxNights] - Maximum nights for selection
   */
  constructor(config) {
    this.config = {
      mode: config.mode || BaseCalendar.MODES.GRID,
      app: config.app,
      containerId: config.containerId || 'calendar',
      roomId: config.roomId || null,
      roomIds: config.roomIds || [],
      onDateSelect: config.onDateSelect || null,
      onDateDeselect: config.onDateDeselect || null,
      enableDrag: config.enableDrag === undefined ? true : config.enableDrag,
      allowPast: config.allowPast || false,
      enforceContiguous: config.enforceContiguous || false,
      minNights: config.minNights || 1,
      maxNights: config.maxNights || null,
    };

    // Internal state
    this.selectedDates = new Set();
    this.dragState = {
      active: false,
      startDate: null,
      endDate: null,
      clickStart: null,
    };
  }

  /**
   * Render calendar for current month
   */
  async render() {
    const container = document.getElementById(this.config.containerId);
    if (!container) {
      console.error(`Calendar container #${this.config.containerId} not found`);
      return;
    }

    const { app } = this.config;
    const currentMonth = app.currentMonth || new Date();

    // Get calendar metadata
    const calendarData = CalendarUtils.getCalendarDays(
      currentMonth.getFullYear(),
      currentMonth.getMonth()
    );

    // Build calendar HTML
    let html = this.buildCalendarHeader(calendarData);
    html += await this.buildCalendarGrid(calendarData);

    container.innerHTML = html;

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Build calendar header (month/year navigation)
   */
  buildCalendarHeader(calendarData) {
    const monthName = CalendarUtils.getMonthName(
      calendarData.year,
      calendarData.month,
      this.config.app.currentLanguage
    );

    return `
      <div class="calendar-header">
        <button class="calendar-nav-btn" data-direction="-1">
          <span>&larr;</span>
        </button>
        <h3 class="calendar-title">${monthName} ${calendarData.year}</h3>
        <button class="calendar-nav-btn" data-direction="1">
          <span>&rarr;</span>
        </button>
      </div>
      <div class="calendar-weekdays">
        ${CalendarUtils.getWeekdayHeaders(this.config.app.currentLanguage)
          .map((day) => `<div class="weekday-header">${day}</div>`)
          .join('')}
      </div>
    `;
  }

  /**
   * Build calendar grid (days)
   */
  async buildCalendarGrid(calendarData) {
    let html = '<div class="calendar-grid">';

    // Render based on mode
    switch (this.config.mode) {
      case BaseCalendar.MODES.GRID:
        html += await this.buildGridMode(calendarData);
        break;
      case BaseCalendar.MODES.SINGLE_ROOM:
        html += await this.buildSingleRoomMode(calendarData);
        break;
      case BaseCalendar.MODES.BULK:
        html += await this.buildBulkMode(calendarData);
        break;
      case BaseCalendar.MODES.EDIT:
        html += await this.buildEditMode(calendarData);
        break;
      default:
        html += await this.buildGridMode(calendarData);
    }

    html += '</div>';
    return html;
  }

  /**
   * Build grid mode calendar (main calendar)
   */
  async buildGridMode(calendarData) {
    const data = await dataManager.getData();
    const rooms = data.settings?.rooms || [];

    let html = '<div class="calendar-room-grid">';

    // Header row with room numbers
    html += '<div class="calendar-row calendar-row-header">';
    html += '<div class="calendar-cell-date"></div>'; // Empty cell for date column

    for (const room of rooms) {
      html += `<div class="calendar-cell-room">${room.id}</div>`;
    }
    html += '</div>';

    // Day rows
    for (const day of calendarData.days) {
      const { dateStr } = day;
      const date = new Date(dateStr);

      html += '<div class="calendar-row">';

      // Date cell
      html += `<div class="calendar-cell-date">${day.dayOfMonth}</div>`;

      // Room cells
      for (const room of rooms) {
        const availability = await dataManager.getRoomAvailability(date, room.id);
        const dayCell = await this.createDayCell(day, room.id, availability);
        html += dayCell;
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Build single room mode calendar
   */
  async buildSingleRoomMode(calendarData) {
    let html = '';

    for (const day of calendarData.days) {
      const date = new Date(day.dateStr);
      const availability = await dataManager.getRoomAvailability(date, this.config.roomId);
      const dayCell = await this.createDayCell(day, this.config.roomId, availability);
      html += dayCell;
    }

    return html;
  }

  /**
   * Build bulk mode calendar (entire chalet)
   */
  async buildBulkMode(calendarData) {
    let html = '';

    for (const day of calendarData.days) {
      const date = new Date(day.dateStr);
      const isFullyAvailable = await this.isDateFullyAvailable(date);

      const dayCell = this.createBulkDayCell(day, isFullyAvailable);
      html += dayCell;
    }

    return html;
  }

  /**
   * Build edit mode calendar (admin)
   */
  buildEditMode(calendarData) {
    // Similar to single room but with different styling/behavior
    return this.buildSingleRoomMode(calendarData);
  }

  /**
   * Create day cell element
   */
  async createDayCell(day, roomId, availability) {
    const { app } = this.config;
    const date = new Date(day.dateStr);
    const { dateStr } = day;

    // Determine cell classes and styling
    const classes = ['calendar-day-cell'];
    const styles = [];
    const content = day.dayOfMonth;
    let clickable = true;

    // Other month styling
    if (day.isOtherMonth) {
      classes.push('other-month');
    }

    // Past date check
    if (!this.config.allowPast && date < app.today) {
      classes.push('past-date');
      clickable = false;
    }

    // Christmas period check
    if (await dataManager.isChristmasPeriod(date)) {
      classes.push('christmas-period');
    }

    // Availability-based styling
    if (availability.status === 'blocked') {
      classes.push('blocked');
      styles.push('background: #6b7280; color: white;');
      clickable = false;
    } else if (availability.status === 'booked') {
      classes.push('booked');
      const color = dataManager.getColorForEmail(availability.email);
      styles.push(`background: ${color}; color: white;`);
      clickable = false;
    } else if (availability.status === 'proposed') {
      classes.push('proposed');
      styles.push('background: #fef3c7; border: 2px dashed #f59e0b;');
      clickable = false;
    } else {
      classes.push('available');
      styles.push('background: #10b981; color: white;');
    }

    // Selection state
    if (this.selectedDates.has(dateStr)) {
      classes.push('selected');
    }

    // Drag preview
    if (this.isDragPreview(dateStr)) {
      classes.push('drag-preview');
    }

    const classStr = classes.join(' ');
    const styleStr = styles.join(' ');
    const cursor = clickable ? 'pointer' : 'not-allowed';

    return `
      <div
        class="${classStr}"
        data-date="${dateStr}"
        data-room="${roomId}"
        data-clickable="${clickable}"
        style="${styleStr} cursor: ${cursor};"
      >
        ${content}
      </div>
    `;
  }

  /**
   * Create bulk day cell
   */
  createBulkDayCell(day, isAvailable) {
    // Similar to createDayCell but checks full chalet availability
    const classes = ['calendar-day-cell'];
    const { dateStr } = day;

    if (day.isOtherMonth) {
      classes.push('other-month');
    }

    if (isAvailable) {
      classes.push('available');
    } else {
      classes.push('unavailable');
    }

    if (this.selectedDates.has(dateStr)) {
      classes.push('selected');
    }

    return `
      <div class="${classes.join(' ')}" data-date="${dateStr}">
        ${day.dayOfMonth}
      </div>
    `;
  }

  /**
   * Check if date is fully available (all rooms)
   */
  async isDateFullyAvailable(date) {
    const data = await dataManager.getData();
    const rooms = data.settings?.rooms || [];

    for (const room of rooms) {
      const availability = await dataManager.getRoomAvailability(date, room.id);
      if (availability.status !== 'available') {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if date is in drag preview range
   */
  isDragPreview(dateStr) {
    if (!this.dragState.active) {
      return false;
    }

    const { startDate, endDate } = this.dragState;
    if (!startDate || !endDate) {
      return false;
    }

    return BookingLogic.isDateOccupied(dateStr, startDate, endDate);
  }

  /**
   * Attach event listeners for interaction
   */
  attachEventListeners() {
    const container = document.getElementById(this.config.containerId);
    if (!container) {
      return;
    }

    // Navigation buttons
    container.querySelectorAll('.calendar-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const direction = parseInt(btn.dataset.direction, 10);
        this.navigateMonth(direction);
      });
    });

    // Day cells
    container.querySelectorAll('.calendar-day-cell').forEach((cell) => {
      const dateStr = cell.dataset.date;
      const clickable = cell.dataset.clickable === 'true';

      if (!clickable) {
        return;
      }

      // Click event
      cell.addEventListener('click', () => this.handleDateClick(dateStr));

      // Drag events (if enabled)
      if (this.config.enableDrag) {
        cell.addEventListener('mousedown', (e) => this.handleDragStart(dateStr, e));
        cell.addEventListener('mouseenter', () => this.handleDragMove(dateStr));
        cell.addEventListener('mouseup', () => this.handleDragEnd());
      }
    });
  }

  /**
   * Handle date click
   */
  async handleDateClick(dateStr) {
    if (this.selectedDates.has(dateStr)) {
      // Deselect
      this.selectedDates.delete(dateStr);
      if (this.config.onDateDeselect) {
        this.config.onDateDeselect(dateStr);
      }
    } else if (this.validateSelection(dateStr)) {
      // Select
      this.selectedDates.add(dateStr);
      if (this.config.onDateSelect) {
        this.config.onDateSelect(dateStr);
      }
    }

    await this.render();
  }

  /**
   * Validate date selection based on config rules
   */
  validateSelection(dateStr) {
    // Check min/max nights
    if (this.selectedDates.size >= this.config.maxNights) {
      return false;
    }

    // Check contiguous requirement (bulk mode)
    if (this.config.enforceContiguous && this.selectedDates.size > 0) {
      const selectedArray = Array.from(this.selectedDates).sort();
      const firstDate = new Date(selectedArray[0]);
      const lastDate = new Date(selectedArray[selectedArray.length - 1]);

      // Must be adjacent to existing selection
      const dayBefore = new Date(firstDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayAfter = new Date(lastDate);
      dayAfter.setDate(dayAfter.getDate() + 1);

      if (
        dateStr !== dataManager.formatDate(dayBefore) &&
        dateStr !== dataManager.formatDate(dayAfter)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Handle drag start
   */
  handleDragStart(dateStr, event) {
    event.preventDefault();
    this.dragState.active = true;
    this.dragState.startDate = dateStr;
    this.dragState.clickStart = dateStr;
  }

  /**
   * Handle drag move
   */
  handleDragMove(dateStr) {
    if (!this.dragState.active) {
      return;
    }

    this.dragState.endDate = dateStr;
    this.render(); // Re-render to show preview
  }

  /**
   * Handle drag end
   */
  handleDragEnd() {
    if (!this.dragState.active) {
      return;
    }

    // Select all dates in range
    const { startDate, endDate } = this.dragState;
    if (startDate && endDate) {
      const range = BookingLogic.getDateRange(startDate, endDate);
      range.forEach((date) => {
        if (this.validateSelection(date)) {
          this.selectedDates.add(date);
        }
      });
    }

    // Reset drag state
    this.dragState = {
      active: false,
      startDate: null,
      endDate: null,
      clickStart: null,
    };

    this.render();
  }

  /**
   * Navigate to next/previous month
   */
  navigateMonth(direction) {
    const { app } = this.config;
    const newMonth = new Date(app.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);

    // Check boundaries
    const newYear = newMonth.getFullYear();
    if (newYear < app.minYear || newYear > app.maxYear) {
      return;
    }

    app.currentMonth = newMonth;
    this.render();
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedDates.clear();
    this.render();
  }

  /**
   * Get selected date range
   */
  getSelectedRange() {
    if (this.selectedDates.size === 0) {
      return null;
    }

    const dates = Array.from(this.selectedDates).sort();
    return {
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      nights: dates.length,
    };
  }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseCalendar;
}
