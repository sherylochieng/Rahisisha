# app.js

**Location:** `apps/api/src/app.js`

---

## WHY THIS FILE EXISTS

It **builds** the Express app: security headers, JSON reading, cookies, routes, and the central error handler.

It does **not** start the server. `index.js` does that. This split lets tests import the app without opening a port.

---

## WHY IMPORTANT

It decides the **order** requests travel through. Order is security.

---

## DANGER

- Routes mounted **without** `requireAuth` and `withTenant` skip tenant safety.
- An error handler placed **before** the routes never sees their errors.
- **CORS set too strict** and no shop can log in online. **Set too loose** and a stranger's website can use a visitor's login cookie. See the CORS section below.

---

## WHAT IT SOLVES

- One place to see every route and its guards.
- One place where all errors get a safe, consistent answer.

---

## SYSTEM DESIGN PRINCIPLE

- **Separation of concerns:** `app.js` builds, `index.js` starts.
- **Fail loudly, in one place:** the central error handler.

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Every Express project. Supertest tests import `app` directly.

---

## TRADEOFFS

- A single error handler is simple, but needs care to keep the response shape the same everywhere.

---

## HOW TO USE

Mount tenant-owned routes with all three guards, in this order:

```js
app.use('/v1/products', requireAuth, withTenant, productsRouter);
app.use('/v1/orders', requireAuth, withTenant, ordersRouter);
```

1. `requireAuth` checks the login token and sets `req.tenantId`.
2. `withTenant` borrows a connection and tells Postgres who the tenant is.
3. The router runs the controller.

---

## CORS (WHICH WEBSITES MAY CALL THE API)

**Where:** near the top of `app.js`, before the routes.

**BEFORE (Week 28 Weekend, Task 8):** one allowed address.

```js
app.use(cors({ origin: process.env.WEB_ORIGIN, credentials: true }));
```

**AFTER:** a rule, kept in its own file.

```js
import { corsOrigin } from './utils/allowedOrigin.js';
app.use(cors({ origin: corsOrigin, credentials: true }));
```

**THE STORY (why it changed):**

- On a laptop there is one website, `http://localhost:3001`, so one allowed address was enough.
- Online, every shop has its own address, like `mama-mboga.rahisishabiashara.com`.
- The browser sent that address, the API compared it with the single allowed address, said no, and **no shop could log in**.
- Listing every shop by hand is impossible, because new shops sign up every day.
- So the check became a **rule**: the main site and anything ending in `.rahisishabiashara.com`.

**WHY THE RULE LIVES IN ITS OWN FILE:** it is a security door, and a file with its own tests is harder to "simplify" by accident. Guide: `docs/src/utils/allowedOrigin.md`. Tests: `docs/tests/allowedOrigin.test.md`.

**RULES:**

1. **NEVER** use `origin: '*'` together with `credentials: true`.
2. **NEVER** match with a plain `endsWith('rahisishabiashara.com')`. Without the dot, `evilrahisishabiashara.com` gets in.
3. Settings needed on Render: `ROOT_DOMAIN` (the main domain) and `WEB_ORIGIN` (the main site address).

**The error handler below is unchanged.** CORS only decides who may call. It does not change what the API answers.

---

## THE ERROR HANDLER

It sits **after** the routes and has exactly **4 parameters**. Express uses the 4 parameters to know it is an error handler.

What it does, in order:

1. `if (res.headersSent) return next(err);` If an answer was already started, let Express finish it.
2. **Malformed ID** (Postgres code `22P02`): answer **400** with the standard validation envelope:

```json
{
  "data": null,
  "error": {
    "code": "validation",
    "message": "Request validation failed",
    "details": { "id": "must be a valid UUID" }
  }
}
```

3. **Anything else:** log the real error on the server (`console.error(err)`) and answer **500** with a generic message:

```json
{
  "data": null,
  "error": { "code": "internal", "message": "Something went wrong" }
}
```

