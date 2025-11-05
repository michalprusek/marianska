# UAT (User Acceptance Testing) Document
# Mariánská Chata - Nový Cenový Model

**Datum vytvoření:** 2025-11-04
**Projekt:** Změna cenového modelu - prázdné pokoje + per-room guest types
**Status:** PŘIPRAVENO PRO UAT
**Verze:** 1.0

---

## 1. Shrnutí Projektu

### 1.1 Cíl Změny

Implementace nového cenového modelu, kde:
- **Základní cena** = cena za **prázdný pokoj** (bez hostů)
- **Příplatky** = VŠICHNI dospělí a děti platí příplatky (žádná "první osoba zdarma")
- **Per-room guest types** = každý pokoj v multi-room rezervaci může mít jiný typ hosta (ÚTIA/Externí)
- **Zamčení cen** = existující rezervace (39 celkem) mají zamčené ceny a nepřepočítávají se

### 1.2 Důvod Změny

**Původní požadavek od uživatele:**
> "Admin by měl nastavovat základní cenu za PRÁZDNÉ pokoje (bez jakýchkoli hostů).
> Všichni dospělí a děti by měli platit příplatky. Cena ÚTIA by se měla aplikovat,
> pokud je na daném pokoji alespoň jeden zaměstnanec ÚTIA (per-room určení)."

**Benefit:**
- Větší flexibilita v nastavení cen
- Transparentnější cenový model
- Možnost individuálního pricingu pro každý pokoj v multi-room rezervaci

### 1.3 Rozsah Změn

**Implementované komponenty:**
1. ✅ Databázová migrace (sloupec `price_locked`)
2. ✅ Nová cenová formule v PriceCalculator.js
3. ✅ Admin UI aktualizace (štítky "Prázdný pokoj")
4. ✅ Frontend per-room guest type dropdown
5. ✅ Server-side validace (zamčené rezervace)
6. ✅ Kompletní dokumentace
7. ✅ Automatizované testy (11 testů)
8. ✅ Manuální testovací guide

---

## 2. Testovací Kritéria

### 2.1 Kritické Požadavky (MUSÍ PROJÍT)

| ID | Požadavek | Kritičnost | Status |
|----|-----------|------------|--------|
| CR-1 | Existující rezervace mají zamčené ceny | 🔴 KRITICKÉ | ✅ Hotovo (39/39) |
| CR-2 | Nová cenová formule počítá správně | 🔴 KRITICKÉ | ✅ Hotovo (6/6 testů) |
| CR-3 | Admin panel ukazuje štítky "Prázdný pokoj" | 🔴 KRITICKÉ | ✅ Hotovo (4 štítky) |
| CR-4 | Per-room guest type dropdown funguje | 🔴 KRITICKÉ | ✅ Hotovo |
| CR-5 | Editace zamčených rezervací NEpřepočítává cenu | 🔴 KRITICKÉ | ⏳ K ověření |

### 2.2 Důležité Požadavky (MĚLY BY PROJÍT)

| ID | Požadavek | Kritičnost | Status |
|----|-----------|------------|--------|
| IR-1 | ÚTIA pricing počítá správně pro všechny kombinace | 🟡 VYSOKÁ | ⏳ K ověření |
| IR-2 | Externí pricing počítá správně pro všechny kombinace | 🟡 VYSOKÁ | ⏳ K ověření |
| IR-3 | Velké pokoje mají odlišné ceny od malých | 🟡 VYSOKÁ | ⏳ K ověření |
| IR-4 | Multi-room s různými typy hostů funguje | 🟡 VYSOKÁ | ⏳ K ověření |

### 2.3 Nice-to-Have (DOPORUČENO)

| ID | Požadavek | Kritičnost | Status |
|----|-----------|------------|--------|
| NH-1 | Edge case: pouze batolata (bez dospělých) | 🟢 STŘEDNÍ | ⏳ K ověření |
| NH-2 | Backward compatibility s starým formátem | 🟢 STŘEDNÍ | ✅ Hotovo |
| NH-3 | Server logy ukazují zamčení cen | 🟢 STŘEDNÍ | ✅ Hotovo |

---

## 3. UAT Test Scénáře

### 3.1 TEST SCENARIO 1: Admin Panel - Nastavení Cen

**Cíl:** Ověřit, že admin může nastavit ceny pro prázdné pokoje

