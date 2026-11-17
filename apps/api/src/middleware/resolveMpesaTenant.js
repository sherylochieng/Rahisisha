/**
 * ============================================================
 * FILE: apps/api/src/middleware/resolveMpesaTenant.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   Safaricom posts a payment result to /callbacks/mpesa/<shop id>. Safaricom
 *   has no login cookie, so requireAuth cannot run. This guard checks the
 *   shop id in the URL really is one of our shops and stamps it on the
 *   request (req.tenantId). withTenant then locks the database to it.
 *
 * WHY IMPORTANT
 *   Everything after this trusts req.tenantId. The URL is the ONLY place the
 *   shop comes from; it is never read from the message body.
 *
 * DANGER
 *   - The shop id in the URL is NOT a secret and NOT proof of anything. It
 *     only tells us which shop's attempts to look in. The real proof is that
 *     the CheckoutRequestID matches OUR pending attempt for that shop and
 *     that Safaricom confirms it (see mpesa.callback.controller.js).
 *   - Do not answer an unknown shop with an error. Always the same 200
 *     "Accepted", so a stranger learns nothing about which ids exist.
 *   - Never log the URL or the body.
 *
 * WHAT IT SOLVES
 *   "One callback address pattern, many shops" for Day 3.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Stamp, then lock, then work (same as requireAuth, resolveUssdTenant and
 *   resolveWhatsappTenant).
 *
 * RULES
 *   1. The shop id must be a valid UUID, else ignore.
 *   2. The shop must exist and not be deleted, else ignore.
 *   3. Ignore = 200 {"ResultCode":0,"ResultDesc":"Accepted"}, nothing else.
 *   4. Only req.tenantId is set.
 *
 * PRACTICAL EXAMPLE
 *   POST /callbacks/mpesa/6549a72d-... : the shop exists, req.tenantId is set,
 *   next(). POST /callbacks/mpesa/not-a-uuid : 200 Accepted, nothing happens.
 *
 * DECISIONS (and WHY)
 *   - Plain pool and the tenants table: tenants has no RLS (we must find the
 *     shop BEFORE we know the shop).
 *   - A deleted shop is ignored, but a suspended one is not: a payment that
 *     really happened must still be recorded.
 *   - try/catch + next(err): Express 4 does not catch async errors.
 *
 * WHERE USED / FUTURE USES
 *   routes/mpesa.routes.js, before withTenant.
 *
 * TRADEOFFS
 *   + Tiny and easy to audit.
 *   - One extra query per callback.
 *
 * HOW TO USE
 *   router.post('/:tenantId', resolveMpesaTenant, withTenant, asyncHandler(handler))
 *
 * 
 * ============================================================
 */
import { pool } from '../db/pool.js';

// The one answer we always give Safaricom.
const ACCEPTED = { ResultCode: 0, ResultDesc: 'Accepted' };

// A real shop id looks like 6549a72d-ab20-4bb0-8b93-fdaed96a8f77.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveMpesaTenant(req, res, next) {
  try {
    const tenantId = req.params.tenantId;

    // Not even shaped like an id: ignore. (Also stops Postgres throwing a
    // bad-UUID error for text like 'abc'.)
    if (typeof tenantId !== 'string' || !UUID.test(tenantId)) {
      return res.status(200).json(ACCEPTED);
    }

    const { rows } = await pool.query(
      `SELECT id FROM tenants WHERE id = $1 AND status <> 'deleted'`,
      [tenantId]
    );
    if (!rows[0]) {
      return res.status(200).json(ACCEPTED);
    }

    req.tenantId = rows[0].id;
    return next();
  } catch (err) {
    return next(err);
  }
}