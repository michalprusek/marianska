# E2E Tests - Chata Mariánská

Komplexní end-to-end testy pokrývající celou aplikaci pomocí Playwright.

## 📋 Test Coverage

### 1. Booking Flow (`booking-flow.spec.js`)

- ✅ Načtení hlavní stránky s kalendářem
- ✅ Zobrazení dostupnosti pokojů
- ✅ Klikání na obsazené pokoje a zobrazení detailů
- ✅ Navigace mezi taby (Kalendář, Jeden pokoj, Celá chata)
- ✅ Zobrazení minulých dat jako neklikatelných
- ✅ Perzistence dat po reloadu stránky
- ✅ Navigace mezi měsíci a roky
- ✅ Responzivní design (mobile, tablet)

### 2. Room Booking (`room-booking.spec.js`)

- ✅ Single room booking flow
- ✅ Výběr pokoje a výběr dat v kalendáři
- ✅ Validace minulých dat
- ✅ Prevence rezervace obsazených termínů
- ✅ Výpočet ceny pro ÚTIA hosty
- ✅ Kompletní booking flow s osobními údaji
- ✅ Bulk booking (celá chata)
- ✅ Prevence bulk bookingu při obsazenosti
- ✅ Výpočet bulk booking ceny
- ✅ Enforcing contiguous dates
- ✅ Validace emailu a telefonu

### 3. Admin Panel (`admin-panel.spec.js`)

- ✅ Autentizace admina
- ✅ Login s heslem
- ✅ Reject nesprávného hesla
- ✅ Perzistence session (7 dní)
- ✅ Logout funkce
- ✅ Zobrazení všech rezervací
- ✅ Detail rezervace
- ✅ Editace rezervace
- ✅ Smazání rezervace
- ✅ Filtrování rezervací podle data
- ✅ Blokování termínů
- ✅ Správa blokovaných dat
- ✅ Nastavení pokojů a cen
- ✅ Statistiky

### 4. Christmas Logic (`christmas-logic.spec.js`)

- ✅ Vyžadování přístupového kódu před 1. říjnem (single + bulk)
- ✅ Akceptace validního kódu
- ✅ Reject nevalidního kódu
- ✅ Po 1. říjnu: Bez kódu pro single room
- ✅ Po 1. říjnu: Blokování bulk bookingu
- ✅ Chybové hlášky pro blokovaný bulk booking
- ✅ Vizuální indikátory vánočního období
- ✅ Admin konfigurace vánočního období
- ✅ Správa přístupových kódů

### 5. Edge Cases (`edge-cases.spec.js`)

- ✅ Prevence double bookingu
- ✅ Povolení různých termínů stejného pokoje
- ✅ Edge-to-edge bookings (checkout/checkin)
- ✅ Prevence rezervace blokovaných termínů
- ✅ Validace emailu, telefonu
- ✅ Validace date range
- ✅ Kontrola required fields
- ✅ Výpočet ceny (ÚTIA, external)
- ✅ Zdarma batolata
- ✅ Multi-room booking
- ✅ Jedinečnost edit tokenů
- ✅ Správná délka edit tokenu (30 znaků)
- ✅ Concurrent bookings
- ✅ Performance s mnoha rezervacemi
- ✅ Browser kompatibilita

## 🚀 Running Tests

### Všechny testy (headless mode)

```bash
npm run test:e2e
```

### S viditelným browserem

```bash
npm run test:e2e:headed
```

### Debug mode (krok po kroku)

```bash
npm run test:e2e:debug
```

### UI mode (interaktivní)

```bash
npm run test:e2e:ui
```

### Konkrétní browser

```bash
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

### Zobrazit report

```bash
npm run test:e2e:report
```

### Spustit všechny testy (unit + integration + E2E)

```bash
npm run test:full
```

## 📊 Test Structure

```
tests/e2e/
├── helpers/
│   └── test-helpers.js          # Reusable helper functions
├── booking-flow.spec.js         # Main booking flow tests
├── room-booking.spec.js         # Single/bulk room booking tests
├── admin-panel.spec.js          # Admin functionality tests
├── christmas-logic.spec.js      # Christmas period logic tests
├── edge-cases.spec.js           # Edge cases and integration tests
└── README.md                    # This file
```

## 🔧 Configuration

Playwright configuration: `playwright.config.js`

- **Workers**: 1 (sequential execution to avoid SQLite conflicts)
- **Base URL**: http://localhost:3000
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Retries**: 2 (in CI), 0 (locally)
- **Web Server**: Auto-start (`npm start`)

## 📝 Writing New Tests

### Import helpers

```javascript
const { test, expect } = require('@playwright/test');
const { navigateToMainPage, resetDatabase, createTestBooking } = require('./helpers/test-helpers');
```

### Test template

```javascript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
  });

  test('should do something', async ({ page }) => {
    await navigateToMainPage(page);

    // Your test code
    await expect(page.locator('#element')).toBeVisible();
  });
});
```

## 🎯 Test Best Practices

1. **Reset database** před každým testem (`resetDatabase(page)`)
2. **Use helpers** pro common tasks (login, navigation, booking creation)
3. **Wait for elements** místo fixed timeouts
4. **Check visibility** před interakcí s elementy
5. **Handle async** operations correctly
6. **Avoid flaky tests** - use proper waits and selectors
7. **Test real user flows** - end-to-end scenarios
8. **Clean up** after tests (database reset)

## 🐛 Debugging Failed Tests

### 1. Run in headed mode

```bash
npm run test:e2e:headed
```

### 2. Use debug mode

```bash
npm run test:e2e:debug
```

### 3. Check screenshots

Failed tests automatically create screenshots in `test-results/`

### 4. Check videos

Videos are recorded for failed tests in `test-results/`

### 5. View HTML report

```bash
npm run test:e2e:report
```

## 📈 Coverage

E2E tests pokrývají:

- ✅ **User flows**: Kompletní rezervační proces
- ✅ **Admin flows**: Správa rezervací, nastavení
- ✅ **Business logic**: Vánoční pravidla, konflikty, ceny
- ✅ **Validace**: Formuláře, data, bezpečnost
- ✅ **Edge cases**: Konflikty, performance, kompatibilita
- ✅ **UI/UX**: Responsivita, navigace, interakce

## 🔄 CI/CD Integration

Testy jsou připravené pro CI/CD:

- Auto-start server před testy
- Retry policy pro flaky tests
- Automatic screenshots/videos on failure
- HTML report generation

## 📖 Documentation

- [Playwright Docs](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
