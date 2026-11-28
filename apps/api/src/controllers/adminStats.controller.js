// =============================================================================
// FILE: apps/api/src/controllers/adminStats.controller.js   (Week 30 Day 3, Batch 3a: admin overview numbers)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Turns the web request "GET /v1/admin/stats" into a call to the stats service and writes
//   the reply. It is the front desk: it holds no counting rules.
//
// WHY IMPORTANT
//   The reply must be predictable and safe: the same envelope as the rest of your API,
//   and never a leaked database error.
//
// DANGER
//   1. Only reached through adminStats.routes.js, where requirePlatformAdmin runs first.
//   2. It reads NOTHING from the request (no query words, no body). Whatever a caller sends
//      is ignored, so there is nothing to attack.
//   3. Unknown errors are not shown to the caller. They go to the global error handler.
//
// WHAT IT SOLVES
//   One tidy HTTP layer for the overview numbers, in the shape { data, error }.
//
// SYSTEM DESIGN PRINCIPLE
//   Thin controller, fat service.
//
// RULES
//   1. GET /v1/admin/stats  ->  200 { data: { shops: {...} }, error: null }
//
// PRACTICAL EXAMPLE
//   200 { "data": { "shops": { "total": 9, "active": 8, "suspended": 1,
//   "verified": 2, "newThisWeek": 3 } }, "error": null }
//
// DECISIONS
//   - No try/catch: this service has no known refusals. A failure is a real fault (500/503)
//     and belongs to the global error handler.
//
// WHERE USED
//   apps/api/src/routes/adminStats.routes.js
//
// TRADEOFFS
//   + Tiny. Nothing to get wrong.
//
// HOW TO USE
//   Do not import this anywhere except adminStats.routes.js.
// =============================================================================

import { pool } from '../db/pool.js';
import { getPlatformStats } from '../services/adminStats.service.js';

// Answer the overview request with the counts.
export async function getStatsHandler(_req, res) {
  const stats = await getPlatformStats(pool);
  return res.status(200).json({ data: stats, error: null });
}
