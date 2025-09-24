// Translation system
const translations = {
    cs: {
        // Header
        roomInfo: 'Informace o pokojích',
        admin: 'Admin',

        // Calendar
        months: ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
                'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'],
        weekDays: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],

        // Room card
        capacity: 'Kapacita',
        guestTypeLabel: 'Typ hosta',
        adultsLabel: 'Dospělí',
        childrenLabel: 'Děti (3-18)',
        toddlersLabel: 'Batolata (<3)',
        employeeLabel: 'Zaměstnanec ÚTIA',
        externalLabel: 'Externí host',
        externalGuests: 'Externí hosté',
        guestCount: 'Počet hostů',
        roomPrice: 'Cena za pokoj',

        // Booking section
        newBooking: 'Nová rezervace',
        selectDatePrompt: 'Vyberte termín v kalendáři',
        selectRoom: 'Vyberte pokoj',
        rooms: 'Pokoje',

        // Price calculator
        priceCalculation: 'Kalkulace ceny',
        availableCapacity: 'Dostupná kapacita',
        guestTypeEmployee: 'Zaměstnanec ÚTIA',
        guestTypeExternal: 'Externí host',
        adults: 'Dospělí',
        children: 'Děti (3-18 let)',
        toddlers: 'Děti do 3 let',
        totalPrice: 'Celková cena',

        // Booking button
        createBooking: 'Vytvořit rezervaci',
        bulkBooking: 'Hromadná akce',
        bulkBookingTitle: 'Hromadná rezervace celé chaty',
        bulkPricingInfo: '<strong>Fixní ceník pro hromadnou rezervaci:</strong><br>• Základní cena: 2000 Kč za noc<br>• Externí dospělý: +250 Kč/osoba<br>• Externí dítě: +50 Kč/osoba<br>• Zaměstnanec ÚTIA dospělý: +100 Kč/osoba<br>• Dítě zaměstnance ÚTIA: 0 Kč',
        bulkDateSelection: 'Výběr termínů pro hromadnou rezervaci',
        bulkDateSelectionInfo: 'Vyberte dny v kalendáři. Šedé dny mají rezervace a nelze je vybrat. Zelené dny jsou plně volné pro hromadnou rezervaci.',
        guestInfo: 'Informace o hostech',
        bulkTotalPriceLabel: 'Celková cena za vybrané dny:',
        cancel: 'Zrušit',
        proceedToBooking: 'Pokračovat k rezervaci',

        // Booking modal
        completeBooking: 'Dokončení rezervace',
        bookingSummary: 'Souhrn rezervace',
        term: 'Termín',
        nights: 'Počet nocí',
        guestType: 'Typ hosta',
        guests: 'Hosté',

        // Form fields
        billingDetails: 'Fakturační údaje',
        name: 'Jméno a příjmení',
        email: 'Email',
        phone: 'Telefon',
        company: 'Firma',
        address: 'Adresa',
        city: 'Město',
        zip: 'PSČ',
        ico: 'IČO',
        dic: 'DIČ',
        notes: 'Poznámky',
        cancel: 'Zrušit',
        confirmBooking: 'Potvrdit rezervaci',

        // Room info modal
        roomInfoTitle: 'Informace o pokojích',
        roomCapacity: 'Kapacita pokojů',
        totalCapacity: 'Celková kapacita: 26 lůžek',
        roomLayout: 'Rozložení pokojů',
        floor: 'patro',
        attic: 'podkroví',
        smallRoom: 'Malý pokoj',
        largeRoom: 'Velký pokoj',
        beds: 'lůžka',
        bed: 'lůžko',
        priceList: 'Ceník',
        employeesPricing: 'Zaměstnanci ÚTIA',
        externalPricing: 'Externí hosté',
        smallRooms: 'Malé pokoje',
        largeRooms: 'Velké pokoje',
        basePrice: 'Základní cena (1 osoba)',
        additionalAdult: 'Další dospělý',
        childPrice: 'Dítě 3-18 let',
        toddlerPrice: 'Dítě do 3 let',
        free: 'zdarma',
        perNight: '/noc',
        perPerson: '/osoba',
        christmasPeriod: 'Vánoční období',
        christmasRules: 'Rezervace během vánočních prázdnin podléhají speciálním pravidlům. Zaměstnanci ÚTIA mohou rezervovat max. 1-2 pokoje do 30.9. příslušného roku.',
        christmasTitle: '🎄 Vánoční období',
        christmasInfo: 'Rezervace během vánočních prázdnin podléhají speciálním pravidlům. Zaměstnanci ÚTIA mohou rezervovat max. 1-2 pokoje do 30.9. příslušného roku.',

        // Status
        available: 'Volný',
        booked: 'Obsazený',
        blocked: 'Blokovaný',

        // Messages
        selectDateError: 'Prosím vyberte termín rezervace',
        selectRoomError: 'Prosím vyberte alespoň jeden pokoj',
        bookingSuccess: 'Rezervace byla úspěšně vytvořena! Číslo rezervace:',
        confirmationSent: 'Potvrzení bylo odesláno na email',

        // Booking details modal
        bookingDetails: 'Detail rezervace',
        bookingNumber: 'Číslo rezervace',
        created: 'Vytvořeno',
        contactOwner: 'Kontaktovat vlastníka',
        contactOwnerTitle: 'Kontaktovat vlastníka rezervace',
        contactOwnerInfo: 'Vaše zpráva bude odeslána vlastníkovi rezervace. Email vlastníka zůstává skrytý.',
        yourEmail: 'Váš email',
        message: 'Zpráva',
        sendMessage: 'Odeslat zprávu',
        messageSent: 'Zpráva byla úspěšně odeslána vlastníkovi rezervace',

        // Bulk pricing
        bulkPriceList: 'Ceník hromadné rezervace',
        bulkPriceNote: 'Poznámka: Hromadná rezervace znamená pronájem celé chaty pro jeden termín. Děti do 3 let jsou vždy zdarma.',
        selectedTerms: 'Vybrané termíny',

        // Units and plurals
        night: 'noc',
        nights2to4: 'noci',
        nights5plus: 'nocí',
        adult: 'dospělý',
        adults2to4: 'dospělí',
        adults5plus: 'dospělých',
        child: 'dítě',
        children2to4: 'děti',
        children5plus: 'dětí'
    },
    en: {
        // Header
        roomInfo: 'Room Information',
        admin: 'Admin',

        // Calendar
        months: ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'],
        weekDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],

        // Room card
        capacity: 'Capacity',
        guestTypeLabel: 'Guest Type',
        adultsLabel: 'Adults',
        childrenLabel: 'Children (3-18)',
        toddlersLabel: 'Toddlers (<3)',
        employeeLabel: 'ÚTIA Employee',
        externalLabel: 'External Guest',
        externalGuests: 'External Guests',
        guestCount: 'Number of Guests',
        roomPrice: 'Room Price',

        // Booking section
        newBooking: 'New Booking',
        selectDatePrompt: 'Select dates in the calendar',
        selectRoom: 'Select room',
        rooms: 'Rooms',

        // Price calculator
        priceCalculation: 'Price Calculation',
        availableCapacity: 'Available Capacity',
        guestTypeEmployee: 'ÚTIA Employee',
        guestTypeExternal: 'External Guest',
        adults: 'Adults',
        children: 'Children (3-18 years)',
        toddlers: 'Children under 3',
        totalPrice: 'Total Price',

        // Booking button
        createBooking: 'Create Booking',
        bulkBooking: 'Bulk Booking',
        bulkBookingTitle: 'Bulk Booking - Entire Cottage',
        bulkPricingInfo: '<strong>Fixed pricing for bulk booking:</strong><br>• Base price: 2000 CZK per night<br>• External adult: +250 CZK/person<br>• External child: +50 CZK/person<br>• ÚTIA employee adult: +100 CZK/person<br>• ÚTIA employee child: 0 CZK',
        bulkDateSelection: 'Date Selection for Bulk Booking',
        bulkDateSelectionInfo: 'Select days in the calendar. Gray days have bookings and cannot be selected. Green days are fully available for bulk booking.',
        guestInfo: 'Guest Information',
        bulkTotalPriceLabel: 'Total price for selected days:',
        cancel: 'Cancel',
        proceedToBooking: 'Proceed to Booking',

        // Booking modal
        completeBooking: 'Complete Booking',
        bookingSummary: 'Booking Summary',
        term: 'Period',
        nights: 'Number of nights',
        guestType: 'Guest Type',
        guests: 'Guests',

        // Form fields
        billingDetails: 'Billing Details',
        name: 'Full Name',
        email: 'Email',
        phone: 'Phone',
        company: 'Company',
        address: 'Address',
        city: 'City',
        zip: 'ZIP Code',
        ico: 'Company ID',
        dic: 'VAT ID',
        notes: 'Notes',
        cancel: 'Cancel',
        confirmBooking: 'Confirm Booking',

        // Room info modal
        roomInfoTitle: 'Room Information',
        roomCapacity: 'Room Capacity',
        totalCapacity: 'Total capacity: 26 beds',
        roomLayout: 'Room Layout',
        floor: 'floor',
        attic: 'attic',
        smallRoom: 'Small room',
        largeRoom: 'Large room',
        beds: 'beds',
        bed: 'bed',
        priceList: 'Price List',
        employeesPricing: 'ÚTIA Employees',
        externalPricing: 'External Guests',
        smallRooms: 'Small rooms',
        largeRooms: 'Large rooms',
        basePrice: 'Base price (1 person)',
        additionalAdult: 'Additional adult',
        childPrice: 'Child 3-18 years',
        toddlerPrice: 'Child under 3',
        free: 'free',
        perNight: '/night',
        perPerson: '/person',
        christmasPeriod: 'Christmas Period',
        christmasRules: 'Bookings during Christmas holidays are subject to special rules. ÚTIA employees can book max. 1-2 rooms until September 30th of the respective year.',
        christmasTitle: '🎄 Christmas Period',
        christmasInfo: 'Bookings during Christmas holidays are subject to special rules. ÚTIA employees can book max. 1-2 rooms until September 30th of the respective year.',

        // Status
        available: 'Available',
        booked: 'Booked',
        blocked: 'Blocked',

        // Messages
        selectDateError: 'Please select booking dates',
        selectRoomError: 'Please select at least one room',
        bookingSuccess: 'Booking successfully created! Booking number:',
        confirmationSent: 'Confirmation has been sent to email',

        // Booking details modal
        bookingDetails: 'Booking Details',
        bookingNumber: 'Booking Number',
        created: 'Created',
        contactOwner: 'Contact Owner',
        contactOwnerTitle: 'Contact Booking Owner',
        contactOwnerInfo: 'Your message will be sent to the booking owner. The owner\'s email remains hidden.',
        yourEmail: 'Your email',
        message: 'Message',
        sendMessage: 'Send Message',
        messageSent: 'Message successfully sent to booking owner',

        // Bulk pricing
        bulkPriceList: 'Bulk Booking Price List',
        bulkPriceNote: 'Note: Bulk booking means renting the entire cottage for one period. Children under 3 are always free.',
        selectedTerms: 'Selected dates',

        // Units and plurals (in English, plurals are simpler)
        night: 'night',
        nights2to4: 'nights',
        nights5plus: 'nights',
        adult: 'adult',
        adults2to4: 'adults',
        adults5plus: 'adults',
        child: 'child',
        children2to4: 'children',
        children5plus: 'children'
    }
};

