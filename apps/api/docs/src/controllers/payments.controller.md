# payments.controller.js — Starting an M-Pesa Payment for an Order

**File:** `apps/api/src/controllers/payments.controller.js`
**Doc:** `apps/api/docs/src/controllers/payments.controller.md`
**Added:** Week 29 Day 3
**Route:** `POST /v1/orders/:id/pay`  
**Tests:** `apps/api/tests/payments.pay.test.js`

---

## WHY THIS FILE EXISTS

When a shop owner (or the shop's page) taps Pay on an order, this handler asks the customer's phone for the money and saves a record of the attempt. It never marks anything paid.

## WHY IMPORTANT

It decides the amount charged and records the attempt that the callback later matches. A wrong amount here means a wrong charge.

## DANGER

- NEVER take the amount from the request. It comes only from `orders.total_cents`.
- NEVER mark an order paid or touch the wallet here. Only the callback may.
- Save the attempt BEFORE calling Safaricom (write-ahead), so a fast callback can always find it.

## WHAT IT SOLVES

Day 3 Task 2: look up the order, the shop's Daraja settings, get a token, STK push, save a pending `payment_attempts` row, return 202.

## SYSTEM DESIGN PRINCIPLE

Write-ahead record, then act. Like writing a delivery note before the rider leaves.

## RULES

1. The order is read inside the shop's lock, so another shop's order is a 404.
2. Only an order with status `created` can be paid (409 otherwise).
3. The total must be whole shillings (400 otherwise, never rounded).
4. A second prompt within 2 minutes is refused (409 `payment_in_progress`).
5. A failed push is saved as `failed` with a short code only.

## PRACTICAL EXAMPLE

Order total KES 1,500, customer phone on file. POST `/v1/orders/<id>/pay` with `{}`: a pending attempt for 150000 cents is saved, the phone buzzes, and the reply is 202 `{ data: { paymentAttemptId, status: 'pending' } }`.

## DECISIONS (and WHY)

- 202 (accepted), not 200: the payment is not done yet.
- Optional `phone` in the body overrides the customer's phone; nothing else from the body is used.
- `AccountReference` is `ORD-` plus the first 8 characters of the order id (Safaricom allows 12).

## WHERE USED / FUTURE USES

`routes/orders.routes.js`. The callback later finds the attempt through `checkout_request_id`.

## TRADEOFFS

+ Simple, safe, repeat-proof.
- The 2 minute double-tap rule is a time window, not a lock; the database rule `one paid attempt per order` is the final guard.

## HOW TO USE

POST `/v1/orders/:id/pay` with the shop's login cookie. Poll the order or wait for the callback to see `paid`.

## PIECE BY PIECE (simple words, real-life examples)

### Step 1: find the order

`SELECT ... FROM orders JOIN customers` on `req.db`. Not found (or another shop's) is 404. Real life: the clerk looks only in this shop's order book.

### Step 2: is it payable?

Status must be `created`. A paid or cancelled order cannot be charged again.

### Step 3: the amount

`Number(order.total_cents)` must be whole shillings of at least 100 cents. The request body is ignored for the amount.

### Step 4: the phone

`normalizePhone(body.phone ?? customer phone)`. Bad phone is 400 and nothing is sent.

### Step 5: double tap guard

If a pending attempt for this order is less than 2 minutes old, answer 409. Real life: do not press the lift button ten times.

### Step 6: write-ahead

Insert the `payment_attempts` row (`pending`) and keep its id.

### Step 7: the push

`stkPush`. On failure, mark the attempt `failed` with the error code and answer 409 (no M-Pesa set up), 400 (invalid details) or 502 (Safaricom problem).

### Step 8: save the ticket

Store `merchant_request_id` and `checkout_request_id` on the attempt, then answer 202.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day3.md`). Last updated 16 November 2026.*
