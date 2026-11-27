# src/routes/auth/me.js

**FILE:** `apps/api/src/routes/auth/me.js` (existing file, adjusted in Week 30 Day 3, Batch 1, step 5)

## WHY THIS FILE EXISTS

`GET /v1/me` answers "who am I, and which shop am I in?" for a signed-in shop owner. The dashboard calls it when a page opens.

## WHY IMPORTANT

It is how the website knows who is signed in. Since Week 30 Day 3 it also tells the website **if the shop is suspended and why**, so the dashboard can show a clear banner instead of a confusing error.

## DANGER (what breaks without it)

1. It must keep `requireAuth` then `withTenant`, so the answer is only ever about the caller's own shop.
2. Only safe fields are returned. Never add the password hash or any token to these `SELECT`s.
3. `suspended_reason` is the admin's own words. The admin must know the owner can see it.

## WHAT IT SOLVES

"Show me who I am, and if my shop is suspended, tell me why."

## SYSTEM DESIGN PRINCIPLE

Additive change: new fields were **added** to the existing answer. Nothing was renamed or removed, so the website and the old test keep working.

## RULES

1. Reply shape: `{ user: { id, name, phone }, tenant: { id, name, slug, status, suspended_at, suspended_reason } }`.
2. `status` is `active`, `suspended` or `deleted`.
3. `suspended_at` and `suspended_reason` are `null` unless the shop is suspended.

## PRACTICAL EXAMPLE

Wanjiku's shop is suspended. The dashboard calls `/v1/me` and gets `tenant.status = "suspended"` and `tenant.suspended_reason = "customers reported fake M-Pesa messages"`. It shows: "Your shop is suspended: customers reported fake M-Pesa messages. You can look around, but you cannot make changes."

## DECISIONS

- `status` and the two suspend fields come from the same `tenants` row, in the same query as before (one extra column set, no extra query).
- Snake-case names (`suspended_reason`) match the existing style of this reply.

## WHERE USED

`apps/api/src/app.js` (mounted under `/v1` by the auth router) and the website's `lib/api.js`.

## TRADEOFFS

+ No extra database call.
- The website must read the new fields to show the banner (a later batch).

## HOW TO USE

`GET /v1/me` with the shop owner's cookie.

---

## LINE BY LINE

**`router.get('/me', requireAuth, withTenant, async (req, res) => {`**
`requireAuth` checks the login cookie and stamps `req.userId` and `req.tenantId`. `withTenant` locks the database to that shop and gives `req.db`.

**The `users` query**
`SELECT id, name, phone FROM users WHERE id = $1`. If the user is missing, `404`.

**The `tenants` query (adjusted)**
`SELECT id, name, slug, status, suspended_at, suspended_reason FROM tenants WHERE id = $1`. The last three fields are new.

**The reply**
`200 { user, tenant }`. Any failure is logged and answered with a plain `500`, so details never leak.
