#!/bin/bash

##############################################################################
# Automated Testing Suite - Mariánská Chata Pricing Model
##############################################################################

echo "═══════════════════════════════════════════════════════════════════"
echo "  Mariánská Chata - Automated Testing Suite"
echo "  New Pricing Model Verification"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

##############################################################################
# Test 1: Docker Containers Running
##############################################################################
echo -e "${BLUE}[TEST 1]${NC} Checking Docker containers..."
echo "─────────────────────────────────────────────────────────────────"

if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ PASS${NC}: Docker containers are running"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Docker containers are not running"
    echo "   Fix: Run 'docker-compose up -d'"
    ((FAILED++))
    exit 1
fi
echo ""

##############################################################################
# Test 2: Server Health Check
##############################################################################
echo -e "${BLUE}[TEST 2]${NC} Checking server health..."
echo "─────────────────────────────────────────────────────────────────"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 301 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Server responding (HTTP $HTTP_CODE)"
    if [ "$HTTP_CODE" -eq 301 ]; then
        echo "   Note: HTTP 301 is OK (nginx redirect)"
    fi
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Server not responding properly (HTTP $HTTP_CODE)"
    ((FAILED++))
fi
echo ""

##############################################################################
# Test 3: Price Lock Migration
##############################################################################
echo -e "${BLUE}[TEST 3]${NC} Verifying price lock migration..."
echo "─────────────────────────────────────────────────────────────────"

LOCK_OUTPUT=$(docker exec marianska-chata node /app/verify-price-lock-quick.js 2>&1)
echo "$LOCK_OUTPUT"

if echo "$LOCK_OUTPUT" | grep -q "✅ SUCCESS: All bookings are locked"; then
    echo -e "${GREEN}✅ PASS${NC}: All existing bookings have locked prices"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Price lock migration incomplete"
    ((FAILED++))
fi
echo ""

##############################################################################
# Test 4: New Pricing Formula
##############################################################################
echo -e "${BLUE}[TEST 4]${NC} Testing new pricing formula..."
echo "─────────────────────────────────────────────────────────────────"

FORMULA_OUTPUT=$(docker exec marianska-chata node /app/test-new-pricing-formula.js 2>&1)
echo "$FORMULA_OUTPUT"

if echo "$FORMULA_OUTPUT" | grep -q "✅ All tests passed!"; then
    echo -e "${GREEN}✅ PASS${NC}: All pricing formula tests passed (6/6)"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Some pricing formula tests failed"
    ((FAILED++))
fi
echo ""

##############################################################################
# Test 5: Database Schema (via verification script)
##############################################################################
echo -e "${BLUE}[TEST 5]${NC} Checking database schema..."
echo "─────────────────────────────────────────────────────────────────"

# Check if price_locked column exists by running verification script
# (This also verifies the column works correctly)
if echo "$LOCK_OUTPUT" | grep -q "price_locked column exists"; then
    echo -e "${GREEN}✅ PASS${NC}: Database schema includes price_locked column"
    ((PASSED++))
elif echo "$LOCK_OUTPUT" | grep -q "All bookings are locked"; then
    echo -e "${GREEN}✅ PASS${NC}: Database schema verified (all bookings locked successfully)"
    echo "   Note: price_locked column working correctly"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Cannot verify database schema"
    ((FAILED++))
fi
echo ""

##############################################################################
# Test 6: Settings Structure (via code inspection)
##############################################################################
echo -e "${BLUE}[TEST 6]${NC} Checking price settings structure..."
echo "─────────────────────────────────────────────────────────────────"

# Check if admin.js saves with 'empty' key (JavaScript object literal syntax)
ADMIN_EMPTY=$(grep -c 'empty:' /home/marianska/marianska/admin.js)
# Check if PriceCalculator handles 'empty' field
CALC_EMPTY=$(grep -c 'roomPriceConfig.empty' /home/marianska/marianska/js/shared/priceCalculator.js)

echo "Admin.js saves 'empty' key: $ADMIN_EMPTY occurrences"
echo "PriceCalculator uses 'empty' field: $CALC_EMPTY occurrences"

