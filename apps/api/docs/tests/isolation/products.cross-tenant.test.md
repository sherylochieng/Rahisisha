# products.cross-tenant.test.js

**Location:** `apps/api/tests/isolation/products.cross-tenant.test.js`

---

## WHY THIS FILE EXISTS

Task 5 says: fetch an Acme product with Brio's login and expect **404**. Same for orders.

The orders half already existed. This file is the **products** half, and it goes further than reading.

---

## WHY IMPORTANT

A thief who cannot **read** your data might still be able to **change** or **delete** it. Reading is only one of the doors.

---

## DANGER (if missing)

Update and delete could cross tenants and nothing would notice.

---

## WHAT IT SOLVES

Proves isolation for **read, list, update and delete** on products.

---

## SYSTEM DESIGN PRINCIPLE

**Defence in depth, verified.** RLS is the second lock. This checks that it really holds on every kind of request.

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Write one cross-tenant file per tenant-owned resource.

---

## TRADEOFFS

More tests means a longer run, but each one is cheap compared with a leak.

---

## HOW TO USE

```
npm run test:isolation
```

---

## THE 5 TESTS

Acme creates one product. Brio then plays the thief.

| # | What it checks |
|---|---|
| 1 | Brio fetches it by ID: **404** |
| 2 | Brio's product list never contains it |
| 3 | Brio tries to **update** it: **404** |
| 4 | Brio tries to **delete** it: **404** |
| 5 | Acme still sees it, with the **name unchanged** |

Test 5 runs **last on purpose**. It proves the 404s came from isolation, and the attacks changed nothing.

---

## WHY 404 AND NOT 403

A 403 says "it exists but you may not". A 404 says nothing about whether it exists. Using 404 means a thief cannot even learn which IDs are real.
