/**
 * BookingDisplayUtils - Shared utility for displaying per-room booking details
 *
 * SSOT Component - Created 2025-10-13
 *
 * Purpose:
 * - Centralized formatting of per-room booking information
 * - Supports both per-room and legacy global booking data
 * - Provides HTML generation for consistent UI across application
 * - Bilingual support (Czech/English)
 *
 * Usage locations:
 * - js/utils.js - Main calendar popup
 * - admin.js - Admin detail modal
 * - js/shared/emailService.js - Email templates (future)
 *
 * Dependencies:
 * - DateUtils (js/shared/dateUtils.js)
 */

class BookingDisplayUtils {
  /**
   * Format per-room booking details for display
   *
   * Automatically detects per-room data vs legacy global data
   * Falls back gracefully for old bookings without perRoomDates/perRoomGuests
   *
   * For bulk bookings (all 9 rooms), displays maximum room capacity instead of distributed guests
   *
   * @param {Object} booking - Booking object from database
   * @param {string} language - 'cs' or 'en'
   * @param {Array<Object>} roomsConfig - Optional room configuration with beds count
   * @returns {Array<Object>} Array of room detail objects
   *
   * Example return:
   * [
   *   {
   *     roomId: "12",
   *     startDate: "Po 15. říj",
   *     endDate: "St 17. říj",
   *     startDateRaw: "2025-10-15",
   *     endDateRaw: "2025-10-17",
   *     nights: 2,
   *     adults: 2,
   *     children: 1,
   *     toddlers: 0,
   *     guestType: "utia"
   *   },
   *   ...
   * ]
   */
  static formatPerRoomDetails(booking, language = 'cs', roomsConfig = null) {
    const roomDetails = [];

    // Detect bulk booking: all 9 rooms OR isBulkBooking flag
    const isBulkBooking = booking.isBulkBooking || booking.rooms.length === 9;

    // Get room configuration from window if not provided
    const rooms = roomsConfig || (typeof window !== 'undefined' && window.roomsConfig);

    booking.rooms.forEach((roomId) => {
      // Check for per-room dates (new format)
      const roomDates = booking.perRoomDates?.[roomId];
      const startDateRaw = roomDates?.startDate || booking.startDate;
      const endDateRaw = roomDates?.endDate || booking.endDate;

      // Check for per-room guests (new format)
      const roomGuests = booking.perRoomGuests?.[roomId];

      // For bulk bookings, show maximum capacity per room
      let adults;
      let children;
      let toddlers;
      let guestType;

      if (isBulkBooking && rooms) {
        // BULK BOOKING: Show maximum room capacity (beds count)
        const room = rooms.find((r) => r.id === roomId);
        if (room) {
          adults = room.beds || 2; // Use bed count as adult capacity
          children = 0;
          toddlers = 0;
          // eslint-disable-next-line prefer-destructuring
          guestType = booking.guestType;
        } else {
          // Fallback if room not found
          adults = 2;
          children = 0;
          toddlers = 0;
          // eslint-disable-next-line prefer-destructuring
          guestType = booking.guestType;
        }
      } else if (roomGuests) {
        // INDIVIDUAL BOOKING: Per-room data available
        adults = roomGuests.adults || 0;
        children = roomGuests.children || 0;
        toddlers = roomGuests.toddlers || 0;
        guestType = roomGuests.guestType || booking.guestType;
      } else {
        // Legacy booking - distribute totals evenly across rooms
        const roomCount = booking.rooms.length;
        adults = Math.ceil((booking.adults || 0) / roomCount);
        children = Math.ceil((booking.children || 0) / roomCount);
        toddlers = Math.ceil((booking.toddlers || 0) / roomCount);
        // eslint-disable-next-line prefer-destructuring
        guestType = booking.guestType;
      }

      // Calculate nights
      const nights = DateUtils.getDaysBetween(startDateRaw, endDateRaw);

      // Format dates for display
      const startDate = DateUtils.formatDateDisplay(new Date(startDateRaw), language);
      const endDate = DateUtils.formatDateDisplay(new Date(endDateRaw), language);

      roomDetails.push({
        roomId,
        startDate,
        endDate,
        startDateRaw,
        endDateRaw,
        nights,
        adults,
        children,
        toddlers,
        guestType,
      });
    });

    return roomDetails;
  }

