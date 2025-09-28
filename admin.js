// Admin panel logic
class AdminPanel {
  constructor() {
    this.isAuthenticated = false;
    this.init();
  }

  // Helper function to create styled room badges
  createRoomBadge(roomId, inline = false) {
    // Use cached rooms data
    const data = JSON.parse(localStorage.getItem('chataMarianska') || '{}');
    // const rooms = data.settings?.rooms || []; // Reserved for future use
    // const room = rooms.find((r) => r.id === roomId); // Reserved for future use
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
        ">${roomId}</span>`;
  }

  async init() {
    // Make sure DataManager is properly initialized and synced
    await dataManager.initData();
    // Force sync with server to get latest data
    await dataManager.syncWithServer();
    this.setupEventListeners();
    await this.checkAuthentication();
  }

  setupEventListeners() {
    // Login
    document
      .getElementById('loginForm')
      .addEventListener('submit', (e) => this.handleLogin(e));

    // Navigation
    document.getElementById('backBtn').addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

    // Tabs
    document.querySelectorAll('.tab-button').forEach((btn) => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Search
    document.getElementById('searchBookings').addEventListener('input', (e) => {
      this.filterBookings(e.target.value);
    });

    // Forms
    document
      .getElementById('blockDateForm')
      .addEventListener('submit', (e) => this.handleBlockDate(e));
    document
      .getElementById('addCodeForm')
      .addEventListener('submit', (e) => this.handleAddCode(e));
    document
      .getElementById('christmasPeriodForm')
      .addEventListener('submit', (e) => this.handleChristmasPeriod(e));
    document
      .getElementById('roomConfigForm')
      .addEventListener('submit', (e) => this.handleRoomConfig(e));
    document
      .getElementById('priceConfigForm')
      .addEventListener('submit', (e) => this.handlePriceConfig(e));
    document
      .getElementById('bulkPriceConfigForm')
      .addEventListener('submit', (e) => this.handleBulkPriceConfig(e));
    document
      .getElementById('changePasswordForm')
      .addEventListener('submit', (e) => this.handleChangePassword(e));
    document
      .getElementById('editBookingForm')
      .addEventListener('submit', (e) => this.handleEditBooking(e));
    document
      .getElementById('emailTemplateForm')
      .addEventListener('submit', (e) => this.handleEmailTemplate(e));

    // Modal close
    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.modal').classList.remove('active');
      });
    });
  }

  async checkAuthentication() {
    const authToken = sessionStorage.getItem('adminAuth');
    if (authToken === 'authenticated') {
      await this.showAdminPanel();
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('password').value;

    if (await dataManager.authenticateAdmin(password)) {
      sessionStorage.setItem('adminAuth', 'authenticated');
      await this.showAdminPanel();
    } else {
      alert('Nesprávné heslo');
    }
  }

  logout() {
    sessionStorage.removeItem('adminAuth');
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('password').value = '';
  }

  async showAdminPanel() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'block';

    // Load data for the active tab (default is bookings)
    await this.loadTabData('bookings');
  }

  async switchTab(tabName) {
    // Update button states
    document.querySelectorAll('.tab-button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content visibility
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });

    document.getElementById(`${tabName}Tab`).classList.add('active');

    // Load data for the selected tab
    await this.loadTabData(tabName);
  }

  async loadTabData(tabName) {
    // Sync with server first to get fresh data
    await dataManager.syncWithServer();

    switch (tabName) {
      case 'bookings':
        await this.loadBookings();
        break;
      case 'blocked':
        await this.loadBlockedDates();
        break;
      case 'christmas':
        await this.loadChristmasCodes();
        await this.loadChristmasPeriods();
        break;
      case 'config':
        await this.loadRoomConfig();
        await this.loadPriceConfig();
        await this.loadBulkPriceConfig();
        break;
      case 'statistics':
        await this.loadStatistics();
        break;
      case 'settings':
        await this.loadEmailTemplate();
        break;
      default:
        // Unknown tab - do nothing
        break;
    }
  }

  async loadBookings() {
    const bookings = await dataManager.getAllBookings();
    const tbody = document.getElementById('bookingsTableBody');

    tbody.innerHTML = '';

    bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    bookings.forEach((booking) => {
      const row = document.createElement('tr');
      row.innerHTML = `
                <td>${booking.id}</td>
                <td>${booking.name}</td>
                <td>${booking.email}</td>
                <td>${booking.phone}</td>
                <td>${new Date(booking.startDate).toLocaleDateString('cs-CZ')} -
                    ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}</td>
                <td>${booking.rooms.map((roomId) => this.createRoomBadge(roomId, true)).join('')}</td>
                <td>${booking.totalPrice} Kč</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-secondary btn-small" onclick="adminPanel.viewBookingDetails('${booking.id}')">Detail</button>
                        <button class="btn-secondary btn-small" onclick="adminPanel.editBooking('${booking.id}')">Upravit</button>
                        <button class="btn-danger btn-small" onclick="adminPanel.deleteBooking('${booking.id}')">Smazat</button>
                    </div>
                </td>
            `;
      tbody.appendChild(row);
    });
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

                <div style="display: grid; gap: 1.5rem; margin-top: 1.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Jméno a příjmení:</strong>
                            <div style="margin-top: 0.25rem;">${booking.name}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Email:</strong>
                            <div style="margin-top: 0.25rem;">${booking.email}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Telefon:</strong>
                            <div style="margin-top: 0.25rem;">${booking.phone}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Firma:</strong>
                            <div style="margin-top: 0.25rem;">${booking.company || '-'}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">IČO:</strong>
                            <div style="margin-top: 0.25rem;">${booking.ico || '-'}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">DIČ:</strong>
                            <div style="margin-top: 0.25rem;">${booking.dic || '-'}</div>
                        </div>
                    </div>

                    <div>
                        <strong style="color: var(--gray-600); font-size: 0.9rem;">Adresa:</strong>
                        <div style="margin-top: 0.25rem;">${booking.address}, ${booking.city} ${booking.zip}</div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Datum pobytu:</strong>
                            <div style="margin-top: 0.25rem;">
                                ${new Date(booking.startDate).toLocaleDateString('cs-CZ')} -
                                ${new Date(booking.endDate).toLocaleDateString('cs-CZ')}
                            </div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Pokoje:</strong>
                            <div style="margin-top: 0.25rem;">${booking.rooms.map((roomId) => this.createRoomBadge(roomId, true)).join('')}</div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Počet hostů:</strong>
                            <div style="margin-top: 0.25rem;">
                                Dospělí: ${booking.adults}, Děti: ${booking.children}, Batolata: ${booking.toddlers}
                            </div>
                        </div>
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Typ hosta:</strong>
                            <div style="margin-top: 0.25rem;">${booking.guestType === 'utia' ? 'Zaměstnanec ÚTIA' : 'Externí host'}</div>
                        </div>
                    </div>

                    <div>
                        <strong style="color: var(--gray-600); font-size: 0.9rem;">Celková cena:</strong>
                        <div style="margin-top: 0.25rem; font-size: 1.25rem; font-weight: 600; color: var(--primary-color);">
                            ${booking.totalPrice} Kč
                        </div>
                    </div>

                    ${
                      booking.notes
                        ? `
                        <div>
                            <strong style="color: var(--gray-600); font-size: 0.9rem;">Poznámky:</strong>
                            <div style="margin-top: 0.25rem; padding: 0.75rem; background: var(--gray-50); border-radius: var(--radius-sm);">
                                ${booking.notes}
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
                            ${
                              booking.updatedAt
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
                    <button class="btn btn-primary" onclick="adminPanel.editBooking('${booking.id}'); this.closest('.modal').remove()">Upravit rezervaci</button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
  }

  async editBooking(bookingId) {
    const booking = await dataManager.getBooking(bookingId);
    if (!booking) {
      return;
    }

    document.getElementById('editBookingId').value = bookingId;
    document.getElementById('editName').value = booking.name || '';
    document.getElementById('editEmail').value = booking.email || '';
    document.getElementById('editPhone').value = booking.phone || '';
    document.getElementById('editCompany').value = booking.company || '';
    document.getElementById('editAddress').value = booking.address || '';
    document.getElementById('editCity').value = booking.city || '';
    document.getElementById('editZip').value = booking.zip || '';
    document.getElementById('editIco').value = booking.ico || '';
    document.getElementById('editDic').value = booking.dic || '';
    document.getElementById('editNotes').value = booking.notes || '';

    document.getElementById('editBookingModal').classList.add('active');
  }

  async handleEditBooking(e) {
    e.preventDefault();

    const bookingId = document.getElementById('editBookingId').value;
    const updates = {
      name: document.getElementById('editName').value,
      email: document.getElementById('editEmail').value,
      phone: document.getElementById('editPhone').value,
      company: document.getElementById('editCompany').value,
      address: document.getElementById('editAddress').value,
      city: document.getElementById('editCity').value,
      zip: document.getElementById('editZip').value,
      ico: document.getElementById('editIco').value,
      dic: document.getElementById('editDic').value,
      notes: document.getElementById('editNotes').value,
    };

    await dataManager.updateBooking(bookingId, updates);
    document.getElementById('editBookingModal').classList.remove('active');
    await this.loadBookings();
    this.showSuccessMessage('Rezervace byla úspěšně upravena');
  }

  deleteBooking(bookingId) {
    if (confirm('Opravdu chcete smazat tuto rezervaci?')) {
      dataManager.deleteBooking(bookingId);
      this.loadBookings();
      this.showSuccessMessage('Rezervace byla smazána');
    }
  }

  async loadBlockedDates() {
    const blockedDates = await dataManager.getBlockedDates();
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

    // Filter out past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const relevantDates = blockedDates.filter((bd) => new Date(bd.date) >= today);

    // Group blocked dates by blockageId
    const blockageGroups = {};
    relevantDates.forEach((blocked) => {
      const groupId = blocked.blockageId || blocked.date; // Use date as fallback for old entries
      if (!blockageGroups[groupId]) {
        blockageGroups[groupId] = {
          dates: [],
          roomIds: new Set(),
          reason: blocked.reason,
          blockageId: blocked.blockageId,
        };
      }
      blockageGroups[groupId].dates.push(blocked.date);
      if (blocked.roomId) {
        blockageGroups[groupId].roomIds.add(blocked.roomId);
      }
    });

    // Convert groups to sorted array
    const sortedGroups = Object.values(blockageGroups)
      .map((group) => {
        group.dates.sort();
        return {
          ...group,
          startDate: group.dates[0],
          endDate: group.dates[group.dates.length - 1],
          roomsList: Array.from(group.roomIds).sort(),
        };
      })
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    if (sortedGroups.length === 0) {
      container.innerHTML =
        '<p style="text-align: center; color: var(--gray-500);">Žádné blokované termíny</p>';
      return;
    }

    // Display grouped blockages
    sortedGroups.forEach((group) => {
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

      const startDate = new Date(group.startDate);
      const endDate = new Date(group.endDate);
      const isSingleDay = group.startDate === group.endDate;

      card.innerHTML = `
                <div style="flex: 1;">
                    ${group.blockageId ? `<div style="color: var(--gray-400); font-size: 0.65rem; font-family: monospace; margin-bottom: 0.25rem; opacity: 0.7;">${group.blockageId}</div>` : ''}
                    <div style="font-weight: 600; color: var(--gray-900); font-size: 0.95rem; margin-bottom: 0.5rem;">
                        ${
                          isSingleDay
                            ? startDate.toLocaleDateString('cs-CZ')
                            : `${startDate.toLocaleDateString('cs-CZ')} - ${endDate.toLocaleDateString('cs-CZ')}`
                        }
                    </div>
                    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.8rem; color: var(--gray-600);">Pokoje:</span>
                        ${
                          group.roomsList.length > 0
                            ? group.roomsList
                                .map((roomId) => this.createRoomBadge(roomId, true))
                                .join('')
                            : '<span style="color: var(--gray-700); font-size: 0.85rem;">Všechny pokoje</span>'
                        }
                    </div>
                    <div style="font-size: 0.8rem; color: var(--gray-600);">
                        <strong>Důvod:</strong> <em>${group.reason || 'Bez uvedení důvodu'}</em>
                    </div>
                </div>
                <div style="margin-top: auto; padding-top: 0.5rem;">
                    <button onclick="adminPanel.unblockRange('${group.blockageId || group.startDate}').catch(console.error)"
                            style="width: 100%; padding: 0.5rem; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.85rem; transition: background 0.2s;"
                            onmouseover="this.style.background='#b91c1c'"
                            onmouseout="this.style.background='#dc2626'">
                        Odblokovat
                    </button>
                </div>
            `;
      container.appendChild(card);
    });

    if (sortedGroups.length === 0) {
      container.innerHTML = '<p style="color: var(--gray-500);">Žádné blokované termíny</p>';
    }
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
      alert('Konec období musí být po začátku');
      return;
    }

    // Block each date in the range for each selected room
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Generate a unique blockage ID for this range
    const blockageId = dataManager.generateBlockageId();

    if (selectedRooms.length === 0) {
      // Block all rooms for this date range with same blockage ID
      const endTime = end.getTime();
      for (let d = new Date(start); d.getTime() <= endTime; d.setDate(d.getDate() + 1)) {
        await dataManager.blockDate(new Date(d), null, reason, blockageId);
      }
    } else {
      // Block specific rooms for this date range
      const endTime = end.getTime();
      for (const roomId of selectedRooms) {
        for (let d = new Date(start); d.getTime() <= endTime; d.setDate(d.getDate() + 1)) {
          await dataManager.blockDate(new Date(d), roomId, reason, blockageId);
        }
      }
    }

    e.target.reset();
    document.getElementById('blockAll').checked = false;
    await this.loadBlockedDates();

    const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const roomsText =
      selectedRooms.length > 0 ? `${selectedRooms.length} pokojů` : 'všechny pokoje';
    this.showSuccessMessage(`Blokováno ${daysCount} dní pro ${roomsText}`);
  }

  async unblockDate(date, roomId) {
    await dataManager.unblockDate(new Date(date), roomId || null);
    await this.loadBlockedDates();
    this.showSuccessMessage('Termín byl odblokován');
  }

  async unblockRange(blockageId) {
    // const blockedDates = await dataManager.getBlockedDates(); // Reserved for future use
    const data = await dataManager.getData();

    // Remove all dates with this blockage ID
    if (blockageId.startsWith('BLK')) {
      // Remove by blockage ID
      data.blockedDates = data.blockedDates.filter((bd) => bd.blockageId !== blockageId);
    } else {
      // Fallback for old entries without blockage ID
      data.blockedDates = data.blockedDates.filter((bd) => bd.date !== blockageId);
    }

    await dataManager.saveData(data);
    await this.loadBlockedDates();
    this.showSuccessMessage('Blokace byla odstraněna');
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
                <button onclick="adminPanel.removeCode('${code}').catch(console.error)">&times;</button>
            `;
      container.appendChild(chip);
    });

    if (codes.length === 0) {
      container.innerHTML = '<p style="color: var(--gray-500);">Žádné přístupové kódy</p>';
    }
  }

  async handleAddCode(e) {
    e.preventDefault();

    try {
      const newCode = document.getElementById('newCode').value.trim();

      if (!newCode) {
        this.showToast('Zadejte platný kód', 'warning');
        return;
      }

      const settings = await dataManager.getSettings();

      if (!settings.christmasAccessCodes) {
        settings.christmasAccessCodes = [];
      }

      if (settings.christmasAccessCodes.includes(newCode)) {
        this.showToast('Tento kód již existuje', 'warning');
        return;
      }

      settings.christmasAccessCodes.push(newCode);
      await dataManager.updateSettings(settings);

      // Synchronizuj s serverem pro jistotu
      await dataManager.syncWithServer();

      e.target.reset();
      await this.loadChristmasCodes();

      this.showToast(`Přístupový kód "${newCode}" byl úspěšně přidán`, 'success');
    } catch (error) {
      console.error('Chyba při přidávání kódu:', error);
      this.showToast(`Chyba při přidávání kódu: ${error.message}`, 'error');
    }
  }

  async removeCode(code) {
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
        this.showToast(`Přístupový kód "${code}" byl úspěšně odebrán`, 'success');
      } else {
        this.showToast('Kód nebyl nalezen nebo už byl odstraněn', 'warning');
      }
    } catch (error) {
      console.error('Chyba při odstraňování kódu:', error);
      this.showToast(`Chyba při odstraňování kódu: ${error.message}`, 'error');
    }
  }

  async loadChristmasPeriods() {
    const settings = await dataManager.getSettings();
    const container = document.getElementById('christmasPeriodsContainer');

    // Convert old single period format to new array format
    if (settings.christmasPeriod && !settings.christmasPeriods) {
      settings.christmasPeriods = [settings.christmasPeriod];
      delete settings.christmasPeriod;
      await dataManager.updateSettings(settings);
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
                <button onclick="adminPanel.removeChristmasPeriod(${index}).catch(console.error)"
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

    try {
      const startDate = document.getElementById('christmasStart').value;
      const endDate = document.getElementById('christmasEnd').value;

      if (!startDate || !endDate) {
        this.showToast('Vyplňte začátek a konec období', 'warning');
        return;
      }

      if (new Date(endDate) < new Date(startDate)) {
        this.showToast('Konec období musí být po začátku', 'warning');
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
      const newPeriod = { start: startDate, end: endDate, year };
      const overlapping = settings.christmasPeriods.some((period) => {
        const periodStart = new Date(period.start);
        const periodEnd = new Date(period.end);
        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);

        return newStart <= periodEnd && newEnd >= periodStart;
      });

      if (overlapping) {
        this.showToast('Toto období se překrývá s již existujícím obdobím', 'warning');
        return;
      }

      settings.christmasPeriods.push(newPeriod);
      await dataManager.updateSettings(settings);
      await dataManager.syncWithServer();

      // Clear form
      e.target.reset();

      await this.loadChristmasPeriods();
      this.showToast(`Vánoční období ${year} bylo přidáno`, 'success');
    } catch (error) {
      console.error('Chyba při přidávání vánočního období:', error);
      this.showToast(`Chyba při přidávání vánočního období: ${error.message}`, 'error');
    }
  }

  async removeChristmasPeriod(index) {
    try {
      const settings = await dataManager.getSettings();

      if (!settings.christmasPeriods || !settings.christmasPeriods[index]) {
        this.showToast('Vánoční období nebylo nalezeno', 'warning');
        return;
      }

      const period = settings.christmasPeriods[index];
      const startDate = new Date(period.start).toLocaleDateString('cs-CZ');
      const endDate = new Date(period.end).toLocaleDateString('cs-CZ');
      const year = period.year || new Date(period.start).getFullYear();

      if (!confirm(`Opravdu chcete odstranit vánoční období ${year}?\n${startDate} - ${endDate}`)) {
        return;
      }

      // Remove the period at the specified index
      settings.christmasPeriods.splice(index, 1);

      await dataManager.updateSettings(settings);
      await dataManager.syncWithServer();
      await this.loadChristmasPeriods();

      this.showToast(`Vánoční období ${year} bylo odstraněno`, 'success');
    } catch (error) {
      console.error('Chyba při odstraňování vánočního období:', error);
      this.showToast(`Chyba při odstraňování vánočního období: ${error.message}`, 'error');
    }
  }

  async loadRoomConfig() {
    const settings = await dataManager.getSettings();
    const data = await dataManager.getData();
    const rooms = settings.rooms || data.rooms;

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

    const roomIds = ['12', '13', '14', '22', '23', '24', '42', '43', '44'];
    const newRooms = [];

    roomIds.forEach((id) => {
      const beds = parseInt(document.getElementById(`room${id}_beds`).value, 10);
      newRooms.push({
        id,
        name: `Pokoj ${id}`,
        beds,
      });
    });

    // Update settings
    const settings = await dataManager.getSettings();
    settings.rooms = newRooms;
    await dataManager.updateSettings(settings);

    // Update data storage
    const data = await dataManager.getData();
    data.rooms = newRooms;
    await dataManager.saveData(data);

    this.showSuccessMessage('Konfigurace pokojů byla uložena');

    // Refresh the main app if it's loaded
    if (window.bookingApp) {
      window.bookingApp.renderCalendar();
      window.bookingApp.updateRoomSelection();
    }
  }

  async loadPriceConfig() {
    const settings = await dataManager.getSettings();
    const defaultPrices = {
      utia: { base: 300, adult: 50, child: 25 },
      external: { base: 500, adult: 100, child: 50 },
    };
    const prices = settings.prices || defaultPrices;

    // Handle both old structure (small/large) and new structure (direct base/adult/child)
    let utiaPrice;
    let externalPrice;

    if (prices.utia && prices.utia.small) {
      // Old structure - use small room prices as base
      utiaPrice = prices.utia.small;
      externalPrice = prices.external.small;
    } else {
      // New structure
      utiaPrice = prices.utia || defaultPrices.utia;
      externalPrice = prices.external || defaultPrices.external;
    }

    // Load UTIA prices with fallbacks
    const utiaBaseEl = document.getElementById('utia_base');
    const utiaAdultEl = document.getElementById('utia_adult');
    const utiaChildEl = document.getElementById('utia_child');

    if (utiaBaseEl) {
      utiaBaseEl.value = utiaPrice.base || defaultPrices.utia.base;
    }
    if (utiaAdultEl) {
      utiaAdultEl.value = utiaPrice.adult || defaultPrices.utia.adult;
    }
    if (utiaChildEl) {
      utiaChildEl.value = utiaPrice.child || defaultPrices.utia.child;
    }

    // Load external prices with fallbacks
    const externalBaseEl = document.getElementById('external_base');
    const externalAdultEl = document.getElementById('external_adult');
    const externalChildEl = document.getElementById('external_child');

    if (externalBaseEl) {
      externalBaseEl.value = externalPrice.base || defaultPrices.external.base;
    }
    if (externalAdultEl) {
      externalAdultEl.value = externalPrice.adult || defaultPrices.external.adult;
    }
    if (externalChildEl) {
      externalChildEl.value = externalPrice.child || defaultPrices.external.child;
    }
  }

  async handlePriceConfig(e) {
    e.preventDefault();

    const prices = {
      utia: {
        base: parseInt(document.getElementById('utia_base').value, 10),
        adult: parseInt(document.getElementById('utia_adult').value, 10),
        child: parseInt(document.getElementById('utia_child').value, 10),
      },
      external: {
        base: parseInt(document.getElementById('external_base').value, 10),
        adult: parseInt(document.getElementById('external_adult').value, 10),
        child: parseInt(document.getElementById('external_child').value, 10),
      },
    };

    const settings = await dataManager.getSettings();
    settings.prices = prices;
    await dataManager.updateSettings(settings);

    this.showSuccessMessage('Ceník byl uložen');

    // Refresh price calculations if booking app is loaded
    if (window.bookingApp) {
      window.bookingApp.updatePriceCalculation();
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

    this.showSuccessMessage('Ceník hromadné rezervace byl uložen');

    // Refresh bulk booking price calculations if booking app is loaded
    if (window.bookingApp && window.bookingApp.updateBulkPriceCalculation) {
      window.bookingApp.updateBulkPriceCalculation();
    }
  }

  async handleChangePassword(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // First verify current password
    const isAuthenticated = await dataManager.authenticateAdmin(currentPassword);
    if (!isAuthenticated) {
      alert('Nesprávné současné heslo');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Nová hesla se neshodují');
      return;
    }

    if (newPassword.length < 8) {
      alert('Nové heslo musí mít alespoň 8 znaků');
      return;
    }

    // Use the new API endpoint to update password
    try {
      const apiKey = dataManager.getApiKey();
      const response = await fetch('/api/admin/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        e.target.reset();
        this.showSuccessMessage('Heslo bylo úspěšně změněno');
      } else {
        const error = await response.json();
        alert(`Chyba při změně hesla: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating password:', error);
      alert('Nepodařilo se změnit heslo');
    }
  }

  async loadStatistics() {
    const bookings = await dataManager.getAllBookings();
    const container = document.getElementById('statistics');

    const stats = {
      total: bookings.length,
      thisMonth: 0,
      totalRevenue: 0,
      averagePrice: 0,
      occupancyRate: 0,
    };

    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    bookings.forEach((booking) => {
      const bookingDate = new Date(booking.startDate);
      if (bookingDate.getMonth() === thisMonth && bookingDate.getFullYear() === thisYear) {
        stats.thisMonth++;
      }
      stats.totalRevenue += booking.totalPrice;
    });

    stats.averagePrice = bookings.length > 0 ? Math.round(stats.totalRevenue / bookings.length) : 0;

    // Calculate occupancy rate for the current month
    const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
    const totalRoomDays = daysInMonth * 9; // 9 rooms
    let bookedRoomDays = 0;

    bookings.forEach((booking) => {
      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);

      if (start.getMonth() === thisMonth && start.getFullYear() === thisYear) {
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        bookedRoomDays += days * booking.rooms.length;
      }
    });

    stats.occupancyRate = Math.round((bookedRoomDays / totalRoomDays) * 100);

    container.innerHTML = `
            <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 2rem; font-weight: 700; color: var(--primary-color);">${stats.total}</div>
                <div style="color: var(--gray-600);">Celkem rezervací</div>
            </div>
            <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 2rem; font-weight: 700; color: var(--success-color);">${stats.thisMonth}</div>
                <div style="color: var(--gray-600);">Tento měsíc</div>
            </div>
            <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 2rem; font-weight: 700; color: var(--primary-color);">${stats.totalRevenue} Kč</div>
                <div style="color: var(--gray-600);">Celkové příjmy</div>
            </div>
            <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 2rem; font-weight: 700; color: var(--warning-color);">${stats.averagePrice} Kč</div>
                <div style="color: var(--gray-600);">Průměrná cena</div>
            </div>
            <div style="padding: 1rem; background: var(--gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 2rem; font-weight: 700; color: var(--secondary-color);">${stats.occupancyRate}%</div>
                <div style="color: var(--gray-600);">Obsazenost tento měsíc</div>
            </div>
        `;
  }

  async loadEmailTemplate() {
    const settings = await dataManager.getSettings();
    const emailSettings = settings.emailTemplate || {};

    // Load email template settings
    document.getElementById('emailSubject').value =
      emailSettings.subject || 'Potvrzení rezervace - Chata Mariánská';
    document.getElementById('emailTemplate').value =
      emailSettings.template || document.getElementById('emailTemplate').value;
  }

  async handleEmailTemplate(e) {
    e.preventDefault();

    const settings = await dataManager.getSettings();
    settings.emailTemplate = {
      subject: document.getElementById('emailSubject').value,
      template: document.getElementById('emailTemplate').value,
    };

    await dataManager.updateSettings(settings);
    this.showSuccessMessage('Šablona emailu byla uložena');
  }

  showToast(message, type = 'success') {
    // Vytvoř kontejner pro toasty pokud neexistuje
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    // Vytvoř toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} toast-enter`;

    // Ikona podle typu
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close">×</button>
        `;

    // Přidej toast do kontejneru
    toastContainer.appendChild(toast);

    // Animace vstupu
    setTimeout(() => {
      toast.classList.remove('toast-enter');
      toast.classList.add('toast-show');
    }, 10);

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.removeToast(toast);
    });

    // Automatické odstranění po 5 sekundách
    setTimeout(() => {
      this.removeToast(toast);
    }, 5000);
  }

  removeToast(toast) {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-exit');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }

  // Wrapper pro zpětnou kompatibilitu
  showSuccessMessage(message) {
    this.showToast(message, 'success');
  }

  showErrorMessage(message) {
    this.showToast(message, 'error');
  }

  showWarningMessage(message) {
    this.showToast(message, 'warning');
  }

  showInfoMessage(message) {
    this.showToast(message, 'info');
  }
}

// Initialize admin panel
const adminPanel = new AdminPanel();
