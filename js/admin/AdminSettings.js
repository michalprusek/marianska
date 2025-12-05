/**
 * Admin Settings Module
 * Handles loading and saving application settings (prices, emails, rooms, etc.).
 */
class AdminSettings {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.currentRooms = null; // Store current room data for preserving type field
    }

    setupEventListeners() {
        const forms = {
            'emailTemplateForm': this.handleEmailTemplate,
            'contactEmailForm': this.handleContactEmail,
            'addAdminEmailForm': this.handleAddAdminEmail,
            'addCabinManagerEmailForm': this.handleAddCabinManagerEmail,
            'addCodeForm': this.handleAddCode,
            'christmasPeriodForm': this.handleChristmasPeriod,
            'roomConfigForm': this.handleRoomConfig,
            'priceConfigForm': this.handlePriceConfig,
            'bulkPriceConfigForm': this.handleBulkPriceConfig,
            'changePasswordForm': this.handleChangePassword
        };

        Object.entries(forms).forEach(([id, handler]) => {
            const form = document.getElementById(id);
            if (form) {
                form.addEventListener('submit', (e) => handler.call(this, e));
            }
        });
    }

    async loadEmailTemplate() {
        const settings = await dataManager.getSettings();
        const emailSettings = settings.emailTemplate || {};

        // Load email template settings
        document.getElementById('emailSubject').value =
            emailSettings.subject || 'Potvrzení rezervace - Chata Mariánská';
        document.getElementById('emailTemplate').value =
            emailSettings.template || document.getElementById('emailTemplate').value;

        // Load contact email setting
        const contactEmailInput = document.getElementById('contactEmail');
        if (contactEmailInput) {
            contactEmailInput.value = settings.contactEmail || 'chata@utia.cas.cz';
        }

        // Load admin emails
        this.loadAdminEmails(settings.adminEmails || []);

        // Load cabin manager emails
        this.loadCabinManagerEmails(settings.cabinManagerEmails || []);

        // Initialize character counter
        this.updateEmailTemplateCharCount();

        // Add input listener for real-time character count
        const templateTextarea = document.getElementById('emailTemplate');
        templateTextarea.addEventListener('input', () => this.updateEmailTemplateCharCount());
    }

    loadAdminEmails(adminEmails) {
        const listContainer = document.getElementById('adminEmailsList');
        if (!listContainer) {
            return;
        }

        if (adminEmails.length === 0) {
            listContainer.innerHTML = `
        <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md); color: var(--gray-600);">
          Zatím nejsou přidáni žádní správci. Přidejte emailovou adresu správce níže.
        </div>
      `;
            return;
        }

        listContainer.innerHTML = adminEmails
            .map(
                (email) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--gray-50); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: var(--primary-color);">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span style="font-weight: 500;">${this.adminPanel.bookings.escapeHtml(email)}</span>
        </div>
        <button
          class="btn btn-sm remove-admin-btn"
          data-email="${this.adminPanel.bookings.escapeHtml(email)}"
          style="padding: 0.5rem 1rem; background: #dc2626; color: white; border: none;"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="display: inline; margin-right: 0.25rem;">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          Odebrat
        </button>
      </div>
    `
            )
            .join('');

        // Add event listeners to remove buttons (safer than onclick)
        listContainer.querySelectorAll('.remove-admin-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const email = e.currentTarget.getAttribute('data-email');
                this.removeAdminEmail(email);
            });
        });
    }

    async handleAddAdminEmail(e) {
        e.preventDefault();

        // Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            const emailInput = document.getElementById('newAdminEmail');
            const newEmail = emailInput.value.trim();

            // Validate email format
            if (!ValidationUtils.validateEmail(newEmail)) {
                this.adminPanel.showToast('Neplatný formát emailové adresy', 'error');
                return;
            }

            const settings = await dataManager.getSettings();
            const adminEmails = settings.adminEmails || [];

            // Check if email already exists
            if (adminEmails.includes(newEmail)) {
                this.adminPanel.showToast('Tento email je již v seznamu správců', 'warning');
                return;
            }

            // Add new email
            adminEmails.push(newEmail);
            settings.adminEmails = adminEmails;

            await dataManager.updateSettings(settings);

            // Reload admin emails list
            this.loadAdminEmails(adminEmails);

            // Clear input
            emailInput.value = '';

            this.adminPanel.showSuccessMessage(`Správce ${newEmail} byl úspěšně přidán`);
        } catch (error) {
            console.error('Chyba při přidávání správce:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
        }
    }

    async removeAdminEmail(email) {
        // Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        if (!confirm(`Opravdu chcete odebrat správce ${email}?`)) {
            return;
        }

        try {
            const settings = await dataManager.getSettings();
            const adminEmails = settings.adminEmails || [];

            // Remove email
            settings.adminEmails = adminEmails.filter((e) => e !== email);

            await dataManager.updateSettings(settings);

            // Reload admin emails list
            this.loadAdminEmails(settings.adminEmails);

            this.adminPanel.showSuccessMessage(`Správce ${email} byl úspěšně odebrán`);
        } catch (error) {
            console.error('Chyba při odebírání správce:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
        }
    }

    // Load cabin manager emails list
    loadCabinManagerEmails(cabinManagerEmails) {
        const listContainer = document.getElementById('cabinManagerEmailsList');

        if (!listContainer) {
            console.warn('Cabin manager emails list container not found');
            return;
        }

        if (!cabinManagerEmails || cabinManagerEmails.length === 0) {
            listContainer.innerHTML = `
        <p style="color: #666; font-style: italic; padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
          Žádní správci chaty nejsou zatím přidáni.
        </p>
      `;
            return;
        }

        listContainer.innerHTML = cabinManagerEmails
            .map(
                (email) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: var(--gray-50); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: var(--primary-color);">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span style="font-weight: 500;">${this.adminPanel.bookings.escapeHtml(email)}</span>
        </div>
        <button
          class="btn btn-sm remove-cabin-manager-btn"
          data-email="${this.adminPanel.bookings.escapeHtml(email)}"
          style="padding: 0.5rem 1rem; background: #dc2626; color: white; border: none;"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="display: inline; margin-right: 0.25rem;">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          Odebrat
        </button>
      </div>
    `
            )
            .join('');

        // Add event listeners to remove buttons (safer than onclick)
        listContainer.querySelectorAll('.remove-cabin-manager-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const email = e.currentTarget.getAttribute('data-email');
                this.removeCabinManagerEmail(email);
            });
        });
    }

    async handleAddCabinManagerEmail(e) {
        e.preventDefault();

        // Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            const emailInput = document.getElementById('newCabinManagerEmail');
            const newEmail = emailInput.value.trim();

            // Validate email format
            if (!ValidationUtils.validateEmail(newEmail)) {
                this.adminPanel.showToast('Neplatný formát emailové adresy', 'error');
                return;
            }

            const settings = await dataManager.getSettings();
            const cabinManagerEmails = settings.cabinManagerEmails || [];

            // Check if email already exists
            if (cabinManagerEmails.includes(newEmail)) {
                this.adminPanel.showToast('Tento email je již v seznamu správců chaty', 'warning');
                return;
            }

            // Add new email
            cabinManagerEmails.push(newEmail);
            settings.cabinManagerEmails = cabinManagerEmails;

            await dataManager.updateSettings(settings);

            // Reload cabin manager emails list
            this.loadCabinManagerEmails(cabinManagerEmails);

            // Clear input
            emailInput.value = '';

            this.adminPanel.showSuccessMessage(`Správce chaty ${newEmail} byl úspěšně přidán`);
        } catch (error) {
            console.error('Chyba při přidávání správce chaty:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
        }
    }

    async removeCabinManagerEmail(email) {
        // Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        if (!confirm(`Opravdu chcete odebrat správce chaty ${email}?`)) {
            return;
        }

        try {
            const settings = await dataManager.getSettings();
            const cabinManagerEmails = settings.cabinManagerEmails || [];

            // Remove email
            settings.cabinManagerEmails = cabinManagerEmails.filter((e) => e !== email);

            await dataManager.updateSettings(settings);

            // Reload cabin manager emails list
            this.loadCabinManagerEmails(settings.cabinManagerEmails);

            this.adminPanel.showSuccessMessage(`Správce chaty ${email} byl úspěšně odebrán`);
        } catch (error) {
            console.error('Chyba při odebírání správce chaty:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
        }
    }

    updateEmailTemplateCharCount() {
        const templateTextarea = document.getElementById('emailTemplate');
        const charCount = templateTextarea.value.length;
        const maxChars = 600;

        document.getElementById('emailTemplateCharCount').textContent = charCount;

        const warning = document.getElementById('emailTemplateWarning');
        if (charCount > maxChars) {
            warning.style.display = 'inline';
            templateTextarea.style.borderColor = 'var(--error-color)';
        } else {
            warning.style.display = 'none';
            templateTextarea.style.borderColor = '';
        }
    }

    async handleEmailTemplate(e) {
        e.preventDefault();

        // FIX: Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            const template = document.getElementById('emailTemplate').value;
            const maxChars = 600;

            // Validate 600 character limit
            if (template.length > maxChars) {
                this.adminPanel.showToast(
                    `Text emailu nesmí přesáhnout ${maxChars} znaků (aktuálně: ${template.length})`,
                    'error'
                );
                return;
            }

            const settings = await dataManager.getSettings();
            settings.emailTemplate = {
                subject: document.getElementById('emailSubject').value,
                template,
            };

            await dataManager.updateSettings(settings);
            this.adminPanel.showSuccessMessage(
                'Šablona emailu byla uložena. Editační odkaz {edit_url} se automaticky přidá na konec emailu.'
            );
        } catch (error) {
            console.error('Chyba při ukládání email šablony:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
        }
    }

    async handleContactEmail(e) {
        e.preventDefault();

        // Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            const contactEmail = document.getElementById('contactEmail').value.trim();

            // Validate email format using ValidationUtils
            if (!ValidationUtils.validateEmail(contactEmail)) {
                this.adminPanel.showToast('Neplatný formát emailové adresy', 'error');
                return;
            }

            const settings = await dataManager.getSettings();
            settings.contactEmail = contactEmail;

            await dataManager.updateSettings(settings);
            this.adminPanel.showSuccessMessage('Kontaktní email byl úspěšně uložen');
        } catch (error) {
            console.error('Chyba při ukládání kontaktního emailu:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
        }
    }

    async loadChristmasCodes() {
        const settings = await dataManager.getSettings();
        const codes = settings.christmasAccessCodes || [];
        const container = document.getElementById('christmasCodesList');

        container.innerHTML = '';

        codes.forEach((code) => {
            const chip = document.createElement('div');
            chip.className = 'code-chip';
            chip.innerHTML = `
                <span>${code}</span>
                <button onclick="adminPanel.settings.removeCode('${code}').catch(console.error)">&times;</button>
            `;
            container.appendChild(chip);
        });

        if (codes.length === 0) {
            container.innerHTML = '<p style="color: var(--gray-500);">Žádné přístupové kódy</p>';
        }
    }

    async handleAddCode(e) {
        e.preventDefault();

        // FIX: Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            const newCode = document.getElementById('newCode').value.trim();

            if (!newCode) {
                this.adminPanel.showToast('Zadejte platný kód', 'warning');
                return;
            }

            const settings = await dataManager.getSettings();

            if (!settings.christmasAccessCodes) {
                settings.christmasAccessCodes = [];
            }

            if (settings.christmasAccessCodes.includes(newCode)) {
                this.adminPanel.showToast('Tento kód již existuje', 'warning');
                return;
            }

            settings.christmasAccessCodes.push(newCode);
            await dataManager.updateSettings(settings);

            // Synchronizuj s serverem pro jistotu
            await dataManager.syncWithServer();

            e.target.reset();
            await this.loadChristmasCodes();

            this.adminPanel.showToast(`Přístupový kód "${newCode}" byl úspěšně přidán`, 'success');
        } catch (error) {
            console.error('Chyba při přidávání kódu:', error);
            this.adminPanel.showToast(`Chyba při přidávání kódu: ${error.message}`, 'error');
        }
    }

    async removeCode(code) {
        // FIX: Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            // Získej aktuální nastavení
            const settings = await dataManager.getSettings();

            // Odstraň kód ze seznamu
            const originalCount = settings.christmasAccessCodes
                ? settings.christmasAccessCodes.length
                : 0;
            settings.christmasAccessCodes = settings.christmasAccessCodes.filter((c) => c !== code);
            const newCount = settings.christmasAccessCodes.length;

            // Ulož změny na server
            await dataManager.updateSettings(settings);

            // Synchronizuj s serverem pro jistotu
            await dataManager.syncWithServer();

            // Znovu načti kódy pro zobrazení
            await this.loadChristmasCodes();

            // Ověř, že se změna skutečně provedla
            if (originalCount > newCount) {
                this.adminPanel.showToast(`Přístupový kód "${code}" byl úspěšně odebrán`, 'success');
            } else {
                this.adminPanel.showToast('Kód nebyl nalezen nebo už byl odstraněn', 'warning');
            }
        } catch (error) {
            console.error('Chyba při odstraňování kódu:', error);
            this.adminPanel.showToast(`Chyba při odstraňování kódu: ${error.message}`, 'error');
        }
    }

    async loadChristmasPeriods() {
        const settings = await dataManager.getSettings();
        const container = document.getElementById('christmasPeriodsContainer');

        // Convert old single period format to new array format
        if (settings.christmasPeriod && !settings.christmasPeriods) {
            settings.christmasPeriods = [settings.christmasPeriod];
            delete settings.christmasPeriod;
            try {
                await dataManager.updateSettings(settings);
            } catch (error) {
                // If migration fails (e.g., session expired), continue with local data
                // Migration will happen again when user successfully saves
                console.warn('Christmas period migration skipped:', error.message);
            }
        }

        const periods = settings.christmasPeriods || [];
        container.innerHTML = '';

        if (periods.length === 0) {
            container.innerHTML =
                '<p style="color: var(--gray-500); text-align: center; padding: 2rem;">Žádná vánoční období nejsou nastavena</p>';
            return;
        }

        // Sort periods by start date
        periods.sort((a, b) => new Date(a.start) - new Date(b.start));

        periods.forEach((period, index) => {
            const startDate = new Date(period.start);
            const endDate = new Date(period.end);
            const year = period.year || startDate.getFullYear();

            const card = document.createElement('div');
            card.className = 'christmas-period-card';
            card.innerHTML = `
                <div class="christmas-period-info">
                    <div class="christmas-period-dates">
                        ${startDate.toLocaleDateString('cs-CZ')} - ${endDate.toLocaleDateString('cs-CZ')}
                    </div>
                    <div class="christmas-period-year">Rok ${year}</div>
                </div>
                <button onclick="adminPanel.settings.removeChristmasPeriod('${period.periodId || index}', ${index}).catch(console.error)"
                        class="btn-danger btn-small"
                        style="padding: 0.5rem 1rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; transition: background 0.2s;"
                        onmouseover="this.style.background='#b91c1c'"
                        onmouseout="this.style.background='#dc2626'">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                    </svg>
                    Odstranit
                </button>
            `;
            container.appendChild(card);
        });
    }

    async handleChristmasPeriod(e) {
        e.preventDefault();

        // FIX: Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            const startDate = document.getElementById('christmasStart').value;
            const endDate = document.getElementById('christmasEnd').value;

            if (!startDate || !endDate) {
                this.adminPanel.showToast('Vyplňte začátek a konec období', 'warning');
                return;
            }

            if (new Date(endDate) < new Date(startDate)) {
                this.adminPanel.showToast('Konec období musí být po začátku', 'warning');
                return;
            }

            // Automatically determine year from start date
            const year = new Date(startDate).getFullYear();

            const settings = await dataManager.getSettings();

            // Initialize christmasPeriods array if it doesn't exist
            if (!settings.christmasPeriods) {
                settings.christmasPeriods = [];
            }

            // Check for overlapping periods
            const newPeriod = {
                start: startDate,
                end: endDate,
                year,
                periodId: IdGenerator.generateChristmasPeriodId(), // Generate unique ID for reliable deletion
            };
            const overlapping = settings.christmasPeriods.some((period) => {
                const periodStart = new Date(period.start);
                const periodEnd = new Date(period.end);
                const newStart = new Date(startDate);
                const newEnd = new Date(endDate);

                return newStart <= periodEnd && newEnd >= periodStart;
            });

            if (overlapping) {
                this.adminPanel.showToast('Toto období se překrývá s již existujícím obdobím', 'warning');
                return;
            }

            settings.christmasPeriods.push(newPeriod);
            await dataManager.updateSettings(settings);
            await dataManager.syncWithServer();

            // Clear form
            e.target.reset();

            await this.loadChristmasPeriods();
            this.adminPanel.showToast(`Vánoční období ${year} bylo přidáno`, 'success');
        } catch (error) {
            console.error('Chyba při přidávání vánočního období:', error);
            this.adminPanel.showToast(`Chyba při přidávání vánočního období: ${error.message}`, 'error');
        }
    }

    async removeChristmasPeriod(periodId, index) {
        // FIX: Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            const settings = await dataManager.getSettings();

            // Try to find period either by periodId or by index for backward compatibility
            // FIX: Detect if periodId is an actual ID (starts with 'XMAS') or a stringified index
            let period = null;
            const isActualPeriodId = typeof periodId === 'string' && periodId.startsWith('XMAS');

            if (isActualPeriodId) {
                period = settings.christmasPeriods?.find((p) => p.periodId === periodId);
            }
            // Fallback to index-based lookup if period not found by ID
            if (!period && settings.christmasPeriods && settings.christmasPeriods[index]) {
                period = settings.christmasPeriods[index];
            }

            if (!period) {
                this.adminPanel.showToast('Vánoční období nebylo nalezeno', 'warning');
                return;
            }

            const startDate = new Date(period.start).toLocaleDateString('cs-CZ');
            const endDate = new Date(period.end).toLocaleDateString('cs-CZ');
            const year = period.year || new Date(period.start).getFullYear();

            // Use showConfirm instead of confirm
            const self = this; // Capture 'this' context
            this.adminPanel.showConfirm(
                `Opravdu chcete odstranit vánoční období ${year}?<br>${startDate} - ${endDate}`,
                async () => {
                    try {
                        // ✅ FIX: Use DataManager pattern like Christmas codes (SSOT)
                        // Filter out the period from the array
                        if (period.periodId) {
                            settings.christmasPeriods = settings.christmasPeriods.filter(
                                (p) => p.periodId !== period.periodId
                            );
                        } else {
                            // Fallback for periods without periodId
                            settings.christmasPeriods.splice(index, 1);
                        }

                        // Update through DataManager (auto-syncs with server)
                        await dataManager.updateSettings(settings);

                        // Force refresh from server to ensure sync
                        await dataManager.syncWithServer(true);

                        // Reload the periods list
                        await self.loadChristmasPeriods();

                        self.adminPanel.showToast(`Vánoční období ${year} bylo odstraněno`, 'success');
                    } catch (error) {
                        console.error('Chyba při odstraňování vánočního období:', error);
                        // Reload to show original state on error
                        await self.loadChristmasPeriods();
                        self.adminPanel.showToast(
                            `Chyba při odstraňování vánočního období: ${error.message}`,
                            'error'
                        );
                    }
                }
            );
        } catch (error) {
            console.error('Chyba při odstraňování vánočního období:', error);
            this.adminPanel.showToast(
                `Chyba při odstraňování vánočního období: ${error.message}`,
                'error'
            );
        }
    }

    async loadRoomConfig() {
        const settings = await dataManager.getSettings();
        const data = await dataManager.getData();
        const rooms = settings.rooms || data.rooms;

        // Store current room data for preserving type field
        this.currentRooms = rooms;

        // Default room configuration in case data is missing
        const defaultRooms = {
            12: 2,
            13: 3,
            14: 4,
            22: 2,
            23: 3,
            24: 4,
            42: 2,
            43: 2,
            44: 4,
        };

        // Load current room configuration
        if (rooms && Array.isArray(rooms)) {
            rooms.forEach((room) => {
                const bedsInput = document.getElementById(`room${room.id}_beds`);
                // const typeSelect = document.getElementById(`room${room.id}_type`); // Reserved for future use
                if (bedsInput) {
                    // Use room.beds if it exists and is a valid number, otherwise use default
                    const bedsValue =
                        room.beds !== undefined && room.beds !== null && !isNaN(room.beds)
                            ? room.beds
                            : defaultRooms[room.id] || 2;
                    bedsInput.value = bedsValue;
                }
            });
        } else {
            // If no rooms data, load defaults
            Object.keys(defaultRooms).forEach((roomId) => {
                const bedsInput = document.getElementById(`room${roomId}_beds`);
                if (bedsInput) {
                    bedsInput.value = defaultRooms[roomId];
                }
            });
        }
    }

    async handleRoomConfig(e) {
        e.preventDefault();

        // FIX: Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            const roomIds = ['12', '13', '14', '22', '23', '24', '42', '43', '44'];
            const newRooms = roomIds.map((id) => {
                const beds = parseInt(document.getElementById(`room${id}_beds`).value, 10);

                // Find existing room data to preserve type
                const existingRoom = this.currentRooms?.find((r) => r.id === id);

                return {
                    id,
                    name: `${langManager.t('room')} ${id}`,
                    type: existingRoom?.type || 'standard',
                    beds,
                };
            });

            // Validate
            if (newRooms.some((r) => isNaN(r.beds) || r.beds < 1)) {
                this.adminPanel.showToast('Neplatný počet lůžek', 'error');
                return;
            }

            // Update settings
            const settings = await dataManager.getSettings();
            settings.rooms = newRooms;
            await dataManager.updateSettings(settings);

            // Update data storage (backward compatibility)
            const data = await dataManager.getData();
            data.rooms = newRooms;
            await dataManager.saveData(data);

            // Force sync with server
            await dataManager.syncWithServer();

            this.adminPanel.showSuccessMessage('Konfigurace pokojů byla uložena');

            // Refresh the main app if it's loaded
            if (window.bookingApp) {
                window.bookingApp.renderCalendar();
                window.bookingApp.updateRoomSelection();
            }
        } catch (error) {
            console.error('Chyba při ukládání konfigurace pokojů:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
        }
    }

    async loadPriceConfig() {
        const settings = await dataManager.getSettings();
        // NEW (2025-10-17): Room-size-based pricing defaults
        const defaultPrices = PriceCalculator.getDefaultPrices();
        const prices = settings.prices || defaultPrices;

        // Load UTIA Small room prices
        const utiaSmallBaseEl = document.getElementById('utia_small_base');
        const utiaSmallAdultEl = document.getElementById('utia_small_adult');
        const utiaSmallChildEl = document.getElementById('utia_small_child');

        if (utiaSmallBaseEl) {
            // Backward compatibility: Try 'empty' first, fall back to 'base'
            const emptyPrice =
                prices.utia?.small?.empty !== undefined
                    ? prices.utia.small.empty
                    : prices.utia?.small?.base !== undefined
                        ? prices.utia.small.base - (prices.utia.small.adult || 0)
                        : defaultPrices.utia.small.base - defaultPrices.utia.small.adult;
            utiaSmallBaseEl.value = emptyPrice;
        }
        if (utiaSmallAdultEl) {
            utiaSmallAdultEl.value = prices.utia?.small?.adult || defaultPrices.utia.small.adult;
        }
        if (utiaSmallChildEl) {
            utiaSmallChildEl.value = prices.utia?.small?.child || defaultPrices.utia.small.child;
        }

        // Load UTIA Large room prices
        const utiaLargeBaseEl = document.getElementById('utia_large_base');
        const utiaLargeAdultEl = document.getElementById('utia_large_adult');
        const utiaLargeChildEl = document.getElementById('utia_large_child');

        if (utiaLargeBaseEl) {
            // Backward compatibility: Try 'empty' first, fall back to 'base'
            const emptyPrice =
                prices.utia?.large?.empty !== undefined
                    ? prices.utia.large.empty
                    : prices.utia?.large?.base !== undefined
                        ? prices.utia.large.base - (prices.utia.large.adult || 0)
                        : defaultPrices.utia.large.base - defaultPrices.utia.large.adult;
            utiaLargeBaseEl.value = emptyPrice;
        }
        if (utiaLargeAdultEl) {
            utiaLargeAdultEl.value = prices.utia?.large?.adult || defaultPrices.utia.large.adult;
        }
        if (utiaLargeChildEl) {
            utiaLargeChildEl.value = prices.utia?.large?.child || defaultPrices.utia.large.child;
        }

        // Load External Small room prices
        const externalSmallBaseEl = document.getElementById('external_small_base');
        const externalSmallAdultEl = document.getElementById('external_small_adult');
        const externalSmallChildEl = document.getElementById('external_small_child');

        if (externalSmallBaseEl) {
            // Backward compatibility: Try 'empty' first, fall back to 'base'
            const emptyPrice =
                prices.external?.small?.empty !== undefined
                    ? prices.external.small.empty
                    : prices.external?.small?.base !== undefined
                        ? prices.external.small.base - (prices.external.small.adult || 0)
                        : defaultPrices.external.small.base - defaultPrices.external.small.adult;
            externalSmallBaseEl.value = emptyPrice;
        }
        if (externalSmallAdultEl) {
            externalSmallAdultEl.value =
                prices.external?.small?.adult || defaultPrices.external.small.adult;
        }
        if (externalSmallChildEl) {
            externalSmallChildEl.value =
                prices.external?.small?.child || defaultPrices.external.small.child;
        }

        // Load External Large room prices
        const externalLargeBaseEl = document.getElementById('external_large_base');
        const externalLargeAdultEl = document.getElementById('external_large_adult');
        const externalLargeChildEl = document.getElementById('external_large_child');

        if (externalLargeBaseEl) {
            // Backward compatibility: Try 'empty' first, fall back to 'base'
            const emptyPrice =
                prices.external?.large?.empty !== undefined
                    ? prices.external.large.empty
                    : prices.external?.large?.base !== undefined
                        ? prices.external.large.base - (prices.external.large.adult || 0)
                        : defaultPrices.external.large.base - defaultPrices.external.large.adult;
            externalLargeBaseEl.value = emptyPrice;
        }
        if (externalLargeAdultEl) {
            externalLargeAdultEl.value =
                prices.external?.large?.adult || defaultPrices.external.large.adult;
        }
        if (externalLargeChildEl) {
            externalLargeChildEl.value =
                prices.external?.large?.child || defaultPrices.external.large.child;
        }
    }

    async handlePriceConfig(e) {
        e.preventDefault();

        // FIX: Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            // NEW (2025-11-04): Room-size-based pricing with empty room model
            const prices = {
                utia: {
                    small: {
                        empty: parseInt(document.getElementById('utia_small_base').value, 10),
                        adult: parseInt(document.getElementById('utia_small_adult').value, 10),
                        child: parseInt(document.getElementById('utia_small_child').value, 10),
                    },
                    large: {
                        empty: parseInt(document.getElementById('utia_large_base').value, 10),
                        adult: parseInt(document.getElementById('utia_large_adult').value, 10),
                        child: parseInt(document.getElementById('utia_large_child').value, 10),
                    },
                },
                external: {
                    small: {
                        empty: parseInt(document.getElementById('external_small_base').value, 10),
                        adult: parseInt(document.getElementById('external_small_adult').value, 10),
                        child: parseInt(document.getElementById('external_small_child').value, 10),
                    },
                    large: {
                        empty: parseInt(document.getElementById('external_large_base').value, 10),
                        adult: parseInt(document.getElementById('external_large_adult').value, 10),
                        child: parseInt(document.getElementById('external_large_child').value, 10),
                    },
                },
            };

            const settings = await dataManager.getSettings();
            settings.prices = prices;
            await dataManager.updateSettings(settings);

            this.adminPanel.showSuccessMessage('Ceník byl uložen');

            // Refresh price calculations if booking app is loaded
            if (window.bookingApp) {
                window.bookingApp.updatePriceCalculation();
            }
        } catch (error) {
            console.error('Chyba při ukládání ceníku:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
        }
    }

    async loadBulkPriceConfig() {
        const settings = await dataManager.getSettings();
        const defaultBulkPrices = {
            basePrice: 2000,
            utiaAdult: 100,
            utiaChild: 0,
            externalAdult: 250,
            externalChild: 50,
        };
        const bulkPrices = settings.bulkPrices || defaultBulkPrices;

        // Load bulk pricing values with fallbacks
        const bulkBasePriceEl = document.getElementById('bulk_base_price');
        const bulkUtiaAdultEl = document.getElementById('bulk_utia_adult');
        const bulkUtiaChildEl = document.getElementById('bulk_utia_child');
        const bulkExternalAdultEl = document.getElementById('bulk_external_adult');
        const bulkExternalChildEl = document.getElementById('bulk_external_child');

        if (bulkBasePriceEl) {
            bulkBasePriceEl.value = bulkPrices.basePrice || defaultBulkPrices.basePrice;
        }
        if (bulkUtiaAdultEl) {
            bulkUtiaAdultEl.value = bulkPrices.utiaAdult || defaultBulkPrices.utiaAdult;
        }
        if (bulkUtiaChildEl) {
            bulkUtiaChildEl.value = bulkPrices.utiaChild || defaultBulkPrices.utiaChild;
        }
        if (bulkExternalAdultEl) {
            bulkExternalAdultEl.value = bulkPrices.externalAdult || defaultBulkPrices.externalAdult;
        }
        if (bulkExternalChildEl) {
            bulkExternalChildEl.value = bulkPrices.externalChild || defaultBulkPrices.externalChild;
        }
    }

    async handleBulkPriceConfig(e) {
        e.preventDefault();

        // FIX: Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        try {
            const bulkPrices = {
                basePrice: parseInt(document.getElementById('bulk_base_price').value, 10),
                utiaAdult: parseInt(document.getElementById('bulk_utia_adult').value, 10),
                utiaChild: parseInt(document.getElementById('bulk_utia_child').value, 10),
                externalAdult: parseInt(document.getElementById('bulk_external_adult').value, 10),
                externalChild: parseInt(document.getElementById('bulk_external_child').value, 10),
            };

            const settings = await dataManager.getSettings();
            settings.bulkPrices = bulkPrices;
            await dataManager.updateSettings(settings);

            this.adminPanel.showSuccessMessage('Ceník hromadné rezervace byl uložen');
        } catch (error) {
            console.error('Chyba při ukládání bulk ceníku:', error);
            this.adminPanel.showToast(`Chyba: ${error.message}`, 'error');
            return; // Early return to prevent executing code below
        }

        // Refresh bulk booking price calculations if booking app is loaded
        if (window.bookingApp && window.bookingApp.updateBulkPriceCalculation) {
            window.bookingApp.updateBulkPriceCalculation();
        }
    }

    async handleChangePassword(e) {
        e.preventDefault();

        // FIX: Validate session before admin operation
        if (!this.adminPanel.validateSession()) {
            return;
        }

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // First verify current password
        const isAuthenticated = await dataManager.authenticateAdmin(currentPassword);
        if (!isAuthenticated) {
            this.adminPanel.showErrorMessage('Nesprávné současné heslo');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.adminPanel.showErrorMessage('Nová hesla se neshodují');
            return;
        }

        if (newPassword.length < 8) {
            this.adminPanel.showErrorMessage('Nové heslo musí mít alespoň 8 znaků');
            return;
        }

        // Use the API endpoint to update password
        try {
            const sessionToken = dataManager.getSessionToken();
            const response = await fetch('/api/admin/update-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-token': sessionToken,
                },
                body: JSON.stringify({ newPassword }),
            });

            if (response.ok) {
                e.target.reset();
                this.adminPanel.showSuccessMessage('Heslo bylo úspěšně změněno');
            } else {
                const error = await response.json();
                this.adminPanel.showErrorMessage(`Chyba při změně hesla: ${error.error}`);
            }
        } catch (error) {
            console.error('Error updating password:', error);
            this.adminPanel.showErrorMessage('Nepodařilo se změnit heslo');
        }
    }
}
