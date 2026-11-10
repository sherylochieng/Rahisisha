// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/lib/api.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Every call from the website to the API goes through ONE
//   function here. It adds headers, sends the login cookie,
//   reads the answer, and turns every kind of failure into a
//   clear, friendly Error the form can show.
//
// WHY IMPORTANT
//   The forms only know "it worked" or "it threw an Error with
//   a message". If this file lets ugly messages through
//   ("Failed to fetch", "[object Object]", "Unexpected token <"),
//   users see them.
//
// DANGER (what breaks without it)
//   - API is down: the user sees "Failed to fetch".
//   - API sends { error: { message } } (products, orders): the
//     user sees "[object Object]".
//   - A proxy sends an HTML error page: res.json() crashes with
//     "Unexpected token <".
//
// WHAT IT SOLVES
//   One place that turns every failure into a friendly message,
//   so no form ever has to guess.
//
// SYSTEM DESIGN PRINCIPLE
//   "Translate errors at the boundary." Raw technical errors
//   stop here. Everything past this file gets a human message
//   plus useful extras (status, details) for the form to use.
//
// RULES (never do this)
//   1. NEVER let a raw browser or server error reach the user.
//   2. NEVER call fetch() directly in a form. Always add a method
//      here and call api.something().
//   3. NEVER remove credentials: 'include'. Without it the login
//      cookie is not sent and every protected call fails.
//   4. NEVER trust that the answer is JSON. Always parse safely.
//
// PRACTICAL EXAMPLE
//   Postgres is down. The API answers 503 with
//   { error: "We're having trouble right now..." }.
//   The login form catches an Error with exactly that text.
//   If the API itself is off, the form shows: "We couldn't
//   reach the server. Check your internet connection."
//
// DECISIONS
//   - The thrown Error carries three extras:
//       err.status  (0 = never reached the server)
//       err.details (field-by-field problems, or null)
//     so forms can show errors NEXT TO the right field.
//   - Messages for network and server problems live in two
//     constants, so wording changes in one place.
//
// WHERE YOU WILL USE THIS
//   - LoginForm.js, SignupForm.js (now)
//   - Every future form and page that talks to the API
//
// TRADEOFFS
//   + Forms stay simple.
//   - The messages are English only. Swahili can be added later
//     by swapping the two constants.
//
// HOW TO USE
//   import { api } from '../../lib/api';
//   try { await api.login({ phone, password }); }
//   catch (err) { show(err.message); }
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. API_URL  =  THE SHOP'S ADDRESS
//    Read from .env, so changing server means changing one line.
//
// 2. try { fetch } catch  =  CALLING THE SHOP, NO ONE PICKS UP
//    If fetch itself fails, the request never arrived (no
//    internet, API off). We say so kindly.
//
// 3. res.json().catch(() => null)  =  OPENING THE PARCEL CAREFULLY
//    If the parcel holds something unexpected (HTML, empty), we
//    get null instead of a crash.
//
// 4. pickMessage  =  THE FRONT-DESK TRANSLATOR
//    It reads the API's answer in whichever shape it comes
//    (text, or { message }) and picks the right words.
//
// 5. res.ok  =  "WAS THE ANSWER A SUCCESS?"
//    true for 200-299, false for 400, 401, 404, 409, 500, 503.
//
// 6. err.status / err.details  =  NOTES STAPLED TO THE ERROR
//    status says what kind of failure. details says WHICH
//    fields were wrong.
// ═══════════════════════════════════════════════════════════

// Base URL for all API requests. Change it in .env when deploying.
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// What the user reads when the request never reached the server
const NETWORK_MESSAGE =
  "We couldn't reach the server. Check your internet connection and try again.";

// What the user reads when the server itself is in trouble (5xx)
const SERVER_MESSAGE =
  "We're having trouble right now. Please try again in a moment.";

// pickMessage: finds the best human message in whatever the API sent
function pickMessage(data, status) {
  // Shape 1: { error: 'text' }  (login, signup)
  if (data && typeof data.error === 'string') return data.error;

  // Shape 2: { error: { message: 'text' } }  (products, orders, 503)
  if (data && data.error && typeof data.error.message === 'string') {
    return data.error.message;
  }

  // No usable message, but we know the server is in trouble
  if (status >= 500) return SERVER_MESSAGE;

  return 'Something went wrong';
}

// Central fetch wrapper: every API call goes through here
async function request(path, options = {}) {
  let res;

  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' }, // we send JSON
      credentials: 'include',                           // send the login cookie
      ...options,                                       // method, body, etc.
    });
  } catch {
    // fetch itself failed: no internet, or the API is off
    const err = new Error(NETWORK_MESSAGE);
    err.status = 0; // 0 = we never got an answer
    throw err;
  }

  // Parse safely. If the body is not JSON, data becomes null
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(pickMessage(data, res.status));
    err.status  = res.status;
    // details: field problems, from either error shape (or null)
    err.details = data?.details ?? data?.error?.details ?? null;
    throw err;
  }

  return data;
}

// All API calls live here: one method per endpoint
export const api = {
  // POST /signup: create a new tenant + user + membership
  signup(body) {
    return request('/signup', {
      method: 'POST',
      body: JSON.stringify(body), // JS object -> JSON text
    });
  },

  // POST /login: verify credentials and set the auth cookie
  login(body) {
    return request('/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // GET /me: the current logged-in user and their tenant
  me() {
    return request('/me');
  },
};