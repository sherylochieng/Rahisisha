# Rahisisha API — Developer Index

This file documents what the API does, how it is structured,
and why decisions were made. Update it every time you add something new.

---

## What This API Does

Rahisisha is a multi-tenant SaaS backend for small Kenyan businesses.
"Multi-tenant" means many businesses (tenants) share one database,
but each business can only see its own data — never another business's data.

**Example:**
- Amina runs a dress shop (Tenant A)
- Brian runs an electronics shop (Tenant B)
- They share the same API and database
- Amina can never see Brian's products or orders — ever

This isolation is enforced at two levels:
1. **Row Level Security (RLS)** — Postgres itself blocks cross-tenant queries
2. **withTenant middleware** — sets the tenant context before every query

---

## Folder Structure

```
apps/api/
├── src/
│   ├── index.js                    Entry point. Starts the server, mounts all routes.
│   ├── app.js                      The Express app (no server start), so tests can import it.
│   ├── db/
│   │   └── pool.js                 One shared Postgres connection pool for the whole app.
│   ├── middleware/
│   │   ├── requireAuth.js          Checks the JWT token. Rejects requests with no/bad token.
│   │   └── withTenant.js           Reads tenant from JWT, sets req.db to tenant-scoped connection.
│   ├── routes/
│   │   ├── auth/
│   │   │   ├── auth.js             Combines signup + login + me into one router.
│   │   │   ├── signup.js           POST /v1/signup — creates a new tenant + owner account.
│   │   │   ├── login.js            POST /v1/login — returns a signed JWT cookie.
│   │   │   └── me.js               GET /v1/me — returns the logged-in user's profile.
│   │   ├── products.routes.js      Maps product URLs to controller functions.
│   │   └── orders.routes.js        Maps order URLs to controller functions.
│   └── controllers/
│       ├── products.controller.js  All product business logic and database queries.
│       └── orders.controller.js    All order business logic, state machine, transactions.
├── tests/
│   ├── pagination/
│   │   └── products.pagination.test.js     Cursor pagination returns every product once.
│   └── isolation/
│       ├── products.isolation.test.js      Cross-tenant checks for orders.
│       └── products.cross-tenant.test.js   Cross-tenant checks for products.
└── docs/
    └── INDEX.md                    This file.
```

---

## Request Lifecycle

Every request travels through this chain before reaching a controller:

```
Incoming request
      |
      v
  helmet()          adds security headers
  express.json()    parses the request body
  cookieParser()    reads cookies (JWT lives here)
  cors()            allows requests from the frontend
      |
      v
  requireAuth       verifies the JWT, sets req.userId, req.tenantId, req.role
      |
      v
  withTenant        sets req.db (tenant-scoped DB connection)
      |
      v
  Controller        validates input, queries DB, sends response
```

If any step fails (bad JWT, unknown tenant, invalid input),
the chain stops there and an error is returned.
The controller only runs if every step above it passed.

---

## API Endpoints

### Auth (public — no JWT required)

| Method | URL          | What it does                          |
|--------|--------------|---------------------------------------|
| POST   | /v1/signup   | Create a new tenant and owner account |
| POST   | /v1/login    | Log in, receive a JWT cookie          |
| GET    | /v1/me       | Get the logged-in user's profile      |

### Products (protected — JWT + tenant required)

| Method | URL                  | What it does                     |
|--------|----------------------|----------------------------------|
| GET    | /v1/products         | List products (cursor paginated) |
| POST   | /v1/products         | Create a new product             |
| GET    | /v1/products/:id     | Fetch one product                |
| PATCH  | /v1/products/:id     | Partially update a product       |
| DELETE | /v1/products/:id     | Soft delete a product            |

### Orders (protected — JWT + tenant required)

| Method | URL                       | What it does                             |
|--------|---------------------------|------------------------------------------|
| POST   | /v1/orders                | Create a new order (with transaction)    |
| GET    | /v1/orders                | List orders (cursor paginated)           |
| GET    | /v1/orders/:id            | Fetch one order                          |
| PATCH  | /v1/orders/:id            | Update order status (state machine only) |