class LanguageManager {
    constructor() {
        this.currentLang = localStorage.getItem('language') || 'cs';
        this.init();
    }

    init() {
        // Set initial language
        document.documentElement.lang = this.currentLang;

        // Set switch position
        const languageSwitch = document.getElementById('languageSwitch');
        if (languageSwitch) {
            languageSwitch.checked = this.currentLang === 'en';
        }

        // Apply translations
        this.applyTranslations();
    }

    switchLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('language', lang);
        document.documentElement.lang = lang;
        this.applyTranslations();
    }

    t(key) {
        return translations[this.currentLang][key] || translations['cs'][key] || key;
    }

    applyTranslations() {
        // Update all elements with data-translate attribute
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            const translation = this.t(key);

            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.placeholder) {
                    element.placeholder = translation;
                }
            } else {
                element.textContent = translation;
            }
        });

        // Update specific elements
        this.updateSpecificElements();
    }

    updateSpecificElements() {
        // Update room info button
        const roomInfoBtn = document.getElementById('roomInfoBtn');
        if (roomInfoBtn) {
            const btnText = roomInfoBtn.querySelector('.btn-text');
            if (btnText) btnText.textContent = this.t('roomInfo');
        }

        // Update room beds text
        document.querySelectorAll('.room-beds').forEach(element => {
            const beds = element.getAttribute('data-beds');
            if (beds) {
                const text = this.currentLang === 'cs'
                    ? `${beds} ${beds === '1' ? 'lůžko' : 'lůžka'}`
                    : `${beds} ${beds === '1' ? 'bed' : 'beds'}`;
                element.textContent = text;
            }
        });

        // NOTE: Calendar is updated separately in the language switch event listener
        // to avoid duplicate rendering
    }
}

// Export for use
const langManager = new LanguageManager();