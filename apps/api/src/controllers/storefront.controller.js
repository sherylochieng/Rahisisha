// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/controllers/storefront.controller.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   It answers GET /v1/storefront/:slug, the data behind the PUBLIC shop
//   page: the shop's name and the products it is selling right now.
//
// WHY IMPORTANT
//   This is the first endpoint where a stranger, not a logged-in owner,
//   reads tenant data. What it returns is exactly what the whole internet
//   can see.
//
// DANGER (what breaks without care)
//   - Returning draft or archived products shows items the owner is not
//     ready to sell.
//   - Returning the SKU, status, created time or any internal field tells
//     strangers how the shop runs its stock.
//   - Using pool.query instead of req.db skips the database lock, and one
//     missing WHERE shows every shop's goods to everyone.
//
// WHAT IT SOLVES
//   Gives the public page what it needs and nothing more:
//   { data: { shop: { name, slug, town, description }, products: [...] }, nextCursor, error }.
//   (Week 30 Day 3, Batch 4b: town and description are the shop's public business card;
//   either may be null. The WhatsApp number is never part of this answer.)
//
// SYSTEM DESIGN PRINCIPLE
//   "Public endpoints expose the minimum", and "defence in depth": the
//   query filters (status active, not deleted) are the first wall, and the
//   database lock (RLS, set by withTenant) is the second wall.
//   Newest first with keyset paging, the same rule as Inbox, Payments and
//   Orders (utils/keysetCursor.js), so a long list never skips or repeats.
//
// RULES (never break these)
//   1. ALWAYS use req.db (locked to one shop). NEVER import pool here.
//   2. ONLY status = 'active' AND deleted_at IS NULL.
//   3. Product fields shown: id, name, description, price_cents, image_url
//      (the product photo address, public on purpose: a shop window needs
//      pictures; it is a Cloudinary link, no secret in it). Nothing
//      else. Add a field only after asking "is it fine for any stranger
//      to see this?".
//   4. Never read or return anything about wallet, orders, customers,
//      phone numbers or the owner.
//   5. Money stays whole cents (an integer). The page formats it.
//   6. A bad cursor is a clear 400, never a crash.
//
// PRACTICAL EXAMPLES
//   GET /v1/storefront/brio-hardware
//     -> { data: { shop: { name: 'Brio Hardware', slug: 'brio-hardware' },
//                  products: [ { id, name: 'Cement 50kg', description: null,
//                                price_cents: 75000 } ] },
//          nextCursor: null, error: null }
//   GET /v1/storefront/brio-hardware?limit=2        -> 2 products + nextCursor
//   GET /v1/storefront/brio-hardware?cursor=hello   -> 400 Invalid cursor
//   GET /v1/storefront/nobody                       -> 404 (stopped earlier,
//                                                     by resolveShopBySlug)
//
// DECISIONS
//   - limit: 1 to 48, default 24. 24 divides nicely into 2, 3 and 4 columns.
//   - The shop's name comes from req.shop (stamped by the guard), so this
//     file makes no second lookup for it.
//   - A shop with no active products is a normal 200 with an empty list,
//     not a 404: the shop exists, it just has nothing for sale yet.
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS
//   Any "public catalogue per customer" page: a menu, a portfolio, a
//   property list.
//
// TRADEOFFS
//   + Tiny, and protected twice.
//   - No search or categories yet. No caching headers yet; add them when
//     real traffic arrives.
//
// HOW TO USE
//   routes/storefront.routes.js: router.get('/', asyncHandler(getStorefront))
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request (follow-up to Week 29 Day 4).
//   Declared in docs/AI_AUDIT_week_29_day4.md.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. limit  =  "HOW MANY SHELVES TO SHOW AT ONCE"
//    parseInt, then clamped between 1 and 48. Real life: a window display
//    that holds 24 items; ?limit=100000 cannot make it hold the warehouse.
//
// 2. decodeCursor  =  "THE BOOKMARK"
//    The bookmark from the last page says "carry on after this product".
//    A made-up bookmark gets a clear 400 before any database work.
//
// 3. The SELECT  =  "WHAT GOES IN THE WINDOW"
//    status = 'active' and deleted_at IS NULL: only what the owner is
//    selling now. Newest first, with the id breaking ties so two products
//    saved in the same moment never swap places between pages.
//    LIMIT $3 is limit + 1: one spare row tells us if there is a next page.
//
// 4. hasMore / nextCursor  =  "IS THERE ANOTHER PAGE?"
//    If we got the spare row, make a bookmark from the last product we are
//    actually showing.
//
// 5. products.map(...)  =  "WRAP ONLY WHAT THE CUSTOMER MAY SEE"
//    We rebuild each product with exactly four fields, so even if someone
//    later adds a column to the SELECT, it does not reach the public by
//    accident.
// ═══════════════════════════════════════════════════════════

