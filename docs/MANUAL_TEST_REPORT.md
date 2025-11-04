# Manual Test Report
# Mariánská Chata - Nový Cenový Model

**Datum testování:** _______________
**Tester:** _______________
**Prostředí:** Production (http://chata.utia.cas.cz)
**Verze:** 1.0 (2025-11-04)

---

## Executive Summary

**Overall Status:** ☐ PASS ☐ PASS WITH ISSUES ☐ FAIL

**Test Statistics:**
- Total Tests: 10
- Passed: ___ / 10
- Failed: ___ / 10
- Skipped: ___ / 10

**Critical Issues Found:** _______________

**Recommendation:** ☐ APPROVE FOR PRODUCTION ☐ FIX ISSUES FIRST ☐ REJECT

---

## Test Results

### ✅ TEST 1: Admin Panel - Ověření Štítků

**Status:** ☐ PASS ☐ FAIL ☐ SKIP

**Testovací kroky provedeny:**
- [ ] Přihlášen do admin panelu
- [ ] Otevřen tab "Nastavení systému"
- [ ] Zkontrolovány štítky u všech 4 typů pokojů

**Výsledek:**
```
Prázdný pokoj štítky nalezeny: ___ / 4
Staré štítky ("Při obsazení 1 dospělou osobou:"): ___ / 0 (očekáváno 0)
```

**Aktuální výsledek:**
- ☐ ✅ Všechny štítky jsou "Prázdný pokoj:"
- ☐ ❌ Některé staré štítky stále přítomny
- ☐ ❌ Nové štítky chybí

**Poznámky:**
```
_________________________________________________
_________________________________________________
```

**Screenshots:**
- Přiložit: ☐ Ano ☐ Ne
- Cesta: _______________

---

### ✅ TEST 2: Admin Panel - Uložení a Načtení Cen

**Status:** ☐ PASS ☐ FAIL ☐ SKIP

**Zadané testovací ceny:**
```
ÚTIA:
  Malý (prázdný): 250 Kč
  Malý (dospělý): 50 Kč
  Malý (dítě): 25 Kč
  Velký (prázdný): 350 Kč
  Velký (dospělý): 70 Kč
  Velký (dítě): 35 Kč

Externí:
  Malý (prázdný): 400 Kč
  Malý (dospělý): 100 Kč
  Malý (dítě): 50 Kč
  Velký (prázdný): 500 Kč
  Velký (dospělý): 120 Kč
  Velký (dítě): 60 Kč
```

**Testovací kroky provedeny:**
- [ ] Zadány všechny ceny výše
- [ ] Kliknuto "Uložit nastavení"
- [ ] Zobrazena notifikace úspěchu
- [ ] Stránka obnovena (F5)
- [ ] Ověřeny všechny ceny po obnovení

**Výsledek:**
- ☐ ✅ Notifikace úspěchu zobrazena
- ☐ ✅ Všechny ceny zachovány po obnovení
- ☐ ❌ Některé ceny se neobnovily
- ☐ ❌ Notifikace chybí

**Poznámky:**
```
_________________________________________________
_________________________________________________
```

---

### ✅ TEST 3: Frontend - Per-Room Guest Type Dropdown

**Status:** ☐ PASS ☐ FAIL ☐ SKIP

**Testovací kroky provedeny:**
- [ ] Otevřen http://chata.utia.cas.cz
- [ ] Kliknuto na pokoj P12
- [ ] Vybrán termín 2025-12-10 až 2025-12-12
- [ ] Zkontrolován dropdown "Typ hostů pro tento pokoj:"

**Výsledek:**
- ☐ ✅ Dropdown viditelný
- ☐ ✅ Obsahuje "Zaměstnanec ÚTIA"
- ☐ ✅ Obsahuje "Externí host"
- ☐ ✅ Výchozí výběr je "Zaměstnanec ÚTIA"
- ☐ ✅ Nápověda zobrazena
- ☐ ❌ Dropdown chybí
- ☐ ❌ Možnosti chybí

**Poznámky:**
```
_________________________________________________
_________________________________________________
```

**Screenshots:**
- Přiložit: ☐ Ano ☐ Ne
- Cesta: _______________

---

### ✅ TEST 4: Výpočet Ceny - ÚTIA Zaměstnanec

**Status:** ☐ PASS ☐ FAIL ☐ SKIP

**Testovací data:**
- Pokoj: P12 (malý)
- Termín: 2025-12-10 až 2025-12-12 (2 noci)
- Typ: Zaměstnanec ÚTIA
- Hosté: 2 dospělí, 1 dítě

**Očekávaná cena:** 750 Kč
```
Výpočet:
Prázdný pokoj: 250 × 2 = 500 Kč
Dospělí: 2 × 50 × 2 = 200 Kč
Děti: 1 × 25 × 2 = 50 Kč
CELKEM: 750 Kč
```

**Aktuální zobrazená cena:** _______________ Kč

**Výsledek:**
- ☐ ✅ Cena odpovídá očekávání (750 Kč)
- ☐ ❌ Cena neodpovídá, rozdíl: ___ Kč
- ☐ ✅ Cena se aktualizuje při změně typu hosta
- ☐ ✅ Cena se aktualizuje při změně počtu hostů

**Poznámky:**
```
_________________________________________________
_________________________________________________
```

---

### ✅ TEST 5: Výpočet Ceny - Externí Host

**Status:** ☐ PASS ☐ FAIL ☐ SKIP

**Testovací data:**
- Pokoj: P12 (malý)
- Termín: 2025-12-10 až 2025-12-12 (2 noci)
- Typ: Externí host
- Hosté: 2 dospělí, 1 dítě

**Očekávaná cena:** 1300 Kč
```
Výpočet:
Prázdný pokoj: 400 × 2 = 800 Kč
Dospělí: 2 × 100 × 2 = 400 Kč
Děti: 1 × 50 × 2 = 100 Kč
CELKEM: 1300 Kč
```

**Aktuální zobrazená cena:** _______________ Kč

**Výsledek:**
- ☐ ✅ Cena odpovídá očekávání (1300 Kč)
- ☐ ❌ Cena neodpovídá, rozdíl: ___ Kč
- ☐ ✅ Rozdíl od ÚTIA: 550 Kč (správně)
- ☐ ✅ Cena se změní okamžitě při změně dropdownu

**Poznámky:**
```
_________________________________________________
_________________________________________________
```

---

### ✅ TEST 6: Velký Pokoj - Odlišné Ceny

**Status:** ☐ PASS ☐ FAIL ☐ SKIP

**Testovací data:**
- Pokoj: P14 (velký - 4 lůžka)
- Termín: 2025-12-10 až 2025-12-12 (2 noci)
- Typ: Zaměstnanec ÚTIA
- Hosté: 3 dospělí, 1 dítě

**Očekávaná cena:** 1190 Kč
```
Výpočet:
Prázdný pokoj: 350 × 2 = 700 Kč
Dospělí: 3 × 70 × 2 = 420 Kč
Děti: 1 × 35 × 2 = 70 Kč
CELKEM: 1190 Kč
```

**Aktuální zobrazená cena:** _______________ Kč

**Výsledek:**
- ☐ ✅ Cena odpovídá očekávání (1190 Kč)
- ☐ ❌ Cena neodpovídá, rozdíl: ___ Kč
- ☐ ✅ Použito large room pricing (ne small)
- ☐ ✅ Rozdíl vs malý pokoj: 440 Kč (správně)

**Poznámky:**
```
_________________________________________________
_________________________________________________
```

---

### 🔴 TEST 7: Editace Zamčené Rezervace (KRITICKÝ)

**Status:** ☐ PASS ☐ FAIL ☐ SKIP

**⚠️ DŮLEŽITÉ:** Tento test je KRITICKÝ pro production release!

**Testovací kroky provedeny:**
- [ ] Přihlášen do admin panelu
- [ ] Otevřen tab "Rezervace"
- [ ] Nalezena rezervace před 2025-11-04
- [ ] Zaznamenána původní cena
- [ ] Kliknuto "Upravit"
- [ ] Změněn termín (prodlouženo o 1 den)
- [ ] Kliknuto "Uložit změny"
- [ ] Ověřena cena po uložení

**Testovací rezervace:**
- Booking ID: _______________
- Původní cena: _______________ Kč
- Nová cena po editaci: _______________ Kč

**Výsledek:**
- ☐ ✅ Cena zůstala NEZMĚNĚNÁ (původní cena)
- ☐ ❌ Cena se přepočítala (KRITICKÝ BUG!)
- ☐ ✅ Termín byl aktualizován
- ☐ ✅ Server logs ukazují "Price recalculation skipped"

**Server logs ověření:**
```bash
docker-compose logs web | grep "Price recalculation skipped"
```

**Výstup:**
```
_________________________________________________
_________________________________________________
```

**⚠️ Pokud tento test SELHAL:**
```
KRITICKÝ BUG - NESCHVALOVAT PRO PRODUCTION!
Existující zákazníci mohou dostat nesprávné ceny!
```

**Poznámky:**
```
_________________________________________________
_________________________________________________
```

---

### ✅ TEST 8: Multi-Room s Různými Typy Hostů

**Status:** ☐ PASS ☐ FAIL ☐ SKIP

**Testovací data:**
- Pokoj P12: ÚTIA, 2 dospělí
- Pokoj P13: Externí, 2 dospělí, 1 dítě
- Termín: 2025-12-10 až 2025-12-12 (2 noci)

**Očekávaná cena:** 2000 Kč
```
Výpočet:
P12 (ÚTIA): 500 + 200 = 700 Kč
P13 (Externí): 800 + 400 + 100 = 1300 Kč
CELKEM: 2000 Kč
```

**Aktuální zobrazená cena:** _______________ Kč

**Testovací kroky provedeny:**
- [ ] P12 přidán do rezervace (ÚTIA, 2 dospělí)
- [ ] P13 přidán do rezervace (Externí, 2 dospělí, 1 dítě)
- [ ] Celková cena zkontrolována
- [ ] Formulář ukazuje rozpad po pokojích

**Výsledek:**
- ☐ ✅ Celková cena: 2000 Kč (správně)
- ☐ ❌ Celková cena neodpovídá, aktuální: ___ Kč
- ☐ ✅ Každý pokoj má svůj typ hosta zachován
- ☐ ✅ Rozpad ceny po pokojích je správný

**Poznámky:**
```
_________________________________________________
_________________________________________________
```

---

### ✅ TEST 9: Edge Case - Pouze Batolata

**Status:** ☐ PASS ☐ FAIL ☐ SKIP

**Testovací data:**
- Pokoj: P12 (malý)
- Termín: 2025-12-10 až 2025-12-12 (2 noci)
- Typ: Zaměstnanec ÚTIA
- Hosté: 0 dospělých, 0 dětí, 2 batolata

**Očekávaná cena:** 500 Kč
```
Výpočet:
Prázdný pokoj: 250 × 2 = 500 Kč
Dospělí: 0 × 50 × 2 = 0 Kč
Děti: 0 × 25 × 2 = 0 Kč
Batolata: ZDARMA
CELKEM: 500 Kč
```

**Aktuální zobrazená cena:** _______________ Kč

**Výsledek:**
- ☐ ✅ Cena: 500 Kč (pouze prázdný pokoj)
- ☐ ❌ Cena neodpovídá, aktuální: ___ Kč
- ☐ ✅ Batolata nepřidávají k ceně
- ☐ ✅ Rezervace je povolena (validace prošla)

**Poznámky:**
```
_________________________________________________
_________________________________________________
```

---

### ✅ TEST 10: Database State Verification

**Status:** ☐ PASS ☐ FAIL ☐ SKIP

**Testovací kroky provedeny:**
- [ ] Spuštěn price lock verification script
- [ ] Spuštěn pricing formula test script
- [ ] Zkontrolovány server logy
- [ ] Ověřena databáze (pokud možné)

**Příkazy spuštěny:**

```bash
# 1. Price lock verification
docker exec marianska-chata node /app/verify-price-lock-quick.js
```

**Výstup:**
```
Total bookings: ___
Locked: ___
Unlocked: ___
Status: ☐ SUCCESS ☐ FAIL
```

```bash
# 2. Pricing formula test
docker exec marianska-chata node /app/test-new-pricing-formula.js
```

**Výstup:**
```
Total tests: 6
Passed: ___
Failed: ___
Status: ☐ ALL PASS ☐ SOME FAIL
```

```bash
# 3. Server logs
docker-compose logs web | grep Migration
```

**Výstup:**
```
_________________________________________________
_________________________________________________
```

**Výsledek:**
- ☐ ✅ Všech 39 rezervací je zamčeno
- ☐ ❌ Některé rezervace nejsou zamčené: ___
- ☐ ✅ Všech 6 pricing testů prošlo
- ☐ ❌ Některé pricing testy selhaly: ___
- ☐ ✅ Server logy ukazují úspěšnou migraci

**Poznámky:**
```
_________________________________________________
_________________________________________________
```

---

## Shrnutí Problémů

### Kritické Problémy (Blocker)

**ID:** CRIT-001
**Popis:** _______________________________________________
**Test:** _______________
**Severity:** 🔴 CRITICAL
**Status:** ☐ Open ☐ Fixed ☐ Wontfix
**Poznámky:** _______________________________________________

**ID:** CRIT-002
**Popis:** _______________________________________________
**Test:** _______________
**Severity:** 🔴 CRITICAL
**Status:** ☐ Open ☐ Fixed ☐ Wontfix
**Poznámky:** _______________________________________________

### Vysoké Problémy (Major)

**ID:** MAJ-001
**Popis:** _______________________________________________
**Test:** _______________
**Severity:** 🟡 MAJOR
**Status:** ☐ Open ☐ Fixed ☐ Wontfix
**Poznámky:** _______________________________________________

### Střední Problémy (Minor)

**ID:** MIN-001
**Popis:** _______________________________________________
**Test:** _______________
**Severity:** 🟢 MINOR
**Status:** ☐ Open ☐ Fixed ☐ Wontfix
**Poznámky:** _______________________________________________

---

## Doporučení

### Overall Assessment

**Technická kvalita:** ☐ Vynikající ☐ Dobrá ☐ Uspokojivá ☐ Nedostatečná

**Functional readiness:** ☐ Plně funkční ☐ Menší problémy ☐ Větší problémy ☐ Nefunkční

**User experience:** ☐ Vynikající ☐ Dobrá ☐ Uspokojivá ☐ Špatná

### Production Readiness

**Finální doporučení:**

☐ **APPROVE - Připraveno pro production**
```
Všechny testy prošly, žádné blocker bugy.
Doporučuji immediate deployment.
```

☐ **APPROVE WITH CONDITIONS - Schválit s podmínkami**
```
Menší problémy nalezeny, ale ne blocker.
Podmínky pro approval:
_________________________________________________
_________________________________________________
```

☐ **REJECT - Neschválit**
```
Kritické problémy nalezeny, deployment by způsobil problémy.
Důvody:
_________________________________________________
_________________________________________________
```

### Next Steps

**Pokud APPROVED:**
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Pokud APPROVED WITH CONDITIONS:**
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Pokud REJECTED:**
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Podpisy

**Tester:**
- Jméno: _______________
- Podpis: _______________
- Datum: _______________

**Test Lead:**
- Jméno: _______________
- Podpis: _______________
- Datum: _______________

**Product Owner:**
- Jméno: _______________
- Podpis: _______________
- Datum: _______________

---

## Přílohy

**Screenshots:**
- Cesta k souborům: _______________
- Počet přiložených: ___

**Logy:**
- Server logs: ☐ Přiloženo ☐ Ne
- Error logs: ☐ Přiloženo ☐ Ne
- Database dump: ☐ Přiloženo ☐ Ne

**Další dokumenty:**
```
_________________________________________________
_________________________________________________
```

---

**Report vytvořen:** _______________
**Report upravil:** _______________
**Verze reportu:** 1.0
