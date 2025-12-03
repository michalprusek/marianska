# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

sudo password: @.sudo-password

## Rezervační systém Chata Mariánská

Rezervační systém pro horskou chatu s 9 pokoji pro zaměstnance ÚTIA a externí hosty.

- **Stack**: Node.js/Express backend, SPA frontend, SQLite database + LocalStorage fallback
- **Production**: Běží na `chata.utia.cas.cz` v Docker kontejnerech
- **Port**: 3000

## Commands

### Production (Docker)

**⚠️ KRITICKÉ: Po každé změně kódu rebuildni Docker kontejnery!**

```bash
# Rebuild and start (po každé změně kódu)
docker-compose down && docker-compose up --build -d

# View logs
docker-compose logs -f
```

**⚠️ Deployment kontext:**

- Tento kód běží PŘÍMO na produkci (`chata.utia.cas.cz`)
- Po změnách může být nutný hard refresh (Ctrl+Shift+R)

### Development (Local)

```bash
npm install              # Install dependencies
cp .env.example .env     # Create environment config
npm run dev              # Start dev server with auto-reload
```

## Directory Structure

```
/
├── js/                      # Frontend JavaScript
│   ├── shared/             # SSOT shared utilities (KRITICKÉ!)
│   ├── booking-app.js      # Main app orchestrator
│   ├── booking-form.js     # Multi-step form handler
│   ├── bulk-booking.js     # Bulk booking logic
│   ├── calendar.js         # Calendar rendering
│   ├── single-room-booking.js  # Single room flow
│   ├── edit-page.js        # User edit page
│   └── utils.js            # General utilities
│
├── docs/                    # Documentation
│   ├── analysis/           # Code analysis reports
│   └── [feature docs]      # Feature-specific documentation
│
├── tests/                   # Test files
│   ├── e2e/                # E2E tests (Playwright)
│   ├── manual/             # Manual test scripts
│   └── [unit tests]        # Jest unit tests
│
├── migrations/              # SQL schema migrations
│   └── *.sql
│
├── data/                    # Runtime data
│   └── bookings.db         # SQLite database
│
└── [root files]            # Production-critical files only
```

**⚠️ Důležité**: Root directory obsahuje POUZE produkční soubory. Test skripty → `tests/manual/`, analýzy → `docs/analysis/`, SQL → `migrations/`

## Testing & Code Quality

```bash
npm test                     # Run all tests
npm run test:e2e             # E2E tests (Playwright)
npm run pre-commit           # Lint + format + duplicate check (PŘED commitem!)
```

**Target:** 70-80% coverage

**SSOT Enforcement:** Max 5% duplikátů povoleno (jscpd). **Aktuální: 1.51%** ✅ (last checked: 2025-12-03)

## Architektura

### 🎯 SSOT (Single Source of Truth) - KRITICKÉ PRINCIPY

**⚠️ DŮLEŽITÉ**: **NIKDY** neimplementujte funkcionalitu dvakrát! Použijte shared komponenty.

#### Shared Components (`js/shared/`):

1. **BaseCalendar.js** - Unified kalendář (4 režimy: GRID, SINGLE_ROOM, BULK, EDIT)
2. **ValidationUtils.js** - Email, telefon, PSČ, IČO, DIČ validace + formátování
3. **DateUtils.js** - Formátování dat, date ranges, výpočty dnů
4. **BookingLogic.js** - Detekce konfliktů rezervací, validace překrývání
5. **IdGenerator.js** - Generování booking ID, edit tokenů (30 znaků), session ID
6. **PriceCalculator.js** - Centralizovaný výpočet cen (individuální + bulk, room-size based, per-room guest types)
7. **ChristmasUtils.js** - Vánoční logika (detekce období, validace kódů, pravidla)
8. **AccessLogger.js** - HTTP logování s IP detekcí (formát: `[timestamp] IP user METHOD /path STATUS time`)
9. **EmailService.js** - Email notifikace (vytvoření/změna/zrušení rezervace, kontaktní formulář)
10. **EditBookingComponent.js** - Unified komponent pro editaci rezervací (user edit page + admin panel)
11. **GuestNameUtils.js** - Správa jmen hostů (validace, formátování, distribuce mezi pokoje)
12. **BookingDisplayUtils.js** - Utility pro zobrazení booking detailů (formátování dat, statusy)
13. **BookingUtils.js** - Obecné booking utility (konsolidace, validace)
14. **DomUtils.js** - XSS-safe DOM manipulation (escapeHtml, showNotification, createElement, clearElement)
15. **Logger.js** - Strukturované logování (levels: DEBUG, INFO, WARN, ERROR)
16. **Errors.js** - Custom error classes (ValidationError, AuthenticationError, NotFoundError, ConflictError)

