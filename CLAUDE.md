# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rezervační systém Chata Mariánská

Rezervační systém pro horskou chatu s 9 pokoji, navržený pro zaměstnance ÚTIA a externí hosty. SPA implementace s Node.js/Express backend a LocalStorage fallback pro offline režim.

## Commands

### Development (Local)

```bash
npm install          # Install dependencies
npm start           # Start production server on port 3000
npm run dev         # Start development server with auto-reload
```

**⚠️ KRITICKÉ: Server běží lokálně v terminálu uživatele - NIKDY do něj nezasahuj!**
- ❌ NIKDY: Nespouštěj `npm start`, `npm run dev` ani jiné serverové příkazy
- ❌ NIKDY: Nepoužívej `run_in_background: true` pro dlouhotrvající procesy
- ✅ VŽDY: Server ovládá uživatel ve svém terminálu
- ✅ VŽDY: Pouze upravuj kód, nikdy nerestartuj server

### Production (Docker)

```bash
docker-compose up -d                    # Start containers
docker-compose down                     # Stop containers
docker-compose up --build -d           # Rebuild and start containers

# IMPORTANT: After any code changes, you MUST rebuild the Docker containers:
docker-compose down && docker-compose up --build -d
```

## Architektura

### 🎯 SSOT (Single Source of Truth) - KRITICKÉ PRINCIPY

**⚠️ DŮLEŽITÉ**: Tento projekt důsledně dodržuje SSOT principy. **NIKDY** neimplementujte funkcionalitu dvakrát!

#### Znovupoužitelné komponenty (VŽDY použijte):

**1. BaseCalendar** (`js/shared/BaseCalendar.js`) - Unified kalendář pro VŠECHNY use-case:

- ✅ `SINGLE_ROOM` - Rezervace jednoho pokoje
- ✅ `BULK` - Hromadná rezervace celé chaty
- ✅ `EDIT` - Editace existující rezervace (admin)
- ✅ `GRID` - Přehled všech pokojů (hlavní stránka)

**2. ValidationUtils** (`js/shared/validationUtils.js`) - Centralizované validace:

- Email, telefon, PSČ, IČO, DIČ validace
- Automatické formátování (phone, ZIP)
- Unified error messages

**3. DateUtils** (`js/shared/dateUtils.js`) - Práce s daty:

- Formátování dat (YYYY-MM-DD, lokalizované zobrazení)
- Převody date ranges na intervaly
- Výpočty dnů mezi daty
- Utility funkce pro práci s daty

**4. BookingLogic** (`js/shared/bookingLogic.js`) - Business logika:

- Detekce konfliktů rezervací
- Kontrola překrývání termínů
- Validace date ranges
- @deprecated metody delegují na DateUtils

#### ❌ NIKDY NEDĚLEJTE:

```javascript
// ❌ Vytváření vlastního kalendáře
class MyCustomCalendar { ... }

// ❌ Kopírování validace
function myValidateEmail(email) { ... }

// ❌ Vlastní date formátování
function formatMyDate(date) { ... }

// ❌ Vlastní konfliktní detekce
function checkRoomAvailability() { ... }
```

#### ✅ VŽDY TAKTO:

```javascript
// ✅ Použijte BaseCalendar s režimem
new BaseCalendar({ mode: BaseCalendar.MODES.EDIT })

// ✅ Použijte ValidationUtils
ValidationUtils.validateEmail(email)

// ✅ Použijte DateUtils pro práci s daty
DateUtils.formatDate(date)
DateUtils.formatDateDisplay(date, 'cs')
DateUtils.getDaysBetween(start, end)

// ✅ Použijte BookingLogic pro konfliktní detekci
BookingLogic.checkBookingConflict(booking, existingBookings, roomId)
```

**Pravidlo**: Pokud se kód opakuje 2x+ → Přesuňte do `js/shared/`

**Přínosy refactoringu na SSOT**:
- Před: ~800 řádků duplikovaného kódu
- Po: 565 řádků v BaseCalendar, použito 4x
- Eliminováno: 656 řádků (-45% duplikátů)

### Backend API (server.js)

