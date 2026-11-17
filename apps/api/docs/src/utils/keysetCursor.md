# keysetCursor.js: The Bookmark Maker

**File:** `apps/api/src/utils/keysetCursor.js`
**Doc:** `apps/api/docs/src/utils/keysetCursor.md`
**Added:** Week 29 Day 4

---

## WHY THIS FILE EXISTS

The inbox and the wallet list both page newest-first with a bookmark (cursor). The bookmark rules live here once.

## WHY IMPORTANT

A wrong bookmark means the owner misses or re-reads a message or a payment.

## DANGER

- Keep MICROSECONDS. A JavaScript Date only has milliseconds; rounding the time makes rows get skipped. The time is turned into text inside Postgres (`CURSOR_TS_SQL`) and sent back unchanged. A test proves this.
- The cursor comes from the caller: `decodeCursor` accepts only the exact shape (time text + real UUID). Anything else returns `null` and the controller answers 400.
- Never paste a cursor into SQL text; it is always a `$1/$2` parameter.

## WHAT IT SOLVES

`encodeCursor`, `decodeCursor` and the SQL snippet `CURSOR_TS_SQL(column)`.

## SYSTEM DESIGN PRINCIPLE

Keyset paging: "give me rows older than THIS row". Fast on page 500 and stable while new rows arrive (unlike OFFSET).

## RULES

1. Compare the PAIR (created_at, id).
2. Cursor = base64url(`<UTC time with 6 decimals>|<uuid>`).
3. Invalid cursor is the caller's mistake: 400, never a crash.

## PRACTICAL EXAMPLE

Page 1 ends at a message sent 10:04:00.123456. The cursor stores exactly that. Page 2 asks for rows strictly older than that time/id pair.

## TRADEOFFS

+ Opaque, safe, shared.
- Only forward (older) paging. Not signed: a user can craft a cursor, but it only ever moves within their own shop's rows (RLS).

## PIECE BY PIECE (simple words, real-life examples)

### `UUID_RE` and `TS_RE`

The two shapes a cursor must have. Real life: a ticket stub must have the right serial format before the usher lets you through.

### `CURSOR_TS_SQL(column)`

Returns the SQL that formats a time as `2026-01-01T10:04:00.123456Z`. The `column` is OUR constant, never user input.

### `decodeCursor(raw)`

Unwraps the bookmark and checks both parts. Returns `{ ts, id }` or `null`.

### `encodeCursor(ts, id)`

Wraps time and id into one URL-safe string.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*
