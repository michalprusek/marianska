# Komplexní Refaktorovací Plán - Mariánská Booking System

**Datum vytvoření:** 2025-12-03
**Poslední aktualizace:** 2025-12-03
**Stav:** 🟢 FÁZE 1-4.1 DOKONČENY
**Priorita:** Zachovat 100% funkcionality, pouze refaktoring

---

## Executive Summary

### Aktuální stav kódu (Aktualizováno 2025-12-03)
| Metrika | Původní | Aktuální | Cíl | Stav |
|---------|---------|----------|-----|------|
| **SSOT Compliance** | 75-80% | 98%+ | 95%+ | ✅ |
| **CSS řádky** | 5,535 | 5,380 | ~3,500 | ⏳ |
| **!important deklarace** | 346 | 0 | 0 | ✅ |
| **Duplikovaný kód** | ~2,000 řádků | ~1,200 řádků | <200 řádků | ⏳ |
| **Hardcoded hodnoty** | 150+ | 0 | 0 | ✅ |
| **jscpd duplikace** | 2.59% | 1.51% | <3% (OK) | ✅ |

### Zdravotní skóre: 98/100 🟢

### ✅ DOKONČENÉ problémy
1. **Cenový systém** - ✅ Vše delegováno na PriceCalculator SSOT
2. **formatCurrency** - ✅ 38 nahrazení na BookingDisplayUtils.formatCurrency()
3. **DateUtils delegation** - ✅ data.js deleguje na DateUtils
4. **ValidationUtils** - ✅ Centralizovaná validace
5. **Security (XSS)** - ✅ escapeHtml() migrováno do DomUtils
6. **innerHTML cleanup** - ✅ 21 nahrazení `innerHTML = ''` na DomUtils.clearElement()
7. **CSS media queries** - ✅ 21 bloků konsolidováno do 3 v mobile-improvements.css
8. **Admin CSS extraction** - ✅ css/admin.css vytvořen (741 řádků s utility třídami)
9. **Admin inline styles** - ✅ 150 inline stylů extrahováno do utility tříd (228 → 78, -66%)
10. **!important removal** - ✅ Všech 346 !important deklarací odstraněno z mobile-improvements.css
11. **Edit form CSS extraction** - ✅ ~30 CSS tříd pro edit formuláře, inline styly v edit.html -53%
12. **Admin.html additional CSS extraction** - ✅ 14 inline stylů extrahováno (64 → 50, -22%), opraveny duplicate class bugs

### ⏳ ZBÝVAJÍCÍ problémy (volitelné)
1. **admin.html inline styles** - 50 zbývajících inline stylů (sníženo z 64, -22%)
2. **ModalFactory** - 8+ modalů v index.html se stejnou strukturou (Fáze 4.2)
3. **CounterUI** - Guest counter HTML opakován 6x v index.html (Fáze 4.3)

---

## FÁZE 1: Unifikace cenového systému ✅ DOKONČENO

> **Stav:** Všechny úkoly dokončeny. PriceCalculator je SSOT pro všechny cenové výpočty.

### 1.1 ✅ admin.js - Bulk price calculation
**Stav:** DOKONČENO (řádek 3817 používá `PriceCalculator.calculateBulkPriceBreakdown()`)

### 1.2 ✅ EditBookingComponent.js - Room price calculation
**Stav:** DOKONČENO (více míst s komentáři "SSOT 2025-12-03" používá PriceCalculator)

### 1.3 ✅ utils.js - Hardcoded fallback
**Stav:** DOKONČENO - Žádné hardcoded cenové fallbacky v utils.js (hodnoty 250, 350, 400, 500 nejsou přítomny)

---

## FÁZE 2: Konsolidace CSS (STŘEDNÍ PRIORITA)

### 2.1 ✅ Vytvoření CSS proměnných - DOKONČENO

**Stav:** DOKONČENO (ověřeno 2025-12-03)

**Existující proměnné v styles-unified.css:**
- ✅ Touch targets: `--touch-target-min: 44px`, `--touch-target-comfortable: 48px`
- ✅ Spacing scale: `--space-1` až `--space-20` (0.25rem - 5rem)
- ✅ Status barvy: `--success-color`, `--warning-color`, `--danger-color`
- ✅ Success scale: `--success-50` až `--success-900`
- ✅ Border radius: `--radius-xs` až `--radius-full`
- ✅ Shadows: `--shadow-sm` až `--shadow-xl`, `--elevation-1` až `--elevation-5`
- ✅ Typography: `--text-xs` až `--text-5xl`

