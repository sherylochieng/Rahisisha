# Rahisisha API: File-by-File Guides

These guides explain **why** each file exists, not just what it does.

The folders match the code, so the guide for `src/middleware/withTenant.js` is in `docs/src/middleware/withTenant.md`.

---

## HOW EACH GUIDE IS ARRANGED

1. **WHY THIS FILE EXISTS**
2. **WHY IMPORTANT**
3. **DANGER** (what breaks without it)
4. **WHAT IT SOLVES**
5. **SYSTEM DESIGN PRINCIPLE**
6. **WHERE YOU WILL USE THIS IN FUTURE PROJECTS**
7. **TRADEOFFS**
8. **HOW TO USE**
9. The code, piece by piece

---

## READING ORDER (follow one request)

1. `src/app.md`: how a request enters and how errors leave
2. `src/db/pool.md`: where connections come from
3. `src/middleware/withTenant.md`: how a tenant is attached
4. `src/middleware/asyncHandler.md`: how crashes are caught
5. `src/routes/routes.md`: the address book
6. `src/controllers/products.controller.md`
7. `src/controllers/orders.controller.md`
8. `tests/`: the proof

---

## FOLDER MAP

```
docs/
  README.md
  src/
    app.md
    db/pool.md
    middleware/withTenant.md
    middleware/asyncHandler.md
    routes/routes.md
    controllers/products.controller.md
    controllers/orders.controller.md
  tests/
    pagination/products.pagination.test.md
    isolation/orders.isolation.test.md
    isolation/products.cross-tenant.test.md
    errors/error-handling.test.md
```

---

## THE RULES THAT NEVER CHANGE

1. The app connects to the database as an **ordinary** user, never a superuser.
2. Controllers use **`req.db`**, never `pool.query`.
3. Every INSERT includes **`tenant_id`** from the token, never from the body.
4. `set_config(..., false)` without a transaction. `true` only inside `BEGIN ... COMMIT`.
5. Every borrowed connection is returned **exactly once**.
6. Wrap every async controller in **`asyncHandler`**, and keep the error handler **last**.
7. Malformed ID is **400**. Missing or another tenant's row is **404**.
8. Tests obey the same security rules and clean up after themselves.
9. The `.env` file **never** goes to GitHub.

---

## NOT YET DOCUMENTED

Guides for `requireAuth.js`, the SQL migrations (RLS policies), `index.js` and the config files are not here yet. Share those files and they can be added in the same style.
