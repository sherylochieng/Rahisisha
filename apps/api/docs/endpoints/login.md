# Login Endpoint

Base URL: `http://localhost:3000/v1`

---

## POST /login

### What this endpoint does
Authenticates an existing user. Looks up their phone number, verifies
their password against the bcrypt hash stored in the database, finds
their tenant and role, then issues a JWT token stored in an httpOnly
cookie.

After this call the user is "logged in" — every future request carries
that cookie automatically and the server knows who they are.

**Why we never say "wrong phone" or "wrong password" separately:**
If we did, an attacker could test phone numbers one by one until we
confirm one exists, then attack only that account. Saying "Invalid
credentials" for both cases reveals nothing — the attacker learns
nothing useful.

---

### Request body
| Field | Type | Rules |
|-------|------|-------|
| phone | string | 10–20 chars |
| password | string | 8–72 chars |

---

### Test 1 — Happy path (correct credentials)

**Why this test matters:**
If login doesn't work, no existing user can get back into their
account. Every feature behind authentication depends on this working.

**Command:**
```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0712345678","password":"password123"}'
```

**Expected response (HTTP 200):**
```json
{
  "message": "Logged in",
  "user_id": "a2806dff-6d6c-4a16-8eab-c02e136714c2",
  "tenant_id": "c63d4ed0-b971-4719-9db3-61ce9e499d95",
  "role": "owner"
}
```

**Result (confirmed 2026-10-13):** ✅ 200 as expected

**What happened behind the scenes:**
1. Zod validated phone and password
2. `SELECT` found the user by phone
3. `bcrypt.compare` verified password against the hash
4. `SELECT` found their membership — tenant_id and role
5. `jwt.sign` created a 7-day token
6. Token stored in httpOnly cookie — browser holds it automatically

---

### Test 2 — Wrong password

**Why this test matters:**
Confirms we return 401 and say "Invalid credentials" — not "wrong
password". An attacker should not be able to tell which field was wrong.

**Command:**
```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0712345678","password":"wrongpassword"}'
```

**Expected response (HTTP 401):**
```json
{ "error": "Invalid credentials" }
```

**Result (confirmed 2026-10-13):** ✅ 401 as expected

---

### Test 3 — Phone not found

**Why this test matters:**
Confirms we return the same 401 "Invalid credentials" whether the
phone doesn't exist OR the password is wrong. Identical response
both ways — attacker learns nothing.

**Command:**
```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0700000000","password":"password123"}'
```

**Expected response (HTTP 401):**
```json
{ "error": "Invalid credentials" }
```

**Result (confirmed 2026-10-13):** ✅ 401 as expected

---

### Test 4 — Validation failure

**Why this test matters:**
Confirms Zod catches bad input before we touch the database.
A 9-digit phone or 7-character password never reaches PostgreSQL.

**Command:**
```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"123","password":"short"}'
```

**Expected response (HTTP 400):**
```json
{
  "error": "Validation failed",
  "details": {
    "phone": ["String must contain at least 10 character(s)"],
    "password": ["String must contain at least 8 character(s)"]
  }
}
```

**Result (confirmed 2026-10-13):** # Login Endpoint

Base URL: `http://localhost:3000/v1`

---

## POST /login

### What this endpoint does
Authenticates an existing user. Looks up their phone number, verifies
their password against the bcrypt hash stored in the database, finds
their tenant and role, then issues a JWT token stored in an httpOnly
cookie.

After this call the user is "logged in" — every future request carries
that cookie automatically and the server knows who they are.

**Why we never say "wrong phone" or "wrong password" separately:**
If we did, an attacker could test phone numbers one by one until we
confirm one exists, then attack only that account. Saying "Invalid
credentials" for both cases reveals nothing — the attacker learns
nothing useful.

---

### Request body
| Field | Type | Rules |
|-------|------|-------|
| phone | string | 10–20 chars |
| password | string | 8–72 chars |

---

### Test 1 — Happy path (correct credentials)

**Why this test matters:**
If login doesn't work, no existing user can get back into their
account. Every feature behind authentication depends on this working.

**Command:**
```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0712345678","password":"password123"}'
```

**Expected response (HTTP 200):**
```json
{
  "message": "Logged in",
  "user_id": "a2806dff-6d6c-4a16-8eab-c02e136714c2",
  "tenant_id": "c63d4ed0-b971-4719-9db3-61ce9e499d95",
  "role": "owner"
}
```

**Result (confirmed 2026-10-13):** ✅ 200 as expected

**What happened behind the scenes:**
1. Zod validated phone and password
2. `SELECT` found the user by phone
3. `bcrypt.compare` verified password against the hash
4. `SELECT` found their membership — tenant_id and role
5. `jwt.sign` created a 7-day token
6. Token stored in httpOnly cookie — browser holds it automatically

---

### Test 2 — Wrong password

**Why this test matters:**
Confirms we return 401 and say "Invalid credentials" — not "wrong
password". An attacker should not be able to tell which field was wrong.

**Command:**
```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0712345678","password":"wrongpassword"}'
```

**Expected response (HTTP 401):**
```json
{ "error": "Invalid credentials" }
```

**Result (confirmed 2026-10-13):** ✅ 401 as expected

---

### Test 3 — Phone not found

**Why this test matters:**
Confirms we return the same 401 "Invalid credentials" whether the
phone doesn't exist OR the password is wrong. Identical response
both ways — attacker learns nothing.

**Command:**
```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0700000000","password":"password123"}'
```

**Expected response (HTTP 401):**
```json
{ "error": "Invalid credentials" }
```

**Result (confirmed 2026-10-13):** ✅ 401 as expected

---

### Test 4 — Validation failure

**Why this test matters:**
Confirms Zod catches bad input before we touch the database.
A 9-digit phone or 7-character password never reaches PostgreSQL.

**Command:**
```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"123","password":"short"}'
```

**Expected response (HTTP 400):**
```json
{
  "error": "Validation failed",
  "details": {
    "phone": ["String must contain at least 10 character(s)"],
    "password": ["String must contain at least 8 character(s)"]
  }
}
```

**Result (confirmed 2026-10-13):** ✅  400 as expected