# orders.isolation.test.js

**Location:** `apps/api/tests/isolation/orders.isolation.test.js`

(Renamed from `products.isolation.test.js`, because all its tests were about orders.)

---

## WHY THIS FILE EXISTS

To prove one shop **cannot see another shop's orders**.

---

## WHY IMPORTANT

This is the promise the whole product is built on. If it breaks, it is a data breach.

---

## DANGER (if missing)

A future change could silently open the wall between shops, and nothing would warn you.

---

## WHAT IT SOLVES

Turns "tenants are isolated" from a hope into a check that runs every time.

---

## SYSTEM DESIGN PRINCIPLE

**Trust, but verify.** Like a smoke alarm: test it regularly.

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Every multi-tenant system, for every table that holds tenant data.

---

## TRADEOFFS

Needs two real tenants in the database (Acme and Brio) and real logins, which makes it slower than a unit test, but much more trustworthy.

---

## HOW TO USE

```
npm run test:isolation
```

---

## THE 3 TESTS

| # | What it checks |
|---|---|
| 1 | Brio fetches an Acme order by ID: **404** |
| 2 | Brio's order list never contains Acme's order |
| 3 | Acme can still fetch her own order, so the 404s above were isolation and **not** a deleted order |

**Think of it like this:** the thief cannot open the door, and the owner's things are still inside.

---

## NOTE

Cross-tenant tests were reviewed by hand. Under the AI rules, isolation guarantees must be understood by you, not just generated.
