// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/routes/shopProfile.routes.js   (Week 30 Day 3, Batch 4b)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Connects the addresses GET and PUT /v1/shop/profile to the functions that answer
//   them. A route only wires; it does no work itself.
//
// WHY IMPORTANT
//   Without it the owner's Shop profile page gets "404 not found".
//
// DANGER
//   Mounted in app.js BEHIND requireAuth, withTenant and blockWritesWhenSuspended.
//   Never mount it without them, or one shop could read another's card.
//
// WHAT IT SOLVES
//   Wiring: GET -> getProfile, PUT -> updateProfile.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: routes wire, controllers decide, services touch the database.
//
// RULES
//   No logic here. If you want an "if", it belongs in the controller.
//
// PRACTICAL EXAMPLE
//   app.js mounts this at /v1/shop/profile, so router.get('/') answers GET /v1/shop/profile.
//
// WHERE USED
//   app.js
//
// HOW TO USE
//   import shopProfileRouter from './routes/shopProfile.routes.js';
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// asyncHandler = A SAFETY NET: if the function crashes, the error goes to the error
//                handler instead of leaving the request hanging.
// ═══════════════════════════════════════════════════════════

// Router = a mini Express app that holds a group of related addresses.
import { Router } from 'express';

// The two functions that do the work (they live in the controller).
import { getProfile, updateProfile } from '../controllers/shopProfile.controller.js';

// asyncHandler = a safety net around an async function. If it crashes, the error goes
// to the app's error handler instead of leaving the request hanging forever.
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// GET /v1/shop/profile -> "show me my card". The "/" here means "exactly the address
// app.js mounted this router on", so no extra path is needed.
router.get('/', asyncHandler(getProfile));

// PUT /v1/shop/profile -> "save my changes". Same address, different verb (PUT = save).
router.put('/', asyncHandler(updateProfile));

// app.js imports this and mounts it behind requireAuth + withTenant.
export default router;
