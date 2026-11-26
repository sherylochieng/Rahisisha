// =============================================================================
// FILE: apps/api/src/routes/uploads.routes.js   (Week 30, product photos)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Gives the uploads controller its web address: POST /v1/uploads/sign.
//   A route file only connects "this address" to "that function".
//
// WHY IMPORTANT
//   Where this router is mounted (app.js) decides who can reach it. The mount
//   line carries requireAuth, so only a logged-in shop owner gets a permit.
//
// DANGER
//   1. Never mount it without requireAuth.
//   2. Wrap the handler in asyncHandler so an error becomes a clean reply.
//   3. Mount it above the "unknown address" (404) catch-all in app.js.
//
// WHAT IT SOLVES
//   Wiring for the photo permit.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: routes connect, controllers work.
//
// RULES
//   POST only. No body is needed (the shop comes from the login cookie).
//
// PRACTICAL EXAMPLE
//   POST /v1/uploads/sign -> signUpload
//
// WHERE USED
//   Mounted in apps/api/src/app.js
//
// TRADEOFFS
//   + One tiny file per area, same pattern as the other routes.
//
// HOW TO USE
//   app.use('/v1/uploads', requireAuth, uploadsRouter);
// =============================================================================

// PIECE BY PIECE
//
// 1. import { Router } from 'express'
//    = "get a small signboard". A Router is a mini list of addresses that we
//    later hang inside the big app.
//    Real life: one signboard per department in a big market: "Photos this way".
//
// 2. import { signUpload } ...
//    = "bring in the clerk who does the work" (the controller).
//
// 3. import { asyncHandler } ...
//    = "a safety net around the clerk". If the clerk's work fails halfway, the
//    net catches it and sends a clean error, instead of the customer waiting
//    forever at the counter.
//
// 4. const router = Router()
//    = "make the signboard".
//
// 5. router.post('/sign', asyncHandler(signUpload))
//    = "when someone POSTs to /sign, send them to the clerk". The full address
//    becomes /v1/uploads/sign because app.js mounts this board under
//    /v1/uploads. POST (not GET) because it creates something new: a permit.
//    Real life: the sign says "Photo permits: window 1".
//
// 6. export default router
//    = "let app.js pick up this signboard and hang it on the wall".

import { Router } from 'express';
import { signUpload } from '../controllers/uploads.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// POST /v1/uploads/sign -> hand out one signed photo permit
router.post('/sign', asyncHandler(signUpload));

export default router;