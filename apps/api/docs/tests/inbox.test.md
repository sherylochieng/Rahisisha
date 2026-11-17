# inbox.test.js: Proof The Inbox Is Right

**File:** `apps/api/tests/inbox.test.js`
**Doc:** `apps/api/docs/tests/inbox.test.md`
**Added:** Week 29 Day 4
**Run:** `npm test -- tests/inbox` (16 checks)

---

## WHY THIS FILE EXISTS

Proves `GET /v1/inbox` merges WhatsApp and USSD, sorts newest first, pages without losing or repeating a row, never shows another shop's rows, and that a USSD dial is logged.

## WHY IMPORTANT

Paging bugs are silent: nothing crashes, a message just vanishes. Only a test that walks every page can catch it.

## DANGER

- Timestamps are FIXED so the expected order is known. Includes a tie (same second) and two rows 0.000356s apart (they differ only in microseconds).
- Teardown deletes everything it created. Keep that when adding checks.
- It was mutation-tested: removing the ORDER BY, a millisecond cursor, a date-only cursor and including outbound messages each make it FAIL.

## WHAT IT SOLVES

15+1 checks: 401 without login; merged newest-first; exact row shape; outbound excluded; paging by 1, 2 and 3 equals the unpaged list; a page ending on the microsecond row loses nothing; `nextCursor` only when more exist; junk/zero/huge limit; bad cursor = 400; shop isolation (both directions, and a shop A cursor used by shop B); empty shop; USSD dial logged; no phone = still a menu; unknown service code logs nothing.

## SYSTEM DESIGN PRINCIPLE

Test the property ("walking every page equals the whole list"), not just one example.

## RULES

1. Self-seeding with throw-away shops.
2. Fixed times, never `now()`.
3. Every check has a reason in its name.

## PRACTICAL EXAMPLE

Check 6b: with `limit=3` page one ends exactly on `ussd-micro`; if the cursor rounded to milliseconds, `ussd-micro-older` would be skipped and the check fails.

## TRADEOFFS

+ Fast (about 0.5 s), no network.
- Uses the real database, so it needs `DATABASE_URL` and the schema with migration 026.

## PIECE BY PIECE (simple words, real-life examples)

### Setup (`beforeAll`)

Creates shops A, B and an empty one, seeds A with 9 inbox rows plus one outbound message that must NOT show, and gives B two secret rows.

### `walk(limit)`

Follows `nextCursor` until it is null and collects every row. Real life: turning every page of the register and writing down every entry.

### Checks 1-4

Login, order, shape, outbound excluded.

### Checks 5-8

Paging: page sizes 1, 2, 3, `nextCursor` presence, limit rules.

### Checks 9-12

Bad cursor, isolation, empty shop, cross-shop cursor.

### Checks 13-15

The USSD dial really lands in the inbox; no phone = no log but a menu; unknown code logs nothing.

### Teardown

Deletes rows and the throw-away shops.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*
