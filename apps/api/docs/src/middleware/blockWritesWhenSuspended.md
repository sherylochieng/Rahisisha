# src/middleware/blockWritesWhenSuspended.js

**FILE:** `apps/api/src/middleware/blockWritesWhenSuspended.js` (Week 30 Day 3, Batch 1, step 5)

## WHY THIS FILE EXISTS

When the platform admin suspends a shop, the owner may still **sign in** (to see what happened and why), but may only **look**, never **change** anything. This guard enforces "look, do not touch": reads pass, and every write is refused while the shop is not active.

## WHY IMPORTANT

Without it, a suspended owner could keep adding products, changing order statuses or uploading photos. The padlock the admin placed would mean nothing on the owner's own door.

## DANGER (what breaks without it)

1. Mount it **after** `requireAuth` (so `req.tenantId` exists) and, where the route has one, **after** `withTenant` (so `req.db` exists).
2. Only `GET`, `HEAD` and `OPTIONS` pass without a check. `POST`, `PATCH`, `PUT` and `DELETE` are checked against the shop's status.
3. Anything other than `active` is refused, including `deleted` and a missing shop row. When unsure, say no.
4. The reason shown to the owner is the one the admin typed. The admin must know it is visible to the owner.
5. This guard does not protect public routes (storefront, USSD, WhatsApp, M-Pesa). Those have their own checks. M-Pesa stays open **on purpose**, so money that was already paid is still recorded.

## WHAT IT SOLVES

"Look, do not touch" for the owner of a suspended shop, with one clear message that explains why.

## SYSTEM DESIGN PRINCIPLE

**Fail closed:** anything that is not clearly `active` is refused. **Cheap by default:** reads cost nothing extra. A write costs one small lookup on the connection that already exists (`tenants` has no row level security).

## RULES

1. Reads (`GET`, `HEAD`, `OPTIONS`) always pass.
2. Writes pass only when the shop's status is `active`.
3. Refusal: `403 { data: null, error: { code, message, details? } }`.
   - `shop_suspended` with `details.reason` = the admin's reason.
   - `shop_unavailable` for deleted or missing shops (no reason shown).

## PRACTICAL EXAMPLE

Wanjiku's shop is suspended for "customers reported fake M-Pesa messages". She signs in and sees her products (GET works). She tries to add a dress (POST) and gets `403 shop_suspended` with that reason. When the admin reinstates the shop, her very next POST works. No sign-out and no waiting.

## DECISIONS

- **403, not 401:** she is signed in, she is just not allowed to change things right now.
- The status is read on **every write**, not remembered in the login cookie, so a suspend or a reinstate takes effect on the very next request.
- Uses `req.db` when it exists (same connection, no extra pool use) and the plain pool for routes without `withTenant` (uploads).

## WHERE USED

`apps/api/src/app.js`: the products, uploads, orders and inbox mounts.

## TRADEOFFS

+ One tiny primary-key lookup per write. Nothing on reads.
- A write route mounted **without** this guard is not protected. The test lists the owner write doors, so a forgotten one is noticed.

## HOW TO USE

```js
app.use('/v1/products', requireAuth, withTenant, blockWritesWhenSuspended, productsRouter);
```

---

## LINE BY LINE

**`const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])`**
The "just looking" kinds of request. You may look through a closed shop's window, but you may not rearrange the shelves.

**`if (READ_METHODS.has(req.method)) return next();`**
Looking is always allowed and costs nothing extra.

**`const db = req.db || pool;`**
Uses the shop-scoped connection when there is one, otherwise the plain pool. Both can read `tenants`, which has no row level security.

**`SELECT status, suspended_reason FROM tenants WHERE id = $1`**
One lookup of the shop's file by its id. `$1` is filled safely by the driver.

**`if (shop && shop.status === 'active') return next();`**
An open shop: touching is allowed.

**`if (shop && shop.status === 'suspended')`**
Replies `403` with the code `shop_suspended`, a plain message, and `details.reason` (the admin's words).

**Last `return res.status(403)...`**
Deleted or missing shop: `shop_unavailable`, with no reason.

**`catch (err) { return next(err); }`**
A database problem goes to the global error handler, so details never leak.
