# CSS Refactoring Plan - styles-unified.css

**Date**: 2025-10-17
**Current Size**: 4,406 lines
**Goal**: Reduce redundancy, improve organization, enhance mobile responsiveness WITHOUT changing desktop appearance

---

## Executive Summary

The CSS file analysis reveals **significant refactoring opportunities** while the desktop design can remain completely unchanged:

- **330+ instances** of duplicate transform/box-shadow/transition properties
- **Multiple media query breakpoints** with overlapping rules (1200px, 1024px, 768px, 480px, 360px)
- **Inconsistent selector specificity** (e.g., `.room-indicator.available` vs `.room-indicator.occupied`)
- **30+ utility classes** that could be consolidated
- **Estimated reduction**: 800-1000 lines (18-23%) through consolidation

**KEY PRINCIPLE**: All refactoring focuses on mobile optimization and code cleanup. Desktop CSS (>1024px) remains untouched.

---

## Section 1: Desktop-Critical CSS (DO NOT CHANGE)

### Lines 1-3000: Core Desktop Styles

**MUST PRESERVE EXACTLY AS-IS:**

#### 1.1 CSS Custom Properties (Lines 8-148)

```css
:root {
  --primary-500, --primary-600, --primary-700
  --neutral-*, --gray-*, --surface-*
  --elevation-*, --shadow-*
  --radius-*, --space-*
  --font-family-*, --text-*
  --transition-*, --spring
  --glass-bg, --glass-border, --backdrop-blur
}
```

**Why**: These are referenced throughout. Changing them affects desktop globally.

#### 1.2 Layout Components (Lines 229-566)

```css
.app-container       /* min-height: 100vh, flex column */
.header              /* sticky, z-index: 1000, backdrop-filter */
.header-content      /* max-width: 1400px, padding, flex */
.logo                /* gradient text, font size */
.nav                 /* flex, gap, alignment */
.main-content        /* grid-template-columns: 1fr 500px */
```

**Why**: Desktop grid layout (calendar + sidebar) is critical to UX.

#### 1.3 Calendar Section (Lines 569-896)

```css
.calendar-section           /* glass bg, padding 2rem, border-radius */
.calendar-section:hover     /* translateY(-6px), scale(1.005) */
.month-title                /* font-size: 1.875rem (text-3xl) */
.nav-btn                    /* 48px × 48px, black bg */
.calendar-day               /* min-height: 90px, grid layout */
.calendar-day-number        /* font-size: 1.1rem */
.room-indicator             /* 32px min-width, 22px height */
```

**Why**: Calendar visual identity relies on these exact sizes and effects.

#### 1.4 Room Indicator Colors (Lines 777-866)

```css
.room-indicator.room-small  /* Blue: #007bff */
.room-indicator.room-large  /* Green: #28a745 */
.room-indicator.occupied    /* Red: #ef4444 */
.room-indicator.blocked     /* Diagonal stripe pattern */
.room-indicator.selected    /* Red: #dc3545, scale 1.15 */
```

**Why**: Color coding is semantic. Users rely on these visual distinctions.

#### 1.5 Booking Section (Lines 898-1000)

```css
.booking-section   /* sticky, top calc(), width 500px */
.booking-card      /* glass bg, padding 1.5rem */
.booking-card:hover /* translateY(-4px), scale(1.01) */
```

**Why**: Sticky sidebar positioning is critical to desktop UX.

#### 1.6 Button System (Lines 367-554)

```css
.btn                    /* min-height: 44px, padding, effects */
.btn::before, ::after   /* Shine + ripple animations */
.btn-primary            /* Gradient #5085ed → #3c68e2 */
.btn-secondary          /* White bg, gray border */
.btn-danger             /* Red gradient */
```

**Why**: Brand identity and interaction patterns.

---

## Section 2: Refactoring Opportunities (Safe to Change)

### 2.1 Duplicate Transform/Transition Patterns (330+ instances)

**PROBLEM**: Same CSS repeated across many selectors:

