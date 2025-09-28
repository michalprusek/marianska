// Bulk booking module - handles bulk event reservations
class BulkBookingModule {
  constructor(app) {
    this.app = app;
    this.bulkSelectedDates = new Set();
    this.bulkDragStart = null;
    this.bulkDragEnd = null;
    this.bulkIsDragging = false;
    this.bulkDragClickStart = null;
    this.airbnbCalendar = null;
  }

  async showBulkBookingModal() {
    const modal = document.getElementById('bulkBookingModal');

    // Reset state
    this.bulkSelectedDates.clear();
    this.bulkDragStart = null;
    this.bulkDragEnd = null;
    this.bulkIsDragging = false;

    // Reset form - use textContent for span elements, not value
    const bulkAdults = document.getElementById('bulkAdults');
    const bulkChildren = document.getElementById('bulkChildren');

    if (bulkAdults) {
      bulkAdults.textContent = '1';
    }
    if (bulkChildren) {
      bulkChildren.textContent = '0';
    }

    // Initialize Airbnb calendar if available, otherwise use bulk calendar
    if (typeof AirbnbCalendarModule !== 'undefined') {
      if (!this.airbnbCalendar) {
        this.airbnbCalendar = new AirbnbCalendarModule(this.app);
      }
      await this.airbnbCalendar.initCalendar('bulkMiniCalendar', null, 'bulk');

      // Listen for date selection events
      this.airbnbCalendar.addEventListener('dates-selected', async (event) => {
        const { checkIn, checkOut, dates } = event.detail;
        this.bulkSelectedDates.clear();
        dates.forEach((date) => this.bulkSelectedDates.add(date));
        await this.updateBulkSelectedDatesDisplay();
        await this.updateBulkPriceCalculation();
        this.updateBulkCapacityCheck();
      });
    } else {
      // Fallback to original bulk calendar
      await this.renderBulkCalendar();
      await this.updateBulkSelectedDatesDisplay();
      this.updateBulkCapacityCheck();
    }

    modal.classList.add('active');
  }

  async renderBulkCalendar() {
    await this.renderBulkCalendarDays();
  }

  async renderBulkCalendarDays() {
    const bulkCalendar =
      document.getElementById('bulkCalendar') || document.getElementById('bulkMiniCalendar');
    const monthTitle = document.getElementById('bulkCalendarMonth');

    if (!bulkCalendar) {
      console.warn('Bulk calendar container not found');
      return;
    }

    // Use shared calendar utilities
    const calendarData = CalendarUtils.getCalendarDays(this.app.currentMonth);
    const { year, month, startDay, daysInMonth, daysInPrevMonth } = calendarData;

    // Update month title using shared utility
    const monthName = CalendarUtils.getMonthName(month, this.app.currentLanguage);
    if (monthTitle) {
      monthTitle.textContent = `${monthName} ${year}`;
    }

    // Clear and build calendar
    bulkCalendar.innerHTML = '';

    // Add day headers using shared utility
    const dayHeaders = CalendarUtils.getWeekdayHeaders(this.app.currentLanguage);

    const headerRow = document.createElement('div');
    headerRow.className = 'mini-calendar-week';
    dayHeaders.forEach((day) => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'mini-calendar-day-header';
      dayHeader.textContent = day;
      headerRow.appendChild(dayHeader);
    });
    bulkCalendar.appendChild(headerRow);

    // Create calendar grid
    let currentWeek = document.createElement('div');
    currentWeek.className = 'mini-calendar-week';

    // Previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      const dayEl = await this.createBulkDayElement(date, true);
      currentWeek.appendChild(dayEl);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      if (currentWeek.children.length === 7) {
        bulkCalendar.appendChild(currentWeek);
        currentWeek = document.createElement('div');
        currentWeek.className = 'mini-calendar-week';
      }

