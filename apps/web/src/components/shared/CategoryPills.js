// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/shared/CategoryPills.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   A row of small buttons on the public shop page: "All", "Shoes",
//   "Beauty and hair"... Tapping one shows only that aisle.
//
// WHY IMPORTANT
//   A shop with 40 products is hard to scan. Aisle buttons let a shopper
//   on a phone get to what they want in one tap.
//
// DANGER (what breaks without it)
//   Without it shoppers scroll everything. If it linked without remembering
//   the aisle, "More products" would jump back to All.
//
// WHAT IT SOLVES
//   Shows only the aisles this shop really uses (the API sends them in
//   `categories`), highlights the current one, and scrolls sideways on a
//   narrow phone instead of wrapping into a tall block.
//
// SYSTEM DESIGN PRINCIPLE
//   A server component: plain links, no JavaScript sent to the phone. The
//   URL is the state (?category=shoes), so the page can be bookmarked,
//   shared on WhatsApp and works with the back button. Addresses come from
//   shopHref (DRY).
//
// RULES
//   1. Show nothing when the shop has no categorised products.
//   2. Mark the current button with aria-current="page" (screen readers).
//   3. Never build the address by hand: use shopHref.
//
// WHERE USED
//   app/shop/[slug]/page.js
//
// TRADEOFFS
//   + Fast, shareable, no client JS. - Each tap loads the page again
//     (fine for a shop window).
//
// HOW TO USE
//   <CategoryPills slug={slug} categories={categories} active={category} />
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// categories.length === 0 => return null = NO AISLE SIGNS IF NOTHING IS FILED.
// <nav aria-label> = TELLS A SCREEN READER "THIS IS THE AISLE MENU".
// overflow-x-auto + whitespace-nowrap = THE ROW SLIDES SIDEWAYS on a small
//   phone, like a rail of hangers.
// active === null = "All" is the current button.
// ═══════════════════════════════════════════════════════════

import Link from 'next/link';
import { shopHref } from '../../lib/shopHref';

const base = 'inline-block rounded-full border px-4 py-1.5 text-sm font-medium';
const on = 'border-brand-orange bg-brand-orange text-white';
const off = 'border-gray-300 bg-white text-brand-navy hover:bg-gray-50';

// One button. "All" and every aisle use this same piece (look changes in one place)
function Pill({ href, isActive, children }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={isActive ? 'page' : undefined}
        className={`${base} ${isActive ? on : off}`}
      >
        {children}
      </Link>
    </li>
  );
}

// hrefFor (Batch 4a-3): a function that turns a category word (or null for All) into
// an address. The public shop does not pass it (it defaults to shopHref for `slug`);
// the owner's Products page passes one that builds /products?category=... addresses.
// Real life: the same aisle signs, pointing to the shop floor or to the stockroom.
export default function CategoryPills({ slug, categories = [], active = null, hrefFor }) {
  if (categories.length === 0) return null;
  const hrefOf = hrefFor || ((category) => shopHref(slug, { category }));

  return (
    <nav aria-label="Shop by category" className="-mx-4 mb-5 overflow-x-auto px-4">
      <ul className="flex gap-2 whitespace-nowrap">
        <Pill href={hrefOf(null)} isActive={active === null}>
          All
        </Pill>
        {categories.map((c) => (
          <Pill key={c.slug} href={hrefOf(c.slug)} isActive={active === c.slug}>
            {c.name}
          </Pill>
        ))}
      </ul>
    </nav>
  );
}
