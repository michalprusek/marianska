# Detailní Price Breakdown v Bulk Booking - 2025-11-06

## Summary

Upraveno zobrazení vyúčtování v bulk booking tak, aby ukazovalo **detailní rozpis příplatků** podle typu hostů (ÚTIA vs Externí) místo jediného generic řádku "Příplatek za dospělé".

---

## Změna

### Původní Zobrazení

```
Cena za jednu noc:
  Základní cena za celou chatu       2 000 Kč/noc
  Příplatek za dospělé             +1 100 Kč/noc  ← Generic (všichni dohromady)

Cena za noc celkem                   3 100 Kč
× 2
Celková cena                         6 200 Kč
```

**Problém:** Nebylo vidět, kolik stojí ÚTIA hosté vs Externí hosté.

### Nové Zobrazení

```
Cena za jednu noc:
  Základní cena za celou chatu                2 000 Kč/noc
  ÚTIA hosté: 1 dospělý × 100 Kč/noc          +100 Kč/noc  ← Zelená
  Externí hosté: 4 dospělí × 250 Kč/noc    +1 000 Kč/noc  ← Červená

Cena za noc celkem                            3 100 Kč
× 2
Celková cena                                  6 200 Kč
```

**Benefit:** Jasně viditelný breakdown podle typu každého hosta.

---

## Implementační Detaily

### Soubor: `js/bulk-booking.js`

#### 1. Skrytí Starých Generic Řádků (lines 305-309)

```javascript
// Hide old generic surcharge lines
const oldAdultsLine = document.getElementById('bulkAdultsPrice');
const oldChildrenLine = document.getElementById('bulkChildrenPrice');
if (oldAdultsLine) oldAdultsLine.style.display = 'none';
if (oldChildrenLine) oldChildrenLine.style.display = 'none';
```

**Důvod:** Staré HTML elementy (`bulkAdultsPrice`, `bulkChildrenPrice`) z `index.html` jsou stále přítomny, ale už se nepoužívají.

#### 2. Dynamický Container pro Detailní Řádky (lines 311-323)

```javascript
// Create or get detailed surcharges container
let detailedContainer = document.getElementById('bulkDetailedSurcharges');
if (!detailedContainer) {
  detailedContainer = document.createElement('div');
  detailedContainer.id = 'bulkDetailedSurcharges';
  detailedContainer.style.cssText = 'padding-left: 1rem;';

  // Insert after base price line
  const basePriceLine = basePriceEl?.parentElement;
  if (basePriceLine && basePriceLine.parentElement) {
    basePriceLine.parentElement.insertBefore(detailedContainer, basePriceLine.nextSibling);
  }
}

// Clear previous detailed lines
detailedContainer.innerHTML = '';
```

**Vytvoření:** Container se vloží dynamicky za řádek "Základní cena za celou chatu".

**Čištění:** Při každém přepočítání ceny se obsah vyčistí a vytvoří znovu (reactive update).

#### 3. Helper Funkce pro České Plurály (lines 328-339)

```javascript
// Helper function for pluralization
const getGuestLabel = (count, type) => {
  if (type === 'adult') {
    if (count === 1) return '1 dospělý';
    if (count >= 2 && count <= 4) return `${count} dospělí`;
    return `${count} dospělých`;
  } else {
    if (count === 1) return '1 dítě';
    if (count >= 2 && count <= 4) return `${count} děti`;
    return `${count} dětí`;
  }
};
```

**České plurály:**
- **Singulár** (1): dospělý, dítě
- **Paucal** (2-4): dospělí, děti
- **Plurál** (5+): dospělých, dětí

#### 4. Dynamické Generování Řádků (lines 341-423)

