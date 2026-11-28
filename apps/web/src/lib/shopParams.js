// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/lib/shopParams.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The vocabulary of a public shop address: which aisle (category) and where
//   in the list (cursor). It holds the two rules about it: how to READ an aisle
//   word safely, and how to WRITE the "?category=...&cursor=..." tail.
//
// WHY IMPORTANT
//   The page that reads the address, the link builder and the API call all
//   need the same rules. Before this file, the tail was built in two places.
//
// DANGER (what breaks without it)
//   One place accepts an aisle word the other would reject, or the tail is
//   written differently in a link than in the API call.
//
// WHAT IT SOLVES
//   parseCategory('shoes')        -> 'shoes'
//   parseCategory('Bad Word')     -> null  (shown as All)
//   shopQuery({ category: 'shoes', cursor: 'abc' }) -> '?category=shoes&cursor=abc'
//   shopQuery({})                 -> ''
//
// SYSTEM DESIGN PRINCIPLE
//   DRY and separation of concerns: pure functions, no React, no network.
//   Same slug rule as the API (lowercase words joined by dashes, up to 60).
//
// RULES
//   1. Never trust an aisle word from the address: always parseCategory it.
//   2. Never build "?category=" text by hand: use shopQuery.
//
// WHERE USED
//   lib/shopHref.js, lib/publicApi.js, app/shop/[slug]/page.js
//
// TRADEOFFS
//   + One place to change. - The slug rule also exists in the API and the
//     database (a different program, so it cannot be shared directly).
//
// HOW TO USE
//   import { parseCategory, shopQuery } from '../lib/shopParams';
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// CATEGORY_PATTERN = THE SHAPE OF AN AISLE CODE ON THE SIGN.
// parseCategory    = THE DOORKEEPER: only well-shaped words get in, others
//                    become null and the shopper simply sees All.
// shopQuery        = THE ENVELOPE WRITER: ? and & in the right places,
//                    special characters made safe, empty parts left out.
// ═══════════════════════════════════════════════════════════

const CATEGORY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Read an aisle word from the address. Returns the word, or null if unusable.
export function parseCategory(raw) {
  return typeof raw === 'string' && raw.length <= 60 && CATEGORY_PATTERN.test(raw)
    ? raw
    : null;
}

// Write the tail of a shop address (or of the storefront API call).
export function shopQuery({ category = null, cursor = null } = {}) {
  const parts = new URLSearchParams();
  if (category) parts.set('category', category); // which aisle
  if (cursor) parts.set('cursor', cursor);       // where in the aisle
  const text = parts.toString();
  return text ? `?${text}` : '';
}
