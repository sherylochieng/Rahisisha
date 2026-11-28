// =============================================================================
// FILE: apps/api/src/routes/adminNotifications.routes.js   (Week 30 Day 3, Batch 3b-2b, step 3)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The addresses for the admin notifications window:
//     GET /v1/admin/notifications          one page of lines
//     GET /v1/admin/notifications/summary  the three counts
//
// WHY IMPORTANT
//   The admin guard is applied with router.use at the top, so no route below it
//   can forget the lock.
//
// DANGER
//   1. Keep router.use(requirePlatformAdmin) ABOVE every route.
//   2. No withTenant here: head office works across shops under the admin lock
//      that the service opens.
//   3. Read-only on purpose. A "retry" button would be a POST with a reason and
//      an audit receipt (a later step).
//
// WHAT IT SOLVES
//   "Who may ask, and where."
//
// SYSTEM DESIGN PRINCIPLE
//   Secure by default: the guard is the first thing every request meets.
//
// RULES
//   1. no-store header: the answers are never cached by the browser.
//   2. asyncHandler on every handler so errors reach the global handler.
//
// PRACTICAL EXAMPLE
//   app.use('/v1/admin/notifications', adminNotificationsRouter);
//
// DECISIONS
//   Same file shape as adminShops.routes.js and adminStats.routes.js.
//
// WHERE USED
//   apps/api/src/app.js
//
// TRADEOFFS
//   + Impossible to forget the guard. - One more file per resource.
//
// HOW TO USE
//   Mount once in app.js.
// =============================================================================

import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import {
  listNotificationsHandler,
  getNotificationSummaryHandler,
} from '../controllers/adminNotifications.controller.js';

const router = Router();

// Never let a browser or proxy keep these answers.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// THE LOCK. Everything below needs a signed-in platform admin.
router.use(requirePlatformAdmin);

router.get('/summary', asyncHandler(getNotificationSummaryHandler));
router.get('/', asyncHandler(listNotificationsHandler));

export default router;
