// =============================================================================
// tenants.routes.js — the sign on the door for /v1/tenants
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - A route connects a URL to the function that answers it. It does no work
//   itself. Its only job is wiring
//
// WHY IMPORTANT:
// - Without it, GET /v1/tenants/by-slug/skirt-shirt finds nothing and gets a 404,
//   even though the worker function exists
//
// DANGER (if this file does not exist):
// - The website's gate guard can never find a shop. Every address looks unknown
//
// WHAT IT SOLVES:
// - Points GET /v1/tenants/by-slug/:slug at getTenantBySlug
//
// SYSTEM DESIGN PRINCIPLE: Separation of concerns
// - Routes wire. Controllers decide. Same pattern as products, orders and
//   the dashboard
//
// RULES:
// - No logic here. If you feel like adding an "if", it belongs in the controller
// - Wrap every async handler in asyncHandler, or a crash leaves the request
//   hanging
// - This router is mounted WITHOUT requireAuth and WITHOUT withTenant, on
//   purpose. Do not add private routes to this file. Anything private belongs
//   in a router mounted behind both guards
//
// PRACTICAL EXAMPLE:
// - app.js mounts this at /v1/tenants, so router.get('/by-slug/:slug') answers
//   GET /v1/tenants/by-slug/skirt-shirt
// =============================================================================

// Router: a mini Express app that holds a group of related routes
import { Router } from 'express';

// The function that does the work
import { getTenantBySlug } from '../controllers/tenants.controller.js';

// asyncHandler: catches errors from async functions and passes them to the
// central error handler (so nothing hangs)
import { asyncHandler } from '../middleware/asyncHandler.js';

// Create this file's router
const router = Router();

// GET /v1/tenants/by-slug/:slug → which shop has this address word?
// :slug is a placeholder. Express puts the real word in req.params.slug
router.get('/by-slug/:slug', asyncHandler(getTenantBySlug));

// Share the router so app.js can mount it
export default router;