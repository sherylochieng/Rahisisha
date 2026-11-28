# CategoryPills.js

**FILE:** `apps/web/src/components/shared/CategoryPills.js` (Week 30 Day 3, Batch 4a-2)

## WHY THIS FILE EXISTS
The row of aisle buttons on the public shop page: All, Shoes, Beauty and hair... Real life: the aisle signs hanging above the shelves.

## WHY IMPORTANT
A phone shopper reaches the right aisle in one tap instead of scrolling every product.

## DANGER
If it did not keep the aisle in its links, More products would drop the filter.

## WHAT IT SOLVES
Shows only aisles this shop really uses (from the API's `categories`), marks the current one with `aria-current`, scrolls sideways on narrow screens, and draws nothing when the shop has no categorised products.

## SYSTEM DESIGN PRINCIPLE
A server component of plain links. One small `Pill` piece draws every button (All and each aisle), so the look changes in one place. The URL is the state (`?category=shoes`), so it can be shared on WhatsApp and the back button works. No JavaScript is sent to the phone.

## RULES
Show nothing when empty. Use shopHref for addresses. Mark the current button.

## WHERE USED
`app/shop/[slug]/page.js`.

## TRADEOFFS
+ Fast and shareable. - Each tap reloads the page (fine for a shop window).

## HOW TO USE
`<CategoryPills slug={slug} categories={categories} active={category} />`

## ADDED IN BATCH 4a-3 (Week 30 Day 3): hrefFor

A new optional prop `hrefFor(category|null)` decides where each button points. The public shop does not pass it (it still builds `/shop/<slug>?category=...`); the owner's Products page passes one that builds `/products?category=...`. One component, two places. Nothing removed.
