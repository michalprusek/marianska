# Proposed Bookings System - Documentation Index

This directory contains comprehensive documentation about the proposed bookings system in the Mariánská booking application.

## Documents

### 1. PROPOSED_BOOKINGS_SUMMARY.txt (Quick Reference)

**Best for**: Quick lookups, debugging, understanding the big picture  
**Contains**:

- What proposed bookings are
- Key timeline of events
- Creation/deletion points
- Display/refresh mechanisms
- Performance metrics
- File locations
- Debugging checklist

**Read this first if**: You need a quick understanding of the system

---

### 2. PROPOSED_BOOKINGS_ANALYSIS.md (Complete Analysis)

**Best for**: Deep understanding, architecture review, implementation details  
**Contains**:

- Complete overview (Section 1)
- Where proposed bookings are created - client/server/database (Section 2)
- How 15-minute expiration works (Section 3)
- Where proposed bookings are displayed in UI (Section 4)
- Cleanup and deletion mechanisms (Section 5)
- Calendar refresh triggers and debouncing (Section 6)
- Complete flow diagram (Section 7)
- Key architectural principles (Section 8)
- Monitoring and debugging (Section 9)
- Summary table (Section 10)

**Read this when**: You need to understand the entire system or modify core functionality

---

### 3. PROPOSED_BOOKINGS_CODE_FLOW.md (Code-Level Details)

**Best for**: Developers, code modifications, step-by-step execution flow  
**Contains**:

- Detailed code paths for creation flow (Section 1)
- Checking/blocking flow with actual code (Section 2)
- Expiration & cleanup implementation (Section 3)
- Deletion flow with exact line numbers (Section 4)
- Cache synchronization details (Section 5)
- Session isolation mechanism (Section 6)
- Complete sequence diagram (Section 7)
- Error handling and edge cases (Section 8)
- SQL debugging queries (Section 9)

**Read this when**: You're making code changes or debugging specific issues

---

## Quick Navigation

### I want to understand...

**"What is a proposed booking?"**
→ Read: PROPOSED_BOOKINGS_SUMMARY.txt (first 2 sections)

**"How does the 15-minute timer work?"**
→ Read: PROPOSED_BOOKINGS_ANALYSIS.md (Section 2) + PROPOSED_BOOKINGS_CODE_FLOW.md (Section 3)

**"Where does it create proposed bookings?"**
→ Read: PROPOSED_BOOKINGS_CODE_FLOW.md (Section 1)

**"Why do I see YELLOW cells on the calendar?"**
→ Read: PROPOSED_BOOKINGS_ANALYSIS.md (Section 3) + PROPOSED_BOOKINGS_CODE_FLOW.md (Section 2)

**"How does cleanup work?"**
→ Read: PROPOSED_BOOKINGS_ANALYSIS.md (Section 4) + PROPOSED_BOOKINGS_CODE_FLOW.md (Section 3)

**"Why doesn't the calendar update immediately?"**
→ Read: PROPOSED_BOOKINGS_ANALYSIS.md (Section 5) + PROPOSED_BOOKINGS_CODE_FLOW.md (Section 5)

**"How can I debug proposed bookings?"**
→ Read: PROPOSED_BOOKINGS_SUMMARY.txt (Debugging Checklist) + PROPOSED_BOOKINGS_CODE_FLOW.md (Section 9)

**"What happens when User A and User B book the same room?"**
→ Read: PROPOSED_BOOKINGS_ANALYSIS.md (Section 6) + PROPOSED_BOOKINGS_CODE_FLOW.md (Section 7)

**"I need to modify the expiration time from 15 to 20 minutes"**
→ Read: PROPOSED*BOOKINGS_CODE_FLOW.md (Section 3) + look for "15 * 60 \_ 1000"

**"How does session isolation work?"**
→ Read: PROPOSED_BOOKINGS_CODE_FLOW.md (Section 6) + PROPOSED_BOOKINGS_ANALYSIS.md (Section 7.1)

---

## Key Files Referenced

### Client-Side

- `/data.js` - DataManager.createProposedBooking(), deleteProposedBooking()
- `/js/booking-form.js` - Form submission, proposed booking deletion
- `/js/shared/BaseCalendar.js` - Calendar rendering with YELLOW cells
- `/js/booking-app.js` - Temporary reservations display