      const date = new Date(year, month, day);
      const dayEl = await this.createBulkDayElement(date, false);
      currentWeek.appendChild(dayEl);
    }

    // Next month days
    let nextMonthDay = 1;
    while (currentWeek.children.length < 7) {
      const date = new Date(year, month + 1, nextMonthDay);
      const dayEl = await this.createBulkDayElement(date, true);
      currentWeek.appendChild(dayEl);
      nextMonthDay++;
    }
    bulkCalendar.appendChild(currentWeek);
  }

  async createBulkDayElement(date, isOtherMonth) {
    const dayEl = document.createElement('div');
    dayEl.className = 'mini-calendar-day';

    const dateStr = dataManager.formatDate(date);
    const isPast = date < this.app.today;
    const isFullyAvailable = await this.isDateFullyAvailable(date);
    const isChristmas = await dataManager.isChristmasPeriod(date);

    // Check if it's Christmas period and after October 1st for bulk bookings
    const today = new Date();
    const oct1 = new Date(today.getFullYear(), 9, 1); // October 1st
    const isAfterOct1 = today >= oct1;
    const isChristmasBlocked = isChristmas && isAfterOct1;

    // Styling
    if (isOtherMonth) {
      dayEl.classList.add('other-month');
    }

    if (isPast) {
      dayEl.classList.add('disabled');
    } else if (isChristmasBlocked) {
      // Block Christmas period for bulk bookings after October 1st
      dayEl.classList.add('blocked');
      dayEl.title =
        this.app.currentLanguage === 'cs'
          ? 'Vánoční období - hromadné rezervace nejsou po 1.10. povoleny'
          : 'Christmas period - bulk bookings not allowed after Oct 1';
    } else if (!isFullyAvailable) {
      dayEl.classList.add('partial-booked');
    } else {
      dayEl.classList.add('available');
    }

    // Check if selected
    if (this.bulkSelectedDates.has(dateStr)) {
      dayEl.classList.add('selected');
    }

    // Check if in drag range
    if (this.bulkIsDragging && this.bulkDragStart && this.bulkDragEnd) {
      const startDate = new Date(
        Math.min(new Date(this.bulkDragStart), new Date(this.bulkDragEnd))
      );
      const endDate = new Date(Math.max(new Date(this.bulkDragStart), new Date(this.bulkDragEnd)));
      const isChristmasBlockedDrag = isChristmas && isAfterOct1;
      if (
        date >= startDate &&
        date <= endDate &&
        !isPast &&
        isFullyAvailable &&
        !isChristmasBlockedDrag
      ) {
        dayEl.classList.add('in-range');
      }
    }

    // Content
    if (isChristmas && !isOtherMonth) {
      dayEl.innerHTML = `🎄 ${date.getDate()}`;
      dayEl.classList.add('christmas');
    } else {
      dayEl.textContent = date.getDate();
    }

    // Event handlers
    if (!isPast && !isOtherMonth && isFullyAvailable && !isChristmasBlocked) {
      dayEl.style.cursor = 'pointer';
      dayEl.style.userSelect = 'none';
      dayEl.style.webkitUserSelect = 'none';
      dayEl.style.mozUserSelect = 'none';

      dayEl.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.bulkIsDragging = true;
        this.bulkDragStart = dateStr;
        this.bulkDragEnd = dateStr;
        this.bulkDragClickStart = Date.now();
        this.updateBulkDragSelection();
        return false;
      };

      dayEl.onmouseenter = () => {
        if (this.bulkIsDragging) {
          this.bulkDragEnd = dateStr;
          this.updateBulkDragSelection();
        }
      };

      dayEl.onmouseup = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const clickDuration = Date.now() - this.bulkDragClickStart;
        const wasDrag = this.bulkIsDragging && clickDuration > 150;

        if (this.bulkIsDragging) {
          this.bulkIsDragging = false;

          if (wasDrag && this.bulkDragStart && this.bulkDragEnd) {
            await this.selectBulkCalendarRange(this.bulkDragStart, this.bulkDragEnd);
          } else {
            // Single click toggle
            if (this.bulkSelectedDates.has(dateStr)) {
              this.bulkSelectedDates.delete(dateStr);
            } else {
              this.bulkSelectedDates.add(dateStr);
            }
          }

          this.bulkDragStart = null;
          this.bulkDragEnd = null;
          this.bulkDragClickStart = null;

          await this.renderBulkCalendarDays();
          await this.updateBulkSelectedDatesDisplay();
          await this.updateBulkPriceCalculation();
        }

        return false;
      };
    }

    return dayEl;
  }

  async isDateFullyAvailable(date) {
    const rooms = await dataManager.getRooms();
    for (const room of rooms) {
      const availability = await dataManager.getRoomAvailability(date, room.id);
      if (availability.status !== 'available') {
        return false;
      }
    }
    return true;
  }

  updateBulkDragSelection() {
    requestAnimationFrame(async () => {
      await this.renderBulkCalendarDays();
    });
  }

  async selectBulkCalendarRange(startStr, endStr) {
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    const actualStart = new Date(Math.min(startDate, endDate));
    const actualEnd = new Date(Math.max(startDate, endDate));

    this.bulkSelectedDates.clear();

    // Check if it's after October 1st
    const today = new Date();
    const oct1 = new Date(today.getFullYear(), 9, 1);
    const isAfterOct1 = today >= oct1;

    const currentDate = new Date(actualStart);
    while (currentDate <= actualEnd) {
      const dateStr = dataManager.formatDate(currentDate);
      const isAvailable = await this.isDateFullyAvailable(currentDate);
      const isPast = currentDate < this.app.today;
      const isChristmas = await dataManager.isChristmasPeriod(currentDate);
      const isChristmasBlocked = isChristmas && isAfterOct1;

      if (!isPast && isAvailable && !isChristmasBlocked) {
        this.bulkSelectedDates.add(dateStr);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  navigateBulkCalendar(direction) {
    const newMonth = new Date(this.app.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);

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
    this.renderBulkCalendarDays();
  }

  async updateBulkSelectedDatesDisplay() {
    const display =
      document.getElementById('bulkSelectedDatesDisplay') ||
      document.getElementById('bulkDateSelectionSummary');
    const datesList =
      document.getElementById('bulkSelectedDatesList') ||
      document.getElementById('bulkSelectedDateRange');
    const confirmBtn =
      document.getElementById('confirmBulkDates') ||
      document.getElementById('confirmBulkBookingBtn');

    if (this.bulkSelectedDates.size === 0) {
      if (display) {
        display.style.display = 'none';
      }
      if (confirmBtn) {
        confirmBtn.disabled = true;
      }
      return;
    }

    if (display) {
      display.style.display = 'block';
    }

    // Calculate total nights (selected days - 1)
    const totalNights = Math.max(0, this.bulkSelectedDates.size - 1);

    // Enable/disable the confirm button based on nights
    if (confirmBtn) {
      confirmBtn.disabled = totalNights === 0;
    }

    const sortedDates = Array.from(this.bulkSelectedDates).sort();
    const ranges = this.app.getDateRanges(sortedDates);

    let html = '';
    ranges.forEach((range) => {
      const start = new Date(range.start);
      const end = new Date(range.end);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const nights = days - 1; // nights = days - 1

      if (range.start === range.end) {
        html += `<div class="selected-date-range">
                    <span>${this.app.formatDateDisplay(start)}</span>
                    <span class="nights-count">0 ${this.app.currentLanguage === 'cs' ? 'nocí' : 'nights'}</span>
                </div>`;
      } else {
        html += `<div class="selected-date-range">
                    <span>${this.app.formatDateDisplay(start)} - ${this.app.formatDateDisplay(end)}</span>
                    <span class="nights-count">${nights} ${this.app.currentLanguage === 'cs' ? (nights === 1 ? 'noc' : nights < 5 ? 'noci' : 'nocí') : nights === 1 ? 'night' : 'nights'}</span>
                </div>`;
      }
    });

    if (datesList) {
      if (datesList.tagName === 'DIV') {
        datesList.innerHTML = html;
      } else {
        // For single elements like bulkSelectedDateRange, show just the first range
        const firstRange = ranges[0];
        if (firstRange) {
          const start = new Date(firstRange.start);
          const end = new Date(firstRange.end);
          if (firstRange.start === firstRange.end) {
            datesList.textContent = this.app.formatDateDisplay(start);
          } else {
            datesList.textContent = `${this.app.formatDateDisplay(start)} - ${this.app.formatDateDisplay(end)}`;
          }
        }
      }
    }
  }

  async updateBulkPriceCalculation() {
    const sortedDates = Array.from(this.bulkSelectedDates).sort();
    if (sortedDates.length === 0) {
      return;
    }

    // Calculate nights as selected days - 1
    const nights = Math.max(0, sortedDates.length - 1);
    const rooms = await dataManager.getRooms();
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent) || 0;
    const children = parseInt(document.getElementById('bulkChildren')?.textContent) || 0;
    const toddlers = 0; // Not used in bulk bookings

    // Calculate total price for bulk booking
    const guestType = 'external'; // Bulk bookings are always external

    // Calculate price using the dataManager method
    const totalPrice = await dataManager.calculatePrice(
      guestType,
      adults,
      children,
      toddlers,
      nights,
      rooms.length // number of rooms
    );

    // Update display
    const priceDisplay = document.getElementById('bulkTotalPrice');
    if (priceDisplay) {
      priceDisplay.textContent = `${totalPrice.toLocaleString('cs-CZ')} Kč`;
    }

    const nightsDisplay = document.getElementById('bulkNightsCount');
    if (nightsDisplay) {
      nightsDisplay.textContent = nights;
    }
  }

  updateBulkCapacityCheck() {
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent) || 0;
    const children = parseInt(document.getElementById('bulkChildren')?.textContent) || 0;
    const totalGuests = adults + children;

    const capacityWarning = document.getElementById('bulkCapacityWarning');
    const confirmBtn = document.getElementById('confirmBulkBooking');

    if (totalGuests > 26) {
      if (capacityWarning) {
        capacityWarning.style.display = 'block';
      }
      if (confirmBtn) {
        confirmBtn.disabled = true;
      }
    } else {
      if (capacityWarning) {
        capacityWarning.style.display = 'none';
      }
      if (confirmBtn && this.bulkSelectedDates.size > 0) {
        confirmBtn.disabled = false;
      }
    }
  }

  adjustBulkGuests(type, change) {
    const element = document.getElementById(`bulk${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (!element) {
      return;
    }

    let value = parseInt(element.textContent) || 0;
    value = Math.max(0, value + change);

    if (type === 'adults') {
      value = Math.max(1, value);
    }

    element.textContent = value;
    this.updateBulkCapacityCheck();
    this.updateBulkPriceCalculation();
  }

  hideBulkBookingModal() {
    const modal = document.getElementById('bulkBookingModal');
    modal.classList.remove('active');

    // Clean up
    this.bulkSelectedDates.clear();
    this.bulkDragStart = null;
    this.bulkDragEnd = null;
    this.bulkIsDragging = false;
  }

  async confirmBulkDates() {
    // For now, directly submit since we don't have a two-step process in current HTML
    await this.submitBulkBooking();
  }

  backToBulkDateSelection() {
    // Not used in current HTML structure
  }

  async submitBulkBooking() {
    // For now, use dummy data since the current HTML doesn't have the form fields
    // In the future, these should be actual form inputs
    const name = 'Bulk Booking';
    const email = 'bulk@example.com';
    const phone = '+420123456789';
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent) || 1;
    const children = parseInt(document.getElementById('bulkChildren')?.textContent) || 0;
    const toddlers = 0;
    const notes = 'Hromadná rezervace všech pokojů';

    // Validate
    if (!name || !email || !phone) {
      alert(
        this.app.currentLanguage === 'cs'
          ? 'Vyplňte prosím všechna povinná pole'
          : 'Please fill in all required fields'
      );
      return;
    }

    // Get all rooms for bulk booking
    const rooms = await dataManager.getRooms();
    const roomIds = rooms.map((r) => r.id);

    // Get date range
    const sortedDates = Array.from(this.bulkSelectedDates).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    // Check if trying to book Christmas period after October 1st
    const today = new Date();
    const oct1 = new Date(today.getFullYear(), 9, 1);
    const isAfterOct1 = today >= oct1;

    if (isAfterOct1) {
      // Check if any of the selected dates are in the Christmas period
      for (const dateStr of sortedDates) {
        const date = new Date(dateStr);
        const isChristmas = await dataManager.isChristmasPeriod(date);
        if (isChristmas) {
          this.app.showNotification(
            this.app.currentLanguage === 'cs'
              ? 'Hromadné rezervace v období vánočních prázdnin nejsou po 1.10. povoleny'
              : 'Bulk bookings during Christmas period are not allowed after October 1st',
            'error'
          );
          return;
        }
      }
    }

    // Create booking
    const booking = {
      name,
      email,
      phone,
      startDate,
      endDate,
      rooms: roomIds,
      guestType: 'external', // Bulk bookings are external
      adults,
      children,
      toddlers,
      notes:
        notes || `${this.app.currentLanguage === 'cs' ? 'Hromadná rezervace' : 'Bulk booking'}`,
      isBulkBooking: true,
    };

    try {
      await dataManager.createBooking(booking);

      this.hideBulkBookingModal();

      // Show success and refresh
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? '✓ Hromadná rezervace byla úspěšně vytvořena'
          : '✓ Bulk booking created successfully',
        'success'
      );

      await this.app.renderCalendar();
    } catch (error) {
      console.error('Bulk booking error:', error);
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Chyba při vytváření rezervace'
          : 'Error creating booking',
        'error'
      );
    }
  }
}

// Global functions for HTML onclick events
window.adjustBulkGuests = function (type, change) {
  if (window.app && window.app.bulkBooking) {
    window.app.bulkBooking.adjustBulkGuests(type, change);
  }
};

window.closeBulkModal = function () {
  if (window.app && window.app.bulkBooking) {
    window.app.bulkBooking.hideBulkBookingModal();
  }
};

window.addBulkBooking = async function () {
  if (window.app && window.app.bulkBooking) {
    await window.app.bulkBooking.confirmBulkDates();
  }
};
