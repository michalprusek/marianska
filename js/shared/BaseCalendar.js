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
      allowPast: config.allowPast || false,
      enforceContiguous: config.enforceContiguous || false,
      minNights: config.minNights || 1,
      maxNights: config.maxNights || null,
    };

    // Internal state
    this.selectedDates = new Set();
    this.intervalState = {
      firstClick: null, // První hranice intervalu
      secondClick: null, // Druhá hranice intervalu
      hoverDate: null, // Datum pod kurzorem (pro preview)
    };

    // Event listener tracking for cleanup (fixes memory leak)
    this.boundHandlers = new Map();
    this.cellElements = new Map(); // Cache DOM references for performance
    this.currentPreviewRange = null; // Track current preview range
    this.renderPromise = null;
    this.cancelRender = false;
  }

  /**
   * Render calendar for current month
   */
  async render() {
    // Cancel any pending render
    if (this.renderPromise) {
      this.cancelRender = true;
    }

    this.renderPromise = this._doRender();
    await this.renderPromise;
    this.renderPromise = null;
  }

  /**
   * Internal render implementation with cancellation support
   */
  async _doRender() {
    const container = document.getElementById(this.config.containerId);
    if (!container) {
      console.error(`Calendar container #${this.config.containerId} not found`);
      return;
    }

    // Check for cancellation
    if (this.cancelRender) {
      this.cancelRender = false;
      return;
    }

    const { app } = this.config;
    const currentMonth = app.currentMonth || new Date();

    // Get calendar metadata
    const calendarData = CalendarUtils.getCalendarDays(currentMonth);

    // Build calendar HTML
    let html = this.buildCalendarHeader(calendarData);
    html += await this.buildCalendarGrid(calendarData);

    // Check again before DOM mutation
    if (this.cancelRender) {
      this.cancelRender = false;
      return;
    }

    container.innerHTML = html;

    // Attach event listeners (cleanup happens first)
    this.attachEventListeners();
  }

  /**
   * Build calendar header (month/year navigation)
   */
  buildCalendarHeader(calendarData) {
    const language = this.config.app?.currentLanguage || 'cs';
    const monthName = CalendarUtils.getMonthName(calendarData.month, language);

    return `
      <div class="calendar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <button class="nav-btn calendar-nav-btn" data-direction="-1" style="padding: 0.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 4px; cursor: pointer;">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <h3 class="calendar-title" style="margin: 0; font-weight: 600;">${monthName} ${calendarData.year}</h3>
        <button class="nav-btn calendar-nav-btn" data-direction="1" style="padding: 0.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 4px; cursor: pointer;">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="calendar-weekdays" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem; margin-bottom: 0.5rem;">
        ${CalendarUtils.getWeekdayHeaders(language)
          .map(
            (day) =>
              `<div class="weekday-header" style="text-align: center; font-weight: 600; color: #666; font-size: 0.875rem; padding: 0.5rem 0.75rem;">${day}</div>`
          )
          .join('')}
      </div>
    `;
  }

  /**
   * Build calendar grid (days)
   */
  async buildCalendarGrid(calendarData) {
    const gridStyle =
      this.config.mode === BaseCalendar.MODES.GRID
        ? ''
        : 'style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem;"';
    let html = `<div class="calendar-grid" ${gridStyle}>`;

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

    // Collect all room cell promises for all days
    const allRoomCellPromises = calendarData.days.map((day) => {
      const { dateStr } = day;
      const date = new Date(dateStr);

      return {
        day,
        cellPromises: rooms.map(async (room) => {
          // Pass '' to show ALL proposed bookings in calendar
          const availability = await dataManager.getRoomAvailability(date, room.id, '');
          return this.createDayCell(day, room.id, availability);
        }),
      };
    });

    // Await all promises at once
    const dayRowsData = await Promise.all(
      allRoomCellPromises.map(async ({ day, cellPromises }) => ({
        day,
        cells: await Promise.all(cellPromises),
      }))
    );

    // Build HTML for all day rows
    for (const { day, cells } of dayRowsData) {
      html += '<div class="calendar-row">';
      html += `<div class="calendar-cell-date">${day.dayOfMonth}</div>`;
      html += cells.join('');
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Build single room mode calendar
   */
  async buildSingleRoomMode(calendarData) {
    const dayCellPromises = calendarData.days.map(async (day) => {
      const date = new Date(day.dateStr);
      // Pass '' to show ALL proposed bookings in calendar
      const availability = await dataManager.getRoomAvailability(date, this.config.roomId, '');
      return this.createDayCell(day, this.config.roomId, availability);
    });

    const dayCells = await Promise.all(dayCellPromises);
    return dayCells.join('');
  }

  /**
   * Build bulk mode calendar (entire chalet)
   */
  async buildBulkMode(calendarData) {
    const dayCellPromises = calendarData.days.map(async (day) => {
      const date = new Date(day.dateStr);
      const isFullyAvailable = await this.isDateFullyAvailable(date);

      // Create availability object compatible with createDayCell
      const availability = {
        status: isFullyAvailable ? 'available' : 'booked',
        email: null,
      };

      return this.createDayCell(day, 'bulk', availability);
    });

    const dayCells = await Promise.all(dayCellPromises);
    return dayCells.join('');
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
      styles.push('opacity: 0.4; background: #e5e7eb; color: #6b7280;');
      clickable = false;
    }

    // Past date check (TIMEZONE FIX: use string comparison)
    const todayStr = DateUtils.formatDate(app.today);
    if (!this.config.allowPast && dateStr < todayStr) {
      classes.push('past-date');
      styles.push('opacity: 0.5; background: #f3f4f6; color: #9ca3af;');
      clickable = false;
    }

    // Christmas period check
    if (await dataManager.isChristmasPeriod(date)) {
      classes.push('christmas-period');
      styles.push('box-shadow: 0 0 0 2px gold inset;');
    }

    // Availability-based styling (only if not other month or past)
    if (!day.isOtherMonth && (this.config.allowPast || date >= app.today)) {
      if (
        availability.status === 'blocked' ||
        availability.status === 'booked' ||
        availability.status === 'proposed'
      ) {
        // Unified red color for all unavailable dates (blocked, booked, proposed)
        classes.push('unavailable');
        styles.push('background: #ef4444; color: white;');
        clickable = false;
      } else {
        classes.push('available');
        styles.push('background: #10b981; color: white;');
      }
    }

    // Selection state - override background
    if (this.selectedDates.has(dateStr)) {
      classes.push('selected');
      styles.push(
        'background: #2563eb !important; color: white !important; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.3);'
      );
    }

    const classStr = classes.join(' ');
    const styleStr = styles.join(' ');
    const cursor = clickable ? 'pointer' : 'not-allowed';
    const baseStyle =
      'padding: 0.75rem; text-align: center; border-radius: 4px; font-weight: 500; user-select: none;';

    // Store original background for preview restoration
    const originalBg = styles.find((s) => s.includes('background:')) || '';

    return `
      <div
        class="${classStr}"
        data-date="${dateStr}"
        data-room="${roomId}"
        data-clickable="${clickable}"
        data-original-bg="${originalBg}"
        style="${baseStyle} ${styleStr} cursor: ${cursor};"
      >
        ${content}
      </div>
    `;
  }

  /**
   * Check if date is fully available (all rooms)
   */
  async isDateFullyAvailable(date) {
    const data = await dataManager.getData();
    const rooms = data.settings?.rooms || [];

    const availabilityPromises = rooms.map((room) =>
      // Pass '' to show ALL proposed bookings (including others)
      dataManager.getRoomAvailability(date, room.id, '')
    );
    const availabilities = await Promise.all(availabilityPromises);

    return availabilities.every((availability) => availability.status === 'available');
  }

  /**
   * Attach event listeners for interaction
   * CRITICAL FIX: Cleanup old listeners first to prevent memory leaks
   */
  attachEventListeners() {
    const container = document.getElementById(this.config.containerId);
    if (!container) {
      return;
    }

    // CRITICAL: Remove old listeners first
    this.removeEventListeners();

    // Clear cell cache
    this.cellElements.clear();

    // Navigation buttons
    container.querySelectorAll('.calendar-nav-btn').forEach((btn) => {
      const clickHandler = () => {
        const direction = parseInt(btn.dataset.direction, 10);
        this.navigateMonth(direction);
      };

      this.boundHandlers.set(btn, { click: clickHandler });
      btn.addEventListener('click', clickHandler);
    });

    // Day cells - click and hover handlers
    container.querySelectorAll('.calendar-day-cell').forEach((cell) => {
      const dateStr = cell.dataset.date;
      const clickable = cell.dataset.clickable === 'true';

      // Cache cell reference for performance
      this.cellElements.set(dateStr, cell);

      if (!clickable) {
        return;
      }

      // Create bound handlers
      const clickHandler = () => this.handleDateClick(dateStr);
      const enterHandler = () => {
        if (this.intervalState.firstClick && !this.intervalState.secondClick) {
          this.updatePreview(dateStr);
        }
      };
      const leaveHandler = () => {
        if (this.intervalState.firstClick && !this.intervalState.secondClick) {
          this.clearPreview();
        }
      };

      // Store handlers for cleanup
      this.boundHandlers.set(cell, {
        click: clickHandler,
        mouseenter: enterHandler,
        mouseleave: leaveHandler,
      });

      // Attach listeners
      cell.addEventListener('click', clickHandler);
      cell.addEventListener('mouseenter', enterHandler);
      cell.addEventListener('mouseleave', leaveHandler);
    });
  }

  /**
   * Remove all event listeners (cleanup)
   * CRITICAL FIX: Prevents memory leaks
   */
  removeEventListeners() {
    // Remove all stored handlers
    this.boundHandlers.forEach((handlers, element) => {
      if (handlers.click) {
        element.removeEventListener('click', handlers.click);
      }
      if (handlers.mouseenter) {
        element.removeEventListener('mouseenter', handlers.mouseenter);
      }
      if (handlers.mouseleave) {
        element.removeEventListener('mouseleave', handlers.mouseleave);
      }
    });

    this.boundHandlers.clear();
  }

  /**
   * Destroy calendar instance (cleanup)
   */
  destroy() {
    this.removeEventListeners();
    this.boundHandlers = null;
    this.cellElements = null;
    this.selectedDates = null;
  }

  /**
   * Handle date click - Two-click interval selection
   */
  async handleDateClick(dateStr) {
    // Pokud je interval kompletní, smaž ho a začni nový
    if (this.intervalState.firstClick && this.intervalState.secondClick) {
      this.selectedDates.clear();
      this.intervalState.firstClick = null;
      this.intervalState.secondClick = null;
      this.intervalState.hoverDate = null;

      // Sync s app.selectedDates
      if (this.config.app) {
        this.config.app.selectedDates = this.selectedDates;
      }
    }

    // První klik - nastav první hranici
    if (!this.intervalState.firstClick) {
      this.intervalState.firstClick = dateStr;
      this.selectedDates.clear();
      this.selectedDates.add(dateStr);

      // Sync s app.selectedDates
      if (this.config.app) {
        this.config.app.selectedDates = this.selectedDates;
      }

      if (this.config.onDateSelect) {
        await this.config.onDateSelect(dateStr);
      }
    }
    // Druhý klik - nastav druhou hranici a vyplň interval
    else if (!this.intervalState.secondClick) {
      // Vytvoř interval mezi oběma hranicemi pro validaci
      const range = this.getDateRangeBetween(this.intervalState.firstClick, dateStr);

      // Validace: zkontroluj, zda interval neobsahuje nedostupné termíny
      const hasUnavailableDates = await this.validateIntervalAvailability(range);

      if (hasUnavailableDates) {
        // Zobraz notifikaci uživateli
        if (this.config.app && this.config.app.utils) {
          this.config.app.utils.showNotification(
            'Vybraný interval obsahuje nedostupné termíny (již rezervované nebo blokované). Prosím vyberte jiný termín.',
            'error',
            6000
          );
        }

        // Reset selection - začni znovu
        this.selectedDates.clear();
        this.intervalState.firstClick = null;
        this.intervalState.secondClick = null;
        this.intervalState.hoverDate = null;

        if (this.config.app) {
          this.config.app.selectedDates = this.selectedDates;
        }

        await this.render();
        return;
      }

      // Interval je validní - pokračuj
      this.intervalState.secondClick = dateStr;
      this.intervalState.hoverDate = null; // Clear hover

      // Přidej všechny datumy v rozsahu
      range.forEach((date) => {
        this.selectedDates.add(date);
      });

      // DŮLEŽITÉ: Sync s app.selectedDates PŘED zavoláním callbacku
      if (this.config.app) {
        this.config.app.selectedDates = this.selectedDates;
      }

      if (this.config.onDateSelect) {
        await this.config.onDateSelect(dateStr);
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
   * Get array of date strings between two dates (inclusive)
   */
  getDateRangeBetween(startDateStr, endDateStr) {
    const dates = [];
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    // Ensure start <= end
    const [firstDate, lastDate] = start <= end ? [start, end] : [end, start];

    const current = new Date(firstDate);
    while (current <= lastDate) {
      dates.push(DateUtils.formatDate(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Update preview styling without re-render
   * PERFORMANCE FIX: Use cached elements, only update changed cells
   */
  updatePreview(hoverDateStr) {
    if (!this.intervalState.firstClick) {
      return;
    }

    // Clear previous preview
    this.clearPreview();

    // Calculate preview range
    const previewRange = this.getDateRangeBetween(this.intervalState.firstClick, hoverDateStr);

    // Only update cells in range (not ALL cells)
    previewRange.forEach((dateStr) => {
      const cell = this.cellElements.get(dateStr);
      if (cell && !this.selectedDates.has(dateStr)) {
        cell.classList.add('preview-interval');
        cell.style.background = 'rgba(37, 99, 235, 0.3)';
        cell.style.border = '2px dashed #2563eb';
      }
    });

    this.currentPreviewRange = previewRange; // Store for cleanup
  }

  /**
   * Clear preview styling
   * PERFORMANCE FIX: Only clear cells that were previewed
   */
  clearPreview() {
    if (!this.currentPreviewRange) {
      return;
    }

    // Only clear cells that were previewed
    this.currentPreviewRange.forEach((dateStr) => {
      const cell = this.cellElements.get(dateStr);
      if (cell) {
        cell.classList.remove('preview-interval');
        const originalBg = cell.getAttribute('data-original-bg');
        if (originalBg) {
          cell.style.cssText = cell.style.cssText.replace(/background:[^;]*;?/, originalBg);
        }
        cell.style.border = '';
      }
    });

    this.currentPreviewRange = null;
  }

  /**
   * Navigate to next/previous month
   */
  navigateMonth(direction) {
    const { app } = this.config;
    const newMonth = new Date(app.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);

    // Check boundaries based on calendar mode
    const newYear = newMonth.getFullYear();
    const { minYear, maxYear } = this.getYearBoundaries();

    if (newYear < minYear || newYear > maxYear) {
      return;
    }

    app.currentMonth = newMonth;
    this.render();
  }

  /**
   * Get year boundaries based on calendar mode
   * @returns {Object} { minYear, maxYear }
   */
  getYearBoundaries() {
    const { app, mode } = this.config;

    // GRID mode (main calendar): previous + current + next year
    if (mode === BaseCalendar.MODES.GRID) {
      return {
        minYear: app.gridMinYear,
        maxYear: app.gridMaxYear,
      };
    }

    // Other modes (SINGLE_ROOM, BULK, EDIT): current + next year only
    return {
      minYear: app.otherMinYear,
      maxYear: app.otherMaxYear,
    };
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedDates.clear();
    this.render();
  }

  /**
   * Validate interval availability - check if all dates in range are available
   * @param {Array<string>} dateRange - Array of date strings to check
   * @returns {Promise<boolean>} - True if any date is unavailable (booked/blocked/proposed)
   */
  async validateIntervalAvailability(dateRange) {
    // For each date in the range, check availability
    for (const dateStr of dateRange) {
      const date = new Date(dateStr);

      // Get availability based on mode
      let isUnavailable = false;

      if (this.config.mode === BaseCalendar.MODES.BULK) {
        // For bulk mode, check if all rooms are available
        const isFullyAvailable = await this.isDateFullyAvailable(date);
        isUnavailable = !isFullyAvailable;
      } else {
        // For single room or edit mode, check specific room availability
        const { roomId } = this.config;
        if (roomId) {
          // Pass '' to show ALL proposed bookings (including others)
          const availability = await dataManager.getRoomAvailability(date, roomId, '');
          isUnavailable = availability.status !== 'available';
        }
      }

      if (isUnavailable) {
        return true; // Found an unavailable date
      }
    }

    return false; // All dates are available
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
