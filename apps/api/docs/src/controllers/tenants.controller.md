# Guide: tenants.controller.js

**Code file:** `apps/api/src/controllers/tenants.controller.js`
**Route file:** `apps/api/src/routes/tenants.routes.js`
**Route:** `GET /v1/tenants/by-slug/:slug` (**public**, mounted as `app.use('/v1/tenants', tenantsRouter)` with no `requireAuth` and no `withTenant`)
**Called by:** `apps/web/src/proxy.js` (the website's gate guard)
**Added:** Week 28 Day 5

---

## WHY THIS FILE EXISTS

Every shop has an address word, called the **slug**. For example, `skirt-shirt.localhost:3001`. The website's gate guard (`proxy.js`) reads that word and needs to know which shop it belongs to. The website has no database, so it asks this endpoint.

## WHY IMPORTANT

It is how an address turns into a shop. Without it, the website cannot tell Amina's visit from Brian's.

## DANGER (if this file does not exist)

- The gate guard cannot look anything up. Either every address is "not found", or someone is tempted to give the website direct database access.

## THE PICTURE

```
 Visitor types:  skirt-shirt.localhost:3001
        │
        ▼
 proxy.js (gate guard)   reads the word  "skirt-shirt"
        │   GET /v1/tenants/by-slug/skirt-shirt     (no login needed)
        ▼
 getTenantBySlug
   1. is "skirt-shirt" shaped like an address word?   no  → 404
   2. look it up (active shops only)                  none → 404
   3. found                                           → { id, name, slug }
```

Like a street-name signboard: it tells you which house a name belongs to, but it does not open the door.

## THE ANSWERS

Found:
```json
{ "data": { "id": "...", "name": "skirt Shirt", "slug": "skirt-shirt" }, "error": null }
```

Not found (a bad word, an unknown shop, or an inactive shop, **all identical**):
```json
{ "data": null, "error": { "message": "Shop not found" } }
```

## LINE BY LINE

### `SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/`
What a valid address word looks like:
- `^` and `$`: the **whole** word must match, not just a part of it.
- `[a-z0-9]`: starts with a lowercase letter or a number.
- `([a-z0-9-]{0,61}[a-z0-9])?`: then letters, numbers or hyphens, and it must **end** with a letter or number (no trailing hyphen).
- 63 characters is the longest a web address word may be (1 + 61 + 1).

### Step 1: check the shape
`if (!SLUG_PATTERN.test(slug))` returns 404 **without asking the database**. Rubbish never reaches the database.

### Step 2: look the shop up
```sql
SELECT id, name, slug FROM tenants WHERE slug = $1 AND status = 'active'
```
- `$1` is filled in safely, so a sneaky word can never change the query (no SQL injection).
- Only `id, name, slug` are selected: the least information that does the job.
- Only `active` shops. Suspended and deleted shops look as if they do not exist.

### Step 3: nothing found
`if (!rows[0])` returns the **same** 404 as a bad word.

### Step 4: found
`res.json({ data: rows[0], error: null })`.

## RULES

- This is the **one** endpoint that is public on purpose. Never add anything private to its answer.
- Validate the word before touching the database.
- Only active shops are found.
- **The `pool.query` exception.** Everywhere else in the API it is forbidden. It is allowed here only because the `tenants` table has no `tenant_id` and no RLS (it **is** the list of shops), and nobody is logged in yet. Never copy this to a tenant table.

## DECISIONS

1. **A bad word and a missing shop give the same 404.** Nothing is leaked, and the gate guard handles only one case.
2. **Only `status = 'active'` shops are returned.** A suspended or deleted shop must not get a working address.
3. **Same `{ data, error }` envelope** as the other endpoints.
4. **The id is returned** even though it is internal. A shop id is not a secret. The real protection is the login token and the database lock: knowing a shop's id lets nobody read its data.

## PRACTICAL EXAMPLES

```js
// The gate guard (proxy.js) calls it
const res = await fetch(`${API_URL}/tenants/by-slug/${slug}`);
if (!res.ok) { /* send the visitor to /not-found */ }
```

- **By hand:** open `http://localhost:3000/v1/tenants/by-slug/skirt-shirt` in the browser to see the JSON.
- **A word that is not a shop:** `.../by-slug/nonsense` returns `404 {"data":null,"error":{"message":"Shop not found"}}`.

## WHERE YOU WILL USE THIS

Any app where each customer gets an address: `yourshop.shopify.com`, `yourcompany.slack.com`. This is the lookup behind that address.

## TRADEOFFS

- Simple, fast (the slug has an index), no login needed.
- Anyone can test whether a shop name exists. That is already visible to anyone who types the address, so it leaks nothing new. **Rate limiting** is a good later addition.

## KNOWN GAPS

- No automated test yet (suggested: valid slug returns 200 with only `id`, `name`, `slug`; unknown slug, bad shape, and suspended shop all return the same 404).
- No rate limiting yet.

## RELATED

- `docs/src/routes/routes.md` (the route)
- `apps/web/src/proxy.js` (the caller)
- `sql/SCHEMA.sql`, table `tenants` (the `slug` unique index and the `status` CHECK)