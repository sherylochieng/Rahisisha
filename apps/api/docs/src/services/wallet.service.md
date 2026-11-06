# Guide: wallet.service.js

**Code file:** `apps/api/src/services/wallet.service.js`
**Moved from:** `src/wallet/wallet.js` (Week 28 Day 5, commit `5021d36`)
**Tested by:** `tests/wallet.service.test.js` (16 tests), see `docs/tests/wallet.service.test.md`
**Used by:** `dashboard.controller.js` (`balance`). `credit` and `debit` will be used by the M-Pesa webhook in Week 29.

---

## WHY THIS FILE EXISTS

Every wallet money movement goes through three small helpers, so the money rules live in **one** place instead of being copied into many controllers.

## WHY IMPORTANT

Money bugs hurt real people. One small, careful file is far easier to check and audit than the same code repeated.

## DANGER (if this file does not exist)

- Each controller writes its own wallet SQL. One forgets the whole-number check, and a decimal corrupts the balance.
- One forgets the tenant, and the money lands in no shop's wallet.
- Someone adds an UPDATE "to fix a balance", and the history can no longer be trusted.
- Nobody can audit "every line that touches `wallet_entries`".

## THE IDEA: a notebook where you only write, never erase

```
 wallet_entries (append only)
 ┌────────┬──────────────┬────────────┐
 │ +350000│ sale         │ QGH7XYZ123 │   credit(db, 350000, 'sale', ...)
 │ -350000│ refund       │ QGH7XYZ123 │   debit(db, 350000, 'refund', ...)
 │  -17500│ commission   │ order-id   │   debit(db, 17500, 'commission', ...)
 └────────┴──────────────┴────────────┘
 balance(db) = add every line = 0 - 17500 + ... (never stored)
```

A shopkeeper's notebook: you never rub out a line. If you made a mistake, you write a new line that fixes it. The total is always the sum of the lines, so the total can never disagree with the lines.

## THE THREE FUNCTIONS

| Function | What it does | Stored as |
|---|---|---|
| `credit(db, amountCents, reason, reference)` | Adds money | A **positive** line |
| `debit(db, amountCents, reason, reference)` | Removes money | A **negative** line (the caller passes a positive number) |
| `balance(db)` | Adds all lines up | Not stored, always calculated |

### The inputs

- `db` is `req.db`, the connection where the shop is already stamped. Never use the plain `pool`.
- `amountCents` is a **whole number of cents**. KES 350 = 35000. Never floats.
- `reason` is one of `sale`, `refund`, `commission`, `payout` (checked by the database).
- `reference` is optional: a receipt code or an order id.

## LINE BY LINE

### `credit`
1. `if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('invalid')`
   Refuses decimals, text, zero and negatives **before anything is written**. A refused call leaves no trace.
2. `INSERT INTO wallet_entries (...) VALUES (current_setting('app.current_tenant', TRUE)::uuid, $1, $2, $3)`
   The shop id comes from the **connection**, not from the caller. A caller can never name another shop's id. If no shop is stamped, the insert fails.
3. `[amountCents, reason, reference]` are passed as `$1, $2, $3`, never glued into the SQL text. This stops SQL injection.

### `debit`
Identical, except for one thing: `[-amountCents, ...]`. The caller says "remove 200", and the line is stored as `-200`.

### `balance`
1. `SELECT COALESCE(SUM(amount_cents), 0) AS balance FROM wallet_entries`
   `SUM` adds the lines. RLS hides other shops' lines, so only this shop's are added. `COALESCE(..., 0)` turns "no lines yet" into `0` instead of nothing.
2. `return Number(rows[0].balance)`
   Postgres returns a `SUM` of bigint as **text** (for example `"500"`). Without `Number(...)`, adding two balances would glue them together as `"500200"`. The conversion is safe for any realistic wallet size.

## RULES

- Amounts are whole cents. Never floats.
- Only ever **add** lines. Never UPDATE or DELETE `wallet_entries`.
- Always pass `req.db`, never `pool`.
- Validate the amount before writing.
- The reason must be one of the four allowed values.

## PRACTICAL EXAMPLES

```js
// M-Pesa payment arrives (Week 29 webhook):
await credit(req.db, 350000, 'sale', 'QGH7XYZ123');

// Owner refunds a customer:
await debit(req.db, 350000, 'refund', 'QGH7XYZ123');

// Platform takes its cut:
await debit(req.db, 17500, 'commission', orderId);

// Dashboard shows "Wallet: KES 3,325":
const cents = await balance(req.db);   // 332500
res.json({ data: { balanceCents: cents }, error: null });
```

## DECISIONS

- A ledger of rows instead of a balance column, so the balance cannot drift.
- Three tiny functions in one file, so the rules are written once.
- `debit` takes a positive number and stores it negative, so callers never mix up signs.
- The tenant comes from the connection, so no caller can pick another shop.
- The file lives in `services/`, not `wallet/`, because it holds business logic that several controllers will share.

## WHERE YOU WILL USE THIS

Any wallet, loyalty points, store credit, prepaid minutes, subscription credits, or a chama (savings group) balance.

## TRADEOFFS

- Complete history, nothing is ever lost.
- `SUM` gets slower as lines grow. The fix later is periodic snapshots.
- `debit` does not yet stop a balance going below zero. Stopping it needs a lock, because two debits at the same moment could both pass the check.
- Every refusal throws the same message, `'invalid'`, so a caller cannot tell **why** an amount was refused. Fine for now, but worth improving when users see the error.

## RELATED

- `docs/tests/wallet.service.test.md` (the tests)
- `docs/src/controllers/dashboard.controller.md` (uses `balance`)
- `sql/SCHEMA.sql`, table `wallet_entries` (the `reason` CHECK and the RLS rule)