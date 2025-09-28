class DateUtils {
  static formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static formatDateDisplay(date, lang = 'cs') {
    const d = new Date(date);
    const dayNames = translations[lang].weekDays;
    const monthNames = translations[lang].months;

    const dayOfWeek = dayNames[d.getDay() === 0 ? 6 : d.getDay() - 1];
    const day = d.getDate();
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();

    return lang === 'cs'
      ? `${dayOfWeek} ${day}. ${month} ${year}`
      : `${dayOfWeek} ${day} ${month} ${year}`;
  }

  static parseDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  static addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static getDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  static isToday(date) {
    const today = new Date();
    const d = new Date(date);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  }

  static isPast(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DateUtils;
}
