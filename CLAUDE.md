# CLAUDE.md

sudo password: @.sudo-password

## Projekt

Rezervační systém pro horskou chatu (9 pokojů, 26 lůžek).

- **Stack**: Node.js/Express, SQLite, SPA frontend
- **Production**: `chata.utia.cas.cz` (Docker)
- **Port**: 3000

## Docker Commands

```bash
# Production - rebuild po změnách
docker-compose down && docker-compose up --build -d
docker-compose logs -f

# Development - hot reload (DOPORUČENO)
docker-compose -f docker-compose.dev.yml up --build -d
docker-compose -f docker-compose.dev.yml logs -f web
```

## Struktura

```
js/                    # Frontend
  shared/              # SSOT komponenty (KRITICKÉ!)
docs/                  # Dokumentace
tests/                 # Testy (e2e/, manual/)
migrations/            # SQL migrace
data/                  # SQLite databáze
```

## SSOT Principy

**NIKDY neimplementujte funkcionalitu dvakrát!** Použijte `js/shared/`:

- `BaseCalendar.js` - Kalendář (4 režimy)
- `ValidationUtils.js` - Validace vstupů
- `DateUtils.js` - Práce s daty
- `PriceCalculator.js` - Výpočet cen
- `ChristmasUtils.js` - Vánoční logika
- `EmailService.js` - Emaily
- `IdGenerator.js` - ID a tokeny
- `GuestNameUtils.js` - Jména hostů (generování inputů, sběr dat, toggle switches)
- `BookingContactForm.js` - Kontaktní formulář
- `EditBookingComponent.js` - Edit modal pro rezervace

## Kritické implementační detaily

### Inclusive Date Model

```javascript
// ✅ SPRÁVNĚ - startDate i endDate jsou OBSAZENÉ
while (current <= endDate) { ... }
WHERE ? >= start_date AND ? <= end_date

// ❌ ŠPATNĚ
while (current < endDate) { ... }
```

### Proposed Bookings

- 15min expirace, blokují dostupnost
- Prevence race conditions

## Testování

```bash
npm test                 # Unit testy
npm run test:e2e         # E2E (Playwright)
npm run pre-commit       # Před commitem!
```

## Best Practices

- VŽDY použij context7 před implementací pro aktuální dokumentaci
- Po změnách restartuj Docker a otestuj přes Playwright
- Business pravidla viz `docs/` a kód v `js/shared/`
- Detaily API viz `server.js`

CRITICAL: Neboj se dělat rozsáhlé a komplikováné změny a refactoringy
