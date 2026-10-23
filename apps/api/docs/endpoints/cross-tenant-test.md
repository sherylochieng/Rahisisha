# Cross-Tenant Isolation Test

**Week 28 Day 2**
**Tested:** 2026-10-23
**Base URL:** `http://localhost:3000/v1`

---

## What this test proves

Two tenants exist side by side in the same database:
- **Sheryl Shop** — slug `sheryl-shop`, owned by Sheryl Ochieng (`0712345678`)
- **Amina's Boutique** — slug `aminas-boutique`, owned by Amina Wanjiru (`+254700000001`)

The test proves that a logged-in user from Tenant A cannot read
data belonging to Tenant B — even if they know Tenant B's UUID.

This is enforced at two levels:
1. **Login level** — the Host header check in `login.js` ensures
   a user can only log in through their own tenant's subdomain.
2. **Query level** — `withTenant` middleware runs
   `set_config('app.tenant_id', ...)` before every query, activating
   Row Level Security. PostgreSQL then hides every row that does not
   belong to the current tenant — automatically, at the database level.

---

## Step 1 — Log in as Sheryl Shop owner

```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/login `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0712345678","password":"password123"}' `
  -SessionVariable session
```

Expected response — HTTP 200:

```json
{ "message": "Logged in", "tenant_id": "c63d4ed0-b971-4719-9db3-61ce9e499d95" }
```

The JWT cookie is now set in `$session`. It contains:
- `user_id` — Sheryl's user UUID
- `tenant_id` — Sheryl Shop's UUID (`c63d4ed0-...`)
- `role` — `owner`

---

## Step 2 — Attempt to fetch Amina's Boutique tenant data

Using Sheryl's cookie, try to access a resource scoped to
Amina's Boutique tenant ID `6549a72d-ab20-4bb0-8b93-fdaed96a8f77`.

When `withTenant` runs `set_config('app.tenant_id', 'c63d4ed0-...')`,
PostgreSQL's RLS policy filters every query to Sheryl's tenant only.
Amina's rows are invisible — the query returns nothing.

Expected result: **404** — resource not found (because RLS hid it).

---

## Why 404 and not 403?

403 means "you are not allowed." That tells an attacker the resource
exists but they cannot see it. 404 means "nothing here." RLS makes
Amina's data completely invisible to Sheryl — as if it does not exist.
Returning 404 leaks no information about what belongs to other tenants.

---

## What this proves

| Check | Result |
|---|---|
| Sheryl can log in to her own tenant | ✅ |
| Sheryl's JWT contains her own tenant_id only | ✅ |
| withTenant sets app.tenant_id to Sheryl's tenant | ✅ |
| Amina's data is invisible under Sheryl's session | ✅ |
| RLS enforcement happens at the database level | ✅ |

The isolation guarantee: even if a developer writes a bug and forgets
a WHERE clause, PostgreSQL will not return the wrong tenant's data.
The database is the last wall of defence.