// =============================================================
// FILE: apps/api/src/routes/mpesa.routes.js
// =============================================================
//
// WHY THIS FILE EXISTS
//   The one door Safaricom knocks on: POST /callbacks/mpesa/:tenantId.
//   It wires the URL to the guard, the shop lock and the handler.
//
// WHY IMPORTANT
//   The ORDER of the three steps is the whole safety story:
//     1. resolveMpesaTenant  find and stamp the shop from the URL
//     2. withTenant          lock the database to that shop
//     3. handleMpesaCallback do the work, using req.db only
//   Swap 1 and 2 and the database lock has no shop to use.
//
// DANGER
//   - This route is PUBLIC on purpose (Safaricom has no login cookie). Never
//     add requireAuth here, and never add other private routes to this file.
//   - Wrap the async handler in asyncHandler (Express 4 does not catch async
//     errors; a thrown error would hang the request).
//   - Mount it ABOVE the 404 catch-all in app.js.
//
// WHAT IT SOLVES
//   Day 3, Task 3 wiring: "POST /callbacks/mpesa/:tenantId".
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: this file only wires; the checks are in the guard
//   and the logic is in the controller. Public routes get their own router so
//   the guards that differ (no login) are visible in one place.
//
// RULES
//   1. No logic in this file.
//   2. Guard first, lock second, handler last.
//   3. Public, so nothing here may expose private data.
//
// PRACTICAL EXAMPLE
//   Safaricom: POST /callbacks/mpesa/6549a72d-... with the payment result.
//   -> guard (is this a shop?) -> lock -> handler (credit, once).
//
// DECISIONS (and WHY)
//   - A separate router (not inside orders.routes.js) because the guards
//     differ: orders need a login, the callback must not have one.
//   - Only POST. A GET to this address gets the normal JSON 404.
//
// WHERE USED
//   app.js: app.use('/callbacks/mpesa', mpesaRouter)
//
// TRADEOFFS
//   + Obvious and tiny.
//   - Another file to know about.
//
// HOW TO USE
//   The callback_url saved in daraja_configs must end in
//   /callbacks/mpesa/<that shop's id> (the seed script builds it).
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request. Declared in the Day 3 money audit.

// Router: Express's mini-app for a group of related URLs.
import { Router } from 'express';

// The guard: finds the shop from the URL and stamps req.tenantId.
import { resolveMpesaTenant } from '../middleware/resolveMpesaTenant.js';

// withTenant: locks the database to that shop and gives us req.db.
import { withTenant } from '../middleware/withTenant.js';

// asyncHandler: sends a thrown error to the central error handler.
import { asyncHandler } from '../middleware/asyncHandler.js';

// The handler that verifies and credits.
import { handleMpesaCallback } from '../controllers/mpesa.callback.controller.js';

const router = Router();

// POST /callbacks/mpesa/:tenantId
// Order matters: guard, then lock, then handler.
router.post('/:tenantId', resolveMpesaTenant, withTenant, asyncHandler(handleMpesaCallback));

export default router;