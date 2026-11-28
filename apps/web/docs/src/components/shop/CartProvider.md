# CartProvider.js

**FILE:** `apps/web/src/components/shop/CartProvider.js` (Week 30 Day 3, Cleanup C2)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

The shop page, the "Add" buttons, the basket bar and the checkout page all
need to see the SAME basket at the SAME moment. This file keeps ONE basket
in the browser and shares it with every screen that asks (React "context").
When the customer taps Add on a product, the number on the basket bar
changes instantly, with no page reload.

## WHY IMPORTANT

Without one shared basket, the Add button and the basket bar would each
keep their own copy and disagree ("I added 2 sodas but the bar says 0").

## DANGER

1. This is a CLIENT file ('use client'). The shop page itself stays a
   server page (fast, good for search and for slow phones); only the small
   interactive parts are client files.
2. The basket is loaded from the phone's memory AFTER the first paint (in
   useEffect), never during it. Loading during the first paint makes the
   server's page and the phone's page different, and React complains
   (a "hydration mismatch").
3. `ready` is false until the saved basket has been loaded. Screens that
   must not flash "your basket is empty" wait for `ready`.

## WHAT IT SOLVES

- One shared basket for all screens of ONE shop.
- Saves automatically on every change (rules live in lib/cart.js).

## SYSTEM DESIGN PRINCIPLE

Single source of truth + separation of concerns. The RULES live in
lib/cart.js (pure functions). This file only holds the current list in
React state and connects it to storage. Screens never change the list
themselves; they call add / setQty / remove / clear.

## RULES

1. Wrap ONLY the pages of one shop: <CartProvider slug={slug}>. The slug
   decides which basket is loaded (each shop has its own).
2. Use the basket with useCart(). It throws a clear error if used outside
   the provider, so a forgotten wrapper is found at once.
3. Do not store prices as truth. The server recalculates at checkout.

## PRACTICAL EXAMPLE

<CartProvider slug="mama-mboga">
  <ProductCard />      // calls const { add } = useCart(); add(product)
  <BasketBar />        // calls const { count, totalCents } = useCart()
</CartProvider>

## DECISIONS

- useMemo for the shared object: screens re-draw only when the basket
  really changes, not every time the provider is re-drawn.
- Plain React state (no extra library): the basket is tiny.

## WHERE USED

shop/[slug]/page.js (wraps the shelves), AddToBasket, BasketBar, the
checkout page.

## TRADEOFFS

+ Instant updates, simple to read.
- One extra client file shipped to the phone (very small).
- Two browser tabs of the same shop do not update each other live (they
  load the latest saved basket when opened). Fine for a shop.

## HOW TO USE

import { CartProvider, useCart } from '../components/shop/CartProvider';

## PIECE BY PIECE — real life: the shared basket at the kiosk

CartContext      = the kiosk's one shared basket on the counter, so the
                   vendor, the customer and the till all look at the same
                   one.
CartProvider     = the person who puts the basket on the counter when the
                   customer arrives, and carries it home when they leave.
items            = what is in the basket right now.
ready            = "have I finished taking the saved basket out of the
                   bag yet?" Before that, do not say it is empty.
add / setQty / remove / clear
                 = the four things a customer can do: put in, change the
                   amount, take out, empty after paying.
count / totalCents
                 = the number on the basket bar and the sum shown on it.
useCart()        = how a screen asks "may I see the basket?".
