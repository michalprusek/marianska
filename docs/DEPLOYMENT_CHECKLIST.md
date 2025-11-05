# Production Deployment Checklist
# Mariánská Chata - Nový Cenový Model

**Deployment Date:** _______________
**Deployment Time:** _______________ (doporučeno: nízká traffic hodina)
**Deployed By:** _______________
**Version:** 1.0 (2025-11-04)

---

## 🎯 Pre-Deployment Checklist

### UAT Approval ✅

- [ ] UAT dokument kompletně vyplněn
- [ ] Všechny KRITICKÉ testy prošly (CR-1 až CR-5)
- [ ] Alespoň 3 z 4 VYSOKÝCH testů prošly (IR-1 až IR-4)
- [ ] Product Owner schválil deployment
- [ ] Technical Lead schválil deployment
- [ ] Žádné blocker bugy nebyly nalezeny

**Sign-off:**
- Product Owner: ☐ Approved
- Technical Lead: ☐ Approved
- Date: _______________

---

### Dokumentace ✅

- [ ] UAT_DOCUMENT.md vytvořen a schválen
- [ ] MANUAL_TEST_REPORT.md vyplněn
- [ ] NEW_PRICING_MODEL_IMPLEMENTATION.md aktualizován
- [ ] PRICING_MODEL_TEST_PLAN.md k dispozici
- [ ] PRICING_MODEL_COMPLETION_SUMMARY.md vytvořen
- [ ] CLAUDE.md aktualizován s novým modelem
- [ ] TESTING_CHECKLIST.md (tento soubor) vytvořen

---

### Backup & Rollback Příprava 🔄

- [ ] **Database backup vytvořen**
  ```bash
  # Vytvořit backup PŘED deploymentem
  docker exec marianska-chata sqlite3 /app/data/bookings.db \
    ".backup /app/data/backups/bookings-pre-pricing-model-$(date +%Y%m%d-%H%M%S).db"

  # Zkopírovat backup mimo kontejner
  docker cp marianska-chata:/app/data/backups/bookings-pre-pricing-model-* \
    ./data/backups/
  ```

  **Backup cesta:** _______________
  **Backup velikost:** _______________ MB
  **Backup verified:** ☐ Yes ☐ No

- [ ] **Git commit před deploymentem**
  ```bash
  git add .
  git commit -m "Pre-deployment backup - pricing model v1.0"
  git tag -a v1.0-pricing-model -m "Nový cenový model - prázdné pokoje"
  git push origin main --tags
  ```

  **Commit hash:** _______________
  **Tag created:** ☐ Yes ☐ No

- [ ] **Rollback plán připraven** (viz UAT_DOCUMENT.md sekce 7)

- [ ] **Emergency contacts notifikováni**
  - Technical Lead: _______________
  - On-call engineer: _______________
  - Product Owner: _______________

---

### Testovací Prostředí ✅

- [ ] **Automated tests prošly v production-like prostředí**
  ```bash
  bash run-all-tests.sh
  ```

  **Výsledek:** ___ / 11 tests passed
  **Všechny prošly:** ☐ Yes ☐ No

- [ ] **Docker kontejnery připraveny**
  ```bash
  docker-compose ps
  ```

  **Status:** ☐ All running ☐ Issues

- [ ] **Server health check**
  ```bash
  curl -I http://chata.utia.cas.cz
  ```

  **HTTP Status:** _______________
  **Response time:** _______________ ms

---

### Komunikace ✅

- [ ] **Stakeholdeři notifikováni o plánovaném deploymentu**
  - Email odeslaný: ☐ Yes ☐ No
  - Datum odeslání: _______________
  - Recipients: _______________

- [ ] **Downtime oznámení** (pokud applicable)
  - Plánovaný downtime: _______________ (očekáváno: 0 minut)
  - Users notifikováni: ☐ Yes ☐ No ☐ N/A

