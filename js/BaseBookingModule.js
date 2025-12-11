/**
 * BaseBookingModule - Base class for booking modules
 *
 * Provides common functionality shared between SingleRoomBookingModule and BulkBookingModule:
 * - Date range persistence (localStorage)
 * - Guest name utilities (delegation to GuestNameUtils)
 * - Price calculation helpers
 * - Common validation patterns
 *
 * Usage:
 *   class SingleRoomBookingModule extends BaseBookingModule {
 *     constructor(app) {
 *       super(app, 'singleRoom');
 *     }
 *   }
 */
class BaseBookingModule {
  /**
   * @param {Object} app - Reference to main BookingApp
   * @param {string} storageKey - Unique key for localStorage (e.g., 'singleRoom', 'bulk')
   */
  constructor(app, storageKey = 'booking') {
    this.app = app;
    this.storageKey = storageKey;
  }

  // ========== DATE RANGE PERSISTENCE ==========

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
      localStorage.setItem(`lastSelectedDateRange_${this.storageKey}`, JSON.stringify(dateRange));
    } catch (error) {
      console.warn(`[BaseBookingModule] Failed to save date range for ${this.storageKey}:`, error);
    }
  }

  /**
   * Load last selected date range from localStorage
   * @returns {Object|null} - Object with startDate and endDate, or null if not found/invalid
   */
  loadLastSelectedDateRange() {
    try {
      const stored = localStorage.getItem(`lastSelectedDateRange_${this.storageKey}`);
      if (!stored) {
        return null;
      }

      const dateRange = JSON.parse(stored);

      // Validate structure
      if (!dateRange.startDate || !dateRange.endDate || !dateRange.timestamp) {
        return null;
      }

      // Check if dates are in the past (don't prefill past dates)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(`${dateRange.startDate}T12:00:00`);

      if (startDate < today) {
        this.clearLastSelectedDateRange();
        return null;
      }

      // Check if dates are too old (> 30 days)
      const daysSinceStored = (Date.now() - dateRange.timestamp) / (1000 * 60 * 60 * 24);
      if (daysSinceStored > 30) {
        this.clearLastSelectedDateRange();
        return null;
      }

      return dateRange;
    } catch (error) {
      console.warn(`[BaseBookingModule] Failed to load date range for ${this.storageKey}:`, error);
      return null;
    }
  }

  /**
   * Clear stored date range
   */
  clearLastSelectedDateRange() {
    try {
      localStorage.removeItem(`lastSelectedDateRange_${this.storageKey}`);
    } catch {
      // Ignore errors - non-critical
    }
  }

  // ========== GUEST NAME UTILITIES ==========

  /**
   * Generate guest name inputs HTML
   * Delegates to GuestNameUtils
   * @param {Object} config - Configuration for guest inputs
   * @returns {string} HTML string
   */
  generateGuestNamesInputs(config) {
    if (window.GuestNameUtils) {
      return window.GuestNameUtils.generateInputsHTML(config);
    }
    console.warn('[BaseBookingModule] GuestNameUtils not available');
    return '';
  }

  /**
   * Collect guest names from form
   * Delegates to GuestNameUtils
   * @param {string} sectionId - ID of section containing guest inputs
   * @param {boolean} validate - Whether to validate names
   * @returns {Array} Array of guest name objects
   */
  collectGuestNames(sectionId, validate = true) {
    if (window.GuestNameUtils) {
      return window.GuestNameUtils.collectGuestNames(sectionId, validate);
    }
    console.warn('[BaseBookingModule] GuestNameUtils not available');
    return [];
  }

  // ========== PRICE CALCULATION HELPERS ==========

  /**
   * Calculate price for a booking configuration
   * Delegates to PriceCalculator
   * @param {Object} config - Price calculation configuration
   * @returns {number} Calculated price
   */
  calculatePrice(config) {
    if (window.PriceCalculator) {
      return PriceCalculator.calculatePrice(config);
    }
    console.error('[BaseBookingModule] PriceCalculator not available');
    return 0;
  }

  /**
   * Calculate per-guest price
   * Delegates to PriceCalculator
   * @param {Object} config - Price calculation configuration
   * @returns {number} Calculated price
   */
  calculatePerGuestPrice(config) {
    if (window.PriceCalculator) {
      return PriceCalculator.calculatePerGuestPrice(config);
    }
    console.error('[BaseBookingModule] PriceCalculator not available');
    return 0;
  }

  // ========== VALIDATION HELPERS ==========

  /**
   * Validate guest capacity
   * @param {Object} guests - Object with adults, children, toddlers
   * @param {number} maxCapacity - Maximum capacity
   * @returns {Object} { valid: boolean, error?: string }
   */
  validateGuestCapacity(guests, maxCapacity) {
    const totalGuests = (guests.adults || 0) + (guests.children || 0) + (guests.toddlers || 0);
    if (totalGuests > maxCapacity) {
      return {
        valid: false,
        error:
          this.app.currentLanguage === 'cs'
            ? `Maximální kapacita je ${maxCapacity} osob`
            : `Maximum capacity is ${maxCapacity} guests`,
      };
    }
    if (totalGuests === 0) {
      return {
        valid: false,
        error:
          this.app.currentLanguage === 'cs'
            ? 'Zadejte alespoň jednoho hosta'
            : 'Please enter at least one guest',
      };
    }
    return { valid: true };
  }

  /**
   * Validate date range
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @param {number} minNights - Minimum nights required
   * @returns {Object} { valid: boolean, error?: string }
   */
  validateDateRange(startDate, endDate, minNights = 1) {
    if (!startDate || !endDate) {
      return {
        valid: false,
        error: this.app.currentLanguage === 'cs' ? 'Vyberte termín pobytu' : 'Please select dates',
      };
    }

    const nights = DateUtils.getDaysBetween(startDate, endDate);
    if (nights < minNights) {
      return {
        valid: false,
        error:
          this.app.currentLanguage === 'cs'
            ? `Minimální délka pobytu je ${minNights} ${minNights === 1 ? 'noc' : 'nocí'}`
            : `Minimum stay is ${minNights} night${minNights === 1 ? '' : 's'}`,
      };
    }

    return { valid: true, nights };
  }

  // ========== NOTIFICATION HELPERS ==========

  /**
   * Show notification message
   * @param {string} message - Message to show
   * @param {string} type - Type: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duration in ms
   */
  showNotification(message, type = 'info', duration = 5000) {
    if (window.notificationManager) {
      window.notificationManager.show(message, type, duration);
    } else if (this.app && this.app.showNotification) {
      this.app.showNotification(message, type, duration);
    } else {
      console.warn(`[BaseBookingModule] Notification: ${type} - ${message}`);
    }
  }

  // ========== TRANSLATION HELPER ==========

  /**
   * Get translation string
   * @param {string} key - Translation key
   * @returns {string} Translated string
   */
  t(key) {
    if (this.app && this.app.t) {
      return this.app.t(key);
    }
    return key;
  }

  /**
   * Get current language
   * @returns {string} 'cs' or 'en'
   */
  get language() {
    return this.app?.currentLanguage || 'cs';
  }
}

// Export for browser
if (typeof window !== 'undefined') {
  window.BaseBookingModule = BaseBookingModule;
}
