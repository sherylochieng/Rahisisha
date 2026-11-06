# Auth Endpoints

Base URL: `http://localhost:3000/v1`

---

## POST /signup

### What this endpoint does
Creates a new business account on Rahisisha Biashara.
One HTTP request triggers ONE database transaction that creates 3 rows (updated 2026-11-06; Tests 1 to 4 were run on 2026-10-13, before the changes below, see the notes in each test):
- 1 row in `tenants` — the business (e.g. "Sheryl Shop")
- 1 row in `users` — the owner's name, phone + hashed password
- 1 row in `memberships` — links the user to the tenant with role "owner"

If ANY of those 3 inserts fail, ALL are rolled back. Nothing is left half-done.

> **What changed since 13 October.**
> - The request no longer has a `slug` field. The slug is made from `tenant_name` (`slugify`), and a number is added if it is taken (`sheryl-shop`, `sheryl-shop-1`, ...).
> - On 5 November the signup started stamping `app.current_tenant` right after the shop is inserted. Without it the membership insert was refused by the shop lock (`new row violates row-level security policy`) and signup returned 500.
> - There is **no reserved-slug check** in the current code (see Test 3).

The wallet starts at zero by design — balance is calculated as
`SUM(amount_cents)` from wallet_entries. No rows = 0. A row only
appears when a real financial event happens (sale, refund, payout).

---

### Request body
| Field | Type | Rules |
|-------|------|-------|
| phone | string | 10–20 chars |
| name | string | 2–100 chars |
| password | string | 8–72 chars |
| tenant_name | string | 2–100 chars |

There is **no `slug` field** any more. The slug is made from `tenant_name`.

---

### Test 1 — Happy path (everything correct)

**Why this test matters:**
This is the core of the whole platform. If this fails, no one can
create an account. We test it first and verify all 3 rows landed in
the database at the exact same timestamp — proof the transaction is
atomic (all or nothing).

**Command:**
```bash
Invoke-WebRequest -Uri http://localhost:3000/v1/signup `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0712345678","password":"password123","name":"Sheryl Ochieng","tenant_name":"Sheryl Shop"}'
```

**Expected response (HTTP 201):**
```json
{ "message": "Account created", "tenant_id": "...", "user_id": "..." }
```

**Result (confirmed 2026-10-13, with the old body that included `slug`):** ✅ 201. Re-run it with the body above and write the result here: ______

**How to verify in the database:**
```sql
SELECT id, name, slug FROM tenants;
SELECT id, phone, name, password_hash, created_at FROM users;
SELECT * FROM memberships;
```
All 3 rows share the same `created_at` timestamp — proof of one transaction.
`password_hash` shows `$2b$12$...` — bcrypt, never the real password.

---

### Test 2 — Same shop name twice (different phone)

**Why this test matters:**
Every tenant gets a unique address word (the slug), for example `sheryl-shop.rahisisha.com`. If two tenants could share one, they would collide on the same URL. The current code never produces a duplicate: `findUniqueSlug` adds a number when the word is taken. The unique index in the database is the last line of defence.

**Command:**
```bash
Invoke-WebRequest -Uri http://localhost:3000/v1/signup `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0799999999","password":"password123","name":"Test User","tenant_name":"Sheryl Shop"}'
```

**Expected response (HTTP 201):** the second shop is created with the slug `sheryl-shop-1`.

**How to verify:**
```sql
SELECT name, slug FROM tenants WHERE name = 'Sheryl Shop';
```
You should see `sheryl-shop` and `sheryl-shop-1`.

**Result:** (run it and write the result here) ______

**Note.** The old version of this test (same `slug` sent twice, expecting `409 That slug is already taken`, confirmed 2026-10-13) no longer applies, because there is no `slug` field. A `409` for the slug now happens only if two signups pick the same free slug at the same moment.

---

### Test 3 — Reserved slug (NOT CURRENTLY ENFORCED)

**What this test used to prove (2026-10-13):** a request with `"slug":"admin"` got `422 "admin" is a reserved slug`. Names like `admin`, `www`, `api`, `app` and `staging` must stay free for the platform itself.

**Today:** `signup.js` has no `slug` field and no reserved-name check. A shop named **"Admin"** gets the slug `admin`.

**Status:** ⚠️ gap, not a pass. To restore the protection, check the finished slug against a reserved list inside `findUniqueSlug` or right after it, and skip to `admin-1`, or reject.

---

### Test 4 — Validation failure (bad data)

**Why this test matters:**
We never want bad data reaching the database. Zod validates every
field before we touch PostgreSQL. This test confirms that short
passwords, bad slugs, and missing fields are caught at the door with
a clear error message — not a confusing database crash deep inside
the transaction.

**Command:**
```bash
Invoke-WebRequest -Uri http://localhost:3000/v1/signup `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"123","password":"short","name":"X","tenant_name":"X"}'
```

**Expected response (HTTP 400):**
```json
{
  "error": "Validation failed",
  "details": {
    "phone": ["String must contain at least 10 character(s)"],
    "password": ["String must contain at least 8 character(s)"],
    "tenant_name": ["String must contain at least 2 character(s)"],
    "name": ["String must contain at least 2 character(s)"]
  }
}
```

**Result (confirmed 2026-10-13, with the old body that included `slug`):** ✅ 400. The `slug` line is gone from the expected output now. Re-run and confirm: ______

**How to verify:** No rows in the database. Zod stopped it before
the transaction started.

---

### Test 5 — Same phone twice

**Why this test matters:** A phone number identifies one person. The database refuses a second account with the same phone, and we return a friendly message, not a crash.

**Command:** run Test 1's command again with a different `tenant_name` but the **same phone** (`0712345678`).

**Expected response (HTTP 409):**
```json
{ "error": "An account with that phone number already exists" }
```

**How to verify:** no new rows in `tenants`, `users` or `memberships` (the transaction was rolled back, so even the new shop is gone).

**Result:** (run it and write the result here) ______

---

### Test 6 — Signup then immediately works (the Day 5 fix)

**Why this test matters:** Without the `app.current_tenant` stamp, the membership insert was refused with `new row violates row-level security policy for table "memberships"` and signup returned `500`.

**How (in the browser, 5 November 2026):** sign up "Brio Hardware" with phone `0700000001`.

**Expected:** `201`, you are logged in, and you see an empty dashboard.

**Result (confirmed 2026-11-05):** ✅

---

### How to clean test data (when you need a fresh start)

```sql
-- Connect first:
psql postgresql://postgres:yourpassword@localhost:5432/rahisisha

-- DEV ONLY. This deletes EVERY shop, including Jane's and Brio's.
-- Wipe everything and reset IDs:
TRUNCATE tenants, users, memberships, wallet_entries RESTART IDENTITY CASCADE;
```

`RESTART IDENTITY` resets UUID sequences back to fresh.
`CASCADE` clears rows in related tables automatically.
Run this any time you want to re-test the happy path from a clean state.

---

## Known gaps (as of 2026-11-06)

1. No reserved-slug check (Test 3).
2. `slugify` cuts to 30 characters after trimming, so a slug can end in `-` (for example when the 30th character is a hyphen). The shop then cannot be found by address, because `tenants.controller.js` rejects that shape.
3. A name with only symbols (for example `!!!`) makes an empty slug.
4. No automated test for signup.
5. Errors are `{ "error": "text" }`, not the `{ error: { code, message, details } }` shape used elsewhere.