**Prerekvizity:**
- Přístup do admin panelu
- Admin heslo

**Kroky:**
1. Otevřít http://chata.utia.cas.cz/admin.html
2. Přihlásit se admin heslem
3. Přejít na tab "Nastavení systému"
4. Scrollnout k sekci "Ceny pro jednotlivé rezervace"
5. Ověřit štítky u všech 4 typů pokojů (ÚTIA malý/velký, Externí malý/velký)
6. Zadat testovací ceny:
   - ÚTIA malý (prázdný): 250 Kč
   - ÚTIA malý (dospělý): 50 Kč
   - ÚTIA malý (dítě): 25 Kč
   - ÚTIA velký (prázdný): 350 Kč
   - ÚTIA velký (dospělý): 70 Kč
   - ÚTIA velký (dítě): 35 Kč
   - Externí malý (prázdný): 400 Kč
   - Externí malý (dospělý): 100 Kč
   - Externí malý (dítě): 50 Kč
   - Externí velký (prázdný): 500 Kč
   - Externí velký (dospělý): 120 Kč
   - Externí velký (dítě): 60 Kč
7. Kliknout "Uložit nastavení"
8. Počkat na notifikaci
9. Obnovit stránku (F5)
10. Ověřit, že všechny ceny jsou stále správně

**Očekávaný výsledek:**
- ✅ Všechny štítky ukazují "Prázdný pokoj:" (ne staré "Při obsazení 1 dospělou osobou:")
- ✅ Notifikace: "Nastavení bylo úspěšně uloženo"
- ✅ Po obnovení jsou všechny ceny zachovány

**Kritičnost:** 🔴 KRITICKÉ
**Status:** ⏳ K PROVEDENÍ

---

### 3.2 TEST SCENARIO 2: Nová Rezervace - ÚTIA Pricing

**Cíl:** Ověřit správný výpočet ceny pro ÚTIA zaměstnance

**Prerekvizity:**
- Ceny nastaveny podle Test Scenario 1

**Testovací data:**
- Pokoj: P12 (malý pokoj, 3 lůžka)
- Termín: 2025-12-10 až 2025-12-12 (2 noci)
- Typ hosta: Zaměstnanec ÚTIA
- Hosté: 2 dospělí, 1 dítě, 0 batolat

**Očekávaný výpočet:**
```
Prázdný pokoj: 250 Kč × 2 noci = 500 Kč
Dospělí: 2 × 50 Kč × 2 noci = 200 Kč
Děti: 1 × 25 Kč × 2 noci = 50 Kč
─────────────────────────────────────
CELKEM: 750 Kč
```

**Kroky:**
1. Otevřít http://chata.utia.cas.cz
2. Kliknout na pokoj P12 v kalendáři
3. Vybrat termín: 2025-12-10 až 2025-12-12
4. V dropdownu "Typ hostů pro tento pokoj:" vybrat "Zaměstnanec ÚTIA"
5. Nastavit hosty: 2 dospělí, 1 dítě
6. Zkontrolovat náhled ceny
7. Vyplnit kontaktní údaje
8. Odeslat rezervaci

**Očekávaný výsledek:**
- ✅ Náhled ceny ukazuje: 750 Kč
- ✅ Cena se okamžitě aktualizuje při změně typu hosta
- ✅ Cena se aktualizuje při změně počtu hostů
- ✅ Rezervace je úspěšně vytvořena
- ✅ Email s potvrzením obsahuje cenu 750 Kč

**Kritičnost:** 🔴 KRITICKÉ
**Status:** ⏳ K PROVEDENÍ

---

### 3.3 TEST SCENARIO 3: Nová Rezervace - Externí Pricing

**Cíl:** Ověřit správný výpočet ceny pro externího hosta

**Prerekvizity:**
- Ceny nastaveny podle Test Scenario 1

**Testovací data:**
- Pokoj: P12 (malý pokoj)
- Termín: 2025-12-10 až 2025-12-12 (2 noci)
- Typ hosta: Externí host
- Hosté: 2 dospělí, 1 dítě

**Očekávaný výpočet:**
```
Prázdný pokoj: 400 Kč × 2 noci = 800 Kč
Dospělí: 2 × 100 Kč × 2 noci = 400 Kč
Děti: 1 × 50 Kč × 2 noci = 100 Kč
─────────────────────────────────────
CELKEM: 1300 Kč
```

