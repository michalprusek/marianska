// Main application logic
class BookingApp {
    constructor() {
        this.selectedDates = new Set();
        this.selectedRooms = new Map(); // Map of date -> Set of room IDs
        this.roomGuests = new Map(); // Map of roomId -> {adults, children, toddlers}
        this.roomGuestTypes = new Map(); // Map of roomId -> 'utia' or 'external'
        this.currentMonth = new Date();
        this.today = new Date();
        this.today.setHours(0, 0, 0, 0);
        this.updateYearRange();
        this.init();
    }

    // Update year range based on current date
    updateYearRange() {
        const currentYear = new Date().getFullYear();
        this.minYear = currentYear - 1; // Previous year
        this.currentYear = currentYear;
        this.maxYear = currentYear + 1; // Next year
        this.maxMonth = 11; // December (0-indexed)
    }

    // Helper function to create styled room badges
    async createRoomBadge(roomId, inline = false) {
        const rooms = await dataManager.getRooms();
        const room = rooms.find(r => r.id === roomId);
        const isLarge = room && room.type === 'large';

        return `<span style="
            display: ${inline ? 'inline-block' : 'inline-block'};
            margin: ${inline ? '0 0.25rem' : '0.25rem'};
            padding: 0.4rem 0.7rem;
            background: ${isLarge ? '#28a745' : '#007bff'};
            color: white;
            border: 2px solid ${isLarge ? '#1e7e34' : '#0056b3'};
            border-radius: 6px;
            font-weight: 700;
            font-size: 0.95rem;
            box-shadow: 0 2px 4px ${isLarge ? 'rgba(40, 167, 69, 0.3)' : 'rgba(0, 123, 255, 0.3)'};
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        ">${roomId}</span>`;
    }

    async init() {
        await dataManager.initData();
        this.setupEventListeners();
        await this.renderCalendar();
        await this.updateSelectedDatesDisplay();
        await this.updatePriceCalculation();
    }

    setupEventListeners() {
        // Language switch
        document.getElementById('languageSwitch').addEventListener('change', async (e) => {
            const lang = e.target.checked ? 'en' : 'cs';
            langManager.switchLanguage(lang);
            await this.renderCalendar();
            await this.updateSelectedDatesDisplay();
        });

        // Navigation
        document.getElementById('prevMonth').addEventListener('click', async () => await this.navigateMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', async () => await this.navigateMonth(1));

        // Note: Guest type and counts are now handled per room in the room cards

        // Create booking button
        document.getElementById('createBookingBtn').addEventListener('click', async () => await this.openBookingModal());

        // Booking form
        document.getElementById('bookingForm').addEventListener('submit', async (e) => await this.handleBookingSubmit(e));

        // Room info button
        document.getElementById('roomInfoBtn').addEventListener('click', async () => {
            await this.loadRoomInfo();
            document.getElementById('roomInfoModal').classList.add('active');
        });

        // Admin button
        document.getElementById('adminBtn').addEventListener('click', () => {
            window.location.href = 'admin.html';
        });

        // Bulk booking button
        document.getElementById('bulkActionBtn').addEventListener('click', async () => {
            await this.openBulkBookingModal();
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('active');
            });
        });

        // Contact form
        document.getElementById('contactForm').addEventListener('submit', async (e) => await this.handleContactSubmit(e));
        document.getElementById('contactOwner').addEventListener('click', () => {
            document.getElementById('contactModal').classList.add('active');
        });