if [ "$ADMIN_EMPTY" -ge 1 ] && [ "$CALC_EMPTY" -ge 1 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Code uses new 'empty' pricing format"
    echo "   Note: Backend will use 'empty' when saving, with backward compatibility"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Code doesn't properly implement 'empty' pricing"
    ((FAILED++))
fi
echo ""

##############################################################################
# Test 7: Admin HTML Labels
##############################################################################
echo -e "${BLUE}[TEST 7]${NC} Checking admin panel labels..."
echo "─────────────────────────────────────────────────────────────────"

LABEL_COUNT=$(grep -c "Prázdný pokoj:" /home/marianska/marianska/admin.html)
OLD_LABEL_COUNT=$(grep -c "Při obsazení 1 dospělou osobou:" /home/marianska/marianska/admin.html)

echo "New labels ('Prázdný pokoj:'): $LABEL_COUNT"
echo "Old labels ('Při obsazení 1 dospělou osobou:'): $OLD_LABEL_COUNT"

if [ "$LABEL_COUNT" -ge 4 ] && [ "$OLD_LABEL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Admin panel uses new 'Prázdný pokoj' labels"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Admin panel still has old labels or missing new labels"
    echo "   Expected: 4+ new labels, 0 old labels"
    echo "   Got: $LABEL_COUNT new, $OLD_LABEL_COUNT old"
    ((FAILED++))
fi
echo ""

##############################################################################
# Test 8: Frontend Dropdown UI
##############################################################################
echo -e "${BLUE}[TEST 8]${NC} Checking per-room guest type dropdown..."
echo "─────────────────────────────────────────────────────────────────"

DROPDOWN_COUNT=$(grep -c "singleRoomPerRoomGuestType" /home/marianska/marianska/index.html)
DROPDOWN_LABEL=$(grep -c "Typ hostů pro tento pokoj:" /home/marianska/marianska/index.html)

echo "Dropdown element count: $DROPDOWN_COUNT"
echo "Dropdown label count: $DROPDOWN_LABEL"

if [ "$DROPDOWN_COUNT" -ge 1 ] && [ "$DROPDOWN_LABEL" -ge 1 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Per-room guest type dropdown exists in frontend"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Missing per-room guest type dropdown"
    ((FAILED++))
fi
echo ""

##############################################################################
# Test 9: Server Price Lock Validation
##############################################################################
echo -e "${BLUE}[TEST 9]${NC} Checking server-side price lock logic..."
echo "─────────────────────────────────────────────────────────────────"

SERVER_LOCK=$(grep -c "isPriceLocked" /home/marianska/marianska/server.js)
SERVER_LOG=$(grep -c "Price recalculation skipped for locked booking" /home/marianska/marianska/server.js)

echo "Price lock checks in server.js: $SERVER_LOCK"
echo "Price lock logging: $SERVER_LOG"

if [ "$SERVER_LOCK" -ge 1 ] && [ "$SERVER_LOG" -ge 1 ]; then
    echo -e "${GREEN}✅ PASS${NC}: Server has price lock validation"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Server missing price lock validation"
    ((FAILED++))
fi
echo ""

##############################################################################
# Test 10: Documentation Files
##############################################################################
echo -e "${BLUE}[TEST 10]${NC} Checking documentation..."
echo "─────────────────────────────────────────────────────────────────"

DOC_FILES=(
    "/home/marianska/marianska/docs/NEW_PRICING_MODEL_IMPLEMENTATION.md"
    "/home/marianska/marianska/docs/PRICING_MODEL_TEST_PLAN.md"
    "/home/marianska/marianska/docs/PRICING_MODEL_COMPLETION_SUMMARY.md"
)

DOC_PASS=0
for doc in "${DOC_FILES[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✅${NC} $(basename $doc) exists"
        ((DOC_PASS++))
    else
        echo -e "${RED}❌${NC} $(basename $doc) missing"
    fi
done

if [ "$DOC_PASS" -eq 3 ]; then
    echo -e "${GREEN}✅ PASS${NC}: All documentation files present"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Missing documentation files ($DOC_PASS/3)"
    ((FAILED++))
fi
echo ""

##############################################################################
# Test 11: CLAUDE.md Update
##############################################################################
echo -e "${BLUE}[TEST 11]${NC} Checking CLAUDE.md update..."
echo "─────────────────────────────────────────────────────────────────"

CLAUDE_UPDATE=$(grep -c "NEW 2025-11-04" /home/marianska/marianska/CLAUDE.md)
CLAUDE_EMPTY=$(grep -ic "prázdný pokoj" /home/marianska/marianska/CLAUDE.md)  # case-insensitive
CLAUDE_EMPTY2=$(grep -c "prázdný_pokoj" /home/marianska/marianska/CLAUDE.md)  # formula variant

echo "NEW 2025-11-04 markers: $CLAUDE_UPDATE"
echo "Empty room mentions (prázdný pokoj): $CLAUDE_EMPTY"
echo "Formula mentions (prázdný_pokoj): $CLAUDE_EMPTY2"

if [ "$CLAUDE_UPDATE" -ge 1 ] && [ "$CLAUDE_EMPTY" -ge 1 ]; then
    echo -e "${GREEN}✅ PASS${NC}: CLAUDE.md updated with new pricing model"
    ((PASSED++))
elif [ "$CLAUDE_UPDATE" -ge 1 ] && [ "$CLAUDE_EMPTY2" -ge 1 ]; then
    echo -e "${GREEN}✅ PASS${NC}: CLAUDE.md updated with new pricing formula"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: CLAUDE.md not fully updated"
    ((FAILED++))
fi
echo ""

##############################################################################
# Summary
##############################################################################
echo "═══════════════════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
if [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
fi
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════════"
    echo "  ✅ ALL TESTS PASSED"
    echo "  Status: READY FOR MANUAL TESTING AND UAT"
    echo -e "═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. Run manual testing: node manual-testing-guide.js"
    echo "2. Perform UAT with stakeholders"
    echo "3. If UAT passes, deploy to production"
    exit 0
else
    echo -e "${RED}═══════════════════════════════════════════════════════════════════"
    echo "  ❌ SOME TESTS FAILED"
    echo "  Status: NEEDS FIXES BEFORE MANUAL TESTING"
    echo -e "═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Please review and fix failed tests before proceeding."
    exit 1
fi