**Kroky:**
1. Použít stejný modal jako v Test Scenario 2
2. Změnit dropdown na "Externí host"
3. Ponechat stejný počet hostů (2 dospělí, 1 dítě)
4. Zkontrolovat náhled ceny

**Očekávaný výsledek:**
- ✅ Náhled ceny se aktualizuje na: 1300 Kč
- ✅ Rozdíl od ÚTIA: 550 Kč (1300 - 750)
- ✅ Cena se změní okamžitě při změně dropdownu

**Kritičnost:** 🔴 KRITICKÉ
**Status:** ⏳ K PROVEDENÍ

---

### 3.4 TEST SCENARIO 4: Velký Pokoj Pricing

**Cíl:** Ověřit, že velké pokoje mají odlišné ceny

**Prerekvizity:**
- Ceny nastaveny podle Test Scenario 1

**Testovací data:**
- Pokoj: P14 (velký pokoj, 4 lůžka)
- Termín: 2025-12-10 až 2025-12-12 (2 noci)
- Typ hosta: Zaměstnanec ÚTIA
- Hosté: 3 dospělí, 1 dítě

**Očekávaný výpočet:**
```
Prázdný pokoj: 350 Kč × 2 noci = 700 Kč
Dospělí: 3 × 70 Kč × 2 noci = 420 Kč
Děti: 1 × 35 Kč × 2 noci = 70 Kč
─────────────────────────────────────
CELKEM: 1190 Kč
```

**Kroky:**
1. Otevřít http://chata.utia.cas.cz
2. Kliknout na pokoj P14 (4 lůžka)
3. Vybrat termín: 2025-12-10 až 2025-12-12
4. Vybrat "Zaměstnanec ÚTIA"
5. Nastavit hosty: 3 dospělí, 1 dítě
6. Zkontrolovat náhled ceny

**Očekávaný výsledek:**
- ✅ Náhled ceny ukazuje: 1190 Kč
- ✅ Použito large room pricing (ne small room)
- ✅ Rozdíl vs malý pokoj ÚTIA (750 Kč): 440 Kč více

**Kritičnost:** 🟡 VYSOKÁ
**Status:** ⏳ K PROVEDENÍ

---

### 3.5 TEST SCENARIO 5: Editace Zamčené Rezervace (KRITICKÝ TEST)

**Cíl:** Ověřit, že existující rezervace nepřepočítávají cenu při editaci

**Prerekvizity:**
- Přístup do admin panelu
- Existující rezervace vytvořená před 2025-11-04

**Kroky:**
1. Otevřít admin panel: http://chata.utia.cas.cz/admin.html
2. Přihlásit se
3. Přejít na tab "Rezervace"
4. Najít jakoukoli rezervaci vytvořenou před 2025-11-04
5. **ZAZNAMENAT PŮVODNÍ CENU** (např. 1234 Kč)
6. Kliknout "Upravit"
7. Změnit termín (např. prodloužit o 1 den)
8. Kliknout "Uložit změny"
9. Ověřit cenu po uložení

**Očekávaný výsledek:**
- ✅ Zobrazí se notifikace úspěchu
- ✅ **Cena zůstává NEZMĚNĚNÁ** (stále původní cena, např. 1234 Kč)
- ✅ Termín byl úspěšně aktualizován
- ✅ Server logy ukazují: "Price recalculation skipped for locked booking"

**Ověření v logs:**
```bash
docker-compose logs web | grep "Price recalculation skipped"
```

**Kritičnost:** 🔴 KRITICKÉ
**Status:** ⏳ K PROVEDENÍ

**⚠️ VAROVÁNÍ:** Pokud tento test selže, existující zákazníci mohou dostat nesprávné ceny!

---

### 3.6 TEST SCENARIO 6: Multi-Room s Různými Typy Hostů

**Cíl:** Ověřit per-room guest type funkcionalitu

**Prerekvizity:**
- Ceny nastaveny podle Test Scenario 1

**Testovací data:**
- Pokoj P12: ÚTIA, 2 dospělí, 0 dětí
- Pokoj P13: Externí, 2 dospělí, 1 dítě
- Termín: 2025-12-10 až 2025-12-12 (2 noci)

