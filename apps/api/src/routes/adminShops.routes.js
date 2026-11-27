// =============================================================================
// FILE: apps/api/src/routes/adminShops.routes.js   (Week 30 Day 3, Batch 1: admin core, step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The address book for the admin's shop powers. It says which web address
//   goes to which handler, and, most important, puts the admin guard in front
//   of ALL of them.
//
// WHY IMPORTANT
//   If one route here forgot the guard, anyone on the internet could suspend a
//   shop. So the guard is applied ONCE, to the whole router, before any route
//   is declared. A route added later is protected automatically.
//
// DANGER
//   1. router.use(requirePlatformAdmin) must stay ABOVE every route line.
//   2. No withTenant here. The admin works across shops with the admin lock
//      that the service opens, never with a shop's lock.
//   3. Replies are marked no-store so a browser or proxy never keeps a copy of
//      shop details (owner phone numbers) after the admin signs out.
//
// WHAT IT SOLVES
//   "Which address does what, and who may call it."
//
// SYSTEM DESIGN PRINCIPLE
//   Secure by default: the guard is applied to the router, not remembered
//   route by route. Separation of concerns: routes only connect addresses to
//   handlers.
//
// RULES
//   1. All routes need a valid admin cookie (admin_token), or reply 401.
//   2. GET reads, POST changes.
//   3. Every handler is wrapped in asyncHandler so a crash reaches the global
//      error handler instead of hanging the request.
//
// PRACTICAL EXAMPLE
//   The admin dashboard (a later batch) calls:
//     GET  /v1/admin/shops?status=active&q=wanjiku
//     POST /v1/admin/shops/<id>/suspend   { "reason": "..." }
//
// DECISIONS
//   - Mounted at /v1/admin/shops in app.js, next to /v1/admin/auth.
//   - Four small POST routes, not one route with an "action" word in the body,
//     so each power is visible in the address, in logs and in tests.
//
// WHERE USED
//   apps/api/src/app.js
//
// TRADEOFFS
//   + Easy to read: six lines, six addresses.
//   - Four routes look alike. The shared handler pattern (in the controller)
//     keeps them from drifting apart.
//
// HOW TO USE
//   app.use('/v1/admin/shops', adminShopsRouter);   // already added in app.js
// =============================================================================

// PIECE BY PIECE
//   Router()                    = a small address book for one area.
//   router.use(no-store)        = stamp every reply "do not keep a copy".
//   router.use(requirePlatformAdmin) = the guard at the door of the whole area.
//   router.get / router.post    = one line per address.

import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import {
  listShopsHandler,
  getShopHandler,
  suspendShopHandler,
  reinstateShopHandler,
  verifyShopHandler,
  unverifyShopHandler,
} from '../controllers/adminShops.controller.js';

// A fresh address book for this area.
const router = Router();

// Every reply here may hold private details: never let a browser keep a copy.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// THE GUARD, for the whole area. Declared BEFORE every route below.
router.use(requirePlatformAdmin);

// Read: the register, and one shop's file.
router.get('/', asyncHandler(listShopsHandler));
router.get('/:id', asyncHandler(getShopHandler));

// Change: the four powers. Each needs { "reason": "..." } in the body.
router.post('/:id/suspend', asyncHandler(suspendShopHandler));
router.post('/:id/reinstate', asyncHandler(reinstateShopHandler));
router.post('/:id/verify', asyncHandler(verifyShopHandler));
router.post('/:id/unverify', asyncHandler(unverifyShopHandler));

export default router;
