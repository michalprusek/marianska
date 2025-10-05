// Translation system
const translations = {
  cs: {
    // Header
    roomInfo: 'Informace o pokojích',
    admin: 'Admin',

    // Calendar
    months: [
      'Leden',
      'Únor',
      'Březen',
      'Duben',
      'Květen',
      'Červen',
      'Červenec',
      'Srpen',
      'Září',
      'Říjen',
      'Listopad',
      'Prosinec',
    ],
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
    bulkPricingInfo:
      '<strong>Fixní ceník pro hromadnou rezervaci:</strong><br>• Základní cena: 2000 Kč za noc<br>• Externí dospělý: +250 Kč/osoba<br>• Externí dítě: +50 Kč/osoba<br>• Zaměstnanec ÚTIA dospělý: +100 Kč/osoba<br>• Dítě zaměstnance ÚTIA: 0 Kč',
    bulkDateSelection: 'Výběr termínů pro hromadnou rezervaci',
    bulkDateSelectionInfo:
      'Vyberte dny v kalendáři. Šedé dny mají rezervace a nelze je vybrat. Zelené dny jsou plně volné pro hromadnou rezervaci.',
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
    christmasRules:
      'Rezervace během vánočních prázdnin podléhají speciálním pravidlům. Zaměstnanci ÚTIA mohou rezervovat max. 1-2 pokoje do 30.9. příslušného roku.',
    christmasTitle: '🎄 Vánoční období',
    christmasInfo:
      'Rezervace během vánočních prázdnin podléhají speciálním pravidlům. Zaměstnanci ÚTIA mohou rezervovat max. 1-2 pokoje do 30.9. příslušného roku.',

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
    contactOwnerInfo:
      'Vaše zpráva bude odeslána vlastníkovi rezervace. Email vlastníka zůstává skrytý.',
    yourEmail: 'Váš email',
    message: 'Zpráva',
    sendMessage: 'Odeslat zprávu',
    messageSent: 'Zpráva byla úspěšně odeslána vlastníkovi rezervace',

    // Bulk pricing
    bulkPriceList: 'Ceník hromadné rezervace',
    bulkPriceNote:
      'Poznámka: Hromadná rezervace znamená pronájem celé chaty pro jeden termín. Děti do 3 let jsou vždy zdarma.',
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
    children5plus: 'dětí',

    // Legend
    legend: 'Legenda',
    legendTitle: 'Vysvětlení barev a stavů v kalendáři',
    legendRoomStates: 'Stavy pokojů',
    legendTimeIndicators: 'Časové indikátory',
    legendAvailable: 'Volný pokoj',
    legendAvailableDesc: 'Pokoj je k dispozici pro rezervaci',
    legendOccupied: 'Obsazený pokoj',
    legendOccupiedDesc: 'Obě noci kolem dne jsou obsazeny - neklikatelný (červený)',
    legendBooked: 'Obsazený pokoj',
    legendBookedDesc: 'Obě noci kolem dne jsou obsazeny - neklikatelný (červený)',
    legendNewBooking: 'Nově rezervovaný pokoj',
    legendNewBookingDesc: 'Pokoj právě rezervovaný (oranžová barva)',
    newReservations: 'Nové rezervace',
    finalizeReservations: 'Dokončit všechny rezervace',
    changeReservation: 'Změnit rezervaci',
    removeReservation: 'Odstranit rezervaci',
    addReservation: 'Přidat rezervaci',
    legendBlocked: 'Blokovaný pokoj',
    legendBlockedDesc: 'Pokoj je administrativně blokován ❌',
    legendEdge: 'Krajní den rezervace',
    legendEdgeDesc:
      'Krajní den (jedna noc obsazena) - napůl zelený (volný) a napůl červený (obsazený). Klikatelný pro novou rezervaci.',
    legendChristmas: 'Vánoční období',
    legendChristmasDesc: 'Speciální období s omezeným přístupem',
    legendPastDates: 'Minulé dny',
    legendPastDatesDesc: 'Dny v minulosti nejsou k dispozici',
    legendClickInstructions: 'Pokyny pro použití',
    legendClickAvailable: 'Klikněte na zelený pokoj pro výběr',
    legendClickBooked: 'Klikněte na oranžový pokoj pro zobrazení detailu rezervace',
    legendClickBlocked: 'Klikněte na ❌ pro zobrazení důvodu blokace',
    legendReportBugs: 'Chyby hlaste na: prusek@utia.cas.cz',
    showLegend: 'Zobrazit legendu',
    hideLegend: 'Skrýt legendu',

    // Additional missing translations
    contactDetails: 'Kontaktní údaje',
    fullName: 'Jméno a příjmení *',
    paymentFromBenefit: 'Platba z benefitů',
    pendingReservations: 'Připravené rezervace',
    reservationSummary: 'Souhrn rezervace',
    legendProposed: 'Navrhovaná rezervace',
    legendProposedDesc: 'Rezervace čekající na dokončení (žlutá barva)',

    // Notification messages
    selectDatesAndRoomsError: 'Vyberte prosím termín a pokoje',
    fillRequiredFieldsError: 'Vyplňte prosím všechna povinná pole',
    enterValidEmailError: 'Zadejte prosím platný email',
    allReservationsCreated: '✓ Všechny rezervace byly úspěšně vytvořeny',
    partialSuccess: 'Částečný úspěch: {successCount} rezervací vytvořeno, {errorCount} selhalo',
    errorCreatingReservations: 'Chyba při vytváření rezervací',
    bookingCreatedSuccess: '✓ Rezervace byla úspěšně vytvořena',
    editBookingLink: 'Pro úpravu rezervace použijte tento odkaz: {editUrl}',
    errorCreatingBooking: 'Chyba při vytváření rezervace',
    roomCapacityError: '{roomName} má kapacitu pouze {beds} lůžek (batolata se nepočítají)',
    errorLoadingBookingDetails: 'Chyba při načítání detailu rezervace',
    errorLoadingBlockedDetails: 'Chyba při načítání detailu blokace',
    reservationRemoved: 'Rezervace pokoje {roomName} byla odebrána',
    noReservationsToFinalize: 'Nejsou žádné rezervace k dokončení',
    errorCreatingBookingForRoom: 'Chyba při vytváření rezervace pro {roomName}',
    successfullyCreatedBookings: 'Úspěšně vytvořeno {count} rezervací',
    fillAllFieldsError: 'Vyplňte prosím všechna pole a zadejte platný email',
    messageSentSuccess: '✓ Zpráva byla úspěšně odeslána',
    errorSendingMessage: 'Chyba při odesílání zprávy. Zkuste to prosím znovu.',
    minimumBookingError: 'Minimální rezervace je na 1 noc (2 dny). Následující den není dostupný.',
    selectDatesError: 'Vyberte prosím termín pobytu',
    minimumOneNightError: 'Minimální rezervace je na 1 noc (2 dny)',
    noRoomSelectedError: 'Chyba: Žádný pokoj není vybrán',
    roomNotFoundError: 'Chyba: Pokoj nebyl nalezen',
    roomAddedToReservation: '{roomName} přidán do rezervace',
    bulkBookingChristmasError:
      'Hromadné rezervace v období vánočních prázdnin nejsou po 1.10. povoleny',
    bulkBookingCreatedSuccess: '✓ Hromadná rezervace byla úspěšně vytvořena',
    bookingNumberPrefix: 'Rezervace',
    toddler: 'batole',

    // Admin panel translations
    adminPanel: 'Admin Panel',
    backToReservations: 'Zpět na rezervace',
    logout: 'Odhlásit',
    adminLogin: 'Přihlášení administrátora',
    password: 'Heslo',
    login: 'Přihlásit',
    bookingsTab: 'Rezervace',
    blockedDatesTab: 'Blokované termíny',
    christmasAccessTab: 'Vánoční přístup',
    christmasCodeLabel: 'Vánoční přístupový kód',
    christmasCodePlaceholder: 'Zadejte přístupový kód pro vánoční období',
    christmasCodeRequired: 'Pro rezervace ve vánočním období je vyžadován přístupový kód',
    bulkBlockedAfterOct1:
      'Hromadné rezervace celé chaty nejsou po 1. říjnu povoleny pro vánoční období. Rezervujte jednotlivé pokoje.',
    roomConfigTab: 'Nastavení pokojů a cen',
    statisticsTab: 'Statistiky',
    systemSettingsTab: 'Nastavení systému',
    bookingsManagement: 'Správa rezervací',
    searchPlaceholder: 'Hledat podle jména, emailu nebo čísla rezervace...',
    bookingNumberShort: 'Číslo',
    actions: 'Akce',
    view: 'Zobrazit',
    edit: 'Upravit',
    delete: 'Smazat',
    blockedDatesManagement: 'Blokované termíny',
    addBlockage: 'Přidat blokaci',
    startDate: 'Od data',
    endDate: 'Do data',
    reason: 'Důvod',
    reasonPlaceholder: 'Údržba, soukromá akce...',
    selectRoomsToBlock: 'Vyberte pokoje k blokování:',
    allRooms: 'Všechny',
    addBlockageButton: 'Přidat blokaci',
    currentBlockages: 'Aktuální blokace',
    christmasPeriodManagement: 'Vánoční období a přístupové kódy',
    christmasPeriodSettings: 'Správa vánočních období',
    christmasPeriodDescription:
      'Definujte období školních vánočních prázdnin. Tato období budou v kalendáři vizuálně označena.',
    periodStart: 'Začátek období',
    periodEnd: 'Konec období',
    addPeriod: 'Přidat období',
    activeChristmasPeriods: 'Aktivní vánoční období',
    christmasRulesTitle: '⚠️ Pravidla pro vánoční období',
    christmasRule1: 'Období: Školní vánoční prázdniny a bezprostředně přilehlé víkendy',
    christmasRule2:
      'Do 30.9.: Zaměstnanci mohou rezervovat 1 pokoj (2 pokoje při plném obsazení rodinou)',
    christmasRule3: 'Od 1.10.: Volná kapacita bez omezení dle pořadí',
    christmasRule4: 'Při převisu poptávky: Rozhoduje los (zajistí provozní oddělení)',
    accessCodesForEmployees: 'Přístupové kódy pro zaměstnance',
    accessCodesDescription:
      'Zaměstnanci s těmito kódy mohou rezervovat během vánočního období do 30.9. daného roku.',
    enterAccessCode: 'Zadejte přístupový kód',
    addCode: 'Přidat kód',
    activeCodes: 'Aktivní kódy',
    roomPriceConfiguration: 'Nastavení pokojů a cen',
    roomConfiguration: 'Konfigurace pokojů',
    roomConfigDescription: 'Nastavte kapacitu a typ každého pokoje',
    priceConfiguration: 'Konfigurace ceníku',
    utiaEmployees: 'Zaměstnanci ÚTIA',
    basePriceOneRoom: 'Základní cena (1 pokoj, 1 osoba)',
    additionalAdultPrice: 'Další dospělý',
    childPriceRange: 'Dítě 3-18 let',
    externalGuestsPrice: 'Externí hosté',
    saveRoomConfig: 'Uložit konfiguraci pokojů',
    savePriceConfig: 'Uložit ceník',
    bulkBookingPriceConfig: 'Ceník hromadné rezervace',
    bulkBookingDescription: 'Nastavte ceny pro rezervaci celé chaty v jediném termínu',
    fixedBasePrice: 'Fixní cena za noc',
    fixedBasePriceNote: 'Základní poplatek za rezervaci celé chaty',
    personFees: 'Poplatky za osoby',
    utiaEmployeesShort: 'Zaměstnanci ÚTIA',
    externalGuestsShort: 'Externí hosté',
    adultFee: 'Dospělý',
    childFee: 'Dítě (3-18 let)',
    childrenUnder3Free:
      '<strong>Poznámka:</strong> Děti do 3 let jsou vždy zdarma a nezapočítávají se do kapacity pokojů.',
    saveBulkPriceConfig: 'Uložit ceník hromadné rezervace',
    changeAdminPassword: 'Změna admin hesla',
    currentPassword: 'Současné heslo',
    newPassword: 'Nové heslo',
    confirmNewPassword: 'Potvrzení nového hesla',
    changePassword: 'Změnit heslo',
    emailSettings: 'Email nastavení',
    emailMockNote:
      'Systém momentálně používá mock emaily. Všechny emaily jsou logovány do konzole.',
    emailTemplateSettings: 'Šablona potvrzovacího emailu',
    emailTemplateDescription: 'Nastavte text emailu, který obdrží hosté po úspěšné rezervaci.',
    emailSubject: 'Předmět emailu',
    emailBody: 'Text emailu',
    saveEmailTemplate: 'Uložit šablonu emailu',

    // Edit page translations
    editReservation: '✨ Upravit rezervaci',
    bookingIdLabel: '🎯 ID',
    loading: 'Načítání...',
    datesAndRoomsTab: '📅 Termín a pokoje',
    personalInfoTab: '👤 Osobní údaje',
    billingInfoTab: '💳 Fakturační údaje',
    selectStayDates: '📆 Vyberte termíny pobytu',
    previousMonth: '← Předchozí',
    nextMonth: 'Další →',
    selectedDates: '📌 Vybrané termíny:',
    noSelectedDates: 'Zatím nejsou vybrány žádné termíny',
    clearAllDates: '🗑️ Vymazat všechny termíny',
    selectRoomsAndGuests: '🏠 Vyberte pokoje a nastavte hosty',
    guestsCount: 'Počet hostů',
    guestTypeUtia: '🏢 ÚTIA',
    guestTypeExternalEdit: '👥 Externí',
    priceSummaryLabel: '💰 Celková cena',
    capacityExceeded: '⚠️ Překročena kapacita pokoje!',
    noConflicts: '✅ Žádné konflikty - termíny a pokoje jsou volné',
    conflictingReservations: '⚠️ Konfliktní rezervace',
    fullNameEdit: '👤 Jméno a příjmení',
    emailAddress: '📧 Email',
    phoneNumber: '📱 Telefon',
    notesField: '📝 Poznámky',
    notesPlaceholder: 'Zde můžete napsat speciální požadavky...',
    companyName: '🏢 Firma',
    streetAddress: '📍 Adresa',
    cityName: '🏙️ Město',
    postalCode: '📮 PSČ',
    companyId: '🔢 IČO',
    vatId: '💼 DIČ',
    paymentFromBenefits: '💳 Platba z benefitů',
    backButton: '← Zpět',
    saveChanges: '💾 Uložit změny',
    dangerZone: '⚠️ Nebezpečná zóna',
    cancelBookingWarning: 'Zrušení rezervace je nevratné. Tato akce nemůže být vrácena zpět.',
    cancelBookingButton: '🗑️ Zrušit rezervaci',
    changesSavedTitle: '🎉 Změny úspěšně uloženy!',
    changesSavedMessage: 'Vaše rezervace byla aktualizována.',
    closeButton: 'Zavřít',
    nameRequired: 'Jméno je povinné',
    invalidEmail: 'Neplatný email',
    invalidPhone: 'Neplatný telefon',
    addressRequired: 'Adresa je povinná',
    cityRequired: 'Město je povinné',
    invalidZip: 'PSČ musí mít 5 číslic',
    remove: 'Odstranit',
    removeInterval: '✕ Odstranit',
    cancelSelection: '✕ Zrušit',
    selectingFrom: '📍 Vybíráte:',
    nightSingular: 'noc',
    nightsPlural: 'noci',
    nightsPlural5: 'nocí',
    roomLabel: 'Pokoj',
    bedsLabel: 'lůžka',
    bedsSingular: 'lůžko',
    bedsPlural: 'lůžek',
    adultsLowercase: 'dospělí',
    childrenRange: 'děti',
    toddlersRange: 'batolata',

    // Alert messages
    invalidEditLink: 'Neplatný odkaz pro úpravu rezervace',
    bookingNotFound: 'Rezervace nenalezena',
    errorLoadingBooking: 'Chyba při načítání rezervace',
    fillAllRequiredFields: 'Prosím vyplňte všechna povinná pole správně',
    selectAtLeastOneDate: 'Vyberte prosím alespoň jeden termín pobytu',
    selectAtLeastOneRoom: 'Vyberte prosím alespoň jeden pokoj',
    roomCapacityExceeded: 'Pokoj {roomId} má překročenou kapacitu!',
    errorSavingChanges: 'Chyba při ukládání změn:',
    confirmCancelBooking: '⚠️ Opravdu chcete zrušit tuto rezervaci?\n\nTato akce je nevratná!',
    confirmCancelBookingFinal:
      '🔴 POSLEDNÍ VAROVÁNÍ!\n\nRezerva ace bude trvale smazána. Pokračovat?',
    bookingCancelled: '✅ Rezervace byla zrušena',
    errorCancellingBooking: '❌ Chyba při rušení rezervace:',

    // Room names
    room12: 'Pokoj 12',
    room13: 'Pokoj 13',
    room14: 'Pokoj 14',
    room22: 'Pokoj 22',
    room23: 'Pokoj 23',
    room24: 'Pokoj 24',
    room42: 'Pokoj 42',
    room43: 'Pokoj 43',
    room44: 'Pokoj 44',

    // Single room booking modal
    roomReservation: 'Rezervace pokoje',
    selectStayPeriod: 'Vyberte termín pobytu',
    guestTypeAndCount: 'Typ hosta a počet osob',
    adultsCount: 'Dospělí',
    childrenCount: 'Děti (3-12)',
    toddlersCount: 'Batolata (0-3)',
    priceSummary: 'Souhrn ceny',
    basePricePerRoom: 'Základní cena za pokoj',
    adultsExtra: 'Příplatek za dospělé',
    childrenExtra: 'Příplatek za děti',
    toddlersFree: 'Děti do 3 let',
    toddlersFreeLabel: 'zdarma',
    nightsCount: 'Počet nocí',
    totalAmount: 'Celkem',
    cancelButton: 'Zrušit',
    addReservationButton: 'Přidat rezervaci',
    selectedPeriodLabel: 'Vybraný termín:',
    nightsCountLabel: 'Počet nocí:',
    createReservationButton: 'Vytvořit rezervaci',

    // Room info modal - Price lists
    regularPriceBasePrice: 'Základní cena',
    regularPriceAdultSurcharge: 'Příplatek za dospělého',
    regularPriceChildSurcharge: 'Příplatek za dítě',
    regularPriceToddlersFree: 'Děti do 3 let zdarma',
    bulkPriceBasePriceCottage: 'Základní cena za celou chatu',
    bulkPriceAdultSurcharge: 'Příplatek za dospělého',
    bulkPriceChildSurcharge: 'Příplatek za dítě (3-18 let)',
    bulkPriceToddlersFree: 'Děti do 3 let zdarma',
    pricePerNightTotal: 'Cena za noc celkem',
    totalPriceForStay: 'Celková cena za pobyt',

    // Bulk booking modal
    bulkBookingModalTitle: 'Hromadná rezervace celé chaty',
    bulkBookingAllRooms: 'Rezervace všech 9 pokojů (26 lůžek)',
    bulkSelectStayPeriod: 'Vyberte termín pobytu',
    bulkSelectedPeriod: 'Vybraný termín:',
    bulkNightsCountLabel: 'Počet nocí:',
    bulkPricePerNight: 'Cena za jednu noc:',

    // Contact
    contactErrorsWriteTo:
      'V případě chyb pište na: <a href="mailto:prusek@utia.cas.cz" style="color: var(--primary-color); text-decoration: underline;">prusek@utia.cas.cz</a>',
  },
  en: {
    // Header
    roomInfo: 'Room Information',
    admin: 'Admin',

    // Calendar
    months: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
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
    bulkPricingInfo:
      '<strong>Fixed pricing for bulk booking:</strong><br>• Base price: 2000 CZK per night<br>• External adult: +250 CZK/person<br>• External child: +50 CZK/person<br>• ÚTIA employee adult: +100 CZK/person<br>• ÚTIA employee child: 0 CZK',
    bulkDateSelection: 'Date Selection for Bulk Booking',
    bulkDateSelectionInfo:
      'Select days in the calendar. Gray days have bookings and cannot be selected. Green days are fully available for bulk booking.',
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
    christmasRules:
      'Bookings during Christmas holidays are subject to special rules. ÚTIA employees can book max. 1-2 rooms until September 30th of the respective year.',
    christmasTitle: '🎄 Christmas Period',
    christmasInfo:
      'Bookings during Christmas holidays are subject to special rules. ÚTIA employees can book max. 1-2 rooms until September 30th of the respective year.',

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
    contactOwnerInfo:
      "Your message will be sent to the booking owner. The owner's email remains hidden.",
    yourEmail: 'Your email',
    message: 'Message',
    sendMessage: 'Send Message',
    messageSent: 'Message successfully sent to booking owner',

    // Bulk pricing
    bulkPriceList: 'Bulk Booking Price List',
    bulkPriceNote:
      'Note: Bulk booking means renting the entire cottage for one period. Children under 3 are always free.',
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
    children5plus: 'children',

    // Legend
    legend: 'Legend',
    legendTitle: 'Calendar Colors and States Explanation',
    legendRoomStates: 'Room States',
    legendTimeIndicators: 'Time Indicators',
    legendAvailable: 'Available room',
    legendAvailableDesc: 'Room is available for booking',
    legendOccupied: 'Occupied room',
    legendOccupiedDesc: 'Both nights around the day are occupied - not clickable (red)',
    legendBooked: 'Occupied room',
    legendBookedDesc: 'Both nights around the day are occupied - not clickable (red)',
    legendNewBooking: 'Newly booked room',
    legendNewBookingDesc: 'Room just booked (orange color)',
    newReservations: 'New Reservations',
    finalizeReservations: 'Finalize All Reservations',
    changeReservation: 'Change Reservation',
    removeReservation: 'Remove Reservation',
    addReservation: 'Add Reservation',
    legendBlocked: 'Blocked room',
    legendBlockedDesc: 'Room is administratively blocked ❌',
    legendEdge: 'Edge day (check-in/out)',
    legendEdgeDesc:
      'Edge day (one night occupied) - half green (available) and half red (occupied). Clickable for new booking.',
    legendChristmas: 'Christmas period',
    legendChristmasDesc: 'Special period with restricted access',
    legendPastDates: 'Past days',
    legendPastDatesDesc: 'Past days are not available for booking',
    legendClickInstructions: 'Usage Instructions',
    legendClickAvailable: 'Click on green room to select',
    legendClickBooked: 'Click on orange room to view booking details',
    legendClickBlocked: 'Click on ❌ to view blocking reason',
    legendReportBugs: 'Report bugs to: prusek@utia.cas.cz',
    showLegend: 'Show legend',
    hideLegend: 'Hide legend',

    // Additional missing translations
    contactDetails: 'Contact Details',
    fullName: 'Full Name *',
    paymentFromBenefit: 'Payment from Benefits',
    pendingReservations: 'Pending Reservations',
    reservationSummary: 'Reservation Summary',
    legendProposed: 'Proposed Reservation',
    legendProposedDesc: 'Reservation pending completion (red color)',

    // Notification messages
    selectDatesAndRoomsError: 'Please select dates and rooms',
    fillRequiredFieldsError: 'Please fill in all required fields',
    enterValidEmailError: 'Please enter a valid email',
    allReservationsCreated: '✓ All reservations created successfully',
    partialSuccess: 'Partial success: {successCount} reservations created, {errorCount} failed',
    errorCreatingReservations: 'Error creating reservations',
    bookingCreatedSuccess: '✓ Booking created successfully',
    editBookingLink: 'To edit your booking, use this link: {editUrl}',
    errorCreatingBooking: 'Error creating booking',
    roomCapacityError: "{roomName} has capacity of only {beds} beds (toddlers don't count)",
    errorLoadingBookingDetails: 'Error loading booking details',
    errorLoadingBlockedDetails: 'Error loading blocked details',
    reservationRemoved: 'Reservation for room {roomName} has been removed',
    noReservationsToFinalize: 'No reservations to finalize',
    errorCreatingBookingForRoom: 'Error creating booking for {roomName}',
    successfullyCreatedBookings: 'Successfully created {count} bookings',
    fillAllFieldsError: 'Please fill in all fields and enter a valid email',
    messageSentSuccess: '✓ Message sent successfully',
    errorSendingMessage: 'Error sending message. Please try again.',
    minimumBookingError: 'Minimum booking is for 1 night (2 days). The next day is not available.',
    selectDatesError: 'Please select dates',
    minimumOneNightError: 'Minimum booking is for 1 night (2 days)',
    noRoomSelectedError: 'Error: No room selected',
    roomNotFoundError: 'Error: Room not found',
    roomAddedToReservation: 'Room {roomName} added to reservation',
    bulkBookingChristmasError:
      'Bulk bookings during Christmas period are not allowed after October 1st',
    bulkBookingCreatedSuccess: '✓ Bulk booking created successfully',
    bookingNumberPrefix: 'Booking',
    toddler: 'toddler',

    // Admin panel translations
    adminPanel: 'Admin Panel',
    backToReservations: 'Back to reservations',
    logout: 'Logout',
    adminLogin: 'Administrator Login',
    password: 'Password',
    login: 'Login',
    bookingsTab: 'Bookings',
    blockedDatesTab: 'Blocked Dates',
    christmasAccessTab: 'Christmas Access',
    christmasCodeLabel: 'Christmas Access Code',
    christmasCodePlaceholder: 'Enter access code for Christmas period',
    christmasCodeRequired: 'Access code is required for bookings during Christmas period',
    bulkBlockedAfterOct1:
      'Bulk bookings are not allowed after October 1st for Christmas period. Please book individual rooms.',
    roomConfigTab: 'Room & Price Settings',
    statisticsTab: 'Statistics',
    systemSettingsTab: 'System Settings',
    bookingsManagement: 'Bookings Management',
    searchPlaceholder: 'Search by name, email or booking number...',
    bookingNumberShort: 'Number',
    actions: 'Actions',
    view: 'View',
    edit: 'Edit',
    delete: 'Delete',
    blockedDatesManagement: 'Blocked Dates',
    addBlockage: 'Add Blockage',
    startDate: 'Start Date',
    endDate: 'End Date',
    reason: 'Reason',
    reasonPlaceholder: 'Maintenance, private event...',
    selectRoomsToBlock: 'Select rooms to block:',
    allRooms: 'All',
    addBlockageButton: 'Add Blockage',
    currentBlockages: 'Current Blockages',
    christmasPeriodManagement: 'Christmas Period and Access Codes',
    christmasPeriodSettings: 'Christmas Period Management',
    christmasPeriodDescription:
      'Define school Christmas holiday periods. These periods will be visually marked in the calendar.',
    periodStart: 'Period Start',
    periodEnd: 'Period End',
    addPeriod: 'Add Period',
    activeChristmasPeriods: 'Active Christmas Periods',
    christmasRulesTitle: '⚠️ Christmas Period Rules',
    christmasRule1: 'Period: School Christmas holidays and immediately adjacent weekends',
    christmasRule2:
      'Until Sept 30: Employees can book 1 room (2 rooms when fully occupied by family)',
    christmasRule3: 'From Oct 1: Available capacity without restrictions in order',
    christmasRule4: 'In case of excess demand: Lottery decides (ensured by operations department)',
    accessCodesForEmployees: 'Access Codes for Employees',
    accessCodesDescription:
      'Employees with these codes can book during Christmas period until September 30th of the respective year.',
    enterAccessCode: 'Enter access code',
    addCode: 'Add Code',
    activeCodes: 'Active Codes',
    roomPriceConfiguration: 'Room and Price Settings',
    roomConfiguration: 'Room Configuration',
    roomConfigDescription: 'Set capacity and type for each room',
    priceConfiguration: 'Price Configuration',
    utiaEmployees: 'ÚTIA Employees',
    basePriceOneRoom: 'Base price (1 room, 1 person)',
    additionalAdultPrice: 'Additional adult',
    childPriceRange: 'Child 3-18 years',
    externalGuestsPrice: 'External Guests',
    saveRoomConfig: 'Save Room Configuration',
    savePriceConfig: 'Save Price List',
    bulkBookingPriceConfig: 'Bulk Booking Price List',
    bulkBookingDescription: 'Set prices for booking the entire cottage in one period',
    fixedBasePrice: 'Fixed price per night',
    fixedBasePriceNote: 'Base fee for booking the entire cottage',
    personFees: 'Per Person Fees',
    utiaEmployeesShort: 'ÚTIA Employees',
    externalGuestsShort: 'External Guests',
    adultFee: 'Adult',
    childFee: 'Child (3-18 years)',
    childrenUnder3Free:
      '<strong>Note:</strong> Children under 3 are always free and do not count towards room capacity.',
    saveBulkPriceConfig: 'Save Bulk Booking Price List',
    changeAdminPassword: 'Change Admin Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password',
    changePassword: 'Change Password',
    emailSettings: 'Email Settings',
    emailMockNote: 'The system currently uses mock emails. All emails are logged to console.',
    emailTemplateSettings: 'Confirmation Email Template',
    emailTemplateDescription:
      'Set the email text that guests will receive after successful booking.',
    emailSubject: 'Email Subject',
    emailBody: 'Email Body',
    saveEmailTemplate: 'Save Email Template',

    // Edit page translations
    editReservation: '✨ Edit Reservation',
    bookingIdLabel: '🎯 ID',
    loading: 'Loading...',
    datesAndRoomsTab: '📅 Dates & Rooms',
    personalInfoTab: '👤 Personal Info',
    billingInfoTab: '💳 Billing Info',
    selectStayDates: '📆 Select stay dates',
    previousMonth: '← Previous',
    nextMonth: 'Next →',
    selectedDates: '📌 Selected dates:',
    noSelectedDates: 'No dates selected yet',
    clearAllDates: '🗑️ Clear all dates',
    selectRoomsAndGuests: '🏠 Select rooms and set guests',
    guestsCount: 'Number of guests',
    guestTypeUtia: '🏢 ÚTIA',
    guestTypeExternalEdit: '👥 External',
    priceSummaryLabel: '💰 Total Price',
    capacityExceeded: '⚠️ Room capacity exceeded!',
    noConflicts: '✅ No conflicts - dates and rooms are available',
    conflictingReservations: '⚠️ Conflicting Reservations',
    fullNameEdit: '👤 Full Name',
    emailAddress: '📧 Email',
    phoneNumber: '📱 Phone',
    notesField: '📝 Notes',
    notesPlaceholder: 'You can write special requests here...',
    companyName: '🏢 Company',
    streetAddress: '📍 Address',
    cityName: '🏙️ City',
    postalCode: '📮 ZIP Code',
    companyId: '🔢 Company ID',
    vatId: '💼 VAT ID',
    paymentFromBenefits: '💳 Payment from Benefits',
    backButton: '← Back',
    saveChanges: '💾 Save Changes',
    dangerZone: '⚠️ Danger Zone',
    cancelBookingWarning:
      'Canceling the reservation is irreversible. This action cannot be undone.',
    cancelBookingButton: '🗑️ Cancel Reservation',
    changesSavedTitle: '🎉 Changes Saved Successfully!',
    changesSavedMessage: 'Your reservation has been updated.',
    closeButton: 'Close',
    nameRequired: 'Name is required',
    invalidEmail: 'Invalid email',
    invalidPhone: 'Invalid phone',
    addressRequired: 'Address is required',
    cityRequired: 'City is required',
    invalidZip: 'ZIP must be 5 digits',
    remove: 'Remove',
    removeInterval: '✕ Remove',
    cancelSelection: '✕ Cancel',
    selectingFrom: '📍 Selecting from:',
    nightSingular: 'night',
    nightsPlural: 'nights',
    nightsPlural5: 'nights',
    roomLabel: 'Room',
    bedsLabel: 'beds',
    bedsSingular: 'bed',
    bedsPlural: 'beds',
    adultsLowercase: 'adults',
    childrenRange: 'children',
    toddlersRange: 'toddlers',

    // Alert messages
    invalidEditLink: 'Invalid edit link for reservation',
    bookingNotFound: 'Reservation not found',
    errorLoadingBooking: 'Error loading reservation',
    fillAllRequiredFields: 'Please fill in all required fields correctly',
    selectAtLeastOneDate: 'Please select at least one stay date',
    selectAtLeastOneRoom: 'Please select at least one room',
    roomCapacityExceeded: 'Room {roomId} has exceeded capacity!',
    errorSavingChanges: 'Error saving changes:',
    confirmCancelBooking:
      '⚠️ Are you sure you want to cancel this reservation?\n\nThis action is irreversible!',
    confirmCancelBookingFinal:
      '🔴 FINAL WARNING!\n\nReservation will be permanently deleted. Continue?',
    bookingCancelled: '✅ Reservation has been cancelled',
    errorCancellingBooking: '❌ Error cancelling reservation:',

    // Room names
    room12: 'Room 12',
    room13: 'Room 13',
    room14: 'Room 14',
    room22: 'Room 22',
    room23: 'Room 23',
    room24: 'Room 24',
    room42: 'Room 42',
    room43: 'Room 43',
    room44: 'Room 44',

    // Single room booking modal
    roomReservation: 'Room Reservation',
    selectStayPeriod: 'Select stay period',
    guestTypeAndCount: 'Guest type and count',
    adultsCount: 'Adults',
    childrenCount: 'Children (3-12)',
    toddlersCount: 'Toddlers (0-3)',
    priceSummary: 'Price Summary',
    basePricePerRoom: 'Base price per room',
    adultsExtra: 'Adults extra',
    childrenExtra: 'Children extra',
    toddlersFree: 'Children under 3',
    toddlersFreeLabel: 'free',
    nightsCount: 'Number of nights',
    totalAmount: 'Total',
    cancelButton: 'Cancel',
    addReservationButton: 'Add Reservation',
    selectedPeriodLabel: 'Selected period:',
    nightsCountLabel: 'Number of nights:',
    createReservationButton: 'Create Reservation',

    // Room info modal - Price lists
    regularPriceBasePrice: 'Base price',
    regularPriceAdultSurcharge: 'Adult surcharge',
    regularPriceChildSurcharge: 'Child surcharge',
    regularPriceToddlersFree: 'Children under 3 free',
    bulkPriceBasePriceCottage: 'Base price for entire cottage',
    bulkPriceAdultSurcharge: 'Adult surcharge',
    bulkPriceChildSurcharge: 'Child surcharge (3-18 years)',
    bulkPriceToddlersFree: 'Children under 3 free',
    pricePerNightTotal: 'Total price per night',
    totalPriceForStay: 'Total price for stay',

    // Bulk booking modal
    bulkBookingModalTitle: 'Bulk Booking - Entire Cottage',
    bulkBookingAllRooms: 'Booking all 9 rooms (26 beds)',
    bulkSelectStayPeriod: 'Select stay period',
    bulkSelectedPeriod: 'Selected period:',
    bulkNightsCountLabel: 'Number of nights:',
    bulkPricePerNight: 'Price per night:',

    // Contact
    contactErrorsWriteTo:
      'In case of errors write to: <a href="mailto:prusek@utia.cas.cz" style="color: var(--primary-color); text-decoration: underline;">prusek@utia.cas.cz</a>',
  },
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
    return translations[this.currentLang][key] || translations.cs[key] || key;
  }

  applyTranslations() {
    // Update all elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach((element) => {
      const key = element.getAttribute('data-translate');
      const translation = this.t(key);

      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        if (element.placeholder) {
          const elem = element;
          elem.placeholder = translation;
        }
      } else {
        const elem = element;
        // Use innerHTML if translation contains HTML tags, otherwise use textContent
        if (translation.includes('<') && translation.includes('>')) {
          elem.innerHTML = translation;
        } else {
          elem.textContent = translation;
        }
      }
    });

    // Update specific elements
    this.updateSpecificElements();
  }

  updateSpecificElements() {
    // Update room beds text
    document.querySelectorAll('.room-beds').forEach((element) => {
      const beds = element.getAttribute('data-beds');
      if (beds) {
        const text =
          this.currentLang === 'cs'
            ? `${beds} ${beds === '1' ? 'lůžko' : 'lůžka'}`
            : `${beds} ${beds === '1' ? 'bed' : 'beds'}`;
        const elem = element;
        elem.textContent = text;
      }
    });

    // Update legend toggle button text
    const legendToggle = document.getElementById('legendToggle');
    if (legendToggle) {
      const toggleText = legendToggle.querySelector('.legend-toggle-text');
      const isExpanded = legendToggle.getAttribute('aria-expanded') === 'true';
      if (toggleText) {
        toggleText.textContent = isExpanded ? this.t('hideLegend') : this.t('showLegend');
      }
    }

    // NOTE: Calendar is updated separately in the language switch event listener
    // to avoid duplicate rendering
  }
}

// Export for use
// eslint-disable-next-line no-unused-vars
const langManager = new LanguageManager();
