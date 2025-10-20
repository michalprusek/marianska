# CSS Refactoring Checklist

**File**: `/home/marianska/marianska/css/styles-unified.css`
**Goal**: Reduce from 4,406 to 3,400-3,600 lines while preserving desktop appearance

---

## Pre-Refactoring

- [ ] **Backup CSS file**

  ```bash
  cp css/styles-unified.css css/styles-unified.backup-2025-10-17.css
  # OR
  git add css/styles-unified.css && git commit -m "backup: CSS before refactoring"
  ```

- [ ] **Take desktop screenshots** (for visual regression testing)
  - Homepage at 1920x1080
  - Calendar view
  - Booking form
  - Admin panel

- [ ] **Document current metrics**
  - File size: `wc -c css/styles-unified.css` → 140 KB
  - Line count: `wc -l css/styles-unified.css` → 4,406 lines
  - Media queries: `grep -c "@media" css/styles-unified.css` → 18

---

## Phase 1: Quick Wins (30 minutes)

### 1.1 Remove Dead Code

- [ ] Line 712: Remove comment `/* Removed .calendar-day.today styling */`
- [ ] Lines 810-814: Delete duplicate `.room-indicator.booked` class
  ```css
  /* DELETE THIS: */
  .room-indicator.booked {
    background: #ef4444 !important;
    color: white !important;
    border-color: #dc2626 !important;
  }
  ```
- [ ] **Test**: No visual changes

### 1.2 Add Elevation Utilities (after line 97)

