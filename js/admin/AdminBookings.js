/**
 * Admin Bookings Module
 * Handles loading, filtering, and rendering the bookings table.
 */
class AdminBookings {
    constructor(adminPanel) {
        this.adminPanel = adminPanel; // Reference to main AdminPanel for callbacks/delegation
        this.isLoadingBookings = false;
        this.selectedBookings = new Set();
        this.editComponent = null;
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
        // FIX 2025-12-04: Only use explicit isBulkBooking flag, NOT room count
        // A booking with 9 rooms is NOT necessarily a bulk booking
        const isBulk = booking.isBulkBooking === true;

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
        if (
            breakdown &&
            (breakdown.utiaAdults > 0 || breakdown.utiaChildren > 0) &&
            (breakdown.externalAdults > 0 || breakdown.externalChildren > 0)
        ) {
            // Mixed booking - show both types
            const utiaTotal = (breakdown.utiaAdults || 0) + (breakdown.utiaChildren || 0);
            const externalTotal = (breakdown.externalAdults || 0) + (breakdown.externalChildren || 0);

            let parts = [];
            if (utiaTotal > 0) {
                parts.push(`<span style="color: #059669; font-weight: 600;">ÚTIA: ${utiaTotal}</span>`);
            }
            if (externalTotal > 0) {
                parts.push(
                    `<span style="color: #dc2626; font-weight: 600;">Externí: ${externalTotal}</span>`
                );
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

        // Single room or bulk booking: display by person type only (no per-room breakdown needed)
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

    async loadBookings() {
        // Mutex: prevent concurrent calls that cause duplicate rows
        if (this.isLoadingBookings) {
            return;
        }
        this.isLoadingBookings = true;

        try {
            const bookings = await dataManager.getAllBookings();
            const settings = await dataManager.getSettings(); // SSOT FIX 2025-12-04: Fetch current settings
            const tbody = document.getElementById('bookingsTableBody');

            if (!tbody) return;

            tbody.innerHTML = '';

            bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // SSOT FIX 2025-12-04: Always recalculate prices using current settings (SSOT)
            // This ensures list view shows the same price as edit view
            const bookingPrices = new Map();
            bookings.forEach((booking) => {
                bookingPrices.set(booking.id, this.getBookingPrice(booking, settings));
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
                        <button class="btn-modern btn-view" onclick="adminPanel.bookings.viewBookingDetails('${booking.id}')" title="Zobrazit detail">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            Detail
                        </button>
                        <button class="btn-modern btn-edit" onclick="adminPanel.bookings.editBooking('${booking.id}')" title="Upravit rezervaci">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Upravit
                        </button>
                        <button class="btn-modern btn-delete" onclick="adminPanel.bookings.deleteBooking('${booking.id}')" title="Smazat rezervaci">
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
     * FIXED 2025-12-04: Calculate price from current settings (SSOT).
     *
     * Admin panel should ALWAYS show prices calculated from current price settings.
     * The stored booking.totalPrice is historical - what was charged at booking time.
     *
     * @param {Object} booking - Booking object
     * @param {Object} settings - Current settings with prices
     * @returns {number} Recalculated price from current settings
     */
    getBookingPrice(booking, settings) {
        if (!settings || !settings.prices) {
            // Fallback to stored price if settings not available
            return booking.totalPrice || 0;
        }

        try {
            if (booking.isBulkBooking) {
                // Bulk booking - use bulk pricing
                return PriceCalculator.calculateMixedBulkPrice({
                    utiaAdults: booking.guestTypeBreakdown?.utiaAdults || 0,
                    externalAdults: booking.guestTypeBreakdown?.externalAdults || booking.adults || 0,
                    utiaChildren: booking.guestTypeBreakdown?.utiaChildren || 0,
                    externalChildren: booking.guestTypeBreakdown?.externalChildren || booking.children || 0,
                    nights: this.calculateNights(booking),
                    settings: settings,
                });
            } else {
                // Individual room booking - use per-guest pricing if available
                if (booking.guestNames && booking.guestNames.length > 0) {
                    return PriceCalculator.calculatePerGuestPrice({
                        rooms: booking.rooms || [],
                        guestNames: booking.guestNames,
                        nights: this.calculateNights(booking),
                        settings: settings,
                        fallbackGuestType: booking.guestType || 'external',
                    });
                } else {
                    // Fallback to simple calculation
                    return PriceCalculator.calculatePrice({
                        guestType: booking.guestType || 'external',
                        adults: booking.adults || 0,
                        children: booking.children || 0,
                        toddlers: booking.toddlers || 0,
                        nights: this.calculateNights(booking),
                        rooms: booking.rooms || [],
                        settings: settings,
                    });
                }
            }
        } catch (error) {
            console.error('[AdminBookings] Error calculating price:', error);
            // Fallback to stored price on error
            return booking.totalPrice || 0;
        }
    }

    /**
     * Calculate number of nights for a booking
     * @param {Object} booking - Booking object
     * @returns {number} Number of nights
     */
    calculateNights(booking) {
        const start = new Date(booking.startDate);
        const end = new Date(booking.endDate);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
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

                ${booking.isBulkBooking
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
            // FIX 2025-12-04: Only use explicit isBulkBooking flag
            booking.isBulkBooking === true
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
            // FIX 2025-12-04: Only use explicit isBulkBooking flag
            booking.isBulkBooking === true
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
                            <div style="color: #ef4444; font-size: 0.85rem;">
                              ⚠️ Chybí údaje o hostech v pokojích (celkem: ${booking.adults} dosp., ${booking.children} děti, ${booking.toddlers} bat.)
                            </div>
                          `
            }
                            <!-- Show totals in gray for reference (only for non-bulk with perRoomGuests) -->
                            ${
            // FIX 2025-12-04: Only use explicit isBulkBooking flag
            booking.isBulkBooking !== true &&
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

                    ${booking.guestNames && booking.guestNames.length > 0
                ? `
                    <div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Jména hostů (podle pokojů):</strong>
                            <button
                                onclick="adminPanel.bookings.copyGuestNames('${booking.id}')"
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

                    <!-- FIXED 2025-12-04: Always show price breakdown with recalculated prices from current settings -->
                    <div style="margin-bottom: 1rem;">
                        ${await this.generatePerRoomPriceBreakdown(booking)}
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        ${booking.payFromBenefit
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

                    ${booking.notes
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
                            ${booking.updatedAt
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
                    <button class="btn btn-primary" onclick="adminPanel.bookings.editBooking('${booking.id}'); this.closest('.modal').remove()">Upravit rezervaci</button>
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
                this.adminPanel.showErrorMessage('Rezervace nebyla nalezena. Zkuste obnovit stránku.');
                return;
            }

            // Store booking for reference
            this.adminPanel.currentEditBooking = booking;

            // Get settings
            const settings = await dataManager.getSettings();

            // Initialize EditBookingComponent for admin mode
            this.editComponent = new EditBookingComponent({
                mode: 'admin',
                enforceDeadline: false, // Admin can edit any time
                validateSession: () => this.adminPanel.validateSession(),
                onSubmit: (formData) => this.handleEditBookingSubmit(formData),
                onDelete: (id) => this.handleEditBookingDelete(id),
                settings,
            });

            // CRITICAL: Expose editComponent on adminPanel for inline event handlers
            // The EditBookingRooms.js generates handlers like: adminPanel.editComponent.rooms.updateRoomGuests(...)
            this.adminPanel.editComponent = this.editComponent;

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
            this.adminPanel.showErrorMessage(
                error.message || 'Chyba při načítání rezervace. Zkuste obnovit stránku.'
            );
        }
    }

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

                this.adminPanel.showSuccessMessage('Rezervace byla úspěšně upravena');
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

                this.adminPanel.showSuccessMessage('Rezervace byla úspěšně vytvořena');
            }

            document.getElementById('editBookingModal').classList.remove('active');
            await this.loadBookings();
        } catch (error) {
            console.error('Chyba při ukládání rezervace:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
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

            this.adminPanel.showSuccessMessage('Rezervace byla smazána');
            document.getElementById('editBookingModal').classList.remove('active');
            await this.loadBookings();
        } catch (error) {
            console.error('Chyba při mazání rezervace:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
        }
    }

    async deleteBooking(bookingId) {
        this.adminPanel.showConfirm('Opravdu chcete smazat tuto rezervaci?', async () => {
            // FIX: Validate session before admin operation
            if (!(await this.adminPanel.validateSession())) {
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

                // Sync with server to get updated data (force refresh for immediate update)
                await dataManager.syncWithServer(true);

                this.adminPanel.showSuccessMessage('Rezervace byla smazána');
                await this.loadBookings();
            } catch (error) {
                console.error('Chyba při mazání rezervace:', error);
                this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
            }
        });
    }

    /**
     * Copy guest names to clipboard
     * @param {string} bookingId - Booking ID to copy guest names from
     */
    async copyGuestNames(bookingId) {
        try {
            const booking = await dataManager.getBooking(bookingId);
            if (!booking || !booking.guestNames || booking.guestNames.length === 0) {
                this.adminPanel.showToast('Žádná jména hostů k zkopírování', 'warning');
                return;
            }

            // Format: "FirstName LastName\n" for each guest
            const guestNamesText = booking.guestNames
                .map((guest) => `${guest.firstName} ${guest.lastName}`)
                .join('\n');

            // Copy to clipboard
            await navigator.clipboard.writeText(guestNamesText);
            this.adminPanel.showToast(`Zkopírováno ${booking.guestNames.length} jmen hostů`, 'success');
        } catch (error) {
            console.error('Chyba při kopírování jmen hostů:', error);
            this.adminPanel.showToast('Nepodařilo se zkopírovat jména hostů', 'error');
        }
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
            // FIX 2025-12-03: Extract per-room guest type breakdown from guestNames
            // guestNames contains individual guests with their guestPriceType (utia/external)
            const perRoomGuests = [];
            for (const roomId of booking.rooms) {
                const roomGuests = booking.perRoomGuests[roomId];
                if (roomGuests) {
                    // Count ÚTIA vs External guests for this room from guestNames
                    let utiaAdults = 0;
                    let externalAdults = 0;
                    let utiaChildren = 0;
                    let externalChildren = 0;

                    if (booking.guestNames && Array.isArray(booking.guestNames)) {
                        // Filter guests assigned to this room
                        // FIX 2025-12-03: Use String() for type-safe comparison (roomId may be string or number)
                        const roomGuestNames = booking.guestNames.filter(
                            (g) => String(g.roomId) === String(roomId)
                        );
                        for (const guest of roomGuestNames) {
                            // FIX 2025-12-03: Log when guestPriceType falls back to 'external' (data integrity check)
                            if (!guest.guestPriceType) {
                                console.warn(
                                    '[AdminPanel] Missing guestPriceType for guest, defaulting to external:',
                                    {
                                        bookingId: booking.id,
                                        guestName: `${guest.firstName} ${guest.lastName}`,
                                        roomId: guest.roomId,
                                    }
                                );
                            }
                            const priceType = guest.guestPriceType || 'external';
                            const personType = guest.personType || 'adult';

                            if (personType === 'adult') {
                                if (priceType === 'utia') {
                                    utiaAdults += 1;
                                } else {
                                    externalAdults += 1;
                                }
                            } else if (personType === 'child') {
                                if (priceType === 'utia') {
                                    utiaChildren += 1;
                                } else {
                                    externalChildren += 1;
                                }
                            }
                            // toddlers don't affect pricing
                        }
                    }

                    // Determine room guestType: ÚTIA if any ÚTIA guests in this room
                    const hasUtiaGuest = utiaAdults > 0 || utiaChildren > 0;
                    const roomGuestType = hasUtiaGuest
                        ? 'utia'
                        : roomGuests.guestType || booking.guestType || 'external';

                    perRoomGuests.push({
                        roomId,
                        adults: roomGuests.adults || 0,
                        children: roomGuests.children || 0,
                        toddlers: roomGuests.toddlers || 0,
                        guestType: roomGuestType,
                        utiaAdults,
                        externalAdults,
                        utiaChildren,
                        externalChildren,
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

            // Format HTML - SSOT FIX 2025-12-04: Pass booking.totalPrice as authoritative total
            // This ensures the detail view shows the same price as the booking list (SSOT principle)
            // If recalculated price differs, formatPerRoomPricesHTML() will show an info note
            let html = PriceCalculator.formatPerRoomPricesHTML(perRoomPrices, 'cs', booking.totalPrice);

            return html;
        } catch (error) {
            console.error('[AdminPanel] Failed to generate price breakdown:', {
                error: error.message,
                bookingId: booking?.id,
            });
            return `<div style="color: #dc2626; padding: 0.5rem; font-size: 0.85rem;">
        ⚠️ Chyba při generování rozpisu cen
      </div>`;
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
        const requiredFields = [
            'basePrice',
            'utiaAdult',
            'utiaChild',
            'externalAdult',
            'externalChild',
        ];
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

        // SSOT: Use PriceCalculator for total price calculation
        const totalPrice = PriceCalculator.calculateMixedBulkPrice({
            utiaAdults,
            externalAdults,
            utiaChildren,
            externalChildren,
            nights,
            settings,
        });

        // Calculate individual components for display purposes only
        const basePrice = bulkPrices.basePrice * nights;
        const utiaAdultsPrice = utiaAdults * bulkPrices.utiaAdult * nights;
        const utiaChildrenPrice = utiaChildren * bulkPrices.utiaChild * nights;
        const externalAdultsPrice = externalAdults * bulkPrices.externalAdult * nights;
        const externalChildrenPrice = externalChildren * bulkPrices.externalChild * nights;

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

        // Total - FIXED 2025-12-04: Always display recalculated price from current settings (SSOT)
        // The stored booking.totalPrice is historical, current price settings are authoritative
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; margin-top: 0.5rem;">
            <span style="color: white; font-weight: 600; font-size: 1.1rem;">Celková cena</span>
            <span style="color: white; font-weight: 700; font-size: 1.25rem;">${totalPrice.toLocaleString('cs-CZ')} Kč</span>
          </div>`;

        html += `
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
            if (bulkActionsContainer) bulkActionsContainer.style.display = 'flex';
            if (selectedCountElement)
                selectedCountElement.textContent = `${count} vybran${count === 1 ? 'á' : count <= 4 ? 'é' : 'ých'}`;

            // Update "select all" checkbox state
            const totalCheckboxes = document.querySelectorAll('.booking-checkbox').length;
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = count === totalCheckboxes;
                selectAllCheckbox.indeterminate = count > 0 && count < totalCheckboxes;
            }
        } else {
            if (bulkActionsContainer) bulkActionsContainer.style.display = 'none';
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            }
        }
    }

    async bulkDeleteBookings() {
        const count = this.selectedBookings.size;
        if (count === 0) {
            return;
        }

        this.adminPanel.showConfirm(
            `Opravdu chcete smazat ${count} vybran${count === 1 ? 'ou rezervaci' : count <= 4 ? 'é rezervace' : 'ých rezervací'}?`,
            async () => {
                // FIX: Validate session before admin operation
                if (!(await this.adminPanel.validateSession())) {
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
                            } else {
                                errorCount += 1;
                            }
                        } catch (error) {
                            errorCount += 1;
                            console.error(`Chyba při mazání rezervace ${bookingId}:`, error);
                        }
                    }

                    // Sync with server to get updated data (force refresh)
                    try {
                        await dataManager.syncWithServer(true);
                    } catch (error) {
                        console.error('[Admin] Server sync failed after bulk delete:', error);
                    }

                    // Reload bookings table (this will update the UI)
                    try {
                        await this.loadBookings();
                    } catch (error) {
                        console.error('[Admin] Failed to reload bookings table:', error);
                    }

                    // Refresh main calendar if it exists (in case user has index.html open in another tab)
                    try {
                        if (window.app && typeof window.app.renderCalendar === 'function') {
                            await window.app.renderCalendar();
                        }
                    } catch (error) {
                        console.warn('[Admin] Calendar refresh failed (non-critical):', error);
                    }

                    if (errorCount === 0) {
                        this.adminPanel.showSuccessMessage(`Úspěšně smazáno ${successCount} rezervací`);
                    } else {
                        this.adminPanel.showToast(
                            `Smazáno ${successCount} rezervací, ${errorCount} se nepodařilo smazat`,
                            'warning'
                        );
                    }
                } catch (error) {
                    console.error('Chyba při hromadném mazání:', error);
                    this.adminPanel.showToast('Chyba při hromadném mazání rezervací', 'error');
                } finally {
                    // Restore button state
                    if (deleteBtn) {
                        deleteBtn.disabled = false;
                        deleteBtn.style.opacity = '1';
                        deleteBtn.style.cursor = 'pointer';
                        if (originalHTML) deleteBtn.innerHTML = originalHTML;
                    }
                }
            }
        );
    }

    /**
     * Print selected bookings
     * Opens a print-friendly view of selected bookings
     */
    async bulkPrintBookings() {
        const count = this.selectedBookings.size;
        if (count === 0) {
            this.adminPanel.showToast('Vyberte alespoň jednu rezervaci k tisku', 'warning');
            return;
        }

        try {
            const settings = await dataManager.getSettings();
            const bookingsToPrint = [];

            for (const bookingId of this.selectedBookings) {
                const booking = await dataManager.getBooking(bookingId);
                if (booking) {
                    bookingsToPrint.push(booking);
                }
            }

            if (bookingsToPrint.length === 0) {
                this.adminPanel.showToast('Nepodařilo se načíst vybrané rezervace', 'error');
                return;
            }

            // Sort by start date
            bookingsToPrint.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

            // Create print window
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                this.adminPanel.showToast('Nelze otevřít tiskové okno - povolte vyskakovací okna', 'error');
                return;
            }

            // Generate print content
            let printContent = `
                <!DOCTYPE html>
                <html lang="cs">
                <head>
                    <meta charset="UTF-8">
                    <title>Tisk rezervací - Chata Mariánská</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
                        h1 { font-size: 18px; margin-bottom: 10px; }
                        .booking { border: 1px solid #ccc; padding: 15px; margin-bottom: 15px; page-break-inside: avoid; }
                        .booking-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
                        .booking-id { font-weight: bold; font-size: 14px; }
                        .booking-dates { color: #666; }
                        .booking-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                        .booking-field { margin-bottom: 5px; }
                        .field-label { font-weight: bold; color: #555; }
                        .rooms { display: flex; gap: 5px; flex-wrap: wrap; }
                        .room-badge { background: #28a745; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; }
                        .paid { color: #10b981; font-weight: bold; }
                        .unpaid { color: #ef4444; font-weight: bold; }
                        .print-date { text-align: right; font-size: 10px; color: #999; margin-bottom: 20px; }
                        @media print {
                            .booking { page-break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Rezervace - Chata Mariánská</h1>
                    <div class="print-date">Vytištěno: ${new Date().toLocaleString('cs-CZ')}</div>
            `;

            for (const booking of bookingsToPrint) {
                const price = this.getBookingPrice(booking, settings);
                const startDate = new Date(booking.startDate).toLocaleDateString('cs-CZ');
                const endDate = new Date(booking.endDate).toLocaleDateString('cs-CZ');

                printContent += `
                    <div class="booking">
                        <div class="booking-header">
                            <span class="booking-id">${this.escapeHtml(booking.id)}</span>
                            <span class="booking-dates">${startDate} - ${endDate}</span>
                        </div>
                        <div class="booking-grid">
                            <div class="booking-field">
                                <span class="field-label">Jméno:</span> ${this.escapeHtml(booking.name)}
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Email:</span> ${this.escapeHtml(booking.email)}
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Telefon:</span> ${this.escapeHtml(booking.phone)}
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Hosté:</span> ${booking.adults} dosp., ${booking.children} dětí, ${booking.toddlers || 0} bat.
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Pokoje:</span>
                                <span class="rooms">${booking.rooms.map(r => `<span class="room-badge">P${r}</span>`).join('')}</span>
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Cena:</span> ${price.toLocaleString('cs-CZ')} Kč
                            </div>
                            <div class="booking-field">
                                <span class="field-label">Zaplaceno:</span>
                                <span class="${booking.paid ? 'paid' : 'unpaid'}">${booking.paid ? 'Ano' : 'Ne'}</span>
                            </div>
                            ${booking.notes ? `
                            <div class="booking-field" style="grid-column: 1 / -1;">
                                <span class="field-label">Poznámky:</span> ${this.escapeHtml(booking.notes)}
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }

            printContent += `
                </body>
                </html>
            `;

            printWindow.document.write(printContent);
            printWindow.document.close();

            // Wait for content to load, then print
            printWindow.onload = () => {
                printWindow.print();
            };

            this.adminPanel.showSuccessMessage(`Připraveno k tisku: ${bookingsToPrint.length} rezervací`);
        } catch (error) {
            console.error('Chyba při přípravě tisku:', error);
            this.adminPanel.showToast('Chyba při přípravě tisku', 'error');
        }
    }

    async togglePaidStatus(bookingId, paid) {
        // Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            const booking = await dataManager.getBooking(bookingId);
            if (!booking) {
                this.adminPanel.showToast('Rezervace nenalezena', 'error');
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

            this.adminPanel.showSuccessMessage(
                `Rezervace ${bookingId} byla označena jako ${paid ? 'zaplacená' : 'nezaplacená'}`
            );
        } catch (error) {
            console.error('Chyba při změně stavu platby:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
            // Revert checkbox state
            await this.loadBookings();
        }
    }
}

