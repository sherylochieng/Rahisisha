# mpesa.callback.controller.js — Verifying a Payment and Crediting the Wallet

**File:** `apps/api/src/controllers/mpesa.callback.controller.js`
**Doc:** `apps/api/docs/src/controllers/mpesa.callback.controller.md`
**Added:** Week 29 Day 3
**Route:** `POST /callbacks/mpesa/:tenantId` (public)  
**Tests:** `apps/api/tests/mpesa.callback.test.js`

---

## WHY THIS FILE EXISTS

Safaricom calls this route after the customer answers the M-Pesa prompt. It is the only place that may mark an order paid and credit a shop's wallet.

## WHY IMPORTANT

Every shilling in a wallet entered through this file. A wrong line can credit a payment that never happened, credit twice, or lose a real payment.

## DANGER

- Callbacks are NOT signed. Anyone can post a fake one, so the callback alone is never believed.
- The wallet credit, the attempt and the order must change in ONE transaction.
- No `console.*` in this file: amounts, receipts, phones and keys must never be logged.
- Answer Safaricom 200 `{ ResultCode: 0, ResultDesc: 'Accepted' }` for everything except a server fault.

## WHAT IT SOLVES

Day 3 Task 3: verify the callback, then in one transaction credit `wallet_entries`, mark the order and the attempt paid; idempotent on the same receipt.

## SYSTEM DESIGN PRINCIPLE

Defence in depth with the database as the last guard: shop lock, our own pending attempt, Safaricom's own confirmation, matching amount, open order, one transaction, unique receipt and one paid attempt per order.

## RULES

1. Parse strictly; anything odd is ignored.
2. Find OUR pending attempt for this shop, else ignore.
3. Ask Safaricom (STK query) BEFORE opening the transaction.
4. If Safaricom cannot confirm, change nothing (stays pending for reconciliation).
5. Safaricom's answer wins over the callback.
6. Inside the transaction, lock the attempt and order rows and re-check the attempt is still pending.
7. A payment that cannot be applied (wrong amount, order not open) is never credited: attempt marked failed with a reason, receipt kept.

## PRACTICAL EXAMPLE

A customer pays KES 1,500, receipt QGH7XYZ123. We find the pending attempt, Safaricom confirms, 1500 equals 1500, the order is `created`: in one transaction the wallet gets +150000 cents, the attempt becomes `paid` and the order `paid`. The same callback again finds a non-pending attempt and does nothing.

## DECISIONS (and WHY)

- Callback says paid but Safaricom says failed: mark failed.
- Callback says failed but Safaricom says paid: change nothing (no receipt or amount to record); a human or reconciliation settles it.
- Amounts are compared in whole cents (`Math.round(shillings * 100)`).
- Postgres error 23505 (unique) means a repeat; roll back and treat as harmless.

## WHERE USED / FUTURE USES

`routes/mpesa.routes.js`. The nightly reconciliation job (not built) should reuse the same apply steps.

## TRADEOFFS

+ A forged callback cannot credit anything; a repeated one credits once.
- One extra Safaricom call per callback.
- A callback Safaricom cannot confirm yet leaves the attempt pending until reconciliation.

## HOW TO USE

Do not call it yourself. Set the shop's `callback_url` to `https://<public address>/callbacks/mpesa/<shop id>`; Safaricom posts there.

## PIECE BY PIECE (simple words, real-life examples)

### `ACCEPTED` and `ack(res)`

The same 200 answer for everything. Real life: a receptionist who gives every caller the same polite reply.

### `parseCallback(body)`

Turns Safaricom's message into a small checked object or `null`. A success needs a positive `Amount` and a receipt like `QGH7XYZ123`; an amount with more than 2 decimals is refused. Real life: refusing an envelope that is not filled in exactly.

### `closeAttempt(db, id, fields)`

Writes the final state of an attempt (status, receipt, code, description, `updated_at`).

### `handleMpesaCallback`

Steps 1 to 4: parse, find our pending attempt, ask Safaricom, then `markFailed` or `applyPayment`. Real life: phone the bank before releasing the goods.

### `markFailed`

A short transaction that marks a still-pending attempt `failed`. No wallet change.

### `applyPayment` (the money step)

BEGIN, lock attempt and order, re-check pending, check the amount, check the order is `created`, `credit(db, cents, 'sale', receipt)`, close the attempt as paid, update the order to paid (must change exactly one row), COMMIT. Any error ROLLBACK. Real life: the till, the receipt book and the order slip are updated together or not at all.

### `rollback(db)`

Undoes the transaction and ignores a dead connection.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day3.md`). Last updated 16 November 2026.*
