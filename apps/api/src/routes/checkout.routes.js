// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/routes/checkout.routes.js   (Week 30, customer checkout)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The shop window (storefront.routes.js) is READ-ONLY: a customer looks, and
//   nothing is written. Buying is different: it writes an order and starts a
//   payment. This file holds ONLY those "till" routes, so anyone who opens it
//   sees at once where the public door can write, and nothing is buried inside
//   the window file.
//     POST   /v1/storefront/:slug/checkout                -> make an order
//     GET    /v1/storefront/:slug/orders/:orderId         -> payment status
//     POST   /v1/storefront/:slug/orders/:orderId/pay     -> start the M-Pesa prompt
//     PATCH  /v1/storefront/:slug/orders/:orderId/note    -> delivery note, after payment
//
// WHY IMPORTANT
//   These are the only write routes a stranger can reach without logging in, and
//   one of them starts a money movement. Keeping them in their own clearly named
//   file makes them easy to find, audit and test.
//
// DANGER (what breaks without it)
//   - Customers cannot check out.
//   - If someone adds a new write route here without protections, a stranger can
//     write to a shop. Every route in this file needs its own rule in
//     checkout.controller.js and a test in tests/isolation/checkout.cross-tenant.test.js.
//
// WHAT IT SOLVES
//   Separation of concerns: the window (read) and the till (write) are two files.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: routes wire, guards identify, controllers decide.
//   And: keep the dangerous door small and visible.
//
// RULES
//   1. No logic here. An "if" belongs in the guard or the controller.
//   2. Wrap every async handler in asyncHandler.
//   3. Mounted PUBLIC (no requireAuth) but AFTER resolveShopBySlug and withTenant,
//      so every query is locked to the shop in the address. See app.js.
//   4. Only these four routes. Anything that changes products, prices or order
//      status stays behind the owner's login.
//   5. A made-up or unknown order id always gets the same plain 404.
//
// PRACTICAL EXAMPLE
//   app.js mounts it at /v1/storefront/:slug, so router.post('/checkout') answers
//   POST /v1/storefront/brio-hardware/checkout.
//
// DECISIONS
//   - Mounted on the SAME line as the shop window in app.js, so the two guards
//     run ONCE per request (running them twice would hold two database
//     connections for one customer).
//   - The order id (a long random code) in the address is the customer's
//     "ticket", which is why status and note need no login.
//
// WHERE USED
//   app.js: app.use('/v1/storefront/:slug', resolveShopBySlug, withTenant,
//                   storefrontRouter, checkoutRouter)
//
// TRADEOFFS
//   + The till has its own file. The window file keeps its read-only rule.
//   - Two routers share one address prefix, so you need to know to look in both.
//
// HOW TO USE
//   import checkoutRouter from './routes/checkout.routes.js';
// ═══════════════════════════════════════════════════════════

// PIECE BY PIECE
//   Router({ mergeParams: true }) = "a signboard that also knows which shop (slug)
//                                    we are in". Real life: a sign INSIDE the shop.
//   router.post('/checkout')      = "I'd like to order these" -> creates the order.
//   router.get('/orders/:orderId')= "has my payment come through?"
//   router.post('.../pay')        = "send the M-Pesa request to my phone".
//   router.patch('.../note')      = "deliver here" (after paying).
//   :orderId                      = the customer's ticket number in the address.
//   asyncHandler(...)             = the safety net: if the function fails, the
//                                   customer gets a clean error, never a hang.

import { Router } from 'express';
import {
  createCheckout,
  payCheckoutOrder,
  getCheckoutOrder,
  saveDeliveryNote,
} from '../controllers/checkout.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router({ mergeParams: true });

// POST /v1/storefront/:slug/checkout  ->  create the order from the basket
router.post('/checkout', asyncHandler(createCheckout));

// GET /v1/storefront/:slug/orders/:orderId  ->  status the waiting screen polls
router.get('/orders/:orderId', asyncHandler(getCheckoutOrder));

// POST /v1/storefront/:slug/orders/:orderId/pay  ->  send the M-Pesa prompt
router.post('/orders/:orderId/pay', asyncHandler(payCheckoutOrder));

// PATCH /v1/storefront/:slug/orders/:orderId/note  ->  delivery note, after payment only
router.patch('/orders/:orderId/note', asyncHandler(saveDeliveryNote));

export default router;