**Očekávaný výpočet:**
```
Pokoj P12 (ÚTIA):
  Prázdný: 250 × 2 = 500 Kč
  Dospělí: 2 × 50 × 2 = 200 Kč
  Dílčí součet: 700 Kč

Pokoj P13 (Externí):
  Prázdný: 400 × 2 = 800 Kč
  Dospělí: 2 × 100 × 2 = 400 Kč
  Děti: 1 × 50 × 2 = 100 Kč
  Dílčí součet: 1300 Kč

─────────────────────────────────────
CELKEM: 2000 Kč
```

**Kroky:**
1. Otevřít http://chata.utia.cas.cz
2. Kliknout P12, vybrat termín, nastavit "Zaměstnanec ÚTIA", 2 dospělí
3. Kliknout "Přidat do rezervace"
4. Kliknout P13, stejný termín, nastavit "Externí host", 2 dospělí, 1 dítě
5. Kliknout "Přidat do rezervace"
6. Kliknout "Dokončit rezervaci"
7. Zkontrolovat celkovou cenu
8. Vyplnit kontaktní údaje a odeslat

**Očekávaný výsledek:**
- ✅ Celková cena: 2000 Kč
- ✅ Formulář ukazuje rozpad ceny po pokojích
- ✅ Každý pokoj má svůj typ hosta zachován
- ✅ Výpočty cen jsou správné pro každý pokoj
- ✅ Rezervace je úspěšně vytvořena

**Kritičnost:** 🟡 VYSOKÁ
**Status:** ⏳ K PROVEDENÍ

---

### 3.7 TEST SCENARIO 7: Edge Case - Pouze Batolata

**Cíl:** Ověřit, že rezervace bez dospělých funguje (pouze batolata)

**Prerekvizity:**
- Ceny nastaveny podle Test Scenario 1

**Testovací data:**
- Pokoj: P12 (malý pokoj)
- Termín: 2025-12-10 až 2025-12-12 (2 noci)
- Typ hosta: Zaměstnanec ÚTIA
- Hosté: 0 dospělých, 0 dětí, 2 batolata

**Očekávaný výpočet:**
```
Prázdný pokoj: 250 Kč × 2 noci = 500 Kč
Dospělí: 0 × 50 Kč × 2 noci = 0 Kč
Děti: 0 × 25 Kč × 2 noci = 0 Kč
Batolata: ZDARMA (vždy 0 Kč)
─────────────────────────────────────
CELKEM: 500 Kč
```

**Kroky:**
1. Otevřít rezervační modal pro P12
2. Nastavit: 0 dospělých, 0 dětí, 2 batolata
3. Zkontrolovat náhled ceny
4. Zkusit odeslat rezervaci

**Očekávaný výsledek:**
- ✅ Cena ukazuje: 500 Kč (pouze prázdný pokoj)
- ✅ Batolata nepřidávají k ceně
- ✅ Rezervace je povolena (alespoň 1 batole = platné)
- ✅ Systém akceptuje rezervaci

**Kritičnost:** 🟢 STŘEDNÍ
**Status:** ⏳ K PROVEDENÍ

---

## 4. Akceptační Kritéria

### 4.1 KRITICKÁ Kritéria (MUSÍ PROJÍT pro UAT approval)

- [ ] **CR-1:** Všech 39 existujících rezervací má zamčené ceny (`price_locked = 1`)
- [ ] **CR-2:** Nová cenová formule počítá správně (6/6 testů prošlo)
- [ ] **CR-3:** Admin panel ukazuje 4 štítky "Prázdný pokoj:"
- [ ] **CR-4:** Per-room guest type dropdown je viditelný a funkční
- [ ] **CR-5:** Editace zamčených rezervací NEpřepočítává cenu

### 4.2 VYSOKÁ Kritéria (MĚLA BY PROJÍT)

- [ ] **IR-1:** ÚTIA pricing počítá správně (Test Scenario 2)
- [ ] **IR-2:** Externí pricing počítá správně (Test Scenario 3)
- [ ] **IR-3:** Velké pokoje mají odlišné ceny (Test Scenario 4)
- [ ] **IR-4:** Multi-room s různými typy hostů funguje (Test Scenario 6)

### 4.3 STŘEDNÍ Kritéria (DOPORUČENO)

- [ ] **NH-1:** Edge case s pouze batolaty funguje (Test Scenario 7)