#### Příklad použití:

```javascript
// ✅ Použijte shared komponenty

// Kalendář
new BaseCalendar({ mode: BaseCalendar.MODES.EDIT });

// Validace
ValidationUtils.validateEmail(email);
ValidationUtils.formatPhone(phone);

// Datum utility
DateUtils.formatDate(date);
DateUtils.getNightsBetween(startDate, endDate);

// Booking logika
BookingLogic.checkConflict(booking1, booking2);

// ID generování
IdGenerator.generateBookingId();
IdGenerator.generateEditToken();

// Room-size based pricing with per-room guest types (NEW 2025-11-04)
const price = PriceCalculator.calculatePriceFromRooms({
  rooms: ['12', '13'],
  guestType: 'utia',  // Default (can be overridden per room)
  adults: 3,
  children: 1,
  nights: 2,
  perRoomGuests: [
    { roomId: '12', guestType: 'utia', adults: 2, children: 0 },
    { roomId: '13', guestType: 'external', adults: 1, children: 1 }
  ],
  settings
});

// Vánoční logika
const { codeRequired, bulkBlocked } = ChristmasUtils.checkChristmasAccessRequirement(
  new Date(),
  christmasPeriodStart,
  isBulkBooking
);

// Email notifikace
await emailService.sendBookingConfirmation(booking, { settings });

// Edit komponent
const editComponent = new EditBookingComponent(dataManager, settings);
await editComponent.loadBooking(bookingId, editToken);

// Guest names
GuestNameUtils.validateGuestNames(guestNames, totalGuests);
GuestNameUtils.distributeGuestNames(guestNames, perRoomGuests);

// Logging
logger.info('Booking created', { bookingId, email });
logger.error('Validation failed', { errors });

// DOM manipulation (XSS-safe) - NEW 2025-12-03
DOMUtils.escapeHtml(userInput);                    // XSS prevention
DOMUtils.showNotification('Uloženo!', 'success');  // Toast notifications
DOMUtils.createElement('div', 'text', { className: 'my-class' });
DOMUtils.clearElement(container);                  // Safe innerHTML = ''

// Currency formatting (SSOT)
BookingDisplayUtils.formatCurrency(1500);          // "1 500 Kč"

// ❌ NIKDY nevytvářejte vlastní implementace!
```

### Backend API (server.js)

Express server na portu 3000 s **dual storage**: SQLite (`data/bookings.db`) + LocalStorage fallback

**Hlavní endpointy:**

**Public API:**
- `GET /api/data` - Získání všech dat (bookings, settings, blockedDates)
- `POST /api/booking` - Vytvoření rezervace
- `PUT /api/booking/:id` - Úprava rezervace (vyžaduje edit token nebo admin session)
- `DELETE /api/booking/:id` - Smazání rezervace (vyžaduje edit token nebo admin session)
- `GET /api/health` - Health check endpoint
- `POST /api/contact` - Kontaktní formulář

**Proposed Bookings API (dočasné rezervace, 15min expirace):**
- `GET /api/proposed-bookings` - Seznam všech aktivních proposals
- `POST /api/proposed-bookings` - Vytvoření proposed booking
- `DELETE /api/proposed-booking/:proposalId` - Smazání konkrétní proposed booking
- `DELETE /api/proposed-bookings/session/:sessionId` - Smazání všech proposals pro session

