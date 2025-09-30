/**
 * Shared calendar utilities to eliminate code duplication
 */
class CalendarUtils {
  /**
   * Generate calendar days for a given month
   * @param {Date} date - Date object for the month
   * @returns {Object} Calendar data with metadata
   */
  static getCalendarDays(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1; // Monday = 0
    if (startDay < 0) {
      startDay = 6;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    return {
      year,
      month,
      firstDay,
      startDay,
      daysInMonth,
      daysInPrevMonth,
    };
  }

  /**
   * Get month name in specified language
   * @param {number} month - Month index (0-11)
   * @param {string} language - Language code ('cs' or 'en')
   * @returns {string} Month name
   */
  static getMonthName(month, language = 'cs') {
    const months = {
      cs: [
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
      ],
      en: [
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
      ],
    };
    return months[language][month];
  }

  /**
   * Get weekday headers in specified language
   * @param {string} language - Language code ('cs' or 'en')
   * @returns {string[]} Array of weekday abbreviations
   */
  static getWeekdayHeaders(language = 'cs') {
    return language === 'cs'
      ? ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }

  /**
   * Check if a date is in the past
   * @param {Date} date - Date to check
   * @returns {boolean} True if date is in the past
   */
  static isPastDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  /**
   * Check if a date is today
   * @param {Date} date - Date to check
   * @returns {boolean} True if date is today
   */
  static isToday(date) {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  /**
   * Check if a date is weekend
   * @param {Date} date - Date to check
   * @returns {boolean} True if date is Saturday or Sunday
   */
  static isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  /**
   * Get all dates in a range
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {string[]} Array of dates in YYYY-MM-DD format
   */
  static getDateRange(startDate, endDate) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current.getTime() <= end.getTime()) {
      dates.push(dataManager.formatDate(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Calculate number of nights between two dates
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {number} Number of nights
   */
  static calculateNights(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Create navigation buttons HTML
   * @param {string} prevId - ID for previous button
   * @param {string} nextId - ID for next button
   * @param {string} titleId - ID for title element
   * @returns {string} HTML string for navigation
   */
  static createNavigationHTML(prevId, nextId, titleId) {
    return `
      <button id="${prevId}" class="mini-nav-btn">‹</button>
      <div id="${titleId}" class="mini-month-title"></div>
      <button id="${nextId}" class="mini-nav-btn">›</button>
    `;
  }

  /**
   * Check if month navigation should be disabled
   * @param {Date} targetMonth - Month to check
   * @param {string} direction - 'prev' or 'next'
   * @returns {boolean} True if navigation should be disabled
   */
  static shouldDisableNavigation(targetMonth, direction) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const nextYear = currentYear + 1;

    if (direction === 'prev') {
      const prevMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, 1);
      return prevMonth < new Date(currentYear, today.getMonth(), 1);
    }
    const nextMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 1);
    return nextMonth > new Date(nextYear, 11, 31);
  }

  /**
   * Create date selection info HTML
   * @param {Set} selectedDates - Set of selected dates
   * @param {Object} translations - Translation strings
   * @returns {string} HTML string for date info
   */
  static createDateSelectionInfo(selectedDates, translations) {
    if (selectedDates.size === 0) {
      return `<span class="date-info-empty">${translations.selectDates}</span>`;
    }

    const sortedDates = Array.from(selectedDates).sort();
    const dateRanges = this.groupConsecutiveDates(sortedDates);

    return dateRanges
      .map((range) => {
        const start = new Date(range[0]);
        const end = new Date(range[range.length - 1]);
        const nights = range.length;

        const startStr = start.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });
        const endStr = end.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });

        let nightsLabel;
        if (nights === 1) {
          nightsLabel = translations.night;
        } else if (nights < 5) {
          nightsLabel = translations.nights2_4;
        } else {
          nightsLabel = translations.nights5plus;
        }

        return `<div class="date-range">
        ${startStr} - ${endStr}
        <span class="nights-count">(${nights} ${nightsLabel})</span>
      </div>`;
      })
      .join('');
  }

  /**
   * Group consecutive dates into ranges
   * @param {string[]} dates - Array of dates in YYYY-MM-DD format
   * @returns {Array<string[]>} Array of date ranges
   */
  static groupConsecutiveDates(dates) {
    if (!dates.length) {
      return [];
    }

    const ranges = [];
    let currentRange = [dates[0]];

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currentDate = new Date(dates[i]);
      const dayDiff = (currentDate - prevDate) / (1000 * 60 * 60 * 24);

      if (dayDiff === 1) {
        currentRange.push(dates[i]);
      } else {
        ranges.push(currentRange);
        currentRange = [dates[i]];
      }
    }

    ranges.push(currentRange);
    return ranges;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CalendarUtils;
}
