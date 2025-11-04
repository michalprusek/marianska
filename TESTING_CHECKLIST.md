# Testovací checklist - Opravy cen a guest types

**Datum:** 2025-10-23
**Opravy:** Price breakdown + guest type preservation + base price logic

---

## ✅ Opravené problémy

1. **Price breakdown nerozlišoval typy hostů** - Nyní zobrazuje "150 Kč (1 ÚTIA × 50 Kč + 1 externí × 100 Kč)"
2. **Základní cena pokoje byla chybná** - Nyní 250 Kč pokud ≥1 ÚTIA host, 500 Kč pokud všichni externí
3. **Cena se nepřepočítávala při změně počtu hostů** - Nyní se přepočítá okamžitě
4. **Guest types se resetovaly** - Nyní se zachovávají při změně počtu

---

## 🧪 Test Scénář 1: Price Breakdown s Mixed Guest Types

### Kroky:
1. Otevři `http://chata.utia.cas.cz` v Chrome
2. Stiskni **F12** (otevře DevTools)
3. Klikni na libovolný pokoj v kalendáři (např. Pokoj 12)
4. V modalu nastav:
   - **Dospělí: 2**
   - **První host → Typ: ÚTIA zaměstnanec**
   - **Druhý host → Typ: Externí host**

### Očekávaný výsledek:

**Console logy:**
```
🔍 DEBUG generateInlineGuestNames: {
  guestCounts: { adults: 2, children: 0, toddlers: 0 },
  existingDataLength: 0,
  existingData: []
}

🔍 DEBUG generatePersonTypeInputs for adult: {
  count: 2,
  typeDataLength: 0
}

  → Creating row 1 for adult, preFillData: null (will default)
    ⚠️ No preFill: adult #1 → defaulting to 'utia'

  → Creating row 2 for adult, preFillData: null (will default)
    ⚠️ No preFill: adult #2 → defaulting to 'utia'
```

**Price Breakdown:**
```
Počet hostů: 2 dosp.
Základní cena za pokoj: 250 Kč
Příplatek za dospělé: 150 Kč (1 ÚTIA × 50 Kč + 1 externí × 100 Kč)
Cena za noc: 400 Kč
Počet nocí: × 2
Celkem: 800 Kč
```

✅ **Kontrola:**
- Základní cena = 250 Kč (protože ≥1 ÚTIA host)
- Příplatek zobrazuje oba typy hostů samostatně
- Celková cena = (250 + 50 + 100) × 2 = 800 Kč ✓

---

## 🧪 Test Scénář 2: Pouze Externí Hosté

### Kroky:
1. Otevři modal pro nový pokoj
2. Nastav:
   - **Dospělí: 1**
   - **První host → Typ: Externí host**

### Očekávaný výsledek:

**Price Breakdown:**
```
Počet hostů: 1 dosp.
Základní cena za pokoj: 500 Kč
Příplatek za dospělé: 100 Kč (1 externí × 100 Kč)
Cena za noc: 600 Kč
```

✅ **Kontrola:**
- Základní cena = 500 Kč (protože VŠICHNI hosté jsou externí)
- Celková cena = 500 + 100 = 600 Kč ✓

---

## 🧪 Test Scénář 3: Guest Type Preservation (KRITICKÝ TEST)

### Kroky:
1. Otevři modal
2. Nastav **Dospělí: 1**
3. Změň **První host → Typ: Externí host**
4. **Sleduj console** v DevTools
5. Klikni **"+1 Dospělý"** button

### Očekávaný výsledek:

**Console log sequence:**
```
🔍 DEBUG generateInlineGuestNames: {
  guestCounts: { adults: 2, ... },
  existingDataLength: 1,
  existingData: [{ type: 'adult', guestType: 'external' }]  ← ZACHOVÁNO!
}

🔍 DEBUG generatePersonTypeInputs for adult: {
  count: 2,
  typeDataLength: 1
}

  → Creating row 1 for adult, preFillData: external
    ✅ Using preFill: adult #1 → external  ← POUŽITO PRЕФILL!

  → Creating row 2 for adult, preFillData: null (will default)
    ⚠️ No preFill: adult #2 → defaulting to 'utia'
```

