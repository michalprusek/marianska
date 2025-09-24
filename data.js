// Data management layer - SERVER-FIRST with real-time sync
class DataManager {
    constructor() {
        this.apiUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:3000/api'
            : '/api';
        this.cachedData = null;
        this.storageKey = 'chataMarianska';
        this.syncInterval = null;
        this.lastSync = null;
    }

    async initData() {
        // Try to load from server FIRST
        try {
            const response = await fetch(`${this.apiUrl}/data`);
            if (response.ok) {
                this.cachedData = await response.json();
                this.lastSync = Date.now();
                // Save to localStorage as backup
                localStorage.setItem(this.storageKey, JSON.stringify(this.cachedData));
                console.log('Data loaded from server');

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
                console.log('Data loaded from localStorage (server unavailable)');

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
        console.log('Default data initialized');

        // Start sync attempts
        this.startAutoSync();
    }

    // Start automatic synchronization every 5 seconds
    startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        // Sync every 5 seconds
        this.syncInterval = setInterval(async () => {
            await this.syncWithServer();
        }, 5000);

        // Also sync on visibility change
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                await this.syncWithServer();
            }
        });
    }

    async syncWithServer() {
        try {
            // Get latest data from server
            const response = await fetch(`${this.apiUrl}/data`);
            if (response.ok) {
                const serverData = await response.json();

                // Check if server data is newer
                const serverTimestamp = this.getLatestTimestamp(serverData);
                const localTimestamp = this.getLatestTimestamp(this.cachedData);

                if (serverTimestamp > localTimestamp) {
                    // Server has newer data - update local
                    this.cachedData = serverData;
                    localStorage.setItem(this.storageKey, JSON.stringify(this.cachedData));

                    // Trigger UI update
                    if (window.bookingApp) {
                        await window.bookingApp.renderCalendar();
                        await window.bookingApp.updatePriceCalculation();
                    }

                    console.log('Data synced from server (newer data found)');
                } else if (localTimestamp > serverTimestamp) {
                    // Local has newer data - push to server
                    await this.pushToServer();
                }

                this.lastSync = Date.now();
            }
        } catch (error) {
            console.log('Sync failed (server might be offline):', error.message);
        }
    }

    getLatestTimestamp(data) {
        let latest = 0;

        // Check bookings
        if (data.bookings) {
            data.bookings.forEach(b => {
                const updated = new Date(b.updatedAt || b.createdAt).getTime();
                if (updated > latest) latest = updated;
            });
        }

        // Check blocked dates
        if (data.blockedDates) {
            data.blockedDates.forEach(bd => {
                const blocked = new Date(bd.blockedAt).getTime();
                if (blocked > latest) latest = blocked;
            });
        }

        return latest;
    }

    async pushToServer() {
        try {
            const response = await fetch(`${this.apiUrl}/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.cachedData)
            });
            if (response.ok) {
                console.log('Data pushed to server');
            }
        } catch (error) {
            console.log('Failed to push to server:', error.message);
        }
    }

    getDefaultData() {
        return {
            bookings: [],
            blockedDates: [],
            settings: {
                adminPassword: 'admin123',
                christmasAccessCodes: ['XMAS2024'],
                christmasPeriod: {
                    start: '2024-12-23',
                    end: '2025-01-02'
                },
                emailSettings: {
                    mockMode: true
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
                    { id: '44', name: 'Pokoj 44', type: 'large', beds: 4 }
                ],
                prices: {
                    utia: {
                        small: { base: 300, adult: 50, child: 25 },
                        large: { base: 400, adult: 50, child: 25 }
                    },
                    external: {
                        small: { base: 500, adult: 100, child: 50 },
                        large: { base: 600, adult: 100, child: 50 }
                    }
                }
            }
        };
    }

    async getData() {
        if (!this.cachedData) {
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
            const response = await fetch(`${this.apiUrl}/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                console.log('Data saved to server');
                return true;
            }
        } catch (error) {
            console.error('Failed to save to server, data saved locally:', error);
        }

        return true;
    }

    // Booking management
    async createBooking(bookingData) {
        const booking = {
            ...bookingData,
            id: this.generateBookingId(),
            editToken: this.generateEditToken(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const data = await this.getData();
        data.bookings.push(booking);

        const saved = await this.saveData(data);
        if (saved) {
            // Force immediate sync
            await this.syncWithServer();
            return booking;
        }

        return null;
    }

    async updateBooking(bookingId, updates) {
        const data = await this.getData();
        const index = data.bookings.findIndex(b => b.id === bookingId);

        if (index === -1) {
            return null;
        }

        data.bookings[index] = {
            ...data.bookings[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        const saved = await this.saveData(data);
        if (saved) {
            await this.syncWithServer();
            return data.bookings[index];
        }

        return null;
    }

    async deleteBooking(bookingId) {
        const data = await this.getData();
        const initialLength = data.bookings.length;
        data.bookings = data.bookings.filter(b => b.id !== bookingId);

        if (data.bookings.length < initialLength) {
            const saved = await this.saveData(data);
            if (saved) {
                await this.syncWithServer();
                return true;
            }
        }

        return false;
    }

    async getBooking(bookingId) {
        const data = await this.getData();
        return data.bookings.find(b => b.id === bookingId);
    }

    async getBookingByEditToken(token) {
        const data = await this.getData();
        return data.bookings.find(b => b.editToken === token);
    }

    async getAllBookings() {
        const data = await this.getData();
        return data.bookings;
    }

    async getBookingsForDateRange(startDate, endDate) {
        const data = await this.getData();
        return data.bookings.filter(booking => {
            const bookingStart = new Date(booking.startDate);
            const bookingEnd = new Date(booking.endDate);
            return (bookingStart <= endDate && bookingEnd >= startDate);
        });
    }

    async getRoomAvailability(date, roomId) {
        const data = await this.getData();
        const dateStr = this.formatDate(date);

        // Check if date is blocked
        if (data.blockedDates && data.blockedDates.some(bd => bd.date === dateStr && (!bd.roomId || bd.roomId === roomId))) {
            return { status: 'blocked', email: null };
        }

        // Check if room is booked
        const bookings = data.bookings.filter(booking => {
            const checkDateStr = this.formatDate(date);
            return booking.rooms.includes(roomId) &&
                   checkDateStr >= booking.startDate &&
                   checkDateStr <= booking.endDate;
        });

        if (bookings.length > 0) {
            return { status: 'booked', email: bookings[0].email };
        }

        return { status: 'available', email: null };
    }

    // Generate color from email for consistent coloring
    getColorForEmail(email) {
        if (!email) return '#FF3B30';

        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
            '#DDA0DD', '#98D8C8', '#FFB6C1', '#87CEEB', '#F7DC6F',
            '#BB8FCE', '#85C1E2', '#F8B739', '#82E0AA', '#F1948A',
        ];

        let hash = 0;
        for (let i = 0; i < email.length; i++) {
            hash = email.charCodeAt(i) + ((hash << 5) - hash);
        }

        const index = Math.abs(hash) % colors.length;
        return colors[index];
    }

    // Christmas period rules
    async isChristmasPeriod(date) {
        const settings = await this.getSettings();
        const dateStr = this.formatDate(date);

        // Check new format with multiple periods
        if (settings.christmasPeriods && Array.isArray(settings.christmasPeriods)) {
            return settings.christmasPeriods.some(period => {
                return dateStr >= period.start && dateStr <= period.end;
            });
        }

        // Check old single period format for backward compatibility
        if (settings.christmasPeriod && settings.christmasPeriod.start && settings.christmasPeriod.end) {
            const startDate = settings.christmasPeriod.start;
            const endDate = settings.christmasPeriod.end;
            return dateStr >= startDate && dateStr <= endDate;
        }

        // Fallback to default dates
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();

        if (month === 11 && day >= 23) return true;
        if (month === 0 && day <= 2) return true;

        return false;
    }

    async requiresChristmasCode(startDate) {
        const today = new Date();
        const christmasYear = startDate.getFullYear();

        // Deadline je 30.9. roku, kdy se konají vánoční prázdniny
        const deadline = new Date(christmasYear, 8, 30); // měsíc 8 = září (0-indexed)

        // Pokud je dnes po 30.9. roku vánočních prázdnin, kód se nevyžaduje
        return today <= deadline;
    }

    async canBulkBookChristmas() {
        const data = await this.getData();
        const today = new Date();

        // Zkontroluj všechna vánoční období
        for (const period of data.settings.christmasPeriods || []) {
            const christmasYear = period.year;
            const deadline = new Date(christmasYear, 9, 1); // 1.10. roku vánočních prázdnin

            // Pokud je před 1.10. roku vánočních prázdnin, hromadné rezervace nejsou povoleny
            if (today < deadline) {
                return false;
            }
        }

        return true;
    }

    async canBookChristmasPeriod(userEmail, accessCode, startDate) {
        const data = await this.getData();

        // Pokud je po 30.9. roku vánočních prázdnin, rezervace je povolena bez kódu
        if (!await this.requiresChristmasCode(startDate)) {
            return true;
        }

        // Před 30.9. se vyžaduje přístupový kód
        if (accessCode && data.settings.christmasAccessCodes.includes(accessCode)) {
            return true;
        }

        return false;
    }

    async getChristmasBookings() {
        const data = await this.getData();
        const bookings = [];
        for (const booking of data.bookings) {
            const startDate = new Date(booking.startDate);
            if (await this.isChristmasPeriod(startDate)) {
                bookings.push(booking);
            }
        }
        return bookings;
    }

    // Blocked dates management
    async blockDate(date, roomId = null, reason = '', blockageId = null) {
        const data = await this.getData();
        const blockedDate = {
            date: this.formatDate(date),
            roomId,
            reason,
            blockageId: blockageId || this.generateBlockageId(),
            blockedAt: new Date().toISOString()
        };

        if (!data.blockedDates) {
            data.blockedDates = [];
        }

        data.blockedDates.push(blockedDate);
        await this.saveData(data);
        await this.syncWithServer();
        return blockedDate.blockageId;
    }

    generateBlockageId() {
        return 'BLK' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
    }

    async unblockDate(date, roomId = null) {
        const data = await this.getData();
        const dateStr = this.formatDate(date);
        if (data.blockedDates) {
            data.blockedDates = data.blockedDates.filter(bd =>
                !(bd.date === dateStr && bd.roomId === roomId)
            );
        }
        await this.saveData(data);
        await this.syncWithServer();
    }

    async getBlockedDates() {
        const data = await this.getData();
        return data.blockedDates || [];
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

    // Admin authentication
    async authenticateAdmin(password) {
        const data = await this.getData();
        return data.settings.adminPassword === password;
    }

    // Utility functions
    generateBookingId() {
        return 'BK' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
    }

    generateEditToken() {
        return Math.random().toString(36).substr(2, 15) + Math.random().toString(36).substr(2, 15);
    }

    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Price calculation
    async calculatePrice(roomType, guestType, adults, children, toddlers, nights) {
        const settings = await this.getSettings();
        const prices = settings.prices || {
            utia: {
                small: { base: 300, adult: 50, child: 25 },
                large: { base: 400, adult: 50, child: 25 }
            },
            external: {
                small: { base: 500, adult: 100, child: 50 },
                large: { base: 600, adult: 100, child: 50 }
            }
        };

        let pricePerNight = 0;
        const guestKey = guestType === 'utia' ? 'utia' : 'external';
        const roomKey = roomType === 'small' ? 'small' : 'large';
        const priceConfig = prices[guestKey][roomKey];

        pricePerNight = priceConfig.base;
        pricePerNight += (adults - 1) * priceConfig.adult;
        pricePerNight += children * priceConfig.child;

        return pricePerNight * nights;
    }

    // Get room configuration
    async getRooms() {
        const settings = await this.getSettings();
        const data = await this.getData();
        return settings.rooms || data.rooms || this.getDefaultData().settings.rooms;
    }

    // Mock email service
    sendEmail(to, subject, body) {
        console.log('=== MOCK EMAIL ===');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('Body:', body);
        console.log('==================');

        const emails = JSON.parse(localStorage.getItem('mockEmails') || '[]');
        emails.push({
            to,
            subject,
            body,
            sentAt: new Date().toISOString()
        });
        localStorage.setItem('mockEmails', JSON.stringify(emails));

        return true;
    }

    async sendBookingConfirmation(booking) {
        const editUrl = `${window.location.origin}/edit.html?token=${booking.editToken}`;
        const settings = await this.getSettings();
        const emailSettings = settings.emailTemplate || {};

        const subject = emailSettings.subject ?
            emailSettings.subject.replace('{booking_id}', booking.id) :
            `Potvrzení rezervace - ${booking.id}`;

        let body = emailSettings.template || `Dobrý den {name},

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

        body = body.replace(/{booking_id}/g, booking.id)
            .replace(/{name}/g, booking.name)
            .replace(/{start_date}/g, startDate.toLocaleDateString('cs-CZ'))
            .replace(/{end_date}/g, endDate.toLocaleDateString('cs-CZ'))
            .replace(/{rooms}/g, booking.rooms.join(', '))
            .replace(/{total_price}/g, booking.totalPrice)
            .replace(/{adults}/g, booking.adults)
            .replace(/{children}/g, booking.children)
            .replace(/{toddlers}/g, booking.toddlers)
            .replace(/{edit_url}/g, editUrl);

        return this.sendEmail(booking.email, subject, body);
    }

    async sendContactMessage(bookingId, fromEmail, message) {
        const booking = await this.getBooking(bookingId);
        if (!booking) return false;

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