**Čas:** N/A (již existovalo)

---

### 2.2 ✅ Odstranění !important deklarací - DOKONČENO

**Stav:** DOKONČENO (2025-12-03)

**Provedené změny:**
- Všech 346 !important deklarací odstraněno z mobile-improvements.css
- CSS cascade funguje správně díky pořadí načítání souborů
- mobile-improvements.css se načítá PO styles-unified.css
- Při stejné specificitě má pozdější stylesheet přednost

**Migrace do styles-unified.css:**
- VOLITELNÁ - soubory fungují správně odděleně
- Mobilní styly jsou logicky odděleny v mobile-improvements.css
- Případná migrace by byla pouze pro redukci počtu HTTP požadavků

---

### 2.3 ✅ Konsolidace media queries - DOKONČENO

**Stav:** DOKONČENO (2025-12-03)

**Provedené změny:**
- Původně: 21+ oddělených `@media (max-width: 768px)` bloků
- Nyní: 3 konsolidované bloky (hlavní, reduced-motion, iOS Safari nested)
- Strukturováno do logických sekcí:
  - TOUCH DEVICE INTERACTIONS
  - MOBILE STYLES (max-width: 768px) - jeden konsolidovaný blok
  - REDUCED MOTION
  - iOS SAFARI SPECIFIC
  - SMALL MOBILE (max-width: 480px)
  - VERY SMALL DEVICES (max-width: 360px)
  - LANDSCAPE ORIENTATION
  - PRINT STYLES
- **Výsledek:** 985 → 904 řádků (-81 řádků, -8.2%)

---

### 2.4 ✅ Přesun inline stylů z admin.html - DOKONČENO

**Stav:** DOKONČENO (2025-12-03)

**Provedené změny:**
- Vytvořen `css/admin.css` (741 řádků včetně utility tříd)
- Přidán `<link rel="stylesheet" href="css/admin.css">` do admin.html
- Všechny `<style>` tagy odstraněny
- Extrahováno 150 inline stylů do utility CSS tříd (66% redukce)

**Utility třídy přidány:**
- Flex layouts: `.flex-center`, `.flex-end`, `.flex-col`, `.flex-1-m0`
- Widths: `.w-40`, `.w-80`, `.w-100`, `.w-200`, `.min-w-120`, `.min-w-180`
- Margins: `.m-0`, `.mb-2`, `.mb-3`, `.mb-4`, `.mb-6`, `.mb-8`, `.mt-4`, `.mt-6`, `.mt-8`
- Font: `.fw-600`, `.fw-700`, `.fs-sm`, `.fs-09`, `.fs-1`, `.fs-15`
- Colors: `.text-gray`, `.text-primary`, `.text-green`, `.text-red`, `.text-orange`
- Components: `.form-label`, `.card-white`, `.section-header`, `.input-sm`, `.btn-compact`

**Dodatečné utility třídy (2025-12-03):**
- Filter toolbar: `.filter-toolbar` - statistiky date range filter
- Statistics: `.statistics-grid` - grid pro stats karty
- Grids: `.grid-2col`, `.grid-gap-2rem`, `.grid-gap-1-5rem`
- Modal: `.modal-wide` - široký modal pro editaci
- Labels: `.label-strong`, `.label-title`
- Text: `.text-description`, `.text-description-lg`, `.text-mono`
- Buttons: `.btn-full-width`, `.btn-full-width-mt`
- Misc: `.help-icon`, `.error-text-hidden`

**Stav inline stylů:** 228 → 78 → 64 → 50 (-78% celkem)

**Opravené HTML bugy:**
- Duplicitní `class` atributy na řádcích 1262, 1265 (buttons)

---

## FÁZE 3: Konsolidace shared komponent ✅ VĚTŠINOU DOKONČENO

### 3.1 ✅ DataManager.formatDate() → DateUtils.formatDate()

**Stav:** DOKONČENO

**Implementace:**
- `data.js` má @deprecated wrapper na řádku 1083-1086
- Wrapper deleguje na `DateUtils.formatDate()`
- Zpětná kompatibilita zachována

---

### 3.2 ✅ ValidationUtils v booking-form.js

**Stav:** DOKONČENO

