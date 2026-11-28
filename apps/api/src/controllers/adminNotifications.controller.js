// =============================================================================
// FILE: apps/api/src/controllers/adminNotifications.controller.js   (Week 30 Day 3, Batch 3b-2b, step 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The thin layer between the web address and the service: read the allowed
//   words from the address, call the service, answer in the project's envelope.
//
// WHY IMPORTANT
//   Keeps rules out of the HTTP layer. It passes on ONLY the words we know, so
//   anything extra in the address is ignored.
//
// DANGER
//   1. The guard (requirePlatformAdmin) is in the router, not here. Never mount
//      these handlers without it.
//   2. Do not add more fields to the answer here. What may be shown is decided
//      in the service (no phone, no payload).
//
// WHAT IT SOLVES
//   "Turn GET /v1/admin/notifications into a call to the service."
//
// SYSTEM DESIGN PRINCIPLE
//   Route / controller / service layering. Same envelope as the other admin lists.
//
// RULES
//   1. Success: { data, nextCursor, error: null } for the list, { data, error: null } for the summary.
//   2. Known errors (validation) become 400 with { data: null, error: { code, message } }.
//   3. Unknown errors are re-thrown for the global error handler.
//
// PRACTICAL EXAMPLE
//   GET /v1/admin/notifications?status=failed&limit=10
//
// DECISIONS
//   Same shape as adminShops.controller.js so the web code can treat both lists alike.
//
// WHERE USED
//   apps/api/src/routes/adminNotifications.routes.js
//
// TRADEOFFS
//   + Small and predictable. - A little repetition of the error helper (kept local
//     so each controller stays readable on its own).
//
// HOW TO USE
//   Imported by the router only.
// =============================================================================

import { pool } from '../db/pool.js';
import { listNotifications, getNotificationSummary } from '../services/adminNotifications.service.js';

// Error code -> HTTP status.
const ERROR_STATUS = Object.freeze({
  validation: 400,
});

// If the error is one of ours, answer it and say so. Real life: the clerk reads
// out the reason a form was refused.
function answerKnownError(err, res) {
  const status = ERROR_STATUS[err && err.code];
  if (!status) return false;
  res.status(status).json({ data: null, error: { code: err.code, message: err.message } });
  return true;
}

// GET /  -> one page of lines.
export async function listNotificationsHandler(req, res) {
  try {
    // Pass on ONLY the three words we know. Everything else in the address is ignored.
    const { status, limit, cursor } = req.query;
    const page = await listNotifications(pool, { status, limit, cursor });
    return res.status(200).json({ data: page.items, nextCursor: page.nextCursor, error: null });
  } catch (err) {
    if (answerKnownError(err, res)) return undefined;
    throw err;
  }
}

// GET /summary  -> { queued, sent, failed }.
export async function getNotificationSummaryHandler(_req, res) {
  const counts = await getNotificationSummary(pool);
  return res.status(200).json({ data: counts, error: null });
}
