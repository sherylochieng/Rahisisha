// =============================================================================
// FILE: apps/web/src/lib/apiClient.js   (Week 30 Day 3, Batch 2: shared API caller)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The ONE careful way the browser calls the API: attach the cookie, read the
//   answer, and turn every failure into a friendly error. api.js (shop owner) and
//   adminApi.js (platform admin) both use it, so the logic exists exactly once.
//
// WHY IMPORTANT
//   Before this, adminApi.js carried its own copy. Two copies drift apart: someone
//   fixes a bug in one and forgets the other. One copy means one fix helps both.
//
// DANGER
//   - Never remove credentials: 'include'. Without it the browser sends no cookie
//     and every signed-in call looks signed out.
//   - Never show raw server or browser errors to people. Keep the friendly messages.
//   - Do not put owner-only or admin-only endpoints here. This file knows no
//     endpoints, only HOW to call. The endpoint lists stay in api.js and adminApi.js.
//
// WHAT IT SOLVES
//   Friendly errors for every failure, in one place, for every caller.
//
// SYSTEM DESIGN PRINCIPLE
//   DRY (do not repeat yourself) and separation of concerns: HOW we call lives here,
//   WHAT we call lives in the two endpoint files.
//
// RULES
//   1. err.status = 0 means "we never got an answer" (offline or API off).
//   2. The API answers either { error: 'text' } (owner routes) or
//      { error: { code, message } } (admin routes). Both are understood.
//   3. Always throw an Error with a friendly message.
//
// PRACTICAL EXAMPLE
//   Mama Njeri's phone loses signal: the owner dashboard and the admin panel both say
//   "We couldn't reach the server...", worded once, here.
//
// DECISIONS
//   - Exports request() only. The messages stay private to this file.
//   - err.code and err.details are attached when the API sends them.
//
// WHERE USED
//   adminApi.js now. api.js can switch to it (next step) so its copy can go.
//
// TRADEOFFS
//   + One fix helps everyone.
//   - A change here affects both the owner and admin sides, so it deserves care.
//
// HOW TO USE
//   import { request } from './apiClient';
//   const data = await request('/admin/auth/me');            // GET
//   await request('/login', { method: 'POST', body: JSON.stringify(body) });
// =============================================================================

// PIECE BY PIECE
//   API_URL           = the API's address (ends in /v1), from the public env setting.
//   NETWORK_MESSAGE   = what people read when the request never arrived.
//   SERVER_MESSAGE    = what people read when the server is in trouble (5xx).
//   pickMessage()     = finds the best human message in whatever the API sent.
//   request()         = one careful call, returns the parsed answer or throws.

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const NETWORK_MESSAGE =
  "We couldn't reach the server. Check your internet connection and try again.";

const SERVER_MESSAGE =
  "We're having trouble right now. Please try again in a moment.";

function pickMessage(data, status) {
  // Owner routes: { error: 'text' }
  if (data && typeof data.error === 'string') return data.error;

  // Admin routes and others: { error: { message: 'text' } }
  if (data && data.error && typeof data.error.message === 'string') {
    return data.error.message;
  }

  // No usable message, but we know the server is in trouble.
  if (status >= 500) return SERVER_MESSAGE;

  return 'Something went wrong';
}

export async function request(path, options = {}) {
  let res;

  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' }, // we send JSON
      credentials: 'include',                           // let the browser attach the cookie
      ...options,                                       // method, body, etc.
    });
  } catch {
    // fetch itself failed: no internet, or the API is off.
    const err = new Error(NETWORK_MESSAGE);
    err.status = 0; // 0 = we never got an answer
    throw err;
  }

  // Open the parcel carefully: if it is not JSON we get null, not a crash.
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(pickMessage(data, res.status));
    err.status = res.status;                              // 400, 401, 429, 500 ...
    err.code = data?.error?.code ?? null;                 // for example 'invalid_credentials'
    err.details = data?.details ?? data?.error?.details ?? null; // which fields were wrong
    throw err;
  }

  return data;
}
