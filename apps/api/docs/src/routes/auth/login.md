# POST /login

**File:** `apps/api/src/routes/auth/login.js`
**Tested:** 2026-10-13. Updated 2026-11-06 for migration 022 (`login_lookup`). Tests 1 to 4 were run on 13 October; Test 5 is the live check from 5 November.
**Base URL:** `http://localhost:3000/v1`

---

## What this endpoint does

Authenticates an existing user. Step by step:

1. Zod validates the request body (phone + password shape)
2. `SELECT` looks up the user row by phone number
3. `bcrypt.compare` checks the submitted password against the stored hash
4. A short transaction (`BEGIN`) sets `app.login_user` to the **verified** user, **after** the password check (migration 022, `login_lookup`), then `SELECT` fetches the user's membership: `tenant_id` and `role`, then `COMMIT`
5. `jwt.sign` creates a 7-day token containing `user_id`, `tenant_id`, `role`
6. Token is stored in an `httpOnly` cookie — the browser holds it automatically
7. Returns `200` with `message`, `tenant_id` and `user_id`

**No database rows are created or changed.** Login is read-only. (The transaction only sets a temporary note, which disappears at `COMMIT`.)

> **Changed on 5 November 2026.** Before migration 022, step 4 returned no rows, because the shop lock hides every membership when no shop is known yet, so correct passwords got `403`. See `docs/src/routes/auth/login.md` for the full explanation.

---

## Why we never reveal which field was wrong

If we returned "phone not found" vs "wrong password" separately, an
attacker could enumerate phone numbers — keep guessing phones until we
confirm one exists, then attack only that account with password guesses.

Returning `"Invalid credentials"` for BOTH cases reveals nothing useful
to an attacker. The user knows they typed something wrong; that is enough.

---

## Request body

| Field    | Type   | Rules        |
|----------|--------|--------------|
| phone    | string | 10–20 chars  |
| password | string | 8–72 chars   |

---

## Test 1 — Happy path (correct credentials → 200)

**Why this matters:** If login doesn't work, no existing user can
get back into their account. Every feature behind authentication
depends on this working first.

```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0712345678","password":"password123"}'
```

**Expected response — HTTP 200:**
```json
{
  "message": "Logged in",
  "tenant_id": "c63d4ed0-b971-4719-9db3-61ce9e499d95",
  "user_id": "a2806dff-6d6c-4a16-8eab-c02e136714c2"
}
```

(The 13 October run also showed `role`. The current code returns `message`, `tenant_id` and `user_id` only. The role is inside the token.)

**How to confirm the cookie was set:**
The response headers should include a line like this (the value is a long signed token):

```
Set-Cookie: token=<long signed text>; Path=/; Expires=<7 days from now>; HttpOnly; SameSite=Strict
```

**Result (confirmed 2026-10-13):** ✅ 200 OK

---

## Test 2 — Wrong password → 401

**Why this matters:** Confirms `bcrypt.compare` rejects a bad password
AND that we return the same message as "phone not found" — never
revealing which field failed.

```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0712345678","password":"wrongpassword"}'
```

**Expected response — HTTP 401:**
```json
{ "error": "Invalid credentials" }
```

**What happened:** `bcrypt.compare` returned `false`. We stopped there
and returned 401 — no token, no cookie.

**Result (confirmed 2026-10-13):** ✅ 401 as expected

---

## Test 3 — Phone not found → 401

**Why this matters:** Confirms that a phone number that doesn't exist
in the database returns the EXACT same response as a wrong password.
Identical response both ways — attacker learns nothing.

```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0700000000","password":"password123"}'
```

**Expected response — HTTP 401:**
```json
{ "error": "Invalid credentials" }
```

**What happened:** `SELECT` returned zero rows. We returned 401
immediately — bcrypt was never called.

**Result (confirmed 2026-10-13):** ✅ 401 as expected

---

## Test 4 — Validation failure → 400

**Why this matters:** Confirms Zod catches bad input BEFORE we touch
the database. A 3-digit phone or 5-character password never reaches
PostgreSQL.

```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"123","password":"short"}'
```

**Expected response — HTTP 400:**
```json
{
  "error": "Validation failed",
  "details": {
    "phone": ["String must contain at least 10 character(s)"],
    "password": ["String must contain at least 8 character(s)"]
  }
}
```

**Result (confirmed 2026-10-13):** ✅ 400 as expected

---

## Test 5 — A second shop logs in (after migration 022)

**Why this matters:** This is the test that exposed the Day 5 bug. A correct password was refused with `403` because the shop lock hid every membership row. It proves the `login_lookup` rule works through the real login, and that the new shop sees only its own data.

**How (in the browser, 5 November 2026):**
1. Sign up a second shop, "Brio Hardware", phone `0700000001`.
2. Log in with that phone and its password.
3. Open the dashboard.

**Expected:** `200`, the browser goes to the dashboard, and it shows zero orders, zero wallet balance and "No products yet". It never shows the other shop's products.

**Before migration 022:** `403 Forbidden` in the Network tab, with `{ "error": "Invalid credentials" }`.

**Result (confirmed 2026-11-05):** ✅ login succeeded and the dashboard was empty for Brio, while the other shop still had its two products.

**Also covered by an automated test (database level):** `tests/isolation/login-lookup.isolation.test.js` (7 checks).

---

## No database changes on failure

For Tests 2, 3, and 4 — confirm nothing was written:

```sql
-- Check row count hasn't grown
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM tenants;
SELECT COUNT(*) FROM memberships;
```

Counts should be unchanged. Login is always read-only — it can never
create or delete rows.

---

## Do test rows stay in the database?

Yes — the signup rows used for login testing are real data that stays (two shops exist in the dev database: the original one and Brio Hardware).
Do not delete it while you are still developing auth. Once you have
a proper seed script or test database, you can isolate test data there.

For now: the row is your working fixture.

---

## Known gaps (as of 2026-11-06)

- There is no automated test of the real login endpoint yet (only of the database rule).
- Errors are `{ "error": "text" }`, not the `{ error: { code, message, details } }` shape used elsewhere.
- The subdomain is not matched against the token yet (planned for deployment).