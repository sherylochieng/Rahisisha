# wallet.controller.js: The Payments List

**File:** `apps/api/src/controllers/wallet.controller.js`
**Doc:** `apps/api/docs/src/controllers/wallet.controller.md`
**Added:** Week 29 Day 4
**Route:** `GET /v1/wallet/entries?limit=50&cursor=...` (`apps/api/src/routes/wallet.routes.js`)
**Used by:** `apps/web/src/app/(authed)/payments/page.js`

---

## WHY THIS FILE EXISTS

The Payments page needs the shop's `wallet_entries`, newest first, with the Nairobi day, the day's total and a running balance on every row.

## WHY IMPORTANT

It shows the owner their money. A wrong running total is a wrong balance.

## DANGER

- Totals are computed over the WHOLE ledger BEFORE the page is cut. If computed per page, page 2 would restart from zero.
- Days are Nairobi days; the day goes out as TEXT `YYYY-MM-DD` (a JS Date would shift it).
- Cents are integers; `SUM()` comes back as text from Postgres and is converted with `Number`.
- Read only. The ledger is append-only; nothing here writes.
- `req.db` only; RLS filters the ledger.

## WHAT IT SOLVES

Rows: `{ id, amountCents, reason, reference, createdAt, day, dayTotalCents, balanceAfterCents }`.

## SYSTEM DESIGN PRINCIPLE

Group in the page, calculate in the database. Window functions give correct running totals regardless of paging.

## RULES

1. Inner query computes, outer query pages.
2. Nairobi day, not UTC.
3. Newest `balanceAfterCents` equals the dashboard balance (a test checks it).
4. Bad cursor = 400.

## PRACTICAL EXAMPLE

+1,500.00, +800.00, -200.00 give balances 1,500.00, 2,300.00, 2,100.00. The 21:30 UTC entry belongs to the NEXT Nairobi day.

## WHERE USED / FUTURE USES

The Payments page. Future: CSV export (stretch), filter by reason or date.

## TRADEOFFS

+ Correct on every page, no client maths.
- Window functions read the shop's whole ledger per request: fine for small shops, a stored daily summary would be next for large ones.
- Only "older" paging.

## PIECE BY PIECE (simple words, real-life examples)

### `NAIROBI_DAY`

`(created_at AT TIME ZONE 'Africa/Nairobi')::date`: which calendar day the entry belongs to in the owner's timezone.

### `SUM(...) OVER (PARTITION BY day)`

Adds up the whole day, so every entry of that day carries the same day total. Real life: the "net for the day" line at the bottom of a statement day.

### `SUM(...) OVER (ORDER BY created_at, id)`

Adds up from the very first entry to this one: the balance right after it. Real life: the balance column in a passbook.

### Outer `WHERE` + `ORDER BY` + `LIMIT`

The cursor filter and one page, applied AFTER the totals exist.

### `data.map(...)`

`Number()` for the totals, camelCase names.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*
