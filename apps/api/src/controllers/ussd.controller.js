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
 *   It is the only place that builds USSD replies. A wrong or too
 *   long reply (over 182 characters) shows the caller an error
 *   instead of the menu.
 *
 * DANGER
 *   - Never answer with shop data unless the query runs on req.db
 *     (the locked connection). That is what stops shop A seeing
 *     shop B's products or money.
 *   - Never go over 182 characters in one reply.
 *   - Every reply starts with CON (keep open) or END (close).
 *
 * WHAT IT SOLVES
 *   One shared menu code that shows each shop its own name, products
 *   and balance.
 *
 * SYSTEM DESIGN PRINCIPLE
 *   Separation of concerns. This file never decides WHO the shop is.
 *   It only reads req.tenantId, stamped by the guard. Isolation comes
 *   from RLS, not from remembering to type WHERE tenant_id = ...
 *
 * RULES
 *   1. Reply is plain text starting with "CON " or "END ".
 *   2. Max 182 characters per reply (cap() is the last safety net).
 *   3. Shop data is read through req.db only.
 *
 * HOW THE MENU WORKS
 *   Africa's Talking sends `text` = everything the caller typed so
 *   far, joined with "*". Examples:  ""  first screen,  "1"  option 1,
 *   "1*2"  option 1 then 2. This version handles ONE level:
 *     ""  -> CON welcome + menu
 *     "1" -> END product list
 *     "2" -> END balance
 *     "3" -> END goodbye
 *     else-> END invalid choice
 *
 * PRACTICAL EXAMPLE
 *   Caller dials *384*101#, presses 1:
 *     END Products
 *     1. Maxi Dress KSh 2,500
 *     2. Kitenge Top KSh 1,200
 *
 * DECISIONS
 *   - Product and balance queries have NO "WHERE tenant_id": RLS adds
 *     it for us. The cross-tenant test proves it.
 *   - Prices are stored in cents; we divide by 100 for KSh.
 *   - Only the 4 newest active products, names cut to 20 characters,
 *     so the reply fits in 182 characters.
 *   - Results END the session (simple). A back/next level can be
 *     added later with CON.
 *
 * WHERE USED / FUTURE USES
 *   routes/ussd.routes.js. Later: language per tenant, ussd_events
 *   logging, a 60 second idle timeout.
 *
 * TRADEOFFS
 *   Only 4 products fit on screen. More would need paging
 *   ("9. Next"), which adds session state.
 *
 * HOW TO USE
 *   router.post('/ussd', resolveUssdTenant, withTenant, handleUssd);
 *
 * AI AUDIT NOTE
 *   Menu boilerplate written by AI (allowed). Tenant resolution
 *   lives in middleware/resolveUssdTenant.js, see its note.
 * ============================================================
 */

// ---------------------------------------------------------------
// MAX_REPLY
// WHY: USSD screens are tiny. The 182 limit comes from the old GSM
//   SMS-style signalling that USSD rides on. Longer replies get cut
//   off or rejected by the phone company.
// REAL LIFE: like a sticky note. If you write too much, the end
//   falls off and the caller never sees it.
// ---------------------------------------------------------------
const MAX_REPLY = 182;

// ---------------------------------------------------------------
// cap(reply)
// WHY: the last safety net. We try to keep replies short anyway, but
//   if a long product name or a bug makes one too long, we cut it
//   here instead of letting the phone company reject the whole reply.
// EXAMPLE: a 300 character reply becomes the first 182 characters.
// ---------------------------------------------------------------
function cap(reply) {
  return reply.length > MAX_REPLY ? reply.slice(0, MAX_REPLY) : reply;
}

// ---------------------------------------------------------------
// toKsh(cents)
// WHY: money is stored in CENTS (whole numbers) so there are no
//   rounding errors like 0.1 + 0.2. People read shillings, so we
//   convert only when showing it.
// EXAMPLE: 250000 -> "2,500"   830000 -> "8,300"
// NOTE: Number() because Postgres returns SUM() of a BIGINT as a
//   string. 'en-US' puts commas in (small Node builds may not know
//   'en-KE').
// ---------------------------------------------------------------
function toKsh(cents) {
  return (Number(cents) / 100).toLocaleString('en-US');
}

