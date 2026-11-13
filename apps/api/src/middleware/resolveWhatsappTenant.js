/**
 * ============================================================
 * FILE: apps/api/src/middleware/resolveWhatsappTenant.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   Every WhatsApp message from every shop arrives on ONE shared
 *   endpoint (POST /webhooks/whatsapp). Meta's payload says which
 *   WhatsApp number was messaged (metadata.phone_number_id). This
 *   file is the guard at the door: it finds the shop that owns that
 *   number and stamps it on the request (req.tenantId).
 *
 * WHY IMPORTANT
 *   Everything after this guard trusts req.tenantId. A wrong shop
 *   here means one shop's customer messages land in another shop's
 *   inbox.
 *
 * DANGER
 *   - NEVER find the shop from the customer's phone number, the
 *     message text, or any header a caller can fake. Only the
 *     phone_number_id from our own whatsapp_configs table decides.
 *   - NEVER log the payload or the config row. The row holds the
 *     encrypted token. This file reads ONLY tenant_id.
 *   - Do not answer an unknown number with an error status. Meta
 *     retries failures for days. Answer 200 and ignore it.
 *
 * WHAT IT SOLVES
 *   "One endpoint, many shops" (Day 2, Task 2).
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Resolve identity once, early, in one place. Then lock the
 *   database to that shop (withTenant). Same "stamp, then lock"
 *   pattern as requireAuth and resolveUssdTenant.
 *
 * RULES
 *   1. The key is entry[0].changes[0].value.metadata.phone_number_id.
 *   2. It must be a non-empty string, or we ignore the request.
 *   3. Unknown number -> 200 { data: { ignored: true } }, nothing else.
 *   4. Only SELECT tenant_id. Never select the token column here.
 *   5. Only req.tenantId is set. No other data is copied from the
 *      payload by this file.
 *
 * PRACTICAL EXAMPLE
 *   Customer messages Amina's WhatsApp number. Meta posts a payload
 *   with phone_number_id "1000001". Guard finds Amina's row, sets
 *   req.tenantId, calls next(). A payload for number "999" (nobody
 *   owns it) gets 200 { ignored: true }.
 *
 * DECISIONS (and WHY)
 *   - Plain pool, no RLS on whatsapp_configs: we must look up the
 *     shop BEFORE we know the shop (same trap as ussd_configs and
 *     login before migration 022).
 *   - Optional chaining everywhere: Meta also sends status updates
 *     and odd shapes. A missing field must never crash the request.
 *   - Runs BEFORE withTenant, which sets the RLS lock from
 *     req.tenantId.
 *   - try/catch + next(err): Express 4 does not catch async errors.
 *
 * WHERE USED / FUTURE USES
 *   routes/whatsapp.routes.js (POST only). The GET verify challenge
 *   does not need it (it has no phone_number_id).
 *   Later: check Meta's X-Hub-Signature-256 header before this step.
 *
 * TRADEOFFS
 *   One DB query per webhook call. Fine for now. If traffic grows,
 *   cache phone_number_id -> tenant_id in memory.
 *
 * HOW TO USE
 *   router.post('/', resolveWhatsappTenant, withTenant, handleInbound);
 *
 * AI AUDIT NOTE
 *   Tenant resolution below was written by AI at Sheryl's request
 *   (the assignment lists it as manual-only). Declared in
 *   apps/api/docs/AI_AUDIT_week_29_day2.md.
 * ============================================================
 */
import { pool } from '../db/pool.js';

async function resolveWhatsappTenant(req, res, next) {
  try {
    // 1. Dig out the number that was messaged. Each "?." means "if this
    //    part is missing, give up quietly instead of crashing".
    const phoneNumberId =
      req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    // 2. Not a non-empty string: nothing to look up. Say OK so Meta stops.
    if (typeof phoneNumberId !== 'string' || phoneNumberId.length === 0) {
      return res.status(200).json({ data: { ignored: true }, error: null });
    }

    // 3. Ask the phone book who owns this number. $1 is a safe slot, and
    //    we select ONLY tenant_id (never the token column).
    const { rows } = await pool.query(
      'SELECT tenant_id FROM whatsapp_configs WHERE phone_number_id = $1',
      [phoneNumberId]
    );

    // 4. Nobody owns it: say OK (so Meta does not retry) and stop here.
    if (!rows[0]) {
      return res.status(200).json({ data: { ignored: true }, error: null });
    }

    // 5. Stamp the shop on the request, then send it on to the lock.
    req.tenantId = rows[0].tenant_id;
    return next();
  } catch (err) {
    // Hand any database error to Express's error handler.
    return next(err);
  }
}

export { resolveWhatsappTenant };