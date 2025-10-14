# Shrnutí změn - Multi-Room Booking Fix

## 🎯 Datum: 2025-10-14

## ✅ Provedené změny

### 1. Oprava konsolidační logiky (`js/booking-form.js:331-441`)

**Původní problém:**

- Při rezervaci více pokojů s různými termíny se snažilo vytvořit 1 booking s min/max date range
- Pokoje mohly mít např.: Pokoj 12 (15.10-18.10), Pokoj 13 (15.10-24.10)
- Systém vytvořil booking pro oba pokoje na 15.10-24.10
- Server odmítl, protože proposed booking pro Pokoj 12 byl jen do 18.10

**Nové chování:**

```javascript
// Detekce stejných termínů
const allSameDates = this.app.tempReservations.every(
  (r) => r.startDate === firstReservation.startDate && r.endDate === firstReservation.endDate
);

if (allSameDates) {
  // ✅ Pokoje se STEJNÝMI termíny → 1 konsolidovaná rezervace
  // - Všechny pokoje v rooms array
  // - Sečtení všech hostů (adults, children)
  // - Všechna jména hostů v guestNames array
} else {
  // ✅ Pokoje s RŮZNÝMI termíny → separátní bookings
  // - Každý pokoj = 1 booking
  // - Guest names rozdistribuována podle počtu hostů
}
```

### 2. Distribuce jmen hostů

**Nová funkce pro různé termíny:**

```javascript
// Distribuce jmen podle počtu hostů v každém pokoji
let guestNameIndex = 0;

for (const tempReservation of this.app.tempReservations) {
  const bookingGuestCount =
    (tempReservation.guests.adults || 0) + (tempReservation.guests.children || 0);
  const bookingGuestNames = guestNames.slice(guestNameIndex, guestNameIndex + bookingGuestCount);
  guestNameIndex += bookingGuestCount;

  // Vytvoř booking s příslušnými jmény
}
```

**Příklad distribuce:**

- Pokoj 12: 1 host → dostane 1. jméno
- Pokoj 13: 2 hosté → dostane 2. a 3. jméno

## 🔄 Deployment

```bash
# 1. Rebuild Docker kontejnerů
docker-compose down && docker-compose up --build -d

# 2. Verifikace
docker-compose ps  # Obě služby běží
docker exec marianska-chata grep "allSameDates" /app/js/booking-form.js  # Nový kód přítomen
```

## ✅ Verifikace nasazení

```bash
$ docker-compose ps
NAME                COMMAND                  STATUS
marianska-chata     "docker-entrypoint.s…"   Up
marianska-nginx     "/docker-entrypoint.…"   Up

$ docker exec marianska-chata grep "Check if all temp" /app/js/booking-form.js
        // Check if all temp reservations have the same start and end dates
        ✓ Nový kód přítomen
```

## 📊 Test scénáře

### Scénář 1: Pokoje se stejnými termíny

**Input:**

- Pokoj 12: 15.10-20.10, 1 dospělý
- Pokoj 13: 15.10-20.10, 1 dospělý
- Jména: Jan Novák, Petr Svoboda

**Expected Output:**

- 1 booking
- rooms: [12, 13]
- dates: 15.10-20.10
- adults: 2
- guestNames: [Jan Novák, Petr Svoboda]

### Scénář 2: Pokoje s různými termíny

**Input:**

- Pokoj 12: 15.10-18.10, 1 dospělý
- Pokoj 13: 15.10-24.10, 2 dospělí
- Jména: Jan Novák, Petr Svoboda, Marie Svobodová

**Expected Output:**

- 2 bookings

  Booking 1:
  - rooms: [12]
  - dates: 15.10-18.10
  - adults: 1
  - guestNames: [Jan Novák]

  Booking 2:
  - rooms: [13]
  - dates: 15.10-24.10
  - adults: 2
  - guestNames: [Petr Svoboda, Marie Svobodová]

## 🐛 Opravené bugy

1. ✅ **"Pokoj není dostupný dne X"** - při různých termínech více pokojů
2. ✅ **"Počet jmen neodpovídá počtu hostů"** - při konsolidaci rezervací
3. ✅ **Guest names rozdělení** - správná distribuce pro separátní bookings

## 📝 Soubory změněny

- `/js/booking-form.js` (lines 331-441)
  - Přidána detekce stejných/různých termínů
  - Přidána logika pro separátní bookings s různými termíny
  - Přidána distribuce guest names

## 🧪 Jak testovat

Viz `TEST-INSTRUCTIONS.md` pro detailní testovací scénáře.

**Quick test:**

1. Otevřít http://chata.utia.cas.cz
2. Vybrat 2 pokoje s RŮZNÝMI termíny
3. Vyplnit jména všech hostů
4. Odeslat rezervaci
5. ✅ Měly by se vytvořit 2 separátní bookings bez chyby

## 🔗 Důležité odkazy

- **Production**: http://chata.utia.cas.cz
- **Admin panel**: http://chata.utia.cas.cz/admin.html
- **Docker logs**: `docker-compose logs -f web`

## ⚠️ Poznámky

- Po změnách v JS je potřeba **hard refresh** (Ctrl+Shift+R)
- Admin panel zobrazuje guest names v detailu rezervace
- Edit okno umožňuje editovat guest names (admin i user)