**Price Breakdown po změně:**
```
Počet hostů: 2 dosp.
Základní cena za pokoj: 250 Kč  ← 250 protože druhý host je ÚTIA (default)
Příplatek za dospělé: 150 Kč (1 externí × 100 Kč + 1 ÚTIA × 50 Kč)
Cena za noc: 400 Kč
```

✅ **Kontrola:**
- První host STÁLE "Externí host" (typ zachován!)
- Druhý host defaultuje na "ÚTIA" (nový host)
- Cena se OKAMŽITĚ přepočítala
- Console log ukazuje "Using preFill: adult #1 → external"

---

## 🧪 Test Scénář 4: Změna Guest Type u Existujícího Hosta

### Kroky:
1. Otevři modal s 2 dospělými (oba ÚTIA)
2. Změň **Druhý host → Typ: Externí host**
3. Sleduj console a price breakdown

### Očekávaný výsledek:

**Console log:**
```
(Po změně dropdownu druhého hosta)

Triggering price recalculation after guest type change...
```

**Price Breakdown:**
```
Počet hostů: 2 dosp.
Základní cena za pokoj: 250 Kč  ← 250 protože první je ÚTIA
Příplatek za dospělé: 150 Kč (1 ÚTIA × 50 Kč + 1 externí × 100 Kč)
Cena za noc: 400 Kč
```

✅ **Kontrola:**
- Cena se aktualizovala ihned po změně dropdownu
- Breakdown zobrazuje mix hostů správně

---

## 🧪 Test Scénář 5: Děti s Different Guest Types

### Kroky:
1. Otevři modal
2. Nastav:
   - **Dospělí: 1** (ÚTIA)
   - **Děti: 2**
   - **První dítě → Typ: ÚTIA**
   - **Druhé dítě → Typ: Externí**

### Očekávaný výsledek:

**Price Breakdown:**
```
Počet hostů: 1 dosp., 2 děti
Základní cena za pokoj: 250 Kč
Příplatek za dospělé: 50 Kč (1 ÚTIA × 50 Kč)
Příplatek za děti: 49 Kč (1 ÚTIA × 24 Kč + 1 externí × 25 Kč)
Cena za noc: 349 Kč
```

✅ **Kontrola:**
- Základní cena = 250 Kč (≥1 ÚTIA host)
- Děti správně započítány podle typu

---

## 🐛 Debugging Console Commands

### Zkontrolovat guestNamesData:
```javascript
window.singleRoomBooking.guestNamesData
```

**Expected output:**
```javascript
[
  { roomId: '12', personType: 'adult', guestType: 'external', name: '' },
  { roomId: '12', personType: 'adult', guestType: 'utia', name: '' }
]
```

### Zkontrolovat aktuální cenu:
```javascript
window.app.roomPrices.get('12')
```

### Manually trigger price recalculation:
```javascript
await window.app.updatePriceCalculation()
```

---

## ❌ Známé Problémy (Pokud Persisting)

### Pokud se guest types STÁLE resetují:
1. Zkontroluj console log při změně počtu hostů
2. Měl by zobrazit: `"existingDataLength: X"` kde X > 0
3. Měl by zobrazit: `"✅ Using preFill: adult #1 → external"`
4. Pokud ne, zkontroluj:
   - `collectInlineGuestNames()` je voláno PŘED `generateInlineGuestNames()`
   - Data jsou uložena do `this.guestNamesData`

### Pokud se cena STÁLE nepřepočítává:
1. Zkontroluj console log
2. Měl by zobrazit: `"Triggering price recalculation..."`
3. Zkontroluj pořadí v `adjustGuests()`:
   ```javascript
   // ✅ CORRECT ORDER:
   window.singleRoomBooking.generateInlineGuestNames();  // Update guestNamesData first
   await this.updatePriceCalculation();                   // Then recalculate price
   ```

---

## 📝 Poznámky

- **Hard refresh** může být nutný: Ctrl+Shift+R (vyčistí cache)
- Všechny console logy začínají `🔍 DEBUG` pro snadné filtrování
- Chrome DevTools → Console → Filter: "DEBUG" zobrazí jen debug logy

---

**Status:** ✅ Připraveno k testování
**Docker:** ✅ Kontejnery běží
**URL:** http://chata.utia.cas.cz
