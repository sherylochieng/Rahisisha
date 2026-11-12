/**
 * ============================================================
 * FILE: apps/api/src/controllers/ussd.controller.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   This is the waiter. After the guard (resolveUssdTenant) knows
 *   WHICH shop, and withTenant has locked the database to that
 *   shop, this file decides WHAT to show on the phone screen.
 *
 * WHY IMPORTANT
 *   It is the only place that builds USSD replies. If a reply is
 *   wrong or too long (over 182 characters), the caller sees an
 *   error instead of the menu.
 *
 * DANGER
 *   - Never answer with shop data unless req.tenantId is set and
 *     the query runs on req.db (the locked connection).
 *   - Never go over 182 characters in one reply.
 *   - Every reply starts with CON (keep open) or END (close).
 *
 * WHAT IT SOLVES
 *   One shared menu code that shows each shop its own name and data.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Separation of concerns. This file never decides WHO the shop
 *   is. It only reads req.tenantId, stamped by the guard.
 *
 * RULES
 *   1. Reply is plain text starting with "CON " or "END ".
 *   2. Max 182 characters per reply.
 *   3. Shop data is read through req.db only.
 *
 * PRACTICAL EXAMPLE
 *   Caller dials *384*101#. Guard stamps Amina's Boutique. This
 *   file replies:
 *     CON Karibu Amina's Boutique
 *     1. View products
 *     2. Check balance
 *     3. Exit
 *
 * DECISIONS
 *   - Welcome text comes from ussd_configs.welcome_text, so each
 *     shop can change its greeting without a code change.
 *   - Menu is built here (AI allowed for menu boilerplate).
 *   - Options 1 and 2 are added in the next steps.
 *
 * WHERE USED / FUTURE USES
 *   routes/ussd.routes.js. Later: options 1 and 2, language per
 *   tenant, ussd_events logging.
 *
 * TRADEOFFS
 *   One small query for the welcome text per request. Simple now;
 *   could be cached later.
 *
 * HOW TO USE
 *   router.post('/ussd', resolveUssdTenant, withTenant, handleUssd);
 *
 * AI AUDIT NOTE
 *   Menu boilerplate written by AI (allowed). Tenant resolution
 *   lives in middleware/resolveUssdTenant.js, see its note.
 * ============================================================
 */

async function handleUssd(req, res, next) {
  try {
    // The guard stamped req.tenantId and withTenant opened req.db,
    // locked to that shop. We just read the greeting.
    const { rows } = await req.db.query(
      'SELECT welcome_text FROM ussd_configs WHERE tenant_id = $1',
      [req.tenantId]
    );

    // Safety net: a shop with no config row should never get here,
    // but if it does, close politely instead of crashing.
    if (!rows[0]) {
      return res.type('text/plain').send('END Service unavailable');
    }

    // First screen. CON keeps the session open and waits for a key.
    // Short on purpose: USSD replies are capped at 182 characters.
    const reply =
      `CON ${rows[0].welcome_text}\n` +
      '1. View products\n' +
      '2. Check balance\n' +
      '3. Exit';

    return res.type('text/plain').send(reply);
  } catch (err) {
    return next(err);
  }
}

export { handleUssd };