- Express server na portu 3000
- **Dual storage mode**: SQLite database (`data/bookings.db`) + LocalStorage fallback
- Endpoints:
  - `GET /api/data` - načtení všech dat
  - `POST /api/data` - uložení kompletních dat
  - `POST /api/booking` - vytvoření rezervace
  - `PUT /api/booking/:id` - úprava rezervace
  - `DELETE /api/booking/:id` - smazání rezervace
  - `POST /api/admin/login` - admin autentizace
  - `POST /api/admin/block-dates` - blokování termínů
  - Proposed bookings API pro dočasné rezervace

### Klíčové komponenty

#### 1. DataManager (data.js)

Centrální komponenta pro správu dat a business logiku.

**Hlavní funkce:**

- `initStorage()` - Inicializace LocalStorage s výchozími daty
- `createBooking()` - Vytvoření nové rezervace s unikátním ID a edit tokenem
- `getRoomAvailability()` - Kontrola dostupnosti pokoje pro daný den
- `isChristmasPeriod()` - Detekce vánočního období
- `calculatePrice()` - Výpočet ceny podle typu hosta a pokoje
- `sendBookingConfirmation()` - Mock email systém

**Datová struktura v LocalStorage:**

```javascript
{
  bookings: [
    {
      id: "BK1234567890ABC",
      name: "Jan Novák",
      email: "jan@example.com",
      phone: "+420123456789",
      company: "Firma s.r.o.",
      address: "Hlavní 123",
      city: "Praha",
      zip: "12345",
      ico: "12345678",
      dic: "CZ12345678",
      startDate: "2024-03-15",
      endDate: "2024-03-17",
      rooms: ["12", "13"],
      guestType: "utia",
      adults: 2,
      children: 1,
      toddlers: 0,
      totalPrice: 1500,
      notes: "Poznámka",
      editToken: "abc123def456",
      createdAt: "2024-03-01T10:00:00.000Z",
      updatedAt: "2024-03-01T10:00:00.000Z"
    }
  ],
  blockedDates: [
    {
      date: "2024-12-25",
      roomId: "12",
      reason: "Údržba",
      blockageId: "BLK123456",
      blockedAt: "2024-03-01T10:00:00.000Z"
    }
  ],
  settings: {
    adminPassword: "admin123",
    christmasAccessCodes: ["XMAS2024", "VIP123"],
    christmasPeriod: {
      start: "2024-12-23",
      end: "2025-01-02"
    },
    rooms: [
      { id: "12", name: "Pokoj 12", type: "small", beds: 2 }
    ],
    prices: {
      utia: { base: 298, adult: 49, child: 24 },
      external: { base: 499, adult: 99, child: 49 }
    },
    bulkPrices: {
      basePrice: 2000,
      utiaAdult: 100,
      utiaChild: 0,
      externalAdult: 250,
      externalChild: 50
    }
  }
}
```

#### 2. Kalendáře - Unified BaseCalendar (js/shared/BaseCalendar.js)

**NOVÁ ARCHITEKTURA 2025**: Jednotný kalendářní komponent použitý napříč celou aplikací.

**Režimy kalendáře:**

- `GRID` - Hlavní kalendář (grid view všech pokojů)
- `SINGLE_ROOM` - Mini kalendář pro rezervaci jednoho pokoje
- `BULK` - Hromadná rezervace (celá chata)
- `EDIT` - Admin úprava rezervace

**Konfigurace kalendáře:**

```javascript
new BaseCalendar({
  mode: BaseCalendar.MODES.SINGLE_ROOM,
  app: this.app,
  containerId: 'miniCalendar',
  roomId: roomId,
  enableDrag: true,
  allowPast: false,
  enforceContiguous: true,
  minNights: 2,
  onDateSelect: async (dateStr) => { /* callback */ },
  onDateDeselect: async (dateStr) => { /* callback */ }
})
```

**Funkce:**

- Zobrazení dostupnosti jednotlivých pokojů
- Barevné rozlišení podle emailu rezervace
- Drag selection pro výběr rozsahu dat
- Výběr více dnů s validací (minNights, maxNights)
- Vizuální indikace vánočního období
- Blokování minulých dat (configurable)
- Contiguous date enforcement pro bulk bookings
- **Year range configuration**:
  - GRID mode (main calendar): minulý rok + současný rok + příští rok
  - SINGLE_ROOM/BULK/EDIT modes: současný rok + příští rok

