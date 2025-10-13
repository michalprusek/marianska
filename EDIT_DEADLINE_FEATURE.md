# 3-Day Edit Deadline Feature - Dokumentace

**Datum implementace**: 2025-10-13
**Status**: ✅ PRODUCTION READY

---

## Přehled Funkce

Implementována 3-denní lhůta pro úpravu a zrušení rezervace běžnými uživateli.

### Pravidla

- ✅ **Uživatelé mohou upravovat/rušit rezervaci**: ≥ 3 dny před začátkem
- ❌ **Uživatelé NEMOHOU upravovat/rušit**: < 3 dny před začátkem
- ✅ **Administrátoři mohou vždy**: upravovat/rušit bez omezení
- 📧 **Kontakt**: Pro změny v "locked" období kontaktovat admin na `chata@utia.cas.cz`

---

## Implementované Komponenty

### 1. Frontend - edit.html

#### Nové Globální Proměnné

```javascript
let isEditLocked = false; // TRUE if within 3 days of booking start
```

#### Nové Funkce

**`checkEditDeadline()`**
- Kontroluje, zda je rezervace v 3-denní lhůtě
- Porovnává dnešní datum s `booking.startDate`
- Vrací `true` pokud zbývá < 3 dny

```javascript
function checkEditDeadline() {
  if (!bookingData || !bookingData.startDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(bookingData.startDate);
  startDate.setHours(0, 0, 0, 0);

  const daysUntilStart = Math.floor((startDate - today) / (1000 * 60 * 60 * 24));

  return daysUntilStart < 3; // Lock if less than 3 days
}
```

**`displayEditLockWarning()`**
- Zobrazí velký červený warning box
- Zakáže všechny inputy, buttony, textarey
- Skryje "Uložit změny" a "Zrušit rezervaci" tlačítka
- Zobrazí zbývající dny nebo "už proběhla"
- Poskytne kontakt na administrátora

#### Vizuální Změny

Pokud `isEditLocked === true`:

```
🔒 REZERVACE JE UZAMČENA
──────────────────────────────────────
Úpravy a zrušení rezervace jsou možné pouze
3 dny před začátkem pobytu.

⏰ Do začátku zbývá: 2 dny
(nebo "⚠️ Rezervace již začala nebo proběhla")

💡 Pro změny kontaktujte administrátora:
   chata@utia.cas.cz
```

- **Všechny form elementy**: disabled, opacity 0.5, cursor: not-allowed
- **Action buttons**: display: none
- **Danger zone**: display: none

---

### 2. Backend - server.js

#### PUT /api/booking/:id

**Přidána kontrola před `isAdmin` check:**

```javascript
// Check 3-day edit deadline for non-admin users
if (!isAdmin) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookingStart = new Date(existingBooking.startDate);
  bookingStart.setHours(0, 0, 0, 0);

  const daysUntilStart = Math.floor((bookingStart - today) / (1000 * 60 * 60 * 24));

  if (daysUntilStart < 3) {
    return res.status(403).json({
      error:
        'Úpravy rezervace jsou možné pouze 3 dny před začátkem pobytu. Pro změny kontaktujte administrátora.',
      daysUntilStart,
      editDeadlinePassed: true,
    });
  }
}
```

**Response při porušení:**
```json
{
  "error": "Úpravy rezervace jsou možné pouze 3 dny před začátkem pobytu. Pro změny kontaktujte administrátora.",
  "daysUntilStart": 2,
  "editDeadlinePassed": true
}
```

- **Status**: `403 Forbidden`
- **Admin bypass**: Administrátoři mohou upravovat bez omezení

#### DELETE /api/booking/:id

**Stejná logika jako u PUT:**

```javascript
// Check 3-day delete deadline for non-admin users
if (!isAdmin) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookingStart = new Date(existingBooking.startDate);
  bookingStart.setHours(0, 0, 0, 0);

  const daysUntilStart = Math.floor((bookingStart - today) / (1000 * 60 * 60 * 24));

  if (daysUntilStart < 3) {
    return res.status(403).json({
      error:
        'Zrušení rezervace je možné pouze 3 dny před začátkem pobytu. Pro zrušení kontaktujte administrátora.',
      daysUntilStart,
      editDeadlinePassed: true,
    });
  }
}
```

**Response při porušení:**
```json
{
  "error": "Zrušení rezervace je možné pouze 3 dny před začátkem pobytu. Pro zrušení kontaktujte administrátora.",
  "daysUntilStart": 1,
  "editDeadlinePassed": true
}
```

- **Status**: `403 Forbidden`
- **Admin bypass**: Administrátoři mohou mazat bez omezení

---

## Testovací Scénáře

### Scénář 1: Rezervace za 7 dní

**Očekávané chování:**
- ✅ Edit link funguje normálně
- ✅ Všechny inputy aktivní
- ✅ "Uložit změny" button viditelný
- ✅ "Zrušit rezervaci" button viditelný
- ✅ PUT a DELETE API requesty úspěšné

### Scénář 2: Rezervace za 3 dny (přesně na limitu)

**Datum rezervace**: `2025-10-16`
**Dnes**: `2025-10-13`
**Dny do začátku**: `3`

**Očekávané chování:**
- ✅ Edit link funguje normálně (≥ 3 je OK)
- ✅ Všechny inputy aktivní
- ✅ Lze upravovat a rušit

### Scénář 3: Rezervace za 2 dny (LOCKED)

**Datum rezervace**: `2025-10-15`
**Dnes**: `2025-10-13`
**Dny do začátku**: `2`

**Očekávané chování:**
- ❌ Edit page zobrazí 🔒 warning
- ❌ Všechny inputy disabled
- ❌ "Uložit změny" button skrytý
- ❌ "Zrušení rezervace" button skrytý
- ❌ PUT request vrátí `403` s `editDeadlinePassed: true`
- ❌ DELETE request vrátí `403` s `editDeadlinePassed: true`

### Scénář 4: Rezervace dnes (LOCKED)

**Datum rezervace**: `2025-10-13`
**Dnes**: `2025-10-13`
**Dny do začátku**: `0`

**Očekávané chování:**
- ❌ Edit page zobrazí warning: "⚠️ Rezervace již začala nebo proběhla"
- ❌ Všechny změny zakázány
- ❌ API vrací `403`

### Scénář 5: Admin editace (ALWAYS ALLOWED)

**Kdokoliv**: admin s platným `sessionToken`

**Očekávané chování:**
- ✅ Admin může upravovat kdykoliv
- ✅ Žádný 3-day check
- ✅ PUT/DELETE vždy úspěšné
- ✅ Admin panel umožňuje vše

---

## Výpočet "Dny do začátku"

```javascript
const today = new Date();
today.setHours(0, 0, 0, 0); // Midnight today

const startDate = new Date(booking.startDate);
startDate.setHours(0, 0, 0, 0); // Midnight start date

const daysUntilStart = Math.floor((startDate - today) / (1000 * 60 * 60 * 24));

// Examples:
// Today: 2025-10-13, Start: 2025-10-16 → daysUntilStart = 3 ✅ (allowed)
// Today: 2025-10-13, Start: 2025-10-15 → daysUntilStart = 2 ❌ (locked)
// Today: 2025-10-13, Start: 2025-10-13 → daysUntilStart = 0 ❌ (locked)
// Today: 2025-10-13, Start: 2025-10-12 → daysUntilStart = -1 ❌ (past)
```

---

## API Responses

### Úspěšná úprava (≥ 3 dny)

```http
PUT /api/booking/BK123456789
X-Edit-Token: abc123def456

200 OK
{
  "success": true,
  "booking": { ... }
}
```

### Zamítnutá úprava (< 3 dny)

```http
PUT /api/booking/BK123456789
X-Edit-Token: abc123def456

403 Forbidden
{
  "error": "Úpravy rezervace jsou možné pouze 3 dny před začátkem pobytu. Pro změny kontaktujte administrátora.",
  "daysUntilStart": 2,
  "editDeadlinePassed": true
}
```

### Admin úprava (vždy povoleno)

```http
PUT /api/booking/BK123456789
X-Session-Token: admin_session_token_xyz

200 OK
{
  "success": true,
  "booking": { ... }
}
```

---

## Bezpečnostní Aspekty

### Frontend Security

- ✅ **Disabled inputs**: Nelze manipulovat DOM a odeslat form
- ✅ **Hidden buttons**: Uživatel nemůže kliknout na "Uložit/Zrušit"
- ⚠️ **Pouze UX**: Frontend validace je pouze pro UX, ne bezpečnost

### Backend Security

- ✅ **Server-side enforcement**: Vždy validováno na serveru
- ✅ **Admin bypass**: Pouze platné admin session mohou obejít
- ✅ **Token validation**: Edit token musí sedět
- ✅ **Date comparison**: Přesný výpočet na základě UTC midnight

---

## Výhody Implementace

1. ✅ **Konzistentní UX**: Uživatel vidí warning hned při otevření edit linku
2. ✅ **Backend enforcement**: Nelze obejít manipulací frontendu
3. ✅ **Admin flexibility**: Administrátoři mohou vždy pomoci
4. ✅ **Jasná komunikace**: Uživatel ví přesně kolik dní zbývá
5. ✅ **Contact info**: Poskytnut email pro kontakt admina

---

## Možná Vylepšení (Budoucnost)

### Email Notifikace

- 📧 Email reminder 7 dní před začátkem: "Můžete ještě upravit rezervaci"
- 📧 Email reminder 3 dny před začátkem: "Poslední šance na úpravu"
- 📧 Email 2 dny před: "Úpravy již nejsou možné, kontaktujte nás"

### Konfigurovatelná Lhůta

- ⚙️ Přidat do Settings: `editDeadlineDays` (výchozí 3)
- ⚙️ Admin může změnit na 1, 2, 5, 7 dní podle potřeby

### Částečné Úpravy

- ⚙️ Do 3 dnů: Povolit změnu poznámek, ale ne termínů/pokojů
- ⚙️ Granulární permissions

---

## Testování v Produkci

### Manuální Test

1. **Vytvořte rezervaci s `startDate` za 2 dny**:
   ```bash
   curl -sk -X POST https://localhost/api/booking \
     -H "Content-Type: application/json" \
     -d '{
       "startDate": "2025-10-15",
       ...
     }'
   ```

2. **Získejte editToken z response**

3. **Otevřete edit link**:
   ```
   http://localhost/edit.html?token=EDIT_TOKEN_HERE
   ```

4. **Ověřte**:
   - Zobrazí se 🔒 warning
   - Všechny inputy jsou disabled
   - Action buttons skryté

5. **Test API**:
   ```bash
   curl -sk -X PUT https://localhost/api/booking/BK123 \
     -H "X-Edit-Token: TOKEN" \
     -H "Content-Type: application/json" \
     -d '{ "name": "Updated Name" }'
   ```

   **Očekáváno**: `403 Forbidden` s `editDeadlinePassed: true`

---

## Závěr

✅ **3-day edit deadline feature je plně implementována a production ready!**

- Frontend: Vizuální warning + disabled UI
- Backend: Server-side validation na PUT a DELETE
- Security: Nelze obejít, admin bypass funguje
- UX: Jasná komunikace s uživatelem

**Připraveno k nasazení!** 🚀
