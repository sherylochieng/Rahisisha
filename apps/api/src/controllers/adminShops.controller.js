// =============================================================================
// FILE: apps/api/src/controllers/adminShops.controller.js   (Week 30 Day 3, Batch 1: admin core, step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Turns web requests into calls to the shops service, and turns the service's
//   answers (and its refusals) into clean web answers. It is the "front desk":
//   it reads what the admin sent, hands it to the service, and writes the reply.
//   It holds NO shop rules. Those live in adminShops.service.js.
//
// WHY IMPORTANT
//   The reply must be safe and predictable. A refusal must be a clear, small
//   message with the right status number, never a crash page or a leaked
//   database error.
//
// DANGER
//   1. This file must only be reached through the router that runs
//      requirePlatformAdmin first (adminShops.routes.js). req.admin exists only
//      because that guard ran.
//   2. Only five query words are passed on (status, q, verified, limit,
//      cursor). Nothing else from the address is trusted.
//   3. The admin id comes from the signed admin cookie (req.admin.id), NEVER
//      from the request body. A body that says { adminId: ... } is ignored.
//   4. Unknown errors are NOT shown to the user. They go to the global error
//      handler (a plain 500 or 503), so database details never leak.
//
// WHAT IT SOLVES
//   One tidy HTTP layer for the six admin shop actions, with the same reply
//   envelope as the rest of your API: { data, nextCursor, error }.
//
// SYSTEM DESIGN PRINCIPLE
//   Thin controller, fat service. The controller only translates (HTTP in,
//   HTTP out). One mapping table (ERROR_STATUS) turns each service error code
//   into the right HTTP status in ONE place.
//
// RULES
//   1. List:   GET  /v1/admin/shops?status=&q=&verified=&limit=&cursor=
//   2. One:    GET  /v1/admin/shops/:id
//   3. Actions: POST /v1/admin/shops/:id/(suspend|reinstate|verify|unverify)
//      with a JSON body { "reason": "..." }.
//   4. Status numbers: 200 ok, 400 validation, 404 shop not found,
//      409 "not allowed in the shop's current state" (already suspended, ...).
//
// PRACTICAL EXAMPLE
//   POST /v1/admin/shops/<id>/suspend   { "reason": "fake M-Pesa messages" }
//   200 { "data": { ...the shop, status "suspended"... }, "error": null }
//   Same call again: 409 { "data": null, "error": { "code": "already_suspended", ... } }
//
// DECISIONS
//   - Actions are POST (they change things), never GET.
//   - 409 Conflict for state problems, 404 for a missing shop, 400 for bad input.
//   - The caller's network address (req.ip) is passed to the receipt. NOTE: until
//     the "trust proxy" step is done, behind Render this may be Render's own
//     address. The receipt is still correct about WHO and WHAT.
//
// WHERE USED
//   apps/api/src/routes/adminShops.routes.js
//
// TRADEOFFS
//   + Very small and easy to read. All rules stay testable in the service.
//   - One more file than putting everything in the route. That is the price of
//     "one job per file".
//
// HOW TO USE
//   Do not import this anywhere except adminShops.routes.js.
// =============================================================================

// PIECE BY PIECE
//   ERROR_STATUS        = the table that says which HTTP number each service
//                         refusal gets.
//   answerKnownError()  = if the service refused for a KNOWN reason, write the
//                         clean reply and say "handled"; otherwise say "not mine".
//   listShopsHandler()  = GET the register of shops.
//   getShopHandler()    = GET one shop's file.
//   makeActionHandler() = builds the four POST handlers from one pattern, so
//                         suspend, reinstate, verify and unverify cannot drift apart.

import { pool } from '../db/pool.js';
import {
  listShops,
  getShop,
  suspendShop,
  reinstateShop,
  verifyShop,
  unverifyShop,
} from '../services/adminShops.service.js';

// Which HTTP number each KNOWN service refusal gets.
// Real life: the front desk has a card that says "file not found = 404",
// "not allowed right now = 409", "form filled wrongly = 400".
const ERROR_STATUS = Object.freeze({
  validation: 400,
  shop_not_found: 404,
  shop_deleted: 409,
  already_suspended: 409,
  not_suspended: 409,
  already_verified: 409,
  not_verified: 409,
});

// If the error is one we know, send the clean reply and return true.
// If not, return false so the caller can pass it on to the global handler.
function answerKnownError(err, res) {
  const status = ERROR_STATUS[err && err.code];
  // Not one of ours (for example a database error): not handled here.
  if (!status) return false;
  res.status(status).json({
    data: null,
    error: { code: err.code, message: err.message },
  });
  return true;
}

// GET /v1/admin/shops  : the register of shops, one page at a time.
export async function listShopsHandler(req, res) {
  try {
    // Pass on ONLY the five words we know. Everything else in the address is ignored.
    const { status, q, verified, limit, cursor } = req.query;
    const page = await listShops(pool, { status, q, verified, limit, cursor });
    // Same envelope as your inbox and wallet lists.
    return res.status(200).json({ data: page.items, nextCursor: page.nextCursor, error: null });
  } catch (err) {
    if (answerKnownError(err, res)) return undefined;
    throw err;
  }
}

// GET /v1/admin/shops/:id  : one shop's file with its latest receipts.
export async function getShopHandler(req, res) {
  try {
    const shop = await getShop(pool, req.params.id);
    return res.status(200).json({ data: shop, error: null });
  } catch (err) {
    if (answerKnownError(err, res)) return undefined;
    throw err;
  }
}

// Build one POST handler from one pattern. `action` is the service function.
// Real life: the same form (shop number + reason) is used for four different
// stamps, so we print the form once and only change the stamp.
function makeActionHandler(action) {
  return async function actionHandler(req, res) {
    try {
      const shop = await action(pool, {
        // WHO: always from the signed admin cookie, never from the body.
        adminId: req.admin.id,
        // WHICH SHOP: from the address.
        tenantId: req.params.id,
        // WHY: from the body. If there is no body, the service refuses (validation).
        reason: req.body ? req.body.reason : undefined,
        // FROM WHERE: the caller's network address, for the receipt.
        ip: req.ip,
      });
      return res.status(200).json({ data: shop, error: null });
    } catch (err) {
      if (answerKnownError(err, res)) return undefined;
      throw err;
    }
  };
}

// The four POST handlers.
export const suspendShopHandler = makeActionHandler(suspendShop);
export const reinstateShopHandler = makeActionHandler(reinstateShop);
export const verifyShopHandler = makeActionHandler(verifyShop);
export const unverifyShopHandler = makeActionHandler(unverifyShop);
