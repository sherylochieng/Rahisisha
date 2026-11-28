// =============================================================================
// FILE: apps/api/src/routes/adminStats.routes.js   (Week 30 Day 3, Batch 3a: admin overview numbers)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The address book for the admin's overview numbers: one address, with the admin guard
//   in front of it.
//
// WHY IMPORTANT
//   The numbers describe the whole platform. They are for head office only, so the guard
//   is applied to the whole router, before any route is declared. A route added later is
//   protected automatically.
//
// DANGER
//   1. router.use(requirePlatformAdmin) must stay ABOVE every route line.
//   2. No withTenant here. The admin works across shops with the admin lock the service opens.
//   3. Replies are marked no-store so a browser or proxy never keeps a copy after sign-out.
//
// WHAT IT SOLVES
//   "Which address gives the overview, and who may call it."
//
// SYSTEM DESIGN PRINCIPLE
//   Secure by default (same pattern as adminShops.routes.js). Routes only connect
//   addresses to handlers.
//
// RULES
//   1. Needs a valid admin cookie (admin_token), or replies 401.
//   2. GET only. There is nothing to change here.
//   3. The handler is wrapped in asyncHandler so a crash reaches the global error handler.
//
// PRACTICAL EXAMPLE
//   GET /v1/admin/stats   (with the admin cookie)
//
// DECISIONS
//   - Mounted at /v1/admin/stats in app.js. The router answers at its root ('/').
//
// WHERE USED
//   apps/api/src/app.js
//
// TRADEOFFS
//   + One line of real routing. Later overview numbers (orders, revenue) can join here.
//
// HOW TO USE
//   app.use('/v1/admin/stats', adminStatsRouter);   // added in app.js
// =============================================================================

import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import { getStatsHandler } from '../controllers/adminStats.controller.js';

const router = Router();

// Never keep a copy of these numbers in a browser or proxy.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// The guard for everything below it.
router.use(requirePlatformAdmin);

router.get('/', asyncHandler(getStatsHandler));

export default router;
