# publicApi.js: The Cookie-Free Messenger For The Public Shop Page

**File:** `apps/web/src/lib/publicApi.js`
**Doc:** `apps/web/docs/src/lib/publicApi.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

The public shop page has no logged-in owner. `serverApi.js` always sends the login cookie and redirects to `/login` when there is none, which is exactly wrong for a customer. This file is the public twin: it calls `GET /v1/storefront/:slug` with NO cookie and never redirects to login.

## WHY IMPORTANT

If the public page used `serverApi.js`, every customer would be thrown to the login page. If it forwarded a cookie, an owner's login could leak into a public request. Keeping the two files apart makes both mistakes impossible.

## DANGER

- Customers see the login page instead of the shop.
- Someone "fixes" `serverApi.js` to allow no cookie, and a private page becomes reachable without login.

## WHAT IT SOLVES

One small place that fetches a shop's public products and turns the API's answers into three clear results: the shop and its products, `null` (no such shop), or an error.

## SYSTEM DESIGN PRINCIPLE

"Public and private code paths never share a fetch helper." The private helper trusts a cookie. The public helper trusts nothing and asks only for public data.

## RULES

1. NEVER attach a cookie or token here.
2. NEVER redirect to `/login` from this file.
3. Always `cache: 'no-store'`: a shop owner who just hid a product must not see it still on sale.
4. `encodeURIComponent` on anything that goes into the URL.
5. Only call `/storefront/...` from this file. Private endpoints belong in `serverApi.js`.

## THE CODE, PIECE BY PIECE

### API_URL

`NEXT_PUBLIC_API_URL` already ends in `/v1`, so we add `/storefront/...`.

### fetch(..., { cache: 'no-store' }): always look at the shelf now

Real life: a shopkeeper who sold the last cement bag does not want a customer shown a photo from yesterday.

### status 404 returns null: no such shop

The page turns `null` into the not-found screen.

### status 400 with a cursor: start from page one

A stale or edited "next page" link is not the customer's fault, so we show them the first page again.

### !res.ok throws: something is really wrong

A server fault is not hidden behind a friendly lie. Next.js shows the error screen.

## PRACTICAL EXAMPLES

```js
const page = await fetchStorefront('brio-hardware');   // { shop, products, nextCursor }
const more = await fetchStorefront('brio-hardware', page.nextCursor);
await fetchStorefront('nobody');                       // null
```

## DECISIONS (and WHY)

- A 400 is turned into page one, not an error screen. The only way a customer gets a 400 is a bad bookmark.
- Any other failure throws, so the owner can see something is wrong.

## WHERE USED

`apps/web/src/app/shop/[slug]/page.js`. Later the cart and checkout pages.

## TRADEOFFS

+ Tiny and easy to read. - No caching, so every visit asks the API. Fine for now.

## HOW TO USE

`import { fetchStorefront } from '../../../lib/publicApi';`

## COMMON MISTAKES

- Importing `serverGet` into a public page.
- Forgetting that a returned `null` means "not found" and must be handled.

## AI AUDIT NOTE

Written by AI at Sheryl's request. Declared in `AI_AUDIT_week_29_day4.md` (follow-up section).

## TEST LOG

Checked against the sandbox API on 18 November 2026: known shop gives data, unknown shop gives not-found, a garbage bookmark shows page one. No automated test yet (see follow-ups).

## ADDED IN BATCH 4a-2 (Week 30 Day 3): CATEGORY

`fetchStorefront(slug, cursor = null, category = null)` now builds its query with `shopQuery` from `lib/shopParams.js` (`?category=shoes&cursor=...`, the same builder the page links use), keeps the category when it retries after a stale bookmark, and returns `categories: [{slug, name}]` (empty list when the API sends none). Nothing removed.
