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

  /**
   * Save selected date range to localStorage for prefilling next time
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   */
  saveLastSelectedDateRange(startDate, endDate) {
    try {
      const dateRange = {
        startDate,
        endDate,
        timestamp: Date.now(),
      };
      localStorage.setItem('lastBulkDateRange', JSON.stringify(dateRange));
    } catch (error) {
      console.warn('Failed to save last bulk date range:', error);
      // Non-critical error - continue without saving
    }
  }

  /**
   * Load last selected date range from localStorage
   * @returns {Object|null} - Object with startDate and endDate, or null if not found/invalid
   */
  loadLastSelectedDateRange() {
    try {
      const stored = localStorage.getItem('lastBulkDateRange');
      if (!stored) {
        return null;
      }

      const dateRange = JSON.parse(stored);

      // Validate structure
      if (!dateRange.startDate || !dateRange.endDate || !dateRange.timestamp) {
        return null;
      }

      // Check if dates are in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(`${dateRange.startDate}T12:00:00`);

      if (startDate < today) {
        // Dates are in the past, clear them
        localStorage.removeItem('lastBulkDateRange');
        return null;
      }

      // Optional: Check if dates are too old (e.g., > 30 days)
      const daysSinceStored = (Date.now() - dateRange.timestamp) / (1000 * 60 * 60 * 24);
      if (daysSinceStored > 30) {
        // Too old, clear
        localStorage.removeItem('lastBulkDateRange');
        return null;
      }

      return {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      };
    } catch (error) {
      console.warn('Failed to load last bulk date range:', error);
      return null;
    }
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

    // Set up guest type change handler
    const guestTypeInputs = document.querySelectorAll('input[name="bulkGuestType"]');
    guestTypeInputs.forEach((input) => {
      input.addEventListener('change', () => {
        this.updateBulkPriceCalculation();
      });
    });

    // Reset guest type to external (default for bulk bookings)
    const externalRadio = document.querySelector('input[name="bulkGuestType"][value="external"]');
    if (externalRadio) {
      externalRadio.checked = true;
    }

    // Always use the bulk calendar (not Airbnb calendar)
    await this.renderBulkCalendar();

    // NEW 2025-11-14: Load last selected date range and prefill if available
    const lastDateRange = this.loadLastSelectedDateRange();
    if (lastDateRange) {
      // Validate that dates are fully available for bulk booking (all 9 rooms)
      const isRangeAvailable = await this.isDateRangeFullyAvailable(
        lastDateRange.startDate,
        lastDateRange.endDate
      );

      if (isRangeAvailable) {
        // Prefill the date range
        const start = new Date(`${lastDateRange.startDate}T12:00:00`);
        const end = new Date(`${lastDateRange.endDate}T12:00:00`);
        const current = new Date(start);

        // Add all dates in range to bulkSelectedDates
        // eslint-disable-next-line no-unmodified-loop-condition -- current is modified inside loop body with setDate
        while (current <= end) {
          const dateStr = DateUtils.formatDate(current);
          this.bulkSelectedDates.add(dateStr);
          current.setDate(current.getDate() + 1);
        }

        // Sync with calendar's selectedDates
        if (this.bulkCalendar) {
          this.bulkCalendar.selectedDates = this.bulkSelectedDates;
          await this.bulkCalendar.render();
        }
      }
    }

    this.updateBulkSelectedDatesDisplay();
    await this.updateBulkPriceCalculation();
    this.updateBulkCapacityCheck();

    // Generate guest names input fields with default counts (1 adult, 0 children, 0 toddlers)
    this.generateGuestNamesInputs(1, 0, 0);

    modal.classList.add('active');
  }

  async renderBulkCalendar() {
    // Initialize BaseCalendar if not exists
    if (!this.bulkCalendar) {
      this.bulkCalendar = new BaseCalendar({
        mode: BaseCalendar.MODES.BULK,
        app: this.app,
        containerId: 'bulkCalendar',
        allowPast: false,
        enforceContiguous: true,
        minNights: 1,
        onDateSelect: async () => {
          // Sync with module's bulkSelectedDates
          this.bulkSelectedDates = this.bulkCalendar.selectedDates;
          this.updateBulkSelectedDatesDisplay();
          await this.updateBulkPriceCalculation();
          this.updateBulkCapacityCheck();
        },
        onDateDeselect: async () => {
          // Sync with module's bulkSelectedDates
          this.bulkSelectedDates = this.bulkCalendar.selectedDates;
          this.updateBulkSelectedDatesDisplay();
          await this.updateBulkPriceCalculation();
          this.updateBulkCapacityCheck();
        },
      });

      // IMPORTANT: Sync prefilled dates immediately after calendar creation
      // This ensures localStorage prefilled dates are properly transferred to bulkCalendar
      this.bulkCalendar.selectedDates = this.bulkSelectedDates;
    }

    // Sync module's bulkSelectedDates with calendar's selectedDates (for subsequent opens)
    this.bulkCalendar.selectedDates = this.bulkSelectedDates;

    // Render calendar
    await this.bulkCalendar.render();
  }

  navigateBulkCalendar(direction) {
    if (this.bulkCalendar) {
      this.bulkCalendar.navigateMonth(direction);
    }
  }

  updateBulkSelectedDatesDisplay() {
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
        // Determine the correct plural form
        let nightsLabel = 'nights';
        if (this.app.currentLanguage === 'cs') {
          if (nights === 1) {
            nightsLabel = 'noc';
          } else if (nights < 5) {
            nightsLabel = 'noci';
          } else {
            nightsLabel = 'nocí';
          }
        } else if (nights === 1) {
          nightsLabel = 'night';
        }

        html += `<div class="selected-date-range">
                    <span>${this.app.formatDateDisplay(start)} - ${this.app.formatDateDisplay(end)}</span>
                    <span class="nights-count">${nights} ${nightsLabel}</span>
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
      // Clear price display when no dates selected
      const priceDisplay = document.getElementById('bulkTotalPrice');
      if (priceDisplay) {
        priceDisplay.textContent = '0 Kč';
      }
      const nightsDisplay = document.getElementById('bulkNightsCount');
      if (nightsDisplay) {
        nightsDisplay.textContent = '0';
      }
      const nightsMultiplier = document.getElementById('bulkNightsMultiplier');
      if (nightsMultiplier) {
        nightsMultiplier.textContent = '× 0';
      }
      // Safe access to langManager with fallback
      const perNightText = langManager ? langManager.t('perNight') : '/noc';
      const basePriceEl = document.getElementById('bulkBasePrice');
      if (basePriceEl) {
        basePriceEl.textContent = `0 Kč${perNightText}`;
      }
      const perNightTotal = document.getElementById('bulkPricePerNightAmount');
      if (perNightTotal) {
        perNightTotal.textContent = '0 Kč';
      }
      const adultsEl = document.getElementById('bulkAdultsSurcharge');
      if (adultsEl) {
        adultsEl.textContent = `0 Kč${perNightText}`;
      }
      const childrenEl = document.getElementById('bulkChildrenSurcharge');
      if (childrenEl) {
        childrenEl.textContent = `0 Kč${perNightText}`;
      }
      return;
    }

    // Calculate nights as selected days - 1
    const nights = Math.max(0, sortedDates.length - 1);
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent, 10) || 1;
    const children = parseInt(document.getElementById('bulkChildren')?.textContent, 10) || 0;

    // Count guests by type (ÚTIA vs External) for per-guest pricing
    let utiaAdults = 0;
    let utiaChildren = 0;
    let externalAdults = 0;
    let externalChildren = 0;

    // Check for ÚTIA guests by looking at toggle switches
    const section = document.getElementById('bulkGuestNamesSection');
    if (section && section.style.display !== 'none') {
      const toggles = section.querySelectorAll('input[data-guest-price-type]');

      toggles.forEach((toggle) => {
        const isUtia = !toggle.checked; // Unchecked = ÚTIA, Checked = External
        const guestType = toggle.getAttribute('data-guest-type'); // 'adult' or 'child'

        if (isUtia) {
          if (guestType === 'adult') {
            utiaAdults += 1;
          } else if (guestType === 'child') {
            utiaChildren += 1;
          }
        } else {
          if (guestType === 'adult') {
            externalAdults += 1;
          } else if (guestType === 'child') {
            externalChildren += 1;
          }
        }
      });
    } else {
      // If no toggles visible (shouldn't happen), default all to external
      externalAdults = adults;
      externalChildren = children;
    }

    // Get pricing settings from admin configuration
    const settings = await dataManager.getSettings();

    // Default bulk prices if not configured
    const defaultBulkPrices = {
      basePrice: 2000,
      utiaAdult: 100,
      utiaChild: 0,
      externalAdult: 250,
      externalChild: 50,
    };

    // Get bulk price configuration
    const bulkPrices = settings.bulkPrices || defaultBulkPrices;

    // For bulk booking - use flat base price for entire chalet
    const totalBasePricePerNight = bulkPrices.basePrice;

    // Calculate guest surcharges PER GUEST TYPE
    const adultSurcharge =
      utiaAdults * bulkPrices.utiaAdult + externalAdults * bulkPrices.externalAdult;

    const childrenSurcharge =
      utiaChildren * bulkPrices.utiaChild + externalChildren * bulkPrices.externalChild;

    // Calculate total
    const pricePerNight = totalBasePricePerNight + adultSurcharge + childrenSurcharge;
    const totalPrice = pricePerNight * nights;

    // Get translation for "per night" with safe access
    const perNightText = langManager ? langManager.t('perNight') : '/noc';

    // Update display elements
    const basePriceEl = document.getElementById('bulkBasePrice');
    if (basePriceEl) {
      basePriceEl.textContent = `${totalBasePricePerNight.toLocaleString('cs-CZ')} Kč${perNightText}`;
    }

    // Hide old generic surcharge lines
    const oldAdultsLine = document.getElementById('bulkAdultsPrice');
    const oldChildrenLine = document.getElementById('bulkChildrenPrice');
    if (oldAdultsLine) oldAdultsLine.style.display = 'none';
    if (oldChildrenLine) oldChildrenLine.style.display = 'none';

    // Create or get detailed surcharges container
    let detailedContainer = document.getElementById('bulkDetailedSurcharges');
    if (!detailedContainer) {
      detailedContainer = document.createElement('div');
      detailedContainer.id = 'bulkDetailedSurcharges';
      detailedContainer.style.cssText = 'padding-left: 1rem;';

      // Insert after base price line
      const basePriceLine = basePriceEl?.parentElement;
      if (basePriceLine && basePriceLine.parentElement) {
        basePriceLine.parentElement.insertBefore(detailedContainer, basePriceLine.nextSibling);
      }
    }

    // Clear previous detailed lines
    detailedContainer.innerHTML = '';

    // Helper function for pluralization
    const getGuestLabel = (count, type) => {
      if (type === 'adult') {
        if (count === 1) return '1 dospělý';
        if (count >= 2 && count <= 4) return `${count} dospělí`;
        return `${count} dospělých`;
      } else {
        if (count === 1) return '1 dítě';
        if (count >= 2 && count <= 4) return `${count} děti`;
        return `${count} dětí`;
      }
    };

    // Add ÚTIA adults line (if any)
    if (utiaAdults > 0) {
      const line = document.createElement('div');
      line.className = 'price-line';
      line.style.cssText =
        'display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.9rem;';

      const label = document.createElement('span');
      label.textContent = `ÚTIA hosté: ${getGuestLabel(utiaAdults, 'adult')} × ${bulkPrices.utiaAdult.toLocaleString('cs-CZ')} Kč${perNightText}`;
      label.style.color = '#059669';

      const value = document.createElement('span');
      const utiaAdultTotal = utiaAdults * bulkPrices.utiaAdult;
      value.textContent =
        utiaAdultTotal > 0
          ? `+${utiaAdultTotal.toLocaleString('cs-CZ')} Kč${perNightText}`
          : `0 Kč${perNightText}`;
      value.style.color = '#059669';

      line.appendChild(label);
      line.appendChild(value);
      detailedContainer.appendChild(line);
    }

    // Add External adults line (if any)
    if (externalAdults > 0) {
      const line = document.createElement('div');
      line.className = 'price-line';
      line.style.cssText =
        'display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.9rem;';

      const label = document.createElement('span');
      label.textContent = `Externí hosté: ${getGuestLabel(externalAdults, 'adult')} × ${bulkPrices.externalAdult.toLocaleString('cs-CZ')} Kč${perNightText}`;
      label.style.color = '#dc2626';

      const value = document.createElement('span');
      const externalAdultTotal = externalAdults * bulkPrices.externalAdult;
      value.textContent = `+${externalAdultTotal.toLocaleString('cs-CZ')} Kč${perNightText}`;
      value.style.color = '#dc2626';

      line.appendChild(label);
      line.appendChild(value);
      detailedContainer.appendChild(line);
    }

    // Add ÚTIA children line (if any and price > 0)
    if (utiaChildren > 0) {
      const utiaChildTotal = utiaChildren * bulkPrices.utiaChild;
      if (utiaChildTotal > 0 || utiaChildren > 0) {
        const line = document.createElement('div');
        line.className = 'price-line';
        line.style.cssText =
          'display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.9rem;';

        const label = document.createElement('span');
        label.textContent = `ÚTIA děti: ${getGuestLabel(utiaChildren, 'child')} × ${bulkPrices.utiaChild.toLocaleString('cs-CZ')} Kč${perNightText}`;
        label.style.color = '#059669';

        const value = document.createElement('span');
        value.textContent =
          utiaChildTotal > 0
            ? `+${utiaChildTotal.toLocaleString('cs-CZ')} Kč${perNightText}`
            : `0 Kč${perNightText}`;
        value.style.color = '#059669';

        line.appendChild(label);
        line.appendChild(value);
        detailedContainer.appendChild(line);
      }
    }

    // Add External children line (if any and price > 0)
    if (externalChildren > 0) {
      const externalChildTotal = externalChildren * bulkPrices.externalChild;
      if (externalChildTotal > 0) {
        const line = document.createElement('div');
        line.className = 'price-line';
        line.style.cssText =
          'display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.9rem;';

        const label = document.createElement('span');
        label.textContent = `Externí děti: ${getGuestLabel(externalChildren, 'child')} × ${bulkPrices.externalChild.toLocaleString('cs-CZ')} Kč${perNightText}`;
        label.style.color = '#dc2626';

        const value = document.createElement('span');
        value.textContent = `+${externalChildTotal.toLocaleString('cs-CZ')} Kč${perNightText}`;
        value.style.color = '#dc2626';

        line.appendChild(label);
        line.appendChild(value);
        detailedContainer.appendChild(line);
      }
    }

    // Update per night total
    const perNightTotal = document.getElementById('bulkPricePerNightAmount');
    if (perNightTotal) {
      perNightTotal.textContent = `${pricePerNight.toLocaleString('cs-CZ')} Kč`;
    }

    const nightsMultiplier = document.getElementById('bulkNightsMultiplier');
    if (nightsMultiplier) {
      nightsMultiplier.textContent = `× ${nights}`;
    }

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
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent, 10) || 0;
    const children = parseInt(document.getElementById('bulkChildren')?.textContent, 10) || 0;
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

    let value = parseInt(element.textContent, 10) || 0;
    value = Math.max(0, value + change);

    // NEW 2025-10-17: Allow temporarily setting 0 adults/children
    // Validation will happen at proposal creation time

    element.textContent = value;
    this.updateBulkCapacityCheck();
    this.updateBulkPriceCalculation();

    // Regenerate guest names input fields with updated counts
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent || '1', 10);
    const children = parseInt(document.getElementById('bulkChildren')?.textContent || '0', 10);
    this.generateGuestNamesInputs(adults, children, 0);
  }

  /**
   * Check if a date range is fully available for bulk booking (all 9 rooms)
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<boolean>} - True if range is fully available for all rooms, false otherwise
   */
  async isDateRangeFullyAvailable(startDate, endDate) {
    try {
      // Invalidate proposed bookings cache to ensure fresh data
      dataManager.invalidateProposedBookingsCache();

      const settings = await dataManager.getSettings();
      const allRooms = settings.rooms.map((r) => r.id);

      const start = new Date(`${startDate}T12:00:00`);
      const end = new Date(`${endDate}T12:00:00`);
      const current = new Date(start);

      // Check each day in the range for all rooms
      // eslint-disable-next-line no-unmodified-loop-condition -- current is modified inside loop body with setDate
      while (current <= end) {
        // Check if ALL rooms are available on this date
        // eslint-disable-next-line no-await-in-loop
        const availabilityChecks = await Promise.all(
          allRooms.map((roomId) =>
            dataManager.getRoomAvailability(current, roomId, '') // Empty string = don't exclude any sessions
          )
        );

        // If any room is NOT available, return false
        const allAvailable = availabilityChecks.every(
          (avail) => avail.status === 'available' || avail.status === 'edge'
        );

        if (!allAvailable) {
          return false;
        }

        current.setDate(current.getDate() + 1);
      }

      return true; // All days and all rooms are available
    } catch (error) {
      console.warn('Failed to check bulk date range availability:', error);
      return false;
    }
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
    // Validate minimum selection
    if (this.bulkSelectedDates.size === 0) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs' ? 'Vyberte prosím termín pobytu' : 'Please select dates',
        'warning'
      );
      return;
    }

    // Validate minimum 2 days (1 night)
    if (this.bulkSelectedDates.size < 2) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Minimální rezervace je na 1 noc (2 dny)'
          : 'Minimum booking is for 1 night (2 days)',
        'warning'
      );
      return;
    }

    // Check Christmas period restrictions for bulk bookings
    const sortedDatesArray = Array.from(this.bulkSelectedDates).sort();

    // Optimize: Check all dates in parallel instead of sequentially
    const christmasChecks = await Promise.all(
      sortedDatesArray.map((dateStr) => dataManager.isChristmasPeriod(new Date(dateStr)))
    );
    const isChristmasPeriod = christmasChecks.some(Boolean);

    let christmasPeriodStart = null;
    if (isChristmasPeriod) {
      const settings = await dataManager.getSettings();
      christmasPeriodStart = settings.christmasPeriod?.start;
    }

    if (isChristmasPeriod && christmasPeriodStart) {
      const { bulkBlocked } = dataManager.checkChristmasAccessRequirement(
        christmasPeriodStart,
        true // isBulkBooking
      );

      if (bulkBlocked) {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? 'Hromadné rezervace celé chaty nejsou po 1. říjnu povoleny pro vánoční období. Rezervujte jednotlivé pokoje.'
            : 'Bulk bookings are not allowed after October 1st for Christmas period. Please book individual rooms.',
          'error'
        );
        return;
      }
    }

    // Validate no blocked dates in selection for any room
    const rooms = await dataManager.getRooms();

    for (const dateStr of sortedDatesArray) {
      const date = new Date(`${dateStr}T12:00:00`);

      // Check each room for this date
      for (const room of rooms) {
        const availability = await dataManager.getRoomAvailability(date, room.id);

        if (availability.status === 'blocked') {
          this.app.showNotification(
            langManager
              .t('roomBlockedOnDate')
              .replace('{roomName}', room.name)
              .replace('{date}', dateStr),
            'error'
          );
          return;
        }
      }
    }

    // Get guest configuration
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent, 10) || 1;
    const children = parseInt(document.getElementById('bulkChildren')?.textContent, 10) || 0;

    // NEW 2025-10-17: Validate that there is at least 1 person (adult OR child)
    const totalGuests = (adults || 0) + (children || 0);
    if (totalGuests === 0) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Musíte zadat alespoň 1 osobu (dospělého nebo dítě) pro hromadnou rezervaci'
          : 'You must specify at least 1 person (adult or child) for bulk booking',
        'warning'
      );
      return;
    }

    // Validate guest names - REQUIRED before creating booking
    const guestNames = this.collectGuestNames();
    if (guestNames === null) {
      // Validation failed - collectGuestNames() already showed error notification
      return;
    }

    // Validate guest names count matches total guests
    const expectedGuestCount = (adults || 0) + (children || 0);
    if (guestNames.length !== expectedGuestCount) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? `Počet vyplněných jmen (${guestNames.length}) neodpovídá počtu hostů (${expectedGuestCount})`
          : `Number of filled names (${guestNames.length}) doesn't match guest count (${expectedGuestCount})`,
        'error'
      );
      return;
    }

    // Get guest type
    const guestTypeInput = document.querySelector('input[name="bulkGuestType"]:checked');
    const guestType = guestTypeInput ? guestTypeInput.value : 'external';

    // Get dates - use exactly what user selected
    const sortedDates = Array.from(this.bulkSelectedDates).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];
    const nights = sortedDates.length - 1;

    // Get all rooms for bulk booking
    const allRooms = await dataManager.getRooms();
    const roomIds = allRooms.map((r) => r.id);

    // Calculate price using bulk pricing
    const settings = await dataManager.getSettings();
    const defaultBulkPrices = {
      basePrice: 2000,
      utiaAdult: 100,
      utiaChild: 0,
      externalAdult: 250,
      externalChild: 50,
    };
    const bulkPrices = settings.bulkPrices || defaultBulkPrices;
    const priceGuestKey = guestType === 'utia' ? 'utia' : 'external';
    const pricePerNight =
      bulkPrices.basePrice +
      adults * bulkPrices[`${priceGuestKey}Adult`] +
      children * bulkPrices[`${priceGuestKey}Child`];
    const totalPrice = pricePerNight * nights;

    // FIX 2025-10-16: Create smart per-room guest allocation
    // This ensures guests are distributed intelligently across rooms by capacity
    const perRoomGuests = {};

    // Get room capacities (sorted by capacity desc, then by room ID)
    const roomsWithCapacity = allRooms
      .map((room) => ({
        id: room.id,
        capacity: room.beds || 2,
      }))
      .sort((a, b) => {
        if (b.capacity !== a.capacity) {
          return b.capacity - a.capacity; // Larger rooms first
        }
        return a.id.localeCompare(b.id); // Then by room ID
      });

    // Allocate guests to rooms based on capacity
    let remainingAdults = adults;
    let remainingChildren = children;

    for (const room of roomsWithCapacity) {
      if (remainingAdults === 0 && remainingChildren === 0) {
        // No more guests - leave room empty
        perRoomGuests[room.id] = {
          adults: 0,
          children: 0,
          toddlers: 0,
          guestType,
        };
        continue;
      }

      // Calculate how many guests to put in this room (up to capacity)
      const availableSpace = room.capacity;
      const guestsToAllocate = Math.min(availableSpace, remainingAdults + remainingChildren);

      // Prioritize adults first, then children
      const adultsInRoom = Math.min(remainingAdults, guestsToAllocate);
      const childrenInRoom = Math.min(remainingChildren, guestsToAllocate - adultsInRoom);

      perRoomGuests[room.id] = {
        adults: adultsInRoom,
        children: childrenInRoom,
        toddlers: 0,
        guestType,
      };

      // Update remaining counts
      remainingAdults -= adultsInRoom;
      remainingChildren -= childrenInRoom;
    }

    // Create proposed booking in database for all rooms
    try {
      const proposalId = await dataManager.createProposedBooking(
        startDate,
        endDate,
        roomIds,
        { adults, children, toddlers: 0 },
        guestType,
        totalPrice
      );

      // NEW 2025-11-14: Save selected date range to localStorage AFTER successful creation
      // This ensures dates are only saved if the proposed booking was created successfully
      this.saveLastSelectedDateRange(startDate, endDate);

      // Create temporary bulk booking object with proposal ID
      const tempBulkBooking = {
        isBulkBooking: true,
        roomIds,
        roomNames: allRooms.map((r) => r.name).join(', '),
        startDate,
        endDate,
        nights,
        guests: { adults, children, toddlers: 0 },
        guestType,
        totalPrice,
        perRoomGuests, // FIX 2025-10-16: Include smart room allocation
        guestNames, // Guest names validated and collected earlier
        // CRITICAL FIX 2025-10-07: Use IdGenerator (SSOT) for temp IDs
        id: `temp-bulk-${IdGenerator.generateToken(9)}`,
        proposalId, // Store the proposal ID for cleanup
      };

      // Store the bulk booking temporarily
      if (!this.app.tempReservations) {
        this.app.tempReservations = [];
      }

      // Clear any existing temp reservations for bulk booking
      this.app.tempReservations = this.app.tempReservations.filter((r) => !r.isBulkBooking);

      // Add the new bulk booking
      this.app.tempReservations.push(tempBulkBooking);

      // Close the bulk modal
      this.hideBulkBookingModal();

      // Show success notification
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? `Hromadná rezervace přidána do seznamu rezervací`
          : `Bulk booking added to reservation list`,
        'success'
      );

      // Update the main page to show temporary reservations (also refreshes calendar)
      await this.app.displayTempReservations();

      // Show the finalize button
      const finalizeDiv = document.getElementById('finalizeReservationsDiv');
      if (finalizeDiv && this.app.tempReservations.length > 0) {
        finalizeDiv.style.display = 'block';
      }
    } catch (error) {
      console.error('Failed to create proposed booking:', error);
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Chyba při vytváření dočasné rezervace'
          : 'Error creating temporary reservation',
        'error'
      );
    }
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
    const adults = parseInt(document.getElementById('bulkAdults')?.textContent, 10) || 1;
    const children = parseInt(document.getElementById('bulkChildren')?.textContent, 10) || 0;
    const notes = 'Hromadná rezervace všech pokojů';

    // Validate
    if (!name || !email || !phone) {
      this.app.showNotification(
        this.app.currentLanguage === 'cs'
          ? 'Vyplňte prosím všechna povinná pole'
          : 'Please fill in all required fields',
        'error'
      );
      return;
    }

    // Get all rooms for bulk booking (reuse from above scope if possible)
    const allRoomsForBooking = await dataManager.getRooms();
    const roomIds = allRoomsForBooking.map((r) => r.id);

    // Get guest type from radio buttons (if available) or default to external
    const guestTypeInput = document.querySelector('input[name="bulkGuestType"]:checked');
    const guestType = guestTypeInput ? guestTypeInput.value : 'external';

    // Get date range
    const sortedDates = Array.from(this.bulkSelectedDates).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    // Christmas validation already performed in confirmBulkDates() - no need to duplicate
    // (uses ChristmasUtils.checkChristmasAccessRequirement for consistent logic)

    // FIX: Create per-room guest data for bulk bookings with smart allocation
    // This ensures correct guest counts are preserved when editing
    const perRoomGuests = {};

    // Smart room allocation algorithm:
    // 1. Get room capacities from settings
    // 2. Fill rooms efficiently based on capacity
    // 3. Leave rooms empty if not enough guests

    // Get room capacities (sorted by capacity desc, then by room ID)
    const roomsWithCapacity = allRoomsForBooking
      .map((room) => ({
        id: room.id,
        capacity: room.beds || 2,
      }))
      .sort((a, b) => {
        if (b.capacity !== a.capacity) {
          return b.capacity - a.capacity; // Larger rooms first
        }
        return a.id.localeCompare(b.id); // Then by room ID
      });

    // Total guests to allocate
    const totalGuests = adults + children;
    let remainingAdults = adults;
    let remainingChildren = children;

    // Allocate guests to rooms
    for (const room of roomsWithCapacity) {
      if (totalGuests === 0 || (remainingAdults === 0 && remainingChildren === 0)) {
        // No more guests - leave room empty
        perRoomGuests[room.id] = {
          adults: 0,
          children: 0,
          toddlers: 0,
          guestType,
        };
        continue;
      }

      // Calculate how many guests to put in this room (up to capacity)
      const availableSpace = room.capacity;
      const guestsToAllocate = Math.min(availableSpace, remainingAdults + remainingChildren);

      // Prioritize adults first, then children
      const adultsInRoom = Math.min(remainingAdults, guestsToAllocate);
      const childrenInRoom = Math.min(remainingChildren, guestsToAllocate - adultsInRoom);

      perRoomGuests[room.id] = {
        adults: adultsInRoom,
        children: childrenInRoom,
        toddlers: 0,
        guestType,
      };

      // Update remaining counts
      remainingAdults -= adultsInRoom;
      remainingChildren -= childrenInRoom;
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
      toddlers: 0, // Bulk bookings don't track toddlers separately
      perRoomGuests, // FIX: Include per-room guest data for proper editing
      notes:
        notes || `${this.app.currentLanguage === 'cs' ? 'Hromadná rezervace' : 'Bulk booking'}`,
      isBulkBooking: true,
      sessionId: this.app.sessionId, // Include sessionId to exclude user's own proposals
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

  /**
   * Generate guest names input fields for bulk booking
   * @param {number} adults - Number of adults
   * @param {number} children - Number of children (3-17 years)
   * @param {number} toddlers - Number of toddlers (0-3 years)
   */
  generateGuestNamesInputs(adults, children, toddlers = 0) {
    const section = document.getElementById('bulkGuestNamesSection');
    const totalGuests = (adults || 0) + (children || 0) + (toddlers || 0);

    // Show section only if there are guests
    if (totalGuests > 0) {
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
      return;
    }

    // CAPTURE PHASE: Save existing guest data before clearing DOM
    const savedGuestData = new Map();

    // Capture adults
    const existingAdultInputs = section.querySelectorAll('input[data-guest-type="adult"]');
    existingAdultInputs.forEach((input) => {
      const index = input.dataset.guestIndex;
      const key = `adult-${index}`;
      if (!savedGuestData.has(key)) {
        savedGuestData.set(key, {});
      }
      const data = savedGuestData.get(key);
      if (input.id.includes('FirstName')) {
        data.firstName = input.value;
      } else if (input.id.includes('LastName')) {
        data.lastName = input.value;
      }
    });

    // Capture adult toggle states
    const existingAdultToggles = section.querySelectorAll(
      'input[data-guest-type="adult"][data-guest-price-type]'
    );
    existingAdultToggles.forEach((toggle) => {
      const index = toggle.dataset.guestIndex;
      const key = `adult-${index}`;
      if (savedGuestData.has(key)) {
        savedGuestData.get(key).guestType = toggle.checked ? 'external' : 'utia';
      }
    });

    // Capture children
    const existingChildInputs = section.querySelectorAll('input[data-guest-type="child"]');
    existingChildInputs.forEach((input) => {
      const index = input.dataset.guestIndex;
      const key = `child-${index}`;
      if (!savedGuestData.has(key)) {
        savedGuestData.set(key, {});
      }
      const data = savedGuestData.get(key);
      if (input.id.includes('FirstName')) {
        data.firstName = input.value;
      } else if (input.id.includes('LastName')) {
        data.lastName = input.value;
      }
    });

    // Capture children toggle states
    const existingChildToggles = section.querySelectorAll(
      'input[data-guest-type="child"][data-guest-price-type]'
    );
    existingChildToggles.forEach((toggle) => {
      const index = toggle.dataset.guestIndex;
      const key = `child-${index}`;
      if (savedGuestData.has(key)) {
        savedGuestData.get(key).guestType = toggle.checked ? 'external' : 'utia';
      }
    });

    // Capture toddlers
    const existingToddlerInputs = section.querySelectorAll('input[data-guest-type="toddler"]');
    existingToddlerInputs.forEach((input) => {
      const index = input.dataset.guestIndex;
      const key = `toddler-${index}`;
      if (!savedGuestData.has(key)) {
        savedGuestData.set(key, {});
      }
      const data = savedGuestData.get(key);
      if (input.id.includes('FirstName')) {
        data.firstName = input.value;
      } else if (input.id.includes('LastName')) {
        data.lastName = input.value;
      }
    });

    // Capture toddler toggle states
    const existingToddlerToggles = section.querySelectorAll(
      'input[data-guest-type="toddler"][data-guest-price-type]'
    );
    existingToddlerToggles.forEach((toggle) => {
      const index = toggle.dataset.guestIndex;
      const key = `toddler-${index}`;
      if (savedGuestData.has(key)) {
        savedGuestData.get(key).guestType = toggle.checked ? 'external' : 'utia';
      }
    });

    const makeId = (prefix) => prefix;

    // Adults section
    const adultsContainer = document.getElementById('bulkAdultsNamesContainer');
    if (adultsContainer) {
      adultsContainer.innerHTML = '';
      if (adults > 0) {
        adultsContainer.style.display = 'block';
        const adultsHeader = document.createElement('h5');
        adultsHeader.style.cssText = 'margin-bottom: 0.5rem; color: #374151; font-size: 0.95rem;';
        adultsHeader.textContent = langManager.t('adultsLabel') + ` (${adults})`;
        adultsContainer.appendChild(adultsHeader);

        for (let i = 1; i <= adults; i++) {
          const row = document.createElement('div');
          row.style.cssText =
            'display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;';

          // First name input
          const firstNameInput = document.createElement('input');
          firstNameInput.type = 'text';
          firstNameInput.id = `${makeId('bulkAdultFirstName')}${i}`;
          firstNameInput.placeholder = langManager.t('firstNamePlaceholder');
          firstNameInput.setAttribute('data-guest-type', 'adult');
          firstNameInput.setAttribute('data-guest-index', i);
          firstNameInput.required = true;
          firstNameInput.minLength = 2;
          firstNameInput.maxLength = 50;
          firstNameInput.style.cssText =
            'flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;';

          // Last name input
          const lastNameInput = document.createElement('input');
          lastNameInput.type = 'text';
          lastNameInput.id = `${makeId('bulkAdultLastName')}${i}`;
          lastNameInput.placeholder = langManager.t('lastNamePlaceholder');
          lastNameInput.setAttribute('data-guest-type', 'adult');
          lastNameInput.setAttribute('data-guest-index', i);
          lastNameInput.required = true;
          lastNameInput.minLength = 2;
          lastNameInput.maxLength = 50;
          lastNameInput.style.cssText =
            'flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;';

          // Add input event listeners to clear red border when user types
          firstNameInput.addEventListener('input', function () {
            if (
              this.style.borderColor === 'rgb(239, 68, 68)' ||
              this.style.borderColor === '#ef4444'
            ) {
              this.style.borderColor = '#d1d5db';
            }
          });

          lastNameInput.addEventListener('input', function () {
            if (
              this.style.borderColor === 'rgb(239, 68, 68)' ||
              this.style.borderColor === '#ef4444'
            ) {
              this.style.borderColor = '#d1d5db';
            }
          });

          // RESTORE PHASE: Restore saved data for this adult guest
          const savedAdultKey = `adult-${i}`;
          if (savedGuestData.has(savedAdultKey)) {
            const saved = savedGuestData.get(savedAdultKey);
            if (saved.firstName) firstNameInput.value = saved.firstName;
            if (saved.lastName) lastNameInput.value = saved.lastName;
          }

          // Toggle switch container
          const toggleContainer = document.createElement('div');
          toggleContainer.style.cssText =
            'display: flex; align-items: center; gap: 0.25rem; white-space: nowrap; flex-shrink: 0;';

          const toggleLabel = document.createElement('label');
          toggleLabel.style.cssText =
            'position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer;';

          const toggleInput = document.createElement('input');
          toggleInput.type = 'checkbox';
          toggleInput.id = `bulkAdult${i}GuestTypeToggle`;
          toggleInput.setAttribute('data-guest-type', 'adult');
          toggleInput.setAttribute('data-guest-index', i);
          toggleInput.setAttribute('data-guest-price-type', 'true');
          toggleInput.checked = false; // Unchecked = ÚTIA, Checked = External
          toggleInput.style.cssText = 'opacity: 0; width: 0; height: 0;';

          const toggleSlider = document.createElement('span');
          toggleSlider.style.cssText =
            'position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #059669; transition: 0.3s; border-radius: 24px;';

          const toggleThumb = document.createElement('span');
          toggleThumb.style.cssText =
            'position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%;';
          toggleSlider.appendChild(toggleThumb);

          toggleLabel.appendChild(toggleInput);
          toggleLabel.appendChild(toggleSlider);

          const toggleText = document.createElement('span');
          toggleText.textContent = 'ÚTIA';
          toggleText.style.cssText =
            'font-size: 0.75rem; font-weight: 600; color: #059669; min-width: 32px;';

          // RESTORE PHASE: Restore toggle state for this adult guest
          if (savedGuestData.has(savedAdultKey)) {
            const saved = savedGuestData.get(savedAdultKey);
            if (saved.guestType) {
              const isExternal = saved.guestType === 'external';
              toggleInput.checked = isExternal;
              // Trigger visual update
              if (isExternal) {
                toggleSlider.style.backgroundColor = '#dc2626';
                toggleThumb.style.transform = 'translateX(20px)';
                toggleText.textContent = 'EXT';
                toggleText.style.color = '#dc2626';
              } else {
                toggleSlider.style.backgroundColor = '#059669';
                toggleThumb.style.transform = 'translateX(0)';
                toggleText.textContent = 'ÚTIA';
                toggleText.style.color = '#059669';
              }
            }
          }

          toggleContainer.appendChild(toggleLabel);
          toggleContainer.appendChild(toggleText);

          // Add event listener to toggle
          toggleInput.addEventListener('change', () => {
            if (toggleInput.checked) {
              // External (checked)
              toggleSlider.style.backgroundColor = '#dc2626';
              toggleThumb.style.transform = 'translateX(20px)';
              toggleText.textContent = 'EXT';
              toggleText.style.color = '#dc2626';
            } else {
              // ÚTIA (unchecked)
              toggleSlider.style.backgroundColor = '#059669';
              toggleThumb.style.transform = 'translateX(0)';
              toggleText.textContent = 'ÚTIA';
              toggleText.style.color = '#059669';
            }
            // Trigger price recalculation
            this.updateBulkPriceCalculation();
          });

          row.appendChild(firstNameInput);
          row.appendChild(lastNameInput);
          row.appendChild(toggleContainer);
          adultsContainer.appendChild(row);
        }
      } else {
        adultsContainer.style.display = 'none';
      }
    }

    // Children section
    const childrenContainer = document.getElementById('bulkChildrenNamesContainer');
    if (childrenContainer) {
      childrenContainer.innerHTML = '';
      if (children > 0) {
        childrenContainer.style.display = 'block';
        childrenContainer.style.marginTop = '1rem';
        const childrenHeader = document.createElement('h5');
        childrenHeader.style.cssText = 'margin-bottom: 0.5rem; color: #374151; font-size: 0.95rem;';
        childrenHeader.textContent = langManager.t('childrenLabel') + ` (${children})`;
        childrenContainer.appendChild(childrenHeader);

        for (let i = 1; i <= children; i++) {
          const row = document.createElement('div');
          row.style.cssText =
            'display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;';

          // First name input
          const firstNameInput = document.createElement('input');
          firstNameInput.type = 'text';
          firstNameInput.id = `${makeId('bulkChildFirstName')}${i}`;
          firstNameInput.placeholder = langManager.t('firstNamePlaceholder');
          firstNameInput.setAttribute('data-guest-type', 'child');
          firstNameInput.setAttribute('data-guest-index', i);
          firstNameInput.required = true;
          firstNameInput.minLength = 2;
          firstNameInput.maxLength = 50;
          firstNameInput.style.cssText =
            'flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;';

          // Last name input
          const lastNameInput = document.createElement('input');
          lastNameInput.type = 'text';
          lastNameInput.id = `${makeId('bulkChildLastName')}${i}`;
          lastNameInput.placeholder = langManager.t('lastNamePlaceholder');
          lastNameInput.setAttribute('data-guest-type', 'child');
          lastNameInput.setAttribute('data-guest-index', i);
          lastNameInput.required = true;
          lastNameInput.minLength = 2;
          lastNameInput.maxLength = 50;
          lastNameInput.style.cssText =
            'flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;';

          // Add input event listeners to clear red border when user types
          firstNameInput.addEventListener('input', function () {
            if (
              this.style.borderColor === 'rgb(239, 68, 68)' ||
              this.style.borderColor === '#ef4444'
            ) {
              this.style.borderColor = '#d1d5db';
            }
          });

          lastNameInput.addEventListener('input', function () {
            if (
              this.style.borderColor === 'rgb(239, 68, 68)' ||
              this.style.borderColor === '#ef4444'
            ) {
              this.style.borderColor = '#d1d5db';
            }
          });

          // RESTORE PHASE: Restore saved data for this child guest
          const savedChildKey = `child-${i}`;
          if (savedGuestData.has(savedChildKey)) {
            const saved = savedGuestData.get(savedChildKey);
            if (saved.firstName) firstNameInput.value = saved.firstName;
            if (saved.lastName) lastNameInput.value = saved.lastName;
          }

          // Toggle switch container
          const toggleContainer = document.createElement('div');
          toggleContainer.style.cssText =
            'display: flex; align-items: center; gap: 0.25rem; white-space: nowrap; flex-shrink: 0;';

          const toggleLabel = document.createElement('label');
          toggleLabel.style.cssText =
            'position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer;';

          const toggleInput = document.createElement('input');
          toggleInput.type = 'checkbox';
          toggleInput.id = `bulkChild${i}GuestTypeToggle`;
          toggleInput.setAttribute('data-guest-type', 'child');
          toggleInput.setAttribute('data-guest-index', i);
          toggleInput.setAttribute('data-guest-price-type', 'true');
          toggleInput.checked = false; // Unchecked = ÚTIA, Checked = External
          toggleInput.style.cssText = 'opacity: 0; width: 0; height: 0;';

          const toggleSlider = document.createElement('span');
          toggleSlider.style.cssText =
            'position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #059669; transition: 0.3s; border-radius: 24px;';

          const toggleThumb = document.createElement('span');
          toggleThumb.style.cssText =
            'position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%;';
          toggleSlider.appendChild(toggleThumb);

          toggleLabel.appendChild(toggleInput);
          toggleLabel.appendChild(toggleSlider);

          const toggleText = document.createElement('span');
          toggleText.textContent = 'ÚTIA';
          toggleText.style.cssText =
            'font-size: 0.75rem; font-weight: 600; color: #059669; min-width: 32px;';

          // RESTORE PHASE: Restore toggle state for this child guest
          if (savedGuestData.has(savedChildKey)) {
            const saved = savedGuestData.get(savedChildKey);
            if (saved.guestType) {
              const isExternal = saved.guestType === 'external';
              toggleInput.checked = isExternal;
              // Trigger visual update
              if (isExternal) {
                toggleSlider.style.backgroundColor = '#dc2626';
                toggleThumb.style.transform = 'translateX(20px)';
                toggleText.textContent = 'EXT';
                toggleText.style.color = '#dc2626';
              } else {
                toggleSlider.style.backgroundColor = '#059669';
                toggleThumb.style.transform = 'translateX(0)';
                toggleText.textContent = 'ÚTIA';
                toggleText.style.color = '#059669';
              }
            }
          }

          toggleContainer.appendChild(toggleLabel);
          toggleContainer.appendChild(toggleText);

          // Add event listener to toggle
          toggleInput.addEventListener('change', () => {
            if (toggleInput.checked) {
              // External (checked)
              toggleSlider.style.backgroundColor = '#dc2626';
              toggleThumb.style.transform = 'translateX(20px)';
              toggleText.textContent = 'EXT';
              toggleText.style.color = '#dc2626';
            } else {
              // ÚTIA (unchecked)
              toggleSlider.style.backgroundColor = '#059669';
              toggleThumb.style.transform = 'translateX(0)';
              toggleText.textContent = 'ÚTIA';
              toggleText.style.color = '#059669';
            }
            // Trigger price recalculation
            this.updateBulkPriceCalculation();
          });

          row.appendChild(firstNameInput);
          row.appendChild(lastNameInput);
          row.appendChild(toggleContainer);
          childrenContainer.appendChild(row);
        }
      } else {
        childrenContainer.style.display = 'none';
      }
    }

    // Toddlers section
    const toddlersContainer = document.getElementById('bulkToddlersNamesContainer');
    if (toddlersContainer) {
      toddlersContainer.innerHTML = '';
      if (toddlers > 0) {
        toddlersContainer.style.display = 'block';
        toddlersContainer.style.marginTop = '1rem';
        const toddlersHeader = document.createElement('h5');
        toddlersHeader.style.cssText = 'margin-bottom: 0.5rem; color: #374151; font-size: 0.95rem;';
        toddlersHeader.textContent = langManager.t('toddlersLabel') + ` (${toddlers})`;
        toddlersContainer.appendChild(toddlersHeader);

        for (let i = 1; i <= toddlers; i++) {
          const row = document.createElement('div');
          row.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem;';
          row.innerHTML = `
            <input
              type="text"
              id="${makeId('bulkToddlerFirstName')}${i}"
              placeholder="${langManager.t('firstNamePlaceholder')}"
              data-guest-type="toddler"
              data-guest-index="${i}"
              required
              minlength="2"
              maxlength="50"
              style="flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;"
            />
            <input
              type="text"
              id="${makeId('bulkToddlerLastName')}${i}"
              placeholder="${langManager.t('lastNamePlaceholder')}"
              data-guest-type="toddler"
              data-guest-index="${i}"
              required
              minlength="2"
              maxlength="50"
              style="flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px;"
            />
          `;
          toddlersContainer.appendChild(row);

          // Add input event listeners to clear red border when user types
          const toddlerFirstName = row.querySelector(`input[id*="FirstName"]`);
          const toddlerLastName = row.querySelector(`input[id*="LastName"]`);

          // RESTORE PHASE: Restore saved data for this toddler guest
          const savedToddlerKey = `toddler-${i}`;
          if (savedGuestData.has(savedToddlerKey)) {
            const saved = savedGuestData.get(savedToddlerKey);
            if (saved.firstName && toddlerFirstName) toddlerFirstName.value = saved.firstName;
            if (saved.lastName && toddlerLastName) toddlerLastName.value = saved.lastName;
          }

          if (toddlerFirstName) {
            toddlerFirstName.addEventListener('input', function () {
              if (
                this.style.borderColor === 'rgb(239, 68, 68)' ||
                this.style.borderColor === '#ef4444'
              ) {
                this.style.borderColor = '#d1d5db';
              }
            });
          }

          if (toddlerLastName) {
            toddlerLastName.addEventListener('input', function () {
              if (
                this.style.borderColor === 'rgb(239, 68, 68)' ||
                this.style.borderColor === '#ef4444'
              ) {
                this.style.borderColor = '#d1d5db';
              }
            });
          }
        }
      } else {
        toddlersContainer.style.display = 'none';
      }
    }
  }

  /**
   * Collect and validate guest names from bulk booking form
   * @param {boolean} showValidationErrors - If true, shows error notifications (default: true)
   * @returns {Array|null} Array of guest objects or null if validation fails
   */
  collectGuestNames(showValidationErrors = true) {
    const guestNames = [];
    const section = document.getElementById('bulkGuestNamesSection');

    if (!section || section.style.display === 'none') {
      return []; // No names section visible
    }

    const inputs = section.querySelectorAll('input[data-guest-type]');
    const guestMap = new Map();

    inputs.forEach((input) => {
      const guestType = input.dataset.guestType;
      const guestIndex = input.dataset.guestIndex;
      const key = `${guestType}-${guestIndex}`;

      if (!guestMap.has(key)) {
        guestMap.set(key, { personType: guestType });
      }

      const guest = guestMap.get(key);
      const value = input.value.trim();

      // Validate: all fields must be filled
      if (!value || value.length < 2) {
        // Highlight invalid field (only if showing errors)
        if (showValidationErrors) {
          input.style.borderColor = '#ef4444';
        }
        return null; // Validation failed
      }

      input.style.borderColor = '#d1d5db';

      if (input.id.includes('FirstName')) {
        guest.firstName = value;
      } else if (input.id.includes('LastName')) {
        guest.lastName = value;
      }
    });

    // Collect guest type from toggle switches (checkboxes)
    const toggles = section.querySelectorAll('input[data-guest-price-type]');
    toggles.forEach((toggle) => {
      const guestType = toggle.dataset.guestType;
      const guestIndex = toggle.dataset.guestIndex;
      const key = `${guestType}-${guestIndex}`;

      if (guestMap.has(key)) {
        const guest = guestMap.get(key);
        // Determine guest category: unchecked = utia, checked = external
        guest.guestCategory = toggle.checked ? 'external' : 'utia';
      }
    });

    // Check if any validation failed
    let validationFailed = false;
    inputs.forEach((input) => {
      const value = input.value.trim();
      if (!value || value.length < 2) {
        validationFailed = true;
      }
    });

    if (validationFailed) {
      // Only show notification if requested
      if (showValidationErrors) {
        this.app.showNotification(
          this.app.currentLanguage === 'cs'
            ? 'Vyplňte všechna jména hostů (křestní i příjmení)'
            : 'Fill in all guest names (first and last name)',
          'error'
        );
      }
      return null;
    }

    // Convert map to array and validate completeness
    for (const [key, guest] of guestMap) {
      if (!guest.firstName || !guest.lastName) {
        // Only show notification if requested
        if (showValidationErrors) {
          this.app.showNotification(
            this.app.currentLanguage === 'cs'
              ? 'Vyplňte všechna jména hostů (křestní i příjmení)'
              : 'Fill in all guest names (first and last name)',
            'error'
          );
        }
        return null;
      }
      // Default to 'external' if not set (for toddlers or backward compatibility)
      if (!guest.guestCategory) {
        guest.guestCategory = 'external';
      }
      guestNames.push(guest);
    }

    return guestNames;
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
