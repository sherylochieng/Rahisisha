// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/routes/storefront.routes.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   A route connects a URL to the function that answers it. It does no
//   work itself. This one connects the PUBLIC shop door's addresses to
//   their controllers:
//     GET    /v1/storefront/:slug                    -> the shop window (products)
//     POST   /v1/storefront/:slug/checkout           -> make an order (Week 30)
//     GET    /v1/storefront/:slug/orders/:orderId    -> payment status (Week 30)
//     POST   /v1/storefront/:slug/orders/:orderId/pay  -> start M-Pesa prompt (Week 30)
//     PATCH  /v1/storefront/:slug/orders/:orderId/note -> delivery note, after payment (Week 30)
//
// WHY IMPORTANT
//   Without it the public shop page gets a 404 even though the worker
//   functions exist, and customers cannot buy anything.
//
// DANGER (what breaks without it)
//   - The shop link on the dashboard opens a page with no data.
//   - Customers cannot check out.
//   - (Week 30) This public door now has a few WRITE routes. That is a real
//     change of rule, so each one is narrow on purpose (see RULES).
//
// WHAT IT SOLVES
//   Wires the public shop door, window and checkout, to its controllers.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: routes wire, guards identify, controllers
//   decide. Same as products, orders and tenants.
//
// RULES
//   1. No logic here. An "if" belongs in the guard or the controller.
//   2. Wrap every async handler in asyncHandler.
//   3. This router is mounted PUBLIC on purpose (no requireAuth), but
//      AFTER resolveShopBySlug and withTenant, so every query is locked to
//      the shop in the address.
//   4. (Changed in Week 30) The old rule said "public means read-only". A
//      customer cannot buy from a read-only door, so we now allow ONLY these
//      writes, each with its own protection in checkout.controller.js:
//        - /checkout        server-side prices, active products only
//        - /orders/:id/pay  max 3 prompts per phone per 10 minutes
//        - /orders/:id/note only after payment, 300 characters
//      Do NOT add any other write route behind this mount. Anything that
//      changes products, prices or order status stays behind the owner's login.
//   5. A made-up or unknown order id always gets the same plain 404.
//
// PRACTICAL EXAMPLE
//   app.js mounts it at /v1/storefront/:slug, so router.post('/checkout')
//   answers POST /v1/storefront/brio-hardware/checkout.
//
// DECISIONS
//   - Router({ mergeParams: true }) so the router can see :slug from the
//     mount path, even though the controllers read req.shop / req.tenantId.
//   - The order id (a long random code) in the address is the customer's
//     "ticket". That is why the status and note routes need no login.
//   - POST/PATCH/PUT/DELETE on the bare /v1/storefront/:slug are still 404
//     (the isolation test 11 keeps proving it).
//
// WHERE USED
//   app.js. Later: GET /v1/storefront/:slug/products/:id for a single
//   product page.
//
// TRADEOFFS
//   + One tiny file per area keeps each area easy to find.
//   - The public door now accepts writes, so it is a bigger target. The
//     protections are in the controller and are covered by tests.
//
// HOW TO USE
//   app.use('/v1/storefront/:slug', resolveShopBySlug, withTenant, storefrontRouter)
// ═══════════════════════════════════════════════════════════

// PIECE BY PIECE
//   Router({ mergeParams: true }) = "a signboard that also knows which shop
//                                    (slug) we are in". Real life: a sign inside
//                                    the shop, not on the street.
//   router.get('/')               = the shop window (unchanged from Week 29).
//   router.post('/checkout')      = "I'd like to order these" (creates the order).
//   router.get('/orders/:orderId')= "has my payment come through?"
//   router.post('/orders/:orderId/pay') = "send the M-Pesa request to my phone".
//   router.patch('/orders/:orderId/note') = "deliver here" (after paying).
//   :orderId                      = the customer's ticket number in the address.
//   asyncHandler(...)             = the safety net: if the function fails, the
//                                   customer gets a clean error, never a hang.

import { Router } from 'express';
import { getStorefront } from '../controllers/storefront.controller.js';
import {
  createCheckout,
  payCheckoutOrder,
  getCheckoutOrder,
  saveDeliveryNote,
} from '../controllers/checkout.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router({ mergeParams: true });

// GET /v1/storefront/:slug  ->  the shop's name and its active products
router.get('/', asyncHandler(getStorefront));

// POST /v1/storefront/:slug/checkout  ->  create the order from the basket
router.post('/checkout', asyncHandler(createCheckout));

// GET /v1/storefront/:slug/orders/:orderId  ->  status the waiting screen polls
router.get('/orders/:orderId', asyncHandler(getCheckoutOrder));

// POST /v1/storefront/:slug/orders/:orderId/pay  ->  send the M-Pesa prompt
router.post('/orders/:orderId/pay', asyncHandler(payCheckoutOrder));

// PATCH /v1/storefront/:slug/orders/:orderId/note  ->  delivery note, after payment only
router.patch('/orders/:orderId/note', asyncHandler(saveDeliveryNote));

export default router;