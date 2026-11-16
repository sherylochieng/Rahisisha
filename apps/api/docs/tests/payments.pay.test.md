# payments.pay.test.js — Proving the Pay Route Is Safe and Per Shop

**File:** `apps/api/tests/payments.pay.test.js`
**Doc:** `apps/api/docs/tests/payments.pay.test.md`
**Added:** Week 29 Day 3
**Run:** `npm test -- tests/payments.pay`  
**Result:** 13 checks

---

## WHY THIS FILE EXISTS

Proves `POST /v1/orders/:id/pay` charges only the order's amount, only for the logged-in shop, and never marks anything paid.

## WHY IMPORTANT

This route starts real charges.

## DANGER

Fake Safaricom, two throw-away shops, throw-away `KMS_KEY`.

## WHAT IT SOLVES

Evidence for Day 3 Task 2.

## SYSTEM DESIGN PRINCIPLE

Prove money rules, not just happy paths.

## RULES

1. Each test makes its own order.
2. The amount is checked in the database and in what was sent to Safaricom.

## PRACTICAL EXAMPLE

Check 3: the body says `amountCents: 1`; the push still asks for KES 1,500.

## DECISIONS (and WHY)

Real requests through supertest so login, lock and route are all tested together.

## WHERE USED / FUTURE USES

`npm test` and CI.

## TRADEOFFS

+ Tests the real route.
- Phone numbers are random per test to avoid unique clashes.

## HOW TO USE

`cd apps/api` then `npm test -- tests/payments.pay`.

## PIECE BY PIECE (simple words, real-life examples)

### 1

No login: 401, Safaricom never called.

### 2

Good order: 202, pending attempt saved, order and wallet untouched.

### 3

The amount comes from the order, never from the body.

### 4

Bad phone: 400, nothing written or sent.

### 5

Another shop cannot pay my order: 404.

### 6

Unknown order 404, malformed id 400.

### 7

Only `created` orders can be paid.

### 8

A total that is not whole shillings is refused.

### 9

A second tap while a prompt is pending is refused.

### 10

No M-Pesa settings: 409, attempt kept as failed.

### 11

Safaricom refuses: 502, attempt failed with a short code.

### 12

After a failed attempt, trying again works.

### 13

No key, token or phone leaks to the console or a reply.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day3.md`). Last updated 16 November 2026.*
