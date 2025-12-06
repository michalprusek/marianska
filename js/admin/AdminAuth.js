/**
 * Admin Authentication Module
 * Handles login, logout, session validation, and auto-refresh.
 */
class AdminAuth {
  // Session timeout constants
  static SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days
  static SESSION_WARNING_TIME = 60 * 60 * 1000; // 1 hour before expiry
  static ACTIVITY_DEBOUNCE_TIME = 1000; // 1 second
  static SESSION_REFRESH_INTERVAL = 60 * 60 * 1000; // Refresh every 1 hour on activity

  constructor(callbacks = {}) {
    this.callbacks = {
      onLoginSuccess: callbacks.onLoginSuccess || (() => {}),
      onLogout: callbacks.onLogout || (() => {}),
      onShowError: callbacks.onShowError || ((msg) => console.error(msg)),
      onShowWarning: callbacks.onShowWarning || ((msg) => console.warn(msg)),
    };

    this.sessionTimeout = null;
    this.sessionWarning = null;
    this.refreshInterval = null;
    this.lastRefreshTime = Date.now();
    this.cleanupSessionListeners = null;
  }

  async init() {
    await this.checkAuthentication();
  }

  async checkAuthentication() {
    // SECURITY FIX: Use sessionStorage (not localStorage) - clears when browser closes
    // This is more secure as it prevents session persistence across browser sessions
    const sessionToken = sessionStorage.getItem('adminSessionToken');
    const sessionExpiry = sessionStorage.getItem('adminSessionExpiry');

    if (sessionToken && sessionExpiry) {
      // FIX: Parse ISO timestamp correctly (not parseInt!)
      const expiryTime = new Date(sessionExpiry).getTime();
      const now = Date.now();

      if (isNaN(expiryTime)) {
        return false;
      }

      if (now < expiryTime) {
        this.callbacks.onLoginSuccess();
        this.setupSessionRefresh(); // Auto-refresh on activity
      } else {
        this.logout(); // Auto-logout on expiry
        this.callbacks.onShowError('Session vypršela - přihlaste se znovu');
      }
    }
  }

  async login(password) {
    const loginResult = await dataManager.authenticateAdmin(password);
    if (loginResult && loginResult.success) {
      // SECURITY FIX: Use sessionStorage (not localStorage) - more secure
      // Session clears when browser closes, reducing XSS attack window
      sessionStorage.setItem('adminSessionToken', loginResult.sessionToken);
      sessionStorage.setItem('adminSessionExpiry', loginResult.expiresAt);
      this.callbacks.onLoginSuccess();
      this.setupSessionRefresh();
      return true;
    }
    this.callbacks.onShowError('Nesprávné heslo');
    return false;
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
    const sessionToken = sessionStorage.getItem('adminSessionToken');
    if (sessionToken) {
      fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'x-session-token': sessionToken,
        },
      }).catch((err) => console.error('Logout error:', err));
    }

    // SECURITY FIX: Clear sessionStorage (more secure than localStorage)
    sessionStorage.removeItem('adminSessionToken');
    sessionStorage.removeItem('adminSessionExpiry');
    sessionStorage.removeItem('adminAuth'); // Old auth token (legacy cleanup)
    // Also clear localStorage in case of legacy tokens
    localStorage.removeItem('adminSessionToken');
    localStorage.removeItem('adminSessionExpiry');

    this.callbacks.onLogout();
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
      this.callbacks.onShowError('Session vypršela z důvodu nečinnosti');
    }, AdminAuth.SESSION_TIMEOUT);

    // Warning timer (1 hour before expiry)
    this.sessionWarning = setTimeout(() => {
      this.callbacks.onShowWarning(
        'Session vyprší za 1 hodinu. Obnovte ji aktivitou nebo se znovu přihlaste.'
      );
    }, AdminAuth.SESSION_TIMEOUT - AdminAuth.SESSION_WARNING_TIME);

    // Refresh session on user activity (throttled to prevent excessive API calls)
    const activityHandler = () => {
      const now = Date.now();
      const timeSinceLastRefresh = now - this.lastRefreshTime;

      // Only refresh if 1 hour has passed since last refresh
      if (timeSinceLastRefresh < AdminAuth.SESSION_REFRESH_INTERVAL) {
        return;
      }

      this.lastRefreshTime = now;

      // Reset client-side timers
      clearTimeout(this.sessionTimeout);
      clearTimeout(this.sessionWarning);

      // Restart timers
      this.sessionTimeout = setTimeout(() => {
        this.logout();
        this.callbacks.onShowError('Session vypršela z důvodu nečinnosti');
      }, AdminAuth.SESSION_TIMEOUT);

      this.sessionWarning = setTimeout(() => {
        this.callbacks.onShowWarning(
          'Session vyprší za 1 hodinu. Obnovte ji aktivitou nebo se znovu přihlaste.'
        );
      }, AdminAuth.SESSION_TIMEOUT - AdminAuth.SESSION_WARNING_TIME);

      // Call refresh endpoint to extend server-side session
      const sessionToken = sessionStorage.getItem('adminSessionToken');
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
              this.callbacks.onShowError('Session vypršela - přihlaste se prosím znovu');
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
              sessionStorage.setItem('adminSessionExpiry', data.expiresAt);
            }
          })
          .catch((err) => {
            console.error('Failed to refresh session:', err);

            // SECURITY FIX: Retry sooner (30 seconds) to prevent session expiry
            if (retryCount === 0) {
              this.callbacks.onShowWarning('Problém s obnovením session - zkusím znovu za 30s');
              setTimeout(() => {
                attemptRefresh(1);
              }, 30 * 1000);
            } else {
              // After 2nd failure, warn user to re-login
              this.callbacks.onShowError(
                'Nepodařilo se obnovit session - zkuste se znovu přihlásit'
              );
            }
          });
      };

      attemptRefresh();
    };

    // Reset timer on user activity (debounced)
    let activityDebounce;
    const debouncedActivity = () => {
      clearTimeout(activityDebounce);
      activityDebounce = setTimeout(activityHandler, AdminAuth.ACTIVITY_DEBOUNCE_TIME);
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

  /**
   * Check if admin session is still valid
   * @returns {boolean} True if session is valid
   */
  isSessionValid() {
    const sessionToken = sessionStorage.getItem('adminSessionToken');
    const sessionExpiry = sessionStorage.getItem('adminSessionExpiry');

    if (!sessionToken || !sessionExpiry) {
      return false;
    }

    // Session expiry is stored as ISO string (e.g., "2025-10-05T12:00:00.000Z")
    const expiryTime = new Date(sessionExpiry).getTime();
    const now = Date.now();

    if (isNaN(expiryTime)) {
      return false;
    }

    // Session expired
    if (expiryTime < now) {
      console.warn('[AdminAuth] Session expired at', new Date(expiryTime));
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
      this.callbacks.onShowError('Vaše session vypršela. Přihlaste se prosím znovu.');
      this.logout();
      return false;
    }
    return true;
  }
}
