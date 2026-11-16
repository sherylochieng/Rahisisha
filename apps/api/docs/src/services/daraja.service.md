# daraja.service.js — Talking to M-Pesa (Daraja) for One Shop

**File:** `apps/api/src/services/daraja.service.js`
**Doc:** `apps/api/docs/src/services/daraja.service.md`
**Added:** Week 29 Day 3
**Tests:** `apps/api/tests/daraja.service.test.js`

---

## WHY THIS FILE EXISTS

Safaricom's M-Pesa (Daraja) is one service shared by all shops, but each shop has its own keys and till number. This file is the one place that talks to Safaricom: it logs in, asks the customer's phone to pay (STK push) and asks Safaricom whether a payment really happened (STK query).

Real-life picture: a bank teller window shared by many shops. Each shop hands over its own ID and till number; the teller never mixes them up.

## WHY IMPORTANT

Every payment starts here, and every callback is double-checked here. A mistake could charge the wrong amount, use another shop's keys, or let a forged callback pass.

## DANGER

- NEVER take the shop from an argument. The shop is the one the database lock (`app.current_tenant`) is set to.
- NEVER log a key, secret, passkey, token or phone number. There is no `console.*` in this file on purpose.
- NEVER round money. Whole shillings only; anything else is refused.
- Treat any odd answer from Safaricom as "not confirmed", never as "paid".

## WHAT IT SOLVES

Day 3 Task 2 (STK push) and the second lock for Task 3 (callback verification): per-shop M-Pesa with shared code.

## SYSTEM DESIGN PRINCIPLE

Shared code, per-shop secrets: one file for all shops, secrets stored encrypted per shop and decrypted only at the last moment.

## RULES

1. `loadConfig` reads the shop's settings through the current database lock. No lock means no row.
2. Secrets are decrypted in memory only, bound to the shop id (a key copied to another shop will not decrypt).
3. Amount must be whole shillings (at least KES 1). Refuse, never round.
4. Every network call has a 10 second timeout.
5. Errors carry a short code only (`daraja_not_configured`, `daraja_auth_failed`, `daraja_rejected`, `daraja_unreachable`, `daraja_query_unconfirmed`, `invalid_phone`, `amount_not_whole_shillings`), never secrets.

## PRACTICAL EXAMPLE

Amina's customer owes KES 1,500. The order controller calls `stkPush(db, { amountCents: 150000, phone: '0711111111', accountReference: 'ORD-1a2b3c4d' })`. The service reads Amina's settings, logs in to Safaricom with Amina's key, and Safaricom sends the PIN prompt to the customer's phone. Later, the callback handler calls `queryStkStatus(db, checkoutRequestId)` and gets `'paid'` or `'failed'`.

## DECISIONS (and WHY)

- Sandbox and production addresses live in a table; `DARAJA_API_BASE` overrides both (used by tests).
- The password is `base64(shortcode + passkey + timestamp)` with the timestamp in Nairobi time (UTC+3), as Daraja requires.
- `queryStkStatus` accepts only a clean answer: status 200, `ResponseCode` `'0'`, a `ResultCode` present, and a matching `CheckoutRequestID` if one is given. Anything else throws `daraja_query_unconfirmed`.
- Only `ResultCode` 0 means paid; every other code means failed.

## WHERE USED / FUTURE USES

`controllers/payments.controller.js` (stkPush) and `controllers/mpesa.callback.controller.js` (queryStkStatus). Future: the nightly reconciliation job and a refund endpoint.

## TRADEOFFS

+ One small, well tested file for every shop.
- Each call logs in again (no token caching), which is simple and safe but slower.
- Not yet run against Safaricom's real sandbox end to end, only a fake `fetch`.

## HOW TO USE

Call `stkPush(req.db, {...})` or `queryStkStatus(req.db, id)` with a connection that is already locked to the shop. Set `DARAJA_API_BASE` only in tests.

## PIECE BY PIECE (simple words, real-life examples)

### `normalizePhone(input)`

Turns `0711 111 111`, `+254711111111` or `711111111` into `254711111111`. Anything else throws `invalid_phone` and never repeats the input. Real life: the receptionist who writes every phone number in the same format before dialling.

### `nairobiTimestamp()` and `makePassword(cfg)`

Daraja wants a time stamp (`YYYYMMDDHHmmss`, Nairobi time) and a password built from the till, passkey and time stamp. Real life: a dated, signed deposit slip.

### `fetchJson(url, options)`

Calls Safaricom with a 10 second timeout and returns `{ status, body }`. A network failure becomes `daraja_unreachable`. Real life: phoning the bank and hanging up if nobody answers in 10 seconds.

### `loadConfig(db)`

Reads this shop's row from `daraja_configs` using the lock. Real life: the teller pulls out only the folder of the shop that is standing in front of her.

### `getAccessToken(cfg)`

Decrypts the key and secret and asks Safaricom for a short-lived access token. A refusal becomes `daraja_auth_failed` with only the status number.

### `stkPush(db, ...)`

Checks the amount and phone, loads settings, logs in, then asks Safaricom to send the prompt. Returns `{ merchantRequestId, checkoutRequestId }`. Real life: sending the customer a payment request and keeping the ticket number.

### `queryStkStatus(db, id)`

Asks Safaricom whether that exact payment happened. Returns `'paid'` or `'failed'`, or throws `daraja_query_unconfirmed` when the answer is unclear. Real life: phoning the bank to confirm a transfer before releasing goods.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day3.md`). Last updated 16 November 2026.*
