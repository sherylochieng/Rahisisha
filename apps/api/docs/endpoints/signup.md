<!-- # Auth Endpoints

Base URL: `http://localhost:3000/v1`

---

## POST /signup

### What this endpoint does
Creates a new business account on Rahisisha Biashara.
One HTTP request triggers ONE database transaction that creates 4 rows:
- 1 row in `tenants` — the business (e.g. "Sheryl Shop")
- 1 row in `users` — the owner's phone + hashed password
- 1 row in `memberships` — links the user to the tenant with role "owner"
- 1 row in `wallet_entries` — starts the wallet at 0 (reason: account_created)

If ANY of those 4 inserts fail, ALL are rolled back. Nothing is left half-done.

---

### Request body
| Field | Type | Rules |
|-------|------|-------|
| phone | string | 10–20 chars |
| password | string | 8–72 chars |
| tenant_name | string | 2–100 chars |
| slug | string | 3–30 chars, lowercase letters/digits/hyphens only |

---

### Test 1 — Happy path (everything correct)

**Why:** Confirm the full transaction works end to end.

**Command:**
```bash
curl -X POST http://localhost:3000/v1/signup \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0712345678",
    "password": "password123",
    "tenant_name": "Sheryl Shop",
    "slug": "sheryl-shop"
  }'
```

**Expected response (HTTP 201):**
```json
{ "message": "Account created", "tenant_id": 1, "user_id": 1 }
```

**How to verify in the database:**
Open psql and run:
```sql
SELECT * FROM tenants;
SELECT * FROM users;
SELECT * FROM memberships;
SELECT * FROM wallet_entries;
```
You should see one row in each table.
The `password_hash` in users will look like `$2b$12$...` — that is bcrypt, NOT your real password. Good.
The `wallet_entries.amount_cents` should be 0.

**Do we delete this test data after?**
No. Leave it. Real data in your dev database is useful — it lets you
test login, duplicate slug checks, and future features against something real.
If you ever need a clean slate, run:
```sql
TRUNCATE tenants, users, memberships, wallet_entries RESTART IDENTITY CASCADE;
```
`RESTART IDENTITY` resets the ID counters back to 1.
`CASCADE` clears related rows automatically.

---

### Test 2 — Duplicate slug (same slug, different phone)

**Why:** Confirm PostgreSQL's unique constraint catches it and we return
a friendly 409 instead of a raw database crash.

**Command:**
```bash
curl -X POST http://localhost:3000/v1/signup \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0799999999",
    "password": "password123",
    "tenant_name": "Another Shop",
    "slug": "sheryl-shop"
  }'
```

**Expected response (HTTP 409):**
```json
{ "error": "That slug is already taken" }
```

**How to verify:** No new rows should appear in any table. Run the
SELECT queries above — the counts should stay the same.

---

### Test 3 — Reserved slug

**Why:** Confirm we block slugs like "admin", "www", "api" before even
touching the database.

**Command:**
```bash
curl -X POST http://localhost:3000/v1/signup \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0788888888",
    "password": "password123",
    "tenant_name": "Admin Corp",
    "slug": "admin"
  }'
```

**Expected response (HTTP 422):**
```json
{ "error": "\"admin\" is a reserved slug and cannot be used" }
```

**How to verify:** Same — no new rows in the database.

---

### Test 4 — Validation failure (bad data)

**Why:** Confirm Zod catches invalid input before we do anything else.
Password too short, slug has illegal characters.

**Command:**
```bash
curl -X POST http://localhost:3000/v1/signup \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "123",
    "password": "short",
    "tenant_name": "X",
    "slug": "!!"
  }'
```

**Expected response (HTTP 400):**
```json
{
  "error": "Validation failed",
  "details": {
    "phone": ["String must contain at least 10 character(s)"],
    "password": ["String must contain at least 8 character(s)"],
    "tenant_name": ["String must contain at least 2 character(s)"],
    "slug": ["Slug must be 3-30 lowercase letters, digits, or hyphens"]
  }
}
```

**How to verify:** No rows in the database. Zod stopped it at the door.

---

### How to clean test data (when you need a fresh start)

```sql
-- Connect to your database first:
psql postgresql://postgres:yourpassword@localhost:5432/rahisisha

-- Wipe everything and reset IDs:
TRUNCATE tenants, users, memberships, wallet_entries RESTART IDENTITY CASCADE;
```

