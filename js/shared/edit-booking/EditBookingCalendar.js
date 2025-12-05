/**
 * EditBookingCalendar Module
 * Handles calendar initialization and interaction for the booking edit flow.
 */
class EditBookingCalendar {
    constructor(config) {
        this.mode = config.mode || 'user';
        this.containerId = config.containerId || 'editCalendarContainer';
        this.getSettings = config.getSettings;
        this.onDateSelect = config.onDateSelect;
        this.onDateDeselect = config.onDateDeselect;
        this.calendar = null;
    }

    /**
     * Initialize the calendar
     * @param {Object} params - Initialization parameters
     * @param {Object} params.booking - Current booking data
     * @param {string} params.startDate - Current selected start date
     * @param {string} params.endDate - Current selected end date
     * @param {string} params.originalStartDate - Original booking start date
     * @param {string} params.originalEndDate - Original booking end date
     * @param {string} params.sessionId - Edit session ID
     */
    async initialize({ booking, startDate, endDate, originalStartDate, originalEndDate, sessionId }) {
        this.calendar = new BaseCalendar({
            mode: BaseCalendar.MODES.EDIT,
            app: {
                getAllData: () => dataManager.getAllData(),
                getSettings: this.getSettings,
            },
            containerId: this.containerId,
            enableDrag: true,
            allowPast: this.mode === 'admin', // Admin can edit past dates
            onDateSelect: this.onDateSelect,
            onDateDeselect: this.onDateDeselect,
            selectedDates: new Set([startDate, endDate].filter(Boolean)),
            currentEditingBookingId: booking.id,
            originalBookingDates: {
                startDate: originalStartDate,
                endDate: originalEndDate,
                rooms: booking.rooms || [],
            },
            sessionId: sessionId, // CRITICAL: Pass edit session ID to exclude own proposed bookings
        });

        await this.calendar.render();
    }

    /**
     * Initialize calendar for a specific room
     * @param {Object} params - Initialization parameters
     */
    async initializeRoomCalendar({ roomId, originalDates, onDateSelect, onDateDeselect, bookingId, sessionId }) {
        this.calendar = new BaseCalendar({
            mode: BaseCalendar.MODES.SINGLE_ROOM,
            app: {
                getAllData: () => dataManager.getAllData(),
                getSettings: this.getSettings,
            },
            containerId: this.containerId,
            roomId,
            enableDrag: true,
            allowPast: this.mode === 'admin',
            minNights: 1,
            onDateSelect,
            onDateDeselect,
            currentEditingBookingId: bookingId,
            sessionId: sessionId,
            originalBookingDates: {
                startDate: originalDates.startDate,
                endDate: originalDates.endDate,
                rooms: [roomId],
            },
        });

        await this.calendar.render();
    }

    /**
     * Update selected dates in the calendar
     * @param {string} startDate 
     * @param {string} endDate 
     */
    updateSelection(startDate, endDate) {
        if (this.calendar) {
            this.calendar.selectedDates = new Set([startDate, endDate].filter(Boolean));
            this.calendar.render(); // Re-render to show selection
        }
    }

    /**
     * Destroy the calendar instance
     */
    destroy() {
        if (this.calendar) {
            // BaseCalendar doesn't have a destroy method shown, but we can clear the container
            const container = document.getElementById(this.containerId);
            if (container) {
                container.innerHTML = '';
            }
            this.calendar = null;
        }
    }
}

// Export for use in other files
window.EditBookingCalendar = EditBookingCalendar;
