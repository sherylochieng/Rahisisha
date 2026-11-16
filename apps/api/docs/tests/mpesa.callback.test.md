# mpesa.callback.test.js — Proving the Callback Credits Once and Never on a Guess

**File:** `apps/api/tests/mpesa.callback.test.js`
**Doc:** `apps/api/docs/tests/mpesa.callback.test.md`
**Added:** Week 29 Day 3
**Run:** `npm test -- tests/mpesa.callback`  
**Result:** 18 checks

---

## WHY THIS FILE EXISTS

Proves the callback credits a wallet exactly when it should, exactly once, and never otherwise.

## WHY IMPORTANT

Each check is one way money could be lost, invented or doubled.

## DANGER

Fake Safaricom (answer set per test), two throw-away shops, throw-away `KMS_KEY`; money is checked in `wallet_entries`.

## WHAT IT SOLVES

Evidence for Day 3 Task 3.

## SYSTEM DESIGN PRINCIPLE

Test the behaviour you must never lose: no double credit, no credit without confirmation, no credit across shops, nothing half done.

## RULES

1. Every test builds its own order and attempt.
2. Check the database, not only the reply.

## PRACTICAL EXAMPLE

Check 3: the same callback twice; the wallet grows once.

## DECISIONS (and WHY)

Attempts are inserted directly because the pay route has its own tests.

## WHERE USED / FUTURE USES

`npm test` and CI.

## TRADEOFFS

+ Fast and no network.
- Mutation checks showed 4 of 5 deliberate breaks are caught; the 5th (skipping the pending re-check) is also covered by the database's unique receipt rule.

## HOW TO USE

`cd apps/api` then `npm test -- tests/mpesa.callback`.

## PIECE BY PIECE (simple words, real-life examples)

### 1

Unknown or junk shop ids: 200 Accepted.

### 2

A real payment: wallet, attempt and order updated together.

### 3 and 4

Same callback twice, and two at once: credited once.

### 5

Callback says paid, Safaricom says not: nothing credited.

### 6

Safaricom unreachable: nothing changes.

### 7

Made-up CheckoutRequestID: ignored without calling Safaricom.

### 8

Another shop's callback cannot pay my attempt.

### 9

Wrong amount: failed as `amount_mismatch`, receipt kept.

### 10

Cancelled order: failed as `order_not_open`, receipt kept.

### 11

Customer cancelled: failed, no credit.

### 12

Callback failed but Safaricom paid: nothing changes.

### 13

Garbage bodies are ignored.

### 14

Shillings convert to cents correctly.

### 15

The same receipt on a second order is refused by the database.

### 16

Nothing sensitive reaches the console.

### 17

A deleted shop is ignored.

### 18

GET gets the normal 404.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day3.md`). Last updated 16 November 2026.*