import {
  CURSOR_TS_SQL,
  decodeCursor,
  encodeCursor,
} from '../utils/keysetCursor.js';
// (Batch 4a-1) everything about aisles lives in the categories service
import { isCategorySlug, listShopCategories } from '../services/categories.service.js';
import { readPublicCard } from '../services/shopProfile.service.js';

export async function getStorefront(req, res) {
  // 1. How many products per page (1 to 48, default 24)
  const parsed = parseInt(req.query.limit, 10);
  const limit = Math.min(Math.max(Number.isNaN(parsed) ? 24 : parsed, 1), 48);

  // 2. The bookmark, if any. A bookmark we did not make is a 400.
  let ts = null;
  let id = null;
  if (req.query.cursor) {
    const c = decodeCursor(String(req.query.cursor));
    if (!c) {
      return res.status(400).json({
        data: null,
        error: { code: 'validation', message: 'Invalid cursor' },
      });
    }
    ts = c.ts;
    id = c.id;
  }

  // 2b. Optional filter ?category=<slug> (Week 30 Day 3, Batch 4a-1).
  //     A badly shaped word is a 400. A well-shaped word nobody uses (an old link)
  //     just finds nothing, so a stale link shows an empty shelf, not an error.
  let category = null;
  if (req.query.category !== undefined && req.query.category !== '') {
    const word = String(req.query.category);
    if (!isCategorySlug(word)) {
      return res.status(400).json({
        data: null,
        error: { code: 'validation', message: 'Invalid category' },
      });
    }
    category = word;
  }

  // 3. The active products of THIS shop. req.db is locked to the shop by
  //    withTenant, so rows of other shops are invisible even if this WHERE
  //    were wrong. Newest first, id breaks ties.
  const { rows } = await req.db.query(
    `SELECT id, name, description, price_cents, image_url,
            ${CURSOR_TS_SQL('created_at')} AS cursor_ts
       FROM products
      WHERE status = 'active'
        AND deleted_at IS NULL
        AND ($1::timestamptz IS NULL OR (created_at, id) < ($1::timestamptz, $2::uuid))
        AND ($4::text IS NULL OR category_id = (SELECT id FROM categories WHERE slug = $4 AND active))
      ORDER BY created_at DESC, id DESC
      LIMIT $3`,
    [ts, id, limit + 1, category]
  );

  // 4. One spare row means another page exists
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore ? encodeCursor(last.cursor_ts, last.id) : null;

  // 5. Only the five fields a stranger may see.
  //    image_url is the product photo address (null when the owner added no
  //    photo). Real life: the picture in the shop window, safe for any passer-by.
  const products = page.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price_cents: p.price_cents,
    image_url: p.image_url,
  }));

  // 6. The aisles THIS shop actually uses (so the page can show filter buttons only
  //    for aisles that have something in them). Still locked to this shop by req.db.
  const categories = await listShopCategories(req.db);

  // 7. The shop's public business card (Batch 4b): town and one-line description,
  //    both may be null. NEVER the WhatsApp number. Still locked to this shop by req.db.
  const card = await readPublicCard(req.db);

  res.json({
    data: { shop: { ...req.shop, ...card }, products, categories },
    nextCursor,
    error: null,
  });
}