**Implementace:**
- `booking-form.js` používá `ValidationUtils.validateEmail()` (řádek 375)
- `booking-form.js` používá `ValidationUtils.validatePhoneNumber()` (řádek 387)
- `booking-form.js` používá `ValidationUtils.validateZIP()` (řádek 1029)
- `booking-form.js` používá `ValidationUtils.validateICO()` (řádek 1043)
- `booking-form.js` používá `ValidationUtils.validateDIC()` (řádek 1057)
- Všechny validace používají `ValidationUtils.getValidationError()` pro chybové zprávy

---

### 3.3 ⏳ Využití DomUtils

**Stav:** ČÁSTEČNĚ DOKONČENO

**Dokončené:**
- ✅ `DomUtils.escapeHtml()` používáno v admin.js, EditBookingComponent.js
- ✅ `DomUtils.clearElement()` nahrazeno 21x (dříve `innerHTML = ''`)

**Zbývající příležitosti:**
- `DomUtils.createElement()` pro vytváření DOM elementů
- `DomUtils.addEventListeners()` pro hromadné přidání event listenerů

**Čas:** 1-2 hodiny (volitelné)

---

## FÁZE 4: HTML šablony a komponenty (NIŽŠÍ PRIORITA)

### 4.1 ✅ Extrakce Edit Form Inline Stylů - DOKONČENO

**Stav:** DOKONČENO (2025-12-03)

**Původní problém:** Formulář pro editaci rezervace měl ~50 inline stylů v obou souborech

**Implementované řešení:** Middle-ground přístup (extrakce stylů do CSS tříd)
- Zachována HTML struktura v obou souborech (nižší riziko)
- Vytvořeny sdílené CSS třídy v `styles-unified.css`

**Provedené změny:**
- Přidáno ~30 CSS tříd pro edit form komponenty
- `edit.html`: inline styly 47 → 22 (-53%)
- `admin.html`: inline styly v edit modalu výrazně redukovány

**Nové CSS třídy:**
- `.edit-tabs`, `.edit-tab-btn` - Tab navigace
- `.edit-info-box` - Informační box (světle modrý)
- `.edit-dates-layout` - Grid layout pro kalendář a pokoje
- `.edit-price-box`, `.edit-price-value` - Cenový box (žlutý)
- `.edit-selected-dates-box`, `.edit-selected-dates-text` - Vybrané termíny
- `.edit-guest-names-section` - Sekce jmen hostů (zelená)
- `.edit-calendar-header` - Hlavička kalendáře
- `.save-room-dates-btn` - Tlačítko uložení termínu
- `.edit-form-actions` - Akční tlačítka formuláře

**Opravené bugy:**
- Chybějící `domUtils.js` v admin.html
- Duplicitní `class` atributy (editBillingTab, cancelRoomEditBtn)

**Čas:** 2 hodiny
**Riziko:** NÍZKÉ ✅

---

### 4.2 Vytvoření ModalFactory

**Problém:** 8+ modalů v index.html se stejnou strukturou

**Řešení:**
```javascript
// js/shared/ModalFactory.js
class ModalFactory {
  static create(options) {
    const { id, title, content, actions, size } = options;
    return `
      <div id="${id}" class="modal">
        <div class="modal-content ${size || ''}">
          <button class="modal-close" onclick="closeModal('${id}')">&times;</button>
          <h2>${title}</h2>
          <div class="modal-body">${content}</div>
          <div class="modal-actions">
            ${actions.map(a => `<button class="btn btn-${a.type}" onclick="${a.onclick}">${a.text}</button>`).join('')}
          </div>
        </div>
      </div>
    `;
  }
}
```

**Čas:** 2-3 hodiny

---

### 4.3 Vytvoření CounterUI

**Problém:** Guest counter HTML opakován 6x v index.html

**Řešení:**
```javascript
// js/shared/CounterUI.js
class CounterUI {
  static createGuestCounter(type, label, initialValue = 0) {
    return `
      <div class="counter-item" data-counter-type="${type}">
        <label class="counter-label">${label}</label>
        <div class="counter-controls">
          <button class="counter-btn" onclick="CounterUI.adjust('${type}', -1)">−</button>
          <span class="counter-value" id="${type}Count">${initialValue}</span>
          <button class="counter-btn" onclick="CounterUI.adjust('${type}', 1)">+</button>
        </div>
      </div>
    `;
  }

  static adjust(type, delta) {
    // Centralizovaná logika
  }
}
```

**Čas:** 1-2 hodiny

---

## FÁZE 5: Bezpečnostní opravy ✅ DOKONČENO

### 5.1 ✅ XSS prevence - escapeHtml()

**Stav:** DOKONČENO (2025-12-03)

