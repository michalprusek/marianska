---
argument-hint: [error description | feature request | browser console log]
description: Comprehensive booking system debugging and feature implementation
allowed-tools: Bash, Read, Edit, MultiEdit, Write, Grep, Glob, WebSearch, Task, TodoWrite
---

# Comprehensive Booking System Debugging & Implementation

## Request Context
**User request:** $ARGUMENTS

## System Context Collection

### Current Server Status
!`lsof -i :3000 | grep LISTEN || echo "Server not running on port 3000"`

### Check Node Process
!`ps aux | grep node | grep -E "server.js|dev" | head -5 || echo "No Node.js process found"`

### Backend Logs (if available)
!`[ -f logs/server.log ] && tail -50 logs/server.log || echo "No server logs found"`

### Data Storage Check
!`[ -f data/bookings.json ] && echo "Bookings file exists: $(wc -l < data/bookings.json) lines" || echo "Bookings file missing"`
!`[ -f data/bookings.json ] && head -5 data/bookings.json | python3 -m json.tool 2>&1 | head -20 || echo "Unable to parse bookings"`

### Git Status
!`git status --short | head -10`

### Recent Changes
!`git log --oneline -5`

### Environment Check
!`[ -f .env ] && echo ".env file exists" || echo ".env file missing"`
!`[ -f package.json ] && npm ls 2>&1 | grep -E "UNMET|missing" | head -5 || echo "Dependencies OK"`

### Browser LocalStorage Check (manual instruction)
**📋 Browser Console Check**: Please run this in browser console if relevant:
```javascript
const data = localStorage.getItem('chataMarianska');
if (data) {
  const parsed = JSON.parse(data);
  console.log('LocalStorage data:', {
    bookings: parsed.bookings?.length || 0,
    blockedDates: parsed.blockedDates?.length || 0,
    hasSettings: !!parsed.settings
  });
} else {
  console.log('No LocalStorage data found');
}
```

## Your Mission

You are an expert debugging engineer for the Mariánská booking system. Your goal is to systematically diagnose and fix reported errors or implement new features using a sophisticated two-phase approach.

---

# PHASE 1: COMPREHENSIVE CONTEXT GATHERING

## Step 1: Initial Analysis
Create a TodoWrite task list for the debugging/implementation phases based on the request type.

## Step 2: Deploy Specialized Context Agents (IN PARALLEL)

**CRITICAL**: Launch multiple agents simultaneously for maximum efficiency. Based on the request, deploy:

### Core Analysis Agents (always use):
- **booking-context-gatherer**: Analyze booking system architecture and data flow
- **ssot-analyzer**: Identify reusable patterns and components in the codebase

### Specialized Debugging Agents (choose based on error):

#### Frontend Issues:
- **calendar-debugger**: Calendar rendering, date selection, room availability display
- **form-validator**: Form validation, step navigation, field requirements
- **ui-state-debugger**: State management, LocalStorage sync, data persistence

#### Backend Issues:
- **api-debugger**: Express endpoints, request/response handling, CORS
- **data-integrity**: Booking conflicts, data consistency, JSON structure
- **storage-debugger**: File system operations, LocalStorage fallback

#### Business Logic Issues:
- **pricing-calculator**: Price calculation, guest types, room types
- **availability-checker**: Room conflicts, date overlaps, blockages
- **christmas-validator**: Christmas period logic, access codes

#### Admin Issues:
- **admin-auth**: Authentication, session management, password handling
- **admin-operations**: CRUD operations, bulk actions, data export

### Example Parallel Launch for Booking Conflict Error:
```
Use Task tool with multiple subagents:
1. booking-context-gatherer: "Analyze complete booking creation flow from calendar selection through data storage, focusing on conflict detection logic"
2. availability-checker: "Investigate getRoomAvailability() function and how it checks for overlapping bookings in data.js"
3. data-integrity: "Check for race conditions in concurrent booking creation and LocalStorage/server sync issues"
4. ssot-analyzer: "Find existing conflict resolution patterns and validation utilities in the codebase"
```

