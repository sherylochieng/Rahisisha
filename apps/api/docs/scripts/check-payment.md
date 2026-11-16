# check-payment.js — Read-Only Check of What a Payment Did

**File:** `apps/api/scripts/check-payment.js`
**Doc:** `apps/api/docs/scripts/check-payment.md`
**Added:** Week 29 Day 3
**Run:** `cd apps/api` then `node scripts/check-payment.js` (or `node scripts/check-payment.js <order id>`)

---

## WHY THIS FILE EXISTS

After a real Safaricom sandbox payment you want to see what the system did: is the attempt `pending`, `paid` or `failed`? Is the order `paid`? Did the wallet grow? This script shows exactly that, without opening `psql` or typing a database password.

Real-life picture: asking the shop clerk "did that payment go into the book?" instead of opening the safe yourself.

## WHY IMPORTANT

It is how the real sandbox run on 16 November 2026 was checked. It showed the first payment stuck `pending` and the second one `paid` with the wallet up by exactly 120000 cents.

## DANGER

- It is **read-only**: only SELECT queries. It cannot change a payment or a wallet.
- It refuses a database that is not on this computer.
- It never prints receipts, phone numbers, keys or tokens. It prints status words, whether a receipt exists (true or false) and the wallet total.

## WHAT IT SOLVES

Day 3 sandbox walk-through: proving the callback and the wallet credit with a real payment.

## SYSTEM DESIGN PRINCIPLE

Look, do not touch. A checking tool must not be able to break what it checks.

## RULES

1. Local database only.
2. SELECT only.
3. Set the shop lock (`app.current_tenant`) the same way the app does, because `payment_attempts` and `wallet_entries` are locked by shop.
4. Nothing sensitive in the output.

## PRACTICAL EXAMPLE

`node scripts/check-payment.js` prints something like:

```
Order status: paid
Payment attempts: status 'paid', result_desc 'The service request is processed successfully.', has_receipt true
Wallet total (cents): 1720000
```

## DECISIONS (and WHY)

- With no order id it checks the newest order that has a payment attempt, so you can run it straight after paying.
- The shop defaults to `aminas-boutique`; set `SHOP_SLUG` to check another shop.
- It uses the app's own pool and `.env`, so no database password is typed.

## WHERE USED / FUTURE USES

By hand, after a sandbox payment. A future admin screen could show the same facts.

## TRADEOFFS

+ Quick and safe.
- It shows state only; it does not say why a payment is pending. (A throw-away script, `diagnose-stk-query.js`, asked Safaricom directly during the sandbox run and was not committed.)

## HOW TO USE

1. Make a payment (see "Try M-Pesa locally" in `capstone/README.md`).
2. Wait about 30 seconds.
3. Run the script and read the three lines.

---

## PIECE BY PIECE (simple words, real-life examples)

### `guard()`

Refuses to run unless `DATABASE_URL` points at `localhost` or `127.0.0.1`. Real life: a clerk who only opens the book in the shop itself, never one carried out of the building.

### Finding the order

With an id, the script uses it (it must look like an id). With no id, it takes the order of the newest payment attempt for the shop. Real life: "the last customer who paid".

### Finding the shop

`SELECT id FROM tenants WHERE slug = ...`. The `tenants` table has no lock, so the plain pool can read it.

### Acting as the shop

`set_config('app.current_tenant', ...)` sets the same lock as `withTenant`. Without it the locked tables show nothing.

### The three reads

1. The order's status.
2. Every payment attempt for the order: status, reason, whether a receipt exists, time.
3. The wallet total in cents: `SUM(amount_cents)` over `wallet_entries`.

### Cleaning up

`RESET app.current_tenant`, release the connection and close the pool, so nothing is left locked or open.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day3.md`). It touches no money (read-only). Last updated 16 November 2026.*
