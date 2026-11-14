# Rahisisha API: Developer Index

This file documents what the API does, how it is structured,
and why decisions were made. Update it every time you add something new.

For a deeper, file-by-file explanation, see the guides in `docs/src/` and
`docs/tests/` and the reading order in `apps/api/README.md`.

The live (staging) setup is described in `capstone/STAGING.md`.

---

## What This API Does

Rahisisha is a multi-tenant SaaS backend for small Kenyan businesses.
"Multi-tenant" means many businesses (tenants) share one database,
but each business can only see its own data, never another business's data.

**Example:**
- Amina runs a dress shop (Tenant A)
- Brian runs an electronics shop (Tenant B)
- They share the same API and database
- Amina can never see Brian's products or orders, ever

This isolation is enforced at two levels:
1. **Row Level Security (RLS):** Postgres itself blocks cross-tenant queries
2. **withTenant middleware:** sets the tenant context before every query

---

## Folder Structure

```
apps/api/
├── README.md                           Reading order and permanent rules for the guides.
├── src/
│   ├── index.js                        Entry point. Starts the server, mounts all routes.
│   ├── app.js                          The Express app (no server start), so tests can import it.
│   │                                   Also holds the CORS setting and the central error handler.
│   ├── db/
│   │   └── pool.js                     One shared Postgres connection pool for the whole app.
│   ├── middleware/
│   │   ├── requireAuth.js              Checks the JWT token. Rejects requests with no/bad token.
│   │   ├── withTenant.js               Reads tenant from JWT, sets req.db to tenant-scoped connection.
│   │   ├── asyncHandler.js             Wraps async controllers so thrown errors reach the error handler.
│   │   ├── resolveUssdTenant.js        USSD guard: finds the shop from the dialled service code, sets req.tenantId (Week 29 Day 1).
│   │   └── resolveWhatsappTenant.js    WhatsApp guard: finds the shop from Meta's phone_number_id, sets req.tenantId (Week 29 Day 2).
│   ├── utils/
│   │   ├── allowedOrigin.js            CORS rule: which websites may call the API (main site + every shop).
│   │   ├── getShopSlug.js              Finds the shop word from the Origin (then Host) header.
│   │   └── kms.js                      Encrypts and decrypts stored secrets (AES-256-GCM, key in KMS_KEY, locked to the shop id) (Week 29 Day 2).
│   ├── routes/
│   │   ├── auth/
│   │   │   ├── auth.js                 Combines signup + login + me into one router.
│   │   │   ├── signup.js               POST /v1/signup: creates a new tenant + owner account.
│   │   │   ├── login.js                POST /v1/login: finds the shop, returns a signed JWT cookie.
│   │   │   └── me.js                   GET /v1/me: returns the logged-in user's profile.
│   │   ├── products.routes.js          Maps product URLs to controller functions.
│   │   ├── orders.routes.js            Maps order URLs to controller functions.
│   │   ├── dashboard.routes.js         GET /v1/dashboard (protected).
│   │   ├── tenants.routes.js           GET /v1/tenants/by-slug/:slug (public).
│   │   ├── ussd.routes.js              POST /ussd (public, mounted with resolveUssdTenant + withTenant).
│   │   └── whatsapp.routes.js          GET and POST /webhooks/whatsapp (public: Meta has no login cookie) (Week 29 Day 2).
│   ├── services/
│   │   ├── wallet.service.js           Append-only money ledger: credit, debit, balance.
│   │   └── whatsapp.service.js         sendWhatsApp(db, to, body): decrypts the shop's token at the last moment and sends (Week 29 Day 2).
│   └── controllers/
│       ├── products.controller.js      All product business logic and database queries.
│       ├── orders.controller.js        All order business logic, state machine, transactions.
│       ├── dashboard.controller.js     Dashboard numbers: orders today, wallet balance, latest products.
│       ├── tenants.controller.js       Public shop lookup by slug (used by the web proxy).
│       ├── ussd.controller.js          USSD menu: welcome, 1 products, 2 balance, 3 exit. Every reply 182 characters or less.
│       └── whatsapp.controller.js      Verify handshake (GET) and inbound messages (POST): dedupe, customer, conversation, message in one transaction (Week 29 Day 2).
├── tests/
│   ├── pagination/
│   │   └── products.pagination.test.js     Cursor pagination returns every product once.
│   ├── isolation.test.js                   Attacks all 17 tenant tables at the database level (whatsapp_dedupe joined in Week 29 Day 2).
│   ├── kms.test.js                         Encryption: round trip, fresh IV, tamper, wrong shop, wrong key, generic error (9 tests).
│   ├── whatsapp.service.test.js            Sender uses the right shop's token, never logs it, never leaks it in an error (10 tests).
│   ├── wallet.service.test.js              Wallet ledger: credit, debit, bad amounts, balance.
│   ├── allowedOrigin.test.js               CORS rule: shops in, look-alikes and garbage out (13 tests).
│   ├── getShopSlug.test.js                 Shop word from headers, including the exact online bug (14 tests).
│   ├── isolation/
│   │   ├── orders.isolation.test.js        Cross-tenant checks for orders.
│   │   ├── products.cross-tenant.test.js   Cross-tenant checks for products.
│   │   ├── login-lookup.isolation.test.js  Attacks the login_lookup rule on memberships.
│   │   ├── ussd.cross-tenant.test.js       USSD: dialling shop A never shows shop B (8 checks, own shops).
│   │   └── whatsapp.cross-tenant.test.js   WhatsApp: a message for shop A never reaches shop B; dedupe is per shop (11 checks, own shops).
│   ├── signup-atomic.test.js               Signup is all-or-nothing: a failed seeding leaves no user and no shop.
│   └── errors/
│       ├── error-handling.test.js          Bad input gets a clean answer and no connection leaks.
│       └── not-found.test.js               Unknown URLs answer 404 in JSON, not HTML.
├── scripts/
│   └── seed-whatsapp-demo.js           Demo WhatsApp settings for two shops, with fake encrypted tokens. Refuses production (Week 29 Day 2).
└── docs/
    ├── INDEX.md                        This file.
    ├── AI_AUDIT_week_28_day3.md        Record of what AI wrote and what was done by hand.
    ├── AI_AUDIT_week_28_day4.md        Same, for Day 4 (isolation suite, wallet).
    ├── AI_AUDIT_week_28_day5.md        Same, for Day 5 (dashboard, login_lookup, hooks).
    ├── AI_AUDIT_week_28_weekend.md     Same, for the Week 28 Weekend (Core Polish, staging).
    ├── AI_AUDIT_week_29_day1.md        Same, for Week 29 Day 1 (USSD per tenant). States openly that tenant resolution was AI-written.
    ├── AI_AUDIT_week_29_day2.md        Same, for Week 29 Day 2 (WhatsApp per tenant). States openly that token handling and tenant resolution were AI-written, at the student's choice.
    ├── SEEDS_AND_SCRIPTS.md            Index of every seed and script, which folder each belongs in, and the fresh-setup order (Week 29 Day 2).
    ├── src/                            One guide per source file (same folders as src/).
    │   ├── middleware/
    │   │   ├── resolveUssdTenant.md    Guide for the USSD tenant guard.
    │   │   └── resolveWhatsappTenant.md  Guide for the WhatsApp tenant guard.
    │   ├── utils/
    │   │   ├── allowedOrigin.md        Guide for the CORS rule.
    │   │   ├── getShopSlug.md          Guide for the shop lookup.
    │   │   └── kms.md                  Guide for the encryption helper.
    │   ├── services/
    │   │   └── whatsapp.service.md     Guide for the shared WhatsApp sender.
    │   ├── controllers/
    │   │   └── whatsapp.controller.md  Guide for the verify handshake and inbound messages.
    │   └── routes/
    │       └── whatsapp.routes.md      Guide for the WhatsApp routes.
    ├── scripts/
    │   └── seed-whatsapp-demo.md       Guide for the WhatsApp demo seed script.
    └── tests/                          One guide per test file (same folders as tests/).
        ├── isolation-proof.md          Evidence that every tenant table is locked (RLS).
        ├── allowedOrigin.test.md       Guide for the CORS tests.
        ├── getShopSlug.test.md         Guide for the shop lookup tests.
        ├── ussd.cross-tenant.test.md   Guide for the USSD cross-tenant test.
        ├── kms.test.md                 Guide for the encryption tests.
        ├── whatsapp.cross-tenant.test.md  Guide for the WhatsApp cross-tenant test.
        ├── whatsapp.service.test.md    Guide for the WhatsApp sender tests.
        ├── not-found.test.md           Guide for the JSON 404 test.
        └── signup-atomic.test.md       Guide for the all-or-nothing signup test.
```

