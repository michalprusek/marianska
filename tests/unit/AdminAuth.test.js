/**
 * Unit tests for AdminAuth session validation
 * Tests critical session management logic including:
 * - Session token and expiry validation
 * - Session expiration detection
 * - Auto-logout on expiry
 */

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

// Mock sessionStorage
const sessionStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

// Mock document for event listeners
const documentMock = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
};

// Mock fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
    })
);

// Set up globals before requiring AdminAuth
Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock });
Object.defineProperty(global, 'document', { value: documentMock });

// Mock dataManager
global.dataManager = {
    authenticateAdmin: jest.fn(),
};

// Load AdminAuth class
const fs = require('fs');
const path = require('path');
const adminAuthCode = fs.readFileSync(
    path.join(__dirname, '../../js/admin/AdminAuth.js'),
    'utf8'
);
eval(adminAuthCode);

describe('AdminAuth', () => {
    let auth;
    let mockCallbacks;

    beforeEach(() => {
        // Clear all mocks and storage
        jest.clearAllMocks();
        localStorageMock.clear();
        sessionStorageMock.clear();

        // Reset fetch mock
        global.fetch.mockClear();

        // Create mock callbacks
        mockCallbacks = {
            onLoginSuccess: jest.fn(),
            onLogout: jest.fn(),
            onShowError: jest.fn(),
            onShowWarning: jest.fn(),
        };

        // Create new AdminAuth instance
        auth = new AdminAuth(mockCallbacks);

        // Use fake timers
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('isSessionValid', () => {
        test('should return false when no session token exists', () => {
            localStorageMock.getItem.mockImplementation((key) => null);

            expect(auth.isSessionValid()).toBe(false);
        });

        test('should return false when session token exists but no expiry', () => {
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'valid-token';
                return null;
            });

            expect(auth.isSessionValid()).toBe(false);
        });

        test('should return false when session has expired', () => {
            const pastDate = new Date(Date.now() - 1000).toISOString();
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'valid-token';
                if (key === 'adminSessionExpiry') return pastDate;
                return null;
            });

            expect(auth.isSessionValid()).toBe(false);
        });

        test('should return true when session is valid and not expired', () => {
            const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'valid-token';
                if (key === 'adminSessionExpiry') return futureDate;
                return null;
            });

            expect(auth.isSessionValid()).toBe(true);
        });

        test('should correctly parse ISO timestamp format', () => {
            // Test with exact ISO format that server returns
            const futureDate = '2099-12-31T23:59:59.000Z';
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'valid-token';
                if (key === 'adminSessionExpiry') return futureDate;
                return null;
            });

            expect(auth.isSessionValid()).toBe(true);
        });

        test('should return false for invalid date format', () => {
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'valid-token';
                if (key === 'adminSessionExpiry') return 'invalid-date';
                return null;
            });

            // Invalid date will result in NaN which is < now
            expect(auth.isSessionValid()).toBe(false);
        });
    });

    describe('validateSession', () => {
        test('should return true and not logout when session is valid', () => {
            const futureDate = new Date(Date.now() + 86400000).toISOString();
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'valid-token';
                if (key === 'adminSessionExpiry') return futureDate;
                return null;
            });

            expect(auth.validateSession()).toBe(true);
            expect(mockCallbacks.onShowError).not.toHaveBeenCalled();
            expect(mockCallbacks.onLogout).not.toHaveBeenCalled();
        });

        test('should return false, show error, and logout when session expired', () => {
            const pastDate = new Date(Date.now() - 1000).toISOString();
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'valid-token';
                if (key === 'adminSessionExpiry') return pastDate;
                return null;
            });

            expect(auth.validateSession()).toBe(false);
            expect(mockCallbacks.onShowError).toHaveBeenCalledWith(
                'Vaše session vypršela. Přihlaste se prosím znovu.'
            );
            expect(mockCallbacks.onLogout).toHaveBeenCalled();
        });

        test('should return false and logout when no session exists', () => {
            localStorageMock.getItem.mockImplementation(() => null);

            expect(auth.validateSession()).toBe(false);
            expect(mockCallbacks.onShowError).toHaveBeenCalled();
            expect(mockCallbacks.onLogout).toHaveBeenCalled();
        });
    });

    describe('checkAuthentication', () => {
        test('should call onLoginSuccess when session is valid', async () => {
            const futureDate = new Date(Date.now() + 86400000).toISOString();
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'valid-token';
                if (key === 'adminSessionExpiry') return futureDate;
                return null;
            });

            await auth.checkAuthentication();

            expect(mockCallbacks.onLoginSuccess).toHaveBeenCalled();
        });

        test('should logout and show error when session expired', async () => {
            const pastDate = new Date(Date.now() - 1000).toISOString();
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'valid-token';
                if (key === 'adminSessionExpiry') return pastDate;
                return null;
            });

            await auth.checkAuthentication();

            expect(mockCallbacks.onLogout).toHaveBeenCalled();
            expect(mockCallbacks.onShowError).toHaveBeenCalledWith(
                'Session vypršela - přihlaste se znovu'
            );
        });

        test('should not call any callbacks when no session exists', async () => {
            localStorageMock.getItem.mockImplementation(() => null);

            await auth.checkAuthentication();

            expect(mockCallbacks.onLoginSuccess).not.toHaveBeenCalled();
            expect(mockCallbacks.onLogout).not.toHaveBeenCalled();
            expect(mockCallbacks.onShowError).not.toHaveBeenCalled();
        });
    });

    describe('logout', () => {
        test('should clear localStorage session data', () => {
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'test-token';
                return null;
            });

            auth.logout();

            expect(localStorageMock.removeItem).toHaveBeenCalledWith('adminSessionToken');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('adminSessionExpiry');
        });

        test('should call logout API endpoint', () => {
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'test-token';
                return null;
            });

            auth.logout();

            expect(global.fetch).toHaveBeenCalledWith('/api/admin/logout', {
                method: 'POST',
                headers: {
                    'x-session-token': 'test-token',
                },
            });
        });

        test('should call onLogout callback', () => {
            auth.logout();

            expect(mockCallbacks.onLogout).toHaveBeenCalled();
        });

        test('should clear session timeout timers', () => {
            // Setup session refresh first to create timers
            const futureDate = new Date(Date.now() + 86400000).toISOString();
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'adminSessionToken') return 'valid-token';
                if (key === 'adminSessionExpiry') return futureDate;
                return null;
            });

            auth.setupSessionRefresh();
            auth.logout();

            // Advance timers - if timers weren't cleared, callbacks would be called
            jest.advanceTimersByTime(AdminAuth.SESSION_TIMEOUT + 1000);

            // onShowError should not be called for session expiry
            // (it would be called if timers weren't cleared)
            expect(mockCallbacks.onShowError).not.toHaveBeenCalledWith(
                'Session vypršela z důvodu nečinnosti'
            );
        });
    });

    describe('Static constants', () => {
        test('SESSION_TIMEOUT should be 7 days', () => {
            expect(AdminAuth.SESSION_TIMEOUT).toBe(7 * 24 * 60 * 60 * 1000);
        });

        test('SESSION_WARNING_TIME should be 1 hour', () => {
            expect(AdminAuth.SESSION_WARNING_TIME).toBe(60 * 60 * 1000);
        });

        test('SESSION_REFRESH_INTERVAL should be 1 hour', () => {
            expect(AdminAuth.SESSION_REFRESH_INTERVAL).toBe(60 * 60 * 1000);
        });
    });
});