## Step 3: Consolidate Findings

1. Review all agent reports
2. Map the complete error flow
3. Identify all affected components
4. Document existing patterns that can be reused

---

# PHASE 2: SOPHISTICATED FIX IMPLEMENTATION

## Step 1: Solution Design

Based on Phase 1 findings, design a solution that:
- Addresses root causes, not symptoms
- Follows existing code patterns (DataManager patterns, validation utils)
- Maintains dual storage mode (server + LocalStorage)
- Preserves all business rules

## Step 2: Deploy Implementation Agents (IN PARALLEL)

### Primary Implementation:
- **booking-feature-implementor**: Comprehensive fixes spanning multiple components
  - Provide complete implementation plan
  - Include all touchpoints from context gathering
  - Specify patterns to follow from utils.js and validationUtils.js

### Supporting Implementation Agents:
- **test-generator**: Create tests for the fix
- **validation-enhancer**: Strengthen input validation
- **translation-updater**: Update translations.js if UI messages change

### Example Implementation:
```
Deploy with Task tool:
1. test-generator: "Create tests for booking conflict resolution"
2. booking-feature-implementor: "Implement fix following DataManager patterns"
3. validation-enhancer: "Add client and server-side validation"
```

## Step 3: Verification Phase

1. Test booking creation flow
2. Verify calendar updates correctly
3. Check admin panel functionality
4. Confirm LocalStorage sync
5. Test edge cases (Christmas period, room capacity)

## Step 4: Knowledge Documentation

Document the solution:
1. Update CLAUDE.md with new patterns
2. Add inline comments for complex logic
3. Document any new business rules

---

## Critical Implementation Guidelines

### Data Management Rules:
1. **Always use DataManager methods** - Never directly modify localStorage
2. **Maintain data structure** - Preserve all required fields
3. **Generate proper IDs** - Use DataManager.generateId() for bookings
4. **Include edit tokens** - Every booking needs an editToken

### Validation Requirements:
1. **Client-side first** - Validate in browser before submission
2. **Server-side verification** - Re-validate on backend
3. **Use validation utils** - Leverage shared/validationUtils.js
4. **User-friendly errors** - Clear, actionable error messages

### Business Logic Preservation:
1. **Christmas period** - Special rules December 23 - January 2
2. **Guest types** - ÚTIA employees vs external guests pricing
3. **Room capacity** - Respect bed limits
4. **Booking conflicts** - No double-booking allowed

### Code Organization:
```
/js/
  booking-app.js      - Main orchestrator
  calendar.js         - Calendar logic
  booking-form.js     - Form handling
  utils.js           - Shared utilities
  /shared/
    validationUtils.js - Validation functions
/admin.html          - Admin interface
/server.js           - Express backend
/data.js            - DataManager class
```

---

## Expected Deliverables

### After Phase 1:
1. **Complete Context Map**: All components involved
2. **Root Cause Analysis**: Why the issue occurred
3. **Pattern Inventory**: Reusable code patterns identified
4. **Risk Assessment**: Potential side effects

### After Phase 2:
1. **Implementation Summary**: What was changed and why
2. **Test Results**: Verification of the fix
3. **Integration Check**: All components working together
4. **Documentation**: Updated comments and CLAUDE.md

---

## Quick Reference

### Common Issues & Solutions:

**Calendar not updating:**
- Check updateCalendar() in calendar.js
- Verify data refresh after booking
- Check event listener registration

**Validation failing:**
- Review validationUtils.js patterns
- Check both client and server validation
- Verify regex patterns for phone/email

**Price calculation wrong:**
- Check calculatePrice() in DataManager
- Verify guest type detection
- Review room type classification

**Admin access issues:**
- Check session storage for auth
- Verify password in settings
- Review admin.js authentication flow

**Data not persisting:**
- Check server endpoint availability
- Verify LocalStorage fallback
- Review save/load data flow

---

Remember: The booking system has a sophisticated dual-storage architecture. Always consider both server persistence and LocalStorage fallback in your solutions!