**Admin API (vyžaduje session token):**
- `POST /api/admin/login` - Admin přihlášení (vrací sessionToken)
- `POST /api/admin/logout` - Admin odhlášení
- `POST /api/admin/refresh-session` - Obnovení session (prodloužení o 7 dní)
- `POST /api/admin/settings` - Aktualizace nastavení systému
- `POST /api/admin/update-password` - Změna admin hesla
- `POST /api/admin/test-email` - Testovací email (rate limited: 10/hour)
- `POST /api/admin/block-date` - Blokování termínů
- `DELETE /api/admin/block-date/:id` - Odblokování termínů

### Klíčové komponenty

#### 1. DataManager (data.js)

Centrální správa dat a business logika.

**Key functions:** `initStorage()`, `createBooking()`, `getRoomAvailability()`, `calculatePrice()`

**Datová struktura:**

- `bookings[]` - Rezervace (id, name, email, startDate, endDate, rooms[], guestType, adults, children, totalPrice, editToken)
- `blockedDates[]` - Blokované termíny (date, roomId, reason)
- `settings` - Konfigurace (rooms, prices, bulkPrices, christmasPeriod, christmasAccessCodes, **adminEmails**, **cabinManagerEmails**)

**Správci chaty (Cabin Manager Emails)**:
- Nová kategorie notifikačních příjemců (od 2025-11-21)
- Konfigurováno v admin panelu: Nastavení systému → Správci chaty
- Správci chaty dostávají emaily POUZE při:
  - Změně stavu zaplacení (false → true NEBO true → false)
  - Jakékoliv změně v již zaplacené rezervaci (booking.paid === true)
- Administrátoři dostávají emaily při VŠECH změnách rezervací
- Emaily správcům chaty obsahují:
  - Zvýrazněné varování "⚠️ DŮLEŽITÉ: Rezervace byla označena jako ZAPLACENÁ" (nebo změněna)
  - Kompletní detaily změn (jaká pole se změnila)
  - Všechny standardní booking informace

**Implementace**:
- `EmailService.sendBookingNotifications()` - Centrální entry point pro všechny notifikace
- `EmailService._determineNotificationScope()` - Logika určení příjemců
- `EmailService.sendCabinManagerNotifications()` - Specifické emaily pro správce
- Admin UI: Správa emailů v `admin.html` + `admin.js` (XSS-safe with escapeHtml())

#### 2. BaseCalendar (js/shared/BaseCalendar.js)

Jednotný kalendářní komponent s 4 režimy:

- `GRID` - Přehled všech pokojů (hlavní stránka)
- `SINGLE_ROOM` - Rezervace jednoho pokoje
- `BULK` - Hromadná rezervace celé chaty
- `EDIT` - Admin editace

**Barvy:** 🟢 volný | 🔴 obsazený | ⬜ blokovaný | 🟡 proposed | 🎄 vánoce

#### 3. JS Architektura

**Core:** `booking-app.js`, `calendar.js`, `booking-form.js`, `bulk-booking.js`, `single-room-booking.js`

**Shared:** BaseCalendar, DateUtils, ValidationUtils, BookingLogic, IdGenerator, PriceCalculator, ChristmasUtils, EmailService

**Code reduction:** Eliminováno >1000 řádků duplikátů díky SSOT refactoringu

### CSS & Styling

**Struktura:**

- `css/styles-unified.css` - Hlavní stylesheet (desktop-first)
- `css/mobile-improvements.css` - Mobilní vylepšení (TEMPORARY)

**⚠️ TECHNICAL DEBT - Mobile CSS:**

`mobile-improvements.css` používá `!important` overrides (463 řádků) jako dočasné řešení pro rychlá mobilní vylepšení.

**KRITICKÉ:** Tento soubor MUSÍ být načten PO `styles-unified.css`:

```html
<link
  rel="stylesheet"
  href="css/styles-unified.css"
/>
<link
  rel="stylesheet"
  href="css/mobile-improvements.css"
/>
<!-- MUST be after -->
```

**Budoucí refactoring (TODO):**

