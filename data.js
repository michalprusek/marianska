// Data management layer - SERVER-FIRST with real-time sync
/* global IdGenerator, ChristmasUtils, PriceCalculator, AbortController */

class DataManager {
  constructor() {
    this.apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
    this.cachedData = null;
    // REMOVED 2025-12-03: localStorage fallback (storageKey) - server is required
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
    this.visibilityHandler = null; // Store handler reference to prevent memory leak
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

  // Helper method for fetch with timeout (prevents hanging requests)
  async fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  // REMOVED 2025-12-03: safeSetLocalStorage() - no longer storing data to localStorage

  async initData() {
    // 2025-12-03: Server is REQUIRED - no localStorage fallback
    // Load from server with 10s timeout
    try {
      const response = await this.fetchWithTimeout(`${this.apiUrl}/data`);
      if (response.ok) {
        this.cachedData = await response.json();
        this.lastSync = Date.now();
        // Start auto-sync
        this.startAutoSync();
        return;
      }
      // Server responded but not OK
      throw new Error(`Server returned status ${response.status}`);
    } catch (error) {
      console.error('[DataManager] Server not available:', error);
      // Show user-friendly error message
      this.showServerUnavailableError();
      // Use empty default data to prevent complete failure
      this.cachedData = this.getDefaultData();
      // Start sync attempts to recover when server comes back
      this.startAutoSync();
    }
  }

  /**
   * Show error message when server is unavailable
   * 2025-12-03: Added as part of localStorage removal
   */
  showServerUnavailableError() {
    // Check if error already shown to prevent duplicate messages
    if (document.getElementById('server-unavailable-error')) {
      return;
    }
    const errorDiv = document.createElement('div');
    errorDiv.id = 'server-unavailable-error';
    errorDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #dc2626;
      color: white;
      padding: 1rem;
      text-align: center;
      z-index: 10000;
      font-weight: 600;
    `;
    errorDiv.innerHTML = `
      ⚠️ Server není dostupný. Rezervační systém vyžaduje připojení k serveru.
      <button onclick="location.reload()" style="margin-left: 1rem; padding: 0.25rem 0.75rem; cursor: pointer;">
        Zkusit znovu
      </button>
    `;
    document.body.prepend(errorDiv);
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

    // Remove old visibility handler if exists (prevents memory leak)
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }

    // Create new visibility handler and store reference
    this.visibilityHandler = async () => {
      if (!document.hidden) {
        await this.syncWithServer();
      }
    };

    // Also sync on visibility change
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  async syncWithServer(forceRefresh = false) {
    try {
      // Get latest data from server (with 10s timeout)
      const response = await this.fetchWithTimeout(`${this.apiUrl}/data`);
      if (response.ok) {
        const serverData = await response.json();

        if (forceRefresh) {
          // Force refresh - ignore timestamps
          this.cachedData = serverData;
          // REMOVED 2025-12-03: localStorage backup - server is source of truth

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
            // REMOVED 2025-12-03: localStorage backup - server is source of truth

            // Debounce calendar re-renders to prevent rate limiting
            // Only render if: no render pending AND at least 10 seconds since last render
            const now = Date.now();
            // eslint-disable-next-line max-depth -- Complex debouncing logic requires this nesting
            if (window.app && !this.renderPending && now - this.lastRender > 10000) {
              this.renderPending = true;
              // Delay render by 1 second to batch multiple sync events
              setTimeout(async () => {
                try {
                  this.renderPending = false;
                  this.lastRender = Date.now();
                  await window.app.renderCalendar();
                  await window.app.updatePriceCalculation();
                } catch (error) {
                  console.error('[DataManager] Calendar render failed:', error);
                }
              }, 1000);
            }

            // Update admin panel if active
            this.updateAdminPanelIfActive();
          }
          // NOTE: Removed pushToServer() call - requires admin auth and is not needed for normal operation
          // Admin panel uses direct API calls with session token instead
        }

        this.lastSync = Date.now();
      }
    } catch (error) {
      // Log sync failures for debugging - will retry on next operation
      console.warn('[DataManager] Sync with server failed:', error.message || error);
      this.syncFailureCount = (this.syncFailureCount || 0) + 1;
      // After 3 consecutive failures, log more detailed warning
      if (this.syncFailureCount >= 3 && this.syncFailureCount % 3 === 0) {
        console.error('[DataManager] Multiple sync failures detected - data may be stale');
      }
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
    } catch (error) {
      // Log push failures for debugging - will retry on next operation
      console.warn('[DataManager] Push to server failed:', error.message || error);
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
        // NEW (2025-10-17): Room-size-based pricing
        prices: {
          utia: {
            small: { base: 300, adult: 50, child: 25 },
            large: { base: 400, adult: 50, child: 25 },
          },
          external: {
            small: { base: 500, adult: 100, child: 50 },
            large: { base: 600, adult: 100, child: 50 },
          },
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

        // Handle rate limiting specifically - always use server's message
        if (response.status === 429) {
          throw new Error(
            errorData.error ||
              errorData.message ||
              'Překročili jste limit. Zkuste to prosím později.'
          );
        }

        throw new Error(errorData.error || errorData.message || `Server error: ${response.status}`);
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
          id: IdGenerator.generateBookingId(),
          editToken: IdGenerator.generateEditToken(),
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

    // Calculate nights around the given day for proposed bookings check
    const nightBefore = DateUtils.getPreviousDay(checkDateStr); // night from (day-1) to day
    const nightAfter = checkDateStr; // night from day to (day+1)

    // Check BOTH proposed and confirmed bookings to support mixed edge days
    // (one night proposed, other night confirmed)
    let proposedNightBeforeOccupied = false;
    let proposedNightAfterOccupied = false;

    // HIGHEST PRIORITY: Check for proposed bookings using NIGHT-BASED MODEL
    try {
      const proposedBookings = await this.getProposedBookings();
      const shouldExcludeSession = excludeSessionId === undefined;
      const sessionToExclude = shouldExcludeSession ? this.sessionId : excludeSessionId;

      // Filter proposed bookings for this room (excluding own session)
      const relevantProposals = proposedBookings.filter(
        (pb) =>
          pb.rooms.includes(roomId) &&
          (sessionToExclude === '' || pb.session_id !== sessionToExclude)
      );

      // Check if nights are occupied by proposed bookings
      for (const pb of relevantProposals) {
        // Night is occupied if nightDate >= proposalStart AND nightDate < proposalEnd
        if (DateUtils.isNightOccupied(nightBefore, pb.start_date, pb.end_date)) {
          proposedNightBeforeOccupied = true;
        }
        if (DateUtils.isNightOccupied(nightAfter, pb.start_date, pb.end_date)) {
          proposedNightAfterOccupied = true;
        }
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

    // nightBefore and nightAfter already calculated above (for proposed bookings check)
    // Reuse the same values for confirmed bookings check

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

    // Combine proposed and confirmed night occupancy
    // Priority: proposed > confirmed (if both occupy same night, show as proposed)
    const totalNightBeforeOccupied = proposedNightBeforeOccupied || nightBeforeOccupied;
    const totalNightAfterOccupied = proposedNightAfterOccupied || nightAfterOccupied;
    const totalOccupiedCount =
      (totalNightBeforeOccupied ? 1 : 0) + (totalNightAfterOccupied ? 1 : 0);

    // Determine night types for detailed rendering
    const nightBeforeType = proposedNightBeforeOccupied
      ? 'proposed'
      : nightBeforeOccupied
        ? 'confirmed'
        : 'available';
    const nightAfterType = proposedNightAfterOccupied
      ? 'proposed'
      : nightAfterOccupied
        ? 'confirmed'
        : 'available';

    // Determine status based on total occupied night count
    if (totalOccupiedCount === 0) {
      return { status: 'available', email: null };
    } else if (totalOccupiedCount === 2) {
      // Both nights occupied
      // Special case: If one is proposed and one is confirmed, treat as 'edge' for mixed display
      const isMixed =
        (proposedNightBeforeOccupied && nightBeforeOccupied === false && nightAfterOccupied) ||
        (proposedNightAfterOccupied && nightAfterOccupied === false && nightBeforeOccupied);

      if (isMixed) {
        // Mixed: one proposed, one confirmed = edge day with both colors
        return {
          status: 'edge',
          email: bookingEmail || null,
          nightBefore: totalNightBeforeOccupied,
          nightAfter: totalNightAfterOccupied,
          nightBeforeType,
          nightAfterType,
          isMixed: true, // Flag for special rendering
        };
      }

      // If BOTH are proposed, return 'proposed' status (solid orange)
      if (proposedNightBeforeOccupied && proposedNightAfterOccupied) {
        return { status: 'proposed', email: null };
      }

      // Otherwise return 'occupied' (solid red) - both are confirmed
      return {
        status: 'occupied',
        email: bookingEmail || null,
      };
    } else if (totalOccupiedCount === 1) {
      // Exactly one night occupied = edge day
      return {
        status: 'edge',
        email: bookingEmail || null,
        nightBefore: totalNightBeforeOccupied,
        nightAfter: totalNightAfterOccupied,
        nightBeforeType,
        nightAfterType,
      };
    }

    // Fallback (should never reach here)
    return { status: 'available', email: null };
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

  // Blockage management - NEW STRUCTURE
  async createBlockageInstance(startDate, endDate, rooms = [], reason = '') {
    const blockageId = IdGenerator.generateBlockageId();
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

  // Legacy methods for backward compatibility
  async blockDate(date, roomId = null, reason = '', blockageId = null) {
    const data = await this.getData();
    const blockedDate = {
      date: this.formatDate(date),
      roomId,
      reason,
      blockageId: blockageId || IdGenerator.generateBlockageId(),
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
      // Log server error response for debugging
      const errorData = await response.json().catch(() => ({}));
      console.error('[DataManager] Server rejected proposed booking:', response.status, errorData);
    } catch (error) {
      // Log with more detail for debugging
      const errorType = error.name === 'AbortError' ? 'timeout' : 'network';
      console.error(
        `[DataManager] Error creating proposed booking (${errorType}):`,
        error.message || error
      );
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
      console.warn('[DataManager] Server rejected delete proposed booking:', response.status);
    } catch (error) {
      const errorType = error.name === 'AbortError' ? 'timeout' : 'network';
      console.error(
        `[DataManager] Error deleting proposed booking (${errorType}):`,
        error.message || error
      );
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
      console.warn('[DataManager] Server rejected clear session proposals:', response.status);
    } catch (error) {
      const errorType = error.name === 'AbortError' ? 'timeout' : 'network';
      console.error(
        `[DataManager] Error clearing session proposed bookings (${errorType}):`,
        error.message || error
      );
    }
    return false;
  }

  // Price calculation
  // Delegate to PriceCalculator for SSOT compliance
  // eslint-disable-next-line max-params -- Legacy method signature maintained for backward compatibility
  calculatePrice(guestType, adults, children, toddlers, nights, roomsCountOrRooms = 1) {
    // FIX 2025-10-17: Support both old API (roomsCount) and new API (rooms array)
    let rooms = [];
    if (Array.isArray(roomsCountOrRooms)) {
      // New API: rooms array passed directly
      rooms = roomsCountOrRooms;
    } else {
      // Old API: roomsCount number - cannot determine room sizes, use default
      // This means price calculation will use legacy flat pricing model
      rooms = [];
    }

    return this.calculatePriceFromOptions({ guestType, adults, children, toddlers, nights, rooms });
  }

  async calculatePriceFromOptions({ guestType, adults, children, toddlers, nights, rooms = [] }) {
    const settings = await this.getSettings();
    return PriceCalculator.calculatePrice({
      guestType,
      adults,
      children,
      toddlers,
      nights,
      rooms, // Pass rooms array for room-size-based pricing
      settings,
    });
  }

  // Get room configuration
  async getRooms() {
    const settings = await this.getSettings();
    const data = await this.getData();
    return settings.rooms || data.rooms || this.getDefaultData().settings.rooms;
  }

  // REMOVED 2025-12-03: Mock email service (sendEmail, sendBookingConfirmation)
  // - Used mockEmails localStorage which exposed data in DevTools
  // - Real email sending is handled by js/shared/emailService.js on server
  // - Server calls EmailService.sendBookingConfirmation() in POST /api/booking

  async sendContactMessage(bookingId, fromEmail, message) {
    try {
      const response = await fetch(`${this.apiUrl}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderEmail: fromEmail,
          senderName: fromEmail, // Using email as name since we don't have a separate name field
          message,
          bookingId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Contact message failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          payload: { bookingId, fromEmail, messageLength: message?.length || 0 },
        });
        // Return error message instead of false so UI can display it
        throw new Error(
          errorData.error ||
            `Nepodařilo se odeslat zprávu (${response.status}): ${response.statusText}`
        );
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error sending contact message:', error);
      // Re-throw to let UI handle the error message
      throw error;
    }
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
