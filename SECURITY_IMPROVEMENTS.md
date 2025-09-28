# 🔒 Bezpečnostní vylepšení aplikace

## ✅ Implementované změny

### 1. **Bezpečnostní závislosti**
Přidány nové npm balíčky:
- `helmet` - Nastavení bezpečnostních HTTP hlaviček
- `express-rate-limit` - Ochrana proti DDoS útokům
- `dotenv` - Správa environment proměnných
- `bcrypt` - Hashování hesel

### 2. **Environment konfigurace (.env)**
Vytvořen soubor `.env` s těmito konfiguracemi:
- Administrátorské heslo (už není hardcoded!)
- API klíč pro kritické operace
- CORS povolené domény
- Rate limiting nastavení
- Vánoční konfigurace

### 3. **Server.js - Bezpečnostní vylepšení**

#### Přidáno:
- ✅ **Helmet middleware** - Bezpečnostní hlavičky (CSP, X-Frame-Options, atd.)
- ✅ **CORS omezení** - Povoleny pouze specifické domény
- ✅ **Rate limiting** - Max 100 req/15min obecně, 10 rezervací/hodinu
- ✅ **API Key autentizace** - Kritické endpointy vyžadují API klíč
- ✅ **Bcrypt hashování** - Admin heslo se ukládá jako hash
- ✅ **Health check endpoint** - `/health` pro monitoring
- ✅ **Secure token generování** - Použití crypto.randomBytes místo Math.random

#### Zabezpečené endpointy:
- `POST /api/data` - Vyžaduje API klíč
- `DELETE /api/booking/:id` - Vyžaduje API klíč
- `PUT /api/booking/:id` - Vyžaduje edit token NEBO API klíč
- `POST /api/admin/login` - Nový endpoint pro přihlášení
- `POST /api/admin/update-password` - Změna hesla s API klíčem

### 4. **Odstranění nepotřebné složitosti**
- 🗑️ Smazán `js/airbnb-calendar.js` (684 řádků)
- 🗑️ Smazán `js/airbnb-integration-example.js` (364 řádků)
- 🗑️ Smazán `css/airbnb-calendar.css`

### 5. **Admin.js vylepšení**
- Použití nového API pro autentizaci
- Změna hesla přes zabezpečený endpoint
- API klíč ukládán do sessionStorage pro admin operace

### 6. **Data.js vylepšení**
- Integrace s novým autentizačním API
- API klíč management pro admin operace
- Fallback pro zpětnou kompatibilitu

## 🔐 Jak používat nový systém

### První spuštění:
1. **Upravte `.env` soubor** s vlastními hodnotami:
   ```env
   ADMIN_PASSWORD=VašeSilnéHeslo123!
   API_KEY=vygenerujte-náhodný-dlouhý-klíč
   SESSION_SECRET=jiný-náhodný-klíč
   ```

2. **Spusťte server**:
   ```bash
   npm run dev  # Development
   npm start    # Production
   ```

3. **První přihlášení do admin panelu**:
   - Použijte heslo z `.env` souboru
   - Systém automaticky vytvoří bcrypt hash při prvním spuštění

### API použití:
```bash
# Veřejný endpoint - funguje bez autentizace
curl http://localhost:3000/api/data

# Chráněný endpoint - vyžaduje API klíč
curl -X DELETE http://localhost:3000/api/booking/ID \
  -H "x-api-key: váš-api-klíč"

# Admin login
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password": "admin-heslo"}'
```

## ⚠️ Důležité poznámky

### Co MUSÍTE udělat před nasazením do produkce:
1. **Změňte všechny výchozí hodnoty v `.env`**
2. **Použijte HTTPS** (ne HTTP)
3. **Nastavte `NODE_ENV=production`**
4. **Zkontrolujte CORS domény**
5. **Změňte výchozí API klíče a hesla**

### Bezpečnostní doporučení:
- Pravidelně aktualizujte závislosti: `npm audit fix`
- Zálohujte `data/bookings.json` pravidelně
- Monitorujte logy pro podezřelé aktivity
- Zvažte použití reverse proxy (nginx) v produkci

## 📊 Výsledky

### Vyřešené bezpečnostní problémy:
- ✅ Hardcoded admin heslo → Bcrypt hash + env proměnné
- ✅ Otevřené API endpointy → API key autentizace
- ✅ CORS pro všechny → Omezené domény
- ✅ Žádný rate limiting → Express-rate-limit
- ✅ Chybějící bezpečnostní hlavičky → Helmet
- ✅ Math.random tokeny → Crypto.randomBytes

### Odstraněná složitost:
- 📉 **1048 řádků kódu odstraněno** (Airbnb komponenty)
- 🎯 **Zjednodušená architektura** pro 5 concurrent users
- ⚡ **Rychlejší načítání** bez zbytečných komponent

## 🚀 Další kroky (volitelné)

Pro ještě větší bezpečnost můžete přidat:
1. **JWT tokeny** místo session storage
2. **2FA** pro admin přístup
3. **Audit log** všech admin akcí
4. **Backup strategie** s šifrováním
5. **WAF** (Web Application Firewall) v produkci

---

Aplikace je nyní **výrazně bezpečnější** a **optimalizovanější** pro váš use case s 5 souběžnými uživateli. JSON databáze je dostačující a výkonná pro tuto velikost.