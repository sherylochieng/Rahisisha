// =============================================================================
// dashboard.routes.js — the sign on the door for /v1/dashboard
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - A route connects a URL to the function that answers it. It does no work
//   itself. Its only job is wiring
//
// WHY IMPORTANT:
// - Without it, a request to /v1/dashboard finds nothing and gets a 404
//
// DANGER (if this file does not exist):
// - The controller is finished but unreachable. The page shows an error
//
// WHAT IT SOLVES:
// - Points GET /v1/dashboard at getDashboard
//
// SYSTEM DESIGN PRINCIPLE: Separation of concerns
// - Routes wire. Controllers decide. Same pattern as products and orders
//
// RULES:
// - No logic here. If you feel like adding an "if", it belongs in the controller
// - Wrap every async handler in asyncHandler, or a crash leaves the request
//   hanging and the database connection stuck
// - requireAuth and withTenant are NOT added here. They are added once, where
//   the router is mounted in app.js, so no route can forget them
//
// PRACTICAL EXAMPLE:
// - app.js mounts this at /v1/dashboard, so router.get('/') answers
//   GET /v1/dashboard
// =============================================================================

// Router: a mini Express app that holds a group of related routes
import { Router } from 'express';

// The function that does the work
import { getDashboard } from '../controllers/dashboard.controller.js';

// asyncHandler: catches errors from async functions and passes them to the
// central error handler (so nothing hangs)
import { asyncHandler } from '../middleware/asyncHandler.js';

// Create this file's router
const router = Router();

// GET /v1/dashboard → today's numbers for the logged-in shop
router.get('/', asyncHandler(getDashboard));

// Share the router so app.js can mount it
export default router;