        // Initialize real-time form validation
        this.initRealtimeValidation();
    }

    initRealtimeValidation() {
        // Name validation
        const nameInput = document.getElementById('name');
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const value = nameInput.value.trim();
                if (value.length >= 3) {
                    this.setFieldValid(nameInput);
                } else if (value.length > 0) {
                    this.setFieldInvalid(nameInput, langManager.currentLang === 'cs' ?
                        'Jméno musí mít alespoň 3 znaky' : 'Name must be at least 3 characters');
                } else {
                    this.clearFieldValidation(nameInput);
                }
            });
        }

        // Email validation
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.addEventListener('input', () => {
                const value = emailInput.value.trim();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (emailRegex.test(value)) {
                    this.setFieldValid(emailInput);
                } else if (value.length > 0) {
                    this.setFieldInvalid(emailInput, langManager.currentLang === 'cs' ?
                        'Neplatný formát emailu' : 'Invalid email format');
                } else {
                    this.clearFieldValidation(emailInput);
                }
            });
        }

        // Phone validation
        const phoneInput = document.getElementById('phone');
        const phonePrefixSelect = document.getElementById('phonePrefix');
        if (phoneInput && phonePrefixSelect) {
            const validatePhone = () => {
                const value = phoneInput.value.trim().replace(/\s/g, '');
                const prefix = phonePrefixSelect.value;

                if (value.length === 0) {
                    this.clearFieldValidation(phoneInput);
                    return;
                }

                if ((prefix === '+420' || prefix === '+421') && value.length === 9 && /^\d{9}$/.test(value)) {
                    this.setFieldValid(phoneInput);
                } else if ((prefix === '+420' || prefix === '+421') && value.length > 0) {
                    this.setFieldInvalid(phoneInput, langManager.currentLang === 'cs' ?
                        'Telefon musí mít přesně 9 číslic' : 'Phone must have exactly 9 digits');
                } else if (value.length >= 7 && value.length <= 15 && /^\d+$/.test(value)) {
                    this.setFieldValid(phoneInput);
                } else if (value.length > 0) {
                    this.setFieldInvalid(phoneInput, langManager.currentLang === 'cs' ?
                        'Pouze číslice jsou povoleny' : 'Only digits are allowed');
                }
            };

            phoneInput.addEventListener('input', validatePhone);
            phonePrefixSelect.addEventListener('change', validatePhone);
        }

        // ZIP code validation
        const zipInput = document.getElementById('zip');
        if (zipInput) {
            zipInput.addEventListener('input', () => {
                const value = zipInput.value.trim().replace(/\s/g, '');
                if (/^\d{5}$/.test(value)) {
                    this.setFieldValid(zipInput);
                } else if (value.length > 0) {
                    this.setFieldInvalid(zipInput, langManager.currentLang === 'cs' ?
                        'PSČ musí mít 5 číslic' : 'ZIP must have 5 digits');
                } else {
                    this.clearFieldValidation(zipInput);
                }
            });
        }

        // Address validation
        const addressInput = document.getElementById('address');
        if (addressInput) {
            addressInput.addEventListener('input', () => {
                const value = addressInput.value.trim();
                if (value.length >= 5) {
                    this.setFieldValid(addressInput);
                } else if (value.length > 0) {
                    this.setFieldInvalid(addressInput, langManager.currentLang === 'cs' ?
                        'Adresa je příliš krátká' : 'Address is too short');
                } else {
                    this.clearFieldValidation(addressInput);
                }
            });
        }

        // City validation
        const cityInput = document.getElementById('city');
        if (cityInput) {
            cityInput.addEventListener('input', () => {
                const value = cityInput.value.trim();
                if (value.length >= 2) {
                    this.setFieldValid(cityInput);
                } else if (value.length > 0) {
                    this.setFieldInvalid(cityInput, langManager.currentLang === 'cs' ?
                        'Název města je příliš krátký' : 'City name is too short');
                } else {
                    this.clearFieldValidation(cityInput);
                }
            });
        }

        // IČO validation (optional field)
        const icoInput = document.getElementById('ico');
        if (icoInput) {
            icoInput.addEventListener('input', () => {
                const value = icoInput.value.trim();
                if (value.length === 0) {
                    this.clearFieldValidation(icoInput);
                } else if (/^\d{8}$/.test(value)) {
                    this.setFieldValid(icoInput);
                } else {
                    this.setFieldInvalid(icoInput, langManager.currentLang === 'cs' ?
                        'IČO musí mít 8 číslic' : 'Company ID must have 8 digits');
                }
            });
        }

        // DIČ validation (optional field)
        const dicInput = document.getElementById('dic');
        if (dicInput) {
            dicInput.addEventListener('input', () => {
                const value = dicInput.value.trim().toUpperCase();
                if (value.length === 0) {
                    this.clearFieldValidation(dicInput);
                } else if (/^CZ\d{8,10}$/.test(value)) {
                    this.setFieldValid(dicInput);
                } else {
                    this.setFieldInvalid(dicInput, langManager.currentLang === 'cs' ?
                        'DIČ musí být ve formátu CZ12345678' : 'VAT ID must be in format CZ12345678');
                }
            });
        }
    }

    setFieldValid(input) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        const message = input.parentElement.querySelector('.validation-message');
        if (message) {
            message.classList.remove('error');
            message.style.display = 'none';
        }
    }

    setFieldInvalid(input, errorMessage) {
        input.classList.remove('valid');
        input.classList.add('invalid');
        let message = input.parentElement.querySelector('.validation-message');
        if (!message) {
            message = document.createElement('div');
            message.className = 'validation-message';
            input.parentElement.appendChild(message);
        }
        message.textContent = errorMessage;
        message.classList.add('error');
        message.style.display = 'block';
    }

    clearFieldValidation(input) {
        input.classList.remove('valid', 'invalid');
        const message = input.parentElement.querySelector('.validation-message');
        if (message) {
            message.style.display = 'none';
        }
    }

    async navigateMonth(direction) {
        const newMonth = new Date(this.currentMonth);
        newMonth.setMonth(newMonth.getMonth() + direction);

        // Check if we're within allowed range
        const newYear = newMonth.getFullYear();
        const newMonthNum = newMonth.getMonth();

        // Don't go before January of previous year
        if (newYear < this.minYear) {
            return;
        }

        // Don't go beyond December of next year
        if (newYear > this.maxYear ||
            (newYear === this.maxYear && newMonthNum > this.maxMonth)) {
            return;
        }

        this.currentMonth = newMonth;
        await this.renderCalendar();
    }

    async renderCalendar() {
        // Update year range to ensure it's always current
        this.updateYearRange();

        const calendar = document.getElementById('calendar');
        const monthTitle = document.getElementById('currentMonth');

        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();

        // Update month title
        const monthNames = langManager.t('months');
        monthTitle.textContent = `${monthNames[month]} ${year}`;

        // Update navigation buttons
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        // Disable previous button if at minimum allowed date (January of previous year)
        if (year <= this.minYear && month <= 0) {
            prevBtn.style.opacity = '0.3';
            prevBtn.style.cursor = 'not-allowed';
        } else {
            prevBtn.style.opacity = '1';
            prevBtn.style.cursor = 'pointer';
        }

        // Disable next button if at max month
        if (year === this.maxYear && month >= this.maxMonth) {
            nextBtn.style.opacity = '0.3';
            nextBtn.style.cursor = 'not-allowed';
        } else {
            nextBtn.style.opacity = '1';
            nextBtn.style.cursor = 'pointer';
        }

        // Clear calendar
        calendar.innerHTML = '';

        // Add day headers
        const dayHeaders = langManager.t('weekDays');
        const headerRow = document.createElement('div');
        headerRow.className = 'calendar-week';
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            dayHeader.style.fontWeight = '600';
            dayHeader.style.textAlign = 'center';
            dayHeader.style.padding = '0.5rem';
            dayHeader.style.background = 'var(--gray-100)';
            headerRow.appendChild(dayHeader);
        });
        calendar.appendChild(headerRow);

        // Get first day of month and adjust for Monday start
        const firstDay = new Date(year, month, 1);
        let startDay = firstDay.getDay() - 1; // Convert Sunday=0 to Monday=0
        if (startDay < 0) startDay = 6;

        // Get days in month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // Create calendar grid
        let currentWeek = document.createElement('div');
        currentWeek.className = 'calendar-week';

        // Add previous month days
        for (let i = startDay - 1; i >= 0; i--) {
            const dayEl = await this.createDayElement(
                new Date(year, month - 1, daysInPrevMonth - i),
                true
            );
            currentWeek.appendChild(dayEl);
        }

        // Add current month days
        for (let day = 1; day <= daysInMonth; day++) {
            if (currentWeek.children.length === 7) {
                calendar.appendChild(currentWeek);
                currentWeek = document.createElement('div');
                currentWeek.className = 'calendar-week';
            }

            const dayEl = await this.createDayElement(new Date(year, month, day), false);
            currentWeek.appendChild(dayEl);
        }

        // Add next month days to complete the week
        let nextMonthDay = 1;
        while (currentWeek.children.length < 7) {
            const dayEl = await this.createDayElement(
                new Date(year, month + 1, nextMonthDay),
                true
            );
            currentWeek.appendChild(dayEl);
            nextMonthDay++;
        }
        calendar.appendChild(currentWeek);
    }

    async createDayElement(date, isOtherMonth) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (isOtherMonth) dayEl.classList.add('other-month');

        const dateStr = dataManager.formatDate(date);

        // Check if date is in the past
        const isPast = date < this.today;
        if (isPast) {
            dayEl.classList.add('disabled');
            dayEl.style.opacity = '0.5';
            dayEl.style.cursor = 'not-allowed';
        }

        // Check if this is Christmas period
        const isChristmas = await dataManager.isChristmasPeriod(date);
        if (isChristmas) {
            dayEl.style.background = 'linear-gradient(135deg, #FFF4E6, #E8F5E9)';
            dayEl.style.border = '2px solid var(--warning-color)';
        }

        // Day header
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';

        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = date.getDate();
        dayHeader.appendChild(dayNumber);

        if (isChristmas) {
            const christmasLabel = document.createElement('span');
            christmasLabel.style.fontSize = '0.7rem';
            christmasLabel.style.color = 'var(--danger-color)';
            christmasLabel.textContent = '🎄';
            dayHeader.appendChild(christmasLabel);
        }

        dayEl.appendChild(dayHeader);

        // Room indicators
        const roomsContainer = document.createElement('div');
        roomsContainer.className = 'calendar-day-rooms';

        const rooms = await dataManager.getRooms();
        for (const room of rooms) {
            const roomEl = document.createElement('div');
            roomEl.className = 'room-indicator';
            roomEl.textContent = room.id;

            const availabilityInfo = await dataManager.getRoomAvailability(date, room.id);
            const availability = availabilityInfo.status;
            roomEl.classList.add(availability);

            // Add room type class for color differentiation
            if (room.type === 'large') {
                roomEl.classList.add('room-large');
            } else {
                roomEl.classList.add('room-small');
            }

            // Apply color for booked rooms - always orange
            if (availability === 'booked') {
                roomEl.style.background = '#ff8c00';
                roomEl.style.color = 'white';
            }

            // Check if this room is selected for this date
            const selectedRoomsForDate = this.selectedRooms.get(dateStr);
            if (selectedRoomsForDate && selectedRoomsForDate.has(room.id)) {
                roomEl.classList.add('selected');
            }

            if (availability === 'available' && !isOtherMonth && !isPast) {
                roomEl.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this.toggleRoomSelection(date, room.id, roomEl);
                });
            } else if (availability === 'booked') {
                roomEl.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    console.log('Clicked on booked room:', date, room.id);
                    await this.showBookingDetails(date, room.id);
                });
                roomEl.style.cursor = 'pointer';
                roomEl.title = 'Klikněte pro zobrazení detailu rezervace';
            } else if (availability === 'blocked' && !isPast) {
                roomEl.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this.showBlockedDetails(date, room.id);
                });
            }

            roomEl.title = `${room.name} - ${availability === 'available' ? 'Volný' :
                           availability === 'booked' ? 'Obsazený' : 'Blokovaný'}`;

            roomsContainer.appendChild(roomEl);
        }

        dayEl.appendChild(roomsContainer);

        return dayEl;
    }

    async toggleRoomSelection(date, roomId, element) {
        const dateStr = dataManager.formatDate(date);

        // Ensure date is selected
        this.selectedDates.add(dateStr);

        // Toggle room selection
        if (!this.selectedRooms.has(dateStr)) {
            this.selectedRooms.set(dateStr, new Set());
        }

        const roomsForDate = this.selectedRooms.get(dateStr);
        if (roomsForDate.has(roomId)) {
            // Remove room
            roomsForDate.delete(roomId);
            this.roomGuests.delete(roomId);
            element.classList.remove('selected');
            if (roomsForDate.size === 0) {
                this.selectedRooms.delete(dateStr);
                this.selectedDates.delete(dateStr);
            }
        } else {
            // Add room and initialize guest count
            roomsForDate.add(roomId);
            element.classList.add('selected');
            if (!this.roomGuests.has(roomId)) {
                this.roomGuests.set(roomId, {
                    adults: 1,
                    children: 0,
                    toddlers: 0
                });
            }
        }

        // Don't re-render entire calendar, just update UI
        await this.updateSelectedDatesDisplay();
        await this.updateRoomGuestControls();
        await this.updatePriceCalculation();
    }

    async updateRoomGuestControls() {
        const container = document.getElementById('roomGuestControls');
        if (!container) return;

        container.innerHTML = '';

        // Get all unique selected rooms
        const allSelectedRooms = new Set();
        this.selectedRooms.forEach(roomsSet => {
            roomsSet.forEach(roomId => allSelectedRooms.add(roomId));
        });

        if (allSelectedRooms.size === 0) {
            return;
        }

        // Get room data for capacity info
        const rooms = await dataManager.getRooms();
        const roomsMap = new Map(rooms.map(r => [r.id, r]));

        // Create individual cards for each selected room
        const cardsContainer = document.createElement('div');
        cardsContainer.style.cssText = 'display: grid; gap: 1rem; margin-bottom: 1.5rem;';

        allSelectedRooms.forEach(roomId => {
            const room = roomsMap.get(roomId);
            if (!room) return;

            // Initialize with 1 adult if not set
            if (!this.roomGuests.has(roomId)) {
                this.roomGuests.set(roomId, {adults: 1, children: 0, toddlers: 0});
            }

            const guests = this.roomGuests.get(roomId);
            const guestType = this.roomGuestTypes.get(roomId) || 'utia';

            const roomCard = document.createElement('div');
            roomCard.className = 'room-guest-card';
            roomCard.style.cssText = `
                background: linear-gradient(135deg, var(--white), var(--gray-50));
                border: 2px solid ${room.type === 'large' ? 'var(--success-200)' : 'var(--info-200)'};
                border-radius: var(--radius-lg);
                padding: 1.5rem;
                box-shadow: var(--elevation-2);
                position: relative;
                overflow: hidden;
                transition: all 0.3s ease;
            `;

            // Add hover effect
            roomCard.onmouseover = () => {
                roomCard.style.transform = 'translateY(-2px)';
                roomCard.style.boxShadow = 'var(--elevation-3)';
            };
            roomCard.onmouseout = () => {
                roomCard.style.transform = 'translateY(0)';
                roomCard.style.boxShadow = 'var(--elevation-2)';
            };

            roomCard.innerHTML = `
                <!-- Room header with color indicator -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="
                            background: ${room.type === 'large' ? '#28a745' : '#007bff'};
                            color: white;
                            padding: 0.75rem 1.25rem;
                            border: 2px solid ${room.type === 'large' ? '#1e7e34' : '#0056b3'};
                            border-radius: var(--radius-md);
                            font-size: 1.25rem;
                            font-weight: 700;
                            box-shadow: 0 2px 8px ${room.type === 'large' ? 'rgba(40, 167, 69, 0.3)' : 'rgba(0, 123, 255, 0.3)'};
                            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                        ">
                            ${roomId}
                        </div>
                        <div>
                            <div style="font-size: 0.9rem; color: var(--gray-600);">Kapacita</div>
                            <div style="font-weight: 600; color: var(--gray-800);">
                                ${room.beds} ${room.beds === 1 ? 'lůžko' : room.beds < 5 ? 'lůžka' : 'lůžek'}
                            </div>
                        </div>
                    </div>
                    <div style="
                        padding: 0.25rem 0.75rem;
                        background: ${room.type === 'large' ? 'var(--success-100)' : 'var(--info-100)'};
                        color: ${room.type === 'large' ? 'var(--success-700)' : 'var(--info-700)'};
                        border-radius: var(--radius-sm);
                        font-size: 0.85rem;
                        font-weight: 600;
                    ">
                        ${room.type === 'large' ? langManager.t('largeRoom') : langManager.t('smallRoom')}
                    </div>
                </div>

                <!-- Guest type selection -->
                <div style="margin-bottom: 1.25rem;">
                    <label style="display: block; font-size: 0.9rem; font-weight: 600; color: var(--gray-700); margin-bottom: 0.5rem;">
                        Typ hosta
                    </label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                        <label style="
                            display: flex;
                            align-items: center;
                            padding: 0.75rem;
                            background: ${guestType === 'utia' ? 'var(--primary-100)' : 'white'};
                            border: 2px solid ${guestType === 'utia' ? 'var(--primary-500)' : 'var(--gray-300)'};
                            border-radius: var(--radius-md);
                            cursor: pointer;
                            transition: all 0.2s;
                        ">
                            <input type="radio"
                                   name="guestType-${roomId}"
                                   value="utia"
                                   ${guestType === 'utia' ? 'checked' : ''}
                                   onchange="window.bookingApp.updateRoomGuestType('${roomId}', 'utia')"
                                   style="margin-right: 0.5rem;">
                            <span style="font-size: 0.9rem; font-weight: ${guestType === 'utia' ? '600' : '400'};">Zaměstnanec ÚTIA</span>
                        </label>
                        <label style="
                            display: flex;
                            align-items: center;
                            padding: 0.75rem;
                            background: ${guestType === 'external' ? 'var(--primary-100)' : 'white'};
                            border: 2px solid ${guestType === 'external' ? 'var(--primary-500)' : 'var(--gray-300)'};
                            border-radius: var(--radius-md);
                            cursor: pointer;
                            transition: all 0.2s;
                        ">
                            <input type="radio"
                                   name="guestType-${roomId}"
                                   value="external"
                                   ${guestType === 'external' ? 'checked' : ''}
                                   onchange="window.bookingApp.updateRoomGuestType('${roomId}', 'external')"
                                   style="margin-right: 0.5rem;">
                            <span style="font-size: 0.9rem; font-weight: ${guestType === 'external' ? '600' : '400'};">Externí host</span>
                        </label>
                    </div>
                </div>

                <!-- Guest count controls -->
                <div style="margin-bottom: 0.5rem;">
                    <label style="display: block; font-size: 0.9rem; font-weight: 600; color: var(--gray-700); margin-bottom: 0.5rem;">
                        Počet hostů
                    </label>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
                        <div>
                            <label style="display: block; font-size: 0.85rem; color: var(--gray-600); margin-bottom: 0.25rem;">Dospělí</label>
                            <div style="display: flex; align-items: center; background: white; border: 1px solid var(--gray-300); border-radius: var(--radius-sm); overflow: hidden;">
                                <button onclick="window.bookingApp.adjustRoomGuests('${roomId}', 'adults', -1)"
                                        style="padding: 0.5rem 0.75rem; background: var(--gray-100); border: none; cursor: pointer; font-size: 1.2rem; font-weight: 600; color: var(--gray-700); transition: background 0.2s;"
                                        onmouseover="this.style.background='var(--gray-200)'"
                                        onmouseout="this.style.background='var(--gray-100)'">
                                    −
                                </button>
                                <span id="room-${roomId}-adults"
                                      style="flex: 1; text-align: center; padding: 0.5rem; font-weight: 600; font-size: 1.1rem; color: var(--gray-900);">
                                    ${guests.adults}
                                </span>
                                <button onclick="window.bookingApp.adjustRoomGuests('${roomId}', 'adults', 1)"
                                        style="padding: 0.5rem 0.75rem; background: var(--gray-100); border: none; cursor: pointer; font-size: 1.2rem; font-weight: 600; color: var(--gray-700); transition: background 0.2s;"
                                        onmouseover="this.style.background='var(--gray-200)'"
                                        onmouseout="this.style.background='var(--gray-100)'">
                                    +
                                </button>
                            </div>
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.85rem; color: var(--gray-600); margin-bottom: 0.25rem;">Děti (3-18)</label>
                            <div style="display: flex; align-items: center; background: white; border: 1px solid var(--gray-300); border-radius: var(--radius-sm); overflow: hidden;">
                                <button onclick="window.bookingApp.adjustRoomGuests('${roomId}', 'children', -1)"
                                        style="padding: 0.5rem 0.75rem; background: var(--gray-100); border: none; cursor: pointer; font-size: 1.2rem; font-weight: 600; color: var(--gray-700); transition: background 0.2s;"
                                        onmouseover="this.style.background='var(--gray-200)'"
                                        onmouseout="this.style.background='var(--gray-100)'">
                                    −
                                </button>
                                <span id="room-${roomId}-children"
                                      style="flex: 1; text-align: center; padding: 0.5rem; font-weight: 600; font-size: 1.1rem; color: var(--gray-900);">
                                    ${guests.children}
                                </span>
                                <button onclick="window.bookingApp.adjustRoomGuests('${roomId}', 'children', 1)"
                                        style="padding: 0.5rem 0.75rem; background: var(--gray-100); border: none; cursor: pointer; font-size: 1.2rem; font-weight: 600; color: var(--gray-700); transition: background 0.2s;"
                                        onmouseover="this.style.background='var(--gray-200)'"
                                        onmouseout="this.style.background='var(--gray-100)'">
                                    +
                                </button>
                            </div>
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.85rem; color: var(--gray-600); margin-bottom: 0.25rem;">Batolata (<3)</label>
                            <div style="display: flex; align-items: center; background: white; border: 1px solid var(--gray-300); border-radius: var(--radius-sm); overflow: hidden;">
                                <button onclick="window.bookingApp.adjustRoomGuests('${roomId}', 'toddlers', -1)"
                                        style="padding: 0.5rem 0.75rem; background: var(--gray-100); border: none; cursor: pointer; font-size: 1.2rem; font-weight: 600; color: var(--gray-700); transition: background 0.2s;"
                                        onmouseover="this.style.background='var(--gray-200)'"
                                        onmouseout="this.style.background='var(--gray-100)'">
                                    −
                                </button>
                                <span id="room-${roomId}-toddlers"
                                      style="flex: 1; text-align: center; padding: 0.5rem; font-weight: 600; font-size: 1.1rem; color: var(--gray-900);">
                                    ${guests.toddlers}
                                </span>
                                <button onclick="window.bookingApp.adjustRoomGuests('${roomId}', 'toddlers', 1)"
                                        style="padding: 0.5rem 0.75rem; background: var(--gray-100); border: none; cursor: pointer; font-size: 1.2rem; font-weight: 600; color: var(--gray-700); transition: background 0.2s;"
                                        onmouseover="this.style.background='var(--gray-200)'"
                                        onmouseout="this.style.background='var(--gray-100)'">
                                    +
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            cardsContainer.appendChild(roomCard);
        });

        container.appendChild(cardsContainer);
    }

    async updateRoomGuests(roomId, type, value) {
        const guests = this.roomGuests.get(roomId) || {adults: 1, children: 0, toddlers: 0};
        const newValue = parseInt(value) || 0;

        // Get room capacity
        const rooms = dataManager.getRooms();
        const room = rooms.find(r => r.id === roomId);
        const roomCapacity = room ? room.beds : 4;

        // Check total guests don't exceed room capacity (exclude toddlers - they don't need beds)
        const totalGuests = (type === 'adults' ? newValue : guests.adults) +
                          (type === 'children' ? newValue : guests.children);
                          // toddlers excluded - they can sleep with parents

        if (totalGuests > roomCapacity) {
            // Revert to previous value
            const input = document.getElementById(`room-${roomId}-${type}`);
            if (input) {
                input.value = guests[type];
            }
            return;
        }

        guests[type] = newValue;
        this.roomGuests.set(roomId, guests);
        await this.updatePriceCalculation();
    }

    async adjustRoomGuests(roomId, type, delta) {
        console.log('adjustRoomGuests called:', roomId, type, delta);

        try {
            const guests = this.roomGuests.get(roomId) || {adults: 1, children: 0, toddlers: 0};
            const currentValue = guests[type] || 0;
            console.log('Current value:', currentValue, 'Guests:', guests);

            // Calculate new value
            let newValue = currentValue + delta;

            // Don't allow negative values
            if (newValue < 0) {
                return;
            }

            // Get room capacity
            const rooms = await dataManager.getRooms();
            const room = rooms.find(r => r.id === roomId);
            const roomCapacity = room ? room.beds : 4;

            // Check total guests don't exceed room capacity (only when increasing)
            // Toddlers don't count towards bed capacity
            if (delta > 0) {
                const totalGuests = (type === 'adults' ? newValue : guests.adults) +
                                  (type === 'children' ? newValue : guests.children);
                                  // toddlers excluded - they can sleep with parents

                if (totalGuests > roomCapacity) {
                    // Don't allow increase if it exceeds capacity
                    console.log('Capacity exceeded!');
                    return;
                }
            }

            guests[type] = newValue;
            this.roomGuests.set(roomId, guests);

            // Update the display span
            const display = document.getElementById(`room-${roomId}-${type}`);
            if (display) {
                display.textContent = newValue;
                console.log('Updated display:', display.id, 'to', newValue);
            }

            // Update price asynchronously
            this.updatePriceCalculation();
        } catch (error) {
            console.error('Error in adjustRoomGuests:', error);
        }
    }

    async updateRoomGuestType(roomId, guestType) {
        this.roomGuestTypes.set(roomId, guestType);
        await this.updateRoomGuestControls();
        await this.updatePriceCalculation();
    }

    async updateSelectedDatesDisplay() {
        const container = document.getElementById('selectedDates');
        container.innerHTML = '';

        if (this.selectedDates.size === 0) {
            return;
        }

        // Get room data for styling
        const rooms = await dataManager.getRooms();
        const roomsMap = new Map(rooms.map(r => [r.id, r]));

        const sortedDates = Array.from(this.selectedDates).sort();
        sortedDates.forEach(dateStr => {
            const dateItem = document.createElement('div');
            dateItem.style.cssText = 'margin-bottom: 0.75rem; padding: 0.75rem; background: white; border-radius: var(--radius-md); border: 1px solid var(--gray-200);';

            const date = new Date(dateStr);
            const dateFormatted = date.toLocaleDateString('cs-CZ', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const selectedRooms = this.selectedRooms.get(dateStr);

            if (selectedRooms && selectedRooms.size > 0) {
                const roomsArray = Array.from(selectedRooms).sort();
                const roomElements = roomsArray.map(roomId => {
                    const room = roomsMap.get(roomId);
                    const isLarge = room && room.type === 'large';
                    return `<span style="
                        display: inline-block;
                        margin-left: 0.5rem;
                        padding: 0.5rem 0.8rem;
                        background: ${isLarge ? '#28a745' : '#007bff'};
                        color: white;
                        border: 2px solid ${isLarge ? '#1e7e34' : '#0056b3'};
                        border-radius: 6px;
                        font-weight: 700;
                        font-size: 1.1rem;
                        box-shadow: 0 2px 4px ${isLarge ? 'rgba(40, 167, 69, 0.3)' : 'rgba(0, 123, 255, 0.3)'};
                        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                    ">${roomId}</span>`;
                }).join('');

                dateItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 500; color: var(--gray-800);">${dateFormatted}</span>
                    </div>
                    <div style="margin-top: 0.5rem;">
                        <span style="color: var(--gray-600); font-size: 0.9rem;">Pokoje:</span>${roomElements}
                    </div>
                `;
            } else {
                dateItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 500; color: var(--gray-800);">${dateFormatted}</span>
                    </div>
                    <div style="margin-top: 0.5rem; color: var(--warning-600); font-size: 0.9rem;">
                        ⚠️ Vyberte pokoje v kalendáři
                    </div>
                `;
            }

            container.appendChild(dateItem);
        });
    }

    async updatePriceCalculation() {
        let totalPrice = 0;
        const rooms = await dataManager.getRooms();

        // Calculate price for each room with its specific guest type and count
        for (const [dateStr, roomIds] of this.selectedRooms) {
            for (const roomId of roomIds) {
                const room = rooms.find(r => r.id === roomId);
                if (room) {
                    const guests = this.roomGuests.get(roomId) || {adults: 1, children: 0, toddlers: 0};
                    const guestType = this.roomGuestTypes.get(roomId) || 'utia';

                    const price = await dataManager.calculatePrice(
                        room.type,
                        guestType,
                        guests.adults,
                        guests.children,
                        guests.toddlers,
                        1 // Price per night
                    );
                    totalPrice += price;
                }
            }
        }

        document.getElementById('totalPrice').textContent = `${totalPrice} Kč`;

        // Capacity display removed - validation is now per room

        // No longer checking capacity on button since we validate per room
    }

    async showBookingDetails(date, roomId) {
        console.log('showBookingDetails called with:', date, roomId);
        const bookings = await dataManager.getAllBookings();
        const dateStr = dataManager.formatDate(date);
        console.log('Found bookings:', bookings.length);
        console.log('Looking for date:', dateStr, 'room:', roomId);

        const booking = bookings.find(b => {
            // Use string comparison to avoid timezone issues
            const checkDateStr = dataManager.formatDate(date);
            const hasRoom = b.rooms.includes(roomId);
            const inDateRange = checkDateStr >= b.startDate && checkDateStr <= b.endDate;
            console.log('Checking booking:', b.id, 'rooms:', b.rooms, 'hasRoom:', hasRoom, 'dateRange:', b.startDate, '-', b.endDate, 'inRange:', inDateRange);
            return hasRoom && inDateRange;
        });

        console.log('Found booking:', booking);

        if (booking) {
            const modal = document.getElementById('bookingModal');
            const details = document.getElementById('bookingDetails');

            const lang = langManager.currentLang;
            const locale = lang === 'cs' ? 'cs-CZ' : 'en-US';

            const totalGuestsWithBeds = (booking.adults || 0) + (booking.children || 0);
            const totalGuests = (booking.adults || 0) + (booking.children || 0) + (booking.toddlers || 0);

            const roomBadges = await Promise.all(booking.rooms.map(async roomId => await this.createRoomBadge(roomId, true)));

            details.innerHTML = `
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <strong>${lang === 'cs' ? 'Číslo rezervace' : 'Booking Number'}:</strong> ${booking.id}
                    </div>
                    <div>
                        <strong>${lang === 'cs' ? 'Termín' : 'Period'}:</strong>
                        ${new Date(booking.startDate).toLocaleDateString(locale)} -
                        ${new Date(booking.endDate).toLocaleDateString(locale)}
                    </div>
                    <div>
                        <strong>${lang === 'cs' ? 'Pokoje' : 'Rooms'}:</strong> ${roomBadges.join('')}
                    </div>
                    <div>
                        <strong>${lang === 'cs' ? 'Počet hostů' : 'Number of guests'}:</strong> ${totalGuests}
                    </div>
                </div>
            `;

            // Store booking ID for contact form
            modal.dataset.bookingId = booking.id;
            modal.classList.add('active');

            // Update button text based on language
            const contactBtn = document.getElementById('contactOwner');
            if (contactBtn) {
                contactBtn.style.display = 'block'; // Show contact button for bookings
                contactBtn.textContent = lang === 'cs' ? 'Kontaktovat vlastníka' : 'Contact Owner';
            }
        }
    }

    async showBlockedDetails(date, roomId) {
        const blockedDates = await dataManager.getBlockedDates();
        const dateStr = dataManager.formatDate(date);

        // Find the blocked date entry
        const blockedEntry = blockedDates.find(bd =>
            bd.date === dateStr && (bd.roomId === roomId || !bd.roomId)
        );

        if (blockedEntry) {
            const modal = document.getElementById('bookingModal');
            const details = document.getElementById('bookingDetails');

            const lang = langManager.currentLang;
            const locale = lang === 'cs' ? 'cs-CZ' : 'en-US';

            // Find the full range of this blockage
            let startDate = date;
            let endDate = date;

            // Find all dates and rooms with same blockageId
            let allBlockedRooms = new Set();
            if (blockedEntry.blockageId) {
                const relatedBlocks = blockedDates.filter(bd =>
                    bd.blockageId === blockedEntry.blockageId
                );

                if (relatedBlocks.length > 0) {
                    const dates = relatedBlocks.map(bd => new Date(bd.date));
                    dates.sort((a, b) => a - b);
                    startDate = dates[0];
                    endDate = dates[dates.length - 1];

                    // Collect all blocked rooms
                    relatedBlocks.forEach(bd => {
                        if (bd.roomId) {
                            allBlockedRooms.add(bd.roomId);
                        }
                    });
                }
            } else {
                // Fallback for old entries without blockageId - use consecutive dates with same reason
                if (blockedEntry.reason) {
                    // Look backward for start
                    let checkDate = new Date(date);
                    checkDate.setDate(checkDate.getDate() - 1);
                    while (true) {
                        const checkStr = dataManager.formatDate(checkDate);
                        const prevBlocked = blockedDates.find(bd =>
                            bd.date === checkStr &&
                            bd.reason === blockedEntry.reason &&
                            (bd.roomId === roomId || (!bd.roomId && !blockedEntry.roomId))
                        );
                        if (!prevBlocked) break;
                        startDate = new Date(checkDate);
                        checkDate.setDate(checkDate.getDate() - 1);
                    }

                    // Look forward for end
                    checkDate = new Date(date);
                    checkDate.setDate(checkDate.getDate() + 1);
                    while (true) {
                        const checkStr = dataManager.formatDate(checkDate);
                        const nextBlocked = blockedDates.find(bd =>
                            bd.date === checkStr &&
                            bd.reason === blockedEntry.reason &&
                            (bd.roomId === roomId || (!bd.roomId && !blockedEntry.roomId))
                        );
                        if (!nextBlocked) break;
                        endDate = new Date(checkDate);
                        checkDate.setDate(checkDate.getDate() + 1);
                    }
                }
            }

            details.innerHTML = `
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <strong style="color: var(--danger-color);">${lang === 'cs' ? 'Blokovaný termín' : 'Blocked Period'}</strong>
                        ${blockedEntry.blockageId ? `<span style="margin-left: 1rem; color: var(--primary-color); font-size: 0.9rem;">${blockedEntry.blockageId}</span>` : ''}
                    </div>
                    <div>
                        <strong>${lang === 'cs' ? 'Termín' : 'Period'}:</strong>
                        ${startDate.toLocaleDateString(locale)} - ${endDate.toLocaleDateString(locale)}
                    </div>
                    <div>
                        <strong>${lang === 'cs' ? 'Blokované pokoje' : 'Blocked rooms'}:</strong>
                        ${allBlockedRooms.size > 0
                            ? Array.from(allBlockedRooms).sort().join(', ')
                            : (blockedEntry.roomId
                                ? blockedEntry.roomId
                                : (lang === 'cs' ? 'Všechny pokoje' : 'All rooms'))
                        }
                    </div>
                    <div>
                        <strong>${lang === 'cs' ? 'Důvod' : 'Reason'}:</strong>
                        ${blockedEntry.reason || (lang === 'cs' ? 'Důvod nebyl zadán' : 'No reason provided')}
                    </div>
                </div>
            `;

            // Hide contact button for blocked dates
            const contactBtn = document.getElementById('contactOwner');
            if (contactBtn) {
                contactBtn.style.display = 'none';
            }

            modal.classList.add('active');
        }
    }

    async openBookingModal() {
        // Validate selected dates and rooms
        if (this.selectedDates.size === 0) {
            alert(langManager.t('selectDateError'));
            return;
        }

        let hasRooms = false;
        this.selectedRooms.forEach(rooms => {
            if (rooms.size > 0) hasRooms = true;
        });

        if (!hasRooms) {
            alert(langManager.t('selectRoomError'));
            return;
        }

        // Check capacity FIRST - before opening modal
        const totalGuests = this.getTotalGuests();
        const totalBeds = await this.getTotalBeds();

        if (totalGuests > totalBeds) {
            const message = langManager.currentLang === 'cs'
                ? `Nedostatečná kapacita! Vybrané pokoje mají celkem ${totalBeds} ${totalBeds === 1 ? 'lůžko' : totalBeds < 5 ? 'lůžka' : 'lůžek'}, ale potřebujete místo pro ${totalGuests} ${totalGuests === 1 ? 'osobu' : totalGuests < 5 ? 'osoby' : 'osob'}.`
                : `Insufficient capacity! Selected rooms have ${totalBeds} ${totalBeds === 1 ? 'bed' : 'beds'}, but you need space for ${totalGuests} ${totalGuests === 1 ? 'person' : 'people'}.`;
            alert(message);
            return;
        }

        // Check Christmas period restrictions BEFORE opening modal
        const hasChristmasDates = await this.checkChristmasDates();
        if (hasChristmasDates && !await this.validateChristmasAccess()) {
            return;
        }

        // Prepare booking summary
        this.prepareSummary();

        // Open modal
        document.getElementById('bookingFormModal').classList.add('active');
    }

    async checkChristmasDates() {
        for (const dateStr of this.selectedDates) {
            if (await dataManager.isChristmasPeriod(new Date(dateStr))) {
                return true;
            }
        }
        return false;
    }

    async validateChristmasAccess() {
        // Zkontroluj, zda se vůbec vyžaduje kód pro vánoční období
        let firstChristmasDate = null;
        for (const dateStr of this.selectedDates) {
            if (await dataManager.isChristmasPeriod(new Date(dateStr))) {
                firstChristmasDate = dateStr;
                break;
            }
        }

        if (firstChristmasDate) {
            const startDate = new Date(firstChristmasDate);
            const requiresCode = await dataManager.requiresChristmasCode(startDate);

            // Pokud se kód nevyžaduje (po 30.9.), povolíme rezervaci
            if (!requiresCode) {
                return true;
            }
        }

        const settings = await dataManager.getSettings();
        const accessCodes = settings.christmasAccessCodes || [];

        // If no access codes are configured, nobody can book during Christmas
        if (accessCodes.length === 0) {
            const errorMessage = langManager.currentLang === 'cs'
                ? 'Rezervace během vánočního období není momentálně možná. Kontaktujte prosím správce.'
                : 'Christmas period booking is currently not available. Please contact the administrator.';
            alert(errorMessage);
            return false;
        }

        // If access codes exist, prompt for one
        const message = langManager.currentLang === 'cs'
            ? 'Rezervace během vánočního období vyžaduje přístupový kód. Zadejte prosím váš kód:'
            : 'Christmas period booking requires an access code. Please enter your code:';

        const accessCode = prompt(message);

        if (!accessCode || !accessCodes.includes(accessCode)) {
            const errorMessage = langManager.currentLang === 'cs'
                ? 'Neplatný přístupový kód. Rezervace během vánočního období není možná bez platného kódu.'
                : 'Invalid access code. Christmas period booking is not possible without a valid code.';
            alert(errorMessage);
            return false;
        }

        // Store the valid access code for later use in form submission
        this.validChristmasCode = accessCode;
        return true;
    }

    prepareSummary() {
        // Prepare booking summary
        const summaryContainer = document.getElementById('bookingSummary');
        const sortedDates = Array.from(this.selectedDates).sort();
        const startDate = new Date(sortedDates[0]);
        const endDate = new Date(sortedDates[sortedDates.length - 1]);

        const allRooms = new Set();
        this.selectedRooms.forEach(rooms => {
            rooms.forEach(room => allRooms.add(room));
        });

        // Calculate total guests from room guest controls
        let totalAdults = 0, totalChildren = 0, totalToddlers = 0;
        let primaryGuestType = 'utia'; // Default

        this.roomGuests.forEach(guests => {
            totalAdults += guests.adults;
            totalChildren += guests.children;
            totalToddlers += guests.toddlers;
        });

        // Get guest type from the first room that has guests
        this.roomGuestTypes.forEach(type => {
            primaryGuestType = type;
        });
        const totalPrice = document.getElementById('totalPrice').textContent;

        const lang = langManager.currentLang;
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const locale = lang === 'cs' ? 'cs-CZ' : 'en-US';

        summaryContainer.innerHTML = `
            <div><strong>${langManager.t('term')}:</strong> ${startDate.toLocaleDateString(locale, dateOptions)} - ${endDate.toLocaleDateString(locale, dateOptions)}</div>
            <div><strong>${langManager.t('rooms')}:</strong> ${Array.from(allRooms).sort().join(', ')}</div>
            <div><strong>${langManager.t('nights')}:</strong> ${this.selectedDates.size}</div>
            <div><strong>${langManager.t('guestType')}:</strong> ${primaryGuestType === 'utia' ? langManager.t('guestTypeEmployee') : langManager.t('guestTypeExternal')}</div>
            <div><strong>${langManager.t('guests')}:</strong> ${totalAdults} ${langManager.t('adults')}${totalChildren > 0 ? `, ${totalChildren} ${langManager.t('children')}` : ''}${totalToddlers > 0 ? `, ${totalToddlers} ${langManager.t('toddlers')}` : ''}</div>
            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 2px solid var(--gray-200);">
                <strong>${langManager.t('totalPrice')}:</strong> <span style="color: var(--primary-color); font-size: 1.25rem;">${totalPrice}</span>
            </div>
        `;
    }

    validateForm(formData) {
        const errors = [];
        const lang = langManager.currentLang;

        // Validate name
        const name = formData.get('name').trim();
        if (name.length < 3) {
            errors.push(lang === 'cs' ? 'Jméno musí obsahovat alespoň 3 znaky' : 'Name must be at least 3 characters');
        }

        // Validate email
        const email = formData.get('email').trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errors.push(lang === 'cs' ? 'Neplatný formát emailu (musí obsahovat @)' : 'Invalid email format (must contain @)');
        }

        // Validate phone - get prefix and phone separately
        const phonePrefix = formData.get('phonePrefix');
        const phone = formData.get('phone').trim().replace(/\s/g, '');

        // Phone validation based on prefix
        if (phonePrefix === '+420' || phonePrefix === '+421') {
            if (!/^\d{9}$/.test(phone)) {
                errors.push(lang === 'cs' ? 'Telefonní číslo musí obsahovat přesně 9 číslic' : 'Phone number must contain exactly 9 digits');
            }
        } else if (phone.length < 7 || phone.length > 15 || !/^\d+$/.test(phone)) {
            errors.push(lang === 'cs' ? 'Neplatné telefonní číslo' : 'Invalid phone number');
        }

        // Validate ZIP code
        const zip = formData.get('zip').trim().replace(/\s/g, '');
        if (!/^\d{5}$/.test(zip)) {
            errors.push(lang === 'cs' ? 'PSČ musí obsahovat přesně 5 číslic' : 'ZIP code must contain exactly 5 digits');
        }

        // Validate address
        const address = formData.get('address').trim();
        if (address.length < 5) {
            errors.push(lang === 'cs' ? 'Adresa je příliš krátká' : 'Address is too short');
        }

        // Validate city
        const city = formData.get('city').trim();
        if (city.length < 2) {
            errors.push(lang === 'cs' ? 'Název města je příliš krátký' : 'City name is too short');
        }

        // Validate IČO if provided
        const ico = formData.get('ico').trim();
        if (ico && !/^\d{8}$/.test(ico)) {
            errors.push(lang === 'cs' ? 'IČO musí obsahovat přesně 8 číslic' : 'Company ID must contain exactly 8 digits');
        }

        // Validate DIČ if provided
        const dic = formData.get('dic').trim();
        if (dic && !/^CZ\d{8,10}$/.test(dic.toUpperCase())) {
            errors.push(lang === 'cs' ? 'DIČ musí být ve formátu CZ12345678' : 'VAT ID must be in format CZ12345678');
        }

        return errors;
    }

    async handleBookingSubmit(e) {
        e.preventDefault();

        // Collect form data
        const formData = new FormData(e.target);

        // Validate form
        const errors = this.validateForm(formData);
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return;
        }

        // Combine phone with prefix
        const phonePrefix = formData.get('phonePrefix');
        const phoneNumber = formData.get('phone').trim().replace(/\s/g, '');
        const fullPhone = phonePrefix + phoneNumber;

        let bookingData;

        // Check if this is a bulk booking
        if (this.bulkBookingData) {
            // Use bulk booking data
            const allRooms = await dataManager.getRooms();
            bookingData = {
                name: formData.get('name').trim(),
                email: formData.get('email').trim(),
                phone: fullPhone,
                company: formData.get('company').trim(),
                address: formData.get('address').trim(),
                city: formData.get('city').trim(),
                zip: formData.get('zip').trim().replace(/\s/g, ''),
                ico: formData.get('ico').trim(),
                dic: formData.get('dic').trim().toUpperCase(),
                notes: formData.get('notes').trim(),
                startDate: Math.min(...this.bulkBookingData.dates.map(d => new Date(d).getTime())),
                endDate: Math.max(...this.bulkBookingData.dates.map(d => new Date(d).getTime())),
                rooms: allRooms.map(r => r.id), // All rooms for bulk booking
                guestType: this.bulkBookingData.guestType,
                adults: this.bulkBookingData.adults,
                children: this.bulkBookingData.children,
                toddlers: this.bulkBookingData.toddlers,
                totalPrice: this.bulkBookingData.totalPrice,
                isBulkBooking: true,
                bulkDates: this.bulkBookingData.dates
            };
        } else {
            // Regular booking - calculate total guests from room guest controls
            let totalAdults = 0, totalChildren = 0, totalToddlers = 0;
            let primaryGuestType = 'utia'; // Default

            this.roomGuests.forEach(guests => {
                totalAdults += guests.adults;
                totalChildren += guests.children;
                totalToddlers += guests.toddlers;
            });

            // Get guest type from the first room that has guests
            this.roomGuestTypes.forEach(type => {
                primaryGuestType = type;
            });

            bookingData = {
                name: formData.get('name').trim(),
                email: formData.get('email').trim(),
                phone: fullPhone,
                company: formData.get('company').trim(),
                address: formData.get('address').trim(),
                city: formData.get('city').trim(),
                zip: formData.get('zip').trim().replace(/\s/g, ''),
                ico: formData.get('ico').trim(),
                dic: formData.get('dic').trim().toUpperCase(),
                notes: formData.get('notes').trim(),
                startDate: Math.min(...Array.from(this.selectedDates).map(d => new Date(d).getTime())),
                endDate: Math.max(...Array.from(this.selectedDates).map(d => new Date(d).getTime())),
                rooms: Array.from(new Set(Array.from(this.selectedRooms.values()).flatMap(s => Array.from(s)))),
                guestType: primaryGuestType,
                adults: totalAdults,
                children: totalChildren,
                toddlers: totalToddlers,
                totalPrice: parseInt(document.getElementById('totalPrice').textContent.replace(' Kč', ''))
            };
        }

        bookingData.startDate = dataManager.formatDate(new Date(bookingData.startDate));
        bookingData.endDate = dataManager.formatDate(new Date(bookingData.endDate));

        // Create booking
        const booking = await dataManager.createBooking(bookingData);

        if (!booking) {
            alert('Chyba při vytváření rezervace. Zkuste to prosím znovu.');
            return;
        }

        // Send confirmation email
        await dataManager.sendBookingConfirmation(booking);

        // Show success message
        this.showSuccessMessage(`Rezervace byla úspěšně vytvořena! Číslo rezervace: ${booking.id}.
            Potvrzení bylo odesláno na email ${booking.email}`);

        // Close modal and reset form
        document.getElementById('bookingFormModal').classList.remove('active');
        e.target.reset();
        this.selectedDates.clear();
        this.selectedRooms.clear();

        // Clear bulk booking data if it was used
        if (this.bulkBookingData) {
            this.bulkBookingData = null;
        }

        // Clear stored Christmas access code
        this.validChristmasCode = null;

        // Force calendar re-render to show new booking
        await this.renderCalendar();
        await this.updateSelectedDatesDisplay();
        await this.updatePriceCalculation();
    }

    async handleContactSubmit(e) {
        e.preventDefault();

        const modal = document.getElementById('bookingModal');
        const bookingId = modal.dataset.bookingId;

        if (!bookingId) {
            alert('Chyba: Nelze najít rezervaci');
            return;
        }

        const email = document.getElementById('contactEmail').value;
        const message = document.getElementById('contactMessage').value;

        // Send message
        const success = await dataManager.sendContactMessage(bookingId, email, message);

        if (success) {
            this.showSuccessMessage('Zpráva byla úspěšně odeslána vlastníkovi rezervace');
            document.getElementById('contactModal').classList.remove('active');
            document.getElementById('contactForm').reset();
        } else {
            alert('Chyba při odesílání zprávy');
        }
    }

    showSuccessMessage(message) {
        const messageEl = document.getElementById('successMessage');
        messageEl.textContent = message;
        messageEl.classList.add('active');

        setTimeout(() => {
            messageEl.classList.remove('active');
        }, 5000);
    }

    getTotalGuests() {
        let totalGuests = 0;
        this.roomGuests.forEach(guests => {
            // Batolata nezapočítávat do kapacity (nezaberou lůžko)
            totalGuests += guests.adults + guests.children;
        });
        return totalGuests || 1; // Minimum 1 guest
    }

    async getTotalBeds() {
        let totalBeds = 0;
        const rooms = await dataManager.getRooms();

        // Get unique rooms from all selected dates
        const allSelectedRooms = new Set();
        this.selectedRooms.forEach(roomsForDate => {
            roomsForDate.forEach(roomId => allSelectedRooms.add(roomId));
        });

        allSelectedRooms.forEach(roomId => {
            const room = rooms.find(r => r.id === roomId);
            if (room && room.beds) {
                totalBeds += room.beds;
            }
        });

        return totalBeds;
    }

    // Method to refresh room selection when configuration changes
    updateRoomSelection() {
        // Re-render the calendar to reflect new room configuration
        this.renderCalendar();
        // Recalculate prices
        this.updatePriceCalculation();
    }

    // Load room information from config
    async loadRoomInfo() {
        const rooms = await dataManager.getRooms();
        const settings = await dataManager.getSettings();
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

        const bulkPrices = settings.bulkPrices || {
            basePrice: 2000,
            utiaAdult: 100,
            utiaChild: 0,
            externalAdult: 250,
            externalChild: 50
        };

        // Update room capacity grid
        const capacityGrid = document.getElementById('roomCapacityGrid');
        if (capacityGrid) {
            capacityGrid.innerHTML = '';
            let totalBeds = 0;

            rooms.forEach(room => {
                const roomDiv = document.createElement('div');
                roomDiv.style.textAlign = 'center';

                // Use green for large rooms, blue for small rooms
                const isLarge = room.type === 'large';
                const roomColor = isLarge ? '#28a745' : '#007bff';
                const roomBorder = isLarge ? '#1e7e34' : '#0056b3';

                roomDiv.innerHTML = `
                    <div style="background: white; padding: 0.75rem; border-radius: var(--radius-lg); box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
                        <span style="display: block; background: ${roomColor}; color: white; padding: 0.75rem; border: 2px solid ${roomBorder}; border-radius: var(--radius-md); font-size: 1.3rem; font-weight: 700; margin-bottom: 0.5rem; box-shadow: 0 2px 8px ${isLarge ? 'rgba(40, 167, 69, 0.3)' : 'rgba(0, 123, 255, 0.3)'}; text-align: center;">${room.id}</span>
                        <span style="font-size: 0.95rem; color: var(--gray-800); display: block; text-align: center; margin-top: 0.5rem;" class="room-beds" data-beds="${room.beds}">${room.beds} ${langManager.currentLang === 'cs' ? (room.beds === 1 ? 'lůžko' : room.beds < 5 ? 'lůžka' : 'lůžek') : (room.beds === 1 ? 'bed' : 'beds')}</span>
                        <div style="margin-top: 0.5rem; text-align: center;">
                            <span style="font-size: 0.85rem; background: ${room.type === 'large' ? 'var(--success-100)' : 'var(--info-100)'}; color: ${room.type === 'large' ? 'var(--success-700)' : 'var(--info-700)'}; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-weight: 600;">${room.type === 'large' ? langManager.t('largeRoom') : langManager.t('smallRoom')}</span>
                        </div>
                    </div>
                `;

                capacityGrid.appendChild(roomDiv);
                totalBeds += room.beds;
            });

            // Update total capacity text
            const totalCapacityText = document.getElementById('totalCapacityText');
            if (totalCapacityText) {
                const capacityText = langManager.currentLang === 'cs'
                    ? `Celková kapacita: ${totalBeds} lůžek`
                    : `Total capacity: ${totalBeds} beds`;
                totalCapacityText.textContent = capacityText;
            }
        }

        // Update price list
        const priceListContent = document.getElementById('priceListContent');
        if (priceListContent) {
            // Get room IDs by type
            const smallRoomIds = rooms.filter(r => r.type === 'small').map(r => r.id).sort().join(', ');
            const largeRoomIds = rooms.filter(r => r.type === 'large').map(r => r.id).sort().join(', ');

            const lang = langManager.currentLang;

            priceListContent.innerHTML = `
                <!-- ÚTIA zaměstnanci -->
                <div style="background: linear-gradient(135deg, #E8F4FD, #F0F9FF); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                    <h4 style="color: var(--gray-800); margin-bottom: 1rem;">${lang === 'cs' ? 'Zaměstnanci ÚTIA' : 'ÚTIA Employees'}</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                        <div>
                            <h5 style="color: var(--success-color); margin-bottom: 0.5rem;">${lang === 'cs' ? 'Malé pokoje' : 'Small rooms'} (${smallRoomIds})</h5>
                            <ul style="list-style: none; padding: 0; font-size: 0.95rem;">
                                <li>• ${lang === 'cs' ? 'Základní cena (1 osoba)' : 'Base price (1 person)'}: <strong>${prices.utia.small.base} Kč/${lang === 'cs' ? 'noc' : 'night'}</strong></li>
                                <li>• ${lang === 'cs' ? 'Další dospělý' : 'Additional adult'}: +${prices.utia.small.adult} Kč/${lang === 'cs' ? 'osoba' : 'person'}</li>
                                <li>• ${lang === 'cs' ? 'Dítě 3-18 let' : 'Child 3-18 years'}: +${prices.utia.small.child} Kč/${lang === 'cs' ? 'osoba' : 'person'}</li>
                                <li>• ${lang === 'cs' ? 'Dítě do 3 let: zdarma' : 'Child under 3: free'}</li>
                            </ul>
                        </div>
                        <div>
                            <h5 style="color: var(--primary-color); margin-bottom: 0.5rem;">${lang === 'cs' ? 'Velké pokoje' : 'Large rooms'} (${largeRoomIds})</h5>
                            <ul style="list-style: none; padding: 0; font-size: 0.95rem;">
                                <li>• ${lang === 'cs' ? 'Základní cena (1 osoba)' : 'Base price (1 person)'}: <strong>${prices.utia.large.base} Kč/${lang === 'cs' ? 'noc' : 'night'}</strong></li>
                                <li>• ${lang === 'cs' ? 'Další dospělý' : 'Additional adult'}: +${prices.utia.large.adult} Kč/${lang === 'cs' ? 'osoba' : 'person'}</li>
                                <li>• ${lang === 'cs' ? 'Dítě 3-18 let' : 'Child 3-18 years'}: +${prices.utia.large.child} Kč/${lang === 'cs' ? 'osoba' : 'person'}</li>
                                <li>• ${lang === 'cs' ? 'Dítě do 3 let: zdarma' : 'Child under 3: free'}</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Externí hosté -->
                <div style="background: linear-gradient(135deg, #FEF3C7, #FEF9E7); padding: 1.5rem; border-radius: var(--radius-md);">
                    <h4 style="color: var(--gray-800); margin-bottom: 1rem;">${lang === 'cs' ? 'Externí hosté' : 'External guests'}</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                        <div>
                            <h5 style="color: var(--success-color); margin-bottom: 0.5rem;">${lang === 'cs' ? 'Malé pokoje' : 'Small rooms'} (${smallRoomIds})</h5>
                            <ul style="list-style: none; padding: 0; font-size: 0.95rem;">
                                <li>• ${lang === 'cs' ? 'Základní cena (1 osoba)' : 'Base price (1 person)'}: <strong>${prices.external.small.base} Kč/${lang === 'cs' ? 'noc' : 'night'}</strong></li>
                                <li>• ${lang === 'cs' ? 'Další dospělý' : 'Additional adult'}: +${prices.external.small.adult} Kč/${lang === 'cs' ? 'osoba' : 'person'}</li>
                                <li>• ${lang === 'cs' ? 'Dítě 3-18 let' : 'Child 3-18 years'}: +${prices.external.small.child} Kč/${lang === 'cs' ? 'osoba' : 'person'}</li>
                                <li>• ${lang === 'cs' ? 'Dítě do 3 let: zdarma' : 'Child under 3: free'}</li>
                            </ul>
                        </div>
                        <div>
                            <h5 style="color: var(--primary-color); margin-bottom: 0.5rem;">${lang === 'cs' ? 'Velké pokoje' : 'Large rooms'} (${largeRoomIds})</h5>
                            <ul style="list-style: none; padding: 0; font-size: 0.95rem;">
                                <li>• ${lang === 'cs' ? 'Základní cena (1 osoba)' : 'Base price (1 person)'}: <strong>${prices.external.large.base} Kč/${lang === 'cs' ? 'noc' : 'night'}</strong></li>
                                <li>• ${lang === 'cs' ? 'Další dospělý' : 'Additional adult'}: +${prices.external.large.adult} Kč/${lang === 'cs' ? 'osoba' : 'person'}</li>
                                <li>• ${lang === 'cs' ? 'Dítě 3-18 let' : 'Child 3-18 years'}: +${prices.external.large.child} Kč/${lang === 'cs' ? 'osoba' : 'person'}</li>
                                <li>• ${lang === 'cs' ? 'Dítě do 3 let: zdarma' : 'Child under 3: free'}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        }

        // Update bulk price list content
        const bulkPriceListContent = document.getElementById('bulkPriceListContent');
        if (bulkPriceListContent) {
            const lang = langManager.currentLang;

            bulkPriceListContent.innerHTML = `
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="display: inline-block; padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; border-radius: 12px; font-weight: 700; font-size: 1.1rem; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
                        ${lang === 'cs' ? 'Fixní cena za noc' : 'Fixed price per night'}: <span id="bulkBasePriceDisplay">${bulkPrices.basePrice.toLocaleString()} Kč</span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    <!-- ÚTIA Employees -->
                    <div style="background: rgba(34, 197, 94, 0.1); padding: 1rem; border-radius: 8px; border-left: 4px solid #22c55e;">
                        <h5 style="color: #059669; margin-bottom: 0.75rem; font-weight: 600;">${lang === 'cs' ? 'Zaměstnanci ÚTIA' : 'ÚTIA Employees'}</h5>
                        <ul style="list-style: none; padding: 0; font-size: 0.9rem; color: #15803d;">
                            <li style="margin-bottom: 0.25rem;">• ${lang === 'cs' ? 'Dospělý' : 'Adult'}: <strong id="bulkUtiaAdultDisplay">+${bulkPrices.utiaAdult} Kč/${lang === 'cs' ? 'osoba' : 'person'}</strong></li>
                            <li>• ${lang === 'cs' ? 'Dítě (3-18 let)' : 'Child (3-18 years)'}: <strong id="bulkUtiaChildDisplay">+${bulkPrices.utiaChild} Kč/${lang === 'cs' ? 'osoba' : 'person'}</strong></li>
                        </ul>
                    </div>

                    <!-- External Guests -->
                    <div style="background: rgba(239, 68, 68, 0.1); padding: 1rem; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <h5 style="color: #dc2626; margin-bottom: 0.75rem; font-weight: 600;">${lang === 'cs' ? 'Externí hosté' : 'External guests'}</h5>
                        <ul style="list-style: none; padding: 0; font-size: 0.9rem; color: #b91c1c;">
                            <li style="margin-bottom: 0.25rem;">• ${lang === 'cs' ? 'Dospělý' : 'Adult'}: <strong id="bulkExternalAdultDisplay">+${bulkPrices.externalAdult} Kč/${lang === 'cs' ? 'osoba' : 'person'}</strong></li>
                            <li>• ${lang === 'cs' ? 'Dítě (3-18 let)' : 'Child (3-18 years)'}: <strong id="bulkExternalChildDisplay">+${bulkPrices.externalChild} Kč/${lang === 'cs' ? 'osoba' : 'person'}</strong></li>
                        </ul>
                    </div>
                </div>
            `;
        }

        // Update bulk modal pricing info
        const bulkModalPricingInfo = document.getElementById('bulkModalPricingInfo');
        if (bulkModalPricingInfo) {
            const lang = langManager.currentLang;

            bulkModalPricingInfo.innerHTML = `
                <p style="margin: 0; font-size: 0.95rem; color: var(--gray-700);">
                    <strong>${lang === 'cs' ? 'Fixní ceník pro hromadnou rezervaci:' : 'Fixed pricing for bulk booking:'}</strong><br>
                    • ${lang === 'cs' ? 'Základní cena' : 'Base price'}: ${bulkPrices.basePrice.toLocaleString()} Kč ${lang === 'cs' ? 'za noc' : 'per night'}<br>
                    • ${lang === 'cs' ? 'Externí dospělý' : 'External adult'}: +${bulkPrices.externalAdult} Kč/${lang === 'cs' ? 'osoba' : 'person'}<br>
                    • ${lang === 'cs' ? 'Externí dítě' : 'External child'}: +${bulkPrices.externalChild} Kč/${lang === 'cs' ? 'osoba' : 'person'}<br>
                    • ${lang === 'cs' ? 'Zaměstnanec ÚTIA dospělý' : 'ÚTIA employee adult'}: +${bulkPrices.utiaAdult} Kč/${lang === 'cs' ? 'osoba' : 'person'}<br>
                    • ${lang === 'cs' ? 'Dítě zaměstnance ÚTIA' : 'ÚTIA employee child'}: ${bulkPrices.utiaChild} Kč
                </p>
            `;
        }
    }

    // Theme management
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('preferred-theme', newTheme);

        // Update theme toggle icon
        const themeToggle = document.getElementById('themeToggle');
        const svg = themeToggle.querySelector('svg');

        if (newTheme === 'dark') {
            svg.innerHTML = `
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            `;
            themeToggle.title = langManager.currentLang === 'cs' ? 'Přepnout na světlý režim' : 'Switch to light mode';
        } else {
            svg.innerHTML = `
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            `;
            themeToggle.title = langManager.currentLang === 'cs' ? 'Přepnout na tmavý režim' : 'Switch to dark mode';
        }
    }

    // Initialize theme on load
    initTheme() {
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('preferred-theme');

        // Check for system preference
        const systemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // Use saved theme, or fall back to system preference
        const theme = savedTheme || (systemDarkMode ? 'dark' : 'light');

        document.documentElement.setAttribute('data-theme', theme);

        // Set initial icon
        const themeToggle = document.getElementById('themeToggle');
        const svg = themeToggle.querySelector('svg');

        if (theme === 'dark') {
            svg.innerHTML = `
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            `;
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('preferred-theme')) {
                const newTheme = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
            }
        });
    }

    // BULK BOOKING METHODS
    async openBulkBookingModal() {
        // Initialize bulk calendar state
        this.bulkSelectedDates = new Set();
        this.bulkCurrentMonth = new Date();

        // Render bulk calendar
        await this.renderBulkCalendar();

        document.getElementById('bulkBookingModal').classList.add('active');

        // Setup event listeners for bulk booking
        this.setupBulkBookingListeners();
    }

    setupBulkBookingListeners() {
        // Bulk calendar navigation
        const bulkPrevBtn = document.getElementById('bulkPrevMonth');
        const bulkNextBtn = document.getElementById('bulkNextMonth');

        if (bulkPrevBtn && !bulkPrevBtn.hasAttribute('data-listener-added')) {
            bulkPrevBtn.addEventListener('click', () => this.navigateBulkMonth(-1));
            bulkPrevBtn.setAttribute('data-listener-added', 'true');
        }

        if (bulkNextBtn && !bulkNextBtn.hasAttribute('data-listener-added')) {
            bulkNextBtn.addEventListener('click', () => this.navigateBulkMonth(1));
            bulkNextBtn.setAttribute('data-listener-added', 'true');
        }

        // Guest count change listeners for price calculation
        ['bulkGuestType', 'bulkAdults', 'bulkChildren'].forEach(id => {
            const element = document.getElementById(id);
            if (element && !element.hasAttribute('data-listener-added')) {
                element.addEventListener('change', async () => await this.updateBulkPrice());
                element.addEventListener('input', async () => await this.updateBulkPrice());
                element.setAttribute('data-listener-added', 'true');
            }
        });

        // Proceed button
        const proceedBtn = document.getElementById('proceedToBulkBooking');
        if (proceedBtn && !proceedBtn.hasAttribute('data-listener-added')) {
            proceedBtn.addEventListener('click', () => this.proceedToBulkBooking());
            proceedBtn.setAttribute('data-listener-added', 'true');
        }
    }

    async navigateBulkMonth(direction) {
        const newMonth = new Date(this.bulkCurrentMonth);
        newMonth.setMonth(newMonth.getMonth() + direction);

        // Check if we're within allowed range (same as main calendar)
        const newYear = newMonth.getFullYear();
        const newMonthNum = newMonth.getMonth();

        if (newYear < this.minYear) return;
        if (newYear > this.maxYear || (newYear === this.maxYear && newMonthNum > this.maxMonth)) return;

        this.bulkCurrentMonth = newMonth;
        await this.renderBulkCalendar();
    }

    async renderBulkCalendar() {
        const calendar = document.getElementById('bulkCalendar');
        const monthTitle = document.getElementById('bulkCurrentMonth');

        const year = this.bulkCurrentMonth.getFullYear();
        const month = this.bulkCurrentMonth.getMonth();

        // Update month title
        const monthNames = langManager.t('months');
        monthTitle.textContent = `${monthNames[month]} ${year}`;

        // Update navigation buttons
        const prevBtn = document.getElementById('bulkPrevMonth');
        const nextBtn = document.getElementById('bulkNextMonth');

        if (year <= this.minYear && month <= 0) {
            prevBtn.style.opacity = '0.3';
            prevBtn.style.cursor = 'not-allowed';
        } else {
            prevBtn.style.opacity = '1';
            prevBtn.style.cursor = 'pointer';
        }

        if (year === this.maxYear && month >= this.maxMonth) {
            nextBtn.style.opacity = '0.3';
            nextBtn.style.cursor = 'not-allowed';
        } else {
            nextBtn.style.opacity = '1';
            nextBtn.style.cursor = 'pointer';
        }

        // Clear calendar
        calendar.innerHTML = '';

        // Add day headers
        const dayHeaders = langManager.t('weekDays');
        const headerRow = document.createElement('div');
        headerRow.className = 'calendar-week';
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            dayHeader.style.cssText = 'font-weight: 600; text-align: center; padding: 0.5rem; background: var(--gray-100);';
            headerRow.appendChild(dayHeader);
        });
        calendar.appendChild(headerRow);

        // Get first day of month and adjust for Monday start
        const firstDay = new Date(year, month, 1);
        let startDay = firstDay.getDay() - 1;
        if (startDay < 0) startDay = 6;

        // Get days in month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // Create calendar grid
        let currentWeek = document.createElement('div');
        currentWeek.className = 'calendar-week';

        // Add previous month days
        for (let i = startDay - 1; i >= 0; i--) {
            const dayEl = await this.createBulkDayElement(
                new Date(year, month - 1, daysInPrevMonth - i),
                true
            );
            currentWeek.appendChild(dayEl);
        }

        // Add current month days
        for (let day = 1; day <= daysInMonth; day++) {
            if (currentWeek.children.length === 7) {
                calendar.appendChild(currentWeek);
                currentWeek = document.createElement('div');
                currentWeek.className = 'calendar-week';
            }

            const dayEl = await this.createBulkDayElement(new Date(year, month, day), false);
            currentWeek.appendChild(dayEl);
        }

        // Add next month days to complete the week
        let nextMonthDay = 1;
        while (currentWeek.children.length < 7) {
            const dayEl = await this.createBulkDayElement(
                new Date(year, month + 1, nextMonthDay),
                true
            );
            currentWeek.appendChild(dayEl);
            nextMonthDay++;
        }
        calendar.appendChild(currentWeek);
    }

    async createBulkDayElement(date, isOtherMonth) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (isOtherMonth) dayEl.classList.add('other-month');

        const dateStr = dataManager.formatDate(date);
        const isPast = date < this.today;
        const isChristmas = await dataManager.isChristmasPeriod(date);

        // Day header
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.style.cssText = 'padding: 0.5rem; text-align: center; font-weight: 600;';

        const dayNumber = document.createElement('div');
        dayNumber.textContent = isChristmas ? `🎄 ${date.getDate()}` : date.getDate();
        dayHeader.appendChild(dayNumber);

        dayEl.appendChild(dayHeader);

        // Add Christmas styling if applicable
        if (isChristmas && !isOtherMonth) {
            dayEl.classList.add('christmas');
            dayEl.style.border = '3px solid #ff8c00';
        }

        // Determine availability and reason for disabled state
        let isDisabled = false;
        let disabledReason = '';

        if (isPast) {
            isDisabled = true;
            disabledReason = 'Minulý datum';
        } else if (isOtherMonth) {
            isDisabled = true;
            disabledReason = 'Jiný měsíc';
        }

        // Check if day is usable for bulk booking
        if (isDisabled) {
            // Deactivated style for disabled dates
            dayEl.classList.add('disabled');
            dayEl.style.cssText = `background: var(--gray-200); color: var(--gray-500); cursor: pointer; opacity: 0.7; ${isChristmas ? 'border: 3px solid #ff8c00;' : ''}`;
            dayEl.title = disabledReason;

            // Add click handler to show reason
            dayEl.addEventListener('click', () => {
                this.showBulkDisabledReason(disabledReason);
            });
        } else {
            // Check room availability for current month, future dates
            const allRooms = await dataManager.getRooms();
            const roomAvailability = await this.checkBulkRoomAvailability(date, allRooms);

            if (roomAvailability.hasAnyBooking) {
                // Day has at least one booking - deactivate with same style as past dates
                dayEl.style.cssText = `background: var(--gray-200); color: var(--gray-500); cursor: pointer; opacity: 0.7; ${isChristmas ? 'border: 3px solid #ff8c00;' : ''}`;
                const reason = 'Některé pokoje jsou již rezervované - není možná hromadná rezervace';
                dayEl.title = reason;

                // Add click handler to show reason
                dayEl.addEventListener('click', () => {
                    this.showBulkDisabledReason(reason);
                });
            } else {
                // All rooms are available - GREEN for available days
                dayEl.style.cssText = `background: var(--success-50); border: 2px solid var(--success-200); cursor: pointer; transition: all 0.2s; ${isChristmas ? 'border: 3px solid #ff8c00;' : ''}`;

                // Check if this date is selected
                if (this.bulkSelectedDates.has(dateStr)) {
                    dayEl.style.cssText = `background: var(--success-500); color: white; border: 2px solid var(--success-700); cursor: pointer; ${isChristmas ? 'border: 3px solid #ff8c00;' : ''}`;
                }

                dayEl.addEventListener('click', async () => {
                    await this.toggleBulkDate(dateStr, dayEl);
                });

                dayEl.addEventListener('mouseover', () => {
                    if (!this.bulkSelectedDates.has(dateStr)) {
                        dayEl.style.background = 'var(--success-100)';
                        if (isChristmas) dayEl.style.border = '3px solid #ff8c00';
                    }
                });

                dayEl.addEventListener('mouseout', () => {
                    if (!this.bulkSelectedDates.has(dateStr)) {
                        dayEl.style.background = 'var(--success-50)';
                        if (isChristmas) dayEl.style.border = '3px solid #ff8c00';
                    }
                });
            }
        }

        return dayEl;
    }

    showBulkDisabledReason(reason) {
        const lang = this.currentLanguage || 'cs';
        alert(reason);
    }

    async checkBulkRoomAvailability(date, allRooms) {
        let availableCount = 0;
        let bookedCount = 0;
        let hasAnyBooking = false;

        for (let room of allRooms) {
            const availability = await dataManager.getRoomAvailability(date, room.id);
            if (availability.status === 'available') {
                availableCount++;
            } else {
                bookedCount++;
                hasAnyBooking = true;
            }
        }

        return {
            totalRooms: allRooms.length,
            availableCount,
            bookedCount,
            hasAnyBooking,
            allAvailable: availableCount === allRooms.length
        };
    }

    async toggleBulkDate(dateStr, dayEl) {
        const date = new Date(dateStr);
        const isChristmas = await dataManager.isChristmasPeriod(date);

        // Check if trying to select a Christmas date before October 1st
        if (!this.bulkSelectedDates.has(dateStr) && isChristmas && !await dataManager.canBulkBookChristmas()) {
            const lang = this.currentLanguage || 'cs';
            const message = lang === 'cs'
                ? 'Vánoční období - hromadné rezervace povoleny až od 1.10. daného roku.'
                : 'Christmas period - bulk bookings allowed only from October 1st of the given year.';
            alert(message);
            return;
        }

        if (this.bulkSelectedDates.has(dateStr)) {
            // Remove date
            this.bulkSelectedDates.delete(dateStr);
            dayEl.style.cssText = `background: var(--success-50); border: 2px solid var(--success-200); cursor: pointer; transition: all 0.2s; ${isChristmas ? 'border: 3px solid #ff8c00;' : ''}`;
        } else {
            // Add date
            this.bulkSelectedDates.add(dateStr);
            dayEl.style.cssText = `background: var(--success-500); color: white; border: 2px solid var(--success-700); cursor: pointer; ${isChristmas ? 'border: 3px solid #ff8c00;' : ''}`;
        }

        await this.updateBulkDateSelection();
    }

    async getFullyAvailableDates() {
        const availableDates = [];
        const allRooms = await dataManager.getRooms();

        // Check dates for the next 365 days starting from today
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + 365);

        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            // Skip past dates
            if (date < this.today) continue;

            const dateStr = dataManager.formatDate(date);

            // Use new availability checking method
            const roomAvailability = await this.checkBulkRoomAvailability(date, allRooms);

            // Only include dates with no bookings at all
            if (!roomAvailability.hasAnyBooking) {
                availableDates.push(dateStr);
            }
        }

        return availableDates;
    }

    async updateBulkDateSelection() {
        const guestInfo = document.getElementById('bulkGuestInfo');
        const proceedBtn = document.getElementById('proceedToBulkBooking');

        if (this.bulkSelectedDates.size > 0) {
            guestInfo.style.display = 'block';
            proceedBtn.style.display = 'inline-block';
            await this.updateBulkPrice();
        } else {
            guestInfo.style.display = 'none';
            proceedBtn.style.display = 'none';
        }
    }

    async updateBulkPrice() {
        const nights = this.bulkSelectedDates.size;

        if (nights === 0) return;

        const guestType = document.getElementById('bulkGuestType').value;
        const adults = parseInt(document.getElementById('bulkAdults').value) || 0;
        const children = parseInt(document.getElementById('bulkChildren').value) || 0;

        // Bulk booking prices (from admin settings)
        const settings = await dataManager.getSettings();
        const bulkPrices = settings.bulkPrices || {
            basePrice: 2000,
            utiaAdult: 100,
            utiaChild: 0,
            externalAdult: 250,
            externalChild: 50
        };

        const basePrice = bulkPrices.basePrice;
        let adultPrice = guestType === 'external' ? bulkPrices.externalAdult : bulkPrices.utiaAdult;
        let childPrice = guestType === 'external' ? bulkPrices.externalChild : bulkPrices.utiaChild;

        const totalBasePrice = basePrice * nights;
        const totalAdultPrice = adultPrice * adults * nights;
        const totalChildPrice = childPrice * children * nights;
        const totalPrice = totalBasePrice + totalAdultPrice + totalChildPrice;

        // Get selected dates for display as interval
        const selectedDatesArray = Array.from(this.bulkSelectedDates).sort();
        let formattedDates;
        if (selectedDatesArray.length === 1) {
            const date = new Date(selectedDatesArray[0]);
            formattedDates = `${date.getDate()}.${date.getMonth() + 1}.`;
        } else if (selectedDatesArray.length > 1) {
            const firstDate = new Date(selectedDatesArray[0]);
            const lastDate = new Date(selectedDatesArray[selectedDatesArray.length - 1]);
            formattedDates = `${firstDate.getDate()}.${firstDate.getMonth() + 1}. - ${lastDate.getDate()}.${lastDate.getMonth() + 1}.`;
        } else {
            formattedDates = '';
        }

        // Helper function for plurals
        const getPlural = (count, singularKey, pluralKey2to4, pluralKey5plus) => {
            if (count === 1) return langManager.t(singularKey);
            if (count < 5) return langManager.t(pluralKey2to4);
            return langManager.t(pluralKey5plus);
        };

        // Update price breakdown - show details in two compact lines
        const breakdown = document.getElementById('bulkPriceBreakdown');
        breakdown.innerHTML = `
            <div style="display: block; margin-bottom: 1rem;">
                <div style="margin-bottom: 0.5rem;">
                    <span style="font-weight: 600; color: var(--primary-700); font-size: 1rem;">${langManager.t('selectedTerms')}: ${formattedDates}</span>
                </div>
                <div style="color: var(--gray-600); font-size: 0.9rem;">
                    ${nights} ${getPlural(nights, 'night', 'nights2to4', 'nights5plus')} × ${basePrice.toLocaleString()} Kč = ${totalBasePrice.toLocaleString()} Kč${adults > 0 ? ` • ${adults} ${getPlural(adults, 'adult', 'adults2to4', 'adults5plus')} × ${adultPrice} Kč × ${nights} ${getPlural(nights, 'night', 'nights2to4', 'nights5plus')} = ${totalAdultPrice.toLocaleString()} Kč` : ''}${children > 0 ? ` • ${children} ${getPlural(children, 'child', 'children2to4', 'children5plus')} × ${childPrice} Kč × ${nights} ${getPlural(nights, 'night', 'nights2to4', 'nights5plus')} = ${totalChildPrice.toLocaleString()} Kč` : ''}
                </div>
            </div>
        `;

        // Update the main total price display (will appear after breakdown)
        document.getElementById('bulkTotalPrice').textContent = `${totalPrice.toLocaleString()} Kč`;
    }

    // Method for admin panel to refresh bulk pricing when settings change
    async updateBulkPriceCalculation() {
        if (this.bulkSelectedDates && this.bulkSelectedDates.size > 0) {
            await this.updateBulkPrice();
        }
    }

    proceedToBulkBooking() {
        // Get selected dates
        const selectedDates = Array.from(this.bulkSelectedDates);

        if (selectedDates.length === 0) {
            alert('Prosím vyberte alespoň jeden termín.');
            return;
        }

        // Store bulk booking data for use in regular booking flow
        this.bulkBookingData = {
            dates: selectedDates,
            guestType: document.getElementById('bulkGuestType').value,
            adults: parseInt(document.getElementById('bulkAdults').value) || 0,
            children: parseInt(document.getElementById('bulkChildren').value) || 0,
            toddlers: 0, // Not used in bulk bookings
            totalPrice: parseInt(document.getElementById('bulkTotalPrice').textContent.replace(/[^\d]/g, ''))
        };

        // Close bulk modal and open regular booking form
        document.getElementById('bulkBookingModal').classList.remove('active');

        // Prepare summary for bulk booking
        this.prepareBulkSummary();

        // Open booking form modal
        document.getElementById('bookingFormModal').classList.add('active');
    }

    prepareBulkSummary() {
        const summaryContainer = document.getElementById('bookingSummary');
        const data = this.bulkBookingData;

        const sortedDates = data.dates.sort();
        const startDate = new Date(sortedDates[0]);
        const endDate = new Date(sortedDates[sortedDates.length - 1]);

        const lang = langManager.currentLang;
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const locale = lang === 'cs' ? 'cs-CZ' : 'en-US';

        summaryContainer.innerHTML = `
            <div><strong>Typ rezervace:</strong> Hromadná rezervace celé chaty</div>
            <div><strong>${langManager.t('term')}:</strong> ${startDate.toLocaleDateString(locale, dateOptions)} - ${endDate.toLocaleDateString(locale, dateOptions)}</div>
            <div><strong>Pokoje:</strong> Všechny pokoje (12, 13, 14, 22, 23, 24, 42, 43, 44)</div>
            <div><strong>${langManager.t('nights')}:</strong> ${data.dates.length}</div>
            <div><strong>${langManager.t('guestType')}:</strong> ${data.guestType === 'utia' ? langManager.t('guestTypeEmployee') : langManager.t('guestTypeExternal')}</div>
            <div><strong>${langManager.t('guests')}:</strong> ${data.adults} ${langManager.t('adults')}${data.children > 0 ? `, ${data.children} ${langManager.t('children')}` : ''}</div>
            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 2px solid var(--gray-200);">
                <strong>${langManager.t('totalPrice')}:</strong> <span style="color: var(--primary-color); font-size: 1.25rem;">${data.totalPrice.toLocaleString()} Kč</span>
            </div>
        `;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.bookingApp = new BookingApp();
});