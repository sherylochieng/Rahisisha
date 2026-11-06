# Guide: wallet.service.test.js

**Code file:** `apps/api/tests/wallet.service.test.js`
**Tests:** `apps/api/src/services/wallet.service.js`
**Added:** Week 28 Day 4
**Run it:** `cd apps/api` then `npm test -- tests/wallet.service.test.js`
**Expected:** `Tests: 16 passed, 16 total`

---

## WHY THIS FILE EXISTS

The wallet holds each shop's money. A bug here is not a display problem, it is wrong money. This test proves the three wallet functions (`credit`, `debit`, `balance`) behave, and that bad input is refused **before** anything is written.

## WHY IMPORTANT

- Money errors are silent. A wrong balance may not be noticed for weeks.
- The wallet is an **append-only ledger**: rows are never edited. A wrong row cannot be fixed by an update, so it must never be written in the first place.

## DANGER (if this test does not exist)

- A zero or negative credit slips in and quietly reduces a balance.
- A refused credit still leaves a half-written row behind.
- `balance` returns text instead of a number, and the dashboard shows `"500200"` instead of `700`.
- A new reason such as `'gift'` is accepted, and the books no longer add up by category.

## THE IDEA IN ONE PICTURE

```
   wallet_entries (append only, never edited)
   +500   sale
   -200   refund        <- debit is stored as a NEGATIVE number
   ------
   balance = SUM = 300  <- never stored, always added up
```

Why no stored balance? A stored number can drift away from the truth. A sum of the rows cannot.

## WHAT THE 16 TESTS CHECK

| Group | Tests | What it proves |
|---|---|---|
| Normal use | 3 | Credit of 500 adds +500; debit of 200 adds -200; credit then debit gives +300 |
| Bad amounts, credit | 5 | Each kind of bad amount is refused by `credit` |
| Bad amounts, debit | 5 | The same five are refused by `debit` |
| Refusal leaves no trace | 1 | A refused credit writes **nothing** |
| Balance type | 1 | `balance` returns a real number, not text |
| Unknown reason | 1 | A reason like `'gift'` is refused by the database `CHECK` |

The five bad amounts: **YOU FILL** (copy the list from the `describe.each` or array at the top of the test file).

## HOW THE CODE WORKS

1. **Own `Pool`** as `rahisisha_user`, so RLS applies exactly like the real app.
2. **`BEGIN`** once. Everything is a rehearsal and is undone with `ROLLBACK`.
3. **`SAVEPOINT` per test.** A refused call raises an error, and an error cancels the whole transaction. Each test marks a savepoint first and returns to it afterwards, so one refusal does not break the next test.
4. **`set_config(..., true)`** stamps the shop on the connection. `true` is correct because a transaction is open.
5. **Check, then count.** For the "no trace" test, count the rows before and after the refused call and expect them to match.

## RULES

- Amounts are **integer cents** (KES 350 = 35000), never floats.
- `credit` adds a positive amount. `debit` stores the amount as **negative**.
- Validate **before** writing, so a refusal leaves nothing behind.
- Rows are never updated or deleted.

## PRACTICAL EXAMPLES

- A shop sells a dress for KES 1,500: `credit(db, 150000, 'sale', receiptCode)`.
- The shop refunds KES 200: `debit(db, 20000, 'refund', orderId)`.
- The dashboard asks `balance(db)` and divides by 100 to show KES.

## DECISIONS

- A ledger of rows instead of a balance column (sums cannot drift).
- The function validates, and the database `CHECK` is the second lock for `reason`.
- One transaction with `ROLLBACK`, so no test money is left in the database.

## WHERE YOU WILL USE THIS

Any project that handles money, points, credits or stock: wallets, loyalty points, inventory counts. Same pattern: append rows, add them up, refuse bad input first.

## TRADEOFFS

- Always correct and easy to audit.
- `balance` adds up every row, which gets slower with millions of rows. A cached total would be a future optimisation, and it would have to be checked against the sum.

## RELATED

- `docs/src/services/wallet.service.md` (the code being tested)
- `docs/src/controllers/dashboard.controller.md` (uses `balance`)