---

## Key Patterns

### 1. Always req.db — never pool.query

```js
// Correct — uses tenant-scoped connection
const { rows } = await req.db.query('SELECT * FROM products')

// Wrong — bypasses tenant isolation, data leaks between tenants
const { rows } = await pool.query('SELECT * FROM products')
```

`req.db` is set by `withTenant` middleware. It holds a connection
where Postgres knows which tenant is active. RLS uses this to
filter every query automatically.

### 2. Validation before database

Every POST and PATCH runs Zod validation before touching the database.
If input is invalid, the request is rejected immediately with this shape:

```json
{
  "error": {
    "code": "validation",
    "message": "Request validation failed",
    "details": {
      "priceCents": "Expected number, received string"
    }
  }
}
```

### 3. Soft delete on products

Products are never hard-deleted. Instead, `deleted_at` is stamped with NOW().
All queries filter `WHERE deleted_at IS NULL` to hide deleted products.

**Why?** Orders reference products. Hard delete would break order history.

### 4. Order state machine

Orders follow a strict status path:

```
created -> paid -> packed -> sent -> delivered
   |          |       |        |
cancelled  cancelled cancelled cancelled
```

Illegal transitions (e.g. created -> delivered) are rejected with 409.
Unknown status values (e.g. "bananas") are rejected with 400 validation.
Enforced in `orders.controller.js` via the `STATUS_TRANSITIONS` object.

### 5. Cursor pagination (not offset)

```
Offset:  SELECT ... LIMIT 10 OFFSET 20          breaks if rows inserted mid-pagination
Cursor:  SELECT ... WHERE id > $lastId LIMIT 10  always stable
```

All list endpoints return `nextCursor`.
Pass it as `?cursor=<id>` on the next request.

### 6. Transactions on orders

Creating an order touches multiple tables:
1. Upsert customer
2. Fetch products
3. Create order row
4. Insert order_items

If any step fails, `BEGIN/ROLLBACK` undoes everything.
If all steps succeed, `COMMIT` saves everything at once.

### 7. Every INSERT includes tenant_id

RLS filters reads automatically, but it never fills in `tenant_id` on writes.
Every INSERT must pass `req.tenantId` explicitly.

```js
// Correct
INSERT INTO products (tenant_id, name, ...) VALUES ($1, $2, ...)  -- [req.tenantId, name, ...]

// Wrong — row has no owner, and the insert fails or lands in no tenant
INSERT INTO products (name, ...) VALUES ($1, ...)
```

`req.tenantId` comes from the signed JWT, never from the request body,
so a caller cannot pick another tenant.

---

## Money Rule

**Always store prices as integer cents in KES. Never use floats.**

```
KES 350.00  ->  stored as 35000
KES 3,500   ->  stored as 350000
```

**Why?** `0.1 + 0.2 = 0.30000000000000004` in floating point.
Integer cents have no rounding errors.
The frontend divides by 100 when displaying to users.

---

## Tests

Run from `apps/api`: `npm test`

| File | What it proves |
|------|----------------|
| `tests/pagination/products.pagination.test.js` | Cursor pagination returns every product exactly once and the cursor ends |
| `tests/isolation/products.isolation.test.js` | Brio cannot read Acme's orders (404) |
| `tests/isolation/products.cross-tenant.test.js` | Brio cannot read, list, edit or delete Acme's products (404) |

Test cleanup uses a helper that sets the tenant first, because RLS applies to
the test database user too. A plain DELETE would silently delete nothing.

---

## What Is Coming Next

| Feature                             | Week            |
|-------------------------------------|-----------------|
| Dashboard UI (products, orders)     | Week 28 Day 4-5 |
| M-Pesa STK push integration         | Week 29         |
| WhatsApp Cloud API                  | Week 29         |
| AI product enhancement (Claude API) | Week 29         |
| BullMQ background jobs              | Week 29         |
| VPS deployment (Docker)             | Week 30         |

---

*Last updated: Week 28 Day 3*  
*Update this file every time a new endpoint or pattern is added.*