// =============================================================================
// ussd.routes.js — the sign on the door for POST /ussd
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - A route connects a URL to the function that answers it. It does no work
//   itself. Its only job is wiring
//
// WHY IMPORTANT:
// - Without it, Africa's Talking calls /ussd and gets a 404. Every caller's
//   phone shows an error
//
// DANGER (if this file does not exist):
// - The controller is finished but unreachable. Nobody can dial any shop
//
// WHAT IT SOLVES:
// - Points POST /ussd at handleUssd
//
// SYSTEM DESIGN PRINCIPLE: Separation of concerns
// - Routes wire. Controllers decide. Same pattern as dashboard and products
//
// RULES:
// - No logic here. If you feel like adding an "if", it belongs in the controller
// - Wrap the async handler in asyncHandler, or a crash leaves the call hanging
// - The guards (resolveUssdTenant, then withTenant) are NOT added here. They
//   are added once, where the router is mounted in app.js, exactly like
//   requireAuth + withTenant for /v1/products. No route can forget them
// - It is POST, because Africa's Talking always POSTs
//
// PRACTICAL EXAMPLE:
// - app.js mounts this at /ussd, so router.post('/') answers POST /ussd
//
// DECISIONS:
// - The URL is /ussd, not /v1/ussd: this is a callback URL we paste into the
//   Africa's Talking dashboard, and it is not part of the website's API
//
// WHERE USED / FUTURE USES:
// - Mounted in app.js. Later: a /ussd/events route if we add ussd_events
//
// TRADEOFFS:
// - One shared endpoint means one place to secure and test, but every shop
//   depends on it. A bug here affects all shops
//
// HOW TO USE:
// - app.use('/ussd', resolveUssdTenant, withTenant, ussdRouter);
// =============================================================================

// Router: a mini Express app that holds a group of related routes
import { Router } from 'express';

// The function that does the work (the waiter)
import { handleUssd } from '../controllers/ussd.controller.js';

// asyncHandler: catches errors from async functions and passes them to the
// central error handler (so nothing hangs)
import { asyncHandler } from '../middleware/asyncHandler.js';

// Create this file's router
const router = Router();

// POST /ussd → the shop's USSD menu for whoever dialled
router.post('/', asyncHandler(handleUssd));

// Share the router so app.js can mount it
export default router;