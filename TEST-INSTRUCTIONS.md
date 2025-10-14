# Testovací Instrukce - Multi-Room Booking s Guest Names

## ✅ Oprava nasazena

Docker kontejnery byly úspěšně přebuilovány a běží na `http://chata.utia.cas.cz`

## Co bylo opraveno

### Problém

Při rezervaci více pokojů s různými termíny systém vytvářel booking se všemi pokoji na min/max rozsah dat, což způsobovalo chybu dostupnosti.

### Řešení

Systém nyní inteligentně detekuje:

1. **Pokoje se STEJNÝMI termíny** → vytvoří JEDNU konsolidovanou rezervaci
2. **Pokoje s RŮZNÝMI termíny** → vytvoří SEPARÁTNÍ rezervace s rozdistribuovanými jmény hostů

---

## 📋 Test Scénář 1: Pokoje se STEJNÝMI termíny

### Očekávaný výsledek: 1 konsolidovaná rezervace

1. Otevřete `http://chata.utia.cas.cz`
2. Vyberte **stejný termín** pro více pokojů:
   - Například: 15.10.2025 - 20.10.2025
3. Klikněte na **Pokoj 12** v kalendáři
   - Vyberte termín: 15.10 - 20.10
   - Nastavte: 1 dospělý
   - Klikněte "Přidat do rezervace"
4. Klikněte na **Pokoj 13** v kalendáři
   - Vyberte STEJNÝ termín: 15.10 - 20.10
   - Nastavte: 1 dospělý
   - Klikněte "Přidat do rezervace"
5. Klikněte "Dokončit rezervaci"
6. Vyplňte jména obou hostů:
   - **1. dospělý**: Jan Novák
   - **2. dospělý**: Petr Svoboda
7. Vyplňte fakturační údaje a odešlete

### ✅ Výsledek by měl být:

- **1 rezervace** s:
  - Pokoje: 12, 13
  - Termín: 15.10 - 20.10
  - Hosté: 2 dospělí
  - Jména: Jan Novák, Petr Svoboda
- Žádná chyba dostupnosti
- Email s edit linkem

---

## 📋 Test Scénář 2: Pokoje s RŮZNÝMI termíny

### Očekávaný výsledek: 2 separátní rezervace

1. Otevřete `http://chata.utia.cas.cz`
2. Vyberte **různé termíny** pro pokoje:
3. Klikněte na **Pokoj 12** v kalendáři
   - Vyberte termín: 15.10 - 18.10 (3 noci)
   - Nastavte: 1 dospělý
   - Klikněte "Přidat do rezervace"
4. Klikněte na **Pokoj 13** v kalendáři
   - Vyberte JINÝ termín: 15.10 - 24.10 (9 nocí)
   - Nastavte: 2 dospělí
   - Klikněte "Přidat do rezervace"
5. Klikněte "Dokončit rezervaci"
6. Vyplňte jména všech 3 hostů:
   - **1. dospělý**: Jan Novák (pro Pokoj 12)
   - **2. dospělý**: Petr Svoboda (pro Pokoj 13)
   - **3. dospělý**: Marie Svobodová (pro Pokoj 13)
7. Vyplňte fakturační údaje a odešlete

### ✅ Výsledek by měl být:

- **2 separátní rezervace**:

  **Rezervace 1:**
  - Pokoj: 12
  - Termín: 15.10 - 18.10
  - Hosté: 1 dospělý
  - Jména: Jan Novák

  **Rezervace 2:**
  - Pokoj: 13
  - Termín: 15.10 - 24.10
  - Hosté: 2 dospělí
  - Jména: Petr Svoboda, Marie Svobodová

- Žádná chyba dostupnosti (např. "Pokoj 12 není dostupný dne 2025-10-22")
- 2 emaily s různými edit linky

---

## 📋 Test Scénář 3: Smíšený test s dětmi

### Očekávaný výsledek: Správné rozdělení dospělých a dětí

1. Otevřete `http://chata.utia.cas.cz`
2. Pokoj 12: 15.10 - 20.10, 2 dospělí, 1 dítě
3. Pokoj 13: 15.10 - 20.10, 1 dospělý, 2 děti
4. Vyplňte jména:
   - **Dospělí (3 celkem)**: Jan Novák, Petr Svoboda, Marie Svobodová
   - **Děti (3 celkem)**: Anna Nováková, Jakub Svoboda, Tereza Svobodová
5. Odešlete rezervaci

### ✅ Výsledek by měl být:

- **1 konsolidovaná rezervace** (stejné termíny)
- Pokoje: 12, 13
- Hosté: 3 dospělí, 3 děti
- Jména správně označena jako adult/child
- Validace by měla projít bez problémů

---

## 🔍 Jak ověřit v admin panelu

1. Přihlaste se do admin panelu: `http://chata.utia.cas.cz/admin.html`
2. Jděte do sekce "Rezervace"
3. Najděte své testovací rezervace
4. Klikněte na detail rezervace
5. Ověřte:
   - Počet pokojů odpovídá
   - Termíny jsou správné
   - Jména hostů jsou zobrazena v sekci "Jména ubytovaných osob"
   - Počet jmen odpovídá počtu hostů (adults + children)

---

## 🐛 Známé problémy opravené

✅ **OPRAVENO**: "Pokoj není dostupný dne X" při finalizaci multi-room bookingu s různými termíny
✅ **OPRAVENO**: "Počet jmen neodpovídá počtu hostů" při konsolidaci rezervací
✅ **OPRAVENO**: Guest names lze nyní editovat v edit okně (admin i user)

---

## 📝 Poznámky pro debugging

Pokud něco nefunguje:

1. Otevřete browser console (F12)
2. Podívejte se na červené chyby
3. Zkopírujte celou chybovou zprávu včetně stack trace
4. Zkontrolujte server logy:
   ```bash
   docker-compose logs -f web
   ```

## 🚀 Hard Refresh

Pokud vidíte staré chování, proveďte hard refresh:

- **Chrome/Firefox**: Ctrl + Shift + R
- **Mac**: Cmd + Shift + R

To vyčistí browser cache a načte nové JS soubory.
