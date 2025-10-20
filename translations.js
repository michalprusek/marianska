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
    childrenLabel: 'Děti (3-17)',
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
    children: 'Děti (3-17 let)',
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
    namePlaceholder: 'např. Jan Novák',
    email: 'Email *',
    emailPlaceholder: 'vas@email.cz',
    phone: 'Telefon *',
    phonePlaceholder: '123456789',
    company: 'Firma', // Optional field - no asterisk
    companyPlaceholder: 'např. ÚTIA AV ČR',
    address: 'Adresa *',
    addressPlaceholder: 'např. Hlavní 123',
    city: 'Město *',
    cityPlaceholder: 'např. Praha',
    zip: 'PSČ *',
    zipPlaceholder: '12345',
    ico: 'IČO',
    icoPlaceholder: '12345678',
    dic: 'DIČ',
    dicPlaceholder: 'CZ12345678',
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
    lowerFloor: 'Dolní patro',
    upperFloor: 'Horní patro',
    lowerFloorRooms: 'Pokoje v dolním patře',
    upperFloorRooms: 'Pokoje v horním patře',
    priceList: 'Ceník',
    employeesPricing: 'Zaměstnanci ÚTIA',
    externalPricing: 'Externí hosté',
    smallRooms: 'Malé pokoje',
    largeRooms: 'Velké pokoje',
    basePrice: 'Základní cena (1 osoba)',
    additionalAdult: 'Další dospělý',
    childPrice: 'Dítě 3-17 let',
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

    // Christmas room limit validation messages (NEW 2025-10-16)
    christmasNoRoomSelected: 'Musíte vybrat alespoň jeden pokoj',
    christmasTwoRoomsWarning:
      'Pamatujte: Dva pokoje lze rezervovat pouze pokud budou oba plně obsazeny příslušníky Vaší rodiny (osoby oprávněné využívat zlevněnou cenu za ubytování).',
    christmasMaxTwoRoomsError:
      'Zaměstnanci ÚTIA mohou do 30. září rezervovat maximálně 2 pokoje. Více pokojů můžete rezervovat od 1. října (podle dostupnosti).',

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
    legendOccupiedDesc: 'Obě noci kolem dne jsou obsazeny (červený)',
    legendBooked: 'Obsazený pokoj',
    legendBookedDesc: 'Obě noci kolem dne jsou obsazeny (červený)',
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

    // Guest count abbreviations for compact display (used in modals)
    adultsShort: 'dosp.',
    childrenShort: 'děti',
    toddlersShort: 'bat.',

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
    childPriceRange: 'Dítě 3-17 let',
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
    childFee: 'Dítě (3-17 let)',
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
    room: 'Pokoj',
    roomLabel: 'Pokoj',
    bedsLabel: 'lůžka',
    bedsSingular: 'lůžko',
    bedsPlural: 'lůžek',
    roomNotFoundError2: 'Pokoj {roomId} nebyl nalezen v konfiguraci',
    roomCapacityExceeded2: 'Pokoj {roomName} má kapacitu pouze {beds} lůžek',
    roomOccupiedInPeriod: '⚠️ Pokoj {roomId} je v tomto termínu již obsazený. Zvolte jiný termín.',
    roomBlockedInPeriod: '⚠️ Pokoj {roomId} je v tomto termínu blokován. Zvolte jiný termín.',
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
    childrenCount: 'Děti (3-17)',
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
    bulkPriceChildSurcharge: 'Příplatek za dítě (3-17 let)',
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
    contactErrorsWriteTo: 'V případě chyb pište na:',

    // Capacity warnings - specific for modals
    capacityExceededRoom: '⚠️ Překročena kapacita pokoje',
    bulkCapacityExceededCottage: '⚠️ Překročena kapacita chaty (maximum 26 lůžek)',

    // NEW: Missing translations from booking form modal and general UI
    book: 'Rezervovat',
    reservation: 'Rezervace',
    shrnutiRezervace: 'Shrnutí rezervace',
    dospeliLabel: 'dospělí',
    detiLabel: 'děti',
    batole: 'batole',
    celkemLabel: 'Celkem',
    fillAllRequiredFieldsAsterisk: 'Vyplňte prosím všechna povinná pole označená hvězdičkou (*)',
    christmasAccessCodeRequiredLong:
      'Vánoční přístupový kód je vyžadován pro rezervace ve vánočním období',
    guestNamesTitle: 'Jména ubytovaných osob',
    adultsSectionTitle: 'Dospělí (18+ let)',
    childrenSectionTitle: 'Děti (3-17 let)',
    firstNameLabel: 'Křestní jméno',
    lastNameLabel: 'Příjmení',
    adultNumberLabel: 'dospělého',
    childNumberLabel: 'dítěte',
    firstNamePlaceholder: 'např. Jan',
    lastNamePlaceholder: 'např. Novák',
    firstNameChildPlaceholder: 'např. Anna',
    lastNameChildPlaceholder: 'např. Nováková',
    adultFirstNameLabel: 'Křestní jméno {n}. dospělého *',
    adultLastNameLabel: 'Příjmení {n}. dospělého *',
    childFirstNameLabel: 'Křestní jméno {n}. dítěte *',
    childLastNameLabel: 'Příjmení {n}. dítěte *',
    toddlersSectionTitle: 'Batolata (0-2 roky)',
    toddlerFirstNameLabel: 'Křestní jméno {n}. batolete *',
    toddlerLastNameLabel: 'Příjmení {n}. batolete *',
    firstNameToddlerPlaceholder: 'např. Eliška',
    lastNameToddlerPlaceholder: 'např. Nováková',
    bookingSuccessfullyCreated: 'Rezervace úspěšně vytvořena!',
    yourBookingId: 'Číslo vaší rezervace:',
    saveEditLinkTitle: 'Uložte si tento odkaz pro budoucí úpravy:',
    copyLinkButton: 'Kopírovat odkaz',
    linkCopied: 'Zkopírováno!',
    importantNote: 'Důležité:',
    editLinkWillBeSent:
      'Odkaz pro úpravu rezervace vám bude zaslán e-mailem, jakmile bude e-mailová služba dostupná.',
    closeButtonLabel: 'Zavřít',
    failedToCopyLink: 'Chyba při kopírování odkazu',
    allFieldsAreRequired: 'Všechna pole jsou povinná',
    validationErrorAllAdultNames: 'Vyplňte jména všech {count} dospělých',
    validationErrorAllChildNames: 'Vyplňte jména všech {count} dětí',
    validationErrorFirstNameLength: 'Všechna křestní jména musí mít alespoň 2 znaky',
    validationErrorLastNameLength: 'Všechna příjmení musí mít alespoň 2 znaky',
    blockedDateError: 'Vybraný termín obsahuje blokované dny. Vyberte jiný termín.',
    temporaryReservationError: 'Chyba při vytváření dočasné rezervace',
    bulkBookingAddedToList: 'Hromadná rezervace přidána do seznamu rezervací',
    roomBlockedOnDate:
      'Pokoj {roomName} je blokován dne {date}. Pro hromadnou rezervaci musí být všechny pokoje volné.',
    allReservationsSuccessCreated: 'Všechny rezervace ({count}) byly úspěšně vytvořeny',
    partialSuccessMessage:
      'Částečný úspěch: {successCount} rezervací vytvořeno, {errorCount} selhalo',
    errorCreatingReservationsMessage: 'Chyba při vytváření rezervací',
    bookingCreatedSuccessfully: 'Rezervace byla úspěšně vytvořena',

    // Admin panel - missing translations
    backToCalendar: 'Zpět na kalendář',
    paid: 'Zaplaceno',
    paymentFromBenefitShort: 'Platba benefitem',
    editReservationTitle: 'Upravit rezervaci',
    dateAndRoomsTab: 'Termín a pokoje',
    billingInfoTab2: 'Fakturační údaje',
    clickChangeDate:
      'Klikněte na "Změnit termín" u pokoje, který chcete upravit. Kalendář zobrazí původní termín modře.',
    calendarRoomName: 'Kalendář',
    closeCalendarButton: 'Zavřít kalendář',
    newlySelectedDate: 'Nově vybraný termín:',
    notSelectedYet: 'Zatím nevybráno',
    saveDateButton: 'Uložit termín',
    allRoomsTitle: 'Všechny pokoje',
    totalPriceSummary: 'Celková cena:',
    changeDate: 'Změnit termín',
    guestNamesSectionTitle: 'Jména ubytovaných osob',
    adultsNamesTitle: 'Dospělí (18+ let)',
    childrenNamesTitle: 'Děti (3-17 let)',
    cancelButton2: 'Zrušit',
    saveChangesButton: 'Uložit změny',
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
    childrenLabel: 'Children (3-17)',
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
    children: 'Children (3-17 years)',
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
    namePlaceholder: 'e.g. John Smith',
    email: 'Email *',
    emailPlaceholder: 'your@email.com',
    phone: 'Phone *',
    phonePlaceholder: '123456789',
    company: 'Company', // Optional field - no asterisk
    companyPlaceholder: 'e.g. ÚTIA AV ČR',
    address: 'Address *',
    addressPlaceholder: 'e.g. Main Street 123',
    city: 'City *',
    cityPlaceholder: 'e.g. Prague',
    zip: 'ZIP Code *',
    zipPlaceholder: '12345',
    ico: 'Company ID',
    icoPlaceholder: '12345678',
    dic: 'VAT ID',
    dicPlaceholder: 'CZ12345678',
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
    lowerFloor: 'Lower Floor',
    upperFloor: 'Upper Floor',
    lowerFloorRooms: 'Rooms on the lower floor',
    upperFloorRooms: 'Rooms on the upper floor',
    priceList: 'Price List',
    employeesPricing: 'ÚTIA Employees',
    externalPricing: 'External Guests',
    smallRooms: 'Small rooms',
    largeRooms: 'Large rooms',
    basePrice: 'Base price (1 person)',
    additionalAdult: 'Additional adult',
    childPrice: 'Child 3-17 years',
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

    // Christmas room limit validation messages (NEW 2025-10-16)
    christmasNoRoomSelected: 'You must select at least one room',
    christmasTwoRoomsWarning:
      'Remember: Two rooms can be reserved only if both will be fully occupied by members of your family (persons eligible for discounted ÚTIA pricing).',
    christmasMaxTwoRoomsError:
      'ÚTIA employees can reserve a maximum of 2 rooms until September 30. More rooms can be reserved from October 1 (based on availability).',

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
    legendOccupiedDesc: 'Both nights around the day are occupied (red)',
    legendBooked: 'Occupied room',
    legendBookedDesc: 'Both nights around the day are occupied (red)',
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

    // Guest count abbreviations for compact display (used in modals)
    adultsShort: 'ad.',
    childrenShort: 'ch.',
    toddlersShort: 'tod.',

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
    childPriceRange: 'Child 3-17 years',
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
    childFee: 'Child (3-17 years)',
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
    room: 'Room',
    roomLabel: 'Room',
    bedsLabel: 'beds',
    bedsSingular: 'bed',
    bedsPlural: 'beds',
    roomNotFoundError2: 'Room {roomId} not found in configuration',
    roomCapacityExceeded2: 'Room {roomName} has capacity of only {beds} beds',
    roomOccupiedInPeriod:
      '⚠️ Room {roomId} is already occupied in this period. Choose a different date.',
    roomBlockedInPeriod: '⚠️ Room {roomId} is blocked in this period. Choose a different date.',
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
    childrenCount: 'Children (3-17)',
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
    bulkPriceChildSurcharge: 'Child surcharge (3-17 years)',
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
    contactErrorsWriteTo: 'In case of errors write to:',

    // Capacity warnings - specific for modals
    capacityExceededRoom: '⚠️ Room capacity exceeded',
    bulkCapacityExceededCottage: '⚠️ Cottage capacity exceeded (maximum 26 beds)',

    // NEW: Missing translations from booking form modal and general UI
    book: 'Book',
    reservation: 'Reservation',
    shrnutiRezervace: 'Booking Summary',
    dospeliLabel: 'adults',
    detiLabel: 'children',
    batole: 'toddler',
    celkemLabel: 'Total',
    fillAllRequiredFieldsAsterisk: 'Please fill in all required fields marked with asterisk (*)',
    christmasAccessCodeRequiredLong:
      'Christmas access code is required for bookings during Christmas period',
    guestNamesTitle: 'Names of Guests',
    adultsSectionTitle: 'Adults (18+ years)',
    childrenSectionTitle: 'Children (3-17 years)',
    firstNameLabel: 'First Name',
    lastNameLabel: 'Last Name',
    adultNumberLabel: 'adult',
    childNumberLabel: 'child',
    firstNamePlaceholder: 'e.g. John',
    lastNamePlaceholder: 'e.g. Smith',
    firstNameChildPlaceholder: 'e.g. Anna',
    lastNameChildPlaceholder: 'e.g. Smith',
    adultFirstNameLabel: 'First name of {n}. adult *',
    adultLastNameLabel: 'Last name of {n}. adult *',
    childFirstNameLabel: 'First name of {n}. child *',
    childLastNameLabel: 'Last name of {n}. child *',
    toddlersSectionTitle: 'Toddlers (0-2 years)',
    toddlerFirstNameLabel: 'First name of {n}. toddler *',
    toddlerLastNameLabel: 'Last name of {n}. toddler *',
    firstNameToddlerPlaceholder: 'e.g. Emma',
    lastNameToddlerPlaceholder: 'e.g. Smith',
    bookingSuccessfullyCreated: 'Booking Successfully Created!',
    yourBookingId: 'Your booking ID:',
    saveEditLinkTitle: 'Save this link to edit your booking later:',
    copyLinkButton: 'Copy Link',
    linkCopied: 'Copied!',
    importantNote: 'Important:',
    editLinkWillBeSent:
      'The edit link will be sent to your email once the email service is available.',
    closeButtonLabel: 'Close',
    failedToCopyLink: 'Failed to copy link',
    allFieldsAreRequired: 'All fields are required',
    validationErrorAllAdultNames: 'Fill in names of all {count} adults',
    validationErrorAllChildNames: 'Fill in names of all {count} children',
    validationErrorFirstNameLength: 'All first names must be at least 2 characters',
    validationErrorLastNameLength: 'All last names must be at least 2 characters',
    blockedDateError: 'Selected dates include blocked days. Please choose different dates.',
    temporaryReservationError: 'Error creating temporary reservation',
    bulkBookingAddedToList: 'Bulk booking added to reservation list',
    roomBlockedOnDate:
      'Room {roomName} is blocked on {date}. All rooms must be available for bulk booking.',
    allReservationsSuccessCreated: 'All reservations ({count}) created successfully',
    partialSuccessMessage:
      'Partial success: {successCount} reservations created, {errorCount} failed',
    errorCreatingReservationsMessage: 'Error creating reservations',
    bookingCreatedSuccessfully: 'Booking created successfully',

    // Admin panel - missing translations
    backToCalendar: 'Back to Calendar',
    paid: 'Paid',
    paymentFromBenefitShort: 'Benefit Payment',
    editReservationTitle: 'Edit Reservation',
    dateAndRoomsTab: 'Dates & Rooms',
    billingInfoTab2: 'Billing Information',
    clickChangeDate:
      'Click "Change Date" for the room you want to edit. The calendar will display the original date in blue.',
    calendarRoomName: 'Calendar',
    closeCalendarButton: 'Close Calendar',
    newlySelectedDate: 'Newly selected date:',
    notSelectedYet: 'Not selected yet',
    saveDateButton: 'Save Date',
    allRoomsTitle: 'All Rooms',
    totalPriceSummary: 'Total Price:',
    changeDate: 'Change Date',
    guestNamesSectionTitle: 'Names of Guests',
    adultsNamesTitle: 'Adults (18+ years)',
    childrenNamesTitle: 'Children (3-17 years)',
    cancelButton2: 'Cancel',
    saveChangesButton: 'Save Changes',
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

    // Update placeholders with data-translate-placeholder attribute
    document.querySelectorAll('[data-translate-placeholder]').forEach((element) => {
      const key = element.getAttribute('data-translate-placeholder');
      const translation = this.t(key);
      const elem = element;
      elem.placeholder = translation;
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
