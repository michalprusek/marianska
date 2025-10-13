// Data management layer - SERVER-FIRST with real-time sync
/* global IdGenerator, ChristmasUtils, PriceCalculator, AbortController */

class DataManager {
  constructor() {
    this.apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
    this.cachedData = null;
    this.storageKey = 'chataMarianska';
    this.syncInterval = null;
    this.lastSync = null;
    this.sessionId = this.getOrCreateSessionId();
    this.proposalId = null;
    this.proposedBookingsCache = null; // Cache for proposed bookings
    this.proposedBookingsCacheTime = null; // Timestamp of last cache
    this.proposedBookingsCacheDuration = 30000; // Cache for 30 seconds (matches auto-sync)
    this.proposedBookingsFetchPromise = null; // In-flight request promise
    this.lastRender = 0; // Track last calendar render for debouncing
    this.renderPending = false; // Prevent multiple pending renders
  }

  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('bookingSessionId');
    if (!sessionId) {
      // CRITICAL FIX 2025-10-07: Use IdGenerator (SSOT) instead of inline generation
      sessionId = IdGenerator.generateSessionId();
      sessionStorage.setItem('bookingSessionId', sessionId);
    }
    return sessionId;
  }

  // P2 FIX: Safe localStorage setter with error handling
  safeSetLocalStorage(key, data) {
    try {
      const jsonString = JSON.stringify(data);
      localStorage.setItem(key, jsonString);
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('[DataManager] LocalStorage quota exceeded - clearing old data');
        // Try to clear and retry once
        try {
          localStorage.clear();
          localStorage.setItem(key, JSON.stringify(data));
          return true;
        } catch (retryError) {
          console.error('[DataManager] LocalStorage unavailable:', retryError);
          return false;
        }
      } else {
        console.error('[DataManager] LocalStorage error:', error);
        return false;
      }
    }
  }

  async initData() {
    // Try to load from server FIRST
    try {
      const response = await fetch(`${this.apiUrl}/data`);
      if (response.ok) {
        this.cachedData = await response.json();
        this.lastSync = Date.now();
        // Save to localStorage as backup
        this.safeSetLocalStorage(this.storageKey, this.cachedData);

        // Start auto-sync
        this.startAutoSync();
        return;
      }
    } catch (error) {
      console.error('Server not available:', error);
    }

    // Fallback to localStorage if server is not available
    const savedData = localStorage.getItem(this.storageKey);
    if (savedData) {
      try {
        this.cachedData = JSON.parse(savedData);

        // Try to sync with server
        this.startAutoSync();
        return;
      } catch (error) {
        console.error('Error parsing localStorage data:', error);
      }
    }

    // Last resort - use default data
    this.cachedData = this.getDefaultData();
    localStorage.setItem(this.storageKey, JSON.stringify(this.cachedData));

    // Start sync attempts
    this.startAutoSync();
  }

  // Start automatic synchronization every 30 seconds (reduced from 5s to prevent rate limiting)
  startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 30 seconds (reduced from 5s to stay within rate limits)
    this.syncInterval = setInterval(async () => {
      await this.syncWithServer();
    }, 30000);

    // Also sync on visibility change
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        await this.syncWithServer();
      }
    });
  }

  async syncWithServer(forceRefresh = false) {
    try {
      // Get latest data from server
      const response = await fetch(`${this.apiUrl}/data`);
      if (response.ok) {
        const serverData = await response.json();

        if (forceRefresh) {
          // Force refresh - ignore timestamps
          this.cachedData = serverData;
          localStorage.setItem(this.storageKey, JSON.stringify(this.cachedData));

          // Trigger UI update
          if (window.app) {
            await window.app.renderCalendar();
            await window.app.updatePriceCalculation();
          }
        } else {
          // Check if server data is newer
          const serverTimestamp = this.getLatestTimestamp(serverData);
          const localTimestamp = this.getLatestTimestamp(this.cachedData);

          if (serverTimestamp > localTimestamp) {
            // Server has newer data - update local
            this.cachedData = serverData;
            localStorage.setItem(this.storageKey, JSON.stringify(this.cachedData));

            // Debounce calendar re-renders to prevent rate limiting
            // Only render if: no render pending AND at least 10 seconds since last render
            const now = Date.now();
            // eslint-disable-next-line max-depth -- Complex debouncing logic requires this nesting
            if (window.app && !this.renderPending && now - this.lastRender > 10000) {
              this.renderPending = true;
              // Delay render by 1 second to batch multiple sync events
              setTimeout(async () => {
                this.renderPending = false;
                this.lastRender = Date.now();
                await window.app.renderCalendar();
                await window.app.updatePriceCalculation();
              }, 1000);
            }

            // Update admin panel if active
            this.updateAdminPanelIfActive();
          } else if (localTimestamp > serverTimestamp) {
            // Local has newer data - push to server
            await this.pushToServer();
          }
        }

        this.lastSync = Date.now();
      }
    } catch {
      // Silently fail sync - will retry on next operation
    }
  }

  async updateAdminPanelIfActive() {
    if (window.adminPanel && document.querySelector('#bookingsTab')?.classList.contains('active')) {
      await window.adminPanel.loadBookings();
    }
  }

  getLatestTimestamp(data) {
    let latest = 0;

    // Check bookings
    if (data.bookings) {
      data.bookings.forEach((b) => {
        const updated = new Date(b.updatedAt || b.createdAt).getTime();
        if (updated > latest) {
          latest = updated;
        }
      });
    }

    // Check blocked dates
    if (data.blockedDates) {
      data.blockedDates.forEach((bd) => {
        const blocked = new Date(bd.blockedAt).getTime();
        if (blocked > latest) {
          latest = blocked;
        }
      });
    }

    return latest;
  }

  async pushToServer() {
    try {
      const response = await fetch(`${this.apiUrl}/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.cachedData),
      });
      if (!response.ok) {
        console.warn('Failed to push data to server');
      }
    } catch {
      // Silently fail push - will retry on next operation
    }
  }

  getDefaultData() {
    return {
      bookings: [],
      blockedDates: [],
      settings: {
        adminPassword: '', // Now using bcrypt hash on server
        christmasAccessCodes: ['XMAS2024'],
        christmasPeriod: {
          start: '2024-12-23',
          end: '2025-01-02',
        },
        emailSettings: {
          mockMode: true,
        },
        rooms: [
          { id: '12', name: 'Pokoj 12', type: 'small', beds: 2 },
          { id: '13', name: 'Pokoj 13', type: 'small', beds: 3 },
          { id: '14', name: 'Pokoj 14', type: 'large', beds: 4 },
          { id: '22', name: 'Pokoj 22', type: 'small', beds: 2 },
          { id: '23', name: 'Pokoj 23', type: 'small', beds: 3 },
          { id: '24', name: 'Pokoj 24', type: 'large', beds: 4 },
          { id: '42', name: 'Pokoj 42', type: 'small', beds: 2 },
          { id: '43', name: 'Pokoj 43', type: 'small', beds: 2 },
          { id: '44', name: 'Pokoj 44', type: 'large', beds: 4 },
        ],
        prices: {
          utia: { base: 298, adult: 49, child: 24 },
          external: { base: 499, adult: 99, child: 49 },
        },
        bulkPrices: {
          basePrice: 2000,
          utiaAdult: 100,
          utiaChild: 0,
          externalAdult: 250,
          externalChild: 50,
        },
      },
    };
  }

  async getData(forceRefresh = false) {
    if (!this.cachedData || forceRefresh) {
      await this.initData();
    }
    return this.cachedData;
  }

  async saveData(data) {
    this.cachedData = data;

    // Save to localStorage immediately
    localStorage.setItem(this.storageKey, JSON.stringify(data));

    // Try to save to server
    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      // SECURITY FIX: Use session token instead of API key
      const sessionToken = this.getSessionToken();
      if (sessionToken) {
        headers['x-session-token'] = sessionToken;
      }

      const response = await fetch(`${this.apiUrl}/data`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (response.ok) {
        return true;
      }

      // Handle non-OK responses
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error || `Server error: ${response.status} ${response.statusText}`;

      if (response.status === 401) {
        // Trigger auto-logout on session expiry
        this.handleUnauthorizedError();
        throw new Error('Neautorizovaný přístup - session vypršela. Přihlaste se prosím znovu.');
      } else if (response.status === 403) {
        throw new Error('Nemáte oprávnění k této operaci.');
      } else if (response.status >= 500) {
        throw new Error(`Chyba serveru: ${errorMessage}`);
      } else {
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to save to server:', error);
      // Re-throw the error so calling code knows it failed
      throw error;
    }
  }

  // Booking management
  async createBooking(bookingData) {
    // Try to use public /api/booking endpoint (no auth required)
    try {
      // P1 FIX: Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(`${this.apiUrl}/booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[DataManager] Server returned error:', {
          error: errorData,
          bookingData: {
            rooms: bookingData.rooms,
            startDate: bookingData.startDate,
            endDate: bookingData.endDate,
            sessionId: bookingData.sessionId,
          },
          timestamp: new Date().toISOString(),
        });
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      const { booking } = result;

      // SECURITY FIX: Force refresh from server instead of local update
      // This avoids triggering pushToServer() with no auth credentials
      await this.syncWithServer(true); // Force refresh

      return booking;
    } catch (error) {
      console.error('Error creating booking via API:', error);

      // P1 FIX: Handle timeout errors
      if (error.name === 'AbortError') {
        throw new Error('Požadavek vypršel - zkuste to prosím znovu');
      }

      // If server is completely unavailable, fall back to local-only mode
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        const booking = {
          ...bookingData,
          id: this.generateBookingId(),
          editToken: this.generateEditToken(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const data = await this.getData();
        data.bookings.push(booking);
        this.cachedData = data;
        localStorage.setItem(this.storageKey, JSON.stringify(data));

        return booking;
      }

      // Re-throw other errors (validation, conflicts, etc.)
      console.error('[DataManager] Re-throwing error:', error);
      throw error;
    }
  }

  async updateBooking(bookingId, updates) {
    const data = await this.getData();
    const index = data.bookings.findIndex((b) => b.id === bookingId);

    if (index === -1) {
      throw new Error('Rezervace nebyla nalezena');
    }

    data.bookings[index] = {
      ...data.bookings[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // saveData now throws on error - let it propagate
    await this.saveData(data);

    // Force immediate sync (silently fails if server unavailable)
    await this.syncWithServer();

    return data.bookings[index];
  }

  async deleteBooking(bookingId) {
    // Try server API first
    try {
      const headers = {};
      const sessionToken = this.getSessionToken();
      if (sessionToken) {
        headers['x-session-token'] = sessionToken;
      }

      const response = await fetch(`${this.apiUrl}/booking/${bookingId}`, {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        // Force refresh from server
        await this.syncWithServer(true);
        return true;
      }

      // Handle non-OK responses
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error || `Server error: ${response.status} ${response.statusText}`;

      if (response.status === 401) {
        // Trigger auto-logout on session expiry
        this.handleUnauthorizedError();
        throw new Error('Neautorizovaný přístup - session vypršela. Přihlaste se prosím znovu.');
      } else if (response.status === 404) {
        throw new Error('Rezervace nebyla nalezena');
      } else {
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error deleting booking via API:', error);

      // If server is completely unavailable, fall back to local deletion
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        console.warn('Server unavailable - deleting booking in offline mode');

        const data = await this.getData();
        const initialLength = data.bookings.length;
        data.bookings = data.bookings.filter((b) => b.id !== bookingId);

        if (data.bookings.length < initialLength) {
          this.cachedData = data;
          localStorage.setItem(this.storageKey, JSON.stringify(data));
          return true;
        }

        throw new Error('Rezervace nebyla nalezena');
      }

      // Re-throw other errors
      throw error;
    }
  }

  async getBooking(bookingId) {
    const data = await this.getData();
    return data.bookings.find((b) => b.id === bookingId);
  }

  async getBookingByEditToken(token) {
    const data = await this.getData();
    return data.bookings.find((b) => b.editToken === token);
  }

  async getAllBookings() {
    const data = await this.getData();
    return data.bookings;
  }

  async getBookingsForDateRange(startDate, endDate) {
    const data = await this.getData();
    return data.bookings.filter((booking) => {
      const bookingStart = new Date(booking.startDate);
      const bookingEnd = new Date(booking.endDate);
      return bookingStart <= endDate && bookingEnd >= startDate;
    });
  }

  async getBookingForRoom(date, roomId) {
    const data = await this.getData();
    const dateStr = this.formatDate(date);

    return data.bookings.find((booking) => {
      // Convert booking dates to Date objects for proper comparison
      const bookingStart = new Date(booking.startDate);
      const bookingEnd = new Date(booking.endDate);
      const checkDate = new Date(dateStr);

      return booking.rooms.includes(roomId) && checkDate >= bookingStart && checkDate < bookingEnd;
    });
  }

  async getRoomAvailability(date, roomId, excludeSessionId = null, excludeBookingId = null) {
    const data = await this.getData();
    const dateStr = this.formatDate(date);

    // Check blockage instances (NEW structure - priority)
    if (data.blockageInstances && data.blockageInstances.length > 0) {
      const isBlocked = data.blockageInstances.some((blockage) => {
        // Check if date is within blockage range
        const isInRange = dateStr >= blockage.startDate && dateStr <= blockage.endDate;
        if (!isInRange) {
          return false;
        }

        // If no rooms specified, all rooms are blocked
        if (!blockage.rooms || blockage.rooms.length === 0) {
          return true;
        }

        // Check if specific room is blocked
        return blockage.rooms.includes(roomId);
      });

      if (isBlocked) {
        return { status: 'blocked', email: null };
      }
    }

    // Check legacy blocked dates (backward compatibility)
    if (
      data.blockedDates &&
      data.blockedDates.some((bd) => bd.date === dateStr && (!bd.roomId || bd.roomId === roomId))
    ) {
      return { status: 'blocked', email: null };
    }

    // NIGHT-BASED LOGIC:
    // Edge day = exactly ONE night around the day is occupied
    // Occupied day = BOTH nights around the day are occupied
    // Available day = NO nights around the day are occupied
    const checkDateStr = this.formatDate(date);

    // HIGHEST PRIORITY: Check for proposed bookings first
    try {
      const proposedBookings = await this.getProposedBookings();
      const shouldExcludeSession = excludeSessionId === undefined;
      const sessionToExclude = shouldExcludeSession ? this.sessionId : excludeSessionId;

      const hasProposedBooking = proposedBookings.some(
        (pb) =>
          pb.rooms.includes(roomId) &&
          checkDateStr >= pb.start_date &&
          checkDateStr <= pb.end_date && // INCLUSIVE end date for proposed bookings - blocks checkout day
          (sessionToExclude === '' || pb.session_id !== sessionToExclude)
      );

      if (hasProposedBooking) {
        return { status: 'proposed', email: null };
      }
    } catch (error) {
      console.error('Failed to check proposed bookings:', error);
    }

    // Get all bookings for this room, EXCLUDING the booking being edited
    // CRITICAL: Use per-room dates if available, otherwise fall back to global dates
    const roomBookings = data.bookings
      .filter((booking) => booking.rooms.includes(roomId))
      .filter((booking) => !excludeBookingId || booking.id !== excludeBookingId)
      .map((b) => {
        // Check for per-room dates first (new format)
        const perRoomDate = b.perRoomDates?.[roomId];
        if (perRoomDate) {
          return {
            startDate: perRoomDate.startDate,
            endDate: perRoomDate.endDate,
            email: b.email,
          };
        }
        // Fallback to global dates (legacy format)
        return { startDate: b.startDate, endDate: b.endDate, email: b.email };
      });

    // Calculate nights around the given day using DateUtils
    const nightBefore = DateUtils.getPreviousDay(checkDateStr); // night from (day-1) to day
    const nightAfter = checkDateStr; // night from day to (day+1)

    let nightBeforeOccupied = false;
    let nightAfterOccupied = false;
    let bookingEmail = null;

    // Check if each night is occupied by any booking
    for (const booking of roomBookings) {
      // Night is occupied if nightDate >= bookingStart AND nightDate < bookingEnd
      if (DateUtils.isNightOccupied(nightBefore, booking.startDate, booking.endDate)) {
        nightBeforeOccupied = true;
        bookingEmail = booking.email;
      }
      if (DateUtils.isNightOccupied(nightAfter, booking.startDate, booking.endDate)) {
        nightAfterOccupied = true;
        bookingEmail = booking.email;
      }
    }

    const occupiedCount = (nightBeforeOccupied ? 1 : 0) + (nightAfterOccupied ? 1 : 0);

    // Determine status based on occupied night count
    if (occupiedCount === 0) {
      return { status: 'available', email: null };
    } else if (occupiedCount === 1) {
      return {
        status: 'edge',
        email: bookingEmail || null,
        nightBefore: nightBeforeOccupied,
        nightAfter: nightAfterOccupied,
      };
    }
    // Both nights occupied = fully occupied
    return {
      status: 'occupied',
      email: bookingEmail || null,
    };
  }

  // Generate color from email for consistent coloring
  getColorForEmail(email) {
    if (!email) {
      return '#FF3B30';
    }

    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FECA57',
      '#DDA0DD',
      '#98D8C8',
      '#FFB6C1',
      '#87CEEB',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1E2',
      '#F8B739',
      '#82E0AA',
      '#F1948A',
    ];

    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  // Christmas period rules
  // Delegate to ChristmasUtils for SSOT compliance
  async isChristmasPeriod(date) {
    const settings = await this.getSettings();
    return ChristmasUtils.isChristmasPeriod(date, settings);
  }

  /**
   * Check if Christmas access code is required and if bulk booking is allowed
   * Delegates to ChristmasUtils for SSOT compliance
   *
   * @param {Date|string} christmasPeriodStart - First day of Christmas period
   * @param {boolean} isBulkBooking - Whether this is a bulk booking
   * @returns {Object} { codeRequired: boolean, bulkBlocked: boolean }
   */
  checkChristmasAccessRequirement(christmasPeriodStart, isBulkBooking = false) {
    const today = new Date();
    return ChristmasUtils.checkChristmasAccessRequirement(
      today,
      christmasPeriodStart,
      isBulkBooking
    );
  }

  requiresChristmasCode(startDate) {
    // Deprecated - use checkChristmasAccessRequirement instead
    const { codeRequired } = this.checkChristmasAccessRequirement(startDate, false);
    return codeRequired;
  }

  /**
   * @deprecated REMOVED 2025-10-05 - Unused method with inverted logic (off-by-one date error).
   * Use ChristmasUtils.checkChristmasAccessRequirement() instead.
   * This method had incorrect logic (Oct 1 vs Sept 30) and was never called in the codebase.
   */

  /**
   * @deprecated REMOVED 2025-10-05 - Redundant validation logic.
   * Use ChristmasUtils.validateChristmasCode() and ChristmasUtils.checkChristmasAccessRequirement() instead.
   * This method duplicated validation that is now centralized in ChristmasUtils.
   */

  async getChristmasBookings() {
    const data = await this.getData();
    const checkPromises = data.bookings.map(async (booking) => {
      const startDate = new Date(booking.startDate);
      const isChristmas = await this.isChristmasPeriod(startDate);
      return isChristmas ? booking : null;
    });
    const results = await Promise.all(checkPromises);
    return results.filter((booking) => booking !== null);
  }

  // Blockage management - NEW STRUCTURE
  async createBlockageInstance(startDate, endDate, rooms = [], reason = '') {
    const blockageId = this.generateBlockageId();
    const blockageData = {
      blockageId,
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      rooms, // Empty array = all rooms blocked
      reason,
      createdAt: new Date().toISOString(),
    };

    // Send to server - use session token for auth
    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      const sessionToken = this.getSessionToken();
      if (sessionToken) {
        headers['x-session-token'] = sessionToken;
      }

      const response = await fetch(`${this.apiUrl}/blockage`, {
        method: 'POST',
        headers,
        body: JSON.stringify(blockageData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `Server error: ${response.status} ${response.statusText}`;

        if (response.status === 401) {
          this.handleUnauthorizedError();
          throw new Error('Neautorizovaný přístup - session vypršela. Přihlaste se prosím znovu.');
        } else if (response.status === 403) {
          throw new Error('Nemáte oprávnění k této operaci.');
        } else {
          throw new Error(errorMessage);
        }
      }

      // Success - update local cache
      const data = await this.getData();
      if (!data.blockageInstances) {
        data.blockageInstances = [];
      }
      data.blockageInstances.push(blockageData);
      this.cachedData = data;
      localStorage.setItem(this.storageKey, JSON.stringify(data));

      return blockageId;
    } catch (error) {
      console.error('Failed to create blockage:', error);
      // Re-throw the error so admin panel can show proper error message
      throw error;
    }
  }

  async deleteBlockageInstance(blockageId) {
    // Delete from server - use session token for auth
    try {
      const headers = {};
      const sessionToken = this.getSessionToken();
      if (sessionToken) {
        headers['x-session-token'] = sessionToken;
      }

      const response = await fetch(`${this.apiUrl}/blockage/${blockageId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `Server error: ${response.status} ${response.statusText}`;

        if (response.status === 401) {
          this.handleUnauthorizedError();
          throw new Error('Neautorizovaný přístup - session vypršela. Přihlaste se prosím znovu.');
        } else if (response.status === 404) {
          throw new Error('Blokace nebyla nalezena');
        } else {
          throw new Error(errorMessage);
        }
      }

      // Success - update local cache
      const data = await this.getData();
      if (data.blockageInstances) {
        data.blockageInstances = data.blockageInstances.filter((b) => b.blockageId !== blockageId);
      }
      this.cachedData = data;
      localStorage.setItem(this.storageKey, JSON.stringify(data));

      return true;
    } catch (error) {
      console.error('Failed to delete blockage:', error);
      // Re-throw the error so admin panel can show proper error message
      throw error;
    }
  }

  async getAllBlockageInstances() {
    const data = await this.getData();
    return data.blockageInstances || [];
  }

  /**
   * @deprecated Use IdGenerator.generateBlockageId() directly instead.
   * This wrapper exists for backward compatibility only.
   */
  generateBlockageId() {
    return IdGenerator.generateBlockageId();
  }

  // Legacy methods for backward compatibility
  async blockDate(date, roomId = null, reason = '', blockageId = null) {
    const data = await this.getData();
    const blockedDate = {
      date: this.formatDate(date),
      roomId,
      reason,
      blockageId: blockageId || this.generateBlockageId(),
      blockedAt: new Date().toISOString(),
    };

    if (!data.blockedDates) {
      data.blockedDates = [];
    }

    data.blockedDates.push(blockedDate);
    await this.saveData(data);
    await this.syncWithServer();
    return blockedDate.blockageId;
  }

  async unblockDate(date, roomId = null) {
    const data = await this.getData();
    const dateStr = this.formatDate(date);
    if (data.blockedDates) {
      data.blockedDates = data.blockedDates.filter(
        (bd) => !(bd.date === dateStr && bd.roomId === roomId)
      );
    }
    await this.saveData(data);
    await this.syncWithServer();
  }

  async getBlockedDates() {
    const data = await this.getData();
    return data.blockedDates || [];
  }

  async getBlockedDateDetails(date, roomId) {
    const data = await this.getData();
    const dateStr = this.formatDate(date);

    // Check blockage instances first (NEW structure with reasons and date ranges)
    if (data.blockageInstances && data.blockageInstances.length > 0) {
      const blockage = data.blockageInstances.find((b) => {
        // Check if date is within blockage range
        const isInRange = dateStr >= b.startDate && dateStr <= b.endDate;
        if (!isInRange) {
          return false;
        }

        // If no rooms specified, all rooms are blocked
        if (!b.rooms || b.rooms.length === 0) {
          return true;
        }

        // Check if specific room is blocked
        return b.rooms.includes(roomId);
      });

      if (blockage) {
        return {
          reason: blockage.reason || 'Administrativně blokováno',
          blockageId: blockage.blockageId,
          startDate: blockage.startDate,
          endDate: blockage.endDate,
        };
      }
    }

    // Fallback to legacy blockedDates (backward compatibility)
    if (data.blockedDates) {
      const blocked = data.blockedDates.find(
        (bd) => bd.date === dateStr && (!bd.roomId || bd.roomId === roomId)
      );

      if (blocked) {
        return {
          reason: blocked.reason || 'Administrativně blokováno',
          date: blocked.date,
        };
      }
    }

    return null;
  }

  // Settings management
  async updateSettings(settings) {
    const data = await this.getData();
    data.settings = { ...data.settings, ...settings };
    await this.saveData(data);
    await this.syncWithServer();
  }

  async getSettings() {
    const data = await this.getData();
    return data.settings;
  }

  // Admin authentication - now using server API
  async authenticateAdmin(password) {
    try {
      const response = await fetch(`${this.apiUrl}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        // Store API key for backward compatibility
        if (data.apiKey) {
          sessionStorage.setItem('apiKey', data.apiKey);
        }
        // Return full response object (includes sessionToken, expiresAt, success)
        return data;
      }
      return { success: false };
    } catch (error) {
      console.error('Authentication error:', error);
      // Fallback to local check for backward compatibility
      const data = await this.getData();
      // Check if password field exists (old format)
      if (data.settings.adminPassword) {
        const isValid = data.settings.adminPassword === password;
        return { success: isValid };
      }
      return { success: false };
    }
  }

  // Get API key from session
  // Removed: getApiKey() - deprecated method, use getSessionToken() instead

  getSessionToken() {
    return localStorage.getItem('adminSessionToken');
  }

  // Handle 401 errors by triggering admin logout
  handleUnauthorizedError() {
    // Clear session data (changed to localStorage for persistence)
    localStorage.removeItem('adminSessionToken');
    localStorage.removeItem('adminSessionExpiry');

    // Trigger admin panel logout if available
    if (window.adminPanel && typeof window.adminPanel.logout === 'function') {
      window.adminPanel.logout();
    }

    // Show error message
    if (window.adminPanel && typeof window.adminPanel.showErrorMessage === 'function') {
      window.adminPanel.showErrorMessage('Session vypršela - přihlaste se prosím znovu');
    }
  }

  // Utility functions
  /**
   * @deprecated Use IdGenerator.generateBookingId() directly instead.
   * This wrapper adds no value and will be removed in a future version.
   */
  generateBookingId() {
    return IdGenerator.generateBookingId();
  }

  /**
   * @deprecated Use IdGenerator.generateEditToken() directly instead.
   * This wrapper adds no value and will be removed in a future version.
   */
  generateEditToken() {
    return IdGenerator.generateEditToken();
  }

  /**
   * @deprecated Use DateUtils.formatDate() directly instead.
   * This wrapper adds unnecessary complexity and will be removed in a future version.
   */
  formatDate(date) {
    // Delegate to DateUtils for SSOT (if available in browser context)
    if (typeof DateUtils !== 'undefined') {
      return DateUtils.formatDate(date);
    }
    // Fallback for environments where DateUtils is not loaded
    // If string in YYYY-MM-DD format, return as is
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/u)) {
      return date;
    }
    const d = typeof date === 'string' ? new Date(`${date}T12:00:00`) : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Proposed booking methods

  // Get proposed bookings with caching to avoid rate limits
  getProposedBookings() {
    const now = Date.now();

    // Return cached data if still valid
    if (
      this.proposedBookingsCache &&
      this.proposedBookingsCacheTime &&
      now - this.proposedBookingsCacheTime < this.proposedBookingsCacheDuration
    ) {
      return this.proposedBookingsCache;
    }

    // If a fetch is already in progress, wait for it instead of starting a new one
    if (this.proposedBookingsFetchPromise) {
      return this.proposedBookingsFetchPromise;
    }

    // Fetch fresh data
    this.proposedBookingsFetchPromise = (async () => {
      try {
        const response = await fetch(`${this.apiUrl}/proposed-bookings`);
        if (response.ok) {
          this.proposedBookingsCache = await response.json();
          this.proposedBookingsCacheTime = Date.now();
          return this.proposedBookingsCache;
        }
      } catch (error) {
        console.error('Error fetching proposed bookings:', error);
      } finally {
        // Clear the in-flight promise
        this.proposedBookingsFetchPromise = null;
      }

      // Return empty array on error, or use stale cache if available
      return this.proposedBookingsCache || [];
    })();

    return this.proposedBookingsFetchPromise;
  }

  // Invalidate proposed bookings cache
  invalidateProposedBookingsCache() {
    this.proposedBookingsCache = null;
    this.proposedBookingsCacheTime = null;
  }

  async createProposedBooking(
    startDate,
    endDate,
    rooms,
    guests = {},
    guestType = 'external',
    totalPrice = 0
  ) {
    try {
      const response = await fetch(`${this.apiUrl}/proposed-bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          startDate,
          endDate,
          rooms,
          guests,
          guestType,
          totalPrice,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.proposalId = data.proposalId;

        // Update cache in-place instead of invalidating (prevents immediate re-fetch)
        if (this.proposedBookingsCache && Array.isArray(this.proposedBookingsCache)) {
          // Add new proposal to cache
          this.proposedBookingsCache.push({
            proposal_id: data.proposalId,
            session_id: this.sessionId,
            start_date: startDate,
            end_date: endDate,
            rooms,
            created_at: new Date().toISOString(),
          });
          // Refresh cache timestamp to keep it valid
          this.proposedBookingsCacheTime = Date.now();
        }

        return data.proposalId;
      }
    } catch (error) {
      console.error('Error creating proposed booking:', error);
    }
    return null;
  }

  async deleteProposedBooking(proposalId) {
    try {
      const response = await fetch(`${this.apiUrl}/proposed-booking/${proposalId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (this.proposalId === proposalId) {
          this.proposalId = null;
        }

        // Update cache in-place instead of invalidating (prevents immediate re-fetch)
        if (this.proposedBookingsCache && Array.isArray(this.proposedBookingsCache)) {
          // Remove deleted proposal from cache
          this.proposedBookingsCache = this.proposedBookingsCache.filter(
            (pb) => pb.proposal_id !== proposalId
          );
          // Refresh cache timestamp to keep it valid
          this.proposedBookingsCacheTime = Date.now();
        }

        return true;
      }
    } catch (error) {
      console.error('Error deleting proposed booking:', error);
    }
    return false;
  }

  async clearSessionProposedBookings() {
    try {
      const response = await fetch(`${this.apiUrl}/proposed-bookings/session/${this.sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        this.proposalId = null;
        return true;
      }
    } catch (error) {
      console.error('Error clearing session proposed bookings:', error);
    }
    return false;
  }

  // Price calculation
  // Delegate to PriceCalculator for SSOT compliance
  // eslint-disable-next-line max-params -- Legacy method signature maintained for backward compatibility
  calculatePrice(guestType, adults, children, toddlers, nights, roomsCount = 1) {
    const options = { guestType, adults, children, toddlers, nights, roomsCount };
    return this.calculatePriceFromOptions(options);
  }

  async calculatePriceFromOptions({
    guestType,
    adults,
    children,
    toddlers,
    nights,
    roomsCount = 1,
  }) {
    const settings = await this.getSettings();
    return PriceCalculator.calculatePrice({
      guestType,
      adults,
      children,
      toddlers,
      nights,
      roomsCount,
      settings,
    });
  }

  // Get room configuration
  async getRooms() {
    const settings = await this.getSettings();
    const data = await this.getData();
    return settings.rooms || data.rooms || this.getDefaultData().settings.rooms;
  }

  // Mock email service
  sendEmail(to, subject, body) {
    console.info('=== MOCK EMAIL ===');
    console.info('To:', to);
    console.info('Subject:', subject);
    console.info('Body:', body);
    console.info('==================');

    const emails = JSON.parse(localStorage.getItem('mockEmails') || '[]');
    emails.push({
      to,
      subject,
      body,
      sentAt: new Date().toISOString(),
    });
    localStorage.setItem('mockEmails', JSON.stringify(emails));

    return true;
  }

  async sendBookingConfirmation(booking) {
    const editUrl = `${window.location.origin}/edit.html?token=${booking.editToken}`;
    const settings = await this.getSettings();
    const emailSettings = settings.emailTemplate || {};

    const subject = emailSettings.subject
      ? emailSettings.subject.replace('{booking_id}', booking.id)
      : `Potvrzení rezervace - ${booking.id}`;

    let body =
      emailSettings.template ||
      `Dobrý den {name},

děkujeme za Vaši rezervaci v chatě Mariánská.

DETAIL REZERVACE:
================
Číslo rezervace: {booking_id}
Datum příjezdu: {start_date}
Datum odjezdu: {end_date}
Pokoje: {rooms}
Počet hostů: {adults} dospělých, {children} dětí, {toddlers} batolat
Celková cena: {total_price} Kč

Pro úpravu nebo zrušení rezervace použijte tento odkaz:
{edit_url}

S pozdravem,
Chata Mariánská`;

    const startDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);

    body = body
      .replace(/\{booking_id\}/gu, booking.id)
      .replace(/\{name\}/gu, booking.name)
      .replace(/\{start_date\}/gu, startDate.toLocaleDateString('cs-CZ'))
      .replace(/\{end_date\}/gu, endDate.toLocaleDateString('cs-CZ'))
      .replace(/\{rooms\}/gu, booking.rooms.join(', '))
      .replace(/\{total_price\}/gu, booking.totalPrice)
      .replace(/\{adults\}/gu, booking.adults)
      .replace(/\{children\}/gu, booking.children)
      .replace(/\{toddlers\}/gu, booking.toddlers)
      .replace(/\{edit_url\}/gu, editUrl);

    return this.sendEmail(booking.email, subject, body);
  }

  async sendContactMessage(bookingId, fromEmail, message) {
    const booking = await this.getBooking(bookingId);
    if (!booking) {
      return false;
    }

    const subject = `Zpráva ohledně rezervace ${bookingId}`;
    const body = `
            Dobrý den,

            Obdrželi jste zprávu ohledně vaší rezervace ${bookingId}.

            Od: ${fromEmail}
            Zpráva:
            ${message}

            Odpovědět můžete přímo na email: ${fromEmail}

            S pozdravem,
            Chata Mariánská
        `;

    return this.sendEmail(booking.email, subject, body);
  }

  // Token-based update and delete methods for user self-service
  async updateBookingWithToken(bookingId, updates, editToken) {
    // First verify the token
    const booking = await this.getBooking(bookingId);
    if (!booking || booking.editToken !== editToken) {
      throw new Error('Neplatný edit token');
    }

    // Use the regular update method
    return this.updateBooking(bookingId, updates);
  }

  async deleteBookingWithToken(bookingId, editToken) {
    // First verify the token
    const booking = await this.getBooking(bookingId);
    if (!booking || booking.editToken !== editToken) {
      throw new Error('Neplatný edit token');
    }

    // Use the regular delete method
    return this.deleteBooking(bookingId);
  }

  // Cleanup
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

// Create and export instance

const dataManager = new DataManager();
