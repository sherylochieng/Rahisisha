// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/utils/getShopSlug.js
// ═══════════════════════════════════════════════════════════
//
// ┌─────────────────────────────────────────────────────────┐
// │ STORY OF THIS FILE (Task 8: staging deploy)             │
// ├─────────────────────────────────────────────────────────┤
// │ BEFORE: login.js did this inline:                       │
// │   const host = req.headers.host;                        │
// │   const subdomain = host.split('.')[0];                 │
// │   i.e. "the first word of the API's OWN address".       │
// │                                                         │
// │ PROBLEM: Online the browser calls api.rahisishabiashara │
// │   .com, so the first word was ALWAYS "api". Login looked│
// │   for a shop called "api", found none, and answered     │
// │   "Tenant not found" for everybody. On a laptop it hid  │
// │   because localhost skipped the check.                  │
// │                                                         │
// │ AFTER: When ROOT_DOMAIN is set (online), we read the    │
// │   address the VISITOR is on (the Origin header), and    │
// │   take the shop word from that. On a laptop (no         │
// │   ROOT_DOMAIN) the old behaviour is kept exactly.       │
// └─────────────────────────────────────────────────────────┘
//
// WHY THIS FILE EXISTS
//   It answers: "Which shop is this request for?" It returns the
//   shop's word (slug) or null when there is no shop (main entrance).
//
// WHY IMPORTANT
//   Login uses the answer to check that the person belongs to THAT
//   shop. A wrong answer means nobody can log in, or the wrong shop.
//
// DANGER (what breaks without it)
//   - Every login online fails with "Tenant not found".
//   - Or, if "fixed" carelessly, someone could pick another shop's
//     door. (The membership check still stops them: see DECISIONS.)
//
// WHAT IT SOLVES
//   One tested place for "address -> shop word", with the reserved
//   words (www, api) that are never shops.
//
// SYSTEM DESIGN PRINCIPLE
//   "Identify the tenant from where the user IS, not from where the
//   server LIVES." The API has one address; the shops have many.
//   Also: "Keep what worked." No ROOT_DOMAIN = the old behaviour.
//
// RULES (never do this)
//   1. NEVER treat this answer as proof of identity. It only picks
//      WHICH shop to check. Login still needs the password AND a
//      membership in that shop.
//   2. NEVER let "www" or "api" be shops. They are infrastructure.
//      (Signup should also refuse them as shop names.)
//   3. NEVER crash on a strange Origin. Fall back calmly.
//   4. Match the dot: ".rahisishabiashara.com", never a bare ending.
//
// PRACTICAL EXAMPLES  (ROOT_DOMAIN = rahisishabiashara.com)
//   Origin https://mama-mboga.rahisishabiashara.com -> "mama-mboga"
//   Origin https://rahisishabiashara.com            -> null (main entrance)
//   Origin https://www.rahisishabiashara.com        -> null
//   no Origin, Host api.rahisishabiashara.com       -> null ("api" is reserved)
//   Laptop, Host localhost:3000                      -> null
//
// DECISIONS
//   - Origin first, then Host. A browser always sends Origin on a
//     cross-site call, and a page's script cannot change it.
//   - A non-browser can fake Origin. That only lets it choose which
//     shop's membership to check; it still needs the right password
//     and a membership there. So faking gains nothing.
//   - null means "main entrance": login then takes the user's first
//     membership, exactly like the laptop does today.
//   - Without ROOT_DOMAIN we keep the old code path word for word.
//
// WHERE YOU WILL USE THIS
//   routes/auth/login.js (now). Later: any route that needs the shop
//   before the user is logged in.
//
// TRADEOFFS
//   + Works for every shop with no list to maintain.
//   - Depends on ROOT_DOMAIN being set correctly in Render.
//   - A shop slug that equals a reserved word cannot log in via its
//     own address (so signup must refuse those words).
//
// HOW TO USE
//   import { getShopSlug } from '../../utils/getShopSlug.js';
//   const slug = getShopSlug(req);   // "mama-mboga" or null
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. RESERVED  =  THE "NOT A SHOP" LIST
//    www and api are our own signs on the building, not shops.
//
// 2. hostnameOf(value)  =  PULL THE ADDRESS OUT OF AN ID CARD
//    Origin looks like "https://mama.root.com", Host looks like
//    "api.root.com:443". Both become a plain lowercase hostname.
//
// 3. shopFromHostname(hostname, root)  =  "WHICH ROOM IN OUR HOUSE?"
//    Our house is the root domain. mama.root = room "mama". The root
//    itself, or www/api, is the front door: no room.
//
// 4. getShopSlug(req)  =  THE RECEPTIONIST
//    Online (ROOT_DOMAIN set): ask where the visitor comes from.
//    Laptop: do exactly what the old code did.
// ═══════════════════════════════════════════════════════════

// Words that are part of our infrastructure, never a shop
const RESERVED = new Set(['www', 'api']);

// Turn an Origin ("https://a.b.com") or a Host ("a.b.com:443")
// into a plain lowercase hostname, or null if it is nonsense
function hostnameOf(value) {
  if (!value) return null;
  try {
    // An Origin already has a scheme. A Host does not, so add one
    const withScheme = value.includes('://') ? value : `http://${value}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null; // not a real address: ignore it
  }
}

// From a hostname, find the shop word under our root domain.
// Returns a slug, or null when the address is the front door
function shopFromHostname(hostname, root) {
  if (!hostname) return null;
  if (hostname === root) return null; // the main site

  const suffix = `.${root}`; // the DOT matters (look-alike defence)
  if (!hostname.endsWith(suffix)) return null; // not under our house

  const sub = hostname.slice(0, -suffix.length);
  if (!sub || RESERVED.has(sub)) return null; // www / api: not shops

  return sub;
}

// Which shop is this request for? A slug string, or null (no shop)
export function getShopSlug(req, env = process.env) {
  const root = (env.ROOT_DOMAIN || '').toLowerCase();
  const hostHeader = (req.headers && req.headers.host) || '';

  // LAPTOP (no ROOT_DOMAIN): keep the old behaviour, word for word.
  // "localhost:3000" or "localhost" means "no shop, use first membership".
  if (!root) {
    const first = hostHeader.split('.')[0];
    if (first === 'localhost:3000' || first === 'localhost') return null;
    return first;
  }

  // ONLINE: trust where the VISITOR is. Origin first (a browser call from a
  // shop page), then Host (a direct call). The first one under our root wins.
  const origin = req.headers && req.headers.origin;
  const fromOrigin = shopFromHostname(hostnameOf(origin), root);
  if (fromOrigin) return fromOrigin;

  // Origin gave no shop (front door, or no Origin). Try the Host.
  return shopFromHostname(hostnameOf(hostHeader), root);
}