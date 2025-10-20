# Dokumentace přístupového logování - spherosegapp.utia.cas.cz

## Přehled

Aplikace rezervačního systému Mariánská nyní obsahuje **komplexní systém přístupového logování** splňující standardy IT bezpečnosti pro auditní trail a analýzu přístupů.

## Technické specifikace

### Umístění logů

- **Adresář**: `/home/marianska/marianska/logs/`
- **Formát souborů**: `access-YYYY-MM-DD.log`
- **Příklad**: `access-2025-10-06.log`
- **Automatická rotace**: Denní (každý den nový soubor)

### Logovaná data

Každý HTTP požadavek je zaznamenán ve **strukturovaném JSON formátu** obsahující:

```json
{
  "timestamp": "2025-10-06T14:23:45.678Z",
  "client_ip": "192.168.1.100",
  "user_type": "admin",
  "user_id": "a1b2c3d4",
  "method": "POST",
  "url": "/api/booking",
  "protocol": "https",
  "http_version": "HTTP/1.1",
  "status_code": 200,
  "content_length": 1234,
  "referer": "https://spherosegapp.utia.cas.cz/",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  "response_time_ms": 45
}
```

### Klíčové logované údaje

| Pole               | Popis                           | Příklad                                |
| ------------------ | ------------------------------- | -------------------------------------- |
| `timestamp`        | Přesný čas požadavku (ISO 8601) | `2025-10-06T14:23:45.678Z`             |
| `client_ip`        | IP adresa klienta               | `192.168.1.100`                        |
| `user_type`        | Typ uživatele                   | `anonymous`, `admin`, `booking_editor` |
| `user_id`          | Identifikátor uživatele/session | První 8 znaků session tokenu           |
| `method`           | HTTP metoda                     | `GET`, `POST`, `PUT`, `DELETE`         |
| `url`              | Požadovaná URL                  | `/api/booking`                         |
| `protocol`         | Použitý protokol                | `http` nebo `https`                    |
| `http_version`     | Verze HTTP protokolu            | `HTTP/1.1`                             |
| `status_code`      | HTTP status kód odpovědi        | `200`, `404`, `500`                    |
| `content_length`   | Velikost odpovědi v bajtech     | `1234`                                 |
| `referer`          | HTTP Referer header             | URL odkud přišel požadavek             |
| `user_agent`       | Identifikace prohlížeče/klienta | Browser string                         |
| `response_time_ms` | Doba zpracování požadavku (ms)  | `45`                                   |

## Typy uživatelů

Systém rozlišuje 3 typy uživatelů:

1. **`anonymous`** - Běžní návštěvníci (bez autentizace)
2. **`admin`** - Administrátoři s přihlášenou session
3. **`booking_editor`** - Uživatelé editující své rezervace (mají edit token)

## Podporované scénáře

### 1. Detekce IP adres za reverse proxy

Systém správně detekuje IP adresu i když běží za nginx reverse proxy:

- Používá `X-Forwarded-For` header
- Fallback na `req.ip` nebo `req.connection.remoteAddress`
- Správná konfigurace s `app.set('trust proxy', true)`

### 2. Identifikace uživatelů

- **Administrátoři**: Identifikováni pomocí session tokenu (`x-session-token` header)
- **Editoři rezervací**: Identifikováni pomocí edit tokenu (`x-edit-token` header)
- **Anonymní uživatelé**: Bez speciální identifikace

### 3. Performance monitoring

- Každý log obsahuje `response_time_ms` pro analýzu výkonu
- Umožňuje identifikovat pomalé requesty
- Detekce problémů s databází nebo aplikační logikou

## Příklady logových záznamů

### Běžný anonymní přístup

```json
{
  "timestamp": "2025-10-06T10:15:30.123Z",
  "client_ip": "147.32.82.100",
  "user_type": "anonymous",
  "user_id": "-",
  "method": "GET",
  "url": "/",
  "protocol": "https",
  "http_version": "HTTP/1.1",
  "status_code": 200,
  "content_length": 5432,
  "referer": "-",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "response_time_ms": 12
}
```

### Admin přihlášení

```json
{
  "timestamp": "2025-10-06T11:30:45.456Z",
  "client_ip": "147.32.82.15",
  "user_type": "admin",
  "user_id": "f7e8d9c0",
  "method": "POST",
  "url": "/api/admin/login",
  "protocol": "https",
  "http_version": "HTTP/1.1",
  "status_code": 200,
  "content_length": 256,
  "referer": "https://spherosegapp.utia.cas.cz/admin.html",
  "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
  "response_time_ms": 234
}
```

### Vytvoření rezervace

```json
{
  "timestamp": "2025-10-06T14:45:12.789Z",
  "client_ip": "195.113.15.42",
  "user_type": "anonymous",
  "user_id": "-",
  "method": "POST",
  "url": "/api/booking",
  "protocol": "https",
  "http_version": "HTTP/1.1",
  "status_code": 200,
  "content_length": 567,
  "referer": "https://spherosegapp.utia.cas.cz/",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "response_time_ms": 89
}
```

### Editace rezervace

```json
{
  "timestamp": "2025-10-06T15:20:30.234Z",
  "client_ip": "88.103.45.78",
  "user_type": "booking_editor",
  "user_id": "a1b2c3d4",
  "method": "PUT",
  "url": "/api/booking/BK1234567890ABC",
  "protocol": "https",
  "http_version": "HTTP/1.1",
  "status_code": 200,
  "content_length": 432,
  "referer": "https://spherosegapp.utia.cas.cz/edit.html?token=...",
  "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
  "response_time_ms": 67
}
```

