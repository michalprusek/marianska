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
 *
 * DATE MODEL:
 * The system uses an INCLUSIVE date model:
 * - startDate: First day of stay
 * - endDate: Last day of stay
 * - Example: Booking 2025-01-05 to 2025-01-07 means:
 *   * Guest occupies room on Jan 5, Jan 6, and Jan 7 (3 days, 2 nights)
 *   * Number of nights = endDate - startDate
 * - When selecting dates in calendar: selected dates ARE exactly what gets booked
 * - When creating booking: dates are used exactly as selected by user
 */

/* global BookingDisplayUtils */
/* eslint-disable no-underscore-dangle -- Private methods use underscore prefix by convention */
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
      originalBookingDates: config.originalBookingDates || null,
      currentEditingBookingId: config.currentEditingBookingId || null,
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
   * @private
   */
  async _doRender() {
    const container = document.getElementById(this.config.containerId);
    if (!container) {
      console.error(`Calendar container #${this.config.containerId} not found`);
      // CODE REVIEW IMPROVEMENT: Add user notification
      if (this.config.app && this.config.app.utils) {
        this.config.app.utils.showNotification(
          '⚠️ Chyba při inicializaci kalendáře. Obnovte stránku.',
          'error',
          5000
        );
      }
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
      <div class="calendar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 2rem;">
        <button class="nav-btn calendar-nav-btn" data-direction="-1" style="padding: 0.75rem; background: #1f2937; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; min-width: 44px; min-height: 44px;">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <h3 class="calendar-title" style="margin: 0; font-weight: 600; flex: 1; text-align: center;">${monthName} ${calendarData.year}</h3>
        <button class="nav-btn calendar-nav-btn" data-direction="1" style="padding: 0.75rem; background: #1f2937; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; min-width: 44px; min-height: 44px;">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 15L12.5 10L7.5 5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="calendar-weekdays" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem; margin-bottom: 0.5rem;">
        ${CalendarUtils.getWeekdayHeaders(language)
          .map(
            (day) =>
              `<div class="weekday-header" style="text-align: center; font-weight: 600; color: #666; font-size: 0.875rem; padding: 0.75rem; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${day}</div>`
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

    // Get current language for room ID formatting
    const currentLang = (typeof langManager !== 'undefined' && langManager.currentLang) || 'cs';

    for (const room of rooms) {
      const formattedRoomId = BookingDisplayUtils.formatRoomId(room.id, currentLang);
      html += `<div class="calendar-cell-room">${formattedRoomId}</div>`;
    }
    html += '</div>';

    // Collect all room cell promises for all days
    const allRoomCellPromises = calendarData.days.map((day) => {
      const { dateStr } = day;
      const date = new Date(dateStr);

      return {
        day,
        cellPromises: rooms.map(async (room) => {
          // Pass '' to show ALL proposed bookings, pass currentEditingBookingId to exclude from conflicts
          const availability = await dataManager.getRoomAvailability(
            date,
            room.id,
            '',
            this.config.currentEditingBookingId
          );
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
      // Pass '' to show ALL proposed bookings, pass currentEditingBookingId to exclude from conflicts
      const availability = await dataManager.getRoomAvailability(
        date,
        this.config.roomId,
        '',
        this.config.currentEditingBookingId
      );
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
      const bulkAvailability = await this.getBulkDateAvailability(date);

      return this.createDayCell(day, 'bulk', bulkAvailability);
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
    const todayStr = DateUtils.formatDate(app.today || new Date());
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
    // NIGHT-BASED MODEL:
    // - available: No nights occupied (green)
    // - edge: Exactly ONE night occupied (orange with indicator)
    // - occupied: BOTH nights occupied (red, not clickable)
    // - blocked: Administratively blocked (gray)
    // - proposed: Pending booking (yellow)
    if (!day.isOtherMonth && (this.config.allowPast || dateStr >= todayStr)) {
      // Ensure availability has a status
      const status = availability?.status || 'available';

      if (status === 'blocked') {
        // Blocked dates - gray
        classes.push('blocked');
        styles.push('background: #9ca3af; color: white;');
        clickable = false;
      } else if (status === 'occupied') {
        // Occupied = BOTH nights around day are occupied - red, NOT clickable
        classes.push('occupied');
        styles.push('background: #ef4444; color: white;');
        clickable = false;
      } else if (status === 'edge') {
        // Edge = ONE or BOTH nights occupied (with different types)
        // Supports: proposed-only, confirmed-only, AND MIXED (proposed + confirmed)
        classes.push('edge-day');

        // Get detailed night information
        const nightBefore = availability?.nightBefore;
        const nightAfter = availability?.nightAfter;
        const nightBeforeType = availability?.nightBeforeType || 'available';
        const nightAfterType = availability?.nightAfterType || 'available';

        // Color map
        const colorMap = {
          proposed: '#f59e0b', // Orange
          confirmed: '#ef4444', // Red
          available: '#10b981', // Green
        };

        const leftColor = colorMap[nightBeforeType];
        const rightColor = colorMap[nightAfterType];

        if (nightBefore && !nightAfter) {
          // Only night before occupied
          styles.push(
            `background: linear-gradient(90deg, ${leftColor} 0%, ${leftColor} 50%, ${colorMap.available} 50%, ${colorMap.available} 100%); color: white;`
          );
        } else if (!nightBefore && nightAfter) {
          // Only night after occupied
          styles.push(
            `background: linear-gradient(90deg, ${colorMap.available} 0%, ${colorMap.available} 50%, ${rightColor} 50%, ${rightColor} 100%); color: white;`
          );
        } else if (nightBefore && nightAfter) {
          // BOTH nights occupied but DIFFERENT TYPES (mixed: proposed + confirmed)
          // Show both colors: left half = nightBeforeType color, right half = nightAfterType color
          styles.push(
            `background: linear-gradient(90deg, ${leftColor} 0%, ${leftColor} 50%, ${rightColor} 50%, ${rightColor} 100%); color: white;`
          );
        } else {
          // Fallback (shouldn't happen but just in case)
          styles.push(
            `background: linear-gradient(90deg, ${colorMap.available} 0%, ${colorMap.available} 50%, ${colorMap.confirmed} 50%, ${colorMap.confirmed} 100%); color: white;`
          );
        }

        // Edge day IS clickable (available for new booking)
        clickable = true;
      } else if (status === 'proposed') {
        // Proposed booking - yellow
        classes.push('proposed');
        styles.push('background: #f59e0b; color: white;');
        clickable = false;
      } else {
        // Available - green (default fallback)
        classes.push('available');
        styles.push('background: #10b981; color: white;');
      }
    }

    // Original booking dates indicator (for EDIT mode)
    if (
      this.config.originalBookingDates &&
      dateStr >= this.config.originalBookingDates.startDate &&
      dateStr <= this.config.originalBookingDates.endDate
    ) {
      classes.push('original-booking-date');
      // Add distinctive border/outline to show original booking dates
      // Use dashed blue border so it's visible on any background
      styles.push(
        'box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5) inset; outline: 2px dashed #3b82f6;'
      );
    }

    // Selection state - override background
    if (this.selectedDates.has(dateStr)) {
      classes.push('selected');

      // Check if this is the anchor point (first clicked date) AND interval is not yet complete
      // After second click, all selected dates should have the same blue color
      if (this.intervalState.firstClick === dateStr && !this.intervalState.secondClick) {
        // Dark blue for anchor point (only while selecting)
        styles.push(
          'background: #1e40af !important; color: white !important; box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.5);'
        );
      } else {
        // Regular blue for other selected dates (and anchor point after completion)
        styles.push(
          'background: #2563eb !important; color: white !important; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.3);'
        );
      }
    }

    const classStr = classes.join(' ');
    const styleStr = styles.join(' ');
    const cursor = clickable ? 'pointer' : 'not-allowed';
    const pointerEvents = clickable ? 'auto' : 'none'; // CRITICAL: Disable pointer events for non-clickable cells
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
        style="${baseStyle} ${styleStr} cursor: ${cursor}; pointer-events: ${pointerEvents};"
      >
        ${content}
      </div>
    `;
  }

  /**
   * Get bulk date availability (checks all rooms for detailed status)
   * Returns the "worst" status across all rooms:
   * Priority: blocked > occupied > proposed > edge > available
   */
  async getBulkDateAvailability(date) {
    const data = await dataManager.getData();
    const rooms = data.settings?.rooms || [];

    const availabilityPromises = rooms.map((room) =>
      // Pass '' to show ALL proposed bookings, pass currentEditingBookingId to exclude from conflicts
      dataManager.getRoomAvailability(date, room.id, '', this.config.currentEditingBookingId)
    );
    const availabilities = await Promise.all(availabilityPromises);

    // Check for blocked rooms (highest priority)
    if (availabilities.some((a) => a.status === 'blocked')) {
      return { status: 'blocked', email: null };
    }

    // Check for occupied rooms (both nights occupied)
    if (availabilities.some((a) => a.status === 'occupied')) {
      return {
        status: 'occupied',
        email: availabilities.find((a) => a.status === 'occupied')?.email || null,
      };
    }

    // Check for proposed bookings
    if (availabilities.some((a) => a.status === 'proposed')) {
      return { status: 'proposed', email: null };
    }

    // Check for edge days (at least one room has edge status)
    const edgeAvailability = availabilities.find((a) => a.status === 'edge');
    if (edgeAvailability) {
      return {
        status: 'edge',
        email: edgeAvailability.email || null,
        nightBefore: edgeAvailability.nightBefore,
        nightAfter: edgeAvailability.nightAfter,
      };
    }

    // All rooms available
    return { status: 'available', email: null };
  }

  /**
   * Check if date is fully available (all rooms) - legacy method
   */
  async isDateFullyAvailable(date) {
    const availability = await this.getBulkDateAvailability(date);
    // Edge days are also available for new bookings
    return availability.status === 'available' || availability.status === 'edge';
  }

  /**
   * Attach event listeners for interaction
   * CRITICAL FIX: Cleanup old listeners first to prevent memory leaks
   */
  attachEventListeners() {
    const container = document.getElementById(this.config.containerId);
    if (!container) {
      // CODE REVIEW IMPROVEMENT: Add logging for debugging
      console.error(
        `[BaseCalendar] Cannot attach event listeners - container #${this.config.containerId} not found`
      );
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
        // CRITICAL FIX: For non-clickable cells, add handler that blocks ALL interactions
        const blockHandler = (event) => {
          event.stopPropagation();
          event.preventDefault();
          // Silently block - no feedback needed as pointer-events: none should prevent this
          return false;
        };

        this.boundHandlers.set(cell, {
          click: blockHandler,
          mousedown: blockHandler,
          mouseup: blockHandler,
          mouseenter: blockHandler,
          mouseleave: blockHandler,
        });

        cell.addEventListener('click', blockHandler);
        cell.addEventListener('mousedown', blockHandler);
        cell.addEventListener('mouseup', blockHandler);
        cell.addEventListener('mouseenter', blockHandler);
        cell.addEventListener('mouseleave', blockHandler);
        return;
      }

      // Create bound handlers FOR CLICKABLE CELLS ONLY
      const clickHandler = (event) => {
        event.stopPropagation(); // CRITICAL: Prevent event bubbling to parent elements
        this.handleDateClick(dateStr);
      };
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
      if (handlers.mousedown) {
        element.removeEventListener('mousedown', handlers.mousedown);
      }
      if (handlers.mouseup) {
        element.removeEventListener('mouseup', handlers.mouseup);
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
    // CRITICAL GUARD: Re-validate that cell is still clickable (race condition prevention)
    const cell = this.cellElements.get(dateStr);
    if (!cell || cell.dataset.clickable !== 'true') {
      // Cell is not clickable (occupied/blocked/past) - show feedback and ignore click
      if (this.config.app && this.config.app.utils) {
        const isPast = cell?.classList.contains('past-date');
        const isOccupied = cell?.classList.contains('occupied');
        const isBlocked = cell?.classList.contains('blocked');
        const isProposed = cell?.classList.contains('proposed');

        let message = 'Tento termín nelze vybrat.';

        if (isPast) {
          message = 'Nelze vybrat termín v minulosti.';
        } else if (isOccupied) {
          message = 'Tento termín je již obsazený.';
        } else if (isBlocked) {
          message = 'Tento termín je blokován administrátorem.';
        } else if (isProposed) {
          message = 'Na tento termín je dočasná rezervace jiného uživatele.';
        }

        this.config.app.utils.showNotification(message, 'warning', 3000);
      }
      return;
    }

    // CRITICAL GUARD: Real-time availability check (race condition prevention)
    // Another user may have booked this date since render
    if (this.config.mode !== BaseCalendar.MODES.BULK && this.config.roomId) {
      try {
        const availability = await dataManager.getRoomAvailability(
          new Date(dateStr),
          this.config.roomId,
          '',
          this.config.currentEditingBookingId
        );

        if (availability.status === 'occupied' || availability.status === 'blocked') {
          // Date is no longer available - show error and abort
          if (this.config.app && this.config.app.utils) {
            this.config.app.utils.showNotification(
              'Tento termín již není dostupný. Kalendář se automaticky aktualizuje.',
              'error',
              4000
            );
          }
          // Reset selection and re-render to show current state
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
      } catch (error) {
        console.error('[BaseCalendar] Availability check failed:', error);
        if (this.config.app && this.config.app.utils) {
          this.config.app.utils.showNotification(
            'Chyba při kontrole dostupnosti. Zkuste to prosím znovu.',
            'error',
            3000
          );
        }
        return;
      }
    }

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
    } else if (!this.intervalState.secondClick) {
      // Druhý klik - nastav druhou hranici a vyplň interval
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
   * CRITICAL: Uses timezone-safe parsing to avoid DST issues
   */
  getDateRangeBetween(startDateStr, endDateStr) {
    const dates = [];
    // Use DateUtils.parseDate() for timezone-safe parsing (local noon)
    const start = DateUtils.parseDate(startDateStr);
    const end = DateUtils.parseDate(endDateStr);

    // Ensure start <= end
    const [firstDate, lastDate] = start <= end ? [start, end] : [end, start];

    const current = new Date(firstDate);
    // eslint-disable-next-line no-unmodified-loop-condition -- current is modified via setDate
    while (current <= lastDate) {
      dates.push(DateUtils.formatDate(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Update preview styling without re-render
   * PERFORMANCE FIX: Use cached elements, only update changed cells
   * BUG FIX: Validate all cells in range are clickable before showing preview
   */
  updatePreview(hoverDateStr) {
    if (!this.intervalState.firstClick) {
      return;
    }

    // CRITICAL GUARD: Don't preview over non-clickable cells
    const hoverCell = this.cellElements.get(hoverDateStr);
    if (!hoverCell || hoverCell.dataset.clickable !== 'true') {
      // Hovering over non-clickable cell - clear any existing preview
      this.clearPreview();
      return;
    }

    // Calculate preview range
    const previewRange = this.getDateRangeBetween(this.intervalState.firstClick, hoverDateStr);

    // CRITICAL FIX: Check if ALL cells in preview range are clickable
    // If any cell is occupied/blocked/past, don't show preview at all
    const allCellsClickable = previewRange.every((dateStr) => {
      const cell = this.cellElements.get(dateStr);
      return cell && cell.dataset.clickable === 'true';
    });

    if (!allCellsClickable) {
      // Range contains non-clickable cells - don't show preview
      this.clearPreview();
      return;
    }

    // Clear previous preview
    this.clearPreview();

    // Only update cells in range (not ALL cells)
    previewRange.forEach((dateStr) => {
      const cell = this.cellElements.get(dateStr);
      if (cell) {
        // Skip if already selected (anchor point stays dark blue)
        if (this.selectedDates.has(dateStr)) {
          return;
        }

        cell.classList.add('preview-interval');
        cell.style.background = 'rgba(37, 99, 235, 0.3)';
        // Use box-shadow instead of border to prevent layout shift
        cell.style.boxShadow = 'inset 0 0 0 2px #2563eb';
      }
    });

    this.currentPreviewRange = previewRange; // Store for cleanup
  }

  /**
   * Clear preview styling
   * PERFORMANCE FIX: Only clear cells that were previewed
   * BUG FIX: Skip cells that are actually selected (especially the anchor point)
   */
  clearPreview() {
    if (!this.currentPreviewRange) {
      return;
    }

    // Only clear cells that were previewed
    this.currentPreviewRange.forEach((dateStr) => {
      // CRITICAL FIX: Skip cells that are actually selected (not just preview)
      if (this.selectedDates.has(dateStr)) {
        return; // Keep the selection styling
      }

      const cell = this.cellElements.get(dateStr);
      if (cell) {
        cell.classList.remove('preview-interval');
        const originalBg = cell.getAttribute('data-original-bg');
        if (originalBg) {
          cell.style.cssText = cell.style.cssText.replace(/background:[^;]*;?/u, originalBg);
        }
        cell.style.boxShadow = '';
      }
    });

    this.currentPreviewRange = null;
  }

  /**
   * Navigate to next/previous month
   */
  navigateMonth(direction) {
    const { app } = this.config;

    // Initialize currentMonth if it doesn't exist
    if (!app.currentMonth) {
      app.currentMonth = new Date();
    }

    const newMonth = new Date(app.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);

    // Check boundaries based on calendar mode
    const newYear = newMonth.getFullYear();
    const { minYear, maxYear } = this.getYearBoundaries();

    if (newYear < minYear || newYear > maxYear) {
      // CODE REVIEW IMPROVEMENT: Add user notification for boundary exceeded
      if (this.config.app && this.config.app.utils) {
        const message =
          newYear < minYear
            ? `⚠️ Nelze zobrazit měsíce před rokem ${minYear}.`
            : `⚠️ Nelze zobrazit měsíce po roce ${maxYear}.`;
        this.config.app.utils.showNotification(message, 'warning', 3000);
      }
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
          // Pass '' to show ALL proposed bookings, pass currentEditingBookingId to exclude from conflicts
          const availability = await dataManager.getRoomAvailability(
            date,
            roomId,
            '',
            this.config.currentEditingBookingId
          );
          // Edge days are available for new bookings
          isUnavailable = availability.status !== 'available' && availability.status !== 'edge';
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
/* eslint-enable no-underscore-dangle */
