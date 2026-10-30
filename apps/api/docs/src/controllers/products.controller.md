# products.controller.js

**Location:** `apps/api/src/controllers/products.controller.js`

---

## WHY THIS FILE EXISTS

It holds the **work** for each `/v1/products` address: check the input, ask the database, send the answer.

Routes only point to it. Controllers do the thinking.

---

## WHY IMPORTANT

This is where products are created, read, changed and removed. It is also where tenant safety can be broken by one careless line.

---

## DANGER

- Using `pool.query` instead of `req.db` skips the tenant check.
- Forgetting `tenant_id` in an INSERT saves a row that RLS cannot place.
- Taking `tenant_id` from the request body lets one shop pretend to be another.

---

## WHAT IT SOLVES

Five endpoints: list (with cursor pagination), create, get one, update, soft delete.

---

## SYSTEM DESIGN PRINCIPLE

- **Validate before the database** (zod).
- **Always `req.db`**, never `pool.query`.
- **Identity from the token** (`req.tenantId`), not from the body.
- **Soft delete** keeps history safe.
- **Money as integer cents.**

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Any CRUD resource: customers, invoices, bookings, tickets. Copy the pattern.

---

## TRADEOFFS

- **Cursor pagination** is stable and fast, but you cannot jump to "page 20".
- **Soft delete** keeps history, but every query must remember `deleted_at IS NULL`.
- **`COALESCE` PATCH** is simple, but you cannot set a field to `null` on purpose.

---

## HOW TO USE

Routes import the functions and wrap each in `asyncHandler`:

```js
router.get('/', asyncHandler(listProducts));
```

---

## THE FUNCTIONS, ONE BY ONE

### validationError(res, zodError)

Turns zod's list of problems into the standard sad note:

```json
{ "error": { "code": "validation", "message": "Request validation failed",
             "details": { "name": "Required" } } }
```

- Loops over `zodError.issues`.
- Uses `issue.path.join('.')` as the key, so nested fields like `items.0.quantity` each get their own line.
- Always status **400**.

### listProducts: GET /v1/products

- `limit` is capped at 100 so nobody can ask for 10,000 rows.
- Fetches **limit + 1** rows. If the extra row arrives, there is a next page.
- `nextCursor` is the id of the last row we return, or `null` on the last page.
- `WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR id > $1) ORDER BY id`.

**Think of it like this:** a bookmark. "Give me 10 after this one."

### createProduct: POST /v1/products

- `safeParse` validates without throwing.
- Defaults: `sku = null`, `description = null`, `status = 'draft'`.
- INSERT includes `tenant_id` from `req.tenantId`.
- Returns **201**.
- Duplicate SKU in the same shop (Postgres `23505`) returns **409**. Other errors are re-thrown so the central handler answers.

### getProduct: GET /v1/products/:id

- Returns **404** if not found, soft-deleted, **or belonging to another tenant** (RLS hides it).
- Same answer in all cases, so a thief cannot tell whether an ID exists.

### updateProduct: PATCH /v1/products/:id

- `ProductCreate.partial()` makes every field optional.
- `COALESCE($1, name)` means "use the new value, or keep the old one".
- `?? null` turns `undefined` into `null` so the query works.

### deleteProduct: DELETE /v1/products/:id

- **Soft delete:** sets `deleted_at = NOW()`.
- Old orders still make sense because the product row still exists.
- Returns **204** with no body, or **404** if nothing matched.

---

## KNOWN POINTS TO WATCH

- `priceCents` uses `.nonnegative()`, so **0 is allowed**. Change to `.positive()` if free products should be refused.
- Not found / duplicate responses have no `code` field. Only validation errors are required to.
