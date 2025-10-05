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
    this.editSelectedDates = new Set();
    this.editSelectedRooms = new Set();
    this.editStartDate = null;
    this.editEndDate = null;
    this.editCurrentMonth = new Date().getMonth();
    this.editCurrentYear = new Date().getFullYear();
    this.currentEditBooking = null;
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
        ">${roomId}</span>`;
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
        });
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
    const bookings = await dataManager.getAllBookings();
    const tbody = document.getElementById('bookingsTableBody');

    tbody.innerHTML = '';

    bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    bookings.forEach((booking) => {
      const row = document.createElement('tr');
      row.innerHTML = `
                <td>${this.escapeHtml(booking.id)}</td>
                <td>${this.escapeHtml(booking.name)}</td>
                <td>${this.escapeHtml(booking.email)}</td>
                <td>${this.escapeHtml(booking.phone)}</td>
                <td>${new Date(booking.startDate).toLocaleDateString('cs-CZ')} -
                    ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}</td>
                <td>${booking.rooms.map((roomId) => this.createRoomBadge(roomId, true)).join('')}</td>
                <td>
                    ${booking.totalPrice} Kč
                    ${booking.payFromBenefit ? '<span style="margin-left: 0.5rem; padding: 0.15rem 0.5rem; background: #17a2b8; color: white; border-radius: 3px; font-size: 0.75rem; font-weight: 600;">💳 Benefit</span>' : ''}
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
    });
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

                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Datum pobytu:</strong>
                            <div style="margin-top: 0.25rem;">
                                ${new Date(booking.startDate).toLocaleDateString('cs-CZ')} -
                                ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}
                            </div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Pokoje:</strong>
                            <div style="margin-top: 0.25rem;">${booking.rooms.map((roomId) => this.createRoomBadge(roomId, true)).join('')}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Počet hostů:</strong>
                            <div style="margin-top: 0.25rem;">
                                Dospělí: ${booking.adults}, Děti: ${booking.children}, Batolata: ${booking.toddlers}
                            </div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Typ hosta:</strong>
                            <div style="margin-top: 0.25rem;">${booking.guestType === 'utia' ? 'Zaměstnanec ÚTIA' : 'Externí host'}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Celková cena:</strong>
                            <div style="margin-top: 0.25rem; font-size: 1.25rem; font-weight: 600; color: var(--primary-color);">
                                ${booking.totalPrice} Kč
                            </div>
                        </div>
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
    const booking = await dataManager.getBooking(bookingId);
    if (!booking) {
      return;
    }

    // Store booking for reference
    this.currentEditBooking = booking;

    // Initialize edit state
    this.editSelectedRooms = new Set(booking.rooms || []);
    this.editStartDate = booking.startDate;
    this.editEndDate = booking.endDate;

    // Set dates for BaseCalendar
    this.editSelectedDates = new Set();
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    const endTime = end.getTime();
    for (let d = new Date(start); d.getTime() < endTime; d.setDate(d.getDate() + 1)) {
      this.editSelectedDates.add(this.formatDate(new Date(d)));
    }

    // If BaseCalendar exists, update its selectedDates
    if (this.editCalendar) {
      this.editCalendar.selectedDates = new Set(this.editSelectedDates);
      this.editCalendar.intervalState.firstClick = booking.startDate;
      const lastDate = this.formatDate(new Date(end.getTime() - 24 * 60 * 60 * 1000));
      this.editCalendar.intervalState.secondClick = lastDate;
    }

    // Set form values
    document.getElementById('editBookingId').value = bookingId;
    document.getElementById('editName').value = booking.name || '';
    document.getElementById('editEmail').value = booking.email || '';
    document.getElementById('editPhone').value = booking.phone || '';
    document.getElementById('editCompany').value = booking.company || '';
    document.getElementById('editAddress').value = booking.address || '';
    document.getElementById('editCity').value = booking.city || '';
    document.getElementById('editZip').value = booking.zip || '';
    document.getElementById('editIco').value = booking.ico || '';
    document.getElementById('editDic').value = booking.dic || '';
    document.getElementById('editNotes').value = booking.notes || '';
    document.getElementById('editPayFromBenefit').checked = booking.payFromBenefit || false;

    // Set guest counts and type
    document.getElementById('editAdults').value = booking.adults || 1;
    document.getElementById('editChildren').value = booking.children || 0;
    document.getElementById('editToddlers').value = booking.toddlers || 0;

    // Set guest type
    if (booking.guestType === 'utia') {
      document.getElementById('editGuestTypeUtia').checked = true;
    } else {
      document.getElementById('editGuestTypeExternal').checked = true;
    }

    // Initialize calendar and rooms
    await this.initEditCalendar();
    await this.loadEditRooms();
    await this.updateEditPrice();
    await this.loadExistingBookingsForEdit();

    // Set modal title and button text for edit mode
    document.getElementById('editModalTitle').textContent = 'Upravit rezervaci';
    document.getElementById('editSubmitButton').textContent = 'Uložit změny';

    // Show modal
    document.getElementById('editBookingModal').classList.add('active');
  }

  async handleEditBooking(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const bookingId = document.getElementById('editBookingId').value;

      // Validate all required billing fields first
      const name = document.getElementById('editName').value.trim();
      const email = document.getElementById('editEmail').value.trim();
      const phone = document.getElementById('editPhone').value.trim();
      const address = document.getElementById('editAddress').value.trim();
      const city = document.getElementById('editCity').value.trim();
      const zip = document.getElementById('editZip').value.trim();

      if (!name || !email || !phone || !address || !city || !zip) {
        this.showErrorMessage('Vyplňte prosím všechny povinné údaje v sekci "Fakturační údaje"');
        // Switch to billing tab to show the missing fields
        this.switchEditTab('billing');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
      if (!emailRegex.test(email)) {
        this.showErrorMessage('Zadejte platnou emailovou adresu');
        this.switchEditTab('billing');
        return;
      }

      // Validate ZIP format (5 digits)
      const zipRegex = /^[0-9]{5}$/u;
      if (!zipRegex.test(zip)) {
        this.showErrorMessage('PSČ musí obsahovat přesně 5 číslic');
        this.switchEditTab('billing');
        return;
      }

      // Validate date selection exists
      if (!this.editStartDate || !this.editEndDate) {
        this.showErrorMessage('Vyberte prosím termín rezervace');
        this.switchEditTab('dates');
        return;
      }

      // Validate minimum 2 days (1 night)
      const startDateObj = new Date(this.editStartDate);
      const endDateObj = new Date(this.editEndDate);
      const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));

      if (daysDiff < 1) {
        this.showErrorMessage('Minimální rezervace je na 1 noc (2 dny)');
        return;
      }

      // Validate at least one room is selected
      if (!this.editSelectedRooms || this.editSelectedRooms.size === 0) {
        this.showErrorMessage('Vyberte prosím alespoň jeden pokoj');
        return;
      }

      // Validate no blocked dates in selection
      const dateArray = [];
      const currentDate = new Date(this.editStartDate);
      const endDate = new Date(this.editEndDate);

      // eslint-disable-next-line no-unmodified-loop-condition
      while (currentDate <= endDate) {
        dateArray.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      for (const date of dateArray) {
        for (const roomId of this.editSelectedRooms) {
          const availability = await dataManager.getRoomAvailability(date, roomId);

          if (availability.status === 'blocked') {
            const dateStr = DateUtils.formatDate(date);
            this.showErrorMessage(
              `Pokoj ${roomId} je blokován dne ${dateStr}. Upravte termín nebo vyberte jiný pokoj.`
            );
            return;
          }
        }
      }

      // Get selected guest type
      const guestType =
        document.querySelector('input[name="editGuestType"]:checked')?.value || 'external';

      // Calculate price based on new selections
      const totalPrice = await this.calculateEditPrice();

      const updates = {
        name: document.getElementById('editName').value,
        email: document.getElementById('editEmail').value,
        phone: document.getElementById('editPhone').value,
        company: document.getElementById('editCompany').value,
        startDate: this.editStartDate,
        endDate: this.editEndDate,
        rooms: Array.from(this.editSelectedRooms),
        adults: parseInt(document.getElementById('editAdults').value, 10),
        children: parseInt(document.getElementById('editChildren').value, 10),
        toddlers: parseInt(document.getElementById('editToddlers').value, 10),
        guestType,
        totalPrice,
        address: document.getElementById('editAddress').value,
        city: document.getElementById('editCity').value,
        zip: document.getElementById('editZip').value,
        ico: document.getElementById('editIco').value,
        dic: document.getElementById('editDic').value,
        notes: document.getElementById('editNotes').value,
        payFromBenefit: document.getElementById('editPayFromBenefit').checked,
      };

      // Check if we're creating new booking or updating existing
      if (bookingId) {
        // Update existing booking
        await dataManager.updateBooking(bookingId, updates);
        this.showSuccessMessage('Rezervace byla úspěšně upravena');
      } else {
        // Create new booking - use admin-specific creation
        const newBooking = {
          ...updates,
          id: dataManager.generateBookingId(),
          editToken: dataManager.generateEditToken(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Save directly to data since we're admin
        const data = await dataManager.getData();
        data.bookings.push(newBooking);
        await dataManager.saveData(data);

        this.showSuccessMessage('Rezervace byla úspěšně vytvořena');
      }

      document.getElementById('editBookingModal').classList.remove('active');
      await this.loadBookings();
    } catch (error) {
      console.error('Chyba při ukládání rezervace:', error);
      this.showToast(`Chyba: ${error.message}`, 'error');
    }
  }

  // Helper functions for comprehensive edit modal
  async initEditCalendar() {
    const container = document.getElementById('editCalendarContainer');
    if (!container) {
      return;
    }

    // Use BaseCalendar for admin edit (same as single room, but allows past dates and ignores blocks)
    if (!this.editCalendar) {
      this.editCalendar = new BaseCalendar({
        mode: BaseCalendar.MODES.EDIT,
        app: this,
        containerId: 'editCalendarContainer',
        roomId: null, // Admin can select any room
        allowPast: true, // Admin can select past dates
        enforceContiguous: true,
        minNights: 1,
        onDateSelect: async (dateStr) => {
          await this.handleEditDateSelect(dateStr);
        },
      });
    }

    await this.editCalendar.render();
  }

  async handleEditDateSelect() {
    // BaseCalendar updates this.selectedDates automatically
    this.editSelectedDates = this.editCalendar.selectedDates;

    // Calculate start and end dates
    if (this.editSelectedDates.size > 0) {
      const dates = Array.from(this.editSelectedDates).sort();
      this.editStartDate = dates[0];
      // endDate = day AFTER last selected date (checkout day)
      const lastSelectedDate = dates[dates.length - 1];
      const checkoutDate = new Date(lastSelectedDate);
      checkoutDate.setDate(checkoutDate.getDate() + 1);
      this.editEndDate = this.formatDate(checkoutDate);

      document.getElementById('editSelectedDates').textContent =
        `${new Date(this.editStartDate).toLocaleDateString('cs-CZ')} - ${new Date(lastSelectedDate).toLocaleDateString('cs-CZ')}`;
    }

    await this.updateEditPrice();
    await this.loadExistingBookingsForEdit();
  }

  async loadEditRooms() {
    const container = document.getElementById('editRoomsList');
    const rooms = await dataManager.getRooms();

    let html = '';
    for (const room of rooms) {
      const isSelected = this.editSelectedRooms.has(room.id);
      html += `
        <label style="display: flex; align-items: center; padding: 0.5rem; background: ${isSelected ? '#10b981' : '#f3f4f6'}; color: ${isSelected ? '#ffffff' : '#000000'}; border-radius: 4px; cursor: pointer;">
          <input
            type="checkbox"
            value="${room.id}"
            ${isSelected ? 'checked' : ''}
            onchange="adminPanel.toggleEditRoom('${room.id}')"
            style="margin-right: 0.5rem;"
          >
          Pokoj ${room.id} (${room.beds} lůžek)
        </label>
      `;
    }

    container.innerHTML = html;
  }

  async toggleEditRoom(roomId) {
    if (this.editSelectedRooms.has(roomId)) {
      this.editSelectedRooms.delete(roomId);
    } else {
      this.editSelectedRooms.add(roomId);
    }
    await this.loadEditRooms();
    await this.updateEditPrice();
    await this.loadExistingBookingsForEdit();
  }

  async updateEditPrice() {
    const guestType =
      document.querySelector('input[name="editGuestType"]:checked')?.value || 'external';
    const adults = parseInt(document.getElementById('editAdults').value, 10) || 0;
    const children = parseInt(document.getElementById('editChildren').value, 10) || 0;

    if (this.editSelectedDates.size === 0 || this.editSelectedRooms.size === 0) {
      document.getElementById('editTotalPrice').textContent = '0 Kč';
      return 0;
    }

    // Calculate nights: number of selected days = number of nights
    // E.g., selecting day 5 = 1 night, selecting days 5 and 6 = 2 nights
    const nights = this.editSelectedDates.size;
    const roomCount = this.editSelectedRooms.size;

    try {
      // P1 FIX: Use actual price settings instead of hardcoded values
      const settings = await dataManager.getSettings();
      const prices = settings.prices || {
        utia: { base: 298, adult: 49, child: 24 },
        external: { base: 499, adult: 99, child: 49 },
      };

      const priceConfig = prices[guestType] || prices.utia;
      const basePrice = priceConfig.base;
      const adultPrice = priceConfig.adult;
      const childPrice = priceConfig.child;

      const totalPrice =
        nights * roomCount * basePrice +
        nights * (adults - roomCount) * adultPrice +
        nights * children * childPrice;

      document.getElementById('editTotalPrice').textContent =
        `${totalPrice.toLocaleString('cs-CZ')} Kč`;
      return totalPrice;
    } catch (error) {
      console.error('Failed to load price settings:', error);
      // Fallback to default prices if settings load fails
      const defaultPrices = {
        utia: { base: 298, adult: 49, child: 24 },
        external: { base: 499, adult: 99, child: 49 },
      };
      const priceConfig = defaultPrices[guestType] || defaultPrices.utia;
      const totalPrice =
        nights * roomCount * priceConfig.base +
        nights * (adults - roomCount) * priceConfig.adult +
        nights * children * priceConfig.child;

      document.getElementById('editTotalPrice').textContent =
        `${totalPrice.toLocaleString('cs-CZ')} Kč`;
      this.showWarningMessage('Použity výchozí ceny - nastavení se nepodařilo načíst');
      return totalPrice;
    }
  }

  calculateEditPrice() {
    return this.updateEditPrice();
  }

  async loadExistingBookingsForEdit() {
    const container = document.getElementById('editExistingBookings');

    if (!this.editStartDate || !this.editEndDate) {
      container.innerHTML =
        '<p style="color: #6b7280;">Vyberte datum pro zobrazení existujících rezervací</p>';
      return;
    }

    const bookings = await dataManager.getAllBookings();
    const relevantBookings = bookings.filter((b) => {
      if (b.id === this.currentEditBooking?.id) {
        return false;
      } // Skip current booking

      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);
      const eStart = new Date(this.editStartDate);
      const eEnd = new Date(this.editEndDate);

      // Check for date overlap
      const hasDateOverlap = bStart < eEnd && bEnd > eStart;

      // Check for room overlap
      const hasRoomOverlap = b.rooms.some((r) => this.editSelectedRooms.has(r));

      return hasDateOverlap && hasRoomOverlap;
    });

    if (relevantBookings.length === 0) {
      container.innerHTML =
        '<p style="color: #10b981;">✓ Žádné konflikty s existujícími rezervacemi</p>';
    } else {
      let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
      for (const booking of relevantBookings) {
        html += `
          <div style="padding: 0.75rem; background: #fee2e2; border-left: 4px solid #ef4444; border-radius: 4px;">
            <strong>${booking.name}</strong> - Pokoje: ${booking.rooms.join(', ')}<br>
            ${new Date(booking.startDate).toLocaleDateString('cs-CZ')} - ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}
          </div>
        `;
      }
      html += '</div>';
      container.innerHTML = html;
    }
  }

  switchEditTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.edit-tab-btn').forEach((button) => {
      const btn = button;
      if (btn.dataset.tab === tab) {
        btn.classList.add('active');
        btn.style.borderBottom = '3px solid #0d9488';
        btn.style.color = '#0d9488';
      } else {
        btn.classList.remove('active');
        btn.style.borderBottom = '3px solid transparent';
        btn.style.color = '#6b7280';
      }
    });

    // Show/hide tab content
    if (tab === 'dates') {
      document.getElementById('editDatesTab').style.display = 'block';
      document.getElementById('editBillingTab').style.display = 'none';
    } else {
      document.getElementById('editDatesTab').style.display = 'none';
      document.getElementById('editBillingTab').style.display = 'block';
    }
  }

  closeEditModal() {
    document.getElementById('editBookingModal').classList.remove('active');
  }

  async openCreateBookingModal() {
    // Set modal to create mode
    this.currentEditBooking = null;

    // Initialize edit state (empty for new booking)
    this.editSelectedDates = new Set();
    this.editSelectedRooms = new Set();
    this.editStartDate = null;
    this.editEndDate = null;

    // Clear BaseCalendar if exists
    if (this.editCalendar) {
      this.editCalendar.selectedDates.clear();
      this.editCalendar.intervalState.firstClick = null;
      this.editCalendar.intervalState.secondClick = null;
      this.editCalendar.intervalState.hoverDate = null;
    }

    // Clear form values
    document.getElementById('editBookingId').value = '';
    document.getElementById('editName').value = '';
    document.getElementById('editEmail').value = '';
    document.getElementById('editPhone').value = '';
    document.getElementById('editCompany').value = '';
    document.getElementById('editAddress').value = '';
    document.getElementById('editCity').value = '';
    document.getElementById('editZip').value = '';
    document.getElementById('editIco').value = '';
    document.getElementById('editDic').value = '';
    document.getElementById('editNotes').value = '';
    document.getElementById('editPayFromBenefit').checked = false;

    // Set default guest counts and type
    document.getElementById('editAdults').value = 1;
    document.getElementById('editChildren').value = 0;
    document.getElementById('editToddlers').value = 0;
    document.getElementById('editGuestTypeUtia').checked = true;

    // Change modal title and button text
    document.getElementById('editModalTitle').textContent = 'Přidat rezervaci';
    document.getElementById('editSubmitButton').textContent = 'Vytvořit rezervaci';

    // Initialize calendar and rooms
    await this.initEditCalendar();
    await this.loadEditRooms();
    await this.updateEditPrice();
    document.getElementById('editExistingBookings').innerHTML =
      '<p>Zatím nebyly vybrány žádné termíny</p>';

    // Show modal (ensure we're on dates tab)
    this.switchEditTab('dates');
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
        await dataManager.deleteBooking(bookingId);
        await this.loadBookings();
        this.showSuccessMessage('Rezervace byla smazána');
      } catch (error) {
        console.error('Chyba při mazání rezervace:', error);
        this.showToast(`Chyba: ${error.message}`, 'error');
      }
    });
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
        new Date(startDate),
        new Date(endDate),
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
      const newPeriod = { start: startDate, end: endDate, year };
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
      let period = null;
      if (periodId && periodId !== index) {
        period = settings.christmasPeriods?.find((p) => p.periodId === periodId);
      } else if (settings.christmasPeriods && settings.christmasPeriods[index]) {
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
          name: `Pokoj ${id}`,
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
    const defaultPrices = {
      utia: { base: 298, adult: 49, child: 24 },
      external: { base: 499, adult: 99, child: 49 },
    };
    const prices = settings.prices || defaultPrices;

    // Handle both old structure (small/large) and new structure (direct base/adult/child)
    let utiaPrice;
    let externalPrice;

    if (prices.utia && prices.utia.small) {
      // Old structure - use small room prices as base
      utiaPrice = prices.utia.small;
      externalPrice = prices.external.small;
    } else {
      // New structure
      utiaPrice = prices.utia || defaultPrices.utia;
      externalPrice = prices.external || defaultPrices.external;
    }

    // Load UTIA prices with fallbacks
    const utiaBaseEl = document.getElementById('utia_base');
    const utiaAdultEl = document.getElementById('utia_adult');
    const utiaChildEl = document.getElementById('utia_child');

    if (utiaBaseEl) {
      utiaBaseEl.value = utiaPrice.base || defaultPrices.utia.base;
    }
    if (utiaAdultEl) {
      utiaAdultEl.value = utiaPrice.adult || defaultPrices.utia.adult;
    }
    if (utiaChildEl) {
      utiaChildEl.value = utiaPrice.child || defaultPrices.utia.child;
    }

    // Load external prices with fallbacks
    const externalBaseEl = document.getElementById('external_base');
    const externalAdultEl = document.getElementById('external_adult');
    const externalChildEl = document.getElementById('external_child');

    if (externalBaseEl) {
      externalBaseEl.value = externalPrice.base || defaultPrices.external.base;
    }
    if (externalAdultEl) {
      externalAdultEl.value = externalPrice.adult || defaultPrices.external.adult;
    }
    if (externalChildEl) {
      externalChildEl.value = externalPrice.child || defaultPrices.external.child;
    }
  }

  async handlePriceConfig(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const prices = {
        utia: {
          base: parseInt(document.getElementById('utia_base').value, 10),
          adult: parseInt(document.getElementById('utia_adult').value, 10),
          child: parseInt(document.getElementById('utia_child').value, 10),
        },
        external: {
          base: parseInt(document.getElementById('external_base').value, 10),
          adult: parseInt(document.getElementById('external_adult').value, 10),
          child: parseInt(document.getElementById('external_child').value, 10),
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

  async loadStatistics() {
    const bookings = await dataManager.getAllBookings();
    const container = document.getElementById('statistics');

    const stats = {
      total: bookings.length,
      thisMonth: 0,
      totalRevenue: 0,
      averagePrice: 0,
      occupancyRate: 0,
    };

    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    bookings.forEach((booking) => {
      const bookingDate = new Date(booking.startDate);
      if (bookingDate.getMonth() === thisMonth && bookingDate.getFullYear() === thisYear) {
        stats.thisMonth += 1;
      }
      stats.totalRevenue += booking.totalPrice;
    });

    stats.averagePrice = bookings.length > 0 ? Math.round(stats.totalRevenue / bookings.length) : 0;

    // Calculate occupancy rate for the current month
    const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
    const totalRoomDays = daysInMonth * 9; // 9 rooms
    let bookedRoomDays = 0;

    bookings.forEach((booking) => {
      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);

      if (start.getMonth() === thisMonth && start.getFullYear() === thisYear) {
        // P1 FIX: Remove +1 (was adding extra day)
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        bookedRoomDays += days * booking.rooms.length;
      }
    });

    stats.occupancyRate = Math.round((bookedRoomDays / totalRoomDays) * 100);

    container.innerHTML = `
            <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 2rem; font-weight: 700; color: var(--primary-color);">${stats.total}</div>
                <div style="color: var(--gray-600);">Celkem rezervací</div>
            </div>
            <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 2rem; font-weight: 700; color: var(--success-color);">${stats.thisMonth}</div>
                <div style="color: var(--gray-600);">Tento měsíc</div>
            </div>
            <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 2rem; font-weight: 700; color: var(--primary-color);">${stats.totalRevenue} Kč</div>
                <div style="color: var(--gray-600);">Celkové příjmy</div>
            </div>
            <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 2rem; font-weight: 700; color: var(--warning-color);">${stats.averagePrice} Kč</div>
                <div style="color: var(--gray-600);">Průměrná cena</div>
            </div>
            <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 2rem; font-weight: 700; color: var(--secondary-color);">${stats.occupancyRate}%</div>
                <div style="color: var(--gray-600);">Obsazenost tento měsíc</div>
            </div>
        `;
  }

  async loadEmailTemplate() {
    const settings = await dataManager.getSettings();
    const emailSettings = settings.emailTemplate || {};

    // Load email template settings
    document.getElementById('emailSubject').value =
      emailSettings.subject || 'Potvrzení rezervace - Chata Mariánská';
    document.getElementById('emailTemplate').value =
      emailSettings.template || document.getElementById('emailTemplate').value;
  }

  async handleEmailTemplate(e) {
    e.preventDefault();

    // FIX: Validate session before admin operation
    if (!this.validateSession()) {
      return;
    }

    try {
      const settings = await dataManager.getSettings();
      settings.emailTemplate = {
        subject: document.getElementById('emailSubject').value,
        template: document.getElementById('emailTemplate').value,
      };

      await dataManager.updateSettings(settings);
      this.showSuccessMessage('Šablona emailu byla uložena');
    } catch (error) {
      console.error('Chyba při ukládání email šablony:', error);
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
}

// Initialize admin panel
const adminPanel = new AdminPanel();

// Make admin panel globally accessible for real-time updates
window.adminPanel = adminPanel;
