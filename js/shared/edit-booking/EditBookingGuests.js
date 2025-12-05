/**
 * EditBookingGuests Module
 * Handles guest name collection and validation for the booking edit flow.
 */
class EditBookingGuests {
    constructor() {
        // No specific config needed for now
    }

    /**
     * Hide legacy guest names section
     * Guest names are now collected from per-room inputs in "Termín a pokoje" tab
     */
    hideLegacyGuestSection() {
        const guestNamesSection = document.getElementById('editGuestNamesSection');
        const childrenContainer = document.getElementById('editChildrenNamesContainer');
        const toddlersContainer = document.getElementById('editToddlersNamesContainer');

        if (guestNamesSection) guestNamesSection.style.display = 'none';
        if (childrenContainer) childrenContainer.style.display = 'none';
        if (toddlersContainer) toddlersContainer.style.display = 'none';
    }

    /**
     * Collect guest names from the generated form inputs
     * Supports both per-room inputs (room12AdultFirstName1) and bulk inputs (bulkAdultFirstName1)
     * @returns {Array<Object>} Array of guest name objects
     */
    collectGuestNames() {
        const guestNames = [];

        // Collect adult names
        this._collectGuestType('adult', guestNames);

        // Collect children names
        this._collectGuestType('child', guestNames);

        // Collect toddler names
        this._collectToddlers(guestNames);

        return guestNames;
    }

    /**
     * Helper to collect guests of a specific type
     * @param {string} type - 'adult' or 'child'
     * @param {Array} guestNames - Array to push results to
     */
    _collectGuestType(type, guestNames) {
        // Capitalize first letter for ID construction
        const typeCap = type.charAt(0).toUpperCase() + type.slice(1);

        const firstNames = document.querySelectorAll(`input[data-guest-type="${type}"][id*="${typeCap}FirstName"]`);
        const lastNames = document.querySelectorAll(`input[data-guest-type="${type}"][id*="${typeCap}LastName"]`);

        for (let i = 0; i < firstNames.length; i++) {
            const firstName = firstNames[i].value.trim();
            const lastName = lastNames[i].value.trim();

            if (firstName && lastName) {
                const inputId = firstNames[i].id;
                const isBulk = firstNames[i].dataset.bulk === 'true';
                let guestPriceType = 'utia'; // Default

                if (isBulk) {
                    // Bulk input format: bulkAdultFirstName1
                    const guestIndexMatch = inputId.match(new RegExp(`bulk${typeCap}FirstName(\\d+)`));
                    if (guestIndexMatch) {
                        const guestIndex = guestIndexMatch[1];
                        const toggleInput = document.getElementById(`bulk${typeCap}${guestIndex}GuestTypeToggle`);
                        if (toggleInput && toggleInput.checked) guestPriceType = 'external';
                    }
                } else {
                    // Per-room input format: room12AdultFirstName1
                    const roomIdMatch = inputId.match(/room(\d+)/);
                    const guestIndexMatch = inputId.match(new RegExp(`${typeCap}FirstName(\\d+)`));

                    if (roomIdMatch && guestIndexMatch) {
                        const roomId = roomIdMatch[1];
                        const guestIndex = guestIndexMatch[1];
                        const toggleInput = document.getElementById(`room${roomId}${typeCap}${guestIndex}GuestTypeToggle`);
                        if (toggleInput && toggleInput.checked) guestPriceType = 'external';
                    }
                }

                guestNames.push({
                    personType: type,
                    firstName,
                    lastName,
                    guestPriceType,
                });
            }
        }
    }

    /**
     * Helper to collect toddlers (always free, no price type toggle)
     * @param {Array} guestNames 
     */
    _collectToddlers(guestNames) {
        const firstNames = document.querySelectorAll('input[data-guest-type="toddler"][id*="ToddlerFirstName"]');
        const lastNames = document.querySelectorAll('input[data-guest-type="toddler"][id*="ToddlerLastName"]');

        for (let i = 0; i < firstNames.length; i++) {
            const firstName = firstNames[i].value.trim();
            const lastName = lastNames[i].value.trim();
            if (firstName && lastName) {
                guestNames.push({
                    personType: 'toddler',
                    firstName,
                    lastName,
                    guestPriceType: 'utia',
                });
            }
        }
    }

    /**
     * Validate guest names input fields
     * @param {number} expectedAdults - Expected number of adults
     * @param {number} expectedChildren - Expected number of children
     * @param {number} expectedToddlers - Expected number of toddlers
     * @returns {Object} Validation result with valid flag and error message
     */
    validateGuestNames(expectedAdults, expectedChildren, expectedToddlers = 0) {
        const guestNames = this.collectGuestNames();
        const adultNames = guestNames.filter((g) => g.personType === 'adult');
        const childNames = guestNames.filter((g) => g.personType === 'child');
        const toddlerNames = guestNames.filter((g) => g.personType === 'toddler');

        // Check counts
        if (adultNames.length !== expectedAdults) {
            return {
                valid: false,
                error: `Vyplňte jména všech ${expectedAdults} dospělých v záložce "Termín a pokoje" (v kartách jednotlivých pokojů)`,
            };
        }

        if (childNames.length !== expectedChildren) {
            return {
                valid: false,
                error: `Vyplňte jména všech ${expectedChildren} dětí v záložce "Termín a pokoje" (v kartách jednotlivých pokojů)`,
            };
        }

        if (toddlerNames.length !== expectedToddlers) {
            return {
                valid: false,
                error: `Vyplňte jména všech ${expectedToddlers} batolat v záložce "Termín a pokoje" (v kartách jednotlivých pokojů)`,
            };
        }

        // Check each name for minimum length
        for (const guest of guestNames) {
            if (guest.firstName.length < 2) {
                return {
                    valid: false,
                    error: 'Všechna křestní jména musí mít alespoň 2 znaky (zkontrolujte záložku "Termín a pokoje")',
                };
            }
            if (guest.lastName.length < 2) {
                return {
                    valid: false,
                    error: 'Všechna příjmení musí mít alespoň 2 znaky (zkontrolujte záložku "Termín a pokoje")',
                };
            }
        }

        return { valid: true, guestNames };
    }
}

// Export for use in other files
window.EditBookingGuests = EditBookingGuests;
