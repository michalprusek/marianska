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
            onLoginSuccess: callbacks.onLoginSuccess || (() => { }),
            onLogout: callbacks.onLogout || (() => { }),
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
        // SECURITY FIX: Check session token with expiry (using localStorage for persistence)
        const sessionToken = localStorage.getItem('adminSessionToken');
        const sessionExpiry = localStorage.getItem('adminSessionExpiry');

        if (sessionToken && sessionExpiry) {
            // FIX: Parse ISO timestamp correctly (not parseInt!)
            const expiryTime = new Date(sessionExpiry).getTime();
            const now = Date.now();

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
            // SECURITY FIX: Store session token and expiry in localStorage for persistence
            localStorage.setItem('adminSessionToken', loginResult.sessionToken);
            localStorage.setItem('adminSessionExpiry', loginResult.expiresAt);
            this.callbacks.onLoginSuccess();
            this.setupSessionRefresh();
            return true;
        } else {
            this.callbacks.onShowError('Nesprávné heslo');
            return false;
        }
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