- [ ] **Monitoring team připraven**
  - Team notifikován: ☐ Yes ☐ No
  - Monitoring tools ready: ☐ Yes ☐ No

---

## 🚀 Deployment Steps

### Step 1: Final Backup ✅

**Time:** _______________

```bash
# 1. Zastavit Docker kontejnery
docker-compose down

# 2. Vytvořit finální backup
sudo cp -r /home/marianska/marianska/data /home/marianska/marianska/data.backup-$(date +%Y%m%d-%H%M%S)

# 3. Ověřit backup
ls -lh /home/marianska/marianska/data.backup-*
```

**Backup created:** ☐ Yes ☐ No
**Backup verified:** ☐ Yes ☐ No
**Backup size:** _______________ MB

---

### Step 2: Code Deployment ✅

**Time:** _______________

```bash
# 1. Aktuální verze (pokud není již deployed)
cd /home/marianska/marianska
git pull origin main

# 2. Ověřit změny
git log --oneline -10

# 3. Zkontrolovat přítomnost nových souborů
ls -la js/shared/priceCalculator.js
grep -c "empty" admin.js
```

**Code pulled:** ☐ Yes ☐ No
**Files verified:** ☐ Yes ☐ No

---

### Step 3: Database Migration ✅

**Time:** _______________

**⚠️ DŮLEŽITÉ:** Migrace probíhá AUTOMATICKY při startu serveru!

```bash
# Spustit Docker kontejnery s rebuild
docker-compose up --build -d

# Sledovat logy migrace
docker-compose logs -f web | grep Migration
```

**Očekávaný výstup:**
```
[Migration] Checking for price_locked column...
[Migration] Adding price_locked column to bookings table...
[Migration] Locked prices for 39 existing bookings
[Migration] Migration completed successfully
```

**Migration výstup:**
```
_________________________________________________
_________________________________________________
```

**Migration successful:** ☐ Yes ☐ No
**Bookings locked:** ___ / 39

---

### Step 4: Post-Deployment Verification ✅

**Time:** _______________

#### 4.1 Server Health Check

```bash
# 1. Zkontrolovat status kontejnerů
docker-compose ps

# 2. Health check
curl -I http://chata.utia.cas.cz

# 3. Zkontrolovat error logs
docker-compose logs web | grep -i error | tail -20
```

**Containers running:** ☐ Yes ☐ No
**HTTP status:** _______________ (očekáváno: 200 nebo 301)
**Errors found:** ☐ None ☐ Some (specify below)

**Errors:**
```
_________________________________________________
```

#### 4.2 Database Verification

```bash
# Ověřit price lock migration
docker exec marianska-chata node /app/verify-price-lock-quick.js

# Ověřit pricing formula
docker exec marianska-chata node /app/test-new-pricing-formula.js
```

**Price lock verification:**
```
Total: ___ Locked: ___ Unlocked: ___
Status: ☐ SUCCESS ☐ FAIL
```

**Pricing formula verification:**
```
Total: 6 Passed: ___ Failed: ___
Status: ☐ ALL PASS ☐ SOME FAIL
```

#### 4.3 Functional Smoke Tests

**Admin Panel:**
- [ ] Přihlášení funguje
- [ ] Tab "Nastavení systému" zobrazí správné štítky
- [ ] Ceny lze uložit
- [ ] Existující rezervace zobrazeny správně

**Frontend:**
- [ ] Homepage se načte
- [ ] Kalendář se zobrazí
- [ ] Kliknutí na pokoj otevře modal
- [ ] Dropdown "Typ hostů" je viditelný
- [ ] Cena se počítá správně (quick check)

**Smoke test results:**
- Admin panel: ☐ OK ☐ Issues
- Frontend: ☐ OK ☐ Issues
- Pricing: ☐ OK ☐ Issues

---

### Step 5: Monitoring Setup ✅

**Time:** _______________