// ---------------------------------------------------------------
// send(res, reply)
// WHY: one place that sends every reply, so every reply is plain text
//   AND capped. Nobody can forget either.
// REAL LIFE: the post office counter. Every letter is weighed here
//   before it leaves.
// ---------------------------------------------------------------
function send(res, reply) {
  return res.type('text/plain').send(cap(reply));
}

// ---------------------------------------------------------------
// handleUssd: the waiter. One call = one screen.
// ---------------------------------------------------------------
async function handleUssd(req, res, next) {
  // try/catch + next(err): Express 4 does not catch async errors. If
  // the database breaks, we hand the error to Express instead of
  // leaving the caller's phone hanging.
  try {
    // WHY `text`: it is what the caller has pressed so far. Empty on
    // the very first screen. "|| ''" avoids a crash on an empty body.
    const text = (req.body && req.body.text) || '';

    // WHY we read the greeting here: each shop writes its own welcome
    // text in ussd_configs ("Karibu Amina's Boutique"). No code change
    // is needed when a shop changes its greeting.
    // WHY we filter by tenant_id here: ussd_configs has no RLS (the
    // guard had to read it before knowing the shop), so we must filter
    // by id ourselves.
    const cfg = await req.db.query(
      'SELECT welcome_text FROM ussd_configs WHERE tenant_id = $1',
      [req.tenantId]
    );

    // WHY: a shop with no config row should never reach here (the
    // guard found it through this very table). If it happens anyway,
    // close politely instead of crashing on rows[0].welcome_text.
    if (!cfg.rows[0]) {
      return send(res, 'END Service unavailable');
    }

    // ---------- FIRST SCREEN: greeting + menu ----------
    // WHY CON: "continue". The session stays open and waits for a key.
    // WHY \n: each menu choice sits on its own line on the phone.
    // REAL LIFE: the waiter hands you the menu and waits at your table.
    if (text === '') {
      return send(
        res,
        `CON ${cfg.rows[0].welcome_text}\n` +
          '1. View products\n' +
          '2. Check balance\n' +
          '3. Exit'
      );
    }

    // ---------- OPTION 1: View products ----------
    // WHY no "WHERE tenant_id": req.db is the connection withTenant
    // locked to this shop, so RLS hides every other shop's rows. If
    // we typed the filter by hand, we could forget it one day. RLS
    // never forgets.
    // WHY status = 'active' AND deleted_at IS NULL: customers must not
    // see drafts, archived or deleted products.
    // WHY LIMIT 4: more lines will not fit in 182 characters.
    // WHY ORDER BY created_at DESC: newest products first.
    if (text === '1') {
      const { rows } = await req.db.query(
        `SELECT name, price_cents FROM products
          WHERE status = 'active' AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 4`
      );

      // WHY: an empty shop gets a friendly line, not a blank screen.
      if (rows.length === 0) {
        return send(res, 'END No products yet');
      }

      // WHY slice(0, 20): a very long product name would push the
      // reply past 182 characters.
      // EXAMPLE line: "1. Maxi Dress KSh 2,500"
      const lines = rows.map(
        (p, i) => `${i + 1}. ${p.name.slice(0, 20)} KSh ${toKsh(p.price_cents)}`
      );

      // WHY END: the answer is final, so the session closes (simple).
      return send(res, 'END Products\n' + lines.join('\n'));
    }

    // ---------- OPTION 2: Check balance ----------
    // WHY SUM of wallet_entries: money in (sales) is positive, money
    // out (refunds, payouts) is negative. Adding them all up gives the
    // balance. Again no WHERE tenant_id: RLS does it.
    // WHY COALESCE(..., 0): a new shop with no entries gets 0 instead
    // of NULL (which would print "NaN").
    if (text === '2') {
      const { rows } = await req.db.query(
        'SELECT COALESCE(SUM(amount_cents), 0) AS balance FROM wallet_entries'
      );
      return send(res, `END Balance: KSh ${toKsh(rows[0].balance)}`);
    }

    // ---------- OPTION 3: Exit ----------
    // WHY END: it closes the USSD session on the caller's phone.
    if (text === '3') {
      return send(res, 'END Thank you. Goodbye');
    }

    // ---------- ANYTHING ELSE ----------
    // WHY: a typo like "9" gets a polite close, not a crash.
    // FUTURE: a back key could show the menu again with CON.
    return send(res, 'END Invalid choice');
  } catch (err) {
    return next(err);
  }
}

export { handleUssd };