**ÚTIA Dospělí (zelená #059669):**

```javascript
if (utiaAdults > 0) {
  const line = document.createElement('div');
  line.className = 'price-line';
  line.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.9rem;';

  const label = document.createElement('span');
  label.textContent = `ÚTIA hosté: ${getGuestLabel(utiaAdults, 'adult')} × ${bulkPrices.utiaAdult.toLocaleString('cs-CZ')} Kč${perNightText}`;
  label.style.color = '#059669'; // Green

  const value = document.createElement('span');
  const utiaAdultTotal = utiaAdults * bulkPrices.utiaAdult;
  value.textContent = utiaAdultTotal > 0 ? `+${utiaAdultTotal.toLocaleString('cs-CZ')} Kč${perNightText}` : `0 Kč${perNightText}`;
  value.style.color = '#059669';

  line.appendChild(label);
  line.appendChild(value);
  detailedContainer.appendChild(line);
}
```

**Externí Dospělí (červená #dc2626):**

```javascript
if (externalAdults > 0) {
  // Same structure as ÚTIA, but with red color
  label.style.color = '#dc2626'; // Red
  value.style.color = '#dc2626';
}
```

**ÚTIA Děti (zelená, jen pokud > 0):**

```javascript
if (utiaChildren > 0) {
  const utiaChildTotal = utiaChildren * bulkPrices.utiaChild;
  if (utiaChildTotal > 0 || utiaChildren > 0) {
    // Display line (usually 0 Kč since utiaChild price is 0)
  }
}
```

**Externí Děti (červená, jen pokud cena > 0):**

```javascript
if (externalChildren > 0) {
  const externalChildTotal = externalChildren * bulkPrices.externalChild;
  if (externalChildTotal > 0) {
    // Display line
  }
}
```

---

## Příklady Zobrazení

### Příklad 1: Všichni ÚTIA (5 dospělých, 2 děti)

```
Cena za jednu noc:
  Základní cena za celou chatu                2 000 Kč/noc
  ÚTIA hosté: 5 dospělých × 100 Kč/noc         +500 Kč/noc
  ÚTIA děti: 2 děti × 0 Kč/noc                   0 Kč/noc

Cena za noc celkem                            2 500 Kč
× 3
Celková cena                                  7 500 Kč
```

### Příklad 2: Smíšená skupina (1 ÚTIA, 4 Externí)

```
Cena za jednu noc:
  Základní cena za celou chatu                2 000 Kč/noc
  ÚTIA hosté: 1 dospělý × 100 Kč/noc           +100 Kč/noc  (zelená)
  Externí hosté: 4 dospělí × 250 Kč/noc     +1 000 Kč/noc  (červená)

Cena za noc celkem                            3 100 Kč
× 2
Celková cena                                  6 200 Kč
```

### Příklad 3: Všichni Externí (3 dospělí, 3 děti)

```
Cena za jednu noc:
  Základní cena za celou chatu                2 000 Kč/noc
  Externí hosté: 3 dospělí × 250 Kč/noc       +750 Kč/noc
  Externí děti: 3 děti × 50 Kč/noc            +150 Kč/noc

Cena za noc celkem                            2 900 Kč
× 2
Celková cena                                  5 800 Kč
```

### Příklad 4: Komplex (2 ÚTIA dospělí, 1 ÚTIA dítě, 2 Externí dospělí, 1 Externí dítě)

```
Cena za jednu noc:
  Základní cena za celou chatu                2 000 Kč/noc
  ÚTIA hosté: 2 dospělí × 100 Kč/noc           +200 Kč/noc  (zelená)
  Externí hosté: 2 dospělí × 250 Kč/noc       +500 Kč/noc  (červená)
  ÚTIA děti: 1 dítě × 0 Kč/noc                   0 Kč/noc  (zelená)
  Externí děti: 1 dítě × 50 Kč/noc             +50 Kč/noc  (červená)

Cena za noc celkem                            2 750 Kč
× 2
Celková cena                                  5 500 Kč
```

---

## Color Coding

**Konzistence s Toggle Switchi:**

- **Zelená (#059669)**: ÚTIA hosté
  - Toggle switch unchecked = zelená
  - Řádky v price breakdown = zelená
  - "✅" emoji v price indicator

- **Červená (#dc2626)**: Externí hosté
  - Toggle switch checked = červená
  - Řádky v price breakdown = červená
  - "👤" emoji v price indicator

**Vizuální konzistence** napříč celým UI bulk bookingu.

---

## Technical Notes

### Reactive Updates

Řádky se generují při každém volání `updateBulkPriceCalculation()`:
- User přepne toggle switch → event listener → `updateBulkPriceCalculation()`
- User změní počet dospělých/dětí → `adjustBulkGuests()` → `updateBulkPriceCalculation()`
- Container se vyčistí (`innerHTML = ''`) a znovu naplní

### No HTML Changes Required

Staré HTML elementy v `index.html` zůstaly nedotčeny:
- `bulkAdultsPrice` (schovaný pomocí `display: none`)
- `bulkChildrenPrice` (schovaný pomocí `display: none`)

Nové řádky se vytváří **dynamicky pouze v JS** → žádná HTML změna potřeba.

### Backward Compatibility

**Pokud toggle switches nejsou viditelné** (např. při inicializaci před vyplněním jmen):
```javascript
} else {
  // If no toggles visible (shouldn't happen), default all to external
  externalAdults = adults;
  externalChildren = children;
}
```

Fallback na externí pricing pro všechny hosty.

---

## Testing Instructions

### Test 1: Všichni ÚTIA

1. Otevřít http://chata.utia.cas.cz
2. Kliknout "Hromadná rezervace celé chaty"
3. Vybrat termín (např. 15.11 - 17.11, 2 noci)
4. Nastavit: 3 dospělí, 0 dětí
5. Vyplnit jména
6. **Všechny toggle ponechat na ÚTIA (zelená)**

**Očekáváno:**
```
Základní cena: 2 000 Kč/noc
ÚTIA hosté: 3 dospělí × 100 Kč/noc = +300 Kč/noc
Cena za noc celkem: 2 300 Kč
× 2
Celková cena: 4 600 Kč
```

### Test 2: Smíšená skupina

1. Stejný proces
2. Toggle switche:
   - Dospělý 1: ÚTIA (zelená)
   - Dospělý 2: Externí (červená)
   - Dospělý 3: Externí (červená)

**Očekáváno:**
```
Základní cena: 2 000 Kč/noc
ÚTIA hosté: 1 dospělý × 100 Kč/noc = +100 Kč/noc  (zelená)
Externí hosté: 2 dospělí × 250 Kč/noc = +500 Kč/noc  (červená)
Cena za noc celkem: 2 600 Kč
× 2
Celková cena: 5 200 Kč
```

### Test 3: S dětmi

1. Nastavit: 2 dospělí, 2 děti
2. Toggle switche:
   - Dospělý 1: ÚTIA
   - Dospělý 2: Externí
   - Dítě 1: ÚTIA
   - Dítě 2: Externí

**Očekáváno:**
```
Základní cena: 2 000 Kč/noc
ÚTIA hosté: 1 dospělý × 100 Kč/noc = +100 Kč/noc
Externí hosté: 1 dospělý × 250 Kč/noc = +250 Kč/noc
ÚTIA děti: 1 dítě × 0 Kč/noc = 0 Kč/noc
Externí děti: 1 dítě × 50 Kč/noc = +50 Kč/noc
Cena za noc celkem: 2 400 Kč
× 2
Celková cena: 4 800 Kč
```

---

## Deployment

### Status

✅ **DEPLOYED TO PRODUCTION** (2025-11-06 18:46)

```bash
# Provedeno:
docker-compose down && docker-compose up --build -d
docker-compose ps  # ✅ Containers running
docker exec marianska-chata grep "Helper function for pluralization" /app/js/bulk-booking.js  # ✅ New code present
docker-compose logs web | tail -10  # ✅ Server running without errors
```

### Hard Refresh Required

Po nasazení proveďte **hard refresh** v prohlížeči:
- **Chrome/Firefox**: Ctrl + Shift + R
- **Mac**: Cmd + Shift + R

Tím se načte nový JS soubor s detailním breakdown.

---

## Related Documentation

- **Bulk Booking Fixes**: `BULK_BOOKING_FIXES_2025-11-06.md`
  - Per-guest pricing calculation
  - Edge visualization fix

- **Main Documentation**: `CLAUDE.md`
  - Bulk booking architecture
  - Price calculation overview

---

## Support

**Pro debugging:**

```bash
# Check if new code is deployed
docker exec marianska-chata grep "bulkDetailedSurcharges" /app/js/bulk-booking.js

# Check server logs
docker-compose logs web | tail -30

# Restart if needed
docker-compose restart web
```

**Browser console check:**

Pokud se nové řádky nezobrazují:
1. F12 → Console
2. Zkontrolovat chyby (červené)
3. Provést hard refresh (Ctrl+Shift+R)

---

**Implementováno:** 2025-11-06 18:46
**Status:** ✅ Production Ready
**Testing:** Manual testing required (see Test sections)
