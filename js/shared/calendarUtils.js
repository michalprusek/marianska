class CalendarUtils {
  static navigateMonth(currentMonth, currentYear, direction) {
    let newMonth = currentMonth;
    let newYear = currentYear;

    if (direction === 'prev') {
      if (currentMonth === 0) {
        newMonth = 11;
        newYear = currentYear - 1;
      } else {
        newMonth = currentMonth - 1;
      }
    } else {
      if (currentMonth === 11) {
        newMonth = 0;
        newYear = currentYear + 1;
      } else {
        newMonth = currentMonth + 1;
      }
    }

    return { month: newMonth, year: newYear };
  }

  static getMonthGrid(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 7 : startDayOfWeek;

    const grid = [];
    let currentDate = 1;

    for (let week = 0; week < 6; week++) {
      const weekDays = [];
      for (let day = 1; day <= 7; day++) {
        if (week === 0 && day < startDayOfWeek) {
          weekDays.push(null);
        } else if (currentDate > daysInMonth) {
          weekDays.push(null);
        } else {
          weekDays.push(currentDate);
          currentDate++;
        }
      }
      grid.push(weekDays);
      if (currentDate > daysInMonth) break;
    }

    return {
      grid,
      daysInMonth,
      firstDay,
      lastDay,
      startDayOfWeek
    };
  }

  static isDateInRange(date, startDate, endDate) {
    const d = new Date(date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return d >= start && d <= end;
  }

  static getDatesInRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(DateUtils.formatDate(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  static isSameMonth(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
  }

  static getMonthBounds(year, month) {
    const today = new Date();
    const currentYear = today.getFullYear();

    const canNavigatePrev = !(year === currentYear && month <= today.getMonth());
    const canNavigateNext = !(year === currentYear + 1 && month === 11);

    return { canNavigatePrev, canNavigateNext };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CalendarUtils;
}