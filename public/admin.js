// Admin panel logic
class AdminPanel {
  // Session timeout constants
  static SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days
  static SESSION_WARNING_TIME = 60 * 60 * 1000; // 1 hour before expiry
  static ACTIVITY_DEBOUNCE_TIME = 1000; // 1 second
  static SESSION_REFRESH_INTERVAL = 60 * 60 * 1000; // Refresh every 1 hour on activity

  constructor() {
    // Initialize modules with proper callbacks for AdminAuth
    this.auth = new AdminAuth({
      onLoginSuccess: () => this.handleLoginSuccess(),
      onLogout: () => this.handleLogout(),
      onShowError: (msg) => this.showErrorMessage(msg),
      onShowWarning: (msg) => this.showWarningMessage(msg),
    });
    this.bookings = new AdminBookings(this);
    this.stats = new AdminStats(this);
    this.settings = new AdminSettings(this);
    this.blockedDates = new AdminBlockedDates(this);

    this.init();
  }

  handleLoginSuccess() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    // Show header buttons
    document.getElementById('backBtn').style.display = 'flex';
    document.getElementById('logoutBtn').style.display = 'flex';
    // Load initial tab data
    this.switchTab('bookings');
  }

  handleLogout() {
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('adminContent').style.display = 'none';
    // Hide header buttons
    document.getElementById('backBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
  }

  async init() {
    // Make sure DataManager is properly initialized and synced
    await dataManager.initData();
    // Force sync with server to get latest data
    await dataManager.syncWithServer();

    this.setupEventListeners();
    await this.auth.checkAuthentication();
  }

  setupEventListeners() {
    // Global navigation
    document.getElementById('backBtn')?.addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    // Tab switching
    document.querySelectorAll('.tab-button').forEach((btn) => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Login form handler
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      await this.auth.login(password);
    });

    // Logout button handler
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      this.auth.logout();
    });

    // Delegate to modules
    this.settings.setupEventListeners();
    this.stats.setupEventListeners();
    this.blockedDates.setupEventListeners();

    // Search listener (Bookings)
    document.getElementById('searchBookings')?.addEventListener('input', (e) => {
      this.bookings.filterBookings(e.target.value);
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.modal').classList.remove('active');
      });
    });
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
    document.getElementById(`${tabName}Tab`)?.classList.add('active');

    // Load data for the selected tab
    switch (tabName) {
      case 'bookings':
        await this.bookings.loadBookings();
        break;
      case 'statistics':
        await this.stats.loadStatistics();
        break;
      case 'christmas':
        await this.settings.loadChristmasCodes();
        await this.settings.loadChristmasPeriods();
        break;
      case 'settings':
        await this.settings.loadEmailTemplate();
        await this.settings.loadRoomConfig();
        await this.settings.loadPriceConfig();
        await this.settings.loadBulkPriceConfig();
        // Christmas settings moved to separate tab
        break;
      case 'blocked':
        await this.blockedDates.loadBlockedDates();
        break;
    }
  }

  // Proxy for auth validation
  validateSession() {
    return this.auth.validateSession();
  }

  // UI Helpers
  // UI Helpers
  showToast(message, type = 'success') {
    if (window.notificationManager) {
      window.notificationManager.show(message, type);
    } else {
      console.warn('NotificationManager not found:', message);
    }
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
    if (window.modalDialog) {
      window.modalDialog
        .confirm({
          title: 'Potvrzení',
          message,
          type: 'warning',
          confirmText: 'Potvrdit',
          cancelText: 'Zrušit',
        })
        .then((confirmed) => {
          if (confirmed && onConfirm) {
            onConfirm();
          }
          if (!confirmed && onCancel) {
            onCancel();
          }
        });
    } else {
      // Fallback
      if (confirm(message)) {
        if (onConfirm) {
          onConfirm();
        }
      } else if (onCancel) {
        onCancel();
      }
    }
  }

  // ========================================
  // Proxy methods for HTML inline handlers
  // These delegate to sub-modules for backward compatibility
  // ========================================

  // AdminBookings proxies
  togglePaidStatus(bookingId, paid) {
    return this.bookings.togglePaidStatus(bookingId, paid);
  }

  // FIX 2025-12-11: Removed parameter - toggleSelectAll now determines state internally
  toggleSelectAll() {
    return this.bookings.toggleSelectAll();
  }

  toggleBookingSelection(bookingId, checked) {
    return this.bookings.toggleBookingSelection(bookingId, checked);
  }

  bulkDeleteBookings() {
    return this.bookings.bulkDeleteBookings();
  }

  bulkPrintBookings() {
    return this.bookings.bulkPrintBookings();
  }

  // AdminStats proxies
  loadStatistics() {
    return this.stats.loadStatistics();
  }

  resetStatisticsFilter() {
    return this.stats.resetStatisticsFilter();
  }

  // AdminBlockedDates proxies
  toggleAllRooms(checkbox) {
    return this.blockedDates.toggleAllRooms(checkbox);
  }

  // Modal helpers
  closeEditModal() {
    const modal = document.getElementById('editBookingModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }
}

// Initialize admin panel
const adminPanel = new AdminPanel();

// Make admin panel globally accessible for real-time updates
window.adminPanel = adminPanel;
