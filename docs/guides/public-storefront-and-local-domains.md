# Public Shop Page, Shop Addresses and Local Setup (ROOT_DOMAIN)

**FILE:** `docs/guides/public-storefront-and-local-domains.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Explains how a stranger reaches a shop (`aminas-boutique.rahisishabiashara.com`), what the public page may show, and the small local setting (`ROOT_DOMAIN=localhost`) that makes checkout work on your own computer.

## WHY IMPORTANT

The public page is the one place where a stranger reads a shop's data, so what it returns is exactly what the whole internet can see. And without the local setting, checkout fails with a confusing "No internet connection" message.

## DANGER (what breaks without it)

1. The public page must only return **active** products with a minimum of fields: id, name, description, price (cents) and image address. Never SKU, status, wallet, orders, customers or phone numbers.
2. It must use the shop-locked database connection, never a direct pool query.
3. A **suspended or deleted shop must look like it does not exist** (404 Shop not found).
4. Locally, if `ROOT_DOMAIN` is not set, the browser's check ("preflight") from `aminas-boutique.localhost:3001` to the API is blocked and checkout shows "No internet connection".

## WHAT IT SOLVES

Each shop has its own address word (slug) and its own public page, and the browser is allowed to talk to the API from that address.

## SYSTEM DESIGN PRINCIPLE

"Public endpoints expose the minimum", and defence in depth: the query filter (active, not deleted) is the first wall, the database lock is the second.

## RULES

1. `GET /v1/storefront/:slug` returns `{ data: { shop: {name, slug}, products: [...] }, nextCursor, error }`.
2. `limit` is 1 to 48 (default 24). A bad cursor is a clear 400.
3. A shop with no active products is a normal 200 with an empty list.
4. CORS allows `WEB_ORIGIN`, and the root domain and its subdomains only when `ROOT_DOMAIN` is set.
5. The web app's `NEXT_PUBLIC_API_URL` ends with `/v1`.

## PRACTICAL EXAMPLE

`GET /v1/storefront/aminas-boutique` returns Amina's name and her active products. `GET /v1/storefront/nobody` returns 404. A suspended shop also returns 404.

## DECISIONS

- Shop addresses are subdomains of one root domain, because login cookies and shop pages need a shared domain.
- A short 24-item default divides neatly into 2, 3 or 4 columns.

## WHERE USED

`routes/storefront.routes.js`, `controllers/storefront.controller.js`, `middleware/resolveShopBySlug.js`, `middleware/withTenant.js`, the CORS settings in `app.js`, and the web shop page `app/shop/[slug]/page.js`.

## TRADEOFFS

+ Tiny and protected twice.
- No search, categories or caching headers yet.

## HOW TO USE

Local setup: in `apps/api/.env` set `ROOT_DOMAIN=localhost` and restart the API. Then open `http://aminas-boutique.localhost:3001` (replace with your shop's slug). On the live site, set `ROOT_DOMAIN=rahisishabiashara.com` and `WEB_ORIGIN` on Render.

---

## PIECE BY PIECE (real life, in simple terms)

**slug**  
The shop's name on the signboard, in the web address.

**resolveShopBySlug**  
The security guard who looks at the signboard and finds the right shop. A closed or removed shop gets 'no such shop'.

**withTenant**  
Hands the visitor the key to that one kiosk only.

**ROOT_DOMAIN=localhost**  
Telling the API 'visitors coming from *.localhost are from our own street, let them in'.

---


