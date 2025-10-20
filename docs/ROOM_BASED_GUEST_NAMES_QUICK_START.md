# Room-Based Guest Names - Quick Start Guide

**Datum**: 2025-10-20
**Status**: ✅ IMPLEMENTOVÁNO

---

## Co bylo změněno

Jména hostů jsou nyní **organizována podle pokojů** ve všech částech aplikace:

### Před změnou:
```
Jména hostů:
Dospělí: Jan Novák, Petr Svoboda, Marie Svobodová
Děti: Anna Nováková, Jakub Svoboda
```

### Po změně (multi-room booking):
```
Jména hostů (podle pokojů):

Pokoj 12
  Dospělí: Jan Novák
  Děti: Anna Nováková

Pokoj 13
  Dospělí: Petr Svoboda, Marie Svobodová
  Děti: Jakub Svoboda
```

---

## Upravené soubory

### Database
- `database.js` - Přidán sloupec `room_id` do tabulky `guest_names`

### Frontend
- `js/shared/GuestNameUtils.js` - **NOVÝ** utility pro organizaci jmen podle pokojů
- `js/booking-form.js` - Automatické přiřazení room IDs při vytvoření rezervace
- `admin.js` - Nová metoda `renderGuestNamesByRoom()` pro zobrazení

### HTML
- `admin.html`, `index.html`, `edit.html` - Přidán script `GuestNameUtils.js`

---

## Jak to funguje

### 1. Vytvoření rezervace

```javascript
// Uživatel vybere více pokojů a vyplní jména
// Booking form automaticky přiřadí room_id:

guestNames = [
  {personType: 'adult', firstName: 'Jan', lastName: 'Novák', roomId: '12'},
  {personType: 'child', firstName: 'Anna', lastName: 'Nováková', roomId: '12'},
  {personType: 'adult', firstName: 'Petr', lastName: 'Svoboda', roomId: '13'}
]
```

### 2. Uložení do databáze

```sql
-- guest_names tabulka nyní obsahuje:
booking_id | person_type | first_name | last_name   | room_id
-----------|-------------|------------|-------------|--------
BK123...   | adult       | Jan        | Novák       | 12
BK123...   | child       | Anna       | Nováková    | 12
BK123...   | adult       | Petr       | Svoboda     | 13
```

### 3. Zobrazení v admin panelu

```javascript
// Admin panel automaticky organizuje podle pokojů
const perRoomGuestNames = GuestNameUtils.organizeByRoom(
  booking.guestNames,
  booking.perRoomGuests,
  booking.rooms
);

// Výsledek:
{
  '12': [{Jan Novák}, {Anna Nováková}],
  '13': [{Petr Svoboda}]
}
```

---

## Použití GuestNameUtils

### Organizace jmen podle pokojů

```javascript
const perRoomGuestNames = GuestNameUtils.organizeByRoom(
  guestNames,      // Array of guest objects
  perRoomGuests,   // {'12': {adults: 1, children: 0}, ...}
  rooms            // ['12', '13', '14']
);
```

### Formátování pro zobrazení

```javascript
// Textový formát
const text = GuestNameUtils.formatForDisplay(perRoomGuestNames);
// "Pokoj 12: Jan Novák, Anna Nováková\nPokoj 13: Petr Svoboda"

// HTML formát
const html = GuestNameUtils.renderHTML(perRoomGuestNames, {
  showPersonType: true,
  layout: 'list'
});
```

### Validace

```javascript
const validation = GuestNameUtils.validate(guestNames, perRoomGuests);
if (!validation.valid) {
  console.error('Chyby:', validation.errors);
}
```

---

## Kompatibilita se starými rezervacemi

### Stávající rezervace (před implementací)

**Databáze**: `room_id` je `NULL`
**Zobrazení**: Automaticky fallback na zobrazení podle typu (adult/child/toddler)
**Chování**: Žádné změny, vše funguje stejně jako před

### Nové rezervace

**Databáze**: `room_id` vyplněno
**Zobrazení**: Organizováno podle pokojů
**Multi-room**: Jasná vazba jméno → pokoj

---

## Testování

### Testovací scénář 1: Multi-room s různými termíny

```
1. Vytvořte rezervaci:
   - Pokoj 12: 15.10-18.10, 1 dospělý (Jan Novák)
   - Pokoj 13: 15.10-24.10, 2 dospělí (Petr Svoboda, Marie Svobodová)

2. Zkontrolujte admin panel:
   ✓ Pokoj 12: Jan Novák
   ✓ Pokoj 13: Petr Svoboda, Marie Svobodová
```

### Testovací scénář 2: Single room

```
1. Vytvořte rezervaci:
   - Pokoj 12: 15.10-20.10, 2 dospělí, 1 dítě

2. Zkontrolujte admin panel:
   ✓ Zobrazení podle typu (legacy formát)
   ✓ Všechna jména mají room_id = '12' v databázi
```

---

## Deployment

### Před nasazením

✅ Všechny soubory upraveny
✅ Database schema kompatibilní s old + new data
✅ Backward compatible
✅ Žádné breaking changes

### Nasazení

```bash
# 1. Rebuild Docker kontejnerů
docker-compose down && docker-compose up --build -d

# 2. Verifikace
docker-compose logs -f web

# 3. Test admin panelu
# Otevřete: http://chata.utia.cas.cz/admin.html
# Klikněte na detail rezervace
# Ověřte: "Jména hostů (podle pokojů)" s room badges
```

### Po nasazení

- Staré rezervace fungují stejně jako před
- Nové rezervace mají room assignments
- Žádná migrace dat není potřeba

---

## Nejčastější problémy

### Jména se nezobrazují podle pokojů

**Příčina**: `GuestNameUtils.js` není načten
**Řešení**: Zkontrolujte console browser, měli byste vidět `GuestNameUtils` jako global object

### Legacy booking nezobrazuje jména

**Příčina**: Fallback logic selhává
**Řešení**: Zkontrolujte `renderGuestNamesByRoom()` v admin.js - měl by použít fallback

### Room ID assignment selhává

**Příčina**: `tempReservations` context chybí
**Řešení**: Zkontrolujte `assignRoomIds()` v booking-form.js

---

## Další zdroje

- **Kompletní dokumentace**: `/docs/ROOM_BASED_GUEST_NAMES_IMPLEMENTATION.md`
- **GuestNameUtils API**: `/js/shared/GuestNameUtils.js` (in-code documentation)
- **Database schema**: `/database.js:237-256`

---

## Rychlá reference

| Co chci udělat | Kde najdu |
|----------------|-----------|
| Organizovat jména podle pokojů | `GuestNameUtils.organizeByRoom()` |
| Zobrazit jména v admin panelu | `adminPanel.renderGuestNamesByRoom()` |
| Upravit databázové schema | `database.js:237-256` |
| Změnit assignment logiku | `booking-form.js:1318-1365` |
| Přidat novou display metodu | Rozšířit `GuestNameUtils.js` |

---

**Hotovo!** 🎉

Systém je připraven pro deployment a testování.