---

## 5. UAT Timeline

### 5.1 Fáze 1: Příprava (1 den)

**Termín:** 2025-11-04
**Odpovědný:** Development tým

**Úkoly:**
- [x] Automatizované testy (11/11 prošlo)
- [x] Manuální testovací checklist vytvořen
- [x] UAT dokument připraven
- [ ] Testovací prostředí ověřeno
- [ ] Stakeholdeři notifikováni

### 5.2 Fáze 2: UAT Provádění (2-3 dny)

**Termín:** 2025-11-05 až 2025-11-07
**Odpovědný:** Product Owner + klíčoví uživatelé

**Úkoly:**
- [ ] Test Scenario 1: Admin panel ceny ⏳
- [ ] Test Scenario 2: ÚTIA pricing ⏳
- [ ] Test Scenario 3: Externí pricing ⏳
- [ ] Test Scenario 4: Velký pokoj ⏳
- [ ] Test Scenario 5: Zamčené rezervace ⏳
- [ ] Test Scenario 6: Multi-room ⏳
- [ ] Test Scenario 7: Edge cases ⏳
- [ ] UAT report vytvořen ⏳

### 5.3 Fáze 3: Vyhodnocení (1 den)

**Termín:** 2025-11-08
**Odpovědný:** Project Manager + stakeholdeři

**Úkoly:**
- [ ] Review UAT výsledků
- [ ] Rozhodnutí: GO / NO-GO
- [ ] Případné opravy bugů
- [ ] Finální approval

### 5.4 Fáze 4: Produkční Deployment (pokud UAT prošlo)

**Termín:** 2025-11-09
**Odpovědný:** Development tým

**Úkoly:**
- [ ] Production deployment
- [ ] Post-deployment verifikace
- [ ] Monitoring (první 24h)
- [ ] Stakeholder komunikace

---

## 6. Rizika a Mitigation

### 6.1 KRITICKÁ Rizika

| Riziko | Pravděpodobnost | Dopad | Mitigation |
|--------|-----------------|-------|------------|
| Existující rezervace dostanou nesprávné ceny při editaci | NÍZKÁ | 🔴 KRITICKÝ | Důkladné testování CR-5, rollback plán připraven |
| Nový cenový výpočet produkuje nesprávné ceny | NÍZKÁ | 🔴 KRITICKÝ | 6 automatizovaných testů + manuální UAT |
| Admin nemůže uložit nové ceny | VELMI NÍZKÁ | 🔴 KRITICKÝ | Pre-deployment testing dokončeno |

### 6.2 VYSOKÁ Rizika

| Riziko | Pravděpodobnost | Dopad | Mitigation |
|--------|-----------------|-------|------------|
| Multi-room rezervace s různými typy hostů nefunguje | NÍZKÁ | 🟡 VYSOKÝ | Testovat scenario 6 důkladně |
| Dropdown se nezobrazuje na mobilních zařízeních | STŘEDNÍ | 🟡 VYSOKÝ | Responsive design testing |
| Performance degradace při načítání cen | NÍZKÁ | 🟡 VYSOKÝ | Load testing (pokud možné) |

### 6.3 STŘEDNÍ Rizika

| Riziko | Pravděpodobnost | Dopad | Mitigation |
|--------|-----------------|-------|------------|
| Uživatelé jsou zmatení novým UI | STŘEDNÍ | 🟢 STŘEDNÍ | Clear labeling ("Prázdný pokoj"), help text |
| Edge cases (pouze batolata) nefungují | NÍZKÁ | 🟢 STŘEDNÍ | Test scenario 7 |

---

## 7. Rollback Plán

### 7.1 Podmínky pro Rollback

Rollback provést pokud:
- ❌ Jakékoli KRITICKÉ kritérium (CR-1 až CR-5) selže
- ❌ 2+ VYSOKÁ kritéria (IR-1 až IR-4) selžou
- ❌ Produkce není stabilní po deploymentu
- ❌ Stakeholdeři neschválí UAT

### 7.2 Rollback Procedura

**Option A: Database Rollback (doporučeno pouze pro kritické selhání)**

```bash
# 1. Zastavit aplikaci
docker-compose down

# 2. Obnovit předchozí verzi databáze (backup před změnou)
cp data/backups/bookings-pre-migration.db data/bookings.db

# 3. Revert git k předchozí verzi
git checkout <previous-commit-hash>

# 4. Rebuild a restart
docker-compose up --build -d
```

