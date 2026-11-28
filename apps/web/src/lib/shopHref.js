// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/lib/shopHref.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The shop page has links that must remember each other: the aisle
//   buttons ("Shoes") and the "More products" button. This one function
//   builds every shop address, so they all agree.
//
// WHY IMPORTANT
//   Without it, tapping "More products" while looking at Shoes would drop
//   the Shoes filter, and tapping a different aisle would keep an old
//   bookmark from the wrong aisle.
//
// DANGER (what breaks without it)
//   Two places building the address by hand, one forgets a part, and
//   shoppers jump between aisles by accident.
//
// WHAT IT SOLVES
//   shopHref('mama-njeri', { category: 'shoes' })  -> /shop/mama-njeri?category=shoes
//   shopHref('mama-njeri', { category: 'shoes', cursor: 'abc' })
//                                                 -> /shop/mama-njeri?category=shoes&cursor=abc
//   shopHref('mama-njeri')                         -> /shop/mama-njeri
//
// SYSTEM DESIGN PRINCIPLE
//   DRY: one pure function (no React, no network), one place to change
//   the address shape. URLSearchParams does the encoding for us.
//
// RULES
//   1. Never build /shop/... addresses by hand elsewhere: call this.
//   2. Changing the aisle means starting from the first page (no cursor).
//
// WHERE USED
//   components/shared/CategoryPills.js and app/shop/[slug]/page.js.
//
// TRADEOFFS
//   + Tiny, easy to test. - Only knows category and cursor (add more
//     parts here when search arrives).
//
// HOW TO USE
//   import { shopHref } from '../lib/shopHref';
//   <Link href={shopHref(slug, { category })}>
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// shopQuery (from shopParams.js) = THE ENVELOPE WRITER: it puts ? and & in the
//   right places and leaves empty boxes out, so the plain shop address stays
//   clean (/shop/mama-njeri). This file only adds the /shop/<slug> front part.
// ═══════════════════════════════════════════════════════════

// The ?category=...&cursor=... tail is written by shopParams (one place)
import { shopQuery } from './shopParams';

export function shopHref(slug, { category = null, cursor = null } = {}) {
  return `/shop/${slug}${shopQuery({ category, cursor })}`;
}
