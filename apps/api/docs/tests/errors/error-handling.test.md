# error-handling.test.js

**Location:** `apps/api/tests/errors/error-handling.test.js`

---

## WHY THIS FILE EXISTS

To prove that **bad requests get a clean answer and never leak a database connection**.

---

## WHY IMPORTANT

In Express 4, a crashed async controller left the request hanging and the connection stuck. Enough of those froze the whole API. This file proves that no longer happens.

---

## DANGER (if missing)

The freeze could come back after a harmless-looking change, and it would look like a mysterious timeout.

---

## WHAT IT SOLVES

Checks `asyncHandler`, the central error handler, and the connection release working together.

---

## SYSTEM DESIGN PRINCIPLE

**Fail loudly, in one place**, and **every borrowed resource is returned**.

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Any API with a connection pool. Always test that failures do not leak.

---

## TRADEOFFS

The 25-request test is slower than the others, but it is the only direct proof of "no leak".

---

## HOW TO USE

```
npm test
```

---

## THE 7 TESTS

| # | What it checks |
|---|---|
| 1 | Malformed product ID on GET: **400** |
| 2 | Malformed order ID on GET: **400** |
| 3 | Malformed order ID on PATCH: **400** |
| 4 | Malformed product ID on DELETE: **400** |
| 5 | Unknown status `"bananas"`: **400**, not 409 |
| 6 | Valid-format but missing ID: **404** (the control: a normal "not found" still works) |
| 7 | **25 failing requests**, then one normal request still returns **200** |

---

## WHY 25?

The pool holds **20** connections. If every failing request kept its connection, the pool would be empty by request 21 and the normal request would hang.

It returns 200, so **nothing leaks**.

**Think of it like this:** borrow 25 library books and return each one. If you were short a book at the end, you would know one was never returned.