**Barvy a stavy:**

- 🟢 Zelená - volný pokoj
- 🔴 Červená - obsazený pokoj
- ⬜ Šedá - blokovaný pokoj
- 🟡 Žlutá - navržená (proposed) rezervace
- 🎄 Zlatý rámeček - vánoční období

**Integration:**

- `js/calendar.js` - Grid calendar pro hlavní stránku
- `js/single-room-booking.js` - Používá BaseCalendar.SINGLE_ROOM
- `js/bulk-booking.js` - Používá BaseCalendar.BULK

#### 3. Rezervační formulář (js/booking-form.js)

Dvoustupňový proces s validací v reálném čase.

**Krok 1: Výběr termínu a pokojů**

- Výběr dat v kalendáři
- Výběr pokojů (kontrola kapacity)
- Nastavení typu hosta (ÚTIA/Externí)
- Počet hostů (dospělí/děti/batolata)
- Automatický výpočet ceny

**Krok 2: Fakturační údaje**

- Validace v reálném čase:
  - Email: kontrola @, formát
  - Telefon: 9 číslic pro +420/+421
  - PSČ: přesně 5 číslic
  - IČO: 8 číslic (volitelné)
  - DIČ: formát CZ12345678 (volitelné)

#### 4. Administrace (admin.html)

Kompletní správa systému rozdělená do tabů.

**Taby:**

1. **Rezervace**
   - Přehled všech rezervací
   - Detail rezervace se všemi údaji
   - Editace a mazání rezervací
   - Export dat

2. **Blokované dny**
   - Blokování rozsahu dat
   - Výběr konkrétních pokojů
   - Důvod blokování
   - Správa existujících blokací

3. **Vánoční přístup**
   - Nastavení období vánočních prázdnin
   - Správa přístupových kódů
   - Kontrola oprávnění

4. **Nastavení pokojů a cen**
   - Konfigurace kapacity pokojů
   - Nastavení typu pokojů (malý/velký)
   - Ceník pro ÚTIA zaměstnance
   - Ceník pro externí hosty

5. **Statistiky**
   - Celkový počet rezervací
   - Obsazenost
   - Tržby
   - Průměrná délka pobytu

6. **Nastavení systému**
   - Změna admin hesla
   - Email konfigurace

#### 5. Modularní JS architektura (js/)

**Core Modules:**

- `booking-app.js` - Hlavní orchestrátor, koordinuje moduly
- `calendar.js` - Grid kalendář pro hlavní stránku
- `booking-form.js` - Formulářová logika a validace
- `bulk-booking.js` - Hromadné rezervace (refactorováno - používá BaseCalendar)
- `single-room-booking.js` - Single pokoj režim (refactorováno - používá BaseCalendar)
- `utils.js` - Pomocné funkce a utility
- `calendar-utils.js` - Sdílené kalendářní utility

**Shared Components (js/shared/):**

- `BaseCalendar.js` - Unified calendar component (565 lines, 4 modes)
- `dateUtils.js` - **NOVÝ 2025-10**: Centralized date formatting & manipulation
- `validationUtils.js` - Centralizované validační funkce
- `bookingLogic.js` - Unified booking conflict detection (deleguje date ops na DateUtils)

**Code Reduction:**

- Eliminováno ~656 řádků duplikovaného kódu
- single-room-booking.js: 586 → 284 řádků (-52%)
- bulk-booking.js: 937 → 583 řádků (-38%)

**Praktické příklady použití shared komponentů:**

