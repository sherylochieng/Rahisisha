/**
 * ============================================================
 * FILE: apps/api/src/middleware/resolveUssdTenant.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   Every USSD request arrives on ONE shared endpoint (POST /ussd)
 *   but belongs to ONE shop. This file is the guard at the door:
 *   it reads the dialled service code, finds which shop owns it,
 *   and stamps that shop on the request (req.tenantId).
 *
 * WHY IMPORTANT
 *   Everything after this guard trusts req.tenantId. A wrong shop
 *   here means the whole menu shows the wrong shop's data.
 *
 * DANGER
 *   NEVER find the shop from the phone number or from anything the
 *   caller types. Anyone can fake those. The service code is the
 *   number the telecom routes to us, so it is the trusted key.
 *
 * WHAT IT SOLVES
 *   "One endpoint, many shops": no copy-pasted code per shop.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Separation of concerns. Guard = WHO. Controller = WHAT.
 *   Resolve identity once, early, in one place.
 *
 * RULES
 *   1. Unknown service code -> "END Service unavailable".
 *      Nothing else is read or returned.
 *   2. Only set req.tenantId from ussd_configs.
 *   3. Never trust the phone number as the shop.
 *
 * PRACTICAL EXAMPLE
 *   Caller dials *384*101#. Africa's Talking posts
 *   serviceCode=*384*101#. Guard finds Amina's Boutique, sets
 *   req.tenantId, calls next(). A caller dialling *384*999#
 *   (nobody owns it) gets END Service unavailable.
 *
 * DECISIONS
 *   - Plain pool, no RLS on ussd_configs: we must look up the shop
 *     BEFORE we know the shop (same trap that broke login before
 *     migration 022).
 *   - try/catch + next(err): Express 4 does not catch async errors.
 *   - Runs BEFORE withTenant, which then sets the RLS lock using
 *     req.tenantId. Same "stamp, then lock" pattern as
 *     requireAuth -> withTenant.
 *
 * WHERE USED / FUTURE USES
 *   routes/ussd.routes.js. Later: balance, products, language per
 *   tenant, ussd_events logging.
 *
 * TRADEOFFS
 *   One DB query per request. Fine for now. If traffic grows, cache
 *   service_code -> tenant_id in memory.
 *
 * HOW TO USE
 *   router.post('/ussd', resolveUssdTenant, withTenant, handleUssd);
 *
 * AI AUDIT NOTE
 *   Tenant resolution below was written by AI at Sheryl's request
 *   (the assignment lists it as manual-only). Sheryl reviewed it.
 *   This is declared in AI_AUDIT.md.
 * ============================================================
 */
import { pool } from '../db/pool.js';

async function resolveUssdTenant(req, res, next) {
  try {
    // 1. The dialled code. "|| {}" avoids a crash on an empty body.
    const { serviceCode } = req.body || {};

    // 2. Ask the phone book who owns it. $1 is a safe slot, so
    //    nobody can sneak bad text into the query.
    const { rows } = await pool.query(
      'SELECT tenant_id FROM ussd_configs WHERE service_code = $1',
      [serviceCode]
    );

    // 3. Nobody owns it: close politely and stop here.
    if (!rows[0]) {
      return res.type('text/plain').send('END Service unavailable');
    }

    // 4. Stamp the shop on the request, then send the guest on.
    req.tenantId = rows[0].tenant_id;
    return next();
  } catch (err) {
    // Hand any database error to Express's error handler.
    return next(err);
  }
}

export { resolveUssdTenant };