- [ ] Add utility classes:
  ```css
  /* Elevation utilities (after CSS variables) */
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
- [ ] **Expected**: Add 5 lines
- [ ] **Test**: No visual changes (utilities not used yet)

### 1.3 First Round Testing

- [ ] Desktop appearance: Identical to screenshots
- [ ] Mobile: No regressions
- [ ] File compiles without errors

**Estimated savings**: 10 lines

---

## Phase 2: Utility Classes (2 hours)

### 2.1 Add Hover Effect Utilities (after elevation utils)

- [ ] Create hover utilities:

  ```css
  /* Hover effect utilities */
  .hover-lift {
    transition:
      transform var(--transition-normal),
      box-shadow var(--transition-normal);
  }
  .hover-lift:hover {
    transform: translateY(-3px) scale(1.02);
  }

  .hover-scale:hover {
    transform: scale(1.05);
  }

  .hover-bg-change {
    transition: background var(--transition-normal);
  }
  ```

- [ ] **Test**: Add class to one button, verify hover works
- [ ] **Expected**: Add 15 lines

### 2.2 Add Glow Effect Utilities

- [ ] Create glow utilities:

  ```css
  /* Glow effect utilities */
  .glow-primary:hover {
    box-shadow:
      var(--elevation-4),
      0 0 30px rgba(80, 133, 237, 0.4);
  }

  .glow-success:hover {
    box-shadow:
      var(--elevation-4),
      0 0 30px rgba(102, 187, 106, 0.4);
  }

  .glow-warning:hover {
    box-shadow:
      var(--elevation-4),
      0 0 30px rgba(255, 152, 0, 0.4);
  }
  ```

- [ ] **Test**: Verify glow effects work
- [ ] **Expected**: Add 12 lines

### 2.3 Add Transition Utilities

- [ ] Create transition utilities:
  ```css
  /* Transition utilities */
  .transition-fast {
    transition: all var(--transition-fast);
  }
  .transition-normal {
    transition: all var(--transition-normal);
  }
  .transition-slow {
    transition: all var(--transition-slow);
  }
  ```
- [ ] **Expected**: Add 3 lines

### 2.4 Refactor Button Hover States

- [ ] Simplify `.btn-primary:hover`:

  ```css
  /* Before (lines 436-442): */
  .btn-primary:hover {
    background: linear-gradient(135deg, var(--primary-600), var(--primary-700));
    transform: translateY(-3px) scale(1.02);
    box-shadow:
      var(--elevation-4),
      0 0 30px rgba(80, 133, 237, 0.4);
  }

  /* After: */
  .btn-primary {
    /* Add utility classes to .btn-primary elements in HTML */
  }
  .btn-primary:hover {
    background: linear-gradient(135deg, var(--primary-600), var(--primary-700));
  }
  ```

- [ ] Repeat for `.btn-success:hover`, `.btn-warning:hover`
- [ ] **Expected**: Remove 60 lines
- [ ] **Test**: All button hovers work identically

**Estimated savings**: 80-100 lines total

---

## Phase 3: Media Query Consolidation (3 hours)

### 3.1 Merge 768px Breakpoints

- [ ] Find all `@media (max-width: 768px)` blocks:
  - Line 3386 (guest names)
  - Line 3510 (main mobile styles)
- [ ] Copy content from line 3386 block
- [ ] Paste into line 3510 block
- [ ] Delete duplicate block at line 3386
- [ ] **Test**: Mobile view at 768px, verify layout identical
- [ ] **Expected**: Remove 50 lines

### 3.2 Merge 480px Breakpoints

- [ ] Find all `@media (max-width: 480px)` blocks:
  - Line 3414 (guest names)
  - Line 4040 (main small mobile)
- [ ] Copy content from line 3414 block
- [ ] Paste into line 4040 block
- [ ] Delete duplicate block at line 3414
- [ ] **Test**: Mobile view at 480px, verify layout identical
- [ ] **Expected**: Remove 50 lines

### 3.3 Merge 1200px into 1024px

- [ ] Find `@media (max-width: 1200px)` block (line 3432)
- [ ] Move all rules to `@media (max-width: 1024px)` block (line 3451)
- [ ] Delete empty 1200px block
- [ ] **Test**: Tablet view at 1024px and 1200px
- [ ] **Expected**: Remove 20 lines

### 3.4 Verify Media Query Count

- [ ] Run: `grep -c "@media" css/styles-unified.css`
- [ ] **Expected**: ~10 blocks (from 18)

**Estimated savings**: 100-150 lines total

---

## Phase 4: Component Refactoring (4 hours)

### 4.1 Room Indicator Refactoring

- [ ] Replace 10 `.room-indicator.*` classes with CSS custom properties:

  ```css
  /* Base (keep exact same properties) */
  .room-indicator {
    font-size: 0.75rem;
    padding: 3px 2px;
    /* ... other base properties ... */
    background: var(--room-bg, var(--gray-100));
    color: var(--room-color, var(--gray-700));
    border: 2px solid var(--room-border, var(--gray-300));
  }

  /* State modifiers */
  .room-indicator.available {
    --room-bg: var(--success-100);
    --room-color: var(--success-700);
    --room-border: var(--success-300);
  }
  /* ... repeat for other states ... */
  ```

- [ ] **CRITICAL**: Verify exact same colors:
  - `.room-small`: Blue #007bff
  - `.room-large`: Green #28a745
  - `.occupied`: Red #ef4444
  - `.blocked`: Diagonal stripes
  - `.selected`: Red #dc3545, scale 1.15
- [ ] **Test**: All room indicator colors and hover states identical
- [ ] **Expected**: Remove 40 lines

### 4.2 Modal Consolidation

- [ ] Create base `.modal__content` class
- [ ] Create modifiers: `--compact`, `--wide`, `--fullscreen`
- [ ] Refactor 8 modal variations to use base + modifier
- [ ] **Test**: All modal types (booking, room info, admin edit)
- [ ] **Expected**: Remove 120 lines

### 4.3 Grid Utilities

- [ ] Add grid utilities (or consolidate existing grids):

  ```css
  /* Option 1: Pure utilities */
  .grid-2col {
    grid-template-columns: repeat(2, 1fr);
  }
  .grid-auto-1fr {
    grid-template-columns: auto 1fr;
  }
  .gap-sm {
    gap: var(--space-2);
  }
  .gap-md {
    gap: var(--space-4);
  }
  .gap-lg {
    gap: var(--space-6);
  }

  /* Option 2: Extend existing classes */
  .form-grid,
  .guest-names-grid,
  .guest-names-display-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
  .form-grid {
    gap: var(--space-4);
  }
  .guest-names-grid {
    gap: var(--space-6);
  }
  ```

- [ ] **Test**: Form layouts unchanged
- [ ] **Expected**: Remove 30 lines

**Estimated savings**: 150-200 lines total

---

## Phase 5: Mobile Enhancements (3 hours)

### 5.1 Increase Touch Targets (768px breakpoint)

- [ ] Update calendar day min-height:

  ```css
  /* Before: */
  .calendar-day {
    min-height: 50px;
  }

  /* After: */
  .calendar-day {
    min-height: 56px;
  } /* 44px touch + padding */
  ```

- [ ] Update room indicator height:

  ```css
  /* Before: */
  .room-indicator {
    height: 10px;
    font-size: 0.55rem;
  }

  /* After: */
  .room-indicator {
    height: 14px;
    font-size: 0.65rem;
  }
  ```

- [ ] **Test**: Mobile at 768px, verify larger touch targets
- [ ] **Expected**: Better mobile UX, no line count change

### 5.2 Enhance Landscape Mode

- [ ] Expand `@media landscape` block (line 4371):

  ```css
  @media (max-width: 896px) and (orientation: landscape) {
    .modal-content {
      max-height: 95vh;
      overflow-y: auto;
    }

    .booking-modal-content {
      grid-template-columns: 1fr 1fr; /* Side by side */
      max-height: calc(95vh - 100px);
    }

    .interactive-calendar {
      max-height: 75vh; /* More vertical space for calendar */
    }

    /* Add: Compress vertical spacing */
    .header-content {
      padding: var(--space-2) var(--space-4);
    }

    .calendar-section {
      padding: var(--space-3);
    }
  }
  ```

- [ ] **Test**: Mobile landscape orientation
- [ ] **Expected**: Add 20 lines (enhancement, not reduction)

### 5.3 Touch-Specific Enhancements

- [ ] Expand `@media (hover: none)` block (line 4328):

  ```css
  @media (hover: none) and (pointer: coarse) {
    /* Increase all touch targets to 44px minimum */
    .btn,
    button,
    a,
    .calendar-day,
    .mini-calendar-day,
    .room-indicator,
    .nav-btn {
      min-width: 44px;
      min-height: 44px;
    }

    /* Remove hover effects (don't work on touch) */
    .btn:hover,
    .calendar-day:hover,
    .modal-close:hover {
      transform: none;
    }

    /* Better touch feedback with active states */
    .btn:active,
    .calendar-day:active {
      transform: scale(0.98);
      opacity: 0.9;
    }

    /* Optimize tap highlights */
    * {
      -webkit-tap-highlight-color: rgba(59, 130, 246, 0.3);
    }
  }
  ```

- [ ] **Test**: Touch device (real phone or Chrome DevTools)
- [ ] **Expected**: Add 30 lines (enhancement)

**Net change**: +50 lines (enhancements outweigh savings)

---

## Phase 6: Documentation & Cleanup (1 hour)

### 6.1 Add Section Comments

- [ ] Add comments for new utilities:
  ```css
  /* ===== UTILITY CLASSES ===== */
  /* Elevation utilities */
  /* Hover effects */
  /* Glow effects */
  /* Transitions */
  /* Grid layouts */
  ```

### 6.2 Remove Unused CSS

- [ ] Search codebase for unused classes:
  ```bash
  # Example: Check if .old-class is used anywhere
  grep -r "old-class" . --include="*.html" --include="*.js"
  ```
- [ ] Delete any confirmed unused classes
- [ ] **Expected**: Remove 50-100 lines

### 6.3 Update CLAUDE.md

- [ ] Document new utility classes
- [ ] Update CSS architecture section
- [ ] Note deprecated classes (if any)

---

## Final Testing Checklist

### Desktop (>1024px)

- [ ] **Homepage**: Layout identical to original screenshot
- [ ] **Calendar**: 1fr 500px grid, 90px day cells
- [ ] **Room indicators**: Exact same colors (blue, green, red)
- [ ] **Booking card**: Sticky positioning, glass effect
- [ ] **Buttons**: Hover lift + glow animations work
- [ ] **Modals**: All types render correctly
- [ ] **Navigation buttons**: 48x48px, black background

### Tablet (1024px - 768px)

- [ ] **Layout**: Responsive breakpoint transitions
- [ ] **Calendar**: 70px day cells
- [ ] **Room indicators**: 0.65rem font, readable
- [ ] **Forms**: Proper column layout

### Mobile (768px and below)

- [ ] **Touch targets**: All ≥44px (calendar days, buttons, room indicators)
- [ ] **Calendar**: Usable without pinch-zoom
- [ ] **Forms**: Full-width, large inputs
- [ ] **Modals**: Fullscreen
- [ ] **Navigation**: Buttons work on small screen

### Mobile Landscape

- [ ] **Modal**: Side-by-side layout
- [ ] **Calendar**: Uses available horizontal space
- [ ] **Forms**: Compressed vertical spacing

### Cross-Browser

- [ ] **Chrome Desktop**
- [ ] **Firefox Desktop**
- [ ] **Safari Desktop**
- [ ] **Edge Desktop**
- [ ] **Chrome Mobile** (DevTools or real device)
- [ ] **Safari iOS** (DevTools or real device)

---

## Post-Refactoring Metrics

### File Metrics

- [ ] **Line count**: `wc -l css/styles-unified.css`
  - Target: 3,400-3,600 lines (18-23% reduction from 4,406)
- [ ] **File size**: `wc -c css/styles-unified.css`
  - Target: ~110 KB (21% reduction from 140 KB)
- [ ] **Media queries**: `grep -c "@media" css/styles-unified.css`
  - Target: ≤10 blocks (44% reduction from 18)

### Code Quality

- [ ] **W3C Validation**: Passes CSS validator
- [ ] **Lighthouse Score**: CSS score ≥95 (from ~85)
- [ ] **Duplicate patterns**: Visual inspection shows <50 duplicates

### Visual Regression

- [ ] **Desktop screenshots**: Pixel-perfect match to originals
- [ ] **Mobile screenshots**: Improved touch targets
- [ ] **Animation tests**: All hover/active states work

---

## Rollback Plan (If Issues Found)

### Option 1: Git Rollback

```bash
git checkout css/styles-unified.css
```

### Option 2: Backup Restoration

```bash
cp css/styles-unified.backup-2025-10-17.css css/styles-unified.css
```

### Option 3: Incremental Rollback

- Revert one phase at a time (start with Phase 5, work backwards)
- Use git diff to see what changed
- Keep successful phases, revert problematic ones

---

## Success Criteria Summary

✅ **Desktop appearance**: 100% identical (pixel-perfect)
✅ **Mobile UX**: Improved (larger touch targets, landscape support)
✅ **File size**: Reduced by 21% (140 KB → 110 KB)
✅ **Lines**: Reduced by 18-23% (4,406 → 3,400-3,600)
✅ **Media queries**: Consolidated (18 → 10 blocks)
✅ **Duplicate patterns**: Eliminated (<50 from 330+)
✅ **Maintainability**: Significantly improved (utilities, organization)
✅ **W3C validation**: 100% pass
✅ **Cross-browser**: No regressions

---

## Timeline Estimate

| Phase             | Duration        | Expected Savings     | Risk Level |
| ----------------- | --------------- | -------------------- | ---------- |
| **Quick Wins**    | 30 min          | 10 lines             | Low ✅     |
| **Utilities**     | 2 hours         | 80-100 lines         | Low ✅     |
| **Media Queries** | 3 hours         | 100-150 lines        | Low ✅     |
| **Components**    | 4 hours         | 150-200 lines        | Medium ⚠️  |
| **Mobile UX**     | 3 hours         | +50 lines (enhanced) | Low ✅     |
| **Documentation** | 1 hour          | 50-100 lines         | Low ✅     |
| **Testing**       | 4 hours         | -                    | -          |
| **TOTAL**         | **16-17 hours** | **800-1000 lines**   | Mixed      |

---

**Prepared**: 2025-10-17
**Status**: Ready for implementation
**Recommended approach**: Incremental (one phase at a time with testing)