## Analýza logů

### Parsování JSON logů

```bash
# Přečíst dnešní logy
cat /home/marianska/marianska/logs/access-$(date +%Y-%m-%d).log

# Filtrovat pouze admin přístupy
grep '"user_type":"admin"' /home/marianska/marianska/logs/access-*.log

# Počet přístupů podle IP adresy
cat /home/marianska/marianska/logs/access-*.log | \
  jq -r '.client_ip' | sort | uniq -c | sort -rn

# Top 10 nejpomalejších requestů
cat /home/marianska/marianska/logs/access-*.log | \
  jq -r '[.response_time_ms, .url, .client_ip] | @tsv' | \
  sort -rn | head -10

# Všechny neúspěšné requesty (status 4xx, 5xx)
cat /home/marianska/marianska/logs/access-*.log | \
  jq 'select(.status_code >= 400)'

# Přístupy z konkrétní IP
cat /home/marianska/marianska/logs/access-*.log | \
  jq 'select(.client_ip == "147.32.82.100")'

# Statistiky za den
cat /home/marianska/marianska/logs/access-$(date +%Y-%m-%d).log | \
  jq -s '{
    total_requests: length,
    unique_ips: [.[].client_ip] | unique | length,
    admin_requests: [.[] | select(.user_type == "admin")] | length,
    avg_response_time: ([.[].response_time_ms] | add / length)
  }'
```

### Export do CSV (pro Excel analýzu)

```bash
# Konverze JSON -> CSV
cat /home/marianska/marianska/logs/access-*.log | \
  jq -r '[.timestamp, .client_ip, .user_type, .method, .url, .status_code, .response_time_ms] | @csv' \
  > access_log_export.csv
```

## Bezpečnostní aspekty

### Co SE loguje:

✅ IP adresy
✅ Typy uživatelů (anonymous/admin/editor)
✅ HTTP metody a URL
✅ Status kódy a response times
✅ User-Agent stringy
✅ Identifikátory session (první 8 znaků)

### Co SE NELOGUJE (ochrana soukromí):

❌ Kompletní session tokeny
❌ Hesla
❌ Osobní údaje z booking formulářů
❌ Email adresy
❌ Telefonní čísla
❌ Request body data

## Správa logů

### Doporučená retence

- **Minimum**: 30 dní
- **Doporučeno**: 90 dní
- **Compliance**: Podle interních IT požadavků ÚTIA

### Automatický cleanup (příklad cron job)

```bash
# Smazat logy starší než 90 dní (spustit denně ve 2:00)
0 2 * * * find /home/marianska/marianska/logs/access-*.log -mtime +90 -delete
```

### Backup logů

```bash
# Denní archivace do komprimované podoby
0 1 * * * gzip /home/marianska/marianska/logs/access-$(date -d '1 day ago' +\%Y-\%m-\%d).log
```

## Monitorování a alerting

### Podezřelá aktivita

```bash
# Příliš mnoho requestů z jedné IP (možný útok)
cat /home/marianska/marianska/logs/access-*.log | \
  jq -r '.client_ip' | sort | uniq -c | \
  awk '$1 > 1000 {print $2 " má " $1 " requestů"}'

# Neúspěšné admin login pokusy
cat /home/marianska/marianska/logs/access-*.log | \
  jq 'select(.url == "/api/admin/login" and .status_code == 401)'

# Monitoring response times > 1000ms
cat /home/marianska/marianska/logs/access-*.log | \
  jq 'select(.response_time_ms > 1000)'
```

## Integrace s SIEM systémy

Logy jsou ve strukturovaném JSON formátu kompatibilním s:

- **Elastic Stack (ELK)**: Filebeat → Logstash → Elasticsearch
- **Splunk**: Universal Forwarder
- **Graylog**: GELF input
- **Datadog**: Log collector

### Příklad Filebeat konfigurace

```yaml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /home/marianska/marianska/logs/access-*.log
    json.keys_under_root: true
    json.add_error_key: true
    fields:
      application: marianska_booking
      environment: production
```

## Technická implementace

### Komponenty

1. **`js/shared/accessLogger.js`** - Core logging modul
2. **`server.js`** - Express middleware integrace
3. **`logs/`** - Log storage adresář

### Kód integrace

```javascript
// Import access logger
const { createAccessLogger } = require('./js/shared/accessLogger');

// Initialize logger
const accessLogger = createAccessLogger(path.join(__dirname, 'logs'));

// Apply middleware
app.use(accessLogger.middleware());
```

## Podpora a kontakt

- **Aplikace**: Rezervační systém Chata Mariánská
- **URL**: https://spherosegapp.utia.cas.cz (předpokládám dle názvu domény v dotazu)
- **Umístění**: `/home/marianska/marianska/`
- **Logy**: `/home/marianska/marianska/logs/access-*.log`
- **Formát**: JSON, denní rotace

## Změny v kódu (pro IT sekci)

### Soubory modifikované:

1. ✅ `js/shared/accessLogger.js` - NOVÝ soubor (access logging logika)
2. ✅ `server.js` - Přidán import a middleware pro access logging

### Jak aktivovat:

```bash
# Restart aplikace (Docker)
cd /home/marianska/marianska
docker-compose down
docker-compose up --build -d

# Ověřit že logy fungují
tail -f /home/marianska/marianska/logs/access-$(date +%Y-%m-%d).log
```

---

**Datum implementace**: 2025-10-06
**Verze dokumentace**: 1.0
**Zpracováno pro**: IT sekce ÚTIA AV ČR
