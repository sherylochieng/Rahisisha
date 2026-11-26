// =============================================================================
// FILE: apps/api/src/routes/adminAuth.routes.js   (Week 30, platform admin: step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Lists the three web addresses of the admin door and says which guard and
//   which handler serves each one. Nothing else: no logic lives here.
//
// WHY IMPORTANT
//   A route file is the map of the door. One missing guard here would leave an
//   address open to the world, so it is kept tiny and easy to read.
//
// DANGER
//   1. /me MUST keep requirePlatformAdmin. Login and logout are the only
//      addresses that may be open.
//   2. Every answer from this door must say Cache-Control: no-store, so a browser
//      or a proxy never keeps an admin's answer.
//   3. Do NOT put withTenant here. Admin work is not tied to one shop.
//
// WHAT IT SOLVES
//   One readable map of the admin sign-in addresses.
//
// SYSTEM DESIGN PRINCIPLE
//   Routes only wire things together (address -> guard -> handler).
//
// RULES
//   POST /v1/admin/auth/login    open (the brake protects it)
//   POST /v1/admin/auth/logout   open (it only clears a cookie)
//   GET  /v1/admin/auth/me       needs requirePlatformAdmin
//
// PRACTICAL EXAMPLE
//   GET /v1/admin/auth/me with no cookie -> 401 { data: null, error: { code: 'unauthorized', ... } }
//
// DECISIONS
//   - Mounted at /v1/admin/auth in app.js, leaving /v1/admin/... free for the
//     shop list and suspend actions later.
//
// WHERE USED
//   app.js: app.use('/v1/admin/auth', adminAuthRouter)
//
// TRADEOFFS
//   + Tiny and obvious.
//   - Login has no CSRF token; the cookie's sameSite 'strict' setting covers it.
//
// HOW TO USE
//   Import in app.js and mount it. Add new admin addresses in their own route
//   files (for example admin.shops.routes.js), not here.
// =============================================================================

// PIECE BY PIECE
//   noStore    = a sign on every reply: "do not photocopy this".
//   /login     = the sign-in desk (open, brake behind it).
//   /logout    = hand the badge back (open).
//   /me        = "show me my badge" (guard first).

import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import { loginAdmin, logoutAdmin, getAdminMe } from '../controllers/adminAuth.controller.js';

const router = Router();

// Every reply from this door is private: nothing may be stored by a browser or proxy.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// asyncHandler passes any error to the app's error handler (so a database
// problem becomes a clean 503 instead of a hanging request).
router.post('/login', asyncHandler(loginAdmin));
router.post('/logout', logoutAdmin);
router.get('/me', requirePlatformAdmin, getAdminMe);

export default router;