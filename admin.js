// Admin panel logic
class AdminPanel {
  // Session timeout constants
  // FIX: Extended from 2 hours to 7 days for better persistence
  static SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days
  static SESSION_WARNING_TIME = 60 * 60 * 1000; // 1 hour before expiry
  static ACTIVITY_DEBOUNCE_TIME = 1000; // 1 second
  static SESSION_REFRESH_INTERVAL = 60 * 60 * 1000; // Refresh every 1 hour on activity

  constructor() {
    this.isAuthenticated = false;
    this.refreshInterval = null;
    this.today = new Date(); // Required by BaseCalendar
    this.currentMonth = new Date(); // Required by BaseCalendar for EDIT mode navigation
    this.editSelectedDates = new Set();
    // Map<roomId, {guestType, adults, children, toddlers}>
    this.editSelectedRooms = new Map();
    this.editStartDate = null;
    this.editEndDate = null;
    this.currentEditBooking = null;
    this.selectedBookings = new Set(); // Track selected bookings for bulk operations
    this.isLoadingBookings = false; // Mutex to prevent concurrent loadBookings calls
    this.init();
  }

  // Defense-in-depth: HTML escaping helper
  escapeHtml(unsafe) {
    if (!unsafe) {
      return '';
    }
    return String(unsafe)
      .replace(/&/gu, '&amp;')
      .replace(/</gu, '&lt;')
      .replace(/>/gu, '&gt;')
      .replace(/"/gu, '&quot;')
      .replace(/'/gu, '&#039;');
  }

  // Helper function to create styled room badges
  createRoomBadge(roomId, inline = false) {
    // Use cached rooms data
    // const data = JSON.parse(localStorage.getItem('chataMarianska') || '{}');
    // const rooms = data.settings?.rooms || []; // Reserved for future use
    // const room = rooms.find((r) => r.id === roomId); // Reserved for future use
    return `<span style="
            display: ${inline ? 'inline-block' : 'inline-block'};
            margin: ${inline ? '0 0.25rem' : '0.25rem'};
            padding: 0.4rem 0.7rem;
            background: #28a745;
            color: white;
            border: 2px solid #1e7e34;
            border-radius: 6px;
            font-weight: 700;
            font-size: 0.95rem;
            box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        ">P${roomId}</span>`;
  }

  /**
   * Create room display - shows "Celá chata" for bulk bookings, individual badges otherwise
   * @param {Object} booking - Booking object with rooms array and isBulkBooking flag
   * @param {boolean} inline - Whether to use inline display
   * @returns {string} - HTML string
   */
  createRoomDisplay(booking, inline = false) {
    // Check if it's a bulk booking (all 9 rooms or isBulkBooking flag)
    const isBulk = booking.isBulkBooking || (booking.rooms && booking.rooms.length === 9);

    if (isBulk) {
      return `<span style="
              display: inline-block;
              margin: ${inline ? '0 0.25rem' : '0.25rem'};
              padding: 0.4rem 0.7rem;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: 2px solid #5a67d8;
              border-radius: 6px;
              font-weight: 700;
              font-size: 0.95rem;
              box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
              text-shadow: 0 1px 2px rgba(0,0,0,0.2);
          ">🏠 Celá chata</span>`;
    }

    // Regular booking - show individual room badges
    return booking.rooms.map((roomId) => this.createRoomBadge(roomId, inline)).join('');
  }

  /**
   * FIX 2025-12-02: Format guest type display with breakdown for bulk bookings
   * @param {Object} booking - Booking object with guestType and guestTypeBreakdown
   * @returns {string} - Formatted guest type display
   */
  formatGuestTypeDisplay(booking) {
    // Check if we have a breakdown (mixed ÚTIA/external bulk booking)
    const breakdown = booking.guestTypeBreakdown;
    if (breakdown && (breakdown.utiaAdults > 0 || breakdown.utiaChildren > 0) &&
        (breakdown.externalAdults > 0 || breakdown.externalChildren > 0)) {
      // Mixed booking - show both types
      const utiaTotal = (breakdown.utiaAdults || 0) + (breakdown.utiaChildren || 0);
      const externalTotal = (breakdown.externalAdults || 0) + (breakdown.externalChildren || 0);

      let parts = [];
      if (utiaTotal > 0) {
        parts.push(`<span style="color: #059669; font-weight: 600;">ÚTIA: ${utiaTotal}</span>`);
      }
      if (externalTotal > 0) {
        parts.push(`<span style="color: #dc2626; font-weight: 600;">Externí: ${externalTotal}</span>`);
      }
      return parts.join(' / ');
    }

    // Only one type - show as before
    if (breakdown && (breakdown.utiaAdults > 0 || breakdown.utiaChildren > 0)) {
      return '<span style="color: #059669; font-weight: 600;">Zaměstnanec ÚTIA</span>';
    }

    // Fallback to single guestType field
    return booking.guestType === 'utia'
      ? '<span style="color: #059669; font-weight: 600;">Zaměstnanec ÚTIA</span>'
      : '<span style="color: #dc2626; font-weight: 600;">Externí host</span>';
  }

  /**
   * Render guest names organized by room
   * @param {Object} booking - Booking object with guestNames and rooms
   * @returns {string} - HTML string
   */
  renderGuestNamesByRoom(booking) {
    if (!booking.guestNames || booking.guestNames.length === 0) {
      return '<p style="color: #9ca3af;">Žádná jména hostů</p>';
    }

    // Use GuestNameUtils to organize names by room
    const perRoomGuests = booking.perRoomGuests || {};
    const rooms = booking.rooms || [];

    // Organize guest names by room
    const perRoomGuestNames =
      typeof GuestNameUtils === 'undefined'
        ? null
        : GuestNameUtils.organizeByRoom(booking.guestNames, perRoomGuests, rooms); // eslint-disable-line no-undef

    // If we have per-room organization AND multiple rooms, display by room
    // BUT for bulk bookings (whole cabin), show all guests in one list instead
    if (
      perRoomGuestNames &&
      Object.keys(perRoomGuestNames).length > 0 &&
      rooms.length > 1 &&
      !booking.isBulkBooking
    ) {
      let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';

      // Sort room IDs numerically
      const sortedRoomIds = Object.keys(perRoomGuestNames).sort(
        (a, b) => parseInt(a, 10) - parseInt(b, 10)
      );

      sortedRoomIds.forEach((roomId) => {
        const guests = perRoomGuestNames[roomId];
        if (!Array.isArray(guests) || guests.length === 0) {
          return;
        }

        html += `
          <div style="border-left: 3px solid #28a745; padding-left: 0.75rem;">
            <div style="font-weight: 600; color: #4b5563; font-size: 0.9rem; margin-bottom: 0.5rem;">
              ${this.createRoomBadge(roomId, true)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
        `;

        // Group by person type within the room
        const adults = guests.filter((g) => g.personType === 'adult');
        const children = guests.filter((g) => g.personType === 'child');
        const toddlers = guests.filter((g) => g.personType === 'toddler');

        if (adults.length > 0) {
          html += `<div style="color: #6b7280; font-size: 0.85rem; margin-top: 0.25rem;"><strong>Dospělí:</strong> ${adults
            .map((g) => `${this.escapeHtml(g.firstName)} ${this.escapeHtml(g.lastName)}`)
            .join(', ')}</div>`;
        }

        if (children.length > 0) {
          html += `<div style="color: #6b7280; font-size: 0.85rem; margin-top: 0.25rem;"><strong>Děti:</strong> ${children
            .map((g) => `${this.escapeHtml(g.firstName)} ${this.escapeHtml(g.lastName)}`)
            .join(', ')}</div>`;
        }

        if (toddlers.length > 0) {
          html += `<div style="color: #6b7280; font-size: 0.85rem; margin-top: 0.25rem;"><strong>Batolata:</strong> ${toddlers
            .map((g) => `${this.escapeHtml(g.firstName)} ${this.escapeHtml(g.lastName)}`)
            .join(', ')}</div>`;
        }

        html += `
            </div>
          </div>
        `;
      });

      html += '</div>';
      return html;
    }

    // Fallback: display by person type only (backward compatible for single-room or legacy bookings)
    let html = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">';

    const adults = booking.guestNames.filter((g) => g.personType === 'adult');
    const children = booking.guestNames.filter((g) => g.personType === 'child');
    const toddlers = booking.guestNames.filter((g) => g.personType === 'toddler');

    if (adults.length > 0) {
      html += `
        <div>
          <div style="font-weight: 600; color: #4b5563; font-size: 0.85rem; margin-bottom: 0.5rem;">Dospělí:</div>
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${adults
              .map(
                (guest) =>
                  `<div style="color: #6b7280; font-size: 0.9rem;">${this.escapeHtml(guest.firstName)} ${this.escapeHtml(guest.lastName)}</div>`
              )
              .join('')}
          </div>
        </div>
      `;
    }

    if (children.length > 0) {
      html += `
        <div>
          <div style="font-weight: 600; color: #4b5563; font-size: 0.85rem; margin-bottom: 0.5rem;">Děti:</div>
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${children
              .map(
                (guest) =>
                  `<div style="color: #6b7280; font-size: 0.9rem;">${this.escapeHtml(guest.firstName)} ${this.escapeHtml(guest.lastName)}</div>`
              )
              .join('')}
          </div>
        </div>
      `;
    }

    if (toddlers.length > 0) {
      html += `
        <div>
          <div style="font-weight: 600; color: #4b5563; font-size: 0.85rem; margin-bottom: 0.5rem;">Batolata:</div>
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${toddlers
              .map(
                (guest) =>
                  `<div style="color: #6b7280; font-size: 0.9rem;">${this.escapeHtml(guest.firstName)} ${this.escapeHtml(guest.lastName)}</div>`
              )
              .join('')}
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  async init() {
    // Make sure DataManager is properly initialized and synced
    await dataManager.initData();
    // Force sync with server to get latest data
    await dataManager.syncWithServer();
    this.setupEventListeners();
    await this.checkAuthentication();
  }

  setupEventListeners() {
    // Login
    document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));

    // Navigation - Redirect to main calendar page
    document.getElementById('backBtn').addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

    // Tabs
    document.querySelectorAll('.tab-button').forEach((btn) => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Search
    document.getElementById('searchBookings').addEventListener('input', (e) => {
      this.filterBookings(e.target.value);
    });

    // Forms
    document
      .getElementById('blockDateForm')
      .addEventListener('submit', (e) => this.handleBlockDate(e));
    document.getElementById('addCodeForm').addEventListener('submit', (e) => this.handleAddCode(e));
    document
      .getElementById('christmasPeriodForm')
      .addEventListener('submit', (e) => this.handleChristmasPeriod(e));
    document
      .getElementById('roomConfigForm')
      .addEventListener('submit', (e) => this.handleRoomConfig(e));
    document
      .getElementById('priceConfigForm')
      .addEventListener('submit', (e) => this.handlePriceConfig(e));
    document
      .getElementById('bulkPriceConfigForm')
      .addEventListener('submit', (e) => this.handleBulkPriceConfig(e));
    document
      .getElementById('changePasswordForm')
      .addEventListener('submit', (e) => this.handleChangePassword(e));
    document
      .getElementById('editBookingForm')
      .addEventListener('submit', (e) => this.handleEditBooking(e));
    document
      .getElementById('emailTemplateForm')
      .addEventListener('submit', (e) => this.handleEmailTemplate(e));
    document
      .getElementById('contactEmailForm')
      .addEventListener('submit', (e) => this.handleContactEmail(e));
    document
      .getElementById('addAdminEmailForm')
      .addEventListener('submit', (e) => this.handleAddAdminEmail(e));
    document
      .getElementById('addCabinManagerEmailForm')
      .addEventListener('submit', (e) => this.handleAddCabinManagerEmail(e));

    // Modal close
    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.modal').classList.remove('active');
      });
    });
  }

  async checkAuthentication() {
    // SECURITY FIX: Check session token with expiry (using localStorage for persistence)
    const sessionToken = localStorage.getItem('adminSessionToken');
    const sessionExpiry = localStorage.getItem('adminSessionExpiry');

    if (sessionToken && sessionExpiry) {
      // FIX: Parse ISO timestamp correctly (not parseInt!)
      const expiryTime = new Date(sessionExpiry).getTime();
      const now = Date.now();

      if (now < expiryTime) {
        await this.showAdminPanel();
        this.setupSessionRefresh(); // Auto-refresh on activity
      } else {
        this.logout(); // Auto-logout on expiry
        this.showErrorMessage('Session vypršela - přihlaste se znovu');
      }
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('password').value;

    const loginResult = await dataManager.authenticateAdmin(password);
    if (loginResult && loginResult.success) {
      // SECURITY FIX: Store session token and expiry in localStorage for persistence
      localStorage.setItem('adminSessionToken', loginResult.sessionToken);
      localStorage.setItem('adminSessionExpiry', loginResult.expiresAt);
      await this.showAdminPanel();
      this.setupSessionRefresh();
    } else {
      this.showErrorMessage('Nesprávné heslo');
    }
  }

  setupSessionRefresh() {
    // Clear existing timers
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }
    if (this.sessionWarning) {
      clearTimeout(this.sessionWarning);
    }
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Track last refresh time to prevent excessive API calls
    this.lastRefreshTime = Date.now();

    // Auto-logout timer
    this.sessionTimeout = setTimeout(() => {
      this.logout();
      this.showErrorMessage('Session vypršela z důvodu nečinnosti');
    }, AdminPanel.SESSION_TIMEOUT);

    // Warning timer (1 hour before expiry)
    this.sessionWarning = setTimeout(() => {
      this.showWarningMessage(
        'Session vyprší za 1 hodinu. Obnovte ji aktivitou nebo se znovu přihlaste.'
      );
    }, AdminPanel.SESSION_TIMEOUT - AdminPanel.SESSION_WARNING_TIME);

    // Refresh session on user activity (throttled to prevent excessive API calls)
    const activityHandler = () => {
      const now = Date.now();
      const timeSinceLastRefresh = now - this.lastRefreshTime;

      // Only refresh if 1 hour has passed since last refresh
      if (timeSinceLastRefresh < AdminPanel.SESSION_REFRESH_INTERVAL) {
        return;
      }

      this.lastRefreshTime = now;

      // Reset client-side timers
      clearTimeout(this.sessionTimeout);
      clearTimeout(this.sessionWarning);

      // Restart timers
      this.sessionTimeout = setTimeout(() => {
        this.logout();
        this.showErrorMessage('Session vypršela z důvodu nečinnosti');
      }, AdminPanel.SESSION_TIMEOUT);

      this.sessionWarning = setTimeout(() => {
        this.showWarningMessage(
          'Session vyprší za 1 hodinu. Obnovte ji aktivitou nebo se znovu přihlaste.'
        );
      }, AdminPanel.SESSION_TIMEOUT - AdminPanel.SESSION_WARNING_TIME);

      // Call refresh endpoint to extend server-side session
      const sessionToken = localStorage.getItem('adminSessionToken');
      if (!sessionToken) {
        return;
      }

      // Refresh with retry logic for network issues
      const attemptRefresh = (retryCount = 0) => {
        fetch('/api/admin/refresh-session', {
          method: 'POST',
          headers: {
            'x-session-token': sessionToken,
          },
        })
          .then((res) => {
            if (res.status === 401) {
              // Session expired on server - trigger logout
              this.logout();
              this.showErrorMessage('Session vypršela - přihlaste se prosím znovu');
              return null;
            }
            if (!res.ok) {
              console.error('Session refresh failed:', res.status);
              return null;
            }
            return res.json();
          })
          .then((data) => {
            if (data && data.success) {
              localStorage.setItem('adminSessionExpiry', data.expiresAt);
            }
          })
          .catch((err) => {
            console.error('Failed to refresh session:', err);

            // Retry once after 5 minutes if this is the first failure
            if (retryCount === 0) {
              // Will retry session refresh in 5 minutes...
              setTimeout(
                () => {
                  attemptRefresh(1);
                },
                5 * 60 * 1000
              );
            }
            // If retry also fails, session may expire (logged above)
          });
      };

      attemptRefresh();
    };

    // Reset timer on user activity (debounced)
    let activityDebounce;
    const debouncedActivity = () => {
      clearTimeout(activityDebounce);
      activityDebounce = setTimeout(activityHandler, AdminPanel.ACTIVITY_DEBOUNCE_TIME);
    };

    // Listen to user activity events
    ['click', 'keypress', 'mousemove', 'scroll'].forEach((event) => {
      document.addEventListener(event, debouncedActivity);
    });

    // Store cleanup function
    this.cleanupSessionListeners = () => {
      ['click', 'keypress', 'mousemove', 'scroll'].forEach((event) => {
        document.removeEventListener(event, debouncedActivity);
      });
    };
  }

  logout() {
    // Cleanup session refresh listeners
    if (this.cleanupSessionListeners) {
      this.cleanupSessionListeners();
    }

    // Clear timers
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }
    if (this.sessionWarning) {
      clearTimeout(this.sessionWarning);
    }

    // Call logout endpoint
    const sessionToken = localStorage.getItem('adminSessionToken');
    if (sessionToken) {
      fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'x-session-token': sessionToken,
        },
      }).catch((err) => console.error('Logout error:', err));
    }

    // Clear localStorage (changed from sessionStorage for persistence)
    localStorage.removeItem('adminSessionToken');
    localStorage.removeItem('adminSessionExpiry');
    sessionStorage.removeItem('adminAuth'); // Old auth token (legacy cleanup)

    // Update UI
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('backBtn').style.display = 'none';
    document.getElementById('password').value = '';
  }

  /**
   * Check if admin session is still valid
   * @returns {boolean} True if session is valid
   */
  isSessionValid() {
    const sessionToken = localStorage.getItem('adminSessionToken');
    const sessionExpiry = localStorage.getItem('adminSessionExpiry');

    if (!sessionToken || !sessionExpiry) {
      return false;
    }

    // Session expiry is stored as ISO string (e.g., "2025-10-05T12:00:00.000Z")
    const expiryTime = new Date(sessionExpiry).getTime();
    const now = Date.now();

    // Session expired
    if (expiryTime < now) {
      console.warn('[AdminPanel] Session expired at', new Date(expiryTime));
      return false;
    }

    return true;
  }

  /**
   * Validate session before admin operation
   * If session invalid, logout and show error
   * @returns {boolean} True if session is valid
   */
  validateSession() {
    if (!this.isSessionValid()) {
      this.showToast('Vaše session vypršela. Přihlaste se prosím znovu.', 'error');
      this.logout();
      return false;
    }
    return true;
  }

  async showAdminPanel() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'flex';
    document.getElementById('backBtn').style.display = 'flex';

    // Load data for the active tab (default is bookings)
    await this.loadTabData('bookings');
  }

  async switchTab(tabName) {
    // Update button states
    document.querySelectorAll('.tab-button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content visibility
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });

    document.getElementById(`${tabName}Tab`).classList.add('active');

    // Load data for the selected tab
    await this.loadTabData(tabName);
  }

  async loadTabData(tabName) {
    // Clear any existing refresh interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    // Sync with server first to get fresh data
    await dataManager.syncWithServer();

    switch (tabName) {
      case 'bookings':
        await this.loadBookings();
        // Set up auto-refresh for bookings tab (every 3 seconds)
        this.refreshInterval = setInterval(async () => {
          if (document.querySelector('#bookingsTab').classList.contains('active')) {
            await dataManager.syncWithServer();
            await this.loadBookings();
          }
        }, 3000);
        break;
      case 'blocked':
        await this.loadBlockedDates();
        break;
      case 'christmas':
        await this.loadChristmasCodes();
        await this.loadChristmasPeriods();
        break;
      case 'config':
        await this.loadRoomConfig();
        await this.loadPriceConfig();
        await this.loadBulkPriceConfig();
        break;
      case 'statistics':
        await this.loadStatistics();
        break;
      case 'settings':
        await this.loadEmailTemplate();
        break;
      default:
        // Unknown tab - do nothing
        break;
    }
  }

  async loadBookings() {
    // Mutex: prevent concurrent calls that cause duplicate rows
    if (this.isLoadingBookings) {
      return;
    }
    this.isLoadingBookings = true;

    try {
      const bookings = await dataManager.getAllBookings();
      const tbody = document.getElementById('bookingsTableBody');

      tbody.innerHTML = '';

      bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // SSOT FIX 2025-12-03: Use stored price directly - NO recalculation!
      // booking.totalPrice is the authoritative value calculated by server at creation/update.
      // Admin panel should NEVER recalculate for display - only use stored value.
      const bookingPrices = new Map();
      bookings.forEach((booking) => {
        bookingPrices.set(booking.id, this.getBookingPrice(booking));
      });

      // Process bookings to create table rows
      for (const booking of bookings) {
        // Format date range display
        let dateRangeDisplay = '';
        let isCompositeBooking = false; // NEW 2025-11-14: Track composite bookings

        if (booking.perRoomDates && Object.keys(booking.perRoomDates).length > 0) {
          // Calculate overall range from per-room dates
          let minStart = booking.startDate;
          let maxEnd = booking.endDate;

          // Check if rooms have different date ranges (composite booking)
          const roomDates = Object.values(booking.perRoomDates);
          if (roomDates.length > 1) {
            const firstStart = roomDates[0].startDate;
            const firstEnd = roomDates[0].endDate;
            isCompositeBooking = roomDates.some(
              (dates) => dates.startDate !== firstStart || dates.endDate !== firstEnd
            );
          }

          Object.values(booking.perRoomDates).forEach((dates) => {
            if (!minStart || dates.startDate < minStart) {
              minStart = dates.startDate;
            }
            if (!maxEnd || dates.endDate > maxEnd) {
              maxEnd = dates.endDate;
            }
          });

          dateRangeDisplay = `${new Date(minStart).toLocaleDateString('cs-CZ')} - ${new Date(maxEnd).toLocaleDateString('cs-CZ')}`;

          // NEW 2025-11-14: Add "složená rezervace" indicator for composite bookings
          if (isCompositeBooking) {
            dateRangeDisplay +=
              '<br><span style="display: inline-block; margin-top: 0.25rem; padding: 0.2rem 0.5rem; background: #f59e0b; color: white; border-radius: 3px; font-size: 0.75rem; font-weight: 600;">📅 Složená rezervace</span>';
          }
        } else {
          // Fallback to booking-level dates
          dateRangeDisplay = `${new Date(booking.startDate).toLocaleDateString('cs-CZ')} - ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}`;
        }

        const row = document.createElement('tr');
        row.setAttribute('data-booking-id', booking.id);
        row.innerHTML = `
                <td style="text-align: center;">
                    <input
                        type="checkbox"
                        class="booking-checkbox"
                        data-booking-id="${booking.id}"
                        style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary-color);"
                        onchange="adminPanel.toggleBookingSelection('${booking.id}', this.checked)"
                    />
                </td>
                <td>${this.escapeHtml(booking.id)}</td>
                <td>${this.escapeHtml(booking.name)}</td>
                <td>${this.escapeHtml(booking.email)}</td>
                <td style="text-align: center;">
                    ${booking.payFromBenefit ? '<span style="display: inline-flex; align-items: center; justify-content: center; padding: 0.3rem 0.6rem; background: #17a2b8; color: white; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">💳 Ano</span>' : '<span style="color: #6b7280; font-size: 0.85rem;">Ne</span>'}
                </td>
                <td>${dateRangeDisplay}</td>
                <td>${this.createRoomDisplay(booking, true)}</td>
                <td>
                    ${bookingPrices.get(booking.id).toLocaleString('cs-CZ')} Kč
                </td>
                <td style="text-align: center;">
                    <label style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer; user-select: none;">
                        <input
                            type="checkbox"
                            ${booking.paid ? 'checked' : ''}
                            onchange="adminPanel.togglePaidStatus('${booking.id}', this.checked)"
                            style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--success-color);"
                        />
                        <span style="font-weight: 600; color: ${booking.paid ? '#10b981' : '#ef4444'}; font-size: 0.85rem;">
                            ${booking.paid ? '✓ Ano' : '✗ Ne'}
                        </span>
                    </label>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-modern btn-view" onclick="adminPanel.viewBookingDetails('${booking.id}')" title="Zobrazit detail">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            Detail
                        </button>
                        <button class="btn-modern btn-edit" onclick="adminPanel.editBooking('${booking.id}')" title="Upravit rezervaci">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Upravit
                        </button>
                        <button class="btn-modern btn-delete" onclick="adminPanel.deleteBooking('${booking.id}')" title="Smazat rezervaci">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                            Smazat
                        </button>
                    </div>
                </td>
            `;
        tbody.appendChild(row);
      }

      // Reset selection state
      this.selectedBookings.clear();
      this.updateBulkActionsUI();
    } finally {
      this.isLoadingBookings = false;
    }
  }

  /**
   * SSOT FIX 2025-12-03: Get the authoritative price for a booking.
   *
   * booking.totalPrice IS the single source of truth - it was calculated
   * by the server using PriceCalculator at creation/update time.
   *
   * Admin panel should NEVER recalculate prices for display purposes.
   * The only valid use case for client-side recalculation is edit preview
   * (handled by EditBookingComponent).
   *
   * @param {Object} booking - Booking object with totalPrice
   * @returns {number} The stored totalPrice (authoritative value, never negative)
   */
  getBookingPrice(booking) {
    return booking.totalPrice || 0;
  }

  filterBookings(searchTerm) {
    const rows = document.querySelectorAll('#bookingsTableBody tr');
    const term = searchTerm.toLowerCase();

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      const displayRow = row;
      displayRow.style.display = text.includes(term) ? '' : 'none';
    });
  }

  async viewBookingDetails(bookingId) {
    const booking = await dataManager.getBooking(bookingId);
    if (!booking) {
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                <h2 style="margin-right: 3rem; word-break: break-all;">Detail rezervace<br><span style="font-size: 0.8em; color: var(--gray-600);">${booking.id}</span></h2>

                ${
                  booking.isBulkBooking
                    ? (() => {
                        const createdAt = new Date(booking.createdAt || booking.created_at);
                        const startDate = new Date(booking.startDate || booking.start_date);
                        const msPerDay = 1000 * 60 * 60 * 24;
                        const daysAhead = Math.floor((startDate - createdAt) / msPerDay);
                        const isLessThan3Months = daysAhead < 90;

                        return isLessThan3Months
                          ? `<div style="background: #fef3c7; color: #92400e; padding: 0.75rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #d97706;">
                              <strong>⚠️ Hromadná akce</strong> - Vytvořeno ${daysAhead} dní předem (doporučeno min. 90 dní)
                             </div>`
                          : `<div style="background: #d1fae5; color: #065f46; padding: 0.75rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #10b981;">
                              <strong>✓ Hromadná akce</strong> - Vytvořeno ${daysAhead} dní předem
                             </div>`;
                      })()
                    : ''
                }

                <div style="display: grid; gap: 1.5rem; margin-top: 1.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Jméno a příjmení:</strong>
                            <div style="margin-top: 0.25rem;">${this.escapeHtml(booking.name)}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Email:</strong>
                            <div style="margin-top: 0.25rem;">${this.escapeHtml(booking.email)}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Telefon:</strong>
                            <div style="margin-top: 0.25rem;">${this.escapeHtml(booking.phone)}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Firma:</strong>
                            <div style="margin-top: 0.25rem;">${this.escapeHtml(booking.company) || '-'}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">IČO:</strong>
                            <div style="margin-top: 0.25rem;">${this.escapeHtml(booking.ico) || '-'}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">DIČ:</strong>
                            <div style="margin-top: 0.25rem;">${this.escapeHtml(booking.dic) || '-'}</div>
                        </div>
                    </div>

                    <div>
                        <strong style="color: var(--gray-600); font-size: 0.9rem;">Adresa:</strong>
                        <div style="margin-top: 0.25rem;">${this.escapeHtml(booking.address)}, ${this.escapeHtml(booking.city)} ${this.escapeHtml(booking.zip)}</div>
                    </div>

                    <div>
                        <strong style="color: var(--gray-600); font-size: 0.9rem;">Termín a pokoje:</strong>
                        <div style="margin-top: 0.5rem;">
                            ${
                              // For bulk bookings, always show "Celá chata" with single date range
                              booking.isBulkBooking || (booking.rooms && booking.rooms.length === 9)
                                ? `
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
                              <span style="color: #4b5563;">
                                ${new Date(booking.startDate).toLocaleDateString('cs-CZ')} - ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}
                              </span>
                              <span style="color: #9ca3af;">•</span>
                              ${this.createRoomDisplay(booking, true)}
                            </div>
                          `
                                : booking.perRoomDates && Object.keys(booking.perRoomDates).length > 0
                                  ? booking.rooms
                                      .map((roomId) => {
                                        const dates = booking.perRoomDates[roomId];
                                        if (dates) {
                                          return `
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                      ${this.createRoomBadge(roomId, true)}
                                      <span style="color: #4b5563;">
                                        ${new Date(dates.startDate).toLocaleDateString('cs-CZ')} - ${new Date(dates.endDate).toLocaleDateString('cs-CZ')}
                                      </span>
                                    </div>
                                  `;
                                        }
                                        return `
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                      ${this.createRoomBadge(roomId, true)}
                                      <span style="color: #4b5563;">
                                        ${new Date(booking.startDate).toLocaleDateString('cs-CZ')} - ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}
                                      </span>
                                    </div>
                                  `;
                                      })
                                      .join('')
                                  : `
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
                              <span style="color: #4b5563;">
                                ${new Date(booking.startDate).toLocaleDateString('cs-CZ')} - ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}
                              </span>
                              <span style="color: #9ca3af;">•</span>
                              ${this.createRoomDisplay(booking, true)}
                            </div>
                          `
                            }
                        </div>
                    </div>

                    <div>
                        <strong style="color: var(--gray-600); font-size: 0.9rem;">Hosté:</strong>
                        <div style="margin-top: 0.75rem;">
                            ${
                              // For bulk bookings, show simplified view with "Celá chata"
                              booking.isBulkBooking || (booking.rooms && booking.rooms.length === 9)
                                ? `
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                              ${this.createRoomDisplay(booking, true)}
                              <span style="color: #4b5563;">
                                ${booking.adults} dosp., ${booking.children} děti, ${booking.toddlers || 0} bat.
                                <span style="color: #9ca3af; margin: 0 0.5rem;">•</span>
                                ${this.formatGuestTypeDisplay(booking)}
                              </span>
                            </div>
                          `
                                : booking.perRoomGuests && Object.keys(booking.perRoomGuests).length > 0
                                  ? booking.rooms
                                      .map((roomId) => {
                                        const guests = booking.perRoomGuests[roomId];
                                        if (guests) {
                                          // Skip rooms with no guests (0 adults AND 0 children)
                                          const hasGuests = guests.adults > 0 || guests.children > 0;
                                          if (!hasGuests) {
                                            return ''; // Don't display empty rooms
                                          }

                                          const guestType = guests.guestType || booking.guestType;
                                          return `
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                      ${this.createRoomBadge(roomId, true)}
                                      <span style="color: #4b5563;">
                                        ${guests.adults} dosp., ${guests.children} děti, ${guests.toddlers} bat.
                                        <span style="color: #9ca3af; margin: 0 0.5rem;">•</span>
                                        ${guestType === 'utia' ? 'ÚTIA' : 'Externí'}
                                      </span>
                                    </div>
                                  `;
                                        }
                                        return `
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                      ${this.createRoomBadge(roomId, true)}
                                      <span style="color: #9ca3af; font-size: 0.85rem;">Bez údajů</span>
                                    </div>
                                  `;
                                      })
                                      .join('')
                                  : `
                            <div style="color: #6b7280;">
                              Dospělí: ${booking.adults}, Děti: ${booking.children}, Batolata: ${booking.toddlers}
                              <div style="margin-top: 0.5rem; color: #9ca3af; font-size: 0.85rem;">
                                (Starší formát - bez rozdělení po pokojích)
                              </div>
                            </div>
                          `
                            }
                            <!-- Show totals in gray for reference (only for non-bulk with perRoomGuests) -->
                            ${
                              !(booking.isBulkBooking || (booking.rooms && booking.rooms.length === 9)) &&
                              booking.perRoomGuests &&
                              Object.keys(booking.perRoomGuests).length > 0
                                ? `
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 0.85rem;">
                              Celkem: ${booking.adults} dosp., ${booking.children} děti, ${booking.toddlers} bat.
                            </div>
                          `
                                : ''
                            }
                        </div>
                    </div>

                    ${
                      booking.guestNames && booking.guestNames.length > 0
                        ? `
                    <div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Jména hostů (podle pokojů):</strong>
                            <button
                                onclick="adminPanel.copyGuestNames('${booking.id}')"
                                style="padding: 0.4rem 0.8rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 0.4rem;"
                                onmouseover="this.style.background='#059669'"
                                onmouseout="this.style.background='#10b981'"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                                </svg>
                                Kopírovat
                            </button>
                        </div>
                        ${this.renderGuestNamesByRoom(booking)}
                    </div>
                    `
                        : ''
                    }

                    ${
                      // Show price breakdown:
                      // - Bulk bookings: ALWAYS show unified bulk format (even if price-locked)
                      // - Regular bookings (not price-locked): Show per-room breakdown
                      // - Regular bookings (price-locked): Show simple total price
                      booking.isBulkBooking || !booking.priceLocked
                        ? `
                    <div style="margin-bottom: 1rem;">
                        ${await this.generatePerRoomPriceBreakdown(booking)}
                    </div>
                    `
                        : `
                    <!-- Price-locked booking: Show simple total price -->
                    <div style="margin-bottom: 1rem;">
                      <div style="padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white;">
                        <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 700;">
                          <span>Celková cena:</span>
                          <span>${booking.totalPrice.toLocaleString('cs-CZ')} Kč</span>
                        </div>
                      </div>
                    </div>
                    `
                    }

                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        ${
                          booking.payFromBenefit
                            ? `
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Platba:</strong>
                            <div style="margin-top: 0.25rem;">
                                <span style="
                                    display: inline-block;
                                    padding: 0.25rem 0.75rem;
                                    background: #17a2b8;
                                    color: white;
                                    border-radius: 4px;
                                    font-weight: 600;
                                    font-size: 0.9rem;
                                ">💳 Z benefitů</span>
                            </div>
                        </div>
                        `
                            : ''
                        }
                    </div>

                    ${
                      booking.notes
                        ? `
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Poznámky:</strong>
                            <div style="margin-top: 0.25rem; padding: 0.75rem; background: var(--gray-50); border-radius: var(--radius-sm); white-space: pre-wrap;">
                                ${this.escapeHtml(booking.notes)}
                            </div>
                        </div>
                    `
                        : ''
                    }

                    <div style="padding-top: 1rem; border-top: 1px solid var(--gray-200);">
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; font-size: 0.85rem; color: var(--gray-500);">
                            <div>
                                <strong>Vytvořeno:</strong> ${new Date(booking.createdAt).toLocaleString('cs-CZ')}
                            </div>
                            ${
                              booking.updatedAt
                                ? `
                                <div>
                                    <strong>Upraveno:</strong> ${new Date(booking.updatedAt).toLocaleString('cs-CZ')}
                                </div>
                            `
                                : ''
                            }
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Zavřít</button>
                    <button class="btn btn-primary" onclick="adminPanel.editBooking('${booking.id}'); this.closest('.modal').remove()">Upravit rezervaci</button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
  }

  async editBooking(bookingId) {
    try {
      // Force fresh data from server (bypass cache)
      await dataManager.syncWithServer(true);

      const booking = await dataManager.getBooking(bookingId);
      if (!booking) {
        this.showErrorMessage('Rezervace nebyla nalezena. Zkuste obnovit stránku.');
        return;
      }

      // Store booking for reference
      this.currentEditBooking = booking;

      // Get settings
      const settings = await dataManager.getSettings();

      // Initialize EditBookingComponent for admin mode
      this.editComponent = new EditBookingComponent({
        mode: 'admin',
        enforceDeadline: false, // Admin can edit any time
        validateSession: () => this.validateSession(),
        onSubmit: (formData) => this.handleEditBookingSubmit(formData),
        onDelete: (id) => this.handleEditBookingDelete(id),
        settings,
      });

      // Load booking data into component
      this.editComponent.loadBooking(booking, settings);

      // Set modal title and button text for edit mode
      document.getElementById('editModalTitle').textContent = 'Upravit rezervaci';
      document.getElementById('editSubmitButton').textContent = 'Uložit změny';

      // Show modal
      this.editComponent.switchTab('dates');
      document.getElementById('editBookingModal').classList.add('active');
    } catch (error) {
      console.error('Error loading booking for edit:', error);
      this.showErrorMessage(error.message || 'Chyba při načítání rezervace. Zkuste obnovit stránku.');
    }
  }

  async handleEditBooking(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      // Use EditBookingComponent for validation and data collection
      await this.editComponent.validateForm();
      const formData = this.editComponent.getFormData();

      // Submit using component's data
      await this.handleEditBookingSubmit(formData);
    } catch (error) {
      console.error('Chyba při ukládání rezervace:', error);
      this.showErrorMessage(error.message || 'Nepodařilo se uložit rezervaci');
      // Switch to appropriate tab based on error
      if (error.message && error.message.includes('povinné údaje')) {
        this.editComponent.switchTab('billing');
      }
    }
  }

  /**
   * Submit handler called by EditBookingComponent
   */
  async handleEditBookingSubmit(formData) {
    try {
      const bookingId = formData.id;

      // Delete all proposed bookings for this edit session before saving final booking
      const sessionId = this.editComponent?.getSessionId();
      if (sessionId) {
        try {
          await fetch(`/api/proposed-bookings/session/${sessionId}`, {
            method: 'DELETE',
          });
          // Proposed bookings deleted for session
        } catch (error) {
          console.warn('Failed to delete proposed bookings:', error);
          // Continue with saving - this is not critical
        }
      }

      // Check if we're creating new booking or updating existing
      if (bookingId) {
        // Update existing booking via API (triggers email notification)
        const sessionToken = localStorage.getItem('adminSessionToken');
        const response = await fetch(`/api/booking/${bookingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': sessionToken,
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Nepodařilo se upravit rezervaci');
        }

        // Sync with server to get updated data (force refresh for immediate update)
        await dataManager.syncWithServer(true);

        this.showSuccessMessage('Rezervace byla úspěšně upravena');
      } else {
        // Create new booking via API (triggers email notification)
        const sessionToken = localStorage.getItem('adminSessionToken');
        const response = await fetch('/api/booking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': sessionToken,
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Nepodařilo se vytvořit rezervaci');
        }

        // Sync with server to get updated data (force refresh for immediate update)
        await dataManager.syncWithServer(true);

        this.showSuccessMessage('Rezervace byla úspěšně vytvořena');
      }

      document.getElementById('editBookingModal').classList.remove('active');
      await this.loadBookings();
    } catch (error) {
      console.error('Chyba při ukládání rezervace:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  /**
   * Delete handler called by EditBookingComponent
   */
  async handleEditBookingDelete(bookingId) {
    try {
      // Delete via API (triggers email notification)
      const sessionToken = localStorage.getItem('adminSessionToken');
      const response = await fetch(`/api/booking/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'x-session-token': sessionToken,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Nepodařilo se smazat rezervaci');
      }

      // Sync with server to get updated data (force refresh for immediate update)
      await dataManager.syncWithServer(true);

      this.showSuccessMessage('Rezervace byla smazána');
      document.getElementById('editBookingModal').classList.remove('active');
      await this.loadBookings();
    } catch (error) {
      console.error('Chyba při mazání rezervace:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  closeEditModal() {
    document.getElementById('editBookingModal').classList.remove('active');
  }

  async openCreateBookingModal() {
    // Set modal to create mode
    this.currentEditBooking = null;

    // Get settings
    const settings = await dataManager.getSettings();

    // Create empty booking object for new booking
    const emptyBooking = {
      id: null,
      name: '',
      email: '',
      phone: '',
      company: '',
      address: '',
      city: '',
      zip: '',
      ico: '',
      dic: '',
      notes: '',
      payFromBenefit: false,
      startDate: DateUtils.formatDate(new Date()),
      endDate: DateUtils.formatDate(new Date()),
      rooms: [],
      guestType: 'external',
      adults: 1,
      children: 0,
      toddlers: 0,
      totalPrice: 0,
      perRoomDates: {},
      perRoomGuests: {},
    };

    // Initialize EditBookingComponent for admin mode (create)
    this.editComponent = new EditBookingComponent({
      mode: 'admin',
      enforceDeadline: false, // Admin can create any time
      validateSession: () => this.validateSession(),
      onSubmit: (formData) => this.handleEditBookingSubmit(formData),
      onDelete: null, // No delete button for new bookings
      settings,
    });

    // Load empty booking data into component
    await this.editComponent.loadBooking(emptyBooking, settings);

    // Set modal title and button text for create mode
    document.getElementById('editModalTitle').textContent = 'Přidat rezervaci';
    document.getElementById('editSubmitButton').textContent = 'Vytvořit rezervaci';

    // Show modal
    this.editComponent.switchTab('dates');
    document.getElementById('editBookingModal').classList.add('active');
  }

  formatDate(date) {
    // Use DateUtils for SSOT compliance
    return DateUtils.formatDate(date);
  }

  deleteBooking(bookingId) {
    this.showConfirm('Opravdu chcete smazat tuto rezervaci?', async () => {
      // FIX: Validate session before admin operation
      if (!(await this.validateSession())) {
        return;
      }

      try {
        // Delete via API (triggers email notification)
        const sessionToken = localStorage.getItem('adminSessionToken');
        const response = await fetch(`/api/booking/${bookingId}`, {
          method: 'DELETE',
          headers: {
            'x-session-token': sessionToken,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Nepodařilo se smazat rezervaci');
        }

        // Track refresh failures to provide accurate user feedback
        const failures = [];

        // Sync with server to get updated data (force refresh)
        try {
          await dataManager.syncWithServer(true);
        } catch (error) {
          console.error('[Admin] Server sync failed after delete:', error);
          failures.push('synchronizace se serverem');
        }

        // Refresh admin bookings table
        try {
          await this.loadBookings();
        } catch (error) {
          console.error('[Admin] Failed to reload bookings table:', error);
          failures.push('obnovení seznamu rezervací');
        }

        // Refresh main calendar if it exists (in case user has index.html open in another tab)
        try {
          if (window.app && typeof window.app.renderCalendar === 'function') {
            await window.app.renderCalendar();
          }
        } catch (error) {
          console.warn('[Admin] Calendar refresh failed (non-critical):', error);
          // Calendar refresh is optional, don't add to failures
        }

        // Show appropriate message based on refresh results
        if (failures.length > 0) {
          this.showToast(
            `Rezervace smazána, ale selhalo: ${failures.join(', ')}. Obnovte stránku (F5).`,
            'warning'
          );
        } else {
          this.showSuccessMessage('Rezervace byla smazána');
        }
      } catch (error) {
        console.error('Chyba při mazání rezervace:', error);
        this.showToast(`Chyba: ${error.message}`, 'error');
      }
    });
  }

  // Bulk operations
  toggleBookingSelection(bookingId, checked) {
    if (checked) {
      this.selectedBookings.add(bookingId);
    } else {
      this.selectedBookings.delete(bookingId);
    }
    this.updateBulkActionsUI();
  }

  toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.booking-checkbox');
    checkboxes.forEach((checkbox) => {
      const bookingId = checkbox.getAttribute('data-booking-id');
      checkbox.checked = checked;
      if (checked) {
        this.selectedBookings.add(bookingId);
      } else {
        this.selectedBookings.delete(bookingId);
      }
    });
    this.updateBulkActionsUI();
  }

  updateBulkActionsUI() {
    const count = this.selectedBookings.size;
    const bulkActionsContainer = document.getElementById('bulkActionsContainer');
    const selectedCountElement = document.getElementById('selectedCount');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    if (count > 0) {
      bulkActionsContainer.style.display = 'flex';
      selectedCountElement.textContent = `${count} vybran${count === 1 ? 'á' : count <= 4 ? 'é' : 'ých'}`;

      // Update "select all" checkbox state
      const totalCheckboxes = document.querySelectorAll('.booking-checkbox').length;
      selectAllCheckbox.checked = count === totalCheckboxes;
      selectAllCheckbox.indeterminate = count > 0 && count < totalCheckboxes;
    } else {
      bulkActionsContainer.style.display = 'none';
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }

  // Alias for backward compatibility
  updateBulkActionButtons() {
    this.updateBulkActionsUI();
  }

  async bulkDeleteBookings() {
    const count = this.selectedBookings.size;
    if (count === 0) {
      return;
    }

    this.showConfirm(
      `Opravdu chcete smazat ${count} vybran${count === 1 ? 'ou rezervaci' : count <= 4 ? 'é rezervace' : 'ých rezervací'}?`,
      async () => {
        // FIX: Validate session before admin operation
        if (!(await this.validateSession())) {
          return;
        }

        // Get button element and store original content
        const deleteBtn = document.getElementById('bulkDeleteBtn');
        const originalHTML = deleteBtn ? deleteBtn.innerHTML : null;

        // Disable button and show loading state
        if (deleteBtn) {
          deleteBtn.disabled = true;
          deleteBtn.style.opacity = '0.6';
          deleteBtn.style.cursor = 'not-allowed';
          deleteBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="0.75"/>
            </svg>
            Mazání...
          `;

          // Add spin animation if not already present
          if (!document.getElementById('spinAnimation')) {
            const style = document.createElement('style');
            style.id = 'spinAnimation';
            style.textContent = `
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `;
            document.head.appendChild(style);
          }
        }

        const sessionToken = localStorage.getItem('adminSessionToken');
        let successCount = 0;
        let errorCount = 0;
        const successfullyDeleted = [];

        try {
          // Delete bookings one by one
          for (const bookingId of this.selectedBookings) {
            try {
              const response = await fetch(`/api/booking/${bookingId}`, {
                method: 'DELETE',
                headers: {
                  'x-session-token': sessionToken,
                },
              });

              if (response.ok) {
                successCount += 1;
                successfullyDeleted.push(bookingId);
              } else {
                errorCount += 1;
              }
            } catch (error) {
              errorCount += 1;
              console.error(`Chyba při mazání rezervace ${bookingId}:`, error);
            }
          }

          // Track refresh failures to provide accurate user feedback
          const refreshFailures = [];

          // Sync with server to get updated data (force refresh)
          try {
            await dataManager.syncWithServer(true);
          } catch (error) {
            console.error('[Admin] Server sync failed after bulk delete:', error);
            refreshFailures.push('synchronizace se serverem');
          }

          // Reload bookings table (this will update the UI)
          try {
            await this.loadBookings();
          } catch (error) {
            console.error('[Admin] Failed to reload bookings table:', error);
            refreshFailures.push('obnovení seznamu rezervací');
          }

          // Refresh main calendar if it exists (in case user has index.html open in another tab)
          try {
            if (window.app && typeof window.app.renderCalendar === 'function') {
              await window.app.renderCalendar();
            }
          } catch (error) {
            console.warn('[Admin] Calendar refresh failed (non-critical):', error);
            // Calendar refresh is optional, don't add to refreshFailures
          }

          // Clear only successfully deleted bookings from selection
          successfullyDeleted.forEach((id) => this.selectedBookings.delete(id));
          this.updateBulkActionButtons();

          // Show result message (considering both delete errors and refresh failures)
          if (errorCount === 0 && refreshFailures.length === 0) {
            this.showSuccessMessage(`Úspěšně smazáno ${successCount} rezervací`);
          } else {
            const messages = [];
            if (errorCount > 0) {
              messages.push(`${errorCount} se nepodařilo smazat`);
            }
            if (refreshFailures.length > 0) {
              messages.push(`selhalo: ${refreshFailures.join(', ')}`);
            }
            this.showToast(
              `Smazáno ${successCount} rezervací. ${messages.join(', ')}. Obnovte stránku (F5).`,
              'warning'
            );
          }
        } catch (error) {
          console.error('Chyba při hromadném mazání:', error);
          this.showToast(`Chyba: ${error.message}`, 'error');
        } finally {
          // Re-enable button and restore original content
          if (deleteBtn && originalHTML) {
            deleteBtn.disabled = false;
            deleteBtn.style.opacity = '1';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.innerHTML = originalHTML;
          }
        }
      }
    );
  }

  async bulkPrintBookings() {
    const count = this.selectedBookings.size;
    if (count === 0) {
      return;
    }

    try {
      // Fetch all selected bookings
      const bookings = [];
      for (const bookingId of this.selectedBookings) {
        const booking = await dataManager.getBooking(bookingId);
        if (booking) {
          bookings.push(booking);
        }
      }

      if (bookings.length === 0) {
        this.showToast('Žádné rezervace k tisku', 'error');
        return;
      }

      // Generate print-friendly HTML
      const printHTML = this.generatePrintHTML(bookings);

      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      // Write content to iframe
      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(printHTML);
      iframeDoc.close();

      // Wait for images to load (if any)
      iframe.contentWindow.onload = () => {
        // Trigger print dialog
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        // Remove iframe after printing (with delay for print dialog)
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      };
    } catch (error) {
      console.error('Chyba při tisku:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  generatePrintHTML(bookings) {
    const html = `
      <!DOCTYPE html>
      <html lang="cs">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tisk rezervací - Chata Mariánská</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #333;
            padding: 20mm;
          }

          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #0d9488;
          }

          .header h1 {
            font-size: 24pt;
            color: #0d9488;
            margin-bottom: 10px;
          }

          .header p {
            font-size: 11pt;
            color: #666;
          }

          .booking-card {
            page-break-inside: avoid;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            background: #f9fafb;
          }

          .booking-card:not(:first-child) {
            page-break-before: always;
          }

          .booking-header {
            background: #0d9488;
            color: white;
            padding: 15px;
            margin: -20px -20px 20px -20px;
            border-radius: 6px 6px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .booking-id {
            font-size: 14pt;
            font-weight: bold;
          }

          .booking-status {
            display: inline-block;
            padding: 5px 15px;
            background: white;
            color: #0d9488;
            border-radius: 20px;
            font-size: 10pt;
            font-weight: 600;
          }

          .section {
            margin-bottom: 20px;
          }

          .section-title {
            font-size: 11pt;
            font-weight: bold;
            color: #0d9488;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #d1d5db;
          }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 15px;
          }

          .info-item {
            display: flex;
            flex-direction: column;
          }

          .info-label {
            font-size: 9pt;
            color: #6b7280;
            font-weight: 600;
            margin-bottom: 3px;
          }

          .info-value {
            font-size: 11pt;
            color: #1f2937;
          }

          .room-badge {
            display: inline-block;
            padding: 5px 12px;
            background: #10b981;
            color: white;
            border-radius: 6px;
            font-weight: bold;
            margin-right: 8px;
            margin-bottom: 5px;
          }

          .guest-names {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #10b981;
          }

          .guest-name {
            padding: 5px 0;
            display: flex;
            align-items: center;
          }

          .guest-name::before {
            content: '👤';
            margin-right: 8px;
          }

          .price-summary {
            background: #fef3c7;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #f59e0b;
            margin-top: 20px;
          }

          .total-price {
            font-size: 16pt;
            font-weight: bold;
            color: #b45309;
          }

          .notes {
            background: white;
            padding: 15px;
            border-radius: 6px;
            font-style: italic;
            color: #4b5563;
          }

          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            font-size: 9pt;
            color: #9ca3af;
          }

          @media print {
            body {
              padding: 10mm;
            }

            .booking-card {
              page-break-after: always;
            }

            .booking-card:last-child {
              page-break-after: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏔️ Chata Mariánská</h1>
          <p>Přehled vybraných rezervací</p>
          <p style="margin-top: 5px;">Vytištěno: ${new Date().toLocaleString('cs-CZ')}</p>
        </div>

        ${bookings
          .map(
            (booking) => `
          <div class="booking-card">
            <div class="booking-header">
              <span class="booking-id">Rezervace #${this.escapeHtml(booking.id)}</span>
              <span class="booking-status">${booking.paid ? '✓ Zaplaceno' : 'Nezaplaceno'}</span>
            </div>

            <div class="section">
              <div class="section-title">Kontaktní údaje</div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Jméno a příjmení</span>
                  <span class="info-value">${this.escapeHtml(booking.name)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Email</span>
                  <span class="info-value">${this.escapeHtml(booking.email)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Telefon</span>
                  <span class="info-value">${this.escapeHtml(booking.phone)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Firma</span>
                  <span class="info-value">${this.escapeHtml(booking.company) || '-'}</span>
                </div>
              </div>
              <div class="info-item">
                <span class="info-label">Adresa</span>
                <span class="info-value">${this.escapeHtml(booking.address)}, ${this.escapeHtml(booking.city)} ${this.escapeHtml(booking.zip)}</span>
              </div>
              ${
                booking.ico || booking.dic
                  ? `
              <div class="info-grid" style="margin-top: 10px;">
                ${
                  booking.ico
                    ? `
                <div class="info-item">
                  <span class="info-label">IČO</span>
                  <span class="info-value">${this.escapeHtml(booking.ico)}</span>
                </div>
                `
                    : ''
                }
                ${
                  booking.dic
                    ? `
                <div class="info-item">
                  <span class="info-label">DIČ</span>
                  <span class="info-value">${this.escapeHtml(booking.dic)}</span>
                </div>
                `
                    : ''
                }
              </div>
              `
                  : ''
              }
            </div>

            <div class="section">
              <div class="section-title">Detaily rezervace</div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Datum příjezdu</span>
                  <span class="info-value">${new Date(booking.startDate).toLocaleDateString('cs-CZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Datum odjezdu</span>
                  <span class="info-value">${new Date(booking.endDate).toLocaleDateString('cs-CZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Počet nocí</span>
                  <span class="info-value">${Math.ceil((new Date(booking.endDate) - new Date(booking.startDate)) / (1000 * 60 * 60 * 24))} nocí</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Typ hosta</span>
                  <span class="info-value">${this.formatGuestTypeDisplay(booking)}</span>
                </div>
              </div>
              <div class="info-item" style="margin-top: 15px;">
                <span class="info-label">Pokoje</span>
                <div style="margin-top: 5px;">
                  ${booking.rooms.map((roomId) => `<span class="room-badge">P${roomId}</span>`).join('')}
                </div>
              </div>
              ${
                booking.perRoomDates && Object.keys(booking.perRoomDates).length > 0
                  ? `
              <div class="info-item" style="margin-top: 15px;">
                <span class="info-label">Termíny jednotlivých pokojů</span>
                <div style="margin-top: 5px;">
                  ${booking.rooms
                    .map((roomId) => {
                      const dates = booking.perRoomDates[roomId];
                      if (dates) {
                        return `<div style="margin: 5px 0;"><span class="room-badge">P${roomId}</span> ${new Date(dates.startDate).toLocaleDateString('cs-CZ')} - ${new Date(dates.endDate).toLocaleDateString('cs-CZ')}</div>`;
                      }
                      return '';
                    })
                    .join('')}
                </div>
              </div>
              `
                  : ''
              }
            </div>

            <div class="section">
              <div class="section-title">Hosté</div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Dospělí (18+ let)</span>
                  <span class="info-value">${booking.adults || 0} osob</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Děti (3-17 let)</span>
                  <span class="info-value">${booking.children || 0} dětí</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Batolata (0-2 roky)</span>
                  <span class="info-value">${booking.toddlers || 0} batolat</span>
                </div>
              </div>
              ${
                booking.guestNames &&
                Array.isArray(booking.guestNames) &&
                booking.guestNames.length > 0
                  ? `
              <div class="guest-names" style="margin-top: 15px;">
                <div class="info-label" style="margin-bottom: 10px;">Jména ubytovaných osob</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                  ${
                    booking.guestNames.filter((g) => g.personType === 'adult').length > 0
                      ? `
                  <div>
                    <div style="font-weight: 600; color: #4b5563; font-size: 0.85rem; margin-bottom: 0.5rem;">Dospělí:</div>
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                      ${booking.guestNames
                        .filter((g) => g.personType === 'adult')
                        .map(
                          (guest) =>
                            `<div class="guest-name">${this.escapeHtml(guest.firstName)} ${this.escapeHtml(guest.lastName)}</div>`
                        )
                        .join('')}
                    </div>
                  </div>
                  `
                      : ''
                  }
                  ${
                    booking.guestNames.filter((g) => g.personType === 'child').length > 0
                      ? `
                  <div>
                    <div style="font-weight: 600; color: #4b5563; font-size: 0.85rem; margin-bottom: 0.5rem;">Děti:</div>
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                      ${booking.guestNames
                        .filter((g) => g.personType === 'child')
                        .map(
                          (guest) =>
                            `<div class="guest-name">${this.escapeHtml(guest.firstName)} ${this.escapeHtml(guest.lastName)}</div>`
                        )
                        .join('')}
                    </div>
                  </div>
                  `
                      : ''
                  }
                </div>
              </div>
              `
                  : ''
              }
            </div>

            ${
              booking.notes
                ? `
            <div class="section">
              <div class="section-title">Poznámky</div>
              <div class="notes">${this.escapeHtml(booking.notes)}</div>
            </div>
            `
                : ''
            }

            <div class="price-summary">
              <div class="info-label">Celková cena</div>
              <div class="total-price">${booking.totalPrice} Kč</div>
              ${booking.payFromBenefit ? '<div style="margin-top: 10px; color: #0891b2; font-weight: 600;">💳 Platba benefitem</div>' : ''}
            </div>
          </div>
        `
          )
          .join('')}

        <div class="footer">
          <p>Tento dokument byl vygenerován automaticky ze systému Chata Mariánská</p>
          <p style="margin-top: 5px;">www.chata.utia.cas.cz | chata@utia.cas.cz</p>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  async togglePaidStatus(bookingId, paid) {
    // Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const booking = await dataManager.getBooking(bookingId);
      if (!booking) {
        this.showToast('Rezervace nenalezena', 'error');
        return;
      }

      // Update paid status on server via API (triggers email notification)
      const sessionToken = localStorage.getItem('adminSessionToken');
      const response = await fetch(`/api/booking/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({
          ...booking,
          paid,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Nepodařilo se aktualizovat stav platby');
      }

      // Sync with server to get updated data
      await dataManager.syncWithServer();

      // Reload bookings table to reflect changes
      await this.loadBookings();

      this.showToast(
        paid ? 'Rezervace označena jako zaplacená' : 'Rezervace označena jako nezaplacená',
        'success'
      );
    } catch (error) {
      console.error('Chyba při změně stavu platby:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
      // Reload to show original state on error
      await this.loadBookings();
    }
  }

  async loadBlockedDates() {
    const blockageInstances = await dataManager.getAllBlockageInstances();
    const container = document.getElementById('blockedDatesList');

    if (!container) {
      console.error('Container blockedDatesList not found!');
      return;
    }

    container.innerHTML = '';
    container.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 1rem;
            padding: 0.5rem 0;
        `;

    // Show blockages that haven't ended yet (end date >= 30 days ago)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const relevantBlockages = blockageInstances.filter((blockage) => {
      const endDate = new Date(blockage.endDate);
      return endDate >= thirtyDaysAgo;
    });

    // Sort blockages by start date (newest first)
    const sortedBlockages = relevantBlockages.sort(
      (a, b) => new Date(b.startDate) - new Date(a.startDate)
    );

    if (sortedBlockages.length === 0) {
      container.innerHTML =
        '<p style="text-align: center; color: var(--gray-500);">Žádné blokované termíny</p>';
      return;
    }

    // Display each blockage instance as a card
    sortedBlockages.forEach((blockage) => {
      const card = document.createElement('div');
      card.className = 'blocked-date-card';
      card.style.cssText = `
                padding: 1rem;
                background: white;
                border: 1px solid var(--gray-200);
                border-radius: var(--radius-md);
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                min-height: 150px;
            `;

      const startDate = new Date(blockage.startDate);
      const endDate = new Date(blockage.endDate);
      const isSingleDay = blockage.startDate === blockage.endDate;

      card.innerHTML = `
                <div style="flex: 1;">
                    <div style="color: var(--gray-400); font-size: 0.65rem; font-family: monospace; margin-bottom: 0.25rem; opacity: 0.7;">${blockage.blockageId}</div>
                    <div style="font-weight: 600; color: var(--gray-900); font-size: 0.95rem; margin-bottom: 0.5rem;">
                        ${
                          isSingleDay
                            ? startDate.toLocaleDateString('cs-CZ')
                            : `${startDate.toLocaleDateString('cs-CZ')} - ${endDate.toLocaleDateString('cs-CZ')}`
                        }
                    </div>
                    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.8rem; color: var(--gray-600);">Pokoje:</span>
                        ${
                          blockage.rooms.length > 0
                            ? blockage.rooms
                                .map((roomId) => this.createRoomBadge(roomId, true))
                                .join('')
                            : '<span style="color: var(--gray-700); font-size: 0.85rem;">Všechny pokoje</span>'
                        }
                    </div>
                    <div style="font-size: 0.8rem; color: var(--gray-600);">
                        <strong>Důvod:</strong> <em>${blockage.reason || 'Bez uvedení důvodu'}</em>
                    </div>
                </div>
                <div style="margin-top: auto; padding-top: 0.5rem;">
                    <button onclick="adminPanel.unblockRange('${blockage.blockageId}').catch(console.error)"
                            style="width: 100%; padding: 0.5rem; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.85rem; transition: background 0.2s;"
                            onmouseover="this.style.background='#b91c1c'"
                            onmouseout="this.style.background='#dc2626'">
                        Odblokovat
                    </button>
                </div>
            `;
      container.appendChild(card);
    });
  }

  toggleAllRooms(checkbox) {
    const roomCheckboxes = document.querySelectorAll('.room-checkbox');
    roomCheckboxes.forEach((cb) => {
      const checkBox = cb;
      checkBox.checked = checkbox.checked;
    });
  }

  async handleBlockDate(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    const startDate = document.getElementById('blockDateStart').value;
    const endDate = document.getElementById('blockDateEnd').value;
    const reason = document.getElementById('blockReason').value;

    // Get selected rooms
    const selectedRooms = [];
    const roomCheckboxes = document.querySelectorAll('.room-checkbox:checked');
    roomCheckboxes.forEach((cb) => {
      selectedRooms.push(cb.value);
    });

    // Validate dates
    if (new Date(endDate) < new Date(startDate)) {
      this.showErrorMessage('Konec období musí být po začátku');
      return;
    }

    // Create ONE blockage instance with date range and rooms
    try {
      await dataManager.createBlockageInstance(
        startDate,
        endDate,
        selectedRooms, // Empty array = all rooms
        reason
      );

      e.target.reset();
      document.getElementById('blockAll').checked = false;
      await this.loadBlockedDates();

      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const roomsText =
        selectedRooms.length > 0 ? `pokoje ${selectedRooms.join(', ')}` : 'všechny pokoje';
      this.showSuccessMessage(`Vytvořena blokace: ${daysCount} dní pro ${roomsText}`);
    } catch (error) {
      console.error('Error creating blockage:', error);
      this.showErrorMessage(`Chyba při vytváření blokace: ${error.message}`);
    }
  }

  async unblockDate(date, roomId) {
    try {
      await dataManager.unblockDate(new Date(date), roomId || null);
      await this.loadBlockedDates();
      this.showSuccessMessage('Termín byl odblokován');
    } catch (error) {
      console.error('Chyba při odblokování termínu:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  async unblockRange(blockageId) {
    try {
      await dataManager.deleteBlockageInstance(blockageId);
      await this.loadBlockedDates();
      this.showSuccessMessage('Blokace byla odstraněna');
    } catch (error) {
      console.error('Error unblocking range:', error);
      this.showErrorMessage(`Chyba při odblokování: ${error.message}`);
    }
  }

  async loadChristmasCodes() {
    const settings = await dataManager.getSettings();
    const codes = settings.christmasAccessCodes || [];
    const container = document.getElementById('christmasCodesList');

    container.innerHTML = '';

    codes.forEach((code) => {
      const chip = document.createElement('div');
      chip.className = 'code-chip';
      chip.innerHTML = `
                <span>${code}</span>
                <button onclick="adminPanel.removeCode('${code}').catch(console.error)">&times;</button>
            `;
      container.appendChild(chip);
    });

    if (codes.length === 0) {
      container.innerHTML = '<p style="color: var(--gray-500);">Žádné přístupové kódy</p>';
    }
  }

  async handleAddCode(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const newCode = document.getElementById('newCode').value.trim();

      if (!newCode) {
        this.showToast('Zadejte platný kód', 'warning');
        return;
      }

      const settings = await dataManager.getSettings();

      if (!settings.christmasAccessCodes) {
        settings.christmasAccessCodes = [];
      }

      if (settings.christmasAccessCodes.includes(newCode)) {
        this.showToast('Tento kód již existuje', 'warning');
        return;
      }

      settings.christmasAccessCodes.push(newCode);
      await dataManager.updateSettings(settings);

      // Synchronizuj s serverem pro jistotu
      await dataManager.syncWithServer();

      e.target.reset();
      await this.loadChristmasCodes();

      this.showToast(`Přístupový kód "${newCode}" byl úspěšně přidán`, 'success');
    } catch (error) {
      console.error('Chyba při přidávání kódu:', error);
      this.showToast(`Chyba při přidávání kódu: ${error.message}`, 'error');
    }
  }

  async removeCode(code) {
    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      // Získej aktuální nastavení
      const settings = await dataManager.getSettings();

      // Odstraň kód ze seznamu
      const originalCount = settings.christmasAccessCodes
        ? settings.christmasAccessCodes.length
        : 0;
      settings.christmasAccessCodes = settings.christmasAccessCodes.filter((c) => c !== code);
      const newCount = settings.christmasAccessCodes.length;

      // Ulož změny na server
      await dataManager.updateSettings(settings);

      // Synchronizuj s serverem pro jistotu
      await dataManager.syncWithServer();

      // Znovu načti kódy pro zobrazení
      await this.loadChristmasCodes();

      // Ověř, že se změna skutečně provedla
      if (originalCount > newCount) {
        this.showToast(`Přístupový kód "${code}" byl úspěšně odebrán`, 'success');
      } else {
        this.showToast('Kód nebyl nalezen nebo už byl odstraněn', 'warning');
      }
    } catch (error) {
      console.error('Chyba při odstraňování kódu:', error);
      this.showToast(`Chyba při odstraňování kódu: ${error.message}`, 'error');
    }
  }

  async loadChristmasPeriods() {
    const settings = await dataManager.getSettings();
    const container = document.getElementById('christmasPeriodsContainer');

    // Convert old single period format to new array format
    if (settings.christmasPeriod && !settings.christmasPeriods) {
      settings.christmasPeriods = [settings.christmasPeriod];
      delete settings.christmasPeriod;
      try {
        await dataManager.updateSettings(settings);
      } catch (error) {
        // If migration fails (e.g., session expired), continue with local data
        // Migration will happen again when user successfully saves
        console.warn('Christmas period migration skipped:', error.message);
      }
    }

    const periods = settings.christmasPeriods || [];
    container.innerHTML = '';

    if (periods.length === 0) {
      container.innerHTML =
        '<p style="color: var(--gray-500); text-align: center; padding: 2rem;">Žádná vánoční období nejsou nastavena</p>';
      return;
    }

    // Sort periods by start date
    periods.sort((a, b) => new Date(a.start) - new Date(b.start));

    periods.forEach((period, index) => {
      const startDate = new Date(period.start);
      const endDate = new Date(period.end);
      const year = period.year || startDate.getFullYear();

      const card = document.createElement('div');
      card.className = 'christmas-period-card';
      card.innerHTML = `
                <div class="christmas-period-info">
                    <div class="christmas-period-dates">
                        ${startDate.toLocaleDateString('cs-CZ')} - ${endDate.toLocaleDateString('cs-CZ')}
                    </div>
                    <div class="christmas-period-year">Rok ${year}</div>
                </div>
                <button onclick="adminPanel.removeChristmasPeriod('${period.periodId || index}', ${index}).catch(console.error)"
                        class="btn-danger btn-small"
                        style="padding: 0.5rem 1rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; transition: background 0.2s;"
                        onmouseover="this.style.background='#b91c1c'"
                        onmouseout="this.style.background='#dc2626'">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                    </svg>
                    Odstranit
                </button>
            `;
      container.appendChild(card);
    });
  }

  async handleChristmasPeriod(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const startDate = document.getElementById('christmasStart').value;
      const endDate = document.getElementById('christmasEnd').value;

      if (!startDate || !endDate) {
        this.showToast('Vyplňte začátek a konec období', 'warning');
        return;
      }

      if (new Date(endDate) < new Date(startDate)) {
        this.showToast('Konec období musí být po začátku', 'warning');
        return;
      }

      // Automatically determine year from start date
      const year = new Date(startDate).getFullYear();

      const settings = await dataManager.getSettings();

      // Initialize christmasPeriods array if it doesn't exist
      if (!settings.christmasPeriods) {
        settings.christmasPeriods = [];
      }

      // Check for overlapping periods
      const newPeriod = {
        start: startDate,
        end: endDate,
        year,
        periodId: IdGenerator.generateChristmasPeriodId(), // Generate unique ID for reliable deletion
      };
      const overlapping = settings.christmasPeriods.some((period) => {
        const periodStart = new Date(period.start);
        const periodEnd = new Date(period.end);
        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);

        return newStart <= periodEnd && newEnd >= periodStart;
      });

      if (overlapping) {
        this.showToast('Toto období se překrývá s již existujícím obdobím', 'warning');
        return;
      }

      settings.christmasPeriods.push(newPeriod);
      await dataManager.updateSettings(settings);
      await dataManager.syncWithServer();

      // Clear form
      e.target.reset();

      await this.loadChristmasPeriods();
      this.showToast(`Vánoční období ${year} bylo přidáno`, 'success');
    } catch (error) {
      console.error('Chyba při přidávání vánočního období:', error);
      this.showToast(`Chyba při přidávání vánočního období: ${error.message}`, 'error');
    }
  }

  async removeChristmasPeriod(periodId, index) {
    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const settings = await dataManager.getSettings();

      // Try to find period either by periodId or by index for backward compatibility
      // FIX: Detect if periodId is an actual ID (starts with 'XMAS') or a stringified index
      let period = null;
      const isActualPeriodId = typeof periodId === 'string' && periodId.startsWith('XMAS');

      if (isActualPeriodId) {
        period = settings.christmasPeriods?.find((p) => p.periodId === periodId);
      }
      // Fallback to index-based lookup if period not found by ID
      if (!period && settings.christmasPeriods && settings.christmasPeriods[index]) {
        period = settings.christmasPeriods[index];
      }

      if (!period) {
        this.showToast('Vánoční období nebylo nalezeno', 'warning');
        return;
      }

      const startDate = new Date(period.start).toLocaleDateString('cs-CZ');
      const endDate = new Date(period.end).toLocaleDateString('cs-CZ');
      const year = period.year || new Date(period.start).getFullYear();

      // Use showConfirm instead of confirm
      const self = this; // Capture 'this' context
      this.showConfirm(
        `Opravdu chcete odstranit vánoční období ${year}?<br>${startDate} - ${endDate}`,
        async () => {
          try {
            // ✅ FIX: Use DataManager pattern like Christmas codes (SSOT)
            // Filter out the period from the array
            if (period.periodId) {
              settings.christmasPeriods = settings.christmasPeriods.filter(
                (p) => p.periodId !== period.periodId
              );
            } else {
              // Fallback for periods without periodId
              settings.christmasPeriods.splice(index, 1);
            }

            // Update through DataManager (auto-syncs with server)
            await dataManager.updateSettings(settings);

            // Force refresh from server to ensure sync
            await dataManager.syncWithServer(true);

            // Reload the periods list
            await self.loadChristmasPeriods();

            self.showToast(`Vánoční období ${year} bylo odstraněno`, 'success');
          } catch (error) {
            console.error('Chyba při odstraňování vánočního období:', error);
            // Reload to show original state on error
            await self.loadChristmasPeriods();
            self.showToast(`Chyba při odstraňování vánočního období: ${error.message}`, 'error');
          }
        }
      );
    } catch (error) {
      console.error('Chyba při odstraňování vánočního období:', error);
      this.showToast(`Chyba při odstraňování vánočního období: ${error.message}`, 'error');
    }
  }

  async loadRoomConfig() {
    const settings = await dataManager.getSettings();
    const data = await dataManager.getData();
    const rooms = settings.rooms || data.rooms;

    // Store current room data for preserving type field
    this.currentRooms = rooms;

    // Default room configuration in case data is missing
    const defaultRooms = {
      12: 2,
      13: 3,
      14: 4,
      22: 2,
      23: 3,
      24: 4,
      42: 2,
      43: 2,
      44: 4,
    };

    // Load current room configuration
    if (rooms && Array.isArray(rooms)) {
      rooms.forEach((room) => {
        const bedsInput = document.getElementById(`room${room.id}_beds`);
        // const typeSelect = document.getElementById(`room${room.id}_type`); // Reserved for future use
        if (bedsInput) {
          // Use room.beds if it exists and is a valid number, otherwise use default
          const bedsValue =
            room.beds !== undefined && room.beds !== null && !isNaN(room.beds)
              ? room.beds
              : defaultRooms[room.id] || 2;
          bedsInput.value = bedsValue;
        }
      });
    } else {
      // If no rooms data, load defaults
      Object.keys(defaultRooms).forEach((roomId) => {
        const bedsInput = document.getElementById(`room${roomId}_beds`);
        if (bedsInput) {
          bedsInput.value = defaultRooms[roomId];
        }
      });
    }
  }

  async handleRoomConfig(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const roomIds = ['12', '13', '14', '22', '23', '24', '42', '43', '44'];
      const newRooms = roomIds.map((id) => {
        const beds = parseInt(document.getElementById(`room${id}_beds`).value, 10);

        // Find existing room data to preserve type
        const existingRoom = this.currentRooms?.find((r) => r.id === id);

        return {
          id,
          name: `${langManager.t('room')} ${id}`,
          type: existingRoom?.type || 'standard',
          beds,
        };
      });

      // Validate
      if (newRooms.some((r) => isNaN(r.beds) || r.beds < 1)) {
        this.showToast('Neplatný počet lůžek', 'error');
        return;
      }

      // Update settings
      const settings = await dataManager.getSettings();
      settings.rooms = newRooms;
      await dataManager.updateSettings(settings);

      // Update data storage (backward compatibility)
      const data = await dataManager.getData();
      data.rooms = newRooms;
      await dataManager.saveData(data);

      // Force sync with server
      await dataManager.syncWithServer();

      this.showSuccessMessage('Konfigurace pokojů byla uložena');

      // Refresh the main app if it's loaded
      if (window.bookingApp) {
        window.bookingApp.renderCalendar();
        window.bookingApp.updateRoomSelection();
      }
    } catch (error) {
      console.error('Chyba při ukládání konfigurace pokojů:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  async loadPriceConfig() {
    const settings = await dataManager.getSettings();
    // NEW (2025-10-17): Room-size-based pricing defaults
    const defaultPrices = PriceCalculator.getDefaultPrices();
    const prices = settings.prices || defaultPrices;

    // Load UTIA Small room prices
    const utiaSmallBaseEl = document.getElementById('utia_small_base');
    const utiaSmallAdultEl = document.getElementById('utia_small_adult');
    const utiaSmallChildEl = document.getElementById('utia_small_child');

    if (utiaSmallBaseEl) {
      // Backward compatibility: Try 'empty' first, fall back to 'base'
      const emptyPrice =
        prices.utia?.small?.empty !== undefined
          ? prices.utia.small.empty
          : prices.utia?.small?.base !== undefined
            ? prices.utia.small.base - (prices.utia.small.adult || 0)
            : defaultPrices.utia.small.base - defaultPrices.utia.small.adult;
      utiaSmallBaseEl.value = emptyPrice;
    }
    if (utiaSmallAdultEl) {
      utiaSmallAdultEl.value = prices.utia?.small?.adult || defaultPrices.utia.small.adult;
    }
    if (utiaSmallChildEl) {
      utiaSmallChildEl.value = prices.utia?.small?.child || defaultPrices.utia.small.child;
    }

    // Load UTIA Large room prices
    const utiaLargeBaseEl = document.getElementById('utia_large_base');
    const utiaLargeAdultEl = document.getElementById('utia_large_adult');
    const utiaLargeChildEl = document.getElementById('utia_large_child');

    if (utiaLargeBaseEl) {
      // Backward compatibility: Try 'empty' first, fall back to 'base'
      const emptyPrice =
        prices.utia?.large?.empty !== undefined
          ? prices.utia.large.empty
          : prices.utia?.large?.base !== undefined
            ? prices.utia.large.base - (prices.utia.large.adult || 0)
            : defaultPrices.utia.large.base - defaultPrices.utia.large.adult;
      utiaLargeBaseEl.value = emptyPrice;
    }
    if (utiaLargeAdultEl) {
      utiaLargeAdultEl.value = prices.utia?.large?.adult || defaultPrices.utia.large.adult;
    }
    if (utiaLargeChildEl) {
      utiaLargeChildEl.value = prices.utia?.large?.child || defaultPrices.utia.large.child;
    }

    // Load External Small room prices
    const externalSmallBaseEl = document.getElementById('external_small_base');
    const externalSmallAdultEl = document.getElementById('external_small_adult');
    const externalSmallChildEl = document.getElementById('external_small_child');

    if (externalSmallBaseEl) {
      // Backward compatibility: Try 'empty' first, fall back to 'base'
      const emptyPrice =
        prices.external?.small?.empty !== undefined
          ? prices.external.small.empty
          : prices.external?.small?.base !== undefined
            ? prices.external.small.base - (prices.external.small.adult || 0)
            : defaultPrices.external.small.base - defaultPrices.external.small.adult;
      externalSmallBaseEl.value = emptyPrice;
    }
    if (externalSmallAdultEl) {
      externalSmallAdultEl.value =
        prices.external?.small?.adult || defaultPrices.external.small.adult;
    }
    if (externalSmallChildEl) {
      externalSmallChildEl.value =
        prices.external?.small?.child || defaultPrices.external.small.child;
    }

    // Load External Large room prices
    const externalLargeBaseEl = document.getElementById('external_large_base');
    const externalLargeAdultEl = document.getElementById('external_large_adult');
    const externalLargeChildEl = document.getElementById('external_large_child');

    if (externalLargeBaseEl) {
      // Backward compatibility: Try 'empty' first, fall back to 'base'
      const emptyPrice =
        prices.external?.large?.empty !== undefined
          ? prices.external.large.empty
          : prices.external?.large?.base !== undefined
            ? prices.external.large.base - (prices.external.large.adult || 0)
            : defaultPrices.external.large.base - defaultPrices.external.large.adult;
      externalLargeBaseEl.value = emptyPrice;
    }
    if (externalLargeAdultEl) {
      externalLargeAdultEl.value =
        prices.external?.large?.adult || defaultPrices.external.large.adult;
    }
    if (externalLargeChildEl) {
      externalLargeChildEl.value =
        prices.external?.large?.child || defaultPrices.external.large.child;
    }
  }

  async handlePriceConfig(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      // NEW (2025-11-04): Room-size-based pricing with empty room model
      const prices = {
        utia: {
          small: {
            empty: parseInt(document.getElementById('utia_small_base').value, 10),
            adult: parseInt(document.getElementById('utia_small_adult').value, 10),
            child: parseInt(document.getElementById('utia_small_child').value, 10),
          },
          large: {
            empty: parseInt(document.getElementById('utia_large_base').value, 10),
            adult: parseInt(document.getElementById('utia_large_adult').value, 10),
            child: parseInt(document.getElementById('utia_large_child').value, 10),
          },
        },
        external: {
          small: {
            empty: parseInt(document.getElementById('external_small_base').value, 10),
            adult: parseInt(document.getElementById('external_small_adult').value, 10),
            child: parseInt(document.getElementById('external_small_child').value, 10),
          },
          large: {
            empty: parseInt(document.getElementById('external_large_base').value, 10),
            adult: parseInt(document.getElementById('external_large_adult').value, 10),
            child: parseInt(document.getElementById('external_large_child').value, 10),
          },
        },
      };

      const settings = await dataManager.getSettings();
      settings.prices = prices;
      await dataManager.updateSettings(settings);

      this.showSuccessMessage('Ceník byl uložen');

      // Refresh price calculations if booking app is loaded
      if (window.bookingApp) {
        window.bookingApp.updatePriceCalculation();
      }
    } catch (error) {
      console.error('Chyba při ukládání ceníku:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  async loadBulkPriceConfig() {
    const settings = await dataManager.getSettings();
    const defaultBulkPrices = {
      basePrice: 2000,
      utiaAdult: 100,
      utiaChild: 0,
      externalAdult: 250,
      externalChild: 50,
    };
    const bulkPrices = settings.bulkPrices || defaultBulkPrices;

    // Load bulk pricing values with fallbacks
    const bulkBasePriceEl = document.getElementById('bulk_base_price');
    const bulkUtiaAdultEl = document.getElementById('bulk_utia_adult');
    const bulkUtiaChildEl = document.getElementById('bulk_utia_child');
    const bulkExternalAdultEl = document.getElementById('bulk_external_adult');
    const bulkExternalChildEl = document.getElementById('bulk_external_child');

    if (bulkBasePriceEl) {
      bulkBasePriceEl.value = bulkPrices.basePrice || defaultBulkPrices.basePrice;
    }
    if (bulkUtiaAdultEl) {
      bulkUtiaAdultEl.value = bulkPrices.utiaAdult || defaultBulkPrices.utiaAdult;
    }
    if (bulkUtiaChildEl) {
      bulkUtiaChildEl.value = bulkPrices.utiaChild || defaultBulkPrices.utiaChild;
    }
    if (bulkExternalAdultEl) {
      bulkExternalAdultEl.value = bulkPrices.externalAdult || defaultBulkPrices.externalAdult;
    }
    if (bulkExternalChildEl) {
      bulkExternalChildEl.value = bulkPrices.externalChild || defaultBulkPrices.externalChild;
    }
  }

  async handleBulkPriceConfig(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const bulkPrices = {
        basePrice: parseInt(document.getElementById('bulk_base_price').value, 10),
        utiaAdult: parseInt(document.getElementById('bulk_utia_adult').value, 10),
        utiaChild: parseInt(document.getElementById('bulk_utia_child').value, 10),
        externalAdult: parseInt(document.getElementById('bulk_external_adult').value, 10),
        externalChild: parseInt(document.getElementById('bulk_external_child').value, 10),
      };

      const settings = await dataManager.getSettings();
      settings.bulkPrices = bulkPrices;
      await dataManager.updateSettings(settings);

      this.showSuccessMessage('Ceník hromadné rezervace byl uložen');
    } catch (error) {
      console.error('Chyba při ukládání bulk ceníku:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
      return; // Early return to prevent executing code below
    }

    // Refresh bulk booking price calculations if booking app is loaded
    if (window.bookingApp && window.bookingApp.updateBulkPriceCalculation) {
      window.bookingApp.updateBulkPriceCalculation();
    }
  }

  async handleChangePassword(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // First verify current password
    const isAuthenticated = await dataManager.authenticateAdmin(currentPassword);
    if (!isAuthenticated) {
      this.showErrorMessage('Nesprávné současné heslo');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showErrorMessage('Nová hesla se neshodují');
      return;
    }

    if (newPassword.length < 8) {
      this.showErrorMessage('Nové heslo musí mít alespoň 8 znaků');
      return;
    }

    // Use the API endpoint to update password
    try {
      const sessionToken = dataManager.getSessionToken();
      const response = await fetch('/api/admin/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        e.target.reset();
        this.showSuccessMessage('Heslo bylo úspěšně změněno');
      } else {
        const error = await response.json();
        this.showErrorMessage(`Chyba při změně hesla: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating password:', error);
      this.showErrorMessage('Nepodařilo se změnit heslo');
    }
  }

  /**
   * Load and display booking statistics for a selected date range.
   * Defaults to current month if no date range is selected.
   * Calculates: total bookings, revenue, average price, occupancy rate.
   *
   * @async
   * @returns {Promise<void>}
   */
  async loadStatistics() {
    const container = document.getElementById('statistics');

    try {
      const bookings = await dataManager.getAllBookings();

      // Get date range from inputs (default to current month)
      const fromInput = document.getElementById('statsFromDate');
      const toInput = document.getElementById('statsToDate');

      if (!fromInput || !toInput) {
        console.error('[AdminPanel] Statistics filter inputs not found');
        return;
      }

      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

      // Set defaults if empty
      if (!fromInput.value) fromInput.value = currentMonth;
      if (!toInput.value) toInput.value = currentMonth;

      const fromDate = new Date(fromInput.value + '-01');
      const toDate = new Date(toInput.value + '-01');
      toDate.setMonth(toDate.getMonth() + 1); // Move to next month
      toDate.setDate(0); // Last day of selected month

      // Validate date range
      if (fromDate > toDate) {
        this.showNotification('Datum "Od" musí být před datem "Do"', 'error');
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

      filteredBookings.forEach((booking) => {
        stats.totalRevenue += booking.totalPrice || 0;
      });

      if (filteredBookings.length > 0) {
        stats.averagePrice = Math.round(stats.totalRevenue / filteredBookings.length);
      }

      // Calculate occupancy rate for the selected period
      const monthsDiff =
        (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth()) + 1;
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

      stats.occupancyRate = totalRoomDays > 0 ? Math.round((bookedRoomDays / totalRoomDays) * 100) : 0;

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
      console.error('[AdminPanel] Failed to load statistics:', error);
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
      console.error('[AdminPanel] Statistics filter inputs not found');
      this.showNotification('Nepodařilo se resetovat filtr', 'error');
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

  async loadEmailTemplate() {
    const settings = await dataManager.getSettings();
    const emailSettings = settings.emailTemplate || {};

    // Load email template settings
    document.getElementById('emailSubject').value =
      emailSettings.subject || 'Potvrzení rezervace - Chata Mariánská';
    document.getElementById('emailTemplate').value =
      emailSettings.template || document.getElementById('emailTemplate').value;

    // Load contact email setting
    const contactEmailInput = document.getElementById('contactEmail');
    if (contactEmailInput) {
      contactEmailInput.value = settings.contactEmail || 'chata@utia.cas.cz';
    }

    // Load admin emails
    this.loadAdminEmails(settings.adminEmails || []);

    // Load cabin manager emails
    this.loadCabinManagerEmails(settings.cabinManagerEmails || []);

    // Initialize character counter
    this.updateEmailTemplateCharCount();

    // Add input listener for real-time character count
    const templateTextarea = document.getElementById('emailTemplate');
    templateTextarea.addEventListener('input', () => this.updateEmailTemplateCharCount());
  }

  loadAdminEmails(adminEmails) {
    const listContainer = document.getElementById('adminEmailsList');
    if (!listContainer) {
      return;
    }

    if (adminEmails.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md); color: var(--gray-600);">
          Zatím nejsou přidáni žádní správci. Přidejte emailovou adresu správce níže.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = adminEmails
      .map(
        (email) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--gray-50); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: var(--primary-color);">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span style="font-weight: 500;">${this.escapeHtml(email)}</span>
        </div>
        <button
          class="btn btn-sm remove-admin-btn"
          data-email="${this.escapeHtml(email)}"
          style="padding: 0.5rem 1rem; background: #dc2626; color: white; border: none;"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="display: inline; margin-right: 0.25rem;">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          Odebrat
        </button>
      </div>
    `
      )
      .join('');

    // Add event listeners to remove buttons (safer than onclick)
    listContainer.querySelectorAll('.remove-admin-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const email = e.currentTarget.getAttribute('data-email');
        this.removeAdminEmail(email);
      });
    });
  }

  async handleAddAdminEmail(e) {
    e.preventDefault();

    // Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const emailInput = document.getElementById('newAdminEmail');
      const newEmail = emailInput.value.trim();

      // Validate email format
      if (!ValidationUtils.validateEmail(newEmail)) {
        this.showToast('Neplatný formát emailové adresy', 'error');
        return;
      }

      const settings = await dataManager.getSettings();
      const adminEmails = settings.adminEmails || [];

      // Check if email already exists
      if (adminEmails.includes(newEmail)) {
        this.showToast('Tento email je již v seznamu správců', 'warning');
        return;
      }

      // Add new email
      adminEmails.push(newEmail);
      settings.adminEmails = adminEmails;

      await dataManager.updateSettings(settings);

      // Reload admin emails list
      this.loadAdminEmails(adminEmails);

      // Clear input
      emailInput.value = '';

      this.showSuccessMessage(`Správce ${newEmail} byl úspěšně přidán`);
    } catch (error) {
      console.error('Chyba při přidávání správce:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  async removeAdminEmail(email) {
    // Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    if (!confirm(`Opravdu chcete odebrat správce ${email}?`)) {
      return;
    }

    try {
      const settings = await dataManager.getSettings();
      const adminEmails = settings.adminEmails || [];

      // Remove email
      settings.adminEmails = adminEmails.filter((e) => e !== email);

      await dataManager.updateSettings(settings);

      // Reload admin emails list
      this.loadAdminEmails(settings.adminEmails);

      this.showSuccessMessage(`Správce ${email} byl úspěšně odebrán`);
    } catch (error) {
      console.error('Chyba při odebírání správce:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  // Load cabin manager emails list
  loadCabinManagerEmails(cabinManagerEmails) {
    const listContainer = document.getElementById('cabinManagerEmailsList');

    if (!listContainer) {
      console.warn('Cabin manager emails list container not found');
      return;
    }

    if (!cabinManagerEmails || cabinManagerEmails.length === 0) {
      listContainer.innerHTML = `
        <p style="color: #666; font-style: italic; padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
          Žádní správci chaty nejsou zatím přidáni.
        </p>
      `;
      return;
    }

    listContainer.innerHTML = cabinManagerEmails
      .map(
        (email) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--gray-50); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: var(--primary-color);">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span style="font-weight: 500;">${this.escapeHtml(email)}</span>
        </div>
        <button
          class="btn btn-sm remove-cabin-manager-btn"
          data-email="${this.escapeHtml(email)}"
          style="padding: 0.5rem 1rem; background: #dc2626; color: white; border: none;"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="display: inline; margin-right: 0.25rem;">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          Odebrat
        </button>
      </div>
    `
      )
      .join('');

    // Add event listeners to remove buttons (safer than onclick)
    listContainer.querySelectorAll('.remove-cabin-manager-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const email = e.currentTarget.getAttribute('data-email');
        this.removeCabinManagerEmail(email);
      });
    });
  }

  async handleAddCabinManagerEmail(e) {
    e.preventDefault();

    // Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const emailInput = document.getElementById('newCabinManagerEmail');
      const newEmail = emailInput.value.trim();

      // Validate email format
      if (!ValidationUtils.validateEmail(newEmail)) {
        this.showToast('Neplatný formát emailové adresy', 'error');
        return;
      }

      const settings = await dataManager.getSettings();
      const cabinManagerEmails = settings.cabinManagerEmails || [];

      // Check if email already exists
      if (cabinManagerEmails.includes(newEmail)) {
        this.showToast('Tento email je již v seznamu správců chaty', 'warning');
        return;
      }

      // Add new email
      cabinManagerEmails.push(newEmail);
      settings.cabinManagerEmails = cabinManagerEmails;

      await dataManager.updateSettings(settings);

      // Reload cabin manager emails list
      this.loadCabinManagerEmails(cabinManagerEmails);

      // Clear input
      emailInput.value = '';

      this.showSuccessMessage(`Správce chaty ${newEmail} byl úspěšně přidán`);
    } catch (error) {
      console.error('Chyba při přidávání správce chaty:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  async removeCabinManagerEmail(email) {
    // Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    if (!confirm(`Opravdu chcete odebrat správce chaty ${email}?`)) {
      return;
    }

    try {
      const settings = await dataManager.getSettings();
      const cabinManagerEmails = settings.cabinManagerEmails || [];

      // Remove email
      settings.cabinManagerEmails = cabinManagerEmails.filter((e) => e !== email);

      await dataManager.updateSettings(settings);

      // Reload cabin manager emails list
      this.loadCabinManagerEmails(settings.cabinManagerEmails);

      this.showSuccessMessage(`Správce chaty ${email} byl úspěšně odebrán`);
    } catch (error) {
      console.error('Chyba při odebírání správce chaty:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  updateEmailTemplateCharCount() {
    const templateTextarea = document.getElementById('emailTemplate');
    const charCount = templateTextarea.value.length;
    const maxChars = 600;

    document.getElementById('emailTemplateCharCount').textContent = charCount;

    const warning = document.getElementById('emailTemplateWarning');
    if (charCount > maxChars) {
      warning.style.display = 'inline';
      templateTextarea.style.borderColor = 'var(--error-color)';
    } else {
      warning.style.display = 'none';
      templateTextarea.style.borderColor = '';
    }
  }

  async handleEmailTemplate(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const template = document.getElementById('emailTemplate').value;
      const maxChars = 600;

      // Validate 600 character limit
      if (template.length > maxChars) {
        this.showToast(
          `Text emailu nesmí přesáhnout ${maxChars} znaků (aktuálně: ${template.length})`,
          'error'
        );
        return;
      }

      const settings = await dataManager.getSettings();
      settings.emailTemplate = {
        subject: document.getElementById('emailSubject').value,
        template,
      };

      await dataManager.updateSettings(settings);
      this.showSuccessMessage(
        'Šablona emailu byla uložena. Editační odkaz {edit_url} se automaticky přidá na konec emailu.'
      );
    } catch (error) {
      console.error('Chyba při ukládání email šablony:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  async handleContactEmail(e) {
    e.preventDefault();

    // Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const contactEmail = document.getElementById('contactEmail').value.trim();

      // Validate email format using ValidationUtils
      if (!ValidationUtils.validateEmail(contactEmail)) {
        this.showToast('Neplatný formát emailové adresy', 'error');
        return;
      }

      const settings = await dataManager.getSettings();
      settings.contactEmail = contactEmail;

      await dataManager.updateSettings(settings);
      this.showSuccessMessage('Kontaktní email byl úspěšně uložen');
    } catch (error) {
      console.error('Chyba při ukládání kontaktního emailu:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  showToast(message, type = 'success') {
    // Vytvoř kontejner pro toasty pokud neexistuje
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    // Vytvoř toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} toast-enter`;

    // Ikona podle typu
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close">×</button>
        `;

    // Přidej toast do kontejneru
    toastContainer.appendChild(toast);

    // Animace vstupu
    setTimeout(() => {
      toast.classList.remove('toast-enter');
      toast.classList.add('toast-show');
    }, 10);

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.removeToast(toast);
    });

    // Automatické odstranění po 5 sekundách
    setTimeout(() => {
      this.removeToast(toast);
    }, 5000);
  }

  removeToast(toast) {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-exit');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }

  // Wrapper pro zpětnou kompatibilitu
  showSuccessMessage(message) {
    this.showToast(message, 'success');
  }

  showErrorMessage(message) {
    this.showToast(message, 'error');
  }

  showWarningMessage(message) {
    this.showToast(message, 'warning');
  }

  showInfoMessage(message) {
    this.showToast(message, 'info');
  }

  // Confirm dialog replacement for no-alert ESLint rule
  showConfirm(message, onConfirm, onCancel = null) {
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'confirm-overlay';
    confirmDialog.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-message">${message}</div>
        <div class="confirm-buttons">
          <button class="confirm-cancel">Zrušit</button>
          <button class="confirm-ok">Potvrdit</button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmDialog);
    setTimeout(() => confirmDialog.classList.add('active'), 10);

    const removeDialog = () => {
      confirmDialog.classList.remove('active');
      setTimeout(() => confirmDialog.remove(), 300);
    };

    confirmDialog.querySelector('.confirm-ok').addEventListener('click', () => {
      removeDialog();
      if (onConfirm) {
        onConfirm();
      }
    });

    confirmDialog.querySelector('.confirm-cancel').addEventListener('click', () => {
      removeDialog();
      if (onCancel) {
        onCancel();
      }
    });

    confirmDialog.addEventListener('click', (e) => {
      if (e.target === confirmDialog) {
        removeDialog();
        if (onCancel) {
          onCancel();
        }
      }
    });
  }

  /**
   * Generate price breakdown HTML
   * For bulk bookings: Shows unified bulk format (base price + guest surcharges)
   * For regular bookings: Shows per-room breakdown
   *
   * @param {Object} booking - Booking object
   * @returns {Promise<string>} HTML string with price breakdown
   */
  async generatePerRoomPriceBreakdown(booking) {
    try {
      const settings = await dataManager.getSettings();
      if (!settings) {
        return '';
      }

      // CRITICAL: Bulk bookings have unified format (NOT per-room breakdown)
      if (booking.isBulkBooking && settings.bulkPrices) {
        return this.generateBulkPriceBreakdownHTML(booking, settings);
      }

      // Check if we have per-room guest data
      if (!booking.perRoomGuests || Object.keys(booking.perRoomGuests).length === 0) {
        return '';
      }

      if (!settings.prices) {
        return '';
      }

      // Calculate nights for each room
      const perRoomGuests = [];
      for (const roomId of booking.rooms) {
        const roomGuests = booking.perRoomGuests[roomId];
        if (roomGuests) {
          // SSOT FIX 2025-12-03: Include per-room guestType for correct price calculation
          // Each room can have different guest type (utia vs external)
          perRoomGuests.push({
            roomId,
            adults: roomGuests.adults || 0,
            children: roomGuests.children || 0,
            toddlers: roomGuests.toddlers || 0,
            guestType: roomGuests.guestType || booking.guestType || 'utia',
          });
        }
      }

      if (perRoomGuests.length === 0) {
        return '';
      }

      // NEW 2025-11-14: Calculate nights per room using perRoomDates if available
      // Fallback to booking-level dates for backward compatibility
      const nights = booking.perRoomDates
        ? null // Will be calculated per room by PriceCalculator
        : Math.ceil(
            (new Date(booking.endDate) - new Date(booking.startDate)) / (1000 * 60 * 60 * 24)
          );

      // Calculate per-room prices
      const perRoomPrices = PriceCalculator.calculatePerRoomPrices({
        guestType: booking.guestType || 'utia',
        nights,
        settings,
        perRoomGuests,
        perRoomDates: booking.perRoomDates || null, // NEW: Pass per-room dates
      });

      // SSOT FIX 2025-12-03: Log warning if breakdown differs from stored price
      // This helps identify data inconsistencies for debugging
      if (perRoomPrices.grandTotal !== (booking.totalPrice || 0)) {
        console.warn('[AdminPanel] Price discrepancy detected:', {
          bookingId: booking.id,
          storedPrice: booking.totalPrice,
          calculatedPrice: perRoomPrices.grandTotal,
          difference: Math.abs((booking.totalPrice || 0) - perRoomPrices.grandTotal),
          note: 'This may indicate legacy data or pricing model change',
        });
      }

      // Format HTML
      return PriceCalculator.formatPerRoomPricesHTML(perRoomPrices, 'cs');
    } catch (error) {
      console.warn('Error generating per-room price breakdown:', error);
      return '';
    }
  }

  /**
   * Generate unified bulk price breakdown HTML
   * Shows: Base price + ÚTIA guests + External guests + Total
   *
   * @param {Object} booking - Booking object with bulk booking data
   * @param {Object} settings - Settings with bulkPrices configuration
   * @returns {string} HTML string with bulk price breakdown
   */
  generateBulkPriceBreakdownHTML(booking, settings) {
    const { bulkPrices } = settings;

    // Validate bulkPrices configuration
    const requiredFields = ['basePrice', 'utiaAdult', 'utiaChild', 'externalAdult', 'externalChild'];
    const missingFields = requiredFields.filter((f) => typeof bulkPrices?.[f] !== 'number');
    if (missingFields.length > 0) {
      console.error('[AdminPanel] Missing bulkPrices fields:', missingFields);
      return `<div style="color: var(--error-color); padding: 1rem; background: #fef2f2; border-radius: var(--radius-md);">⚠️ Chyba: Neúplná konfigurace hromadných cen</div>`;
    }

    const nights = Math.ceil(
      (new Date(booking.endDate) - new Date(booking.startDate)) / (1000 * 60 * 60 * 24)
    );

    // Count guests by type from guestNames if available
    let utiaAdults = 0;
    let utiaChildren = 0;
    let externalAdults = 0;
    let externalChildren = 0;
    let toddlers = 0;

    if (booking.guestNames && booking.guestNames.length > 0) {
      for (const guest of booking.guestNames) {
        const priceType = guest.guestPriceType || 'external';
        const personType = guest.personType || 'adult';

        if (personType === 'toddler') {
          toddlers++;
        } else if (priceType === 'utia') {
          if (personType === 'child') {
            utiaChildren++;
          } else {
            utiaAdults++;
          }
        } else {
          if (personType === 'child') {
            externalChildren++;
          } else {
            externalAdults++;
          }
        }
      }
    } else {
      // Fallback to booking-level counts
      if (booking.guestType === 'utia') {
        utiaAdults = booking.adults || 0;
        utiaChildren = booking.children || 0;
      } else {
        externalAdults = booking.adults || 0;
        externalChildren = booking.children || 0;
      }
      toddlers = booking.toddlers || 0;
    }

    // Calculate prices
    const basePrice = bulkPrices.basePrice * nights;
    const utiaAdultsPrice = utiaAdults * bulkPrices.utiaAdult * nights;
    const utiaChildrenPrice = utiaChildren * bulkPrices.utiaChild * nights;
    const externalAdultsPrice = externalAdults * bulkPrices.externalAdult * nights;
    const externalChildrenPrice = externalChildren * bulkPrices.externalChild * nights;
    const totalPrice = basePrice + utiaAdultsPrice + utiaChildrenPrice + externalAdultsPrice + externalChildrenPrice;

    // Build HTML
    let html = `
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem;">
        <div style="font-weight: 600; color: #166534; margin-bottom: 1rem; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.2rem;">🏠</span> Hromadná rezervace celé chaty
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <!-- Base price -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 6px;">
            <span style="color: #374151;">Základní cena za chatu</span>
            <span style="font-weight: 600; color: #059669;">${bulkPrices.basePrice.toLocaleString('cs-CZ')} Kč/noc</span>
          </div>`;

    // ÚTIA guests
    if (utiaAdults > 0) {
      html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem 0.5rem 1.5rem; color: #374151;">
            <span>ÚTIA ${this._getGuestLabelAdmin(utiaAdults, 'adult')}</span>
            <span style="color: #059669;">+${utiaAdultsPrice.toLocaleString('cs-CZ')} Kč</span>
          </div>`;
    }
    if (utiaChildren > 0) {
      html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem 0.5rem 1.5rem; color: #374151;">
            <span>ÚTIA ${this._getGuestLabelAdmin(utiaChildren, 'child')}</span>
            <span style="color: #059669;">+${utiaChildrenPrice.toLocaleString('cs-CZ')} Kč</span>
          </div>`;
    }

    // External guests
    if (externalAdults > 0) {
      html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem 0.5rem 1.5rem; color: #374151;">
            <span>Externí ${this._getGuestLabelAdmin(externalAdults, 'adult')}</span>
            <span style="color: #059669;">+${externalAdultsPrice.toLocaleString('cs-CZ')} Kč</span>
          </div>`;
    }
    if (externalChildren > 0) {
      html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem 0.5rem 1.5rem; color: #374151;">
            <span>Externí ${this._getGuestLabelAdmin(externalChildren, 'child')}</span>
            <span style="color: #059669;">+${externalChildrenPrice.toLocaleString('cs-CZ')} Kč</span>
          </div>`;
    }

    // Toddlers (free)
    if (toddlers > 0) {
      html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.5rem 0.5rem 1.5rem; color: #6b7280; font-style: italic;">
            <span>${this._getGuestLabelAdmin(toddlers, 'toddler')}</span>
            <span>zdarma</span>
          </div>`;
    }

    // Nights multiplier
    html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #e5e7eb; border-radius: 6px; margin-top: 0.5rem;">
            <span style="color: #374151; font-weight: 500;">Počet nocí</span>
            <span style="font-weight: 600; color: #374151;">× ${nights}</span>
          </div>`;

    // Total
    html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; margin-top: 0.5rem;">
            <span style="color: white; font-weight: 600; font-size: 1.1rem;">Celková cena</span>
            <span style="color: white; font-weight: 700; font-size: 1.25rem;">${totalPrice.toLocaleString('cs-CZ')} Kč</span>
          </div>
        </div>
      </div>`;

    return html;
  }

  /**
   * Get Czech guest label with proper pluralization for admin panel
   * @param {number} count - Number of guests
   * @param {string} type - 'adult', 'child', or 'toddler'
   * @returns {string} Formatted label
   */
  _getGuestLabelAdmin(count, type) {
    if (type === 'adult') {
      if (count === 1) return '1 dospělý';
      if (count >= 2 && count <= 4) return `${count} dospělí`;
      return `${count} dospělých`;
    } else if (type === 'child') {
      if (count === 1) return '1 dítě (3-17 let)';
      if (count >= 2 && count <= 4) return `${count} děti (3-17 let)`;
      return `${count} dětí (3-17 let)`;
    } else {
      // toddler
      if (count === 1) return '1 batole (0-2 roky)';
      if (count >= 2 && count <= 4) return `${count} batolata (0-2 roky)`;
      return `${count} batolat (0-2 roky)`;
    }
  }

  /**
   * Copy guest names to clipboard
   * @param {string} bookingId - Booking ID to copy guest names from
   */
  async copyGuestNames(bookingId) {
    try {
      const booking = await dataManager.getBooking(bookingId);
      if (!booking || !booking.guestNames || booking.guestNames.length === 0) {
        this.showToast('Žádná jména hostů k zkopírování', 'warning');
        return;
      }

      // Format: "FirstName LastName\n" for each guest
      const guestNamesText = booking.guestNames
        .map((guest) => `${guest.firstName} ${guest.lastName}`)
        .join('\n');

      // Copy to clipboard
      await navigator.clipboard.writeText(guestNamesText);
      this.showToast(`Zkopírováno ${booking.guestNames.length} jmen hostů`, 'success');
    } catch (error) {
      console.error('Chyba při kopírování jmen hostů:', error);
      this.showToast('Nepodařilo se zkopírovat jména hostů', 'error');
    }
  }
}

// Initialize admin panel
const adminPanel = new AdminPanel();

// Make admin panel globally accessible for real-time updates
window.adminPanel = adminPanel;
