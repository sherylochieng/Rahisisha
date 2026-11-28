// =============================================================================
// FILE: apps/api/src/controllers/categories.controller.js   (Week 30 Day 3, Batch 4a-1, step 3)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Answers GET /v1/categories with the public list of categories.
//
// WHY IMPORTANT
//   The product form (shop owners) and, later, the marketplace home and category
//   pages all read this list.
//
// DANGER
//   1. Public on purpose: no sign-in needed, and it uses the plain pool (the list is
//      the same for everyone). Never add shop-specific or admin-only data to it.
//   2. The answer is cached for 5 minutes by browsers and proxies. A rename may take
//      up to 5 minutes to show.
//
// WHAT IT SOLVES
//   "What aisles can a product be in?"
//
// SYSTEM DESIGN PRINCIPLE
//   Route / controller / service layering. Public reference data is cacheable.
//
// RULES
//   1. Envelope: { data: [{ id, slug, name }], error: null }.
//
// PRACTICAL EXAMPLE
//   GET /v1/categories -> { data: [{ id, slug: 'womens-fashion', name: "Women's fashion" }, ...], error: null }
//
// DECISIONS
//   - Cache-Control public, 300 seconds: the list changes rarely and every page of the
//     marketplace will ask for it.
//
// WHERE USED
//   routes/categories.routes.js
//
// TRADEOFFS
//   + Fast, cheap. - A change shows after up to 5 minutes.
//
// HOW TO USE
//   Imported by the router only.
// =============================================================================

import { pool } from '../db/pool.js';
import { listCategories } from '../services/categories.service.js';

export async function listCategoriesHandler(_req, res) {
  const data = await listCategories(pool);
  // Same list for everyone, so it may be cached for a short while.
  res.set('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ data, error: null });
}
