// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/lib/publicApi.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The public shop page has no logged-in owner. serverApi.js always sends
//   the login cookie and redirects to /login when there is none, which is
//   exactly wrong for a customer. This file is the public twin: it calls
//   the API's public door (GET /v1/storefront/:slug) with NO cookie and
//   never redirects to login.
//
// WHY IMPORTANT
//   If the public page used serverApi.js, every customer would be thrown
//   to the login page. If it forwarded a cookie, an owner's login would
//   leak into a public request. Keeping the two files apart makes both
//   mistakes impossible.
//
// DANGER (what breaks without it)
//   - Customers see the login page instead of the shop.
//   - Someone "fixes" serverApi.js to allow no cookie, and a private page
//     becomes reachable without login.
//
// WHAT IT SOLVES
//   One small, tested place that fetches a shop's public products, and
//   turns the API's answers into three clear results for the page:
//     - the shop and its products,
//     - null (no such shop, so the page shows "not found"),
//     - or an error (the page's error screen).
//
// SYSTEM DESIGN PRINCIPLE
//   "Public and private code paths never share a fetch helper." The
//   private helper trusts a cookie; the public helper trusts nothing and
//   asks only for public data.
//
// RULES (never break these)
//   1. NEVER attach a cookie or token here.
//   2. NEVER redirect to /login from this file.
//   3. Always cache: 'no-store'. A shop owner who just hid a product must
//      not see it still on sale for an hour.
//   4. encodeURIComponent on anything that goes into the URL.
//   5. Only call /storefront/... from this file. Private endpoints belong
//      in serverApi.js.
//
// PRACTICAL EXAMPLES
//   const page = await fetchStorefront('brio-hardware');
//   page.shop.name, page.products, page.nextCursor
//   const next = await fetchStorefront('brio-hardware', page.nextCursor);
//   await fetchStorefront('nobody')   // -> null
//
// DECISIONS
//   - A bad bookmark (400) is not shown as an error to a customer. We show
//     them the first page instead, because they most likely edited the
//     address or an old link went stale.
//   - Any other failure (500, 503, network) throws, so Next.js shows the
//     error screen and the owner can see something is wrong.
//
// WHERE YOU WILL USE THIS
//   app/shop/[slug]/page.js now. Later the cart and checkout pages.
//
// TRADEOFFS
//   + Tiny and easy to read.
//   - No caching, so every visit asks the API. Fine for now; later we can
//     cache for a few seconds.
//
// HOW TO USE
//   import { fetchStorefront } from '../../../lib/publicApi';
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request (follow-up to Week 29 Day 4).
//   Declared in docs/AI_AUDIT_week_29_day4.md.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. API_URL  =  "THE ADDRESS OF THE WAREHOUSE"
//    NEXT_PUBLIC_API_URL already ends in /v1, so we add /storefront/...
//
// 2. fetch(..., { cache: 'no-store' })  =  "ALWAYS LOOK AT THE SHELF NOW"
//    Real life: a shopkeeper who sold the last cement bag does not want a
//    customer shown a photo from yesterday.
//
// 3. status 404 -> null  =  "NO SUCH SHOP"
//    The page turns null into Next.js's not-found screen.
//
// 4. status 400 -> try again without the bookmark  =  "START FROM PAGE ONE"
//    A stale or edited link is not the customer's fault.
//
// 5. !res.ok -> throw  =  "SOMETHING IS REALLY WRONG"
//    A server fault is not hidden behind a friendly lie.
// ═══════════════════════════════════════════════════════════

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchStorefront(slug, cursor = null) {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';

  const res = await fetch(
    `${API_URL}/storefront/${encodeURIComponent(slug)}${qs}`,
    { cache: 'no-store' }
  );

  // No such shop (or a closed one): the page shows "not found"
  if (res.status === 404) return null;

  // A stale or edited bookmark: start again from the first page
  if (res.status === 400 && cursor) return fetchStorefront(slug, null);

  if (!res.ok) {
    throw new Error(`Storefront ${slug} failed with status ${res.status}`);
  }

  const json = await res.json();
  return {
    shop: json.data.shop,
    products: json.data.products,
    nextCursor: json.nextCursor ?? null,
  };
}