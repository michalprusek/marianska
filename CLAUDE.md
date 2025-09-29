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

### Production (Docker)

```bash
docker-compose up -d                    # Start containers
docker-compose down                     # Stop containers
docker-compose up --build -d           # Rebuild and start containers

# IMPORTANT: After any code changes, you MUST rebuild the Docker containers:
docker-compose down && docker-compose up --build -d
```

## Architektura

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
      utia: {
        small: { base: 300, adult: 50, child: 25 },
        large: { base: 400, adult: 50, child: 25 }
      },
      external: {
        small: { base: 500, adult: 100, child: 50 },
        large: { base: 600, adult: 100, child: 50 }
      }
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

- `BaseCalendar.js` - **NOVÝ**: Unified calendar component (565 lines)
- `validationUtils.js` - Centralizované validační funkce
- `bookingLogic.js` - Unified booking conflict detection a date range utils

**Code Reduction:**

- Eliminováno ~656 řádků duplikovaného kódu
- single-room-booking.js: 586 → 284 řádků (-52%)
- bulk-booking.js: 937 → 583 řádků (-38%)

## Business pravidla

### Cenová politika

```
ÚTIA zaměstnanci:
- Malý pokoj: 300 Kč/noc základní cena + 50 Kč/další dospělý + 25 Kč/dítě
- Velký pokoj: 400 Kč/noc základní cena + 50 Kč/další dospělý + 25 Kč/dítě

Externí hosté:
- Malý pokoj: 500 Kč/noc základní cena + 100 Kč/další dospělý + 50 Kč/dítě
- Velký pokoj: 600 Kč/noc základní cena + 100 Kč/další dospělý + 50 Kč/dítě

Děti do 3 let: zdarma
```

### Vánoční období

- Defaultně: 23.12. - 2.1.
- Admin může nastavit vlastní rozsah
- Rezervace pouze s přístupovým kódem
- Bez kódů = kompletní blokace rezervací
- Maximálně 1-2 pokoje pro ÚTIA zaměstnance do 30.9.

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

### Unified Booking Logic

- `js/shared/bookingLogic.js`
- Centralizovaná detekce konfliktů
- Sdílené date range utility
- Konzistentní business rules

### Code Quality

- ESLint konfigurace
- Pre-commit hooks
- Prettier formátování
- Duplicate code detection
- Comprehensive test suite
