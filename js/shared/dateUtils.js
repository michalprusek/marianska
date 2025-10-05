/**
 * DateUtils - Centralized date formatting and manipulation
 * SSOT for all date-related operations
 */
class DateUtils {
  /**
   * Format date to YYYY-MM-DD string
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date string
   */
  static formatDate(date) {
    // If string in YYYY-MM-DD format, parse as local date not UTC
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/u)) {
      return date; // Already in correct format
    }
    const d = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
    // Use local date components instead of UTC to avoid timezone issues
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format date for display with localization
   * @param {Date} date - Date to format
   * @param {string} language - Language code ('cs' or 'en')
   * @returns {string} Formatted display string (e.g., "Po 15. led")
   */
  static formatDateDisplay(date, language = 'cs') {
    const day = date.getDate();
    const month = date.getMonth() + 1;

    const dayNames =
      language === 'cs'
        ? ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const monthNames =
      language === 'cs'
        ? ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro']
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return `${dayNames[date.getDay()]} ${day}. ${monthNames[month - 1]}`;
  }

  /**
   * Convert array of date strings to date ranges
   * @param {string[]} dates - Array of date strings in YYYY-MM-DD format
   * @returns {Array<{start: string, end: string}>} Array of date ranges
   */
  static getDateRanges(dates) {
    if (dates.length === 0) {
      return [];
    }

    const ranges = [];
    let currentRange = { start: dates[0], end: dates[0] };

    for (let i = 1; i < dates.length; i++) {
      const currentDate = new Date(dates[i]);
      const prevDate = new Date(dates[i - 1]);
      const dayDiff = (currentDate - prevDate) / (1000 * 60 * 60 * 24);

      if (dayDiff === 1) {
        currentRange.end = dates[i];
      } else {
        ranges.push({ ...currentRange });
        currentRange = { start: dates[i], end: dates[i] };
      }
    }
    ranges.push(currentRange);

    return ranges;
  }

  /**
   * Parse date string to Date object
   * @param {string} dateStr - Date string in YYYY-MM-DD format
   * @returns {Date} Date object
   */
  static parseDate(dateStr) {
    return new Date(dateStr);
  }

  /**
   * Get number of days between two dates
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {number} Number of days
   */
  static getDaysBetween(startDate, endDate) {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    return Math.floor((end - start) / (1000 * 60 * 60 * 24));
  }

  /**
   * Add days to a date
   * @param {Date|string} date - Base date
   * @param {number} days - Number of days to add
   * @returns {Date} New date
   */
  static addDays(date, days) {
    const d = typeof date === 'string' ? new Date(date) : new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  /**
   * Check if date is in the past
   * @param {Date|string} date - Date to check
   * @returns {boolean} True if date is in the past
   */
  static isPast(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  }

  /**
   * Get today's date as YYYY-MM-DD string
   * @returns {string} Today's date
   */
  static getToday() {
    return this.formatDate(new Date());
  }

  /**
   * Get the previous day
   * @param {Date|string} date - Date
   * @returns {string} Previous day in YYYY-MM-DD format
   */
  static getPreviousDay(date) {
    return this.formatDate(this.addDays(date, -1));
  }

  /**
   * Get the next day
   * @param {Date|string} date - Date
   * @returns {string} Next day in YYYY-MM-DD format
   */
  static getNextDay(date) {
    return this.formatDate(this.addDays(date, 1));
  }

  /**
   * Check if a night is occupied by a booking
   * A night is the period from date to date+1
   * Example: Night of 2025-10-05 = period from 2025-10-05 to 2025-10-06
   *
   * @param {string} nightDate - The date of the night (YYYY-MM-DD)
   * @param {string} bookingStart - Booking start date (YYYY-MM-DD)
   * @param {string} bookingEnd - Booking end date (YYYY-MM-DD)
   * @returns {boolean} True if the night is occupied
   */
  static isNightOccupied(nightDate, bookingStart, bookingEnd) {
    // A night is occupied if it falls within the booking range
    // Booking from 2025-10-05 to 2025-10-07 occupies nights:
    // - Night of 2025-10-05 (05->06) ✓
    // - Night of 2025-10-06 (06->07) ✓
    // - Night of 2025-10-07 (07->08) ✗ (checkout day, night not occupied)
    return nightDate >= bookingStart && nightDate < bookingEnd;
  }

  /**
   * Count occupied nights around a specific day
   * "Night before" = night from (day-1) to day
   * "Night after" = night from day to (day+1)
   *
   * @param {string} day - The day to check (YYYY-MM-DD)
   * @param {Array<{startDate: string, endDate: string}>} bookings - Array of bookings
   * @returns {{nightBefore: boolean, nightAfter: boolean, count: number}}
   */
  static getOccupiedNightsAroundDay(day, bookings) {
    const nightBefore = this.getPreviousDay(day); // night from (day-1) to day
    const nightAfter = day; // night from day to (day+1)

    let nightBeforeOccupied = false;
    let nightAfterOccupied = false;

    for (const booking of bookings) {
      if (this.isNightOccupied(nightBefore, booking.startDate, booking.endDate)) {
        nightBeforeOccupied = true;
      }
      if (this.isNightOccupied(nightAfter, booking.startDate, booking.endDate)) {
        nightAfterOccupied = true;
      }
      if (nightBeforeOccupied && nightAfterOccupied) {
        break; // Both nights occupied, no need to check more
      }
    }

    const count = (nightBeforeOccupied ? 1 : 0) + (nightAfterOccupied ? 1 : 0);

    return {
      nightBefore: nightBeforeOccupied,
      nightAfter: nightAfterOccupied,
      count,
    };
  }

  /**
   * Determine day status based on occupied nights around it
   * @param {string} day - The day to check (YYYY-MM-DD)
   * @param {Array<{startDate: string, endDate: string}>} bookings - Array of bookings
   * @returns {'available'|'edge'|'occupied'} Day status
   */
  static getDayStatus(day, bookings) {
    const { count } = this.getOccupiedNightsAroundDay(day, bookings);

    if (count === 0) {
      return 'available'; // No nights occupied
    } else if (count === 1) {
      return 'edge'; // Exactly one night occupied
    }
    return 'occupied'; // Both nights occupied
  }
}

// Export for Node.js (server-side)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DateUtils;
}