- Refaktorovat `styles-unified.css` na mobile-first přístup
- Odstranit všechny `!important` deklarace
- Konsolidovat do jednoho CSS souboru
- Viz `@docs/CSS_REFACTORING_PLAN.md` pro detaily

## Business pravidla

### Cenová politika

**⚠️ Dynamicky konfigurovatelné** z admin panelu.

**⚠️ NEW 2025-11-04:** Změna cenového modelu - admin nastavuje cenu **PRÁZDNÉHO pokoje** (bez hostů)

**Individuální rezervace - Nový model:**

Vzorec: `prázdný_pokoj + (VŠICHNI dospělí × příplatek) + (VŠECHNY děti × příplatek)`

**📊 AKTUÁLNÍ CENÍK (nastavený vedením, ověřeno 2025-11-10):**

**Individuální rezervace (room-size based pricing):**

ÚTIA zaměstnanci:
- Malý pokoj (prázdný): 250 Kč/noc + 50 Kč/dospělý + 25 Kč/dítě
- Velký pokoj (prázdný): 350 Kč/noc + 50 Kč/dospělý + 25 Kč/dítě

Externí hosté:
- Malý pokoj (prázdný): 400 Kč/noc + 100 Kč/dospělý + 50 Kč/dítě
- Velký pokoj (prázdný): 500 Kč/noc + 100 Kč/dospělý + 50 Kč/dítě

**Pokoje:**
- Malé pokoje (2-3 lůžka): P12, P13, P22, P23, P42, P43
- Velké pokoje (4 lůžka): P14, P24, P44

**Per-Room Guest Type:**
- Cena ÚTIA se použije, pokud je na pokoji **alespoň 1 zaměstnanec ÚTIA**
- Každý pokoj v multi-room booking může mít jiný typ hostů

**Příklad výpočtu:**
```
Malý pokoj, ÚTIA, 2 dospělí, 1 dítě, 2 noci:
= 250 × 2 + (2 × 50 × 2) + (1 × 25 × 2)
= 500 + 200 + 50
= 750 Kč
```

**⚠️ DŮLEŽITÉ:** Všichni dospělí a děti platí příplatky (žádný "první dospělý zdarma")

**Hromadná rezervace (celá chata):**

- ÚTIA: 2000 Kč/noc + 100 Kč/dospělý + 0 Kč/dítě
- Externí: 2000 Kč/noc + 250 Kč/dospělý + 50 Kč/dítě

**Backward Compatibility:**
- Starší rezervace (před 2025-11-04) mají zamknuté ceny (`price_locked = 1`)
- Při editaci starších rezervací se cena NEPŘEPOČÍTÁVÁ
- Nové rezervace používají nový vzorec

_Děti do 3 let (toddlers) vždy zdarma_

**Dokumentace:** Viz `/docs/NEW_PRICING_MODEL_IMPLEMENTATION.md` pro detaily implementace

### Vánoční období

**⚠️ KRITICKÁ LOGIKA - Datum-závislá pravidla**

**Základní nastavení:** Defaultně 23.12. - 2.1. (konfigurovatelné z admin panelu)

**Pravidla přístupového kódu:**

**Před 1. říjnem:**

- Single room: Vyžaduje přístupový kód
- Bulk: Vyžaduje přístupový kód

**Po 1. říjnu:**

- Single room: Kód NENÍ vyžadován
- Bulk: KOMPLETNĚ BLOKOVÁNO

**Pravidla počtu pokojů pro ÚTIA zaměstnance (PŘED 1. říjnem):**

- 1 pokoj: ✅ Vždy povolen
- 2 pokoje: ✅ Povoleno s varováním (musí být pro rodinu)
- 3+ pokoje: ❌ BLOKOVÁNO
- Po 1. říjnu: Bez omezení

**Implementace:** `ChristmasUtils.js`, `server.js:253`, `data.js:665`

### Kapacita pokojů

9 pokojů, 26 lůžek celkem:

- Patro 1: 12 (2), 13 (3), 14 (4)
- Patro 2: 22 (2), 23 (3), 24 (4)
- Patro 3: 42 (2), 43 (2), 44 (4)