### Server-Side

- `/server.js` - API endpoints, cleanup interval
- `/database.js` - Database operations, expiration logic

### Database Tables

- `proposed_bookings` - Main table with expiration timestamp
- `proposed_booking_rooms` - Room associations

---

## Critical Concepts

### Session ID

Every user gets a unique session ID (stored in sessionStorage per browser tab). One proposed booking per session at a time.

### Expiration Timestamp

Calculated at creation: `NOW + 15 minutes`. Used in availability checks (`expires_at > NOW`).

### YELLOW Cell Indicator

Calendar shows YELLOW for proposed rooms. RED for booked, GREEN for available.

### Debouncing

Calendar only re-renders max once per 10 seconds to prevent excessive updates.

### Inclusive Date Model

Proposed booking 2025-10-06 to 2025-10-08 blocks all three days (including checkout day).

---

## Architecture Decisions

1. **Database-Backed**: Proposed bookings persist in SQLite (survive server restart)
2. **Session Isolation**: Prevents same user from blocking themselves
3. **TTL-Based Cleanup**: Auto-expiration after 15 minutes, cleaned every 60 seconds
4. **Client-Side Caching**: 30-second cache prevents rate limiting
5. **Debounced UI Updates**: Prevents 100+ calendar re-renders per second

---

## Performance Characteristics

| Operation          | Time       | Notes                           |
| ------------------ | ---------- | ------------------------------- |
| Create proposal    | < 100ms    | Database transaction            |
| Delete proposal    | < 50ms     | Single delete query             |
| Availability check | < 200ms    | Includes proposed_bookings join |
| Calendar render    | < 500ms    | Even with 100+ proposals        |
| Auto-sync interval | 30 seconds | Client syncs with server        |
| Cleanup interval   | 60 seconds | Server removes expired          |
| Cache TTL          | 30 seconds | Client-side cache validity      |
| Debounce throttle  | 10 seconds | Min between renders             |

---

## Troubleshooting Quick Links

| Problem               | Solution                                        | Documentation            |
| --------------------- | ----------------------------------------------- | ------------------------ |
| Calendar not updating | Check sync interval (30s), debouncing (10s min) | Section 5, ANALYSIS.md   |
| Rooms stuck YELLOW    | Check cleanup logs, database expiration         | Section 4, ANALYSIS.md   |
| Race condition issues | Review session isolation, test concurrent       | Section 7.5, ANALYSIS.md |
| Performance problems  | Check cache TTL, debounce settings              | Section 7.4, ANALYSIS.md |
| Orphaned proposals    | Check cleanup implementation, safety net        | Section 8, CODE_FLOW.md  |

---

## For Developers

### Adding Logging

Look at `/server.js:2024` for cleanup logging pattern:

```javascript
logger.info(`Cleaned up ${result.changes} expired proposed bookings`);
```

### Modifying Expiration Time

Edit `/database.js:1591`:

```javascript
const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                                               ^^^^^^ - Change this (in milliseconds)
```

### Adding New Cache

Follow pattern in `/data.js:1050-1094`:

- Check timestamp validity
- Reuse in-flight promise
- Set cache + timestamp

### Database Queries

See `/database.js` prepared statements (lines 465-478):

```javascript
statements: {
  insertProposedBooking: this.db.prepare(`...`),
  deleteProposedBooking: this.db.prepare(`...`),
  // etc.
}
```

---

## Related Documentation

See `/CLAUDE.md`:

- "Night-Based Availability Model" - How proposed integrate with availability
- "Dual Storage Mode" - Database vs LocalStorage fallback
- "SSOT (Single Source of Truth)" - Architectural principles

---

## Summary

The proposed bookings system is a **temporary hold mechanism** that:

1. Creates a 15-minute temporary reservation when user selects dates/rooms
2. Displays it as YELLOW on calendar (blocking other users)
3. Automatically expires and cleans up if user doesn't complete booking
4. Converts to permanent booking if user submits form
5. Uses session IDs to isolate users and prevent self-blocking

All three documents complement each other:

- **SUMMARY** = Overview and quick reference
- **ANALYSIS** = Complete architectural understanding
- **CODE_FLOW** = Implementation details and debugging

**Start with SUMMARY, then read ANALYSIS or CODE_FLOW depending on your needs.**
