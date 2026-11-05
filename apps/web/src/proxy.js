// =============================================================================
// proxy.js — the website's gate guard (called "middleware" in the assignment)
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Many shops share this one website. Each shop has its own address word:
//   skirt-shirt.localhost:3001, amina.rahisisha.com ...
// - This file runs BEFORE every page. It reads the address word, asks the API
//   which shop it is, and attaches the shop's id to the visit, so every page
//   after it knows whose shop it is
//
// WHY IMPORTANT:
// - It is how an address becomes a shop. Without it no page can tell Amina's
//   visit from Brian's
//
// DANGER (if this file does not exist):
// - Pages cannot know which shop was visited, so shop-specific pages cannot work
// - If it TRUSTS a header from the visitor, a stranger can pretend to be any
//   shop. That is why it always deletes the visitor's x-tenant-id first
//
// WHAT IT SOLVES:
// - Subdomain routing: address word -> shop -> x-tenant-id on the request
// - Unknown shop addresses are sent to /not-found
//
// SYSTEM DESIGN PRINCIPLE: Never trust what the visitor sends
// - x-tenant-id is only ever written by THIS file, from the API's answer
// - The header is a convenience for pages. The real protection is the login
//   token and the database lock, which do not read this header at all
//
// RULES (never break these):
// - Always delete any incoming x-tenant-id before doing anything else
// - Set the header on the REQUEST that goes to the pages (not on the response)
// - Plain localhost (no address word) is the main entrance: landing, login,
//   signup. Let it through with NO x-tenant-id
// - Skip /not-found itself, or the redirect loops forever
// - A broken API is a 503, never "shop not found"
//
// -----------------------------------------------------------------------------
// DECISIONS WE MADE (and why)
// -----------------------------------------------------------------------------
// 1. The shop lookup goes through the API, not the database
//    - The website has no database access and should not get any
//
// 2. ROOT_DOMAIN decides what counts as an address word
//    - On your laptop it is "localhost" (default), so skirt-shirt.localhost
//      has the word "skirt-shirt". In production it becomes rahisisha.com
//      (set the ROOT_DOMAIN environment variable)
//
// 3. "www" and the bare root domain are NOT shops
//    - www.rahisisha.com is the main site, not a shop called "www"
//
// 4. No caching yet (cache: 'no-store')
//    - Every visit asks the API. Simple and always fresh. A short cache would
//      make it faster later
//
// 5. This is a .js file named proxy.js
//    - Next.js 16 renamed middleware to proxy. Your project uses JavaScript
//
// -----------------------------------------------------------------------------
// PRACTICAL EXAMPLES
// -----------------------------------------------------------------------------
// http://skirt-shirt.localhost:3001/   -> API finds the shop -> x-tenant-id set
// http://nonsense.localhost:3001/      -> API says 404 -> redirect to /not-found
// http://localhost:3001/login          -> no address word -> let through, no tag
// A visitor who sends  x-tenant-id: <someone else's id>  -> deleted, then
//   replaced by the real one (or nothing)
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Any SaaS with an address per customer (Shopify, Slack, Notion style)
// - The same file shape also does: send logged-out people to /login, pick a
//   language, block countries
//
// TRADEOFFS:
// + One place decides the shop for every page
// - One extra API call per visit (cache later)
// - If the API is down, shop addresses show 503 until it is back
//
// HOW TO USE:
// - Next.js finds it by name: apps/web/src/proxy.js, next to the app folder
// - Environment: NEXT_PUBLIC_API_URL (already set), ROOT_DOMAIN (optional)
// =============================================================================

// NextResponse: Next.js's tool for answering: continue, redirect or reply
import { NextResponse } from 'next/server';

// The name of the sticky note we attach to a visit
const TENANT_HEADER = 'x-tenant-id';

// The main domain. Everything before it is the shop's address word.
// On your laptop: "localhost". In production: set ROOT_DOMAIN=rahisisha.com
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'localhost';

// The API address (the same variable the rest of the website uses)
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// -----------------------------------------------------------------------------
// getSubdomain — pull the address word out of the host
//   "skirt-shirt.localhost:3001" -> "skirt-shirt"
//   "localhost:3001"             -> null  (no shop word)
//   "www.localhost:3001"         -> null  (www is the main site)
// -----------------------------------------------------------------------------
function getSubdomain(host) {
  // Remove the port (:3001) and make it lowercase
  const hostname = host.split(':')[0].toLowerCase();

  // A shop address must END with ".localhost" (or ".rahisisha.com" in production)
  const suffix = `.${ROOT_DOMAIN}`;
  if (!hostname.endsWith(suffix)) return null;

  // Cut the suffix off. What is left in front is the address word
  const sub = hostname.slice(0, -suffix.length);

  // Empty, or "www": the main site, not a shop (Decision 3)
  if (!sub || sub === 'www') return null;

  return sub;
}

// -----------------------------------------------------------------------------
// proxy — runs before every page (Next.js calls this function by name)
// -----------------------------------------------------------------------------
export async function proxy(request) {

  // STEP 1: copy the visitor's headers, then TEAR OFF their x-tenant-id.
  // Whatever they sent is ignored. Only this file may write it
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(TENANT_HEADER);

  // STEP 2: never process /not-found itself (it would redirect to itself
  // forever). Just let it through
  const { pathname } = request.nextUrl;
  if (pathname === '/not-found') {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // STEP 3: which shop word is in the address?
  const sub = getSubdomain(request.headers.get('host') || '');

  // No shop word = the main entrance (landing, login, signup).
  // Let them in WITHOUT a shop note
  if (!sub) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // STEP 4: ask the API who this shop is
  let tenant;
  try {
    const res = await fetch(
      `${API_URL}/tenants/by-slug/${encodeURIComponent(sub)}`,
      { cache: 'no-store' } // always ask fresh (Decision 4)
    );

    // 404 = no such shop: send the visitor to the not-found page
    if (res.status === 404) {
      return NextResponse.redirect(new URL('/not-found', request.url));
    }

    // Any other failure (500 ...) is a broken API, not a missing shop
    if (!res.ok) {
      throw new Error(`Tenant lookup failed with status ${res.status}`);
    }

    // Success: the API answers { data: { id, name, slug }, error: null }
    const json = await res.json();
    tenant = json.data;
  } catch (err) {
    // The API is down or returned something broken. Say so honestly (503),
    // do not pretend the shop does not exist
    console.error('[proxy] tenant lookup failed:', err);
    return new NextResponse('Service temporarily unavailable', { status: 503 });
  }

  // STEP 5: write OUR sticky note on the visit going IN to the pages
  requestHeaders.set(TENANT_HEADER, tenant.id);

  // STEP 6: let the visit continue, carrying the new headers
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// -----------------------------------------------------------------------------
// config — which addresses the guard watches.
// Skip Next.js's own files (_next/static, _next/image) and the favicon
// -----------------------------------------------------------------------------
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};