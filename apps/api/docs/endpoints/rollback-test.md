# Transaction Rollback Test

**Tested:** 2026-10-19
**Why this matters:** The signup transaction is ALL or NOTHING. If any
insert fails, every previous insert in the same transaction must be
undone. This test proves that guarantee holds.

---

## Setup — tenants before the test

```sql
SELECT slug FROM tenants;
```

Result:

aminas-boutique
sheryl-shop
test-shop
mctaba-shop
admin-corp

Count: 5

---

## The test — trigger a mid-transaction failure

Send a signup with a NEW slug but a phone number that already exists.
This causes:
- INSERT tenants (ghost-shop) → succeeds
- INSERT users (duplicate phone) → FAILS with error 23505
- ROLLBACK fires — tenants insert is undone

```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/signup `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0712345678","name":"Test User","password":"password123","tenant_name":"Ghost Shop","slug":"ghost-shop"}'
```

**Response — HTTP 409:**
```json
{ "error": "An account with that phone number already exists" }
```

---

## Proof — tenants after the test

```sql
SELECT slug FROM tenants;
```

Result:

aminas-boutique
sheryl-shop
test-shop
mctaba-shop
admin-corp

Count: 5 — unchanged. `ghost-shop` does not exist.

**Result (confirmed 2026-10-19):** ✅ ROLLBACK verified