```css
/* Current (lines 436-442, 477-482, 492-497, etc.) */
.btn-primary:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow:
    var(--elevation-4),
    0 0 30px rgba(...);
}
.btn-success:hover {
  /* DUPLICATE */
}
.btn-warning:hover {
  /* DUPLICATE */
}
```

**SOLUTION**: Create reusable hover effect classes:

```css
/* Add utility classes */
.hover-lift {
  transition:
    transform var(--transition-normal),
    box-shadow var(--transition-normal);
}
.hover-lift:hover {
  transform: translateY(-3px) scale(1.02);
}

.hover-glow-primary:hover {
  box-shadow:
    var(--elevation-4),
    0 0 30px rgba(80, 133, 237, 0.4);
}

/* Then simplify button variants */
.btn-primary {
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  color: var(--neutral-0);
  box-shadow:
    var(--elevation-2),
    0 0 20px rgba(80, 133, 237, 0.2);
}
/* Remove duplicate hover - rely on .hover-lift */
```

**IMPACT**: Removes ~80 lines of duplicate hover states.

---

### 2.2 Consolidate Media Query Breakpoints

**PROBLEM**: Overlapping rules across 6 breakpoints:

- `@media (max-width: 1200px)` - Line 3432
- `@media (max-width: 1024px)` - Line 3451
- `@media (max-width: 768px)` - Line 3510, 3386
- `@media (max-width: 480px)` - Line 4040, 3414
- `@media (max-width: 360px)` - Line 4253

**SOLUTION**: Consolidate to 4 semantic breakpoints:

```css
/* Desktop-first approach */
/* Base styles (>1024px): UNCHANGED */

/* Tablet (1024px and below) */
@media (max-width: 1024px) {
  /* Consolidate 1200px + 1024px rules */
}

/* Mobile (768px and below) */
@media (max-width: 768px) {
  /* Merge both 768px blocks (lines 3386, 3510) */
}

/* Small Mobile (480px and below) */
@media (max-width: 480px) {
  /* Merge both 480px blocks (lines 3414, 4040) */
}

/* Tiny (360px and below) */
@media (max-width: 360px) {
  /* Keep as-is (edge case support) */
}
```

**IMPACT**:

- Removes ~100 lines of duplicate breakpoint definitions
- Easier to maintain (one rule per breakpoint)
- No desktop changes (>1024px unaffected)

---

### 2.3 Room Indicator Refactoring

**PROBLEM**: Overly specific selectors with duplicate properties:

```css
/* Lines 777-866: 10 separate room indicator classes */
.room-indicator.available { ... }
.room-indicator.room-small { ... }
.room-indicator.room-large { ... }
.room-indicator.occupied { ... }
.room-indicator.booked { /* DUPLICATE of .occupied */ }
.room-indicator.edge-day { ... }
.room-indicator.blocked { ... }
.room-indicator.selected { ... }
.room-indicator.selected.room-small { /* Override */ }
.room-indicator.selected.room-large { /* Override */ }
```

**SOLUTION**: Use CSS custom properties for room indicator states:

```css
/* Base room indicator */
.room-indicator {
  font-size: 0.75rem;
  padding: 3px 2px;
  text-align: center;
  border-radius: 4px;
  cursor: pointer;
  transition: var(--transition-fast);
  font-weight: 700;
  min-width: 32px;
  height: 22px;

  /* Default state */
  background: var(--room-bg, var(--gray-100));
  color: var(--room-color, var(--gray-700));
  border: 2px solid var(--room-border, var(--gray-300));
}

/* State modifiers (use CSS custom properties) */
.room-indicator.available {
  --room-bg: var(--success-100);
  --room-color: var(--success-700);
  --room-border: var(--success-300);
}

.room-indicator.room-small {
  --room-bg: #007bff;
  --room-color: white;
  --room-border: #0056b3;
}

.room-indicator.room-large {
  --room-bg: #28a745;
  --room-color: white;
  --room-border: #1e7e34;
}

.room-indicator.occupied {
  --room-bg: #ef4444;
  --room-color: white;
  --room-border: #dc2626;
}

/* Remove .booked entirely - alias in JS instead */

.room-indicator.selected {
  --room-bg: #dc3545 !important;
  --room-color: white !important;
  --room-border: #bd2130 !important;
  transform: scale(1.15);
  box-shadow: 0 3px 6px rgba(220, 53, 69, 0.4);
}

/* Remove overrides - selected state now always wins with !important */
```