```bash
# 1. Začít sledovat logy
docker-compose logs -f web > /tmp/deployment-logs-$(date +%Y%m%d-%H%M%S).log &

# 2. Monitor error rate
watch -n 10 'docker-compose logs web | grep -c "ERROR"'
```

**Monitoring started:** ☐ Yes ☐ No
**Log file:** _______________

---

## 📊 Post-Deployment Monitoring (First 24 Hours)

### Hour 1: Intensive Monitoring ⏰

**Time:** _______________

**Checklist:**
- [ ] Server responding normally (< 2s response time)
- [ ] No critical errors in logs
- [ ] New bookings created successfully
- [ ] Existing bookings editable without price change
- [ ] Admin panel accessible

**Issues found:**
```
_________________________________________________
_________________________________________________
```

**Action taken:**
```
_________________________________________________
_________________________________________________
```

---

### Hour 2-3: Regular Monitoring ⏰

**Time:** _______________

**Checklist:**
- [ ] Error rate < 0.1%
- [ ] Response times stable
- [ ] No user complaints received
- [ ] Database integrity OK

**Metrics:**
- Total requests: _______________
- Error rate: _______________ %
- Avg response time: _______________ ms
- New bookings: _______________

---

### Hour 4-8: Periodic Checks ⏰

**Check every 2 hours**

**Check 1 (Hour 4):**
- Time: _______________
- Status: ☐ OK ☐ Issues
- Notes: _______________

**Check 2 (Hour 6):**
- Time: _______________
- Status: ☐ OK ☐ Issues
- Notes: _______________

**Check 3 (Hour 8):**
- Time: _______________
- Status: ☐ OK ☐ Issues
- Notes: _______________

---

### Hour 8-24: Light Monitoring ⏰

**Check every 4 hours**

**Check 1 (Hour 12):**
- Time: _______________
- Status: ☐ OK ☐ Issues
- Notes: _______________

**Check 2 (Hour 16):**
- Time: _______________
- Status: ☐ OK ☐ Issues
- Notes: _______________

**Check 3 (Hour 20):**
- Time: _______________
- Status: ☐ OK ☐ Issues
- Notes: _______________

**Check 4 (Hour 24):**
- Time: _______________
- Status: ☐ OK ☐ Issues
- Notes: _______________

---

## 🚨 Incident Response

### Critical Issues (Immediate Action)

**Trigger:** Server down, critical functionality broken, data corruption

**Action Plan:**
1. ☐ Notify on-call engineer immediately
2. ☐ Assess severity
3. ☐ Decision: Rollback or Hotfix?
4. ☐ Execute rollback if needed (see Rollback section)
5. ☐ Notify stakeholders
6. ☐ Document incident

**Incident log:**
```
Time: _______________
Severity: ☐ Critical ☐ Major ☐ Minor
Description: _______________________________________________
Action taken: _______________________________________________
Resolution: _______________________________________________
```

---

### High Priority Issues (Within 4 hours)

**Trigger:** Incorrect pricing, UI issues, performance degradation

**Action Plan:**
1. ☐ Assess impact
2. ☐ Prepare hotfix
3. ☐ Test hotfix
4. ☐ Deploy hotfix
5. ☐ Verify fix
6. ☐ Document

---

### Medium Priority Issues (Within 24 hours)

**Trigger:** Minor bugs, cosmetic issues, non-critical UX problems

**Action Plan:**
1. ☐ Log issue
2. ☐ Prioritize for next sprint
3. ☐ Optional quick fix if trivial

---

## 🔄 Rollback Procedure (If Needed)

### Rollback Triggers

Execute rollback if:
- ☐ Critical functionality broken
- ☐ Existing bookings showing wrong prices
- ☐ Server unstable or crashing
- ☐ Data corruption detected
- ☐ Product Owner requests rollback

### Rollback Steps

**Step 1: Immediate Actions**

