// =============================================================================
// FILE: apps/web/src/lib/adminApi.js   (Week 30 Day 3, Batch 2: admin web, part 1)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The ONE place the admin pages talk to the API. Sign in, sign out, "who am I".
//   Later parts add the shop list and the suspend / verify buttons here too.
//
// WHY IMPORTANT
//   The admin cookie is not like the shop owner's cookie. It is kept ON the API's
//   own address only (api.rahisishabiashara.com) and the website's server cannot
//   read it. So the admin pages must call the API FROM THE BROWSER, with the
//   cookie attached by the browser itself. This file does exactly that.
//
// DANGER
//   - NEVER put an admin call in a server component or in serverApi.js: the server
//     has no admin cookie, so it would always look signed out.
//   - NEVER store the admin token in localStorage or a variable. The browser keeps
//     it in an httpOnly cookie, out of reach of page scripts. That is the point.
//   - NEVER show raw server errors to the admin. Use the friendly message.
//
// WHAT IT SOLVES
//   One safe, friendly way to call the admin API: errors become readable messages
//   and every caller can tell "signed out" (401) from "server down" (0 or 5xx).
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: owner calls live in api.js, admin calls live here, so
//   the two worlds (two cookies, two kinds of person) never get mixed.
//   Same-site cookies: the web (rahisishabiashara.com) and the API
//   (api.rahisishabiashara.com) share a registrable domain, so the strict cookie
//   is allowed to travel.
//
// RULES
//   1. credentials: 'include' on every call, or the browser sends no cookie.
//   2. Always read the answer as { data, error } (the API envelope).
//   3. err.status = 0 means "we never got an answer" (offline or API off).
//
// PRACTICAL EXAMPLE
//   Sheryl opens /admin/login, types her phone and password, and the form calls
//   adminApi.login(...). The API answers and the browser stores the admin cookie
//   by itself. Every later call (adminApi.me(), the shop list) carries it.
//
// DECISIONS
//   - The careful HOW of calling lives in apiClient.js (shared with api.js), so this
//     file is only the list of admin endpoints. Nothing is repeated.
//   - API_URL already ends in /v1, so paths here start with /admin/...
//
// WHERE USED
//   AdminLoginForm.js (login), AdminShell.js (me, logout), ShopsBrowser.js (listShops),
//   ShopDetail.js (getShop), ShopActions.js (suspend, reinstate, verify, unverify)
//   and OverviewStats.js (getStats).
//
// TRADEOFFS
//   + Simple, safe, easy to find.
//   - Pages that use it must be client components (they run in the browser).
//     Fine for an admin panel used by a few people.
//
// HOW TO USE
//   import { adminApi } from '../../lib/adminApi';
//   try { const res = await adminApi.me(); /* res.data.admin.name */ }
//   catch (err) { if (err.status === 401) { /* go to /admin/login */ } }
// =============================================================================

// PIECE BY PIECE
//   request()      = the shared careful phone call (from apiClient.js).
//   adminApi       = the short list of things an admin can ask for.

// The shared careful caller: cookie attached, friendly errors, one copy for everyone.
import { request } from './apiClient';

// The admin's shopping list of requests.
// The four actions share one shape: POST /admin/shops/:id/<action> with a written reason.
// Written once here, so a fifth action later is one more line below.
function shopAction(id, action, reason) {
  return request(`/admin/shops/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export const adminApi = {
  // Sign in with phone + password. The browser keeps the cookie, not us.
  login(body) {
    return request('/admin/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },

  // Sign out: the API clears the cookie.
  logout() {
    return request('/admin/auth/logout', { method: 'POST' });
  },

  // "Who am I?" 200 with the admin's name, or 401 when signed out.
  me() {
    return request('/admin/auth/me');
  },

  // The register of shops, a page at a time. Every filter is optional.
  //   status   = 'active' | 'suspended' (empty means all except deleted)
  //   verified = 'true' | 'false' (empty means either)
  //   q        = words to look for in the shop name or address word
  //   cursor   = the nextCursor from the previous page (for "Load more")
  //   limit    = page size
  // The answer is { data: [shops], nextCursor, error }.
  listShops({ status, verified, q, cursor, limit } = {}) {
    const params = new URLSearchParams();
    // Only add a filter when it has a value, so the address stays short and clean.
    if (status) params.set('status', status);
    if (verified) params.set('verified', verified);
    if (q) params.set('q', q);
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', String(limit));
    const query = params.toString();
    return request(`/admin/shops${query ? `?${query}` : ''}`);
  },

  // The five overview counts: { shops: { total, active, suspended, verified, newThisWeek } }.
  // Numbers only, no personal data. The answer is { data, error }.
  getStats() {
    return request('/admin/stats');
  },

  // One shop's file: its details plus its latest receipts (newest first, up to 20).
  // 404 (code shop_not_found) when the id is not a shop.
  getShop(id) {
    return request(`/admin/shops/${encodeURIComponent(id)}`);
  },

  // The four things an admin can do to a shop. Each needs a written reason (5 to 500
  // characters), which the API stores in the receipt. Each answers { data: shop }.
  // Errors carry .code: already_suspended, not_suspended, already_verified, not_verified,
  // shop_deleted, shop_not_found (409 / 404) or validation (400).
  suspendShop(id, reason) { return shopAction(id, 'suspend', reason); },
  reinstateShop(id, reason) { return shopAction(id, 'reinstate', reason); },
  verifyShop(id, reason) { return shopAction(id, 'verify', reason); },
  unverifyShop(id, reason) { return shopAction(id, 'unverify', reason); },
};
