// Data management layer - SERVER-FIRST with real-time sync
/* global IdGenerator, ChristmasUtils, PriceCalculator, AbortController */

class DataManager {
  constructor() {
    // FIX 2025-12-03: Always use relative path through nginx (CSP blocks http://localhost:3000 from https)
    this.apiUrl = '/api';
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
    // FIX 2025-12-05: Changed from sessionStorage to localStorage for persistence across page refreshes
    // This ensures proposed bookings survive browser refresh and can be recovered
    let sessionId = localStorage.getItem('bookingSessionId');
    if (!sessionId) {
      // CRITICAL FIX 2025-10-07: Use IdGenerator (SSOT) instead of inline generation
      sessionId = IdGenerator.generateSessionId();
      localStorage.setItem('bookingSessionId', sessionId);
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
    if (
      window.adminPanel?.bookings &&
      document.querySelector('#bookingsTab')?.classList.contains('active')
    ) {
      await window.adminPanel.bookings.loadBookings();
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

    // NEW UNIFIED (2025-12-04): Removed localStorage - server is SSOT

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

      // CRITICAL FIX: Never silently create local-only bookings
      // This was causing phantom bookings that users thought were confirmed but weren't synced
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error(
          'Server není dostupný. Rezervace nebyla vytvořena. ' +
            'Zkontrolujte připojení k internetu a zkuste to znovu.'
        );
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

      // CRITICAL FIX: Never silently delete bookings locally
      // This was causing bookings to "reappear" after sync because they were only deleted locally
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error(
          'Server není dostupný. Rezervace nebyla zrušena. ' +
            'Zkontrolujte připojení k internetu a zkuste to znovu.'
        );
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
      // FIX 2025-12-05: Support both server format (sessionId) and cache format (session_id)
      const relevantProposals = proposedBookings.filter((pb) => {
        // Support both naming conventions
        const pbSessionId = pb.session_id || pb.sessionId;
        return (
          pb.rooms.includes(roomId) && (sessionToExclude === '' || pbSessionId !== sessionToExclude)
        );
      });

      // Check if nights are occupied by proposed bookings
      for (const pb of relevantProposals) {
        // FIX 2025-12-05: Get dates from perRoomDates if available (server format),
        // otherwise fall back to start_date/end_date (cache format)
        let startDate;
        let endDate;

        if (pb.perRoomDates && pb.perRoomDates[roomId]) {
          // Server format: perRoomDates contains per-room date ranges
          startDate = pb.perRoomDates[roomId].startDate;
          endDate = pb.perRoomDates[roomId].endDate;
        } else {
          // Cache format or legacy: dates directly on the proposal object
          startDate = pb.start_date || pb.startDate;
          endDate = pb.end_date || pb.endDate;
        }

        if (!startDate || !endDate) {
          console.warn('[getRoomAvailability] Proposed booking missing dates:', pb);
          continue;
        }

        // Night is occupied if nightDate >= proposalStart AND nightDate < proposalEnd
        if (DateUtils.isNightOccupied(nightBefore, startDate, endDate)) {
          proposedNightBeforeOccupied = true;
        }
        if (DateUtils.isNightOccupied(nightAfter, startDate, endDate)) {
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
      // NEW UNIFIED (2025-12-04): Removed localStorage - server is SSOT

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
      // NEW UNIFIED (2025-12-04): Removed localStorage - server is SSOT

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
      // SECURITY FIX: Do NOT fall back to plaintext password check
      // This was a security vulnerability that could bypass server authentication
      // and expose plaintext passwords in client-side code
      return {
        success: false,
        error: 'Server není dostupný - nelze ověřit přihlášení',
      };
    }
  }

  // Get API key from session
  // Removed: getApiKey() - deprecated method, use getSessionToken() instead

  getSessionToken() {
    // SECURITY FIX: Use sessionStorage (more secure than localStorage)
    return sessionStorage.getItem('adminSessionToken');
  }

  // Handle 401 errors by triggering admin logout
  handleUnauthorizedError() {
    // SECURITY FIX: Clear from sessionStorage (more secure)
    sessionStorage.removeItem('adminSessionToken');
    sessionStorage.removeItem('adminSessionExpiry');
    // Also clear localStorage for legacy cleanup
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
  // NOTE: getProposedBookings() is defined later in this class with fetchWithTimeout support

  // Invalidate proposed bookings cache
  invalidateProposedBookingsCache() {
    this.proposedBookingsCache = null;
    this.proposedBookingsCacheTime = null;
  }

  /**
   * Create a proposed booking (temporary reservation)
   * Supports two calling patterns:
   * 1. Object: createProposedBooking({ startDate, endDate, rooms, guests, guestType, totalPrice, sessionId })
   * 2. Explicit params: createProposedBooking(startDate, endDate, rooms, guests, guestType, totalPrice)
   */
  async createProposedBooking(
    startDateOrConfig,
    endDate,
    rooms,
    guests = {},
    guestType = 'external',
    totalPrice = 0
  ) {
    // Support object-based call pattern (used by EditBookingComponent)
    let requestData;
    if (typeof startDateOrConfig === 'object' && startDateOrConfig !== null) {
      // Object pattern: first arg is config object
      requestData = {
        sessionId: startDateOrConfig.sessionId || this.sessionId,
        startDate: startDateOrConfig.startDate,
        endDate: startDateOrConfig.endDate,
        rooms: startDateOrConfig.rooms,
        guests: startDateOrConfig.guests || {},
        guestType: startDateOrConfig.guestType || 'external',
        totalPrice: startDateOrConfig.totalPrice || 0,
      };
    } else {
      // Explicit params pattern (used by single-room-booking, bulk-booking)
      requestData = {
        sessionId: this.sessionId,
        startDate: startDateOrConfig,
        endDate,
        rooms,
        guests,
        guestType,
        totalPrice,
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/proposed-bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const data = await response.json();
        this.proposalId = data.proposalId;

        // Update cache in-place instead of invalidating (prevents immediate re-fetch)
        // FIX 2025-12-05: Use server-compatible format with perRoomDates structure
        if (this.proposedBookingsCache && Array.isArray(this.proposedBookingsCache)) {
          // Build perRoomDates structure for cache consistency
          const perRoomDates = {};
          for (const roomId of requestData.rooms) {
            perRoomDates[roomId] = {
              startDate: requestData.startDate,
              endDate: requestData.endDate,
            };
          }

          // Add new proposal to cache in server-compatible format
          this.proposedBookingsCache.push({
            proposalId: data.proposalId,
            sessionId: requestData.sessionId,
            rooms: requestData.rooms,
            perRoomDates,
            createdAt: new Date().toISOString(),
          });
          // Refresh cache timestamp to keep it valid
          this.proposedBookingsCacheTime = Date.now();
        }

        return data.proposalId;
      }
      // Server rejected the proposed booking - throw error instead of returning null
      const errorData = await response.json().catch(() => ({}));
      console.error('[DataManager] Server rejected proposed booking:', response.status, errorData);

      // Throw with meaningful message based on status
      if (response.status === 409) {
        throw new Error('Termín již není dostupný - někdo jiný právě provádí rezervaci.');
      }
      throw new Error(errorData.error || `Server odmítl požadavek (${response.status})`);
    } catch (error) {
      // Log with more detail for debugging
      const errorType = error.name === 'AbortError' ? 'timeout' : 'network';
      console.error(
        `[DataManager] Error creating proposed booking (${errorType}):`,
        error.message || error
      );

      // Re-throw the error instead of returning null silently
      // This allows callers to properly handle the failure
      if (error.name === 'AbortError') {
        throw new Error('Požadavek vypršel - zkuste to prosím znovu');
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Server není dostupný - zkontrolujte připojení k internetu');
      }
      throw error;
    }
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
        // FIX 2025-12-05: Support both naming conventions (proposalId and proposal_id)
        if (this.proposedBookingsCache && Array.isArray(this.proposedBookingsCache)) {
          // Remove deleted proposal from cache - support both naming conventions
          this.proposedBookingsCache = this.proposedBookingsCache.filter(
            (pb) => (pb.proposalId || pb.proposal_id) !== proposalId
          );
          // Refresh cache timestamp to keep it valid
          this.proposedBookingsCacheTime = Date.now();
        }

        return true;
      }
      // SECURITY FIX: Log and throw error instead of silent failure
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(
        '[DataManager] Server rejected delete proposed booking:',
        response.status,
        errorText
      );
      throw new Error(`Nepodařilo se smazat návrh rezervace (${response.status})`);
    } catch (error) {
      const errorType = error.name === 'AbortError' ? 'timeout' : 'network';
      console.error(
        `[DataManager] Error deleting proposed booking (${errorType}):`,
        error.message || error
      );
      // SECURITY FIX: Re-throw error so callers can handle it properly
      throw error;
    }
  }

  async clearSessionProposedBookings() {
    try {
      const response = await fetch(`${this.apiUrl}/proposed-bookings/session/${this.sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        this.proposalId = null;
        // Also clear cache
        if (this.proposedBookingsCache && Array.isArray(this.proposedBookingsCache)) {
          this.proposedBookingsCache = this.proposedBookingsCache.filter(
            (pb) => pb.sessionId !== this.sessionId
          );
          this.proposedBookingsCacheTime = Date.now();
        }
        return true;
      }
      // SECURITY FIX: Log and throw error instead of silent failure
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(
        '[DataManager] Server rejected clear session proposals:',
        response.status,
        errorText
      );
      throw new Error(`Nepodařilo se vyčistit návrhy rezervací (${response.status})`);
    } catch (error) {
      const errorType = error.name === 'AbortError' ? 'timeout' : 'network';
      console.error(
        `[DataManager] Error clearing session proposed bookings (${errorType}):`,
        error.message || error
      );
      // SECURITY FIX: Re-throw error so callers can handle it properly
      throw error;
    }
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

  /**
   * Update a booking using the edit token (for user self-service)
   * Validates the edit token on the server and updates the booking if authorized
   *
   * @param {string|number} bookingId - Booking ID to update
   * @param {Object} updates - Booking fields to update (partial update supported)
   * @param {string} editToken - Edit token from the booking confirmation email
   * @returns {Promise<Object>} Updated booking object
   * @throws {Error} If token is invalid, expired, or update fails
   */
  async updateBookingWithToken(bookingId, updates, editToken) {
    let response;
    let result;

    // Network operation with focused try-catch
    try {
      response = await fetch(`${this.apiUrl}/booking/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-edit-token': editToken,
        },
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error(
        `[DataManager] Network error updating booking (ID: ${bookingId}, token: ${editToken?.slice(0, 8)}...):`,
        error.message
      );
      // Provide user-friendly network error
      if (error.name === 'AbortError') {
        throw new Error('TIMEOUT');
      }
      throw new Error('NETWORK_ERROR');
    }

    // Handle error responses with specific status codes
    if (!response.ok) {
      let errorMessage;
      const status = response.status;

      // Safe JSON parsing - server might return non-JSON error
      const data = await response.json().catch(() => ({}));

      if (status === 401) {
        errorMessage = 'TOKEN_INVALID';
      } else if (status === 403) {
        errorMessage = 'TOKEN_EXPIRED';
      } else if (status === 423) {
        errorMessage = 'BOOKING_LOCKED';
      } else {
        errorMessage = data.error || `UPDATE_FAILED_${status}`;
      }

      console.error(
        `[DataManager] Server rejected update (ID: ${bookingId}, status: ${status}):`,
        data.error || 'No error message'
      );
      throw new Error(errorMessage);
    }

    // Parse success response
    try {
      result = await response.json();
    } catch (parseError) {
      console.error(`[DataManager] Failed to parse update response for booking ${bookingId}`);
      throw new Error('PARSE_ERROR');
    }

    // Update local cache (outside try-catch - let programming errors bubble up)
    if (this.data?.bookings) {
      const index = this.data.bookings.findIndex((b) => b.id === bookingId);
      if (index !== -1) {
        this.data.bookings[index] = result.booking;
      }
    }

    return result.booking;
  }

  /**
   * Delete a booking using the edit token (for user self-service cancellation)
   * Validates the edit token on the server and deletes the booking if authorized
   *
   * @param {string|number} bookingId - Booking ID to delete
   * @param {string} editToken - Edit token from the booking confirmation email
   * @returns {Promise<boolean>} True if deletion was successful
   * @throws {Error} If token is invalid, expired, or deletion fails
   */
  async deleteBookingWithToken(bookingId, editToken) {
    let response;

    // Network operation with focused try-catch
    try {
      response = await fetch(`${this.apiUrl}/booking/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-edit-token': editToken,
        },
      });
    } catch (error) {
      console.error(
        `[DataManager] Network error deleting booking (ID: ${bookingId}, token: ${editToken?.slice(0, 8)}...):`,
        error.message
      );
      if (error.name === 'AbortError') {
        throw new Error('TIMEOUT');
      }
      throw new Error('NETWORK_ERROR');
    }

    // Handle error responses with specific status codes
    if (!response.ok) {
      const status = response.status;
      let errorMessage;

      // Safe JSON parsing
      const data = await response.json().catch(() => ({}));

      if (status === 401) {
        errorMessage = 'TOKEN_INVALID';
      } else if (status === 403) {
        errorMessage = 'TOKEN_EXPIRED';
      } else if (status === 423) {
        errorMessage = 'BOOKING_LOCKED';
      } else {
        errorMessage = data.error || `DELETE_FAILED_${status}`;
      }

      console.error(
        `[DataManager] Server rejected delete (ID: ${bookingId}, status: ${status}):`,
        data.error || 'No error message'
      );
      throw new Error(errorMessage);
    }

    // Update local cache (outside try-catch)
    if (this.data?.bookings) {
      this.data.bookings = this.data.bookings.filter((b) => b.id !== bookingId);
    }

    return true;
  }

  // Proposed Bookings Management
  // NOTE: createProposedBooking() is defined earlier in this class (supports both object and explicit params)

  async deleteProposedBookingsForSession(sessionId) {
    if (!sessionId) {
      return true; // Nothing to delete
    }
    try {
      const response = await fetch(`${this.apiUrl}/proposed-bookings/session/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // SECURITY FIX: Log error details instead of silently ignoring
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(
          '[DataManager] Failed to delete proposed bookings:',
          response.status,
          errorText
        );
        return false;
      }

      // Clear from cache if this is our session
      if (sessionId === this.sessionId && this.proposedBookingsCache) {
        this.proposedBookingsCache = this.proposedBookingsCache.filter(
          (pb) => pb.sessionId !== sessionId
        );
        this.proposedBookingsCacheTime = Date.now();
      }

      return true;
    } catch (error) {
      // SECURITY FIX: Log detailed error instead of generic warning
      const errorType = error.name === 'AbortError' ? 'timeout' : 'network';
      console.error(
        `[DataManager] Error deleting proposed bookings (${errorType}):`,
        error.message || error
      );
      return false;
    }
  }

  async getProposedBookings() {
    // Check cache first
    const now = Date.now();
    if (
      this.proposedBookingsCache &&
      this.proposedBookingsCacheTime &&
      now - this.proposedBookingsCacheTime < this.proposedBookingsCacheDuration
    ) {
      return this.proposedBookingsCache;
    }

    // Return existing promise if fetch in progress
    if (this.proposedBookingsFetchPromise) {
      return this.proposedBookingsFetchPromise;
    }

    this.proposedBookingsFetchPromise = (async () => {
      try {
        const response = await this.fetchWithTimeout(`${this.apiUrl}/proposed-bookings`);
        if (response.ok) {
          const data = await response.json();
          this.proposedBookingsCache = data;
          this.proposedBookingsCacheTime = Date.now();
          return data;
        }
        // Non-OK response - log warning but return empty to allow booking flow to continue
        // This is acceptable because proposed bookings are a soft-lock mechanism
        console.warn(
          '[DataManager] Proposed bookings API returned non-OK status:',
          response.status
        );
        return [];
      } catch (error) {
        // FIX: Log error properly for debugging
        console.error('[DataManager] Failed to fetch proposed bookings:', error.message || error);
        // Return empty array to prevent blocking the booking flow
        // The availability check will still work with confirmed bookings
        return [];
      } finally {
        this.proposedBookingsFetchPromise = null;
      }
    })();

    return this.proposedBookingsFetchPromise;
  }

  // Audit Logging
  async createAuditLog(logData) {
    try {
      await fetch(`${this.apiUrl}/audit-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
      });
    } catch (error) {
      console.warn('Failed to create audit log:', error);
    }
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
