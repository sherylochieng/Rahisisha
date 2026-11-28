// =============================================================================
// FILE: apps/api/src/services/categories.service.js   (Week 30 Day 3, Batch 4a-1: categories, step 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Two small questions about the aisles: "what categories exist?" (the public
//   list) and "is this category id real and switched on?" (used when a shop picks
//   a category for a product).
//
// WHY IMPORTANT
//   The list is shared by every shop and, later, by the marketplace. One place
//   that reads it means one place to change a rule (for example hiding a category).
//
// DANGER
//   1. Read-only. Writing categories is head office's job (a later admin screen)
//      and the database refuses everyone else.
//   2. Never trust a category id from a request. findActiveCategory checks it is
//      shaped like an id AND exists AND is active, before it is saved on a product.
//   3. Only id, slug and name are returned. Nothing else about a category is public.
//
// WHAT IT SOLVES
//   "Fill the category dropdown" and "refuse a made-up category".
//
// SYSTEM DESIGN PRINCIPLE
//   Reference data service: small, cacheable, read-only. Takes the database
//   connection as an argument so it works with the plain pool (public list) or a
//   shop's own connection (req.db) alike.
//
// RULES
//   1. listCategories returns only active categories, smallest sort_order first.
//   2. findActiveCategory returns the row or null (never throws for a bad id).
//
// PRACTICAL EXAMPLE
//   const list = await listCategories(pool);   // [{ id, slug, name }, ...]
//   const ok = await findActiveCategory(req.db, req.body.categoryId);
//
// DECISIONS
//   - Takes `db` (anything with .query) so tests and callers choose the connection.
//   - A bad id shape returns null instead of letting Postgres throw an error.
//
// WHERE USED
//   controllers/categories.controller.js, controllers/products.controller.js
//
// TRADEOFFS
//   + Tiny and safe. - Every call reads the table (it is ten rows, so that is fine).
//
// HOW TO USE
//   import { listCategories, findActiveCategory } from './categories.service.js';
// =============================================================================

// A UUID, like 5bc6d791-ad88-41ad-93c2-4663c1d0507f.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The public list: active categories in head office's order.
export async function listCategories(db) {
  const { rows } = await db.query(
    `SELECT id, slug, name
       FROM categories
      WHERE active
      ORDER BY sort_order, name`
  );
  return rows;
}

// One active category by id, or null. Real life: the clerk checks the aisle
// number written on a stock slip really exists before shelving.
export async function findActiveCategory(db, id) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) return null;
  const { rows } = await db.query(
    'SELECT id, slug, name FROM categories WHERE id = $1 AND active',
    [id]
  );
  return rows[0] || null;
}
