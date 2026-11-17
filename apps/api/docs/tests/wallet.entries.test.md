# wallet.entries.test.js: Proof The Payments List Is Right

**File:** `apps/api/tests/wallet.entries.test.js`
**Doc:** `apps/api/docs/tests/wallet.entries.test.md`
**Added:** Week 29 Day 4
**Run:** `npm test -- tests/wallet.entries` (11 checks)

---

## WHY THIS FILE EXISTS

Proves `GET /v1/wallet/entries`: Nairobi days, day totals, a correct running balance on every page, shop isolation, read-only.

## WHY IMPORTANT

It is the owner's money view. A wrong total is worse than no page.

## DANGER

- One entry is at 21:30 UTC on 1 Jan, which is 00:30 on 2 Jan in Nairobi, to prove days are Nairobi days.
- Two entries share a timestamp to prove the id tie-break.
- Mutation-tested: using UTC days, or computing totals after paging, each make it fail.
- It only READS through the API; the seed writes ledger rows directly in the test's own throw-away shops.

## WHAT IT SOLVES

401; newest first with the agreed fields; Nairobi day grouping; day totals; running total after each row; newest running total equals the dashboard balance; paging by 1, 2 and 4 keeps ids, balances AND day totals identical; shop isolation; empty shop; bad cursor and limit rules; POST/PUT/DELETE are 404.

## SYSTEM DESIGN PRINCIPLE

Cross-check two independent calculations (the dashboard balance and the ledger running total) must agree.

## RULES

Fixed times, throw-away shops, full teardown.

## PRACTICAL EXAMPLE

Ledger +1000, +500, -200, +300, -100, +700 gives a final balance of 2,200.00 on the newest row.

## TRADEOFFS

+ Fast, deterministic.
- Does not cover a ledger with thousands of rows (performance).

## PIECE BY PIECE (simple words, real-life examples)

### Ledger table

`LEDGER_A` lists amount, reason and UTC time for each seeded entry.

### Check 3

Finds each amount in the response and asserts its `day`.

### Check 5

Walks oldest to newest adding amounts and compares to `balanceAfterCents`. Real life: re-adding a passbook by hand.

### Check 6

Compares with `/v1/dashboard` `balanceCents`.

### Check 7

Walks pages of 1, 2 and 4 and compares everything to the full list.

### Check 11

Tries to write to the endpoint and expects 404.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*