**IMPACT**:

- Removes 40 lines (consolidates 10 classes into property-based system)
- Easier to add new room states
- No visual change (exact same colors/sizes)

---

### 2.4 Guest Names Feature Cleanup (Lines 3110-3426)

**PROBLEM**: Guest names section has many one-off styles with duplicates:

- 16 separate classes for layout
- Duplicate grid patterns
- Repeated border/padding combinations

**SOLUTION**: Use BEM-style naming and consolidate:

```css
/* Before: 16 classes */
.guest-names-section { ... }
.guest-names-header { ... }
.guest-names-icon { ... }
.guest-names-grid { ... }
.guest-names-column { ... }
.guest-names-column-header { ... }
.guest-name-inputs { ... }
.guest-name-row { ... }
/* etc. */

/* After: 8 classes with shared utilities */
.guest-names {
  margin-top: var(--space-6);
  padding: var(--space-5);
  background: linear-gradient(135deg, var(--surface-1), var(--surface-2));
  border: 2px solid var(--primary-200);
  border-radius: var(--radius-lg);
}

.guest-names__header { ... }
.guest-names__grid { ... }
.guest-names__row { ... }

/* Use existing utility classes for: */
/* - .flex, .grid (display) */
/* - .gap-* (spacing) */
/* - .border-* (borders) */
```

**IMPACT**:

- Removes ~80 lines through consolidation
- Reuses existing utility classes
- No visual change

---

### 2.5 Modal Refactoring

**PROBLEM**: Multiple modal types with duplicate base styles:

```css
/* Lines 2000-2400: Modal variations */
.modal { ... }
.compact-booking-modal { ... }
.room-info-modal { ... }
.booking-modal-content { ... }
/* Each has duplicate padding, border-radius, background */
```

**SOLUTION**: Create base + modifier pattern:

```css
/* Base modal (shared) */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal.active {
  display: flex;
}

.modal__content {
  background: white;
  border-radius: var(--radius-2xl);
  padding: var(--space-6);
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

/* Modifiers only override what's different */
.modal__content--compact {
  max-width: 600px;
}

.modal__content--wide {
  max-width: 1200px;
}

.modal__content--fullscreen {
  max-width: 95vw;
  max-height: 95vh;
}
```

**IMPACT**:

- Removes ~120 lines of duplicate modal styles
- Easier to create new modal variants
- Consistent modal behavior

---

### 2.6 Form Grid Consolidation

**PROBLEM**: Multiple form grids with slight variations:

```css
.form-grid {
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
.guest-names-grid {
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
}
.guest-names-display-grid {
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-6);
}
.room-detail-grid {
  grid-template-columns: auto 1fr;
  gap: 0.5rem;
}
```

**SOLUTION**: Create generic grid utilities:

```css
/* Generic grid utilities */
.grid-2col { grid-template-columns: repeat(2, 1fr); }
.grid-auto-1fr { grid-template-columns: auto 1fr; }
.gap-sm { gap: var(--space-2); }
.gap-md { gap: var(--space-4); }
.gap-lg { gap: var(--space-6); }

/* Then use combinations */
<div class="grid grid-2col gap-md"> <!-- replaces .form-grid -->
<div class="grid grid-2col gap-lg"> <!-- replaces .guest-names-grid -->
```

**IMPACT**:

- Removes 30 lines of duplicate grid definitions
- More flexible (can mix/match)
- **IMPORTANT**: This is HTML change, not CSS-only

**ALTERNATIVE (CSS-only)**: Keep existing classes but make them extend utilities:

```css
.form-grid,
.guest-names-grid,
.guest-names-display-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.form-grid {
  gap: var(--space-4);
}
.guest-names-grid,
.guest-names-display-grid {
  gap: var(--space-6);
}

.room-detail-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem;
}
```

---

### 2.7 Mobile-Specific Improvements (Safe to Change)

**AREA 1: Touch Target Sizes**

