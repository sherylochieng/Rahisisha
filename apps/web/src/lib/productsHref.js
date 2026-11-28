// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/lib/productsHref.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Builds the addresses of the OWNER's Products page: /products,
//   /products?category=shoes, /products?category=shoes&cursor=<id>.
//   The sister of shopHref (which builds the PUBLIC /shop/<slug> addresses).
//
// WHY IMPORTANT
//   The filter buttons, "Next page" and "Back to first page" must all keep
//   the chosen category. One function builds every one of them.
//
// DANGER (what breaks without it)
//   Each link built by hand: "Next page" forgets the category and the owner
//   is thrown back to the full list in the middle of reading page 2.
//
// WHAT IT SOLVES
//   productsHref()                                  -> /products
//   productsHref({ category: 'none' })              -> /products?category=none
//   productsHref({ category: 'shoes', cursor: 'x' })-> /products?category=shoes&cursor=x
//
// SYSTEM DESIGN PRINCIPLE
//   DRY: the ?category=...&cursor=... tail is written by shopQuery (lib/shopParams.js),
//   the same writer the public shop uses. This file only adds the /products front.
//
// RULES
//   1. Never build /products?... addresses by hand: call this.
//   2. Pure function: no React, no network.
//
// WHERE USED
//   app/(authed)/products/page.js
//
// TRADEOFFS
//   + One place. - Tiny; add more parts (search, status) in shopQuery when needed.
//
// HOW TO USE
//   import { productsHref } from '../../../lib/productsHref';
//   <Link href={productsHref({ category, cursor: nextCursor })}>
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// shopQuery = THE ENVELOPE WRITER (puts ? and & in the right places and leaves
//   empty boxes out). productsHref only writes the front of the address.
// ═══════════════════════════════════════════════════════════

import { shopQuery } from './shopParams';

export function productsHref({ category = null, cursor = null } = {}) {
  return `/products${shopQuery({ category, cursor })}`;
}
