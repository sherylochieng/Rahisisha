# products.pagination.test.js

**Location:** `apps/api/tests/pagination/products.pagination.test.js`

---

## WHY THIS FILE EXISTS

Pagination is a **promise**: every item appears exactly once, and the pages eventually end. This file checks that promise.

---

## WHY IMPORTANT

A silent pagination bug shows customers missing or repeated products, and nobody notices until a shop owner complains.

---

## DANGER (if missing)

- Duplicates or missing rows go unnoticed.
- A cursor that never ends makes a frontend loop for ever.

---

## WHAT IT SOLVES

Proves cursor pagination works for a tenant that has 30 products of our own plus the seed products.

---

## SYSTEM DESIGN PRINCIPLE

**Test the promise, not the numbers.** The test does not assume "exactly 3 pages". Acme also has 5 seed dresses, so the total is more than 30.

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Any list endpoint with pages: feeds, orders, customers, messages.

---

## TRADEOFFS

- Creating 30 rows per run takes a little time, but it uses the real database and so behaves like production.
- The loop has a **safety cap** (fail after 10 pages), so a broken cursor fails loudly instead of looping for ever.

---

## HOW TO USE

```
npm test
```

---

## THE 3 TESTS

| # | What it checks |
|---|---|
| 1 | Page 1 returns 10 products and a `nextCursor` |
| 2 | Page 2 returns the next 10 and another cursor |
| 3 | Walking every page: our 30 products each appear **once**, no duplicates, and the cursor finally becomes `null` |

---

## SETUP AND CLEANUP

- Logs in as Acme using a `makeCookie` helper that builds a JWT.
- Creates 30 products through the API.
- **Cleanup uses `deleteAsTenant`**: opens a transaction, sets the tenant, then deletes. A plain delete with no tenant sees **zero rows** under RLS and deletes nothing. That bug left 121 test products behind once.
- `afterAll` calls `pool.end()` so Jest can exit.
