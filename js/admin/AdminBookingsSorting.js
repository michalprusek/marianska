/**
 * AdminBookingsSorting - Sorting functionality for admin bookings table
 *
 * Extracted from AdminBookings.js for better separation of concerns.
 * Handles column sorting, persistence, and comparison logic.
 */
class AdminBookingsSorting {
  constructor(adminBookings) {
    this.adminBookings = adminBookings;
    this.sortColumn = 'createdAt';
    this.sortDirection = 'desc';
    this.loadSortState();
  }

  /**
   * Load sort state from localStorage
   */
  loadSortState() {
    try {
      const savedSort = localStorage.getItem('adminBookingsSort');
      if (savedSort) {
        const parsed = JSON.parse(savedSort);
        this.sortColumn = parsed.column || 'createdAt';
        this.sortDirection = parsed.direction || 'desc';
      }
    } catch (error) {
      console.warn('[AdminBookingsSorting] Failed to load sort state:', error);
    }
  }

  /**
   * Save sort state to localStorage
   */
  saveSortState() {
    try {
      localStorage.setItem(
        'adminBookingsSort',
        JSON.stringify({
          column: this.sortColumn,
          direction: this.sortDirection,
        })
      );
    } catch (error) {
      console.warn('[AdminBookingsSorting] Failed to save sort state:', error);
    }
  }

  /**
   * Handle column header click for sorting
   * FIX 2025-12-09: Three-state sorting: asc → desc → reset (default)
   * @param {string} column - Column key to sort by
   */
  handleSort(column) {
    if (this.sortColumn === column) {
      if (this.sortDirection === 'asc') {
        // asc → desc
        this.sortDirection = 'desc';
      } else {
        // desc → reset to default (createdAt desc = newest first)
        this.sortColumn = 'createdAt';
        this.sortDirection = 'desc';
      }
    } else {
      // New column - start with ascending
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.saveSortState();

    // Reload with new sort
    this.adminBookings.loadBookings();
  }

  /**
   * Sort an array of bookings
   * @param {Array} bookings - Array of booking objects
   * @returns {Array} - Sorted array
   */
  sortBookings(bookings) {
    return [...bookings].sort((a, b) =>
      this.compareBookings(a, b, this.sortColumn, this.sortDirection)
    );
  }

  /**
   * Compare two bookings for sorting
   * @param {Object} a - First booking
   * @param {Object} b - Second booking
   * @param {string} column - Column to sort by
   * @param {string} direction - 'asc' or 'desc'
   * @returns {number} - Comparison result
   */
  compareBookings(a, b, column, direction) {
    let valA;
    let valB;

    switch (column) {
      case 'id':
        valA = a.id || '';
        valB = b.id || '';
        break;
      case 'name':
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
        return direction === 'asc'
          ? valA.localeCompare(valB, 'cs')
          : valB.localeCompare(valA, 'cs');
      case 'email':
        valA = (a.email || '').toLowerCase();
        valB = (b.email || '').toLowerCase();
        return direction === 'asc'
          ? valA.localeCompare(valB, 'cs')
          : valB.localeCompare(valA, 'cs');
      case 'payFromBenefit':
        valA = a.payFromBenefit ? 1 : 0;
        valB = b.payFromBenefit ? 1 : 0;
        break;
      case 'startDate': {
        // Get earliest start date from perRoomDates or fallback to booking.startDate
        const getStartDate = (booking) => {
          if (booking.perRoomDates && Object.keys(booking.perRoomDates).length > 0) {
            const dates = Object.values(booking.perRoomDates).map((d) => d.startDate);
            return Math.min(...dates.map((d) => new Date(d).getTime()));
          }
          return new Date(booking.startDate || 0).getTime();
        };
        valA = getStartDate(a);
        valB = getStartDate(b);
        break;
      }
      case 'rooms':
        // Sort by first room number
        valA = parseInt(a.rooms?.[0], 10) || 0;
        valB = parseInt(b.rooms?.[0], 10) || 0;
        break;
      case 'totalPrice':
        valA = a.totalPrice || 0;
        valB = b.totalPrice || 0;
        break;
      case 'paid':
        valA = a.paid ? 1 : 0;
        valB = b.paid ? 1 : 0;
        break;
      case 'createdAt':
      default:
        valA = new Date(a.createdAt || 0).getTime();
        valB = new Date(b.createdAt || 0).getTime();
        break;
    }

    if (valA < valB) {
      return direction === 'asc' ? -1 : 1;
    }
    if (valA > valB) {
      return direction === 'asc' ? 1 : -1;
    }
    return 0;
  }

  /**
   * Get current sort column
   * @returns {string}
   */
  getSortColumn() {
    return this.sortColumn;
  }

  /**
   * Get current sort direction
   * @returns {string}
   */
  getSortDirection() {
    return this.sortDirection;
  }
}

// Export for browser
if (typeof window !== 'undefined') {
  window.AdminBookingsSorting = AdminBookingsSorting;
}
