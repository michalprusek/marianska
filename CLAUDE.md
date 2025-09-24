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
- Data storage v `data/bookings.json`
- Endpoints:
  - `GET /api/data` - načtení všech dat
  - `POST /api/data` - uložení kompletních dat
  - `POST /api/booking` - vytvoření rezervace
  - `PUT /api/booking/:id` - úprava rezervace
  - `DELETE /api/booking/:id` - smazání rezervace

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

#### 2. Kalendář (app.js)
Interaktivní kalendář s pokročilými funkcemi.

**Funkce:**
- Zobrazení dostupnosti jednotlivých pokojů
- Barevné rozlišení podle emailu rezervace
- Výběr více dnů a pokojů
- Vizuální indikace vánočního období
- Blokování minulých dat
- Omezení na aktuální a následující rok

**Barvy a stavy:**
- 🟢 Zelená - volný pokoj
- 🔴 Červená - obsazený pokoj
- ⬜ Šedá - blokovaný pokoj
- 🎄 Zlatý rámeček - vánoční období

#### 3. Rezervační formulář
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
1. **Server mode** (preferovaný): Data v `data/bookings.json` přes Express API
2. **LocalStorage fallback**: Pro offline použití, klíč `chataMarianska`

### DataManager API
- `dataManager.initStorage()` - inicializace úložiště
- `dataManager.createBooking()` - vytvoření rezervace s ID a edit tokenem
- `dataManager.getRoomAvailability()` - kontrola dostupnosti
- `dataManager.calculatePrice()` - výpočet ceny podle typu hosta
- `dataManager.formatDate(date)` - formátování na YYYY-MM-DD

### Validace vstupů
- Email: obsahuje @, validní formát
- Telefon: +420/+421 + 9 číslic
- PSČ: přesně 5 číslic
- IČO: 8 číslic (volitelné)
- DIČ: formát CZ12345678 (volitelné)

### Editace rezervací
Každá rezervace má unikátní `editToken`. Přístup k editaci: `edit.html?token=XXX`

### Admin přístup
- URL: `/admin.html`
- Výchozí heslo: `admin123`
- Session-based autentizace (SessionStorage)