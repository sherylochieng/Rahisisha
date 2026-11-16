# daraja.service.test.js — Proving the M-Pesa Service Uses the Right Shop's Keys

**File:** `apps/api/tests/daraja.service.test.js`
**Doc:** `apps/api/docs/tests/daraja.service.test.md`
**Added:** Week 29 Day 3
**Run:** `npm test -- tests/daraja.service`  
**Result:** 21 checks

---

## WHY THIS FILE EXISTS

Proves `daraja.service.js` uses only the locked shop's keys and till, never leaks secrets, and never guesses a payment status.

## WHY IMPORTANT

If this service mixes shops or leaks a key, money or secrets are at risk.

## DANGER

Uses a FAKE Safaricom (`global.fetch` replaced), two throw-away shops and a throw-away `KMS_KEY`. No real call is made.

## WHAT IT SOLVES

Evidence for Day 3 Tasks 1 to 3.

## SYSTEM DESIGN PRINCIPLE

Test behaviour you must never lose.

## RULES

1. Every test is self-contained.
2. Secrets are checked against everything printed.
3. The real `fetch` and `KMS_KEY` are put back at the end.

## PRACTICAL EXAMPLE

Check 1: locked to shop A, the push goes to A's address with A's key and till and the right amount.

## DECISIONS (and WHY)

Fake Safaricom instead of the real sandbox so tests are fast and need no internet.

## WHERE USED / FUTURE USES

`npm test` and CI.

## TRADEOFFS

+ Fast and safe.
- The fake is only as good as our reading of Daraja; the sandbox walk-through covers the real thing.

## HOW TO USE

`cd apps/api` then `npm test -- tests/daraja.service`.

## PIECE BY PIECE (simple words, real-life examples)

### Checks 1 to 2

Right shop's address, key and till; shop B never gets shop A's.

### Check 3

Nothing secret reaches `console.*`.

### Check 4

The stored keys are encrypted.

### Checks 5 to 6

Refusals and network failures give clear codes with no secret text.

### Checks 7 to 8

Whole shillings only; a bad phone sends nothing.

### Checks 9 to 11

No settings, no lock, or a key copied into another shop: refused.

### Checks 12 to 13

`normalizePhone` accepts usual Kenyan styles and refuses the rest.

### Checks 14 to 21

`queryStkStatus`: paid, not paid, per-shop, still processing is unconfirmed, odd answers are unconfirmed, network down never gives paid, strange ids refused before any call, nothing secret logged.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day3.md`). Last updated 16 November 2026.*