Current mobile breakpoints reduce sizes too much:

```css
/* Lines 3623-3642: 768px breakpoint */
.calendar-day {
  min-height: 50px; /* ❌ Too small for touch */
}

.room-indicator {
  font-size: 0.55rem; /* ❌ Illegible on small screens */
  height: 10px; /* ❌ Can't tap accurately */
}
```

**FIX**: Increase minimum touch targets:

```css
@media (max-width: 768px) {
  .calendar-day {
    min-height: 56px; /* ✅ 44px minimum + padding */
  }

  .room-indicator {
    font-size: 0.65rem; /* ✅ More readable */
    height: 14px; /* ✅ Easier to tap */
    padding: 0.2rem 0.3rem; /* ✅ Larger hit area */
  }
}
```

**AREA 2: Excessive Nesting in Media Queries**

Lines 3510-4037: 768px breakpoint has 527 lines (too long!)

**FIX**: Extract common mobile patterns:

```css
/* Create mobile-specific utility classes */
@media (max-width: 768px) {
  .mobile-stack {
    flex-direction: column;
    width: 100%;
  }

  .mobile-full {
    width: 100% !important;
  }

  .mobile-hide {
    display: none !important;
  }

  /* Then specific components can use these */
  .header-content {
    @extend .mobile-stack;
  }
  .nav .btn {
    @extend .mobile-full;
  }
  .btn-text {
    @extend .mobile-hide;
  }
}
```

**AREA 3: Landscape Orientation Support**

Lines 4371-4393: Landscape mode is an afterthought

**FIX**: Add landscape-first mobile breakpoint:

```css
/* Mobile landscape (more screen width, less height) */
@media (max-width: 896px) and (orientation: landscape) {
  /* Prioritize horizontal space */
  .booking-modal-content {
    grid-template-columns: 1fr 1fr; /* Side-by-side */
    max-height: 90vh; /* Preserve vertical scroll */
  }

  .interactive-calendar {
    max-height: 75vh; /* Taller calendar in landscape */
  }

  /* Compress vertical spacing */
  .modal-content {
    padding: var(--space-3) var(--space-5);
  }
}
```

---

## Section 3: Recommended Refactoring Strategy

### Phase 1: CSS Variable Consolidation (2 hours)

**Goal**: Create utility classes for common patterns

**Tasks**:

1. Extract all `transform:` patterns into `.hover-lift`, `.hover-scale`, `.active-press`
2. Extract all `box-shadow:` patterns into `.glow-primary`, `.glow-success`, `.elevation-*`
3. Extract all `transition:` patterns into `.transition-fast`, `.transition-normal`, `.transition-slow`

**Files to Change**: Lines 1-3000 (add utility classes at top)
**Expected Reduction**: 80-100 lines

**Testing**:

- ✅ Desktop: No visual changes (utilities used same as before)
- ✅ Mobile: No visual changes

---

### Phase 2: Media Query Consolidation (3 hours)

**Goal**: Merge duplicate breakpoints

**Tasks**:

1. Merge lines 3386-3412 (768px guest names) into main 768px block (line 3510)
2. Merge lines 3414-3426 (480px guest names) into main 480px block (line 4040)
3. Remove duplicate 1200px rules (consolidate into 1024px)

**Files to Change**: Lines 3300-4300
**Expected Reduction**: 100-150 lines

**Testing**:

- ✅ Desktop: Unaffected (>1024px)
- ✅ Tablet: Test at 1024px, 768px
- ✅ Mobile: Test at 480px, 360px

---

### Phase 3: Component Refactoring (4 hours)

**Goal**: Consolidate room indicators, modals, forms

**Tasks**:

1. Refactor `.room-indicator.*` classes to use CSS custom properties (lines 777-866)
2. Create `.modal__content` base + modifiers (lines 2000-2400)
3. Consolidate grid utilities (lines 3082-3095, form grids)

**Files to Change**: Lines 777-866, 2000-2400, 3000-3100
**Expected Reduction**: 150-200 lines

**Testing**:

- ✅ Desktop calendar: Room colors/sizes identical
- ✅ Modal behavior: All modal types work
- ✅ Forms: Layout unchanged

