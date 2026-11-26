// =============================================================================
// FILE: apps/api/src/middleware/requirePlatformAdmin.js   (Week 30, platform admin: step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The guard on the head-office door. Every admin address (except login and
//   logout) goes through it first. It answers one question: "is this visitor a
//   real, still-active platform admin?" If yes, it writes who they are on the
//   request (req.admin) and lets them through. If no, it stops them with 401.
//
// WHY IMPORTANT
//   Everything an admin can do (see every shop, suspend a shop) sits behind this
//   one guard. If it is weak, a stranger or an ordinary shop owner could act as
//   the platform owner.
//
// DANGER
//   1. It reads ONLY the admin cookie (admin_token). A shop owner's cookie
//      (token) is never looked at, so it can never open this door.
//   2. It re-checks the database on EVERY request (loadActiveAdmin). A badge is
//      only a claim; a disabled or deleted admin is locked out at once.
//   3. All failures give the same vague answer, so a visitor learns nothing
//      about why they were refused.
//   4. It must NEVER use withTenant or req.db. Admin work is not tied to one
//      shop. It uses its own locked door (withAdminLock) inside the service.
//
// WHAT IT SOLVES
//   One place that decides "admin or not", instead of every admin route
//   repeating the check (and one of them forgetting).
//
// SYSTEM DESIGN PRINCIPLE
//   Authenticate at the door, once, in a guard (middleware). Business code later
//   can trust req.admin because nothing reaches it without passing here.
//
// RULES
//   1. No cookie, a fake badge, an expired badge, or a shop-owner badge: 401.
//   2. A valid badge for an admin who is deleted or disabled: 401.
//   3. A database failure is passed on with next(err), so the app answers 503
//      (service unavailable) rather than wrongly saying "not signed in".
//   4. On success: req.admin = { id, phone, name }. Never the password hash.
//
// PRACTICAL EXAMPLE
//   router.get('/me', requirePlatformAdmin, getAdminMe);
//   // inside getAdminMe, req.admin.name is "Sheryl"
//
// DECISIONS
//   - Answer shape follows the new API envelope: { data: null, error: { code, message } }.
//   - Code 'unauthorized' and message 'Not signed in' for every refusal.
//
// WHERE USED
//   routes/adminAuth.routes.js (the /me address), and every admin route added
//   later (shop list, suspend, reinstate).
//
// TRADEOFFS
//   + A disabled admin is out immediately.
//   - One tiny database query per admin request. Admin traffic is very low.
//
// HOW TO USE
//   import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
//   router.get('/something', requirePlatformAdmin, handler);
// =============================================================================

// PIECE BY PIECE
//   refuse()               = the guard saying "not today" in one fixed way.
//   requirePlatformAdmin   = the guard: reads the badge, checks the stamp, then
//                            phones the staff book to confirm the person still works here.

// pool: the connection to the database (the staff book lives there).
import { pool } from '../db/pool.js';
// The badge reader, the staff-book check, and the cookie's name.
import {
  ADMIN_COOKIE_NAME,
  readAdminToken,
  loadActiveAdmin,
} from '../services/platformAdminAuth.service.js';

// One fixed refusal. Every reason for refusing looks exactly the same from outside.
function refuse(res) {
  return res.status(401).json({
    data: null,
    error: { code: 'unauthorized', message: 'Not signed in' },
  });
}

export async function requirePlatformAdmin(req, res, next) {
  try {
    // Step 1: take the admin badge from the admin cookie (and only that cookie).
    // `req.cookies` is filled by cookie-parser in app.js. The optional `?.` stops a crash
    // if cookies are missing altogether.
    const badge = req.cookies?.[ADMIN_COOKIE_NAME];

    // Step 2: check the stamp, the expiry and the badge type. Fake, old or
    // shop-owner badges all give null here.
    const who = readAdminToken(badge);
    if (!who) return refuse(res);

    // Step 3: a badge is only a claim. Ask the staff book if this person still
    // exists and is active. A disabled admin gets null and is refused.
    const admin = await loadActiveAdmin(pool, who.adminId);
    if (!admin) return refuse(res);

    // Step 4: write who they are on the request, for the code that runs next.
    req.admin = { id: admin.id, phone: admin.phone, name: admin.name };

    // Step 5: open the door.
    return next();
  } catch (err) {
    // Not the visitor's fault (for example the database is down): hand the
    // problem to the app's error handler, which answers 503 or 500.
    return next(err);
  }
}