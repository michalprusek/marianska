/**
 * Admin Blocked Dates Module
 * Handles management of blocked dates.
 */
class AdminBlockedDates {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
    }

    setupEventListeners() {
        const form = document.getElementById('blockDateForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleBlockDate(e));
        }

        const blockAll = document.getElementById('blockAll');
        if (blockAll) {
            blockAll.addEventListener('change', (e) => this.toggleAllRooms(e.target));
        }
    }

    async loadBlockedDates() {
        const blockageInstances = await dataManager.getAllBlockageInstances();
        const container = document.getElementById('blockedDatesList');

        if (!container) {
            console.error('Container blockedDatesList not found!');
            return;
        }

        container.innerHTML = '';
        container.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 1rem;
            padding: 0.5rem 0;
        `;

        // Show blockages that haven't ended yet (end date >= 30 days ago)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const relevantBlockages = blockageInstances.filter((blockage) => {
            const endDate = new Date(blockage.endDate);
            return endDate >= thirtyDaysAgo;
        });

        // Sort blockages by start date (newest first)
        const sortedBlockages = relevantBlockages.sort(
            (a, b) => new Date(b.startDate) - new Date(a.startDate)
        );

        if (sortedBlockages.length === 0) {
            container.innerHTML =
                '<p style="text-align: center; color: var(--gray-500);">Žádné blokované termíny</p>';
            return;
        }

        // Display each blockage instance as a card
        sortedBlockages.forEach((blockage) => {
            const card = document.createElement('div');
            card.className = 'blocked-date-card';
            card.style.cssText = `
                padding: 1rem;
                background: white;
                border: 1px solid var(--gray-200);
                border-radius: var(--radius-md);
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                min-height: 150px;
            `;

            const startDate = new Date(blockage.startDate);
            const endDate = new Date(blockage.endDate);
            const isSingleDay = blockage.startDate === blockage.endDate;

            card.innerHTML = `
                <div style="flex: 1;">
                    <div style="color: var(--gray-400); font-size: 0.65rem; font-family: monospace; margin-bottom: 0.25rem; opacity: 0.7;">${blockage.blockageId}</div>
                    <div style="font-weight: 600; color: var(--gray-900); font-size: 0.95rem; margin-bottom: 0.5rem;">
                        ${isSingleDay
                    ? startDate.toLocaleDateString('cs-CZ')
                    : `${startDate.toLocaleDateString('cs-CZ')} - ${endDate.toLocaleDateString('cs-CZ')}`
                }
                    </div>
                    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.8rem; color: var(--gray-600);">Pokoje:</span>
                        ${blockage.rooms.length > 0
                    ? blockage.rooms
                        .map((roomId) =>
                            this.adminPanel.bookings.createRoomBadge(roomId, true)
                        )
                        .join('')
                    : '<span style="color: var(--gray-700); font-size: 0.85rem;">Všechny pokoje</span>'
                }
                    </div>
                    <div style="font-size: 0.8rem; color: var(--gray-600);">
                        <strong>Důvod:</strong> <em>${blockage.reason || 'Bez uvedení důvodu'}</em>
                    </div>
                </div>
                <div style="margin-top: auto; padding-top: 0.5rem;">
                    <button onclick="adminPanel.blockedDates.unblockRange('${blockage.blockageId}').catch(console.error)"
                            style="width: 100%; padding: 0.5rem; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.85rem; transition: background 0.2s;"
                            onmouseover="this.style.background='#b91c1c'"
                            onmouseout="this.style.background='#dc2626'">
                        Odblokovat
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    toggleAllRooms(checkbox) {
        const roomCheckboxes = document.querySelectorAll('.room-checkbox');
        roomCheckboxes.forEach((cb) => {
            const checkBox = cb;
            checkBox.checked = checkbox.checked;
        });
    }

    async handleBlockDate(e) {
        e.preventDefault();

        // FIX: Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        const startDate = document.getElementById('blockDateStart').value;
        const endDate = document.getElementById('blockDateEnd').value;
        const reason = document.getElementById('blockReason').value;

        // Get selected rooms
        const selectedRooms = [];
        const roomCheckboxes = document.querySelectorAll('.room-checkbox:checked');
        roomCheckboxes.forEach((cb) => {
            selectedRooms.push(cb.value);
        });

        // Validate dates
        if (new Date(endDate) < new Date(startDate)) {
            this.adminPanel.showErrorMessage('Konec období musí být po začátku');
            return;
        }

        // Create ONE blockage instance with date range and rooms
        try {
            await dataManager.createBlockageInstance(
                startDate,
                endDate,
                selectedRooms, // Empty array = all rooms
                reason
            );

            e.target.reset();
            document.getElementById('blockAll').checked = false;
            await this.loadBlockedDates();

            const start = new Date(startDate);
            const end = new Date(endDate);
            const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const roomsText =
                selectedRooms.length > 0 ? `pokoje ${selectedRooms.join(', ')}` : 'všechny pokoje';
            this.adminPanel.showSuccessMessage(`Vytvořena blokace: ${daysCount} dní pro ${roomsText}`);
        } catch (error) {
            console.error('Error creating blockage:', error);
            this.adminPanel.showErrorMessage(`Chyba při vytváření blokace: ${error.message}`);
        }
    }

    async unblockDate(date, roomId) {
        try {
            await dataManager.unblockDate(new Date(date), roomId || null);
            await this.loadBlockedDates();
            this.adminPanel.showSuccessMessage('Termín byl odblokován');
        } catch (error) {
            console.error('Chyba při odblokování termínu:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
        }
    }

    async unblockRange(blockageId) {
        try {
            await dataManager.deleteBlockageInstance(blockageId);
            await this.loadBlockedDates();
            this.adminPanel.showSuccessMessage('Blokace byla odstraněna');
        } catch (error) {
            console.error('Error unblocking range:', error);
            this.adminPanel.showErrorMessage(`Chyba při odblokování: ${error.message}`);
        }
    }
}
