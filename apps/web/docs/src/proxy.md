# Guide: proxy.js (the website's gate guard)

**Code file:** `apps/web/src/proxy.js`
**Calls:** `GET /v1/tenants/by-slug/:slug` (see `apps/api/docs/src/controllers/tenants.controller.md`)
**Added:** Week 28 Day 5
**Note:** Next.js 16 renamed `middleware` to `proxy`. The assignment says "middleware"; this file is it.

---

## WHY THIS FILE EXISTS

Many shops share one website. Each has its own address word: `skirt-shirt.localhost:3001`, `amina.rahisisha.com`. This file runs **before every page**, reads the address word, asks the API which shop it is, and attaches the shop's id to the visit, so every page after it knows whose shop it is.

## WHY IMPORTANT

It is how an address becomes a shop. Without it, no page can tell Amina's visit from Brian's.

## DANGER

- Pages cannot know which shop was visited.
- If it **trusts a header from the visitor**, a stranger can pretend to be any shop. That is why it always deletes the visitor's `x-tenant-id` first.

## THE PICTURE

```
 visitor -> skirt-shirt.localhost:3001/dashboard
     |
 STEP 1  tear off any x-tenant-id the visitor sent
 STEP 2  /not-found itself? let it through (no loop)
 STEP 3  find the address word      "skirt-shirt"  (none? main entrance, let in)
 STEP 4  ask the API: who is "skirt-shirt"?
            404        -> redirect to /not-found
            other fail -> 503 "Service temporarily unavailable"
            200        -> { id, name, slug }
 STEP 5  write OUR x-tenant-id on the request going in
 STEP 6  continue to the page
```

Like a receptionist at a shopping-centre door: she reads which shop you came for, checks it exists, and puts a sticker on your visit. She never opens the shop's till.

## LINE BY LINE

| Part | What it does |
|---|---|
| `TENANT_HEADER = 'x-tenant-id'` | The name of the sticky note |
| `ROOT_DOMAIN` | `localhost` on a laptop (`skirt-shirt.localhost` has the word `skirt-shirt`). In production set `ROOT_DOMAIN=rahisisha.com` |
| `getSubdomain(host)` | Removes the port, lowercases, requires the host to end with `.ROOT_DOMAIN`, cuts the suffix off. Empty or `www` means "main site, not a shop" and returns `null` |
| `new Headers(request.headers)` + `delete(TENANT_HEADER)` | Copies the visitor's headers, then removes their `x-tenant-id` |
| `pathname === '/not-found'` | Skips itself so the redirect cannot loop forever |
| `fetch(.../tenants/by-slug/..., { cache: 'no-store' })` | Asks the API fresh every time. `encodeURIComponent` keeps strange characters from changing the URL |
| `res.status === 404` | No such shop: redirect to `/not-found` |
| `!res.ok` -> throw | A broken API is not a missing shop |
| `catch` -> `503` | Says honestly the service is down |
| `requestHeaders.set(TENANT_HEADER, tenant.id)` | Our note, written only here |
| `NextResponse.next({ request: { headers } })` | Continue, with the new headers on the **request** (not the response) |
| `config.matcher` | Watch every address except Next.js's own files (`_next/static`, `_next/image`) and the favicon |

## RULES

- Delete any incoming `x-tenant-id` before doing anything else.
- Set the header on the **request** going to the pages, not on the response.
- Plain `localhost` (no address word) is the main entrance (landing, login, signup): let it through with **no** `x-tenant-id`.
- Skip `/not-found` itself.
- A broken API is a 503, never "shop not found".

## DECISIONS

1. The shop lookup goes **through the API**, not the database. The website has no database access and should not get any.
2. `ROOT_DOMAIN` decides what counts as an address word.
3. `www` and the bare root domain are not shops.
4. No caching yet (`no-store`): simple and always fresh.
5. A `.js` file named `proxy.js`: Next.js 16 renamed middleware, and the project uses JavaScript.

## PRACTICAL EXAMPLES

- `skirt-shirt.localhost:3001/` -> API finds the shop -> `x-tenant-id` set.
- `nonsense.localhost:3001/` -> API says 404 -> redirect to `/not-found`.
- `localhost:3001/login` -> no address word -> let through, no tag.
- A visitor who sends `x-tenant-id: <someone else's id>` -> deleted, then replaced by the real one (or nothing).

## WHERE YOU WILL USE THIS

Any SaaS with an address per customer (Shopify, Slack, Notion style). The same file shape can also send logged-out people to `/login`, pick a language, or block countries.

## TRADEOFFS

- One place decides the shop for every page.
- One extra API call per visit (cache later).
- If the API is down, shop addresses show 503 until it is back.

## IMPORTANT: what this file does NOT do

- It does **not** protect private data. `x-tenant-id` is a convenience for pages. The real protection is the **login token** and the **database lock** (RLS), which never read this header.
- It does **not** check whether the visitor is logged in. That is `session.js`, called by the `(authed)` layout.
- It does **not** check that the shop in the address matches the shop in the login token. That check is **deferred to deployment**, because browsers do not share cookies between `shop.localhost` addresses, so today the dashboard runs at plain `localhost:3001`.

## KNOWN GAPS

1. Subdomain vs token is not matched (see above).
2. No cache: one API call for every visit to a shop address.
3. No automated test.
4. `/not-found` redirect keeps the visitor's address (`new URL('/not-found', request.url)`).

## RELATED

- `apps/api/docs/src/controllers/tenants.controller.md` (the endpoint it calls)
- `apps/web/docs/src/lib/session.md` (the next gate: is the visitor logged in?)