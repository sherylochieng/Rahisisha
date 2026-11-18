# orders.list.test.js: Proof For The Orders List

**File:** `apps/api/tests/orders.list.test.js`
**Doc:** `apps/api/docs/tests/orders.list.test.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

Proves `GET /v1/orders`, the data behind the Orders page: newest first, the customer's name and phone on every order, paging with no gaps or repeats, a clean 400 for a bad bookmark, and no other shop's orders or customers.

## WHY IMPORTANT

The Orders page is where the owner decides what to pack and send. A missing order is a lost sale. Another shop's order, with a customer's phone number, is a privacy breach.

## DANGER

- Never use "now" for order times. The expected order would change from run to run.
- Orders must be deleted BEFORE their customers (the database refuses to delete a customer that still has orders).
- The test writes real rows to the test database for a moment. It only touches rows it created and deletes them in `afterAll`.

## WHAT IT SOLVES

Eight checks with known data in, known answers out. Deliberately breaking the ordering made tests 2 and 4 fail, so the test really catches that mistake.

## SYSTEM DESIGN PRINCIPLE

Test the rule with known numbers: fixed times in, a known order out.

## RULES

- Fixed timestamps only.
- Every row the file creates is deleted in `afterAll`.
- Phone numbers are test values, never real ones.
- The list is read through the real API (login cookie, `withTenant`, RLS), not by querying tables directly.

## PRACTICAL EXAMPLE

Shop A's newest order is `ord-5`. Reading with pages of 1, 2 or 4 must always give `ord-5`, then `ord-3` and `ord-4` (same time, either order), then `ord-2`, then `ord-1`.

## TRADEOFFS

+ Self-contained: no seed data needed. - It depends on login cookies, so a login change can break it.

## PIECE BY PIECE (simple words, real-life examples)

### The data

Five orders for shop A at fixed times. Two share one timestamp (a tie), one has microseconds. Shop B gets one secret order with a secret phone. A third shop has none. Real life: a practice stack of order slips where you already know which is newest.

### Tests 1 to 3: the basics

Login needed (401 without it). Newest first. The agreed fields only (the old ones plus `customer_name` and `customer_phone`, and no internal cursor field). Each order shows its own customer.

### Test 4: turn every page

Pages of 1, 2 and 4 return the same five orders once each, in the same order. Real life: reading the slips in smaller handfuls must not change the pile.

### Tests 5 and 6: the safety proofs

Shop A never sees shop B's order or phone. Shop A's bookmark used by shop B returns only shop B's rows.

### Tests 7 and 8: the edges

A shop with no orders gets an empty list and no bookmark. A bad cursor, including the old uuid-style one, is a 400 `Invalid cursor`.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`, follow-up section). Last updated 18 November 2026.*
