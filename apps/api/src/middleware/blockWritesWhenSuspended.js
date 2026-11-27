// =============================================================================
// FILE: apps/api/src/middleware/blockWritesWhenSuspended.js   (Week 30 Day 3, Batch 1: admin core, step 5)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   When the platform admin suspends a shop, the shop owner may still SIGN IN
//   (so they can see what happened and why), but they may only LOOK, never
//   CHANGE anything. This guard enforces "look, do not touch": it lets reads
//   through and refuses every write while the shop is not active.
//
// WHY IMPORTANT
//   Without it, a suspended owner could keep adding products, changing order
//   statuses or uploading photos. The padlock the admin placed would mean
//   nothing on the owner's own door.
//
// DANGER
//   1. Mount it AFTER requireAuth (so req.tenantId exists) and, where the route
//      has one, AFTER withTenant (so req.db exists). Mounted first, it would
//      look up "undefined".
//   2. Only GET, HEAD and OPTIONS pass without a check. Every other method
//      (POST, PATCH, PUT, DELETE) is checked against the shop's status.
//   3. A status other than 'active' is refused. That includes 'deleted' and a
//      missing shop row: when unsure, say no.
//   4. The reason shown to the owner is the one the admin typed. The admin must
//      know it is visible to the owner (the admin screen will say so).
//   5. This guard does NOT protect public routes (storefront, USSD, WhatsApp,
//      M-Pesa). Those have their own checks. M-Pesa stays open ON PURPOSE, so
//      money that was already paid is still recorded.
//
// WHAT IT SOLVES
//   "Look, do not touch" for the owner of a suspended shop, with one clear
//   message that explains why.
//
// SYSTEM DESIGN PRINCIPLE
//   Fail closed: anything that is not clearly 'active' is refused.
//   Cheap by default: reads cost nothing extra. A write costs ONE small lookup
//   on the connection that already exists (tenants has no row level security).
//
// RULES
//   1. Reads (GET, HEAD, OPTIONS): always pass.
//   2. Writes: pass only when the shop's status is 'active'.
//   3. Refusal: 403 { data: null, error: { code, message, details? } }.
//        code 'shop_suspended'  + details.reason = the admin's reason.
//        code 'shop_unavailable' for deleted or missing shops (no reason shown).
//
// PRACTICAL EXAMPLE
//   Wanjiku's shop is suspended for "customers reported fake M-Pesa messages".
//   She signs in, sees her products (GET works), tries to add a dress (POST):
//   403 shop_suspended with that reason. When the admin reinstates the shop, the
//   very next POST works. No sign-out and no waiting.
//
// DECISIONS
//   - 403 (forbidden), not 401: she IS signed in, she is just not allowed to
//     change things right now.
//   - The status is read on EVERY write, not remembered in the login cookie, so
//     a suspend or a reinstate takes effect on the very next request.
//   - Uses req.db when it exists (same connection, no extra pool use), and the
//     plain pool for routes without withTenant (uploads).
//
// WHERE USED
//   apps/api/src/app.js: products, uploads, orders and inbox mounts.
//
// TRADEOFFS
//   + One tiny primary-key lookup per write. Nothing on reads.
//   - A write route that is mounted WITHOUT this guard is not protected. The
//     tests list every owner write door, so a forgotten one is noticed.
//
// HOW TO USE
//   app.use('/v1/products', requireAuth, withTenant, blockWritesWhenSuspended, productsRouter);
// =============================================================================

// PIECE BY PIECE
//   READ_METHODS             = the "just looking" kinds of request.
//   blockWritesWhenSuspended = the guard: looking is fine, touching needs an
//                              open shop.

import { pool } from '../db/pool.js';

// Requests that only LOOK. Real life: you may walk through a closed shop's
// window and look, but you may not rearrange the shelves.
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function blockWritesWhenSuspended(req, res, next) {
  try {
    // Looking is always allowed, and costs nothing extra.
    if (READ_METHODS.has(req.method)) return next();

    // Use the shop-scoped connection when there is one; otherwise the pool.
    // `tenants` has no row level security, so either can read it.
    const db = req.db || pool;
    const { rows } = await db.query(
      'SELECT status, suspended_reason FROM tenants WHERE id = $1',
      [req.tenantId]
    );
    const shop = rows[0];

    // Open shop: touching is allowed.
    if (shop && shop.status === 'active') return next();

    // Suspended shop: explain, and show the reason the admin gave.
    if (shop && shop.status === 'suspended') {
      return res.status(403).json({
        data: null,
        error: {
          code: 'shop_suspended',
          message: 'This shop is suspended. You can look around, but you cannot make changes until it is reinstated.',
          details: { reason: shop.suspended_reason },
        },
      });
    }

    // Deleted or missing: refuse, and show no reason.
    return res.status(403).json({
      data: null,
      error: { code: 'shop_unavailable', message: 'This shop is not available.' },
    });
  } catch (err) {
    // A database problem goes to the global error handler (a clean 500 or 503).
    return next(err);
  }
}