**Option B: Hotfix (preferováno pro menší problémy)**

```bash
# 1. Identifikovat problém
# 2. Vytvořit hotfix branch
# 3. Opravit bug
# 4. Test
# 5. Deploy hotfix
```

**⚠️ DŮLEŽITÉ:**
- `price_locked` sloupec NENÍ nutné odstraňovat při rollbacku
- Existující rezervace si zachovají zamčené ceny (to je OK)
- Pouze frontend/backend logika se vrátí na starou verzi

---

## 8. UAT Sign-Off

### 8.1 Approval Checklist

Pro schválení UAT musí být splněno:

- [ ] Všechna KRITICKÁ kritéria (CR-1 až CR-5) prošla
- [ ] Alespoň 3 z 4 VYSOKÝCH kritérií (IR-1 až IR-4) prošla
- [ ] Žádné blocker bugy nebyly nalezeny
- [ ] Documentation je kompletní
- [ ] Stakeholdeři jsou spokojeni s implementací

### 8.2 Sign-Off Sekce

**UAT Provedeno:**
- Datum: _______________
- Provedl: _______________
- Výsledek: ☐ PASS ☐ FAIL

**Product Owner Approval:**
- Jméno: _______________
- Podpis: _______________
- Datum: _______________
- Status: ☐ APPROVED ☐ REJECTED ☐ APPROVED WITH CONDITIONS

**Podmínky (pokud applicable):**
```
_________________________________________________
_________________________________________________
_________________________________________________
```

**Technical Lead Approval:**
- Jméno: _______________
- Podpis: _______________
- Datum: _______________
- Status: ☐ APPROVED ☐ REJECTED

**Deployment Authorization:**
- Jméno: _______________
- Podpis: _______________
- Datum: _______________
- Go-Live Date: _______________

---

## 9. Post-UAT Monitoring

### 9.1 První 24 Hodin Po Deploymentu

**Sledovat:**
- [ ] Server error logs (každou hodinu)
- [ ] Nové rezervace vytvořeny úspěšně
- [ ] Ceny počítány správně
- [ ] Editace starých rezervací nezpůsobují přepočet
- [ ] Admin panel funguje bez chyb
- [ ] Response times < 2s

### 9.2 První Týden

**Sledovat:**
- [ ] User feedback (kontaktní formulář, emaily)
- [ ] Error rate < 0.1%
- [ ] Žádné stížnosti na nesprávné ceny
- [ ] Database integrity (žádná korupce dat)

### 9.3 Reporting

**Denní report (první týden):**
```
Datum: _______________
Nové rezervace: _______________
Errors: _______________
User complaints: _______________
Status: ☐ OK ☐ NEEDS ATTENTION ☐ CRITICAL ISSUE
```

---

## 10. Kontakty

**Technical Issues:**
- Development Team: _______________ (email)
- On-call: _______________ (telefon)

**Business Questions:**
- Product Owner: _______________
- Project Manager: _______________

**Emergency Escalation:**
- Technical Lead: _______________
- Management: _______________

---

## 11. Přílohy

### 11.1 Dokumentace

- `NEW_PRICING_MODEL_IMPLEMENTATION.md` - Technická implementace
- `PRICING_MODEL_TEST_PLAN.md` - Kompletní testovací plán (50+ scénářů)
- `PRICING_MODEL_COMPLETION_SUMMARY.md` - Souhrn implementace
- `manual-testing-guide.js` - Browser console testovací script
- `run-all-tests.sh` - Automatizovaný testovací suite

### 11.2 Test Results

- Automated Tests: 11/11 PASS ✅
- Price Lock Migration: 39/39 bookings locked ✅
- Pricing Formula Tests: 6/6 PASS ✅

---

**Dokument připravil:** AI Assistant
**Datum vytvoření:** 2025-11-04
**Verze:** 1.0
**Status:** PŘIPRAVENO PRO UAT

---

## Poznámky

*Tento dokument slouží jako oficiální UAT guide pro acceptance testing nového cenového modelu. Všechna kritická kritéria (CR-1 až CR-5) MUSÍ projít před production deploymentem. Pro otázky kontaktujte technical team.*
