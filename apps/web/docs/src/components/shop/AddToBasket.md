# AddToBasket.js

**FILE:** `apps/web/src/components/shop/AddToBasket.js` (Week 30 Day 3, Cleanup C2)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

The small button at the bottom of each product card on the shop page.
Before the customer picks the product it says "Add". After the first tap
it becomes a  "−  2  +"  control so they can change the amount right there,
without opening a new page and without a pop-up.

## WHY IMPORTANT

This is the FIRST thing a customer does in the shop. If it is slow,
confusing or too small to tap, they leave. Kenyan customers mostly shop on
a phone, with one thumb, often on a slow connection.

## DANGER

1. Client file ('use client'): it needs taps and the shared basket. The
   product card around it stays on the server.
2. It must be used INSIDE <CartProvider>. Outside it, useCart() throws.
3. The buttons are big (h-10 / w-10 = 40px) on purpose: a thumb is not a
   mouse pointer.

## WHAT IT SOLVES

- Add a product in ONE tap.
- Change the amount or remove it from the same place.
- Tells the customer clearly how many they have of this product.

## SYSTEM DESIGN PRINCIPLE

Separation of concerns: this file only DRAWS the button and passes taps on.
All basket rules (limits, totals, saving) are in lib/cart.js through
CartProvider. Minimal friction: the least number of taps to buy.

## RULES

1. Pass the product exactly as the shop page has it:
   { id, name, price_cents, image_url }.
2. At quantity 1, the "−" button REMOVES the product (the customer wanted
   to undo). It never leaves a "0 in basket".
3. The "+" button stops at the limit (50) and is greyed out there.
4. Colours: orange = the main action (Add), navy = the amount control.

## PRACTICAL EXAMPLE

<AddToBasket product={p} />   // inside each product card

## DECISIONS

- Solid colours only (no gradients), hover effect on desktop, a gentle
  press effect on phones (active:scale-95).
- aria-labels on the small buttons so a screen reader says "Add one more
  Soda" instead of just "plus".

## WHERE USED

shop/[slug]/page.js, inside each product card.

## TRADEOFFS

+ One tap to add, change the amount in place.
- No "sold out" state yet. When inventory is added, this file gets one
  extra case: show "Sold out" and no button.

## HOW TO USE

import AddToBasket from '../../../components/shop/AddToBasket';

## PIECE BY PIECE — real life: buying sodas at the kiosk

quantity = 0   = you have not picked it yet. The kiosk shows "Add".
quantity >= 1  = you have picked it. The kiosk shows "− 2 +" so you can
                 say "make it 3" or "actually, just 1".
"−" at 1       = you change your mind: it goes back on the shelf.
MAX_QUANTITY   = the vendor's limit, so "+" stops at 50.
useCart()      = looking at the shared basket on the counter.
