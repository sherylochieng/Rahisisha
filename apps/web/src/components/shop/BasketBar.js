// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/shop/BasketBar.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The bar stuck to the bottom of the shop page once the customer has put
//   something in the basket:
//        2 items  ·  KES 1,580.00                [ Checkout ]
//   One tap on it goes straight to the checkout page. It is the customer's
//   "I'm ready to pay" button, always in thumb's reach.
//
// WHY IMPORTANT
//   A customer who has chosen must never have to hunt for how to pay. A bar
//   that is always visible, with the total on it, is the shortest path from
//   "I want this" to "I'm paying". It also reassures: "KES 1,580, no surprises".
//
// DANGER
//   1. Client file ('use client'): it reads the shared basket.
//   2. It must be used INSIDE <CartProvider>.
//   3. It shows NOTHING until the basket is loaded (`ready`) and has at least
//      one item. Otherwise an empty bar would flash on every page load.
//   4. The page needs extra empty space at the bottom (a "spacer") so the bar
//      never hides the last product or the footer. This file draws that spacer
//      itself, only when the bar is showing.
//
// WHAT IT SOLVES
//   - Always-visible count and total.
//   - One tap to checkout.
//
// SYSTEM DESIGN PRINCIPLE
//   Minimal friction and separation of concerns: it only DISPLAYS numbers the
//   basket already worked out and links to the next page. No money maths here.
//
// RULES
//   1. The total shown is for SHOWING only. The server recalculates at checkout.
//   2. The link goes to /shop/<slug>/checkout (the slug comes from the page).
//   3. Fixed to the bottom. SOLID NAVY with white text and a big ORANGE
//      Checkout button. (Week 30, v2) It was white at first and customers could
//      not find it: every Add button is orange too, so the one button that
//      matters did not stand out. Navy makes the bar impossible to miss and
//      makes the orange button pop.
//   4. "env(safe-area-inset-bottom)" keeps it above the iPhone home bar.
//
// PRACTICAL EXAMPLE
//   <BasketBar slug="mama-mboga" />   // once, near the end of the shop page
//
// DECISIONS
//   - Solid colours, no gradients. Navy bar, orange button, a hover effect.
//   - On a phone the bar is full width and the Checkout button stretches to
//     fill the space (easy for a thumb). On a laptop the count, the total and
//     the button sit together in the middle, so the eye links them (before,
//     the button was far away at the right edge).
//   - The button carries an arrow so it reads as "go forward".
//   - "1 item" / "2 items": the word changes with the number, because
//     "1 items" looks careless.
//   - The count is shown in a navy badge so it is readable at a glance.
//
// WHERE USED
//   shop/[slug]/page.js (inside the CartProvider).
//
// TRADEOFFS
//   + Visible at all times, one tap to pay.
//   - Uses a little screen height on small phones (hence the compact design).
//
// HOW TO USE
//   import BasketBar from '../../../components/shop/BasketBar';
//
// ═══════════════════════════════════════════════════════════
// PIECE BY PIECE — real life: the vendor's "ready to pay?" counter
// ═══════════════════════════════════════════════════════════
//   ready / count    = "has the basket been brought to the counter, and is
//                      anything in it?" If not, the counter stays clear.
//   spacer <div>     = a clear patch of floor so the counter does not stand
//                      on top of the last items on the shelf.
//   fixed bottom-0   = the counter is bolted to the front of the kiosk, always
//                      there, however far you scroll.
//   count + total    = the vendor reading out "two items, one thousand five
//                      hundred and eighty shillings".
//   Checkout link    = "pay here".
//   formatKes        = writing the amount the Kenyan way: KES 1,580.00.
//   navy bar         = a dark sign across the front of the kiosk. Dark against
//                      the white shelves, so nobody walks past it.
//   sm:justify-center= on a wide screen, the vendor stands in the middle of the
//                      counter with the total and the "pay" button together.

'use client';

import Link from 'next/link';

import { useCart } from './CartProvider';
import { formatKes } from '../../lib/format';

export default function BasketBar({ slug }) {
  // The shared basket: how many things, what they cost together, and whether
  // the saved basket has finished loading.
  const { ready, count, totalCents } = useCart();

  // Nothing to show yet (still loading) or nothing in the basket: draw nothing.
  if (!ready || count === 0) return null;

  return (
    <>
      {/* The spacer: as tall as the bar, so the bar never covers the last
          product or the footer. aria-hidden: it is only empty space. */}
      <div aria-hidden="true" className="h-24" />

      {/* The bar itself, bolted to the bottom of the screen.
          Solid navy so it stands out from the white page (no gradient). */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 bg-brand-navy shadow-[0_-4px_12px_rgba(0,0,0,0.15)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* justify-between on a phone (info left, button right, button fills
            the rest); sm:justify-center on a laptop (everything together). */}
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:justify-center sm:gap-8">
          {/* Left: the number of items (in a white badge) and the total in white. */}
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 min-w-9 items-center justify-center rounded-full bg-white px-2 text-sm font-bold text-brand-navy"
              aria-hidden="true"
            >
              {count}
            </span>
            <div className="leading-tight">
              <p className="text-xs text-gray-300">{count === 1 ? '1 item' : `${count} items`}</p>
              <p className="text-lg font-bold text-white">{formatKes(totalCents)}</p>
            </div>
          </div>

          {/* Right: the big orange Checkout button. flex-1 on a phone so it
              fills the space (easy thumb target); normal width on a laptop. */}
          <Link
            href={`/shop/${slug}/checkout`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-orange px-8 py-3.5 text-base font-bold text-white transition hover:bg-brand-orange-dark active:scale-95 sm:flex-none"
          >
            Checkout
            {/* The arrow says "go forward". aria-hidden: decoration only. */}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </>
  );
}