  /**
   * Format guest counts for display with proper Czech/English pluralization
   *
   * @param {number} adults - Number of adults
   * @param {number} children - Number of children (3-18 years)
   * @param {number} toddlers - Number of toddlers (0-3 years)
   * @param {string} language - 'cs' or 'en'
   * @returns {string} Formatted guest count string
   *
   * Examples:
   * - formatGuestCounts(2, 1, 0, 'cs') => "2 dospělí, 1 dítě"
   * - formatGuestCounts(2, 1, 0, 'en') => "2 adults, 1 child"
   */
  static formatGuestCounts(adults, children, toddlers, language = 'cs') {
    const parts = [];

    if (language === 'cs') {
      // Czech pluralization rules
      if (adults > 0) {
        let adultWord = 'dospělých';
        if (adults === 1) {
          adultWord = 'dospělý';
        } else if (adults >= 2 && adults <= 4) {
          adultWord = 'dospělí';
        }
        parts.push(`${adults} ${adultWord}`);
      }
      if (children > 0) {
        let childWord = 'dětí';
        if (children === 1) {
          childWord = 'dítě';
        } else if (children >= 2 && children <= 4) {
          childWord = 'děti';
        }
        parts.push(`${children} ${childWord}`);
      }
      if (toddlers > 0) {
        let toddlerWord = 'batolat';
        if (toddlers === 1) {
          toddlerWord = 'batole';
        } else if (toddlers >= 2 && toddlers <= 4) {
          toddlerWord = 'batolata';
        }
        parts.push(`${toddlers} ${toddlerWord}`);
      }
    } else {
      // English pluralization
      if (adults > 0) {
        parts.push(`${adults} ${adults === 1 ? 'adult' : 'adults'}`);
      }
      if (children > 0) {
        parts.push(`${children} ${children === 1 ? 'child' : 'children'}`);
      }
      if (toddlers > 0) {
        parts.push(`${toddlers} ${toddlers === 1 ? 'toddler' : 'toddlers'}`);
      }
    }

    return parts.join(', ') || (language === 'cs' ? 'Žádní hosté' : 'No guests');
  }

  /**
   * Format guest type label
   *
   * @param {string} guestType - 'utia' or 'external'
   * @param {string} language - 'cs' or 'en'
   * @returns {string} Formatted guest type label
   */
  static formatGuestType(guestType, language = 'cs') {
    if (guestType === 'utia') {
      return language === 'cs' ? 'ÚTIA' : 'ÚTIA Employee';
    }
    return language === 'cs' ? 'Externí' : 'External';
  }

