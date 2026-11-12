// =====================================================================
// ussd.controller.js : the USSD receptionist and menu
// =====================================================================
//
// WHY THIS FILE EXISTS
//   One shared endpoint serves every shop's USSD code. This file decides
//   WHICH shop a call belongs to, then (later) shows that shop's menu.
//   Today it holds the first piece: the phone book lookup.
//
// WHY IMPORTANT
//   The shop chosen here decides whose data the caller sees. If this
//   step is wrong, one shop sees another shop's products and money.
//
// DANGER (what breaks without it, or if done wrongly)
//   * Picking the shop from the caller's phone number: the same phone
//     can be a customer of many shops, so it could open the wrong one.
//   * Gluing the code into the SQL text: a hacker could dial a code that
//     contains SQL commands (SQL injection).
//   * Using the wrong setting name (app.tenant_id instead of
//     app.current_tenant): every lock in the database would see "no
//     shop" and return nothing.
//
// WHAT IT SOLVES
//   Shared code, per-shop settings. Two shops, two codes, one program,
//   no copy-pasted code per shop (Week 29 Day 1 assignment).
//
// SYSTEM DESIGN PRINCIPLE
//   * "Resolve the tenant first, then touch tenant data."
//   * "Shared code, per-tenant configuration."
//   * "Absence is a normal answer, not a crash": an unknown code returns
//     null, it does not throw.
//
// RULES (never do this)
//   1. The shop comes from ussd_configs.service_code, nothing else.
//   2. NEVER build the SQL by joining strings. Use $1 placeholders.
//   3. Unknown code: the caller must get "END Service unavailable".
//   4. The tenant setting name is app.current_tenant (NOT app.tenant_id).
//   5. Use pool.query ONLY for this lookup. After the shop is known, use
//      a connection that has the shop stamped on it, so the database
//      locks (RLS) apply.
//   6. Tenant resolution is written BY HAND (assignment rule). See the
//      audit note at the bottom of this header.
//
// PRACTICAL EXAMPLE
//   ussd_configs table:
//     tenant_id (Amina's id)  | *384*101#  | Karibu Amina's Boutique
//     tenant_id (Brio's id)   | *384*102#  | Welcome to Brio Hardware
//
//   findTenantByServiceCode('*384*101#')  ->  Amina's tenant_id
//   findTenantByServiceCode('*384*102#')  ->  Brio's tenant_id
//   findTenantByServiceCode('*384*999#')  ->  null  (nobody owns it)
//
//   Real-life picture: a receptionist hears "I rang 101", opens the
//   phone book, finds "Amina's Boutique", and opens Amina's folder.
//   If the number is not in the book, she says "this number is not in
//   service" and hangs up politely.
//
// DECISIONS WE MADE (and why)
//   1. WHERE service_code = $1
//      The dialled code is the ONLY thing that picks the shop.
//      It is UNIQUE, so at most one shop matches. The phone number
//      cannot be used (one person, many shops). Searching by tenant_id
//      would be circular: tenant_id is what we are trying to find.
//   2. return null when nothing matches
//      null is JavaScript's honest "nothing here". Later code tests it
//      with if (!tenantId). An empty string, 0 or a made-up id would
//      look like a real answer and could slip past that check. Throwing
//      an error would turn a normal event (a mistyped code) into a crash.
//   3. pool.query, not req.db
//      req.db already has a shop stamped on it. Here the shop is not
//      known yet, so this single lookup uses the plain pool. The table
//      it reads (ussd_configs) has no row level security on purpose
//      (migration 023), because a lock that needs a shop would hide
//      every row at this moment. This is the same trap that broke login
//      before migration 022.
//   4. SELECT only tenant_id
//      Ask for the least you need. Less data moves, less can leak.
//
// WHERE YOU WILL USE THIS (now and in future projects)
//   NOW
//     * routes/ussd.routes.js -> POST /ussd, first step of every call.
//   LATER IN THIS PROJECT
//     * WhatsApp: the click-to-chat link carries a shop code. The same
//       idea finds the shop: "which shop owns this code?".
//     * Webhooks (M-Pesa, WhatsApp): route an incoming event to a shop.
//     * Custom shop domains: "which shop owns shop.example.co.ke?".
//   IN OTHER PROJECTS
//     * Any multi-tenant app where the request arrives BEFORE you know
//       the customer: an API key, an invite code, a subdomain, a phone
//       line, a QR code. Always: look it up in a small "directory"
//       table, return the tenant id or null, then continue as that tenant.
//
// TRADEOFFS
//   + One small, fast, testable function. Easy to reuse.
//   + UNIQUE index makes the lookup quick and unambiguous.
//   - ussd_configs has no database lock. The app user can read every
//     shop's code and welcome text. Acceptable: service codes are public
//     (customers dial them). NEVER put secrets in that table.
//   - One extra database round trip per USSD request. USSD sessions are
//     short and the table is tiny, so this is fine.
//
// HOW TO USE
//   import { findTenantByServiceCode } from './ussd.controller.js';
//   const tenantId = await findTenantByServiceCode(req.body.serviceCode);
//   if (!tenantId) return res.send('END Service unavailable');
//   // from here on, stamp tenantId on a connection and use that
//
// TEST IT
//   Run the seed (sql/seeds/ussd_configs_seed.sql) so the two codes
//   exist, then call the function with each code and with an unknown one.
//
// COMMON MISTAKES
//   * Returning undefined by accident (forgetting the return).
//   * Using the phone number to pick the shop.
//   * Forgetting that rows[0] is undefined when nothing matches.
//   * Using the old setting name app.tenant_id later in the menu code.
//
// AUDIT NOTE (Week 29 Day 1)
//   findTenantByServiceCode was written by the AI at Sheryl's request;
//   she filled in no part by hand. Marked AI in AI_AUDIT.md, outside the
//   "not allowed for tenant resolution" rule. A closed-book retype by
//   Sheryl would change this note honestly.
// =====================================================================

// The pool is the building's phone line to the database.
// Named export, same as the other controllers.
import { pool } from '../db/pool.js';

// ---------------------------------------------------------------------
// findTenantByServiceCode : the phone book lookup
//
// Input : serviceCode, the code the caller dialled, e.g. '*384*101#'
// Output: the tenant_id (a UUID string), or null if no shop owns it
//
// async: asking the database takes a moment, so we wait for the answer.
// ---------------------------------------------------------------------
async function findTenantByServiceCode(serviceCode) {
  // Open the phone book and look for ONE entry.
  // - SELECT tenant_id : we only need the shop's id.
  // - WHERE service_code = $1 : match on the dialled code (UNIQUE).
  // - $1 + [serviceCode] : the value travels separately, so a hacker's
  //   text is treated as plain text, never as a command.
  const { rows } = await pool.query(
    'SELECT tenant_id FROM ussd_configs WHERE service_code = $1',
    [serviceCode]
  );

  // rows is the list of matches. rows[0] is the first match.
  // No match: nobody owns this code. Return null ("nothing here")
  // so the caller can answer "END Service unavailable".
  if (!rows[0]) return null;

  // One match: return that shop's id. UNIQUE guarantees there is
  // never a second match.
  return rows[0].tenant_id;
}

// Make the function available to the route and to the tests.
export { findTenantByServiceCode };