Run this any time you want to re-test the happy path from scratch with ID = 1. -->

# Auth Endpoints

Base URL: `http://localhost:3000/v1`

---

## POST /signup

### What this endpoint does
Creates a new business account on Rahisisha Biashara.
One HTTP request triggers ONE database transaction that creates 3 rows:
- 1 row in `tenants` — the business (e.g. "Sheryl Shop")
- 1 row in `users` — the owner's name, phone + hashed password
- 1 row in `memberships` — links the user to the tenant with role "owner"

If ANY of those 3 inserts fail, ALL are rolled back. Nothing is left half-done.

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
| slug | string | 3–30 chars, lowercase letters/digits/hyphens only |

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
  -Body '{"phone":"0712345678","password":"password123","name":"Sheryl Ochieng","tenant_name":"Sheryl Shop","slug":"sheryl-shop"}'
```

**Expected response (HTTP 201):**
```json
{ "message": "Account created", "tenant_id": "...", "user_id": "..." }
```

**Result (confirmed 2026-10-13):** ✅ 201 as expected

**How to verify in the database:**
```sql
SELECT * FROM tenants;
SELECT id, phone, name, password_hash, created_at FROM users;
SELECT * FROM memberships;
```
All 3 rows share the same `created_at` timestamp — proof of one transaction.
`password_hash` shows `$2b$12$...` — bcrypt, never the real password.

---

### Test 2 — Duplicate slug (same slug, different phone)

**Why this test matters:**
Every tenant gets a unique subdomain based on their slug
(e.g. `sheryl-shop.rahisisha.com`). If two tenants could share a slug,
they would collide on the same URL — one business would see another's
data. This test confirms PostgreSQL's unique constraint catches it and
we return a friendly error instead of a raw database crash.

**Command:**
```bash
Invoke-WebRequest -Uri http://localhost:3000/v1/signup `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0799999999","password":"password123","name":"Test User","tenant_name":"Another Shop","slug":"sheryl-shop"}'
```

**Expected response (HTTP 409):**
```json
{ "error": "That slug is already taken" }
```

**Result (confirmed 2026-10-13):** ✅ 409 as expected

**How to verify:** No new rows appear in any table. The transaction
was rolled back before anything was saved.

---

### Test 3 — Reserved slug

**Why this test matters:**
Slugs like `admin`, `www`, `api`, `app`, `staging` are reserved for
platform use. If a tenant claimed `admin.rahisisha.com`, it would
conflict with our own admin panel. This test confirms we block them
BEFORE touching the database — no wasted DB round-trip.

**Command:**
```bash
Invoke-WebRequest -Uri http://localhost:3000/v1/signup `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0788888888","password":"password123","name":"Test User","tenant_name":"Admin Corp","slug":"admin"}'
```

**Expected response (HTTP 422):**
```json
{ "error": "\"admin\" is a reserved slug and cannot be used" }
```

**Result (confirmed 2026-10-13):** ✅ 422 as expected

**How to verify:** No new rows in the database. Blocked before the
transaction even started.

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
  -Body '{"phone":"123","password":"short","name":"X","tenant_name":"X","slug":"!!"}'
```

**Expected response (HTTP 400):**
```json
{
  "error": "Validation failed",
  "details": {
    "phone": ["String must contain at least 10 character(s)"],
    "password": ["String must contain at least 8 character(s)"],
    "tenant_name": ["String must contain at least 2 character(s)"],
    "slug": ["Slug must be 3-30 lowercase letters, digits, or hyphens"],
    "name": ["String must contain at least 2 character(s)"]
  }
}
```

**Result (confirmed 2026-10-13):** ✅ 400 as expected

**How to verify:** No rows in the database. Zod stopped it before
the transaction started.

---

### How to clean test data (when you need a fresh start)

```sql
-- Connect first:
psql postgresql://postgres:yourpassword@localhost:5432/rahisisha

-- Wipe everything and reset IDs:
TRUNCATE tenants, users, memberships, wallet_entries RESTART IDENTITY CASCADE;
```

`RESTART IDENTITY` resets UUID sequences back to fresh.
`CASCADE` clears rows in related tables automatically.
Run this any time you want to re-test the happy path from a clean state.