```bash
# 1. Zastavit aplikaci
docker-compose down

# 2. Notify stakeholders
# (Send emergency email to all stakeholders)
```

**Notification sent:** ☐ Yes
**Time:** _______________

**Step 2: Database Restore**

```bash
# 3. Restore database backup
sudo rm -rf /home/marianska/marianska/data
sudo cp -r /home/marianska/marianska/data.backup-TIMESTAMP /home/marianska/marianska/data

# 4. Verify restore
ls -lh /home/marianska/marianska/data/
```

**Database restored:** ☐ Yes ☐ No
**Backup used:** _______________

**Step 3: Code Revert**

```bash
# 5. Revert to previous version
git checkout <previous-commit-hash>

# OR keep code, just use old prices
# (price_locked column is harmless to keep)
```

**Code reverted:** ☐ Yes ☐ No ☐ Not needed
**Commit hash:** _______________

**Step 4: Restart**

```bash
# 6. Rebuild and start
docker-compose up --build -d

# 7. Verify
docker-compose ps
curl -I http://chata.utia.cas.cz
```

**Services running:** ☐ Yes ☐ No
**Health check:** ☐ OK ☐ Issues

**Step 5: Verification**

```bash
# 8. Smoke test old functionality
# - Create test booking
# - Edit existing booking
# - Check admin panel
```

**Old functionality working:** ☐ Yes ☐ No

**Step 6: Communication**

- [ ] Stakeholders notified of successful rollback
- [ ] Users notified if needed
- [ ] Post-mortem scheduled

---

## 📈 Success Metrics

### First 24 Hours

**Target Metrics:**
- Server uptime: ≥ 99.9%
- Error rate: < 0.1%
- Response time: < 2s (p95)
- New bookings: Business as usual
- User complaints: 0

**Actual Metrics:**
- Server uptime: _______________ %
- Error rate: _______________ %
- Response time: _______________ ms (p95)
- New bookings: _______________
- User complaints: _______________

**Status:** ☐ Meets targets ☐ Below targets ☐ Above targets

---

### First Week

**Target Metrics:**
- No critical bugs reported
- No incorrect pricing incidents
- Locked bookings behaving correctly
- Admin satisfaction: High

**Actual Results:**
- Critical bugs: _______________
- Pricing incidents: _______________
- Locked booking issues: _______________
- Admin feedback: _______________

**Overall success:** ☐ Yes ☐ Partial ☐ No

---

## ✅ Deployment Completion Sign-Off

### Deployment Completed

**Deployment finished:** _______________
**Duration:** _______________ minutes
**Downtime:** _______________ minutes (očekáváno: 0)

**Status:** ☐ Success ☐ Success with issues ☐ Failed (rolled back)

### Sign-Off

**Deployment Engineer:**
- Name: _______________
- Signature: _______________
- Date: _______________
- Status: ☐ APPROVED ☐ APPROVED WITH NOTES

**Technical Lead:**
- Name: _______________
- Signature: _______________
- Date: _______________
- Status: ☐ APPROVED ☐ APPROVED WITH NOTES

**Product Owner:**
- Name: _______________
- Signature: _______________
- Date: _______________
- Status: ☐ APPROVED ☐ APPROVED WITH NOTES

---

## 📝 Notes & Lessons Learned

### What Went Well

```
_________________________________________________
_________________________________________________
_________________________________________________
```

### What Could Be Improved

```
_________________________________________________
_________________________________________________
_________________________________________________
```

### Action Items for Future

```
_________________________________________________
_________________________________________________
_________________________________________________
```

---

## 📎 Attachments

**Logs:**
- Deployment log: _______________
- Error log: _______________
- Migration log: _______________

**Backups:**
- Database backup: _______________
- Code backup (git tag): _______________

**Test Results:**
- Automated tests: _______________
- Manual tests: _______________
- UAT document: _______________

---

**Checklist vytvořen:** 2025-11-04
**Last updated:** _______________
**Version:** 1.0
