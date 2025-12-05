/**
 * Admin Statistics Module
 * Handles loading and rendering statistics and charts.
 */
class AdminStats {
  constructor(adminPanel) {
    this.adminPanel = adminPanel;
  }

  setupEventListeners() {
    const fromInput = document.getElementById('statsFromDate');
    const toInput = document.getElementById('statsToDate');

    if (fromInput) {
      fromInput.addEventListener('change', () => this.loadStatistics());
    }
    if (toInput) {
      toInput.addEventListener('change', () => this.loadStatistics());
    }
  }

  async loadStatistics() {
    const container = document.getElementById('statistics');
    if (!container) {
      return;
    }

    try {
      const bookings = await dataManager.getAllBookings();
      const settings = await dataManager.getSettings(); // SSOT FIX 2025-12-04: Fetch settings for price recalculation

      // Get date range from inputs (default to current month)
      const fromInput = document.getElementById('statsFromDate');
      const toInput = document.getElementById('statsToDate');

      if (!fromInput || !toInput) {
        console.error('[AdminStats] Statistics filter inputs not found');
        return;
      }

      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

      // Set defaults if empty
      if (!fromInput.value) {
        fromInput.value = currentMonth;
      }
      if (!toInput.value) {
        toInput.value = currentMonth;
      }

      const fromDate = new Date(`${fromInput.value}-01`);
      const toDate = new Date(`${toInput.value}-01`);
      toDate.setMonth(toDate.getMonth() + 1); // Move to next month
      toDate.setDate(0); // Last day of selected month

      // Validate date range
      if (fromDate > toDate) {
        this.adminPanel.showToast('Datum "Od" musí být před datem "Do"', 'error');
        return;
      }

      // Filter bookings by date range
      const filteredBookings = bookings.filter((booking) => {
        const bookingStart = new Date(booking.startDate);
        return bookingStart >= fromDate && bookingStart <= toDate;
      });

      // Calculate ALL stats from filtered bookings
      const stats = {
        total: filteredBookings.length,
        totalRevenue: 0,
        averagePrice: 0,
        occupancyRate: 0,
      };

      // SSOT FIX 2025-12-04: Use recalculated prices from current settings
      // We access getBookingPrice via adminPanel.bookings
      filteredBookings.forEach((booking) => {
        stats.totalRevenue += this.adminPanel.bookings.getBookingPrice(booking, settings);
      });

      if (filteredBookings.length > 0) {
        stats.averagePrice = Math.round(stats.totalRevenue / filteredBookings.length);
      }

      // Calculate occupancy rate for the selected period
      const monthsDiff =
        (toDate.getFullYear() - fromDate.getFullYear()) * 12 +
        (toDate.getMonth() - fromDate.getMonth()) +
        1;
      let totalRoomDays = 0;

      // Calculate total room-days in the period (9 rooms from settings.rooms)
      const tempDate = new Date(fromDate);
      for (let m = 0; m < monthsDiff; m++) {
        const daysInMonth = new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0).getDate();
        totalRoomDays += daysInMonth * 9;
        tempDate.setMonth(tempDate.getMonth() + 1);
      }

      // Calculate booked room-days
      let bookedRoomDays = 0;
      filteredBookings.forEach((booking) => {
        const start = new Date(booking.startDate);
        const end = new Date(booking.endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        bookedRoomDays += days * (booking.rooms?.length || 1);
      });

      stats.occupancyRate =
        totalRoomDays > 0 ? Math.round((bookedRoomDays / totalRoomDays) * 100) : 0;

      // Format period label
      const periodLabel =
        fromInput.value === toInput.value
          ? this.formatMonth(fromInput.value)
          : `${this.formatMonth(fromInput.value)} - ${this.formatMonth(toInput.value)}`;

      // Render statistics
      container.innerHTML = `
        <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
          <div style="font-size: 2rem; font-weight: 700; color: var(--primary-color);">${stats.total}</div>
          <div style="color: var(--gray-600);">Počet rezervací</div>
        </div>
        <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
          <div style="font-size: 2rem; font-weight: 700; color: var(--primary-color);">${stats.totalRevenue.toLocaleString('cs-CZ')} Kč</div>
          <div style="color: var(--gray-600);">Celkové příjmy</div>
        </div>
        <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
          <div style="font-size: 2rem; font-weight: 700; color: #f59e0b;">${stats.averagePrice.toLocaleString('cs-CZ')} Kč</div>
          <div style="color: var(--gray-600);">Průměrná cena</div>
        </div>
        <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
          <div style="font-size: 2rem; font-weight: 700; color: #10b981;">${stats.occupancyRate}%</div>
          <div style="color: var(--gray-600);">Obsazenost</div>
        </div>
        <div style="grid-column: 1 / -1; padding: 0.75rem; text-align: center; color: var(--gray-500); font-size: 0.875rem; background: var(--gray-100); border-radius: var(--radius-sm);">
          📅 Období: <strong>${periodLabel}</strong>
        </div>
      `;
    } catch (error) {
      console.error('[AdminStats] Failed to load statistics:', error);
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: var(--error-color); background: #fef2f2; border-radius: var(--radius-md);">
          ⚠️ Nepodařilo se načíst statistiky. Zkuste to znovu.
        </div>
      `;
    }
  }

  /**
   * Reset statistics date filter to current month and reload statistics.
   */
  resetStatisticsFilter() {
    const fromInput = document.getElementById('statsFromDate');
    const toInput = document.getElementById('statsToDate');

    if (!fromInput || !toInput) {
      console.error('[AdminStats] Statistics filter inputs not found');
      this.adminPanel.showToast('Nepodařilo se resetovat filtr', 'error');
      return;
    }

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    fromInput.value = currentMonth;
    toInput.value = currentMonth;
    this.loadStatistics();
  }

  /**
   * Format month string (YYYY-MM) to Czech month name with year.
   *
   * @param {string} monthStr - Month in YYYY-MM format
   * @returns {string} Czech month name with year (e.g., "leden 2025")
   * @example formatMonth('2025-01') // returns "leden 2025"
   */
  formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    const months = [
      'leden',
      'únor',
      'březen',
      'duben',
      'květen',
      'červen',
      'červenec',
      'srpen',
      'září',
      'říjen',
      'listopad',
      'prosinec',
    ];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
  }
}
