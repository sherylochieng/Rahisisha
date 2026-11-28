// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/shop/BasketLink.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The small "Basket (2)" chip at the top right of the shop's navy header.
//   It takes the customer to the checkout page, just like the bar at the
//   bottom. Two ways to pay, one at the top and one at the bottom, so the
//   customer finds one wherever their eyes are.
//
// WHY IMPORTANT
//   On a laptop, people look at the TOP-RIGHT for their basket (every online
//   shop trains them to). On a phone, the thumb finds the bottom bar. With both,
//   nobody has to hunt for how to pay.
//
// DANGER
//   1. Client file ('use client'): it reads the shared basket.
//   2. It must be used INSIDE <CartProvider>.
//   3. It draws NOTHING while the basket is empty or still loading. A chip that
//      says "Basket (0)" and opens an empty page would only confuse people.
//
// WHAT IT SOLVES
//   A second, always-visible route to checkout, at the top of the page.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: it only DISPLAYS the count and links to the next
//   page. The basket rules stay in lib/cart.js. Redundancy on purpose: the same
//   goal reachable from two places.
//
// RULES
//   1. Shown only when the basket has at least one item.
//   2. Link goes to /shop/<slug>/checkout (the same as the bottom bar).
//   3. Made for the NAVY header: white text, thin white border, a hover effect.
//      The count sits in an ORANGE badge so it catches the eye.
//
// PRACTICAL EXAMPLE
//   <BasketLink slug="aminas-boutique" />   // inside the shop's header
//
// DECISIONS
//   - Solid colours, no gradients. White outline chip on navy; orange badge.
//   - The word "Basket" is hidden on very small phones (only the count and the
//     icon-like arrow remain) so the shop's name keeps its space.
//
// WHERE USED
//   shop/[slug]/page.js, inside the header.
//
// TRADEOFFS
//   + A second way to checkout, great on laptops.
//   - The header is not sticky, so on a long page the chip scrolls away. The
//     bottom bar is always there, which covers that case.
//
// HOW TO USE
//   import BasketLink from '../../../components/shop/BasketLink';
//
// ═══════════════════════════════════════════════════════════
// PIECE BY PIECE — real life: the sign above the kiosk door
// ═══════════════════════════════════════════════════════════
//   ready / count   = "has the basket arrived, and is anything in it?" If not,
//                     the sign stays blank.
//   the chip        = a small sign above the door saying "Basket (2) - pay here".
//   orange badge    = the number painted in bright orange so it catches the eye
//                     from across the road.
//   hover effect    = the sign lights up a little when you point at it.

'use client';

import Link from 'next/link';

import { useCart } from './CartProvider';

export default function BasketLink({ slug }) {
  // The shared basket: the number of things in it, and whether it has loaded.
  const { ready, count } = useCart();

  // Nothing to show yet, or the basket is empty: draw nothing.
  if (!ready || count === 0) return null;

  return (
    <Link
      href={`/shop/${slug}/checkout`}
      // White outline on the navy header; a soft white tint on hover.
      className="flex shrink-0 items-center gap-2 rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
      aria-label={`Basket, ${count} ${count === 1 ? 'item' : 'items'}. Go to checkout`}
    >
      {/* The word is hidden on the smallest phones to save space. */}
      <span className="hidden min-[380px]:inline">Basket</span>

      {/* The count in an orange badge so it stands out. */}
      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-orange px-1.5 text-xs font-bold text-white">
        {count}
      </span>
    </Link>
  );
}