Database files live outside `apps/api`: migrations in `sql/migrations/` (latest:
`024_whatsapp_configs.sql`, added in Week 29 Day 2; before it `023_ussd_configs.sql` from Day 1 and `022_login_membership_lookup.sql`)
and the full schema in `sql/SCHEMA.sql`. Seed files are in `sql/seeds/`
(`ussd_configs_seed.sql` and `ussd_demo_data_seed.sql`, both safe to run many times).
The USSD notes are in `ussd-quirks.md` and the WhatsApp security notes in `whatsapp-security.md`, both at the repo root.
Seeds and scripts are indexed in `docs/SEEDS_AND_SCRIPTS.md` (SQL only in `sql/seeds/`; whole-repo helpers in root `scripts/`; helpers that use the API's own code in `apps/api/scripts/`).

Other files added in Week 28 Weekend, outside `apps/api/src`:
`scripts/reset-db.sh` (rebuilds a database; refuses anything but localhost unless
told otherwise), `demo-data.sql`, `.github/workflows/ci.yml` (the robot that runs
the tests on every push) and `capstone/STAGING.md` (the live setup).

---

## Request Lifecycle

Every request travels through this chain before reaching a controller:

```
Incoming request
      |
      v
  helmet()          adds security headers
  express.json()    parses the request body
  express.urlencoded()  parses form data (Africa's Talking sends USSD this way)
  cookieParser()    reads cookies (JWT lives here)
  cors()            allows the main site and every shop address
                    (the rule is in utils/allowedOrigin.js)
      |
      v
  requireAuth       verifies the JWT, sets req.userId, req.tenantId, req.role
      |
      v
  withTenant        sets req.db (tenant-scoped DB connection)
      |
      v
  asyncHandler(     runs the controller; if it throws, the error is
    Controller )    passed on with next(err)
      |
      v
  Controller        validates input, queries DB, sends response
```

Two kinds of route skip part of this chain:

- **Public routes** (`/v1/signup`, `/v1/login`, `/v1/tenants/by-slug/:slug`) run
  without `requireAuth` and `withTenant`.
- **USSD** (`/ussd`) has no login cookie, so `requireAuth` is not used. It runs
  `resolveUssdTenant` (finds the shop from the dialled service code), then
  `withTenant`, then the controller.
- **WhatsApp** (`/webhooks/whatsapp`) has no login cookie either, because Meta's
  servers call it. The `GET` (verify handshake) needs no shop lock. The `POST` runs
  `resolveWhatsappTenant` (finds the shop from `phone_number_id`), then `withTenant`,
  then the controller (Week 29 Day 2).
- **Dashboard** (`/v1/dashboard`) runs the full chain: `requireAuth`, then
  `withTenant`, then the controller.

If any step fails (bad JWT, unknown tenant, invalid input),
the chain stops there and an error is returned.
The controller only runs if every step above it passed.

If a controller throws, the error travels past the routes to the
**central error handler** at the bottom of `app.js`, which always sends a
response. Once the response finishes, `withTenant` resets the tenant setting
and returns the database connection to the pool.

A URL that matches no route is caught just before the error handler by a
catch-all and answered with a JSON 404 (not Express's HTML page).

---

## API Endpoints

### Auth (public, no JWT required)

| Method | URL          | What it does                                                        |
|--------|--------------|---------------------------------------------------------------------|
| POST   | /v1/signup   | Create a new tenant and owner account                               |
| POST   | /v1/login    | Find the shop from the address, log in, receive a JWT cookie        |
| GET    | /v1/me       | Get the logged-in user's profile                                    |

### Tenants (public, no JWT required)

| Method | URL                          | What it does                                                    |
|--------|------------------------------|-----------------------------------------------------------------|
| GET    | /v1/tenants/by-slug/:slug    | Find an active shop by its slug (404 if unknown). Used by the web proxy. |

### USSD (public on purpose: a phone has no login cookie)

| Method | URL    | What it does                                                                 |
|--------|--------|------------------------------------------------------------------------------|
| POST   | /ussd  | Africa's Talking posts form data (`serviceCode`, `sessionId`, `phoneNumber`, `text`). The shop is found from `serviceCode`. Replies are plain text starting with `CON ` or `END `, at most 182 characters |

### WhatsApp (public on purpose: Meta's servers have no login cookie) (Week 29 Day 2)

| Method | URL                  | What it does                                                                 |
|--------|----------------------|------------------------------------------------------------------------------|
| GET    | /webhooks/whatsapp   | Meta's verify handshake. Query: `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`. Answers 200 with the challenge only if the token belongs to a shop and the challenge is plain (letters, digits, `_`, `-`, up to 200); otherwise 403 |
| POST   | /webhooks/whatsapp   | Inbound messages. The shop is found from `entry[0].changes[0].value.metadata.phone_number_id`. An unknown or missing number answers 200 `{ data: { ignored: true }, error: null }` (so Meta does not retry). A known one saves the customer, conversation and message once, and answers with a count of saved and duplicate messages |

### Dashboard (protected: JWT + tenant required)

| Method | URL           | What it does                                                                 |
|--------|---------------|------------------------------------------------------------------------------|
| GET    | /v1/dashboard | Returns `{ data: { ordersToday, balanceCents, latestProducts } }` for the logged-in shop |

### Products (protected: JWT + tenant required)

| Method | URL                  | What it does                     |
|--------|----------------------|----------------------------------|
| GET    | /v1/products         | List products (cursor paginated) |
| POST   | /v1/products         | Create a new product             |
| GET    | /v1/products/:id     | Fetch one product                |
| PATCH  | /v1/products/:id     | Partially update a product       |
| DELETE | /v1/products/:id     | Soft delete a product            |

### Orders (protected: JWT + tenant required)

| Method | URL                       | What it does                             |
|--------|---------------------------|------------------------------------------|
| POST   | /v1/orders                | Create a new order (with transaction)    |
| GET    | /v1/orders                | List orders (cursor paginated)           |
| GET    | /v1/orders/:id            | Fetch one order                          |
| PATCH  | /v1/orders/:id            | Update order status (state machine only) |

### Status codes you will see

| Code | Meaning                                                                |
|------|------------------------------------------------------------------------|
| 200  | OK                                                                     |
| 201  | Created (new product or order)                                        |
| 204  | Deleted (soft delete, nothing to return)                               |
| 400  | Validation failed, unknown order status, or malformed ID               |
| 401  | Not logged in, or the session expired                                  |
| 404  | Not found. Also what another tenant's record looks like (RLS hides it). At login, an unknown shop word gives `Tenant not found`. An unknown URL gives JSON `{ data: null, error: { code: 'not_found' } }` (Week 29 Day 1) |
| 409  | Conflict: duplicate SKU, or an illegal order status change             |
| 500  | Unexpected server error (details are logged, never sent to the caller) |
| 503  | The database cannot be reached: a friendly "try again" answer          |

---

## Key Patterns

### 1. Always req.db, never pool.query

```js
// Correct: uses tenant-scoped connection
const { rows } = await req.db.query('SELECT * FROM products')

// Wrong: bypasses tenant isolation, data leaks between tenants
const { rows } = await pool.query('SELECT * FROM products')
```

`req.db` is set by `withTenant` middleware. It holds a connection
where Postgres knows which tenant is active. RLS uses this to
filter every query automatically.

`withTenant` sets `app.current_tenant` for the whole connection
(`set_config(..., false)`). The transaction-only form (`true`) loses the
setting after one query when no transaction is open, and the next query then
fails with `invalid input syntax for type uuid: ""`.

Because the setting lasts for the connection, `withTenant` runs
`RESET app.current_tenant` before giving the connection back. If the reset
fails, the connection is destroyed instead of reused.

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

Every validation failure uses this same shape, with the same `message`.
Each broken field gets its own entry in `details`. Nested fields use a dotted
path, for example `items.0.quantity`, so two bad items never overwrite each
other. An unknown order status returns `details: { status: ... }` and a
malformed ID returns `details: { id: ... }`.

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
Enforced in `orders.controller.js` via the `STATUS_TRANSITIONS` object,
checked with `Object.hasOwn` so inherited names like `constructor` are
not accepted as statuses.

### 5. Cursor pagination (not offset)

```
Offset:  SELECT ... LIMIT 10 OFFSET 20          breaks if rows inserted mid-pagination
Cursor:  SELECT ... WHERE id > $lastId LIMIT 10  always stable
```

All list endpoints return `nextCursor`.
Pass it as `?cursor=<id>` on the next request.
The query fetches `limit + 1` rows; the extra row tells us a next page exists.

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

// Wrong: row has no owner, and the insert fails or lands in no tenant
INSERT INTO products (name, ...) VALUES ($1, ...)
```

`req.tenantId` comes from the signed JWT, never from the request body,
so a caller cannot pick another tenant.

### 8. Errors always get an answer

This project uses Express 4, which does NOT catch errors thrown inside
`async` functions. Without help, a failed database query makes the request hang
and the pooled connection is never given back. Enough of those freeze the API
for every tenant.

The fix has two parts:

1. **`asyncHandler`** wraps every controller in the route files:
   ```js
   router.get('/:id', asyncHandler(getOrder));
   ```
   If the controller throws, the error is passed on with `next(err)`.

2. **The central error handler** at the bottom of `app.js` (after all routes)
   answers every error:
   - Postgres code `22P02` (malformed ID like `/v1/orders/not-a-uuid`) -> 400
     with the standard `validation` envelope and `details: { id: ... }`
   - Anything else -> the real error is logged on the server, and the caller
     gets a generic 500 (`Something went wrong`), so no database details leak

Rule for new routes: wrap every async controller in `asyncHandler`
(and import it in that routes file).

### 9. Login has its own read-only rule (login_lookup)

At login nobody has a shop stamped on the connection yet, so the shop rule hides
every membership row. Migration 022 added a second rule, `login_lookup`, on
`memberships`:

- It is `FOR SELECT` only (read, never write).
- It shows a person only their own rows, while `app.login_user` is set.
- `login.js` sets `app.login_user` **only after the password is verified**, inside
  a short transaction, with `set_config(..., true)`. It disappears at `COMMIT`.
- The policies use `NULLIF(current_setting(...), '')::UUID`. After a `RESET`, a
  custom setting returns `''` (not NULL), and `''::uuid` would crash.

Tested by `tests/isolation/login-lookup.isolation.test.js`. That test checks the
database rule, not `login.js`, so the rule is only as safe as the code that sets
`app.login_user`.

### 10. Signup stamps the shop before writing the membership

`memberships` has RLS, so `signup.js` runs
`set_config('app.current_tenant', <new shop id>, true)` right after inserting the
tenant. Without it, the membership insert is refused.

### 11. Money lives in an append-only ledger

`wallet_entries` is never edited. `services/wallet.service.js` exposes `credit`,
`debit` (stored as a negative number) and `balance` (the sum, returned as a
Number). Balances are never stored, because sums cannot drift. Bad amounts are
refused before anything is written.

### 12. CORS is a rule, not a list (Week 28 Weekend)

**BEFORE:** one allowed address (`WEB_ORIGIN`). **AFTER:** `utils/allowedOrigin.js`
allows `WEB_ORIGIN`, the bare `ROOT_DOMAIN`, and anything ending in `.ROOT_DOMAIN`.

**Story:** online, every shop has its own address, so a single allowed address
blocked every shop from logging in. The rule needs the **dot** (`.rahisishabiashara.com`)
so that `evilrahisishabiashara.com` is refused. In production only `https://` is
allowed. With no `ROOT_DOMAIN` (a laptop) only `WEB_ORIGIN` is allowed.

### 13. The shop is read from the Origin, not the Host (Week 28 Weekend)

`utils/getShopSlug.js` reads the shop word from the **Origin** header first (the
page the person was on), then from Host. `www` and `api` are never shops, and
the bare domain is not a shop.

**Story:** online, the browser sends login to `api.rahisishabiashara.com`, so
reading Host always gave the word `api` and every login said "Shop not found".
Tested by `tests/getShopSlug.test.js`, including the exact bug.

### 14. USSD finds the shop from the service code, never from the phone (Week 29 Day 1)

`POST /ussd` is one shared endpoint for every shop. The route is mounted in
`app.js` as `app.use('/ussd', resolveUssdTenant, withTenant, ussdRouter)`:

1. **`resolveUssdTenant`** reads `serviceCode`, looks it up in `ussd_configs`,
   and sets `req.tenantId`. An unknown code gets `END Service unavailable`.
2. **`withTenant`** (the same one every web route uses) sets `app.current_tenant`
   on a connection and gives it to the controller as `req.db`.
3. **`handleUssd`** builds the menu using `req.db` only, with no hand-written
   `WHERE tenant_id`. RLS does the filtering.

Same "stamp, then lock" pattern as `requireAuth -> withTenant`. Only the first
step is different, because a phone has no login cookie.

**Rules:** never use the phone number as the shop (one phone can shop at many
shops and numbers can be faked). `ussd_configs` has **no RLS** on purpose, since
the shop must be found before it is known (same trap as login before migration
022). Africa's Talking sends **form data**, so `app.js` has
`express.urlencoded({ extended: false })`. Every reply must be 182 characters or
less (`cap()` in the controller). Tested by `tests/isolation/ussd.cross-tenant.test.js`.

### 15. Unknown URLs answer in JSON (Week 29 Day 1)

A catch-all handler in `app.js`, **after every route and before the error
handler**, answers `404` with `{ data: null, error: { code: 'not_found', message: 'Route not found' } }`.
**BEFORE:** Express sent its own HTML page ("Cannot GET ..."), which crashes
`res.json()` in the website. It does not repeat the URL back. Tested by
`tests/errors/not-found.test.js`, which also checks that `/health` still works.

### 16. Signup is all-or-nothing (Week 29 Day 1)

The shop, the owner, the membership and the 3 sample products and 2 sample
customers are written in **one transaction**, and the sample data uses the same
`client`, never `pool`. If seeding fails, `ROLLBACK` undoes everything.
Tested by `tests/signup-atomic.test.js`, which makes seeding explode and checks
that no user and no shop are left behind.

### 17. WhatsApp finds the shop from the phone number id, and tokens stay encrypted (Week 29 Day 2)

`/webhooks/whatsapp` is one shared endpoint for every shop. `POST` is mounted as
`router.post('/', resolveWhatsappTenant, withTenant, asyncHandler(handleInbound))`:

1. **`resolveWhatsappTenant`** reads `phone_number_id` from Meta's payload, looks it
   up in `whatsapp_configs`, and sets `req.tenantId`. An unknown or missing number
   gets `200 ignored`, never an error, so Meta does not retry forever.
2. **`withTenant`** sets `app.current_tenant` and gives the controller `req.db`.
3. **`handleInbound`** runs **one transaction** (`BEGIN`/`COMMIT`/`ROLLBACK` on `req.db`):
   the dedupe row (`INSERT INTO whatsapp_dedupe ... ON CONFLICT DO NOTHING`, 0 rows
   means a duplicate), the customer upsert, the conversation and the message. If
   anything fails, nothing is kept, so Meta's retry works. Non-text messages are
   stored as `[image]`, `[audio]` and so on.

**Rules:** never take the shop from anything the caller types. `whatsapp_configs` has
**no RLS** on purpose (same trap as `ussd_configs`); `whatsapp_dedupe` **has** RLS and
its key is `(tenant_id, message_id)`, so dedupe is per shop. The `GET` handshake only
echoes a challenge that matches `^[A-Za-z0-9_-]{1,200}$`. Tested by
`tests/isolation/whatsapp.cross-tenant.test.js`.

### 18. Secrets are encrypted at rest and decrypted at the last moment (Week 29 Day 2)

A shop's WhatsApp access token is stored in `whatsapp_configs.access_token_encrypted`
as `v1.<iv>.<tag>.<ciphertext>` (`utils/kms.js`):

- **AES-256-GCM** with a key from `KMS_KEY` (32 bytes, base64), read at call time
- a **fresh 12-byte IV** for every encryption
- the **shop id is bound in** as additional data, so a token copied into another
  shop's row will not decrypt (row-swap defence)
- every failure gives the same message, `Could not decrypt the stored secret`

`sendWhatsApp(db, to, body)` (`services/whatsapp.service.js`) filters
`whatsapp_configs` by the current shop lock (the table has no RLS, so the filter is
written by hand), decrypts only inside the call, and sends to Meta with a 10 second
timeout. A failed send carries only the status code (401 or 403 sets
`err.code = 'whatsapp_token_rejected'`). **The token is never logged and never put
in an error**; the file has no `console` calls. Tested by `tests/kms.test.js` and
`tests/whatsapp.service.test.js`. The security notes are in `whatsapp-security.md`.

---

## Settings (environment variables)

| Name | What it does |
|------|--------------|
| `DATABASE_URL` | The app's database login. Must be a user that is **not** a superuser and does **not** have BYPASSRLS, or the shop locks do nothing |
| `JWT_SECRET` | Signs login tokens. Keep it long and secret |
| `NODE_ENV` | `production` turns on `Secure` cookies and https-only CORS |
| `WEB_ORIGIN` | The main site address (on a laptop, `http://localhost:3001`) |
| `ROOT_DOMAIN` | The main domain, for example `rahisishabiashara.com`. Turns on the "every shop" CORS rule and the Origin-based shop lookup |
| `COOKIE_DOMAIN` | Lets the login cookie work across shop addresses (online only) |
| `PORT` | Port the server listens on |
| `KMS_KEY` | Encrypts stored secrets (WhatsApp tokens). 32 bytes, base64 (44 characters). Never commit it; `.env.example` has a placeholder. If it is lost, every stored token is unreadable (Week 29 Day 2) |
| `WHATSAPP_API_BASE` | Optional. Where WhatsApp messages are sent. Defaults to `https://graph.facebook.com`; tests point it at a fake |
| `WHATSAPP_API_VERSION` | Optional. Meta's API version. Defaults to `v21.0` |

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
Run only the isolation suites: `npm run test:isolation`

Current result (13 November 2026, Week 29 Day 2): **22 suites, 198 tests passing**. Isolation only: 6 suites, 100 tests.
Earlier result (13 November 2026, Week 29 Day 1): 19 suites, 168 tests passing. Isolation only: 5 suites, 89 tests.
Earlier result (10 November 2026): 15 suites, 141 tests passing. Isolation only: 81 tests.
A Husky `pre-push` hook runs `npm run test:isolation` before every push.
The same tests run on every push in CI (`.github/workflows/ci.yml`), against a
fresh Postgres built by `scripts/reset-db.sh`.

| File | What it proves |
|------|----------------|
| `tests/isolation.test.js` | A second shop cannot read, update or delete another shop's row in any of the 17 tenant tables, and RLS is enabled and forced on all of them. `whatsapp_dedupe` has no `id` column, so it is covered by the coverage guards and by its own checks in `whatsapp.cross-tenant.test.js` (Week 29 Day 2) |
| `tests/isolation/login-lookup.isolation.test.js` | The `login_lookup` rule shows only the named person's row, and UPDATE, DELETE and INSERT all fail |
| `tests/wallet.service.test.js` | Credit and debit work, bad amounts are refused and write nothing, balance is a number, unknown reasons are refused by the database |
| `tests/pagination/products.pagination.test.js` | Cursor pagination returns every product exactly once and the cursor ends |
| `tests/isolation/orders.isolation.test.js` | Brio cannot read Acme's orders (404) |
| `tests/isolation/products.cross-tenant.test.js` | Brio cannot read, list, edit or delete Acme's products (404) |
| `tests/errors/error-handling.test.js` | Malformed IDs return 400, unknown statuses return 400, and 25 failing requests do not exhaust the pool |
| `tests/allowedOrigin.test.js` | Shops and the main site get in; look-alike domains, `http://` in production and garbage are refused |
| `tests/getShopSlug.test.js` | The shop word is found from Origin or Host; `www`, `api`, strangers and garbage give no shop |
| `tests/isolation/ussd.cross-tenant.test.js` | Dialling shop A never shows shop B's welcome, products or balance; the phone number is never the tenant; replies are 182 characters or less; with shop A's lock, shop B's rows are invisible even by id (8 checks) |
| `tests/kms.test.js` | Encrypt then decrypt returns the original; a fresh IV every time; a changed byte, a different shop id or a different key fails with the one generic error; the key is read at call time (9 checks) |
| `tests/whatsapp.service.test.js` | The sender uses the current shop's token, never another shop's; never logs it; never puts it in an error; 401 and 403 set `whatsapp_token_rejected`; the stored token is encrypted (10 checks) |
| `tests/isolation/whatsapp.cross-tenant.test.js` | Verify handshake accepts a real token and refuses wrong ones; a message for shop A is saved for A and invisible to B; repeats are skipped per shop; unknown or missing number answers 200 ignored; with shop A's lock, shop B's `whatsapp_dedupe` rows are invisible and cannot be written (11 checks) |
| `tests/errors/not-found.test.js` | Unknown URLs get a JSON 404 for GET and POST, and `/health` still works (4 checks) |
| `tests/signup-atomic.test.js` | When seeding fails, signup fails cleanly and leaves no user and no shop behind (1 check) |

The suite also contains happy-path, database-down and signup sample-data tests
added in Week 28 Weekend. They do not have guides yet (see Known Follow-Ups).

Test cleanup uses a helper that sets the tenant first, because RLS applies to
the test database user too. A plain DELETE would silently delete nothing.

Each test file closes the app's pool in `afterAll`, so Jest exits cleanly.

---

## Known Follow-Ups

| Item | Why |
|------|-----|
| Re-check `JWT_SECRET` and the database password when staging becomes production | Staging has its own values set in Render. Never reuse a development placeholder |
| Fix two stale comments in `orders.controller.js` | A `FOR UPDATE` mention in `createOrder` and `?status`/`?channel` filters on `listOrders` that do not exist yet |
| Consider re-writing the AI-assisted parts of `withTenant.js` by hand | Keeps the "hand-written isolation" rule honest (see the AI audit) |
| Add a test for the real login endpoint | `login-lookup.isolation.test.js` covers the database rule and `getShopSlug.test.js` the shop word, but nothing runs `login.js` end to end |
| Add a test for `GET /v1/dashboard` | The dashboard numbers have no automated test yet |
| Match the shop in the address against the login token on later requests | Login now reads the shop from the address, but later requests trust the token only |
| Decide RLS for `audit_logs`; keep the app on a non-owner database role | Staging runs as `rahisisha_user` (no BYPASSRLS). See the known limitations in `docs/tests/isolation-proof.md` |
| Make the dashboard success envelope match the others (`error: null`) | Small inconsistency with `/v1/products` |
| Write guides for the web layout, sidebar and dashboard page | `apps/web/docs/` has guides for `proxy.js`, `session.js` and `serverApi.js` only |
| Fix slugify (cut, then trim dashes); refuse reserved slugs (admin, www, api) at **signup**; make session.js treat an API outage like serverApi.js | The lookup ignores `www` and `api`, but signup still lets someone register them |
| Write guides for the friendly 503 handler, sample data on signup, and the happy-path, database-down and signup sample-data tests | Added in Week 28 Weekend, not documented yet |
| Add AI audit entries for Week 28 Weekend Tasks 3 to 8 | The audit files stop at Day 5. **Update, 13 November 2026:** `AI_AUDIT_week_28_weekend.md` and `AI_AUDIT_week_29_day1.md` now exist and are linked from the root `AI_AUDIT.md` |
| Set the database SSL mode to `verify-full`; give `pool.js` a connection timeout | Staging works, but the `pg` SSL warning shows and a stuck database would hang a request |
| Remove the public demo accounts (password `Demo1234!`) and leftover test shops from staging | They are listed in `capstone/STAGING.md` under known gaps |
| Keep `ussd_configs` free of private columns; cache `service_code -> tenant_id` if USSD traffic grows | It has no RLS on purpose (see `docs/tests/isolation-proof.md`). One extra query per USSD request is fine for now |
| USSD stretch goals: language per tenant, a `ussd_events` table, 60 second idle timeout | Not done in Week 29 Day 1 |
| Verify the `X-Hub-Signature-256` header on `POST /webhooks/whatsapp` | Not done in Week 29 Day 2, so anyone who knows a shop's `phone_number_id` can post a fake message to that shop. Listed in `whatsapp-security.md` |
| Tell the shop owner when Meta rejects the token (`whatsapp_token_rejected`) | The error code exists, but nothing notifies the owner yet |
| Add a screen or endpoint where a shop saves its own WhatsApp settings; reply to customers through `sendWhatsApp` from the webhook; try it against Meta's sandbox | Today the settings come from the seed script only, and the webhook saves messages but does not answer |
| WhatsApp stretch goals: key rotation (the `v1.` prefix is there for it), message templates, a Meta business verification walkthrough | Not done in Week 29 Day 2 |
| Clean old rows out of `whatsapp_dedupe` | It grows forever. A scheduled delete of rows older than a few days is enough |
| Answer `400` (not `500`) for a broken JSON body | Found on 14 November 2026: the central error handler turns a body parse error into `internal` |
| Add `NULLIF(current_setting('app.current_tenant', TRUE), '')` to the older RLS rules | Only `memberships` and `whatsapp_dedupe` have it; the other 15 tables error on an empty setting instead of returning nothing (see `docs/tests/isolation-proof.md`) |
| Fix the stale "81 isolation tests" comments in `ci.yml` | Left alone in Week 29 Day 2 |
| Find why Jest says "did not exit" at the end of `npm test` | Some older test leaves a connection open. Harmless, but `--detectOpenHandles` would show which |
| Web: add `onChange` clearing of a field's red message while typing | A wrong box stays red until the next submit (see `SignupForm.js`) |

---

## Staging (live)

Details, settings and troubleshooting are in `capstone/STAGING.md`. In short:

| Part | Where | Address |
|------|-------|---------|
| Web app | Vercel (project root `apps/web`) | `https://rahisishabiashara.com` and `https://<shop-word>.rahisishabiashara.com` |
| API | Render (free plan: sleeps after 15 minutes, first request is slow) | `https://api.rahisishabiashara.com` |
| Database | Neon (Frankfurt), app user `rahisisha_user` | not public |

---

## The Web App (apps/web): short map

The web app has no database. It calls this API (`NEXT_PUBLIC_API_URL`, which
must end in `/v1` and is fixed when the site is built).

| File | What it does |
|------|--------------|
| `src/proxy.js` | Next.js 16 proxy (the old "middleware"): works out which shop the visitor wants from the subdomain (uses `ROOT_DOMAIN`). `www` and the bare domain are not shops |
| `src/lib/session.js` | `requireSession`: reads the login cookie, redirects to login if missing |
| `src/lib/serverApi.js` | `serverGet`: calls this API from server pages, forwarding the login cookie |
| `src/components/Sidebar.js` | Left menu (Products, Orders, Wallet, Settings are marked "soon") |
| `src/app/(authed)/layout.js` | Login check, sidebar and header for every logged-in page |
| `src/app/(authed)/dashboard/page.js` | Dashboard home: real numbers and latest products |
| `src/app/signup/SignupForm.js` | Signup form. Since Week 29 Day 1, wrong fields turn red with a kind message under the box (checked in the browser first, then by the API's field errors) |

The layout does not re-run on every client-side click, so the API's own cookie
check is the second lock.

---

## What Is Coming Next

| Feature                             | Week            |
|-------------------------------------|-----------------|
| Dashboard pages: products, orders, wallet, settings | Week 29 |
| M-Pesa STK push integration         | Week 29         |
| WhatsApp Cloud API                  | Week 29         |
| AI product enhancement (Claude API) | Week 29         |
| BullMQ background jobs              | Week 29         |
| Production hardening (strong secrets, paid hosting, no sleeping API) | Week 30 |

Staging is already live (see above).

**Done early:** USSD per tenant (Week 29 Day 1): `POST /ussd`, `ussd_configs`, the menu and the cross-tenant test.

**Done early (partly):** WhatsApp per tenant (Week 29 Day 2): `GET` and `POST /webhooks/whatsapp`, `whatsapp_configs`, `whatsapp_dedupe`, the encryption helper and the shared sender. Still to do: the signature check, replying from the webhook, a screen to save a shop's settings and a Meta sandbox test (see Known Follow-Ups).

---

*Last updated: Week 29 Day 2 (WhatsApp per tenant: webhook, encrypted tokens, dedupe, shared sender, seed script, docs tidy-up), 14 November 2026*  
*Earlier: Week 29 Day 1 (USSD per tenant, JSON 404, signup field errors, signup atomicity test), 13 November 2026*  
*Earlier: Week 28 Weekend (Task 8, staging deploy), 10 November 2026*  
*Update this file every time a new endpoint or pattern is added.*