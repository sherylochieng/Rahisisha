# payments/page.js: The Payments Screen

**File:** `apps/web/src/app/(authed)/payments/page.js`
**Doc:** `apps/web/docs/src/app/payments.page.md`
**Added:** Week 29 Day 4
**Next to it:** `payments/loading.js`
**Calls:** `GET /v1/wallet/entries` through `serverGetPage`

---

## WHY THIS FILE EXISTS

Shows the wallet ledger grouped by Nairobi day, with a day total and a running balance on every entry.

## WHY IMPORTANT

It is the owner's money record.

## DANGER

- Server Component; data only via `serverGetPage`.
- Money is whole cents; formatting only for display; totals come from the database, never computed in the page.
- Read only: no buttons that change money.
- A day split across pages shows its header on both pages, with the same whole-day total.
- API failure throws.

## WHAT IT SOLVES

`/payments` shows the 50 newest entries as one card per day; an empty state when there are none; older pages via a link.

## SYSTEM DESIGN PRINCIPLE

Group in the page, calculate in the database.

## RULES

1. Nairobi days.
2. Money in green with +, out red with -.
3. Balance after each row.
4. Wraps on phones (no wide table).

## PRACTICAL EXAMPLE

Fri, 13 Nov 2026 / Day total +KES 1,500.00 / Sale QGH7XYZ123 +KES 1,500.00 Balance KES 1,500.00.

## TRADEOFFS

+ No client JavaScript. - Older-only paging; CSV export and filters not built.

## PIECE BY PIECE (simple words, real-life examples)

### `REASONS`

Friendly words for the four ledger reasons.

### `groupByDay`

One pass over newest-first rows: start a new card whenever the day changes. Real life: sorting receipts into one envelope per day.

### Balance card

Shown only on the first page, where the newest row's balance IS the wallet balance now.

### Day header

The date on the left, the day total on the right.

### Entry row

Reason and reference on the left, signed amount and balance on the right.

### Empty state

`No payments yet.` with a hint.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*