```javascript
// 1. DATE UTILS - Formátování a práce s daty
const dateStr = DateUtils.formatDate(new Date()); // "2025-10-03"
const display = DateUtils.formatDateDisplay(new Date(), 'cs'); // "Pá 3. říj"
const nights = DateUtils.getDaysBetween(checkIn, checkOut); // 5
const ranges = DateUtils.getDateRanges(['2025-10-03', '2025-10-04', '2025-10-05']);
// [{start: '2025-10-03', end: '2025-10-05'}]

// 2. VALIDACE - Real-time form validation
const emailError = ValidationUtils.getValidationError('email', emailValue);
if (emailError) {
  showError(emailError);
}

// 3. BOOKING LOGIC - Conflict detection
const conflict = BookingLogic.checkBookingConflict(
  newBooking,
  existingBookings,
  roomId
);
if (conflict) {
  alert('Pokoj je již obsazen v tomto termínu');
}

// 4. KALENDÁŘ - Single room booking
const calendar = new BaseCalendar({
  mode: BaseCalendar.MODES.SINGLE_ROOM,
  containerId: 'miniCalendar',
  roomId: '12',
  enableDrag: true,
  minNights: 2,
  onDateSelect: async (dateStr) => {
    await this.handleDateSelection(dateStr);
  }
});
```

**Jak používat BaseCalendar pro různé režimy:**

| Režim | Použití | Soubor | Konfigurace |
|-------|---------|--------|-------------|
| `SINGLE_ROOM` | Rezervace 1 pokoje | `single-room-booking.js` | `enableDrag: true, minNights: 2` |
| `BULK` | Celá chata najednou | `bulk-booking.js` | `enforceContiguous: true` |
| `EDIT` | Admin editace | `admin.js` | `allowPast: true` |
| `GRID` | Přehled všech pokojů | `calendar.js` | Multi-room view |

## Business pravidla

### Cenová politika

**⚠️ DŮLEŽITÉ**: Všechny ceny jsou **dynamicky konfigurovatelné** z admin panelu v sekci "Nastavení pokojů a cen".

#### Individuální rezervace pokojů (výchozí hodnoty):

```
ÚTIA zaměstnanci:
- Základní cena: 298 Kč/noc za pokoj
- Příplatek za dospělého: 49 Kč
- Příplatek za dítě (3-18 let): 24 Kč
- Děti do 3 let: zdarma

Externí hosté:
- Základní cena: 499 Kč/noc za pokoj
- Příplatek za dospělého: 99 Kč
- Příplatek za dítě (3-18 let): 49 Kč
- Děti do 3 let: zdarma
```

#### Hromadná rezervace celé chaty (výchozí hodnoty):

```
🏢 Zaměstnanci ÚTIA:
- Základní cena za celou chatu: 2 000 Kč/noc
- Příplatek za dospělého: 100 Kč
- Příplatek za dítě (3-18 let): 0 Kč
- Děti do 3 let: zdarma

👥 Externí hosté:
- Základní cena za celou chatu: 2 000 Kč/noc
- Příplatek za dospělého: 250 Kč
- Příplatek za dítě (3-18 let): 50 Kč
- Děti do 3 let: zdarma
```

**Poznámka**: Admin může kdykoliv změnit ceny v admin panelu → sekce "Nastavení pokojů a cen".

### Vánoční období

**⚠️ KRITICKÁ LOGIKA - Datum-závislá pravidla přístupových kódů:**

#### Základní nastavení:
- Defaultně: 23.12. - 2.1.
- Admin může nastavit vlastní rozsah v admin panelu

#### Pravidla přístupového kódu (AKTUALIZOVÁNO 2025-10):

**Před 1. říjnem** (≤ 30.9. roku prvního dne vánočního období):
- ✅ **Single room rezervace**: Vyžaduje přístupový kód
- ✅ **Bulk rezervace (celá chata)**: Vyžaduje přístupový kód
- **Příklad**: Vánoční období 12.12.2025-3.1.2026, dnes 4.4.2025 → kód VYŽADOVÁN
- **Příklad**: Vánoční období 4.1.2026-3.3.2026, dnes 15.9.2025 → kód VYŽADOVÁN

**Po 1. říjnu** (> 30.9. roku prvního dne vánočního období):
- ✅ **Single room rezervace**: Přístupový kód NENÍ vyžadován
- ❌ **Bulk rezervace (celá chata)**: KOMPLETNĚ BLOKOVÁNO
- **Příklad**: Vánoční období 12.12.2025-3.1.2026, dnes 5.10.2025 → single OK bez kódu, bulk BLOKOVÁN
- **Chybová hláška**: "Hromadné rezervace celé chaty nejsou po 1. říjnu povoleny pro vánoční období. Rezervujte jednotlivé pokoje."

