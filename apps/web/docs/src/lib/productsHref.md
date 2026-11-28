# productsHref.js

**FILE:** `apps/web/src/lib/productsHref.js` (Week 30 Day 3, Batch 4a-3)

## WHY THIS FILE EXISTS
Builds the addresses of the owner's Products page: `/products`, `/products?category=shoes`, `/products?category=shoes&cursor=<id>`. The sister of `shopHref` (public `/shop/<slug>`).

## WHY IMPORTANT
The filter buttons, Next page and Back to first page must all keep the chosen category.

## DANGER
Links built by hand: Next page forgets the category and the owner lands on the full list in the middle of reading.

## WHAT IT SOLVES
`productsHref({ category, cursor })` returns the full address; empty parts are left out.

## SYSTEM DESIGN PRINCIPLE
DRY: the tail is written by `shopQuery` (lib/shopParams.js), the same writer the public shop uses. This file only adds the `/products` front.

## RULES
Never build `/products?...` by hand. Pure function, no React, no network.

## WHERE USED
`app/(authed)/products/page.js`.

## TRADEOFFS
+ One place. - Tiny; more filters go into shopQuery.

## HOW TO USE
`<Link href={productsHref({ category, cursor: nextCursor })}>`
