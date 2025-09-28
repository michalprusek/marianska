// Main BookingApp class - orchestrates all modules
class BookingApp {
  constructor() {
    // Initialize state
    this.currentMonth = new Date();
    this.selectedDates = new Set();
    this.selectedRooms = new Set();
    this.roomGuests = new Map();
    this.roomGuestTypes = new Map();
    this.currentLanguage = localStorage.getItem('language') || 'cs';
    this.recentlyBookedRooms = [];

    // Calendar boundaries
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);
    this.minYear = this.today.getFullYear();
    this.maxYear = this.minYear + 1;
    this.maxMonth = this.today.getMonth();

    // Single room booking state
    this.currentBookingRoom = null;
    this.firstSelectedDate = null;
    this.isDragging = false;
    this.dragStartDate = null;
    this.dragEndDate = null;
    this.dragClickStart = null;

    // Initialize modules
    this.calendar = new CalendarModule(this);
    this.singleRoomBooking = new SingleRoomBookingModule(this);
    this.bulkBooking = new BulkBookingModule(this);
    this.bookingForm = new BookingFormModule(this);
    this.utils = new UtilsModule(this);
  }

  async init() {
    // Initialize data storage
    await dataManager.initData();

    // Setup event listeners
    this.setupEventListeners();

    // Initial render
    await this.renderCalendar();
    this.updateTranslations();

    // Setup global mouse up handler for drag selection
    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.dragStartDate = null;
        this.dragEndDate = null;
      }
    });
  }

  setupEventListeners() {
    // Navigation buttons
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.calendar.navigateMonth(-1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.calendar.navigateMonth(1));
    }

    // Legend toggle
    const legendToggle = document.getElementById('legendToggle');
    if (legendToggle) {
      legendToggle.addEventListener('click', () => this.calendar.toggleLegend());
    }

    // Booking button
    const bookingBtn = document.getElementById('makeBookingBtn');
    if (bookingBtn) {
      bookingBtn.addEventListener('click', () => this.showBookingModal());
    }

    // Bulk booking button (bulkActionBtn is the actual ID)
    const bulkBtn = document.getElementById('bulkActionBtn');
    if (bulkBtn) {
      bulkBtn.addEventListener('click', () => {
        try {
          this.bulkBooking.showBulkBookingModal();
        } catch (error) {
          console.error('Error showing bulk booking modal:', error);
        }
      });
    } else {
      console.error('Bulk booking button not found');
    }

    // Room info button
    const roomInfoBtn = document.getElementById('roomInfoBtn');
    if (roomInfoBtn) {
      roomInfoBtn.addEventListener('click', async () => {
        await this.loadRoomInfo();
        document.getElementById('roomInfoModal').classList.add('active');
      });
    }

    // Admin button
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        window.location.href = '/admin.html';
      });
    }

    // Language switcher
    const languageSwitch = document.getElementById('languageSwitch');
    if (languageSwitch) {
      languageSwitch.addEventListener('change', (e) => {
        const lang = e.target.checked ? 'en' : 'cs';
        this.utils.changeLanguage(lang);
      });
      // Set initial state
      languageSwitch.checked = this.currentLanguage === 'en';
    }

    // Single room booking modal events
    this.setupSingleRoomBookingEvents();

    // Bulk booking modal events
    this.setupBulkBookingEvents();

    // Main booking modal events
    this.setupMainBookingEvents();
  }

  setupSingleRoomBookingEvents() {
    // Mini calendar navigation
    const prevMini = document.getElementById('prevMiniMonth');
    const nextMini = document.getElementById('nextMiniMonth');

    if (prevMini) {
      prevMini.addEventListener('click', () => this.singleRoomBooking.navigateMiniCalendar(-1));
    }
    if (nextMini) {
      nextMini.addEventListener('click', () => this.singleRoomBooking.navigateMiniCalendar(1));
    }

    // Guest type change for booking form
    const guestTypeSelect = document.getElementById('bookingGuestType');
    if (guestTypeSelect) {
      guestTypeSelect.addEventListener('change', async () => {
        if (this.currentBookingRoom) {
          this.roomGuestTypes.set(this.currentBookingRoom, guestTypeSelect.value);
          await this.updatePriceCalculation();
        }
      });
    }

    // Guest type change for single room booking modal
    const singleRoomGuestRadios = document.querySelectorAll('input[name="singleRoomGuestType"]');
    singleRoomGuestRadios.forEach((radio) => {
      radio.addEventListener('change', async () => {
        if (this.currentBookingRoom) {
          this.roomGuestTypes.set(this.currentBookingRoom, radio.value);
          await this.updatePriceCalculation();
        }
      });
    });

    // Guest count controls
    ['adults', 'children', 'toddlers'].forEach((type) => {
      const decreaseBtn = document.querySelector(`[data-action="decrease-${type}"]`);
      const increaseBtn = document.querySelector(`[data-action="increase-${type}"]`);

      if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => this.adjustGuests(type, -1));
      }
      if (increaseBtn) {
        increaseBtn.addEventListener('click', () => this.adjustGuests(type, 1));
      }
    });

    // Confirm and submit buttons
    const confirmDatesBtn = document.getElementById('confirmRoomDates');
    if (confirmDatesBtn) {
      confirmDatesBtn.addEventListener('click', () => this.bookingForm.showBookingForm());
    }

    const submitBtn = document.getElementById('submitRoomBooking');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.bookingForm.submitBooking());
    }

    // Back button
    const backBtn = document.getElementById('backToDateSelection');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.bookingForm.hideBookingForm());
    }

    // Form validation
    this.setupFormValidation();
  }

  setupBulkBookingEvents() {
    // Calendar navigation
    const prevBulk = document.getElementById('prevBulkMonth');
    const nextBulk = document.getElementById('nextBulkMonth');

    if (prevBulk) {
      prevBulk.addEventListener('click', () => this.bulkBooking.navigateBulkCalendar(-1));
    }
    if (nextBulk) {
      nextBulk.addEventListener('click', () => this.bulkBooking.navigateBulkCalendar(1));
    }

    // Guest count controls
    ['adults', 'children', 'toddlers'].forEach((type) => {
      const input = document.getElementById(`bulk${type.charAt(0).toUpperCase() + type.slice(1)}`);
      if (input) {
        input.addEventListener('change', () => {
          this.bulkBooking.updateBulkCapacityCheck();
          this.bulkBooking.updateBulkPriceCalculation();
        });
      }
    });

    // Confirm and submit buttons
    const confirmBtn = document.getElementById('confirmBulkDates');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.bulkBooking.confirmBulkDates());
    }

    const submitBtn = document.getElementById('submitBulkBooking');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.bulkBooking.submitBulkBooking());
    }

    // Back button
    const backBtn = document.getElementById('backToBulkDateSelection');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.bulkBooking.backToBulkDateSelection());
    }
  }

  setupMainBookingEvents() {
    // This would handle the main booking modal if implemented
  }

  setupFormValidation() {
    // Phone validation
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach((input) => {
      input.addEventListener('input', () => this.bookingForm.validatePhoneNumber(input));
    });

    // ZIP code validation
    const zipInput = document.getElementById('bookingZip');
    if (zipInput) {
      zipInput.addEventListener('input', () => this.bookingForm.validateZipCode(zipInput));
    }

    // ICO validation
    const icoInput = document.getElementById('bookingICO');
    if (icoInput) {
      icoInput.addEventListener('input', () => this.bookingForm.validateICO(icoInput));
    }

    // DIC validation
    const dicInput = document.getElementById('bookingDIC');
    if (dicInput) {
      dicInput.addEventListener('input', () => this.bookingForm.validateDIC(dicInput));
    }
  }

  // Guest adjustment
  async adjustGuests(type, change) {
    if (!this.currentBookingRoom) {
      return;
    }

    const guests = this.roomGuests.get(this.currentBookingRoom) || {
      adults: 1,
      children: 0,
      toddlers: 0,
    };

    // Calculate new value
    const newValue = guests[type] + change;

    // Check minimum values
    if (type === 'adults' && newValue < 1) {
      return; // Must have at least 1 adult
    }
    if (newValue < 0) {
      return; // Can't have negative values
    }

    // Check room capacity (toddlers don't count towards capacity)
    const rooms = await dataManager.getRooms();
    const room = rooms.find((r) => r.id === this.currentBookingRoom);
    if (room && type !== 'toddlers') {
      const currentOthers = type === 'adults' ? guests.children : guests.adults;
      const newTotal = newValue + currentOthers;

      if (newTotal > room.beds) {
        this.showNotification(
          this.currentLanguage === 'cs'
            ? `${room.name} má kapacitu pouze ${room.beds} lůžek (batolata se nepočítají)`
            : `${room.name} has capacity of only ${room.beds} beds (toddlers don't count)`,
          'warning'
        );
        return;
      }
    }

    // Update the value
    guests[type] = newValue;
    this.roomGuests.set(this.currentBookingRoom, guests);

    // Update display - check for both single room and general IDs
    const singleRoomEl = document.getElementById(
      `singleRoom${type.charAt(0).toUpperCase() + type.slice(1)}`
    );
    const generalEl = document.getElementById(`${type}Count`);

    if (singleRoomEl) {
      singleRoomEl.textContent = guests[type].toString();
    }
    if (generalEl) {
      generalEl.value = guests[type].toString();
    }

    await this.updatePriceCalculation();
  }

  // Main booking modal
  showBookingModal() {
    if (this.selectedDates.size === 0 || this.selectedRooms.size === 0) {
      this.showNotification(
        this.currentLanguage === 'cs'
          ? 'Vyberte prosím termín a pokoje'
          : 'Please select dates and rooms',
        'warning'
      );
      return;
    }

    const modal = document.getElementById('bookingModal');
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));
  }

  // Delegated methods
  async renderCalendar() {
    await this.calendar.renderCalendar();
    await this.updateBookingButton();
  }

  async toggleRoomSelection(date, roomId, element) {
    // Open single room booking modal instead of the old selection
    await this.showRoomBookingModal(roomId);
  }

  // Check if date is in selected range
  isDateInSelectedRange(dateStr) {
    if (!this.firstSelectedDate || !this.dragEndDate) {
      return this.firstSelectedDate === dateStr;
    }

    const date = new Date(dateStr);
    const startDate = new Date(
      Math.min(new Date(this.firstSelectedDate), new Date(this.dragEndDate))
    );
    const endDate = new Date(
      Math.max(new Date(this.firstSelectedDate), new Date(this.dragEndDate))
    );

    return date >= startDate && date <= endDate;
  }

  async showBookingDetails(date, roomId) {
    try {
      await this.utils.showBookingDetails(date, roomId);
    } catch (error) {
      console.error('Error showing booking details:', error);
      this.showNotification(
        this.currentLanguage === 'cs'
          ? 'Chyba při načítání detailu rezervace'
          : 'Error loading booking details',
        'error'
      );
    }
  }

  showBlockedReason(availability) {
    this.utils.showBlockedReason(availability);
  }

  async showBlockedDetails(date, roomId) {
    try {
      const blockedDetails = await dataManager.getBlockedDateDetails(date, roomId);

      if (blockedDetails) {
        this.utils.showBlockedReason(blockedDetails);
      } else {
        // Fallback if no details found
        const fallbackDetails = {
          reason:
            this.currentLanguage === 'cs'
              ? 'Tento termín je administrativně blokován'
              : 'This date is administratively blocked',
        };
        this.utils.showBlockedReason(fallbackDetails);
      }
    } catch (error) {
      console.error('Error showing blocked details:', error);
      this.showNotification(
        this.currentLanguage === 'cs'
          ? 'Chyba při načítání detailu blokace'
          : 'Error loading blocked details',
        'error'
      );
    }
  }

  showNotification(message, type, duration) {
    this.utils.showNotification(message, type, duration);
  }

  updateBookingButton() {
    return this.utils.updateBookingButton();
  }

  updateSelectedDatesDisplay() {
    return this.utils.updateSelectedDatesDisplay();
  }

  updatePriceCalculation() {
    return this.utils.updatePriceCalculation();
  }

  updateTranslations() {
    this.utils.updateTranslations();
  }

  formatDateDisplay(date) {
    return this.utils.formatDateDisplay(date);
  }

  getDateRanges(dates) {
    return this.utils.getDateRanges(dates);
  }

  showRoomBookingModal(roomId) {
    this.singleRoomBooking.showRoomBookingModal(roomId);
  }

  // Load room information for the modal
  async loadRoomInfo() {
    const rooms = await dataManager.getRooms();
    const settings = await dataManager.getSettings();
    const prices = settings.prices || {
      utia: { base: 300, adult: 50, child: 25 },
      external: { base: 500, adult: 100, child: 50 },
    };

    // Update room capacity grid
    const capacityGrid = document.getElementById('roomCapacityGrid');
    if (capacityGrid) {
      capacityGrid.innerHTML = '';
      let totalBeds = 0;

      rooms.forEach((room) => {
        const roomDiv = document.createElement('div');
        roomDiv.style.textAlign = 'center';

        const roomColor = '#28a745';
        const roomBorder = '#1e7e34';

        roomDiv.innerHTML = `
                    <div style="background: white; padding: 0.75rem; border-radius: var(--radius-lg); box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
                        <span style="display: block; background: ${roomColor}; color: white; padding: 0.75rem; border: 2px solid ${roomBorder}; border-radius: var(--radius-md); font-size: 1.3rem; font-weight: 700; margin-bottom: 0.5rem; box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3); text-align: center;">${room.id}</span>
                        <span style="font-size: 0.95rem; color: var(--gray-800); display: block; text-align: center; margin-top: 0.5rem;" class="room-beds" data-beds="${room.beds}">${room.beds} ${this.currentLanguage === 'cs' ? (room.beds === 1 ? 'lůžko' : room.beds < 5 ? 'lůžka' : 'lůžek') : room.beds === 1 ? 'bed' : 'beds'}</span>
                    </div>
                `;

        capacityGrid.appendChild(roomDiv);
        totalBeds += room.beds;
      });

      // Update total capacity text
      const totalCapacityText = document.getElementById('totalCapacityText');
      if (totalCapacityText) {
        const capacityText =
          this.currentLanguage === 'cs'
            ? `Celková kapacita: ${totalBeds} lůžek`
            : `Total capacity: ${totalBeds} beds`;
        totalCapacityText.textContent = capacityText;
      }
    }

    // Update price list
    const priceListContent = document.getElementById('priceListContent');
    if (priceListContent) {
      priceListContent.innerHTML = `
                <div style="display: grid; gap: 1rem;">
                    <div style="background: var(--info-50); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--info-200);">
                        <h4 style="color: var(--info-800); margin-bottom: 0.5rem;">${this.currentLanguage === 'cs' ? 'Zaměstnanci ÚTIA' : 'ÚTIA Employees'}</h4>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="padding: 0.25rem 0;">Základní cena: <strong>${prices.utia.base} Kč/noc</strong></li>
                            <li style="padding: 0.25rem 0;">Příplatek za dospělého: <strong>${prices.utia.adult} Kč</strong></li>
                            <li style="padding: 0.25rem 0;">Příplatek za dítě: <strong>${prices.utia.child} Kč</strong></li>
                            <li style="padding: 0.25rem 0; color: var(--success-600);"><strong>Děti do 3 let zdarma</strong></li>
                        </ul>
                    </div>

                    <div style="background: var(--warning-50); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--warning-200);">
                        <h4 style="color: var(--warning-800); margin-bottom: 0.5rem;">${this.currentLanguage === 'cs' ? 'Externí hosté' : 'External Guests'}</h4>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="padding: 0.25rem 0;">Základní cena: <strong>${prices.external.base} Kč/noc</strong></li>
                            <li style="padding: 0.25rem 0;">Příplatek za dospělého: <strong>${prices.external.adult} Kč</strong></li>
                            <li style="padding: 0.25rem 0;">Příplatek za dítě: <strong>${prices.external.child} Kč</strong></li>
                            <li style="padding: 0.25rem 0; color: var(--success-600);"><strong>Děti do 3 let zdarma</strong></li>
                        </ul>
                    </div>
                </div>
            `;
    }

    // Update bulk booking price list
    const bulkPriceListContent = document.getElementById('bulkPriceListContent');
    if (bulkPriceListContent) {
      // Load bulk prices from admin settings
      const bulkPricesSettings = settings.bulkPrices || {
        basePrice: 2000,
        utiaAdult: 100,
        utiaChild: 0,
        externalAdult: 250,
        externalChild: 50,
      };

      bulkPriceListContent.innerHTML = `
                <div style="display: grid; gap: 1rem;">
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(59, 130, 246, 0.3);">
                        <h4 style="color: #1e40af; margin-bottom: 0.5rem; display: flex; align-items: center;">
                            <span style="margin-right: 0.5rem;">🏢</span>
                            ${this.currentLanguage === 'cs' ? 'Zaměstnanci ÚTIA' : 'ÚTIA Employees'}
                        </h4>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="padding: 0.25rem 0;">Základní cena za celou chatu: <strong>${bulkPricesSettings.basePrice.toLocaleString('cs-CZ')} Kč/noc</strong></li>
                            <li style="padding: 0.25rem 0;">Příplatek za dospělého: <strong>${bulkPricesSettings.utiaAdult} Kč</strong></li>
                            <li style="padding: 0.25rem 0;">Příplatek za dítě (3-18 let): <strong>${bulkPricesSettings.utiaChild} Kč</strong></li>
                            <li style="padding: 0.25rem 0; color: var(--success-600);"><strong>Děti do 3 let zdarma</strong></li>
                        </ul>
                    </div>

                    <div style="background: rgba(245, 158, 11, 0.1); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(245, 158, 11, 0.3);">
                        <h4 style="color: #b45309; margin-bottom: 0.5rem; display: flex; align-items: center;">
                            <span style="margin-right: 0.5rem;">👥</span>
                            ${this.currentLanguage === 'cs' ? 'Externí hosté' : 'External Guests'}
                        </h4>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="padding: 0.25rem 0;">Základní cena za celou chatu: <strong>${bulkPricesSettings.basePrice.toLocaleString('cs-CZ')} Kč/noc</strong></li>
                            <li style="padding: 0.25rem 0;">Příplatek za dospělého: <strong>${bulkPricesSettings.externalAdult} Kč</strong></li>
                            <li style="padding: 0.25rem 0;">Příplatek za dítě (3-18 let): <strong>${bulkPricesSettings.externalChild} Kč</strong></li>
                            <li style="padding: 0.25rem 0; color: var(--success-600);"><strong>Děti do 3 let zdarma</strong></li>
                        </ul>
                    </div>
                </div>
            `;
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new BookingApp();
  window.app.init();
});