#### Implementační detaily:
- **Server-side**: `checkChristmasAccessRequirement()` v `server.js:253`
- **Client-side**: `checkChristmasAccessRequirement()` v `data.js:665`
- **Bulk booking validation**: `confirmBulkDates()` v `bulk-booking.js:358`
- **Form UI**: Dynamické zobrazení pole pro kód v `booking-form.js:38`

### Kapacita pokojů

```
Patro 1: Pokoje 12 (2 lůžka), 13 (3 lůžka), 14 (4 lůžka)
Patro 2: Pokoje 22 (2 lůžka), 23 (3 lůžka), 24 (4 lůžka)
Patro 3: Pokoje 42 (2 lůžka), 43 (2 lůžka), 44 (4 lůžka)
Celkem: 26 lůžek
```

## Bezpečnostní opatření

1. **Edit tokeny** - Unikátní tokeny pro úpravu rezervací
2. **Admin přístup** - Chráněn heslem (session storage)
3. **Validace vstupů** - Kontrola všech formulářových polí
4. **Ochrana soukromí** - Skrytí osobních údajů v kalendáři
5. **Vánoční kódy** - Omezení přístupu během špičky

## Důležité implementační detaily

### 🔧 Jak rozšířit shared komponenty (POVINNÝ POSTUP)

**Pokud potřebujete novou funkcionalitu:**

1. **NEJDŘÍV ZKONTROLUJTE**, zda už neexistuje v `js/shared/`
2. **ROZŠIŘTE existující** shared komponent, NEtvořte nový soubor
3. **PŘIDEJTE TESTY** do příslušného test souboru
4. **DOKUMENTUJTE** v CLAUDE.md

**Příklad - Přidání nové validace:**

```javascript
// ✅ SPRÁVNĚ - Přidat do js/shared/validationUtils.js
class ValidationUtils {
  // ... existující metody

  static validateBirthNumber(birthNumber) {
    // Validace rodného čísla pro ČR
    if (!birthNumber) return false;
    return /^\d{6}\/\d{4}$/.test(birthNumber);
  }
}

// Pak použít všude stejně:
const isValid = ValidationUtils.validateBirthNumber(rc);
```

**Příklad - Rozšíření BaseCalendar:**

```javascript
// ✅ SPRÁVNĚ - Přidat nový režim do js/shared/BaseCalendar.js
static MODES = {
  GRID: 'grid',
  SINGLE_ROOM: 'single_room',
  BULK: 'bulk',
  EDIT: 'edit',
  WEEKLY: 'weekly'  // Nový režim pro týdenní pohled
};
```

**❌ NIKDY:**

```javascript
// ❌ Vytváření nového souboru s duplicitní funkcionalitou
// js/myValidations.js
function validateMyEmail(email) { ... }  // JIŽ EXISTUJE v ValidationUtils!

// ❌ Kopírování kódu z BaseCalendar
// js/weekly-calendar.js
class WeeklyCalendar { ... }  // POUŽIJTE BaseCalendar s novým režimem!
```

### Dual Storage Mode

Systém podporuje dva režimy ukládání:

1. **SQLite mode** (preferovaný): Data v `data/bookings.db` přes DatabaseManager
2. **LocalStorage mode** (fallback): Pro offline použití, klíč `chataMarianska`, používá DataManager

**Proposed Bookings:**

- Dočasné rezervace s 15min expirací
- Blokují dostupnost během rezervačního procesu
- Automaticky se čistí po expiraci
- SQLite tabulka: `proposed_bookings`

### DataManager API

- `dataManager.initStorage()` - inicializace úložiště
- `dataManager.createBooking()` - vytvoření rezervace s ID a edit tokenem
- `dataManager.getRoomAvailability()` - kontrola dostupnosti
- `dataManager.calculatePrice()` - výpočet ceny podle typu hosta
- `dataManager.formatDate(date)` - formátování na YYYY-MM-DD

### Validace vstupů (js/shared/validationUtils.js)

**Centralizované validační funkce:**

