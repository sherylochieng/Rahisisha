// =============================================================================
// FILE: apps/api/src/routes/categories.routes.js   (Week 30 Day 3, Batch 4a-1, step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The address GET /v1/categories (public, read-only).
//
// WHY IMPORTANT
//   One tiny router, mounted before any sign-in rule, so shoppers and the product
//   form can read the list.
//
// DANGER
//   1. Public: add no write routes here. Writing categories belongs to head office
//      and will be an admin route behind requirePlatformAdmin.
//
// WHAT IT SOLVES
//   "Where do I ask for the categories?"
//
// SYSTEM DESIGN PRINCIPLE
//   Least privilege: a public router that can only read one small list.
//
// RULES
//   1. GET only.
//
// PRACTICAL EXAMPLE
//   app.use('/v1/categories', categoriesRouter);
//
// DECISIONS
//   Same file shape as the other route files.
//
// WHERE USED
//   apps/api/src/app.js
//
// TRADEOFFS
//   + Impossible to write through it. - One more small file.
//
// HOW TO USE
//   Mount once in app.js.
// =============================================================================

import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { listCategoriesHandler } from '../controllers/categories.controller.js';

const router = Router();

router.get('/', asyncHandler(listCategoriesHandler));

export default router;