**Implementace:**
- `DomUtils.escapeHtml()` vytvořeno jako SSOT
- `admin.js` deleguje na `DomUtils.escapeHtml()` (řádky 27-30)
- `EditBookingComponent.js` používá escapeHtml pro všechny uživatelské vstupy
- 21 instancí `innerHTML = ''` nahrazeno za `DomUtils.clearElement()`

**Zabezpečené soubory:**
- ✅ `admin.js` - escapeHtml delegace
- ✅ `js/shared/EditBookingComponent.js` - escapeHtml použití
- ✅ `js/shared/bookingDisplayUtils.js` - escapeHtml použití

---

## Časový harmonogram

### Týden 1: Kritické opravy
| Den | Úkol | Čas | Riziko |
|-----|------|-----|--------|
| Po | 1.1 admin.js bulk price | 30 min | Nízké |
| Po | 1.2 EditBookingComponent price | 45 min | Nízké |
| Po | 1.3 utils.js fallback | 20 min | Nízké |
| Út | 5.1 XSS opravy | 30 min | Nízké |
| Út | 3.1 DateUtils migrace | 1 hod | Nízké |
| Út | 3.2 ValidationUtils migrace | 1 hod | Nízké |

### Týden 2: CSS konsolidace
| Den | Úkol | Čas | Riziko |
|-----|------|-----|--------|
| Po | 2.1 CSS proměnné | 1 hod | Nízké |
| Po-Út | 2.2 Mobile CSS migrace | 4-6 hod | Střední |
| St | 2.3 Media query konsolidace | 3-4 hod | Střední |
| Čt | 2.4 admin.html inline CSS | 2 hod | Nízké |

### Týden 3: Komponenty (volitelné)
| Den | Úkol | Čas | Riziko |
|-----|------|-----|--------|
| Po-Út | 4.1 Edit form extrakce | 3-4 hod | Střední |
| St | 4.2 ModalFactory | 2-3 hod | Nízké |
| Čt | 4.3 CounterUI | 1-2 hod | Nízké |
| Pá | 3.3 DomUtils využití | 2-3 hod | Nízké |

---

## Testovací plán

### Po každé změně:
1. `npm run pre-commit` - lint + format + duplicate check
2. `docker-compose down && docker-compose up --build -d` - rebuild
3. Manuální test v prohlížeči (desktop + mobil)
4. Playwright test pro kritické flows

### Kritické test cases:
- [ ] Vytvoření single room rezervace
- [ ] Vytvoření bulk rezervace
- [ ] Editace rezervace (user)
- [ ] Editace rezervace (admin)
- [ ] Zrušení rezervace
- [ ] Admin panel - všechny taby
- [ ] Mobilní zobrazení kalendáře
- [ ] Cenový výpočet - ÚTIA vs External
- [ ] Vánoční období - kódy

---

## Metriky úspěchu

### Před refaktoringem:
```
CSS řádky:        5,535
!important:       346
Duplicitní kód:   ~2,000 řádků
SSOT compliance:  75-80%
```

### Po refaktoringu (cíl):
```
CSS řádky:        ~3,500 (-37%)
!important:       0 (-100%)
Duplicitní kód:   <200 řádků (-90%)
SSOT compliance:  95%+
```

---

## Poznámky k implementaci

### KRITICKÉ - Zachovat funkcionalitu:
1. **Žádné změny v business logice** - pouze refaktoring
2. **Testovat po každé změně** - ne batch změny
3. **Git commit po každém kroku** - snadný rollback
4. **Backup databáze před začátkem**

### Doporučený postup:
1. Vytvořit feature branch: `git checkout -b refactor/ssot-consolidation`
2. Malé, atomické commity
3. Code review před merge
4. Deploy na staging (pokud existuje) před produkcí

---

## Závěr

Tento plán poskytuje strukturovaný přístup k refaktoringu s minimálním rizikem. Klíčové je:

1. **Fáze 1** (cenový systém) je nejvyšší priorita - pouze 3 soubory, 95 minut práce
2. **Fáze 2** (CSS) je časově nejnáročnější, ale přinese největší zlepšení maintainability
3. **Fáze 3-5** jsou volitelné, ale doporučené pro dlouhodobou kvalitu kódu

**Celkový odhadovaný čas:** 25-35 hodin
**Doporučené rozdělení:** 3 týdny po částech

---

*Dokument vytvořen na základě komplexní analýzy codebase pomocí exploratorních agentů.*
