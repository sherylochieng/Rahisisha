// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/BasketBar.js
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
//   3. Fixed to the bottom, white card with navy text and an orange button, so
//      it matches the shop and stands out without shouting.
//   4. "env(safe-area-inset-bottom)" keeps it above the iPhone home bar.
//
// PRACTICAL EXAMPLE
//   <BasketBar slug="mama-mboga" />   // once, near the end of the shop page
//
// DECISIONS
//   - Solid colours, a thin top border and a soft shadow (no gradients).
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
//   import BasketBar from '../../../components/BasketBar';
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

'use client';

import Link from 'next/link';

import { useCart } from './CartProvider';
import { formatKes } from '../lib/format';

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

      {/* The bar itself, bolted to the bottom of the screen. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          {/* Left: the number of items (in a navy badge) and the total. */}
          <div className="flex items-center gap-3">
            <span
              className="flex h-8 min-w-8 items-center justify-center rounded-full bg-brand-navy px-2 text-sm font-bold text-white"
              aria-hidden="true"
            >
              {count}
            </span>
            <div className="leading-tight">
              <p className="text-xs text-gray-500">{count === 1 ? '1 item' : `${count} items`}</p>
              <p className="text-base font-bold text-brand-navy">{formatKes(totalCents)}</p>
            </div>
          </div>

          {/* Right: the big orange button to the checkout page. */}
          <Link
            href={`/shop/${slug}/checkout`}
            className="rounded-lg bg-brand-orange px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-orange-dark active:scale-95"
          >
            Checkout
          </Link>
        </div>
      </div>
    </>
  );
}