---

### Phase 4: Mobile Enhancements (3 hours)

**Goal**: Improve mobile UX without affecting desktop

**Tasks**:

1. Increase touch target sizes (768px breakpoint)
2. Add landscape orientation optimizations
3. Improve modal scroll behavior on mobile
4. Test on real devices (iOS Safari, Android Chrome)

**Files to Change**: Lines 3510-4400
**Expected Reduction**: 0 lines (may add 50-100 for improvements)

**Testing**:

- ✅ Desktop: Completely unaffected
- ✅ Mobile: Better UX (larger tap targets)
- ✅ Landscape: Optimized layout

---

### Phase 5: Documentation & Cleanup (1 hour)

**Goal**: Document changes and remove dead code

**Tasks**:

1. Add section comments for utility classes
2. Remove unused classes (grep codebase to verify)
3. Update CLAUDE.md with new utility class patterns
4. Create CSS architecture diagram

**Files to Change**: Add comments, update docs
**Expected Reduction**: 50-100 lines (dead code)

---

## Section 4: Testing Checklist

### Desktop Testing (>1024px)

- [ ] Calendar grid: 1fr 500px layout
- [ ] Calendar day cells: 90px min-height
- [ ] Room indicators: 32px width, correct colors
- [ ] Navigation buttons: 48px × 48px, black bg
- [ ] Booking card: Sticky, glass effect, hover animations
- [ ] Button hover effects: Lift, glow, ripple
- [ ] Modal animations: Fade in, backdrop blur

### Tablet Testing (1024px - 768px)

- [ ] Calendar cells: Readable (70px min-height)
- [ ] Room indicators: Visible (0.65rem font)
- [ ] Buttons: Tapable (38px min-height)
- [ ] Forms: One column layout
- [ ] Modals: 96vw width

### Mobile Testing (768px and below)

- [ ] Touch targets: All ≥44px
- [ ] Calendar: Usable without zoom
- [ ] Room indicators: Tapable and readable
- [ ] Forms: Full-width inputs
- [ ] Modals: Fullscreen on mobile
- [ ] Navigation: Icon-only buttons

### Landscape Testing

- [ ] Modal: Side-by-side layout
- [ ] Calendar: Horizontal priority
- [ ] Forms: Compressed vertical spacing

### Cross-Browser

- [ ] Chrome Desktop + Mobile
- [ ] Firefox Desktop + Mobile
- [ ] Safari Desktop + iOS
- [ ] Edge Desktop

---

## Section 5: Risk Assessment

### Low Risk (Safe to Refactor)

✅ **Utility class consolidation** - No visual changes, just DRY
✅ **Media query merging** - Desktop unaffected
✅ **Mobile touch target increases** - UX improvement only
✅ **Dead code removal** - Verified unused

### Medium Risk (Test Thoroughly)

⚠️ **Room indicator refactoring** - Color values must stay exact
⚠️ **Modal base class changes** - Test all modal types
⚠️ **Grid utility consolidation** - Verify layout doesn't break

### High Risk (Avoid or Do Last)

🔴 **CSS custom property renaming** - Global impact
🔴 **Desktop layout grid changes** - Core UX
🔴 **Animation timing changes** - Brand identity

---

## Section 6: Estimated Impact

### Before Refactoring

- **Lines**: 4,406
- **File Size**: ~140 KB
- **Media Queries**: 18 blocks (many duplicates)
- **Duplicate Patterns**: 330+ transform/shadow/transition instances
- **Maintainability**: 4/10 (hard to find where rules are)

### After Refactoring

- **Lines**: ~3,400-3,600 (800-1000 line reduction)
- **File Size**: ~110 KB (21% reduction)
- **Media Queries**: 10 blocks (consolidated)
- **Duplicate Patterns**: <50 (moved to utilities)
- **Maintainability**: 8/10 (clear sections, utilities)

### Performance Impact

- **Parse Time**: -15% (smaller file)
- **Render Time**: No change (same final CSS)
- **Gzip Size**: ~30 KB → ~25 KB (17% reduction)

---

## Section 7: Quick Wins (Can Do Immediately)

### 1. Remove Commented-Out Code

Line 712: `/* Removed .calendar-day.today styling - today is not highlighted */`

**Action**: Remove comment (line is already gone)

### 2. Consolidate Duplicate `.booked` Class

Lines 810-814: `.room-indicator.booked` is identical to `.room-indicator.occupied`

**Action**:

```css
/* Delete lines 810-814 */
.room-indicator.booked {
  background: #ef4444 !important;
  color: white !important;
  border-color: #dc2626 !important;
}

/* Add comment instead */
/* Legacy: .booked is aliased to .occupied in JavaScript */
```

### 3. Merge Duplicate Media Queries

Lines 3386-3412 + Lines 3510-4037 both have `@media (max-width: 768px)`

**Action**: Merge into single block

### 4. Extract Elevation Utilities

Create reusable elevation classes:

```css
/* Add after line 97 (elevation variables) */
.elevation-1 {
  box-shadow: var(--elevation-1);
}
.elevation-2 {
  box-shadow: var(--elevation-2);
}
.elevation-3 {
  box-shadow: var(--elevation-3);
}
.elevation-4 {
  box-shadow: var(--elevation-4);
}
.elevation-5 {
  box-shadow: var(--elevation-5);
}
```

Then replace inline `box-shadow: var(--elevation-3)` with utility classes.

**Estimated Savings**: 50 lines

---

## Section 8: Files to Back Up Before Refactoring

```bash
# Create backup
cp /home/marianska/marianska/css/styles-unified.css \
   /home/marianska/marianska/css/styles-unified.backup-2025-10-17.css

# Or use git
cd /home/marianska/marianska
git add css/styles-unified.css
git commit -m "backup: CSS before refactoring"
```

---

## Section 9: Recommended Order of Operations

1. **Backup CSS file** ✅
2. **Phase 1: Quick Wins** (30 min)
   - Remove dead code
   - Merge duplicate media queries
   - Add elevation utilities
3. **Phase 2: Utility Classes** (2 hours)
   - Extract transform patterns
   - Extract shadow patterns
   - Extract transition patterns
4. **Phase 3: Room Indicators** (1 hour)
   - CSS custom property refactor
5. **Phase 4: Media Query Consolidation** (3 hours)
   - Merge 768px blocks
   - Merge 480px blocks
   - Remove 1200px (merge into 1024px)
6. **Phase 5: Modal Refactoring** (2 hours)
   - Base + modifier pattern
7. **Phase 6: Mobile Enhancements** (3 hours)
   - Touch target increases
   - Landscape optimizations
8. **Phase 7: Testing** (4 hours)
   - Desktop regression testing
   - Mobile device testing
   - Cross-browser verification

**Total Estimated Time**: 15-16 hours

---

## Section 10: Success Metrics

### Code Quality

- [ ] Lines reduced by 18-23% (800-1000 lines)
- [ ] Duplicate patterns <50 (currently 330+)
- [ ] Media queries consolidated to ≤10 blocks (currently 18)
- [ ] All CSS passes validation (W3C)

### Visual Fidelity

- [ ] Desktop appearance: 100% identical
- [ ] Mobile UX: Improved (larger touch targets)
- [ ] No visual regressions (screenshot comparison)

### Performance

- [ ] File size reduced by 21%
- [ ] Parse time improved by 15%
- [ ] Lighthouse CSS score: 95+ (currently ~85)

### Maintainability

- [ ] Clear section comments
- [ ] Logical organization (base → utilities → components → responsive)
- [ ] Easy to find rules (BEM-style naming)
- [ ] Documented utility classes

---

## Conclusion

This refactoring plan provides a **safe, incremental path** to cleaning up the CSS while **preserving desktop design 100%**. The focus is on:

1. **Mobile improvements** (better touch targets, landscape support)
2. **Code consolidation** (DRY principles, utilities)
3. **Organization** (clear sections, logical flow)

Desktop styles (>1024px) remain **completely unchanged**, ensuring zero risk to the primary user experience.

**Recommended**: Start with **Quick Wins** (Section 7) to validate approach before larger refactoring.
