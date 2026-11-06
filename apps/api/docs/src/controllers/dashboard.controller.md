# Guide: dashboard.controller.js

**Code file:** `apps/api/src/controllers/dashboard.controller.js`
**Route:** `GET /v1/dashboard`, mounted in `app.js` as `app.use('/v1/dashboard', requireAuth, withTenant, dashboardRouter)`
**Uses:** `balance()` from `src/services/wallet.service.js`
**Called by:** the web page `apps/web/src/app/(authed)/dashboard/page.js`
**Added:** Week 28 Day 5

---

## WHY THIS FILE EXISTS

When a shop owner logs in, the first screen answers three questions:

1. How many orders did I get **today**?
2. How much money is in my **wallet**?
3. What are my **newest products**?

The web page cannot touch the database (that is the API's job), so it asks **one** endpoint. This file is that endpoint.

## WHY IMPORTANT

It is the first thing every owner sees. If the numbers are wrong, or worse, belong to another shop, the owner stops trusting the product.

## DANGER (if this file does not exist)

- The web page would need its own database access, or three separate calls, and it would be easy to forget the shop lock on one of them.
- Or the page would show empty boxes and fake numbers.

## THE PICTURE

```
 Browser (dashboard page)
       │  GET /v1/dashboard   (with the login cookie)
       ▼
 requireAuth   → checks the login cookie        (401 if not logged in)
       ▼
 withTenant    → stamps the shop on req.db
       ▼
 getDashboard  → 3 questions, all through req.db
       │   1. COUNT orders created today (Nairobi time)
       │   2. balance(req.db)  (wallet ledger total)
       │   3. 5 newest products (not deleted)
       ▼
 { data: { ordersToday, balanceCents, latestProducts } }
```

Like a shop's morning report: three lines on one sheet of paper, instead of walking to three different desks.

## THE ANSWER

```json
{ "data": {
    "ordersToday": 7,
    "balanceCents": 350000,
    "latestProducts": [
      { "id": "...", "name": "Dress", "price_cents": 250000,
        "status": "active", "created_at": "2026-11-05T09:12:00Z" }
    ] } }
```

A brand-new shop gets `{ "data": { "ordersToday": 0, "balanceCents": 0, "latestProducts": [] } }`.

## LINE BY LINE

### Question 1: orders today
```sql
SELECT COUNT(*) AS count FROM orders
WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Nairobi')
                    AT TIME ZONE 'Africa/Nairobi'
```
Read it from the inside out:
- `now() AT TIME ZONE 'Africa/Nairobi'`: the clock time in Nairobi right now.
- `date_trunc('day', ...)`: cut it back to midnight today.
- `AT TIME ZONE 'Africa/Nairobi'` (the outer one): turn that midnight back into a real moment, so it can be compared with `created_at`.

So it means "created at or after midnight in Nairobi". There is **no** `WHERE tenant_id = ...` on purpose: RLS only lets this shop's orders through.

`Number(ordersResult.rows[0].count)`: Postgres returns `COUNT` as **text**. Without `Number`, `"7" + 1` becomes `"71"`.

### Question 2: wallet balance
`const balanceCents = await balance(req.db);`
It reuses `balance()` from the wallet service, so the dashboard and the wallet page can never disagree about how a balance is counted. It already returns a number, so no conversion is needed.

### Question 3: latest 5 products
```sql
SELECT id, name, price_cents, status, created_at
FROM products WHERE deleted_at IS NULL
ORDER BY created_at DESC LIMIT 5
```
- Only the columns the card needs.
- `deleted_at IS NULL` hides soft-deleted products, exactly like the products list.
- Newest first, never more than five.
- Drafts and archived products are included, and each row carries its `status` so the page can label it.

### The answer
`res.json({ data: { ordersToday, balanceCents, latestProducts } })`. Money stays in whole cents. The web page turns cents into KES.

## RULES

- Never use `pool.query` here. Always `req.db`.
- Never read a shop id from the URL, body or a header the user can set. The shop comes from the signed login token, through `withTenant`.
- Money stays in whole cents.
- This file never decides who may log in. `requireAuth` does that first.

## DECISIONS

1. **One endpoint, not three.** Fewer requests, one place for the lock. The cost: if one number is slow, the whole page waits.
2. **"Today" means Nairobi time**, not the server's clock. A server abroad could think it is still yesterday while it is already morning in Nairobi.
3. **"Today's orders" includes cancelled ones.** The simplest honest definition. To hide them, add `AND status <> 'cancelled'`.
4. **No hand-written `WHERE tenant_id`.** RLS already does it, and a second copy would be forgettable.
5. **`Number()` around `COUNT`.** Same trap as the wallet balance.
6. **Answer wrapped as `{ data: ... }`.**
7. **Balance from `balance()`**, not a new query.
8. **"Latest 5" = the 5 newest not deleted**, with the database's own names (`price_cents`, `created_at`), the same shape `GET /v1/products` returns.

## PRACTICAL EXAMPLES

```js
// The dashboard page asks for it (credentials: 'include' sends the login cookie;
// without it requireAuth answers 401 "Not logged in")
const res  = await fetch(`${API_URL}/v1/dashboard`, { credentials: 'include' });
const json = await res.json();
// json.data.ordersToday  → 7
```

- **By hand:** log in, then open `http://localhost:3000/v1/dashboard` in the same browser to see the JSON.
- **Live proof (5 November 2026):** Jane's shop showed her 2 products; Brio's shop showed `ordersToday: 0`, `balanceCents: 0`, `latestProducts: []`.
- **A test for later:** log in as Acme, create 2 orders, call the endpoint, expect `ordersToday` 2. Log in as Brio and expect 0, not 2. That second check is the isolation proof for this endpoint.

## WHERE YOU WILL USE THIS

Any SaaS home screen: an invoicing app (unpaid invoices today), a school system (students present today), a clinic (appointments today). The pattern is always one summary endpoint, a few counts and totals, every query through the shop-scoped connection.

## TRADEOFFS

- One request, one lock, easy to test.
- The page gets all three numbers or none; one error hides everything.
- Queries run one after the other (one connection handles one query at a time). Fine now. Very large tables may need indexes or caching later. `created_at` is already indexed on orders and products.

## KNOWN GAPS

- **No automated test yet** for this endpoint.
- **Envelope difference:** this endpoint answers `{ data: ... }` without `error: null`, while the products endpoint includes `error: null`. A small inconsistency to fix.
- A failure in any of the three queries goes to the central error handler (500), and the page shows nothing.

## RELATED

- `docs/src/services/wallet.service.md` (the `balance` function)
- `docs/src/routes/routes.md` (the route)
- `apps/web/src/app/(authed)/dashboard/page.js` (the page that shows it)