### Edit a zrušení rezervace

**⚠️ 3-denní lhůta pro úpravu/zrušení**

- ✅ **Uživatelé mohou upravovat/rušit rezervaci**: ≥ 3 dny před začátkem
- ❌ **Uživatelé NEMOHOU upravovat/rušit**: < 3 dny před začátkem
- ✅ **Administrátoři mohou vždy**: upravovat/rušit bez omezení
- 📧 **Kontakt**: Pro změny v "locked" období kontaktovat admin na `chata@utia.cas.cz`

**Omezení editace pokojů:**

- V editačním okně **NELZE přidávat ani odebírat pokoje**
- Lze měnit pouze: termíny, počty hostů, typ hostů, jména, fakturační údaje
- Platí pro user i admin edit mode

**Dokumentace:** Viz `/docs/EDIT_DEADLINE_FEATURE.md` a `/docs/EDIT-ROOM-RESTRICTIONS.md`

## Bezpečnost

1. **Edit tokeny** (30 znaků) - Unikátní tokeny pro úpravu rezervací
2. **Admin session** - 7denní timeout, localStorage persistence, auto-refresh každou hodinu
3. **Validace vstupů** - Real-time kontrola všech polí (ValidationUtils)
4. **Trust Proxy** - Běží za nginx (`app.set('trust proxy', true)` pro správnou IP detekci)

## Důležité implementační detaily

### Inclusive Date Model

**⚠️ KRITICKÉ:** Všechny operace s daty používají **INCLUSIVE model**

- Rezervace 6.10-8.10 = hosté ubytováni 6.10 **I** 8.10 (obě noci)
- `startDate` = check-in (OBSAZENÝ)
- `endDate` = poslední den pobytu (OBSAZENÝ)

```javascript
// ✅ SPRÁVNĚ - Inclusive check
while (current <= endDate) { ... }
WHERE ? >= start_date AND ? <= end_date

// ❌ ŠPATNĚ - Exclusive (vynechá poslední den!)
while (current < endDate) { ... }
WHERE ? < end_date
```

### Night-Based Availability

- Každý den má 2 noci kolem sebe (PŘED a PO)
- **Available**: 0 nocí obsazeno (zelený, klikatelný)
- **Edge**: 1 noc obsazena (oranžový, klikatelný - hosté můžou přijet/odjet)
- **Occupied**: 2 noci obsazeny (červený, NEKLIKATELNÝ)

### Proposed Bookings

- 15min expirace, blokují dostupnost během rezervace
- Prevence race conditions
- LocalStorage prefilling validuje proposed status

## Environment Variables & Data Management

### Database Files

**DŮLEŽITÉ**: Databázové soubory (`data/*.db`) NEJSOU v gitu.

- Databáze se automaticky vytvoří při prvním spuštění
- Migrace z JSON se provede automaticky, pokud existuje `bookings.json`
- Detaily viz `data/README.md`

### Environment Variables

**KRITICKÉ**: Soubor `.env` obsahuje citlivé informace a NESMÍ být commitnut do gitu.

- ✅ `.env` je v `.gitignore`
- ✅ `.env.example` obsahuje šablonu s bezpečnými výchozími hodnotami
- ⚠️ **Při nasazení vždy změňte všechny secrets!**

**Povinné změny před produkcí:**

```bash
# Security - CHANGE ALL THESE VALUES
ADMIN_PASSWORD=<your-secure-admin-password>
API_KEY=<generate-a-long-random-api-key>
SESSION_SECRET=<generate-a-long-random-session-secret>

# Server Configuration
NODE_ENV=production
PORT=3000

# CORS Configuration (comma-separated origins)
ALLOWED_ORIGINS=http://localhost:3000,https://chata.utia.cas.cz

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Booking Settings
MAX_BOOKING_DAYS_AHEAD=365
MIN_BOOKING_DAYS_AHEAD=0

# Email konfigurace (již nastaveno pro produkci):
SMTP_HOST=hermes.utia.cas.cz
SMTP_PORT=25
SMTP_SECURE=false
EMAIL_FROM=noreply@chata.utia.cas.cz
APP_URL=http://chata.utia.cas.cz

# Christmas Period (konfigurovatelné z admin panelu)
CHRISTMAS_START=2024-12-23
CHRISTMAS_END=2025-01-02
CHRISTMAS_ACCESS_CODES=XMAS2024,VIP2024
```