  /**
   * Generate HTML for per-room detail display
   *
   * Automatically detects if all rooms have same dates and shows compact/expanded view
   *
   * Compact view: All rooms same dates → Single date range + room list
   * Expanded view: Different dates → Per-room cards with individual details
   *
   * @param {Object} booking - Booking object
   * @param {string} language - 'cs' or 'en'
   * @param {Array<Object>} roomsConfig - Optional room configuration with beds count
   * @returns {string} HTML string for detail section
   */
  static renderPerRoomDetailsHTML(booking, language = 'cs', roomsConfig = null) {
    const roomDetails = this.formatPerRoomDetails(booking, language, roomsConfig);

    if (roomDetails.length === 0) {
      return '';
    }

    // Check if all rooms have identical dates
    const allSameDates = roomDetails.every(
      (rd) =>
        rd.startDateRaw === roomDetails[0].startDateRaw &&
        rd.endDateRaw === roomDetails[0].endDateRaw
    );

    // COMPACT VIEW: All rooms have same dates
    if (allSameDates && roomDetails.length > 1) {
      const rd = roomDetails[0];
      const nightsLabel = language === 'cs' ? 'nocí' : 'nights';

      return `
        <div class="detail-row">
          <strong>${language === 'cs' ? 'Termín:' : 'Dates:'}</strong>
          <span>${rd.startDate} - ${rd.endDate} (${rd.nights} ${nightsLabel})</span>
        </div>
        <div class="detail-row">
          <strong>${language === 'cs' ? 'Pokoje:' : 'Rooms:'}</strong>
          <span>${booking.rooms.join(', ')}</span>
        </div>
        <div class="detail-row">
          <strong>${language === 'cs' ? 'Hosté:' : 'Guests:'}</strong>
          <div style="margin-top: 0.5rem;">
            ${roomDetails
              .map(
                (roomDetail) => `
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span class="room-badge" style="
                  background: var(--primary-600, #2563eb);
                  color: white;
                  padding: 0.25rem 0.5rem;
                  border-radius: 4px;
                  font-weight: 600;
                  font-size: 0.875rem;
                ">${roomDetail.roomId}</span>
                <span style="color: var(--gray-700, #374151); font-size: 0.9rem;">
                  ${this.formatGuestCounts(roomDetail.adults, roomDetail.children, roomDetail.toddlers, language)}
                  <span style="color: var(--gray-400, #9ca3af); margin: 0 0.5rem;">•</span>
                  ${this.formatGuestType(roomDetail.guestType, language)}
                </span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    // EXPANDED VIEW: Different dates per room OR single room booking
    // Determine header text based on language and room count
    let headerText = 'Room details:';
    if (language === 'cs') {
      headerText =
        roomDetails.length > 1 ? 'Rozdílné termíny pro jednotlivé pokoje:' : 'Detail pokoje:';
    } else {
      headerText = roomDetails.length > 1 ? 'Different dates per room:' : 'Room details:';
    }

    const nightsLabel = language === 'cs' ? 'Nocí:' : 'Nights:';
    const datesLabel = language === 'cs' ? 'Termín:' : 'Dates:';
    const guestsLabel = language === 'cs' ? 'Hosté:' : 'Guests:';
    const roomLabel = language === 'cs' ? 'Pokoj' : 'Room';

    let html = `
      <div class="per-room-details" style="margin-top: 1rem;">
        <strong style="display: block; margin-bottom: 0.75rem; color: var(--primary-600, #2563eb);">
          ${headerText}
        </strong>
    `;

    roomDetails.forEach((rd) => {
      html += `
        <div class="room-detail-card" style="
          padding: 0.75rem;
          background: var(--gray-50, #f9fafb);
          border-left: 4px solid var(--primary-500, #3b82f6);
          border-radius: 8px;
          margin-bottom: 0.75rem;
        ">
          <div style="font-weight: 600; color: var(--gray-900, #111827); margin-bottom: 0.5rem;">
            ${roomLabel} ${rd.roomId}
          </div>
          <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem; font-size: 0.9rem;">
            <span style="color: var(--gray-600, #4b5563);">${datesLabel}</span>
            <span style="color: var(--gray-800, #1f2937);">${rd.startDate} - ${rd.endDate}</span>

            <span style="color: var(--gray-600, #4b5563);">${nightsLabel}</span>
            <span style="color: var(--gray-800, #1f2937);">${rd.nights}</span>

            <span style="color: var(--gray-600, #4b5563);">${guestsLabel}</span>
            <span style="color: var(--gray-800, #1f2937);">
              ${this.formatGuestCounts(rd.adults, rd.children, rd.toddlers, language)}
              <span style="color: var(--gray-400, #9ca3af); margin: 0 0.5rem;">•</span>
              ${this.formatGuestType(rd.guestType, language)}
            </span>
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  /**
   * Generate compact per-room summary for tooltips/badges
   *
   * @param {Object} booking - Booking object
   * @param {string} language - 'cs' or 'en'
   * @returns {string} Compact summary text
   *
   * Example: "Pokoj 12: 2 dosp., 1 dítě (15.10 - 17.10)"
   */
  static renderCompactSummary(booking, language = 'cs') {
    const roomDetails = this.formatPerRoomDetails(booking, language);

    return roomDetails
      .map((rd) => {
        const roomLabel = language === 'cs' ? 'Pokoj' : 'Room';
        const guestShort = this.formatGuestCountsShort(
          rd.adults,
          rd.children,
          rd.toddlers,
          language
        );
        return `${roomLabel} ${rd.roomId}: ${guestShort} (${rd.startDate} - ${rd.endDate})`;
      })
      .join('\n');
  }

  /**
   * Format guest counts in short form for compact display
   *
   * @param {number} adults
   * @param {number} children
   * @param {number} toddlers
   * @param {string} language
   * @returns {string} Short format like "2 dosp., 1 děti"
   */
  static formatGuestCountsShort(adults, children, toddlers, language = 'cs') {
    const parts = [];

    if (language === 'cs') {
      if (adults > 0) {
        parts.push(`${adults} dosp.`);
      }
      if (children > 0) {
        parts.push(`${children} děti`);
      }
      if (toddlers > 0) {
        parts.push(`${toddlers} bat.`);
      }
    } else {
      if (adults > 0) {
        parts.push(`${adults} ad.`);
      }
      if (children > 0) {
        parts.push(`${children} ch.`);
      }
      if (toddlers > 0) {
        parts.push(`${toddlers} tod.`);
      }
    }

    return parts.join(', ') || (language === 'cs' ? '0 hostů' : '0 guests');
  }
}

// Export for Node.js (server-side email templates, etc.)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookingDisplayUtils;
}
