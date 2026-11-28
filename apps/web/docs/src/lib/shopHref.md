# shopHref.js

**FILE:** `apps/web/src/lib/shopHref.js` (Week 30 Day 3, Batch 4a-2)

## WHY THIS FILE EXISTS
One function that builds every public shop address: `/shop/<slug>?category=...&cursor=...`. Real life: the post-office clerk who writes the address boxes the same way every time.

## WHY IMPORTANT
The aisle buttons and the "More products" link must remember each other, or tapping More products on Shoes would jump back to All.

## DANGER
Two places building the address by hand drift apart and shoppers change aisles by accident.

## WHAT IT SOLVES
`shopHref('mama')` gives `/shop/mama`; with `{category:'shoes'}` it adds `?category=shoes`; with a cursor it adds `&cursor=...`. Empty parts are left out.

## SYSTEM DESIGN PRINCIPLE
DRY: one pure function, no React, no network. It adds only the `/shop/<slug>` front part; the `?category=...&cursor=...` tail is written by `shopQuery` in `lib/shopParams.js`, the same one the API call uses.

## RULES
Never build /shop/ addresses by hand elsewhere. Changing aisle starts from the first page (no cursor).

## WHERE USED
`components/CategoryPills.js` and `app/shop/[slug]/page.js`.

## TRADEOFFS
+ Tiny and easy to test. - Only category and cursor for now; add search here later.

## HOW TO USE
`import { shopHref } from '../lib/shopHref';` then `<Link href={shopHref(slug, { category })}>`.