### Backup Strategy

Pro zálohování databáze:

```bash
# Denní backup (doporučeno)
sqlite3 data/bookings.db ".backup data/backups/bookings-$(date +%Y%m%d).db"

# S retencí 30 dní
find data/backups -name "bookings-*.db" -mtime +30 -delete
```

**Doporučení:** Automatické denní backupy, retention 30 dní, offsite backup

## Dokumentace a Testy

### Dokumentace

Veškerá projektová dokumentace je v adresáři `docs/`:

- **@docs/TESTING.md** - Kompletní testing guide (unit, integration, E2E)
- **@docs/TEST-INSTRUCTIONS.md** - Manuální testovací instrukce
- **@docs/TEST_SUMMARY.md** - Souhrn testovacího pokrytí
- **@docs/ACCESS_LOGGING_DOCS.md** - Dokumentace access logování
- **@docs/ACCESS_LOGGING_SUMMARY.md** - Souhrn access logging implementace
- **@docs/LOGGING_GUIDE.md** - Průvodce logováním v aplikaci
- **@docs/EMAIL_IMPLEMENTATION_SUMMARY.md** - Implementace email notifikací
- **@docs/SMTP_VERIFICATION.md** - SMTP konfigurace a verifikace
- **@docs/SECURITY_IMPROVEMENTS.md** - Bezpečnostní vylepšení
- **@docs/PROPOSED_BOOKINGS_INDEX.md** - Index dokumentace proposed bookings
- **@docs/PROPOSED_BOOKINGS_ANALYSIS.md** - Analýza proposed bookings systému
- **@docs/PROPOSED_BOOKINGS_CODE_FLOW.md** - Code flow diagramy
- **@docs/PROPOSED_BOOKINGS_SUMMARY.txt** - Stručný souhrn
- **@docs/CHRISTMAS_VERIFICATION_REPORT.md** - Verifikace vánoční logiky
- **@docs/CHRISTMAS_EDGE_CASE_VERIFICATION_REPORT.md** - Edge cases vánoční logiky
- **@docs/EDIT_DEADLINE_FEATURE.md** - Feature: deadline pro editaci rezervací
- **@docs/EDIT-ROOM-RESTRICTIONS.md** - Omezení editace pokojů
- **@docs/CHANGELOG_2025-10-04.md** - Changelog k 4.10.2025
- **@docs/CHANGES-SUMMARY.md** - Souhrn změn

### Manuální Testy

Manuální testovací skripty jsou v `tests/manual/`:

- `test-booking.js` - Test booking flow
- `test-booking-flow.js` - Kompletní booking flow test
- `test-api.js` - API endpoint testy
- `test-christmas-logic.js` - Testování vánoční logiky
- `test-christmas-room-limit.js` - Test limitů pokojů o Vánocích
- `test-prices.js` - Test cenových výpočtů
- `test-price-update.js` - Test update cen
- `test-email-retry.js` - Test email retry logiky
- `test-accessibility.js` - Accessibility testy
- `test-frontend-devtools.js` - Frontend DevTools testing

**Spuštění manuálních testů:**

```bash
node tests/manual/test-booking.js
node tests/manual/test-api.js
# atd...
```

### Automatizované Testy

Automatizované testy (Jest, Playwright) jsou v `__tests__/` a `e2e/`:

```bash
npm test                 # Unit + integration testy
npm run test:e2e         # E2E testy (Playwright)
npm run test:coverage    # Coverage report
```
- VERY IMPORTANT: vždy získej maximální kontext z aplikace před začátkem implementace\
  CRITICAL: použij context7 před každou novou implemntací a získej relevantní dokumentaci k implementaci\
  CRITICAL: po každé implementaci restartuj app v dockeru a otestuj pomocí playwright MCP specializovaným agentem