// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/routes/storefront.routes.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   A route connects a URL to the function that answers it. It does no
//   work itself. This one connects GET /v1/storefront/:slug to
//   getStorefront.
//
// WHY IMPORTANT
//   Without it the public shop page gets a 404 even though the worker
//   function exists.
//
// DANGER (what breaks without it)
//   - The shop link on the dashboard opens a page with no data.
//
// WHAT IT SOLVES
//   Wires the public shop door to its controller.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: routes wire, guards identify, controllers
//   decide. Same as products, orders and tenants.
//
// RULES
//   1. No logic here. An "if" belongs in the guard or the controller.
//   2. Wrap every async handler in asyncHandler.
//   3. This router is mounted PUBLIC on purpose (no requireAuth), but
//      AFTER resolveShopBySlug and withTenant. Never add a route here that
//      writes data or returns private data. Public means read-only.
//
// PRACTICAL EXAMPLE
//   app.js mounts it at /v1/storefront/:slug, so router.get('/') answers
//   GET /v1/storefront/brio-hardware.
//
// DECISIONS
//   - Router({ mergeParams: true }) so the router can see :slug from the
//     mount path, even though the controller reads req.shop instead.
//
// WHERE USED
//   app.js. Later: GET /v1/storefront/:slug/products/:id for a single
//   product page.
//
// (Week 30) THE TILL LIVES NEXT DOOR
//   Buying (checkout, pay, payment status, delivery note) is NOT in this file.
//   Those routes WRITE, so they have their own file, checkout.routes.js, mounted
//   on the same address in app.js. This file stays read-only on purpose.
//
// TRADEOFFS
//   + One tiny file per area keeps each area easy to find.
//
// HOW TO USE
//   app.use('/v1/storefront/:slug', resolveShopBySlug, withTenant, storefrontRouter)
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { getStorefront } from '../controllers/storefront.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router({ mergeParams: true });

// GET /v1/storefront/:slug  ->  the shop's name and its active products
router.get('/', asyncHandler(getStorefront));

export default router;