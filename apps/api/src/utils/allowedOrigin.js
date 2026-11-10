// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/utils/allowedOrigin.js
// ═══════════════════════════════════════════════════════════
//
// ┌─────────────────────────────────────────────────────────┐
// │ STORY OF THIS FILE (Task 8: staging deploy)             │
// ├─────────────────────────────────────────────────────────┤
// │ BEFORE: app.js allowed exactly ONE website address:     │
// │   origin: process.env.WEB_ORIGIN                        │
// │   Fine on a laptop: one website, one address.           │
// │                                                         │
// │ PROBLEM: Online, every shop has its OWN address         │
// │   (mama-mboga.rahisishabiashara.com). The browser sends │
// │   that address as the "Origin". The API compared it to  │
// │   the one allowed address, said no, and the browser     │
// │   blocked the call. No shop could log in.               │
// │                                                         │
// │ AFTER: The API allows (1) the one WEB_ORIGIN address    │
// │   AND (2) the main domain and EVERY address under it,   │
// │   decided by this small, testable function.             │
// └─────────────────────────────────────────────────────────┘
//
// WHY THIS FILE EXISTS
//   It answers one question: "Is this website allowed to call
//   our API and send the login cookie?"
//
// WHY IMPORTANT
//   CORS is the browser's bouncer. If it says no, the call never
//   happens. If it says yes to the WRONG website, that website can
//   act as the logged-in user.
//
// DANGER (what breaks without it)
//   - Too strict: shops cannot log in (what we saw).
//   - Too loose (for example "*"): an evil website could call the
//     API with the visitor's cookie.
//
// WHAT IT SOLVES
//   One safe rule that covers the main site and all shop addresses,
//   without listing every shop by hand.
//
// SYSTEM DESIGN PRINCIPLE
//   "Allow by rule, not by list." Shops appear every day. A rule
//   ("anything under our own domain") scales; a list does not.
//   Also: "Deny by default." Anything we cannot prove is ours is
//   refused.
//
// RULES (never do this)
//   1. NEVER allow "*" while credentials (cookies) are on.
//   2. NEVER match with a plain endsWith("rahisishabiashara.com").
//      "evilrahisishabiashara.com" would pass. Always match the
//      DOT: endsWith(".rahisishabiashara.com") or exact equal.
//   3. NEVER allow http:// in production. Only https://.
//   4. NEVER crash on a bad Origin value. Refuse it quietly.
//
// PRACTICAL EXAMPLES  (ROOT_DOMAIN = rahisishabiashara.com)
//   https://rahisishabiashara.com            -> allowed
//   https://mama-mboga.rahisishabiashara.com -> allowed
//   https://evilrahisishabiashara.com        -> REFUSED (no dot)
//   https://rahisishabiashara.com.evil.com   -> REFUSED
//   http://mama-mboga.rahisishabiashara.com  -> REFUSED in production
//   (no Origin at all: curl, server-to-server) -> allowed
//
// DECISIONS
//   - No Origin header = allowed. Browsers always send one on
//     cross-site calls. Calls without one (our own website's server,
//     tests, curl) are not a browser attack, and the login cookie
//     and database lock still protect everything.
//   - The old WEB_ORIGIN still works, so nothing that worked before
//     breaks (laptop: http://localhost:3001).
//   - Reads process.env when CALLED (not when loaded), so tests can
//     change settings.
//
// WHERE YOU WILL USE THIS
//   apps/api/src/app.js:  cors({ origin: corsOrigin, credentials: true })
//   Render settings: ROOT_DOMAIN=rahisishabiashara.com
//
// TRADEOFFS
//   + One rule for all shops. No redeploy when a shop is added.
//   - A bug in a shop's own page (XSS) could call the API as that
//     user. That risk exists on any shared domain; the real defence
//     is login + database locks.
//
// HOW TO USE
//   import { corsOrigin } from './utils/allowedOrigin.js';
//   app.use(cors({ origin: corsOrigin, credentials: true }));
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. isAllowedOrigin(origin)  =  THE BOUNCER'S RULEBOOK
//    Takes the address the visitor says they come from and answers
//    true or false. Pure function: same input, same answer, easy to test.
//
// 2. new URL(origin) inside try/catch  =  READING THE ID CARD CAREFULLY
//    If the card is nonsense, we refuse instead of crashing.
//
// 3. hostname === root || hostname.endsWith('.' + root)
//    =  "ARE YOU THE MAIN HOUSE, OR A ROOM INSIDE IT?"
//    The dot matters: it stops look-alike names from sneaking in.
//
// 4. corsOrigin(origin, callback)  =  THE FORM THE cors LIBRARY EXPECTS
//    cors calls this for each request and wants callback(null, true)
//    or callback(null, false). false means "no permission slip":
//    the browser then blocks the call by itself.
// ═══════════════════════════════════════════════════════════

// Decide if one Origin value may call the API
export function isAllowedOrigin(origin, env = process.env) {
  // No Origin header: not a cross-site browser call (our own website's
  // server, a test, curl). Allow it; login and database locks still apply
  if (!origin) return true;

  // The one address we always allowed before (laptop: http://localhost:3001)
  if (env.WEB_ORIGIN && origin === env.WEB_ORIGIN) return true;

  // From here on, only a domain rule can allow it
  const root = (env.ROOT_DOMAIN || '').toLowerCase();
  if (!root) return false;

  let url;
  try {
    url = new URL(origin);
  } catch {
    return false; // not a real address: refuse quietly
  }

  // In production, only secure addresses
  const isProduction = env.NODE_ENV === 'production';
  if (isProduction && url.protocol !== 'https:') return false;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;

  const hostname = url.hostname.toLowerCase();

  // The main house, or a room inside it. NOTE THE DOT in the second check
  return hostname === root || hostname.endsWith(`.${root}`);
}

// The shape the "cors" library wants for its origin option
export function corsOrigin(origin, callback) {
  callback(null, isAllowedOrigin(origin));
}