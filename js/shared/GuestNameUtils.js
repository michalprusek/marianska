/**
 * Guest Name Utilities - Room-Based Organization
 *
 * Provides utilities for organizing guest names by room across the application.
 * Follows SSOT principles by centralizing all guest name organization logic.
 *
 * @module GuestNameUtils
 */

class GuestNameUtils {
  /**
   * Organize flat guest names array by room based on perRoomGuests data
   *
   * @param {Array} guestNames - Flat array of guest objects: [{personType, firstName, lastName, roomId?}]
   * @param {Object} perRoomGuests - Per-room guest counts: { '12': {adults: 1, children: 0, toddlers: 0}, '13': {...} }
   * @param {Array} rooms - Array of room IDs in order: ['12', '13', '14']
   * @returns {Object} - Organized by room: { '12': [{personType, firstName, lastName}], '13': [...] }
   *
   * @example
   * const guestNames = [
   *   {personType: 'adult', firstName: 'Jan', lastName: 'Novák'},
   *   {personType: 'adult', firstName: 'Petr', lastName: 'Svoboda'}
   * ];
   * const perRoomGuests = {
   *   '12': {adults: 1, children: 0, toddlers: 0},
   *   '13': {adults: 1, children: 0, toddlers: 0}
   * };
   * const organized = GuestNameUtils.organizeByRoom(guestNames, perRoomGuests, ['12', '13']);
   * // Result: { '12': [{...Jan}], '13': [{...Petr}] }
   */
  static organizeByRoom(guestNames, perRoomGuests, rooms) {
    if (!guestNames || !Array.isArray(guestNames)) {
      return {};
    }

    // If guest names already have roomId, use that directly
    const hasRoomIds = guestNames.some((g) => g.roomId);
    if (hasRoomIds) {
      return this._organizeByExistingRoomId(guestNames);
    }

    // Otherwise, distribute sequentially based on perRoomGuests
    if (!perRoomGuests || !rooms || rooms.length === 0) {
      // Fallback: return all names under first room or 'unknown'
      const roomId = rooms?.[0] || 'unknown';
      return { [roomId]: [...guestNames] };
    }

    return this._organizeByDistribution(guestNames, perRoomGuests, rooms);
  }

  /**
   * Organize guest names that already have roomId property
   *
   * @private
   * @param {Array} guestNames - Guest names with roomId
   * @returns {Object} - Organized by room
   */
  static _organizeByExistingRoomId(guestNames) {
    const organized = {};

    guestNames.forEach((guest) => {
      const roomId = guest.roomId || 'unknown';
      if (!organized[roomId]) {
        organized[roomId] = [];
      }
      // Remove roomId from the guest object copy to keep clean structure
      const { roomId: _, ...guestWithoutRoomId } = guest;
      organized[roomId].push(guestWithoutRoomId);
    });

    return organized;
  }

  /**
   * Distribute guest names sequentially based on per-room guest counts
   *
   * @private
   * @param {Array} guestNames - Flat array of guest names
   * @param {Object} perRoomGuests - Per-room guest counts
   * @param {Array} rooms - Array of room IDs
   * @returns {Object} - Organized by room
   */
  static _organizeByDistribution(guestNames, perRoomGuests, rooms) {
    const organized = {};
    let currentIndex = 0;

    // Process rooms in order
    rooms.forEach((roomId) => {
      const roomGuests = perRoomGuests[roomId];
      if (!roomGuests) {
        organized[roomId] = [];
        return;
      }

      // Calculate total guests for this room
      const roomGuestCount =
        (roomGuests.adults || 0) + (roomGuests.children || 0) + (roomGuests.toddlers || 0);

      // Extract the appropriate number of names
      organized[roomId] = guestNames.slice(currentIndex, currentIndex + roomGuestCount);
      currentIndex += roomGuestCount;
    });

    return organized;
  }

  /**
   * Flatten room-organized guest names back to a flat array with roomId attached
   *
   * @param {Object} perRoomGuestNames - Guest names organized by room: { '12': [{...}], '13': [{...}] }
   * @returns {Array} - Flat array with roomId: [{personType, firstName, lastName, roomId}]
   *
   * @example
   * const perRoomGuestNames = {
   *   '12': [{personType: 'adult', firstName: 'Jan', lastName: 'Novák'}],
   *   '13': [{personType: 'adult', firstName: 'Petr', lastName: 'Svoboda'}]
   * };
   * const flattened = GuestNameUtils.flattenFromRooms(perRoomGuestNames);
   * // Result: [
   * //   {personType: 'adult', firstName: 'Jan', lastName: 'Novák', roomId: '12'},
   * //   {personType: 'adult', firstName: 'Petr', lastName: 'Svoboda', roomId: '13'}
   * // ]
   */
  static flattenFromRooms(perRoomGuestNames) {
    if (!perRoomGuestNames || typeof perRoomGuestNames !== 'object') {
      return [];
    }

    const flattened = [];

    // Iterate rooms in numerical order for consistency
    const sortedRoomIds = Object.keys(perRoomGuestNames).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA - numB;
    });

    sortedRoomIds.forEach((roomId) => {
      const guests = perRoomGuestNames[roomId];
      if (Array.isArray(guests)) {
        guests.forEach((guest) => {
          flattened.push({ ...guest, roomId });
        });
      }
    });

    return flattened;
  }

  /**
   * Format guest names for display grouped by room
   *
   * @param {Object} perRoomGuestNames - Guest names organized by room
   * @param {string} separator - Separator between names (default: ', ')
   * @param {boolean} includeRoomLabel - Include "Pokoj X:" label (default: true)
   * @returns {string} - Formatted string
   *
   * @example
   * const perRoomGuestNames = {
   *   '12': [{firstName: 'Jan', lastName: 'Novák'}],
   *   '13': [{firstName: 'Petr', lastName: 'Svoboda'}, {firstName: 'Marie', lastName: 'Svobodová'}]
   * };
   * const formatted = GuestNameUtils.formatForDisplay(perRoomGuestNames);
   * // Result: "Pokoj 12: Jan Novák\nPokoj 13: Petr Svoboda, Marie Svobodová"
   */
  static formatForDisplay(perRoomGuestNames, separator = ', ', includeRoomLabel = true) {
    if (!perRoomGuestNames || typeof perRoomGuestNames !== 'object') {
      return '';
    }

    const lines = [];

    // Sort room IDs numerically
    const sortedRoomIds = Object.keys(perRoomGuestNames).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA - numB;
    });

    sortedRoomIds.forEach((roomId) => {
      const guests = perRoomGuestNames[roomId];
      if (!Array.isArray(guests) || guests.length === 0) {
        return;
      }

      const guestNamesStr = guests
        .map((guest) => `${guest.firstName} ${guest.lastName}`)
        .join(separator);

      if (includeRoomLabel) {
        lines.push(`Pokoj ${roomId}: ${guestNamesStr}`);
      } else {
        lines.push(guestNamesStr);
      }
    });

    return lines.join('\n');
  }

  /**
   * Generate HTML display for guest names grouped by room
   *
   * @param {Object} perRoomGuestNames - Guest names organized by room
   * @param {Object} options - Display options
   * @param {boolean} options.showPersonType - Show person type badges (default: false)
   * @param {string} options.layout - 'list' or 'grid' (default: 'list')
   * @returns {string} - HTML string
   *
   * @example
   * const html = GuestNameUtils.renderHTML(perRoomGuestNames, {showPersonType: true, layout: 'list'});
   */
  static renderHTML(perRoomGuestNames, options = {}) {
    const { showPersonType = false, layout = 'list' } = options;

    if (!perRoomGuestNames || typeof perRoomGuestNames !== 'object') {
      return '<p>Žádná jména hostů</p>';
    }

    const sortedRoomIds = Object.keys(perRoomGuestNames).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA - numB;
    });

    if (sortedRoomIds.length === 0) {
      return '<p>Žádná jména hostů</p>';
    }

    let html = '';

    if (layout === 'grid') {
      html += '<div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem;">';
    }

    sortedRoomIds.forEach((roomId) => {
      const guests = perRoomGuestNames[roomId];
      if (!Array.isArray(guests) || guests.length === 0) {
        return;
      }

      // Room badge
      const roomBadge = `<span style="display: inline-block; padding: 0.3rem 0.6rem; background: #28a745; color: white; border-radius: 4px; font-weight: 600; font-size: 0.9rem;">P${roomId}</span>`;

      // Guest names list
      const guestsList = guests
        .map((guest) => {
          let name = `${guest.firstName} ${guest.lastName}`;

          if (showPersonType) {
            const badge = this._getPersonTypeBadge(guest.personType);
            name = `${badge} ${name}`;
          }

          return name;
        })
        .join(', ');

      if (layout === 'grid') {
        html += `<div>${roomBadge}</div><div>${guestsList}</div>`;
      } else {
        html += `<div style="margin-bottom: 0.5rem;"><strong>${roomBadge}</strong> ${guestsList}</div>`;
      }
    });

    if (layout === 'grid') {
      html += '</div>';
    }

    return html;
  }

  /**
   * Get person type badge HTML
   *
   * @private
   * @param {string} personType - 'adult', 'child', or 'toddler'
   * @returns {string} - Badge HTML
   */
  static _getPersonTypeBadge(personType) {
    const badges = {
      adult: '<span style="background: #007bff; color: white; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.75rem;">Dosp.</span>',
      child: '<span style="background: #ffc107; color: black; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.75rem;">Dítě</span>',
      toddler:
        '<span style="background: #fd7e14; color: white; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.75rem;">Bat.</span>',
    };

    return badges[personType] || '';
  }

  /**
   * Validate guest names structure and counts
   *
   * @param {Array} guestNames - Guest names array
   * @param {Object} perRoomGuests - Per-room guest counts
   * @returns {Object} - {valid: boolean, errors: string[]}
   *
   * @example
   * const validation = GuestNameUtils.validate(guestNames, perRoomGuests);
   * if (!validation.valid) {
   *   console.error('Validation errors:', validation.errors);
   * }
   */
  static validate(guestNames, perRoomGuests) {
    const errors = [];

    if (!guestNames || !Array.isArray(guestNames)) {
      errors.push('Guest names must be an array');
      return { valid: false, errors };
    }

    if (!perRoomGuests || typeof perRoomGuests !== 'object') {
      errors.push('Per-room guests data is missing');
      return { valid: false, errors };
    }

    // Calculate expected total
    let expectedTotal = 0;
    Object.values(perRoomGuests).forEach((roomGuests) => {
      expectedTotal +=
        (roomGuests.adults || 0) + (roomGuests.children || 0) + (roomGuests.toddlers || 0);
    });

    // Check if counts match
    if (guestNames.length !== expectedTotal) {
      errors.push(
        `Guest name count mismatch: expected ${expectedTotal}, got ${guestNames.length}`
      );
    }

    // Validate each guest name
    guestNames.forEach((guest, index) => {
      if (!guest.firstName || !guest.lastName) {
        errors.push(`Guest ${index + 1} missing firstName or lastName`);
      }

      if (!guest.personType || !['adult', 'child', 'toddler'].includes(guest.personType)) {
        errors.push(`Guest ${index + 1} has invalid personType: ${guest.personType}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GuestNameUtils;
}