**Why generic?** Real database errors can reveal table names and queries. Callers must never see them.

---

## STATUS CODES AT A GLANCE

| Code | Meaning here                                  |
| ---- | --------------------------------------------- |
| 400  | Bad input, or a malformed ID                  |
| 401  | Not logged in                                 |
| 404  | Not found, or belongs to another tenant       |
| 409  | Duplicate SKU, or illegal order status move   |
| 500  | Our fault. Details are only in the server log |

---

## AI NOTE

The error handler was AI-assisted. The wording of its validation response (message and `details`) was then changed by hand to match Task 3. Both are recorded in the AI audit.

---

## FOLLOW-UP (Week 29 Day 4): the public storefront mount

One new line group was added after the `/v1/tenants` mount:

```js
app.use('/v1/storefront/:slug', resolveShopBySlug, withTenant, storefrontRouter);
```

- **What it is:** the PUBLIC data behind a shop's online page (`GET /v1/storefront/:slug`). No `requireAuth`, because a customer has no login cookie.
- **Why it is still safe:** `resolveShopBySlug` finds the active shop from the address word and stamps `req.tenantId`, then `withTenant` locks the database to that shop. The same "stamp, then lock" pattern as USSD. The controller only reads active, not-deleted products and returns four fields.
- **Order matters:** `resolveShopBySlug` first, `withTenant` second. Swapped, the lock would be set to `undefined`.
- **Read-only:** never add a write route behind this mount. Checkout and payment will get their own routers and tests.
- **Imports added:** `storefrontRouter` and `resolveShopBySlug`.
- **Guides:** `docs/src/middleware/resolveShopBySlug.md`, `docs/src/controllers/storefront.controller.md`, `docs/src/routes/storefront.routes.md`, `docs/tests/isolation/storefront.cross-tenant.test.md`.

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`, follow-up section). Added 18 November 2026.*

---

## FOLLOW-UP (Week 30 Day 3, Batch 1): the admin shops mount

One import and one mount were added after the `/v1/admin/auth` mount:

```js
import adminShopsRouter from './routes/adminShops.routes.js';
app.use('/v1/admin/shops', adminShopsRouter);
```

- **What it is:** the platform admin's shop powers: list shops, open one, suspend, reinstate, verify, un-verify.
- **Why it is safe:** the admin guard (`requirePlatformAdmin`) is applied **inside** the router with `router.use`, above every route, so no route can forget it. There is **no** `withTenant`. The admin works across shops under the admin lock that the service opens.
- **Order matters:** it must stay above the 404 catch-all at the bottom of `app.js`.
- **Guides:** `docs/src/routes/adminShops.routes.md`, `docs/src/controllers/adminShops.controller.md`, `docs/src/services/adminShops.service.md`, `docs/src/services/adminAudit.service.md`, `docs/tests/adminShops.routes.test.md`.
- **Known gap (tracked):** `app.js` does not set `trust proxy`, so behind Render `req.ip` may be Render's own address. That affects the admin login brake and the network address in audit receipts. It gets its own careful step.

*Written by AI at Sheryl's request. Added 27 November 2026.*

---

## FOLLOW-UP (Week 30 Day 3, Batch 1, step 5): look, do not touch

One import was added, and the guard `blockWritesWhenSuspended` was placed in four owner mounts, after `withTenant` where the route has it:

```js
app.use('/v1/products', requireAuth, withTenant, blockWritesWhenSuspended, productsRouter);
app.use('/v1/uploads',  requireAuth, blockWritesWhenSuspended, uploadsRouter);
app.use('/v1/orders',   requireAuth, withTenant, blockWritesWhenSuspended, ordersRouter);
app.use('/v1/inbox',    requireAuth, withTenant, blockWritesWhenSuspended, inboxRouter);
```

- **What it does:** while a shop is suspended its owner may sign in and **read**, but every write (`POST`, `PATCH`, `DELETE`) on these routes gets `403 shop_suspended` with the admin's reason.
- **Four existing lines were adjusted** (the four mounts above), by inserting the guard. No other line changed.
- **Not changed on purpose:** dashboard and wallet (read-only), the public storefront (already hides non-active shops), and M-Pesa (money already paid must still be recorded).
- **Rule for the future:** any new owner route that writes must get the same guard.
- **Guides:** `docs/src/middleware/blockWritesWhenSuspended.md`, `docs/tests/suspendedShop.doors.test.md`.

*Written by AI at Sheryl's request. Added 27 November 2026.*

---

## FOLLOW-UP (Week 30 Day 3, Batch 1): TRUST_PROXY

Right under `const app = express();` the app now reads an environment variable called `TRUST_PROXY`. This closes the "known gap" noted in the admin shops follow-up above.

- **What it is:** how many proxy "front doors" sit between the visitor and the API. Render has some.
- **Unset, 0 or nonsense:** trust none. This is the laptop and test behaviour, unchanged.
- **A number N:** Express believes the last N addresses in the `X-Forwarded-For` note and reads the real visitor before them. **On Render the proven value is `3`** (see the proof below).
- **Why:** without it, `req.ip` is Render's address for everyone, so the admin login brake counts all visitors as one person and audit receipts record the wrong address. `req.ip` is read in `adminAuth.controller.js` (the brake) and `adminShops.controller.js` (the receipts).
- **Danger:** never use `true`. It would believe an address the visitor wrote himself, and a thief could dodge the brake.
- **Nothing else changed:** 10 lines were added, none removed.
- **Test:** `tests/trustProxy.test.js` (guide: `docs/tests/trustProxy.test.md`).
- **Proof on the live server (28 November 2026):** one admin action (verify, then un-verify a demo shop) was done on staging, then the address in the audit receipt was compared with the real address of the person who did it. With `1` the receipt showed a private Render address (`10.x`). With `2` it showed a Cloudflare address (`162.158.x.x`). With `3` it matched the real address. So `TRUST_PROXY=3` is set on Render.
- **Why three:** visitor, then Cloudflare, then Render's own proxy, then the API. Each door adds one address to the note.
- **If the host changes:** re-run the same proof to find the new number. Too low shows a proxy address. Too high lets a visitor's own fake address through, so never guess higher.

*Written by AI at Sheryl's request. Added 28 November 2026.*

---

## Addition (Week 30 Day 3, Batch 3a): the admin overview numbers

`app.js` now mounts one more admin router, next to the shops router:

```js
import adminStatsRouter from './routes/adminStats.routes.js';
...
app.use('/v1/admin/stats', adminStatsRouter);
```

- **What it serves:** `GET /v1/admin/stats` returns five shop counts (total, active, suspended, verified, new this week) for the Overview page.
- **Where the guard is:** inside the router (`router.use(requirePlatformAdmin)`), like the shops router. `app.js` adds no guard of its own.
- **No `withTenant`:** the admin works across shops with the admin lock the service opens.
- Nothing else in `app.js` changed.


---

## ADDED IN BATCH 3b-2b: the admin notifications window

**New import** `adminNotificationsRouter` from `routes/adminNotifications.routes.js`, and **one new mount** after the stats one:

```js
app.use('/v1/admin/notifications', adminNotificationsRouter);
```

It is read-only: the list of outbox lines and their three counts. Like the shops and stats routers, the admin guard sits **inside** the router, and there is no `withTenant`. Nothing existing was changed.

## ADDED IN BATCH 4a-1 (Week 30 Day 3)

`app.use('/v1/categories', categoriesRouter);` is a PUBLIC mount (no login, no tenant), placed before the authenticated product routes. It serves the shared aisle list.

## ADDED IN BATCH 4b (Week 30 Day 3)

The shop profile routes are mounted at /v1/shop/profile behind requireAuth, withTenant and blockWritesWhenSuspended (the owner's own business card). Nothing existing was changed.
