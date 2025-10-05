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
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
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
}