- `ValidationUtils.validateEmail(email)` - Email formát
- `ValidationUtils.validatePhone(phone)` - Telefon +420/+421 + 9 číslic
- `ValidationUtils.validateZIP(zip)` - PSČ přesně 5 číslic
- `ValidationUtils.validateICO(ico)` - IČO 8 číslic (volitelné)
- `ValidationUtils.validateDIC(dic)` - DIČ formát CZ12345678 (volitelné)
- `ValidationUtils.validateDateRange(startDate, endDate)` - Validace rozsahu dat
- `ValidationUtils.validateRequiredFields(data, fields)` - Kontrola povinných polí

### Editace rezervací

Každá rezervace má unikátní `editToken`. Přístup k editaci: `edit.html?token=XXX`

### Admin přístup

- URL: `/admin.html`
- Výchozí heslo: `admin123`
- Session-based autentizace (SessionStorage)

## Nedávné vylepšení (2025)

### Unifikace kalendářů

**Před refactorováním:**

- 3 separátní implementace kalendáře (grid, single-room, bulk)
- ~800+ řádků duplikovaného kódu
- Nekonzistentní chování napříč kalendáři
- Těžká údržba

**Po refactorování:**

- Jeden `BaseCalendar` komponent s 4 režimy
- Configuration-based behavior
- Eliminováno 656 řádků duplikovaného kódu
- Konzistentní UX napříč aplikací
- Snadnější testování a údržba

### Konsolidace validace

- Centralizováno do `js/shared/validationUtils.js`
- Jednotné chování client-side i server-side
- Reusable validační funkce

### Unified Date Utilities (2025-10-03)

- **Nový modul** `js/shared/dateUtils.js`
- Eliminuje duplikaci date formátování napříč:
  - `data.js` (DataManager)
  - `js/utils.js` (UtilsModule)
  - `js/shared/bookingLogic.js` (BookingLogic)
- Unified API pro:
  - Date formátování (ISO, lokalizované)
  - Date ranges a intervaly
  - Date arithmetic (addDays, getDaysBetween)
  - Date validace (isPast)
- Zpětná kompatibilita přes @deprecated metody

### Unified Booking Logic

- `js/shared/bookingLogic.js`
- Centralizovaná detekce konfliktů
- Deleguje date operace na DateUtils (SSOT)
- Konzistentní business rules

### Code Quality & SSOT Enforcement

- **ESLint konfigurace** - Automatická kontrola kvality kódu
- **Pre-commit hooks** - Zabraňuje commitu špatného kódu
- **Prettier formátování** - Konzistentní code style
- **Duplicate code detection (jscpd)** - **KRITICKÉ**: Max 5% duplikátů povoleno
- **Comprehensive test suite** - Pokrytí 70-80%

**DŮLEŽITÉ**: Před každým commitem spusťte:

```bash
npm run pre-commit  # Kontroluje linting, formatting, duplikáty
```

Pokud jscpd hlásí duplikáty → **REFAKTORUJTE** do `js/shared/` před commitem!

## Bezpečnost a Data Management

### Database Files

**DŮLEŽITÉ**: Databázové soubory (`data/*.db`) NEJSOU trackovány v gitu z bezpečnostních důvodů a pro prevenci konfliktů.

- Databáze se automaticky vytvoří při prvním spuštění
- Migrace z JSON se provede automaticky, pokud existuje `bookings.json`
- Detaily viz `data/README.md`

### Environment Variables

**KRITICKÉ**: Soubor `.env` obsahuje citlivé informace a NESMÍ být commitnut do gitu.

- ✅ `.env` je v `.gitignore`
- ✅ `.env.example` obsahuje šablonu s bezpečnými výchozími hodnotami
- ⚠️ **Při nasazení vždy změňte všechny secrets!**

Povinné změny před produkcí:
```bash
# Vygenerujte silná hesla pro:
ADMIN_PASSWORD=<change-this>
API_KEY=<change-this>
SESSION_SECRET=<change-this>
```

### Backup Strategy

Pro zálohování databáze v produkci:

```bash
# Denní backup (doporučeno)
sqlite3 data/bookings.db ".backup data/backups/bookings-$(date +%Y%m%d).db"

# S retencí 30 dní
find data/backups -name "bookings-*.db" -mtime +30 -delete
```

Doporučení:
- Automatické denní backupy
- Retention 30 dní
- Offsite backup (cloud storage)
- Test restore procedury měsíčně
