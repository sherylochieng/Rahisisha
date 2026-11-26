// =============================================================================
// FILE: apps/api/src/controllers/adminAuth.controller.js   (Week 30, platform admin: step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Handles the three things a platform admin does at the door:
//     loginAdmin   = sign in (phone + password)  -> sets the admin cookie
//     logoutAdmin  = sign out                    -> clears the admin cookie
//     getAdminMe   = "who am I?"                 -> the web app uses it to know
//                    whether the admin is still signed in
//   The rules (password check, badge, brake) live in services. This file only
//   joins them together and shapes the answer.
//
// WHY IMPORTANT
//   This is where a visitor's request turns into "yes, come in" or "no". The
//   wrong word here (for example "that phone is not an admin") would help an
//   attacker.
//
// DANGER
//   1. Wrong phone and wrong password give the SAME answer: 401
//      'invalid_credentials'. Never say which one was wrong.
//   2. The brake is asked BEFORE the password is checked, and every failure is
//      written down AFTER. A blocked visitor gets 429 and a Retry-After header.
//   3. Never log or return the password, the hash, or the token.
//   4. The token goes ONLY in the httpOnly cookie, never in the response body.
//
// WHAT IT SOLVES
//   A safe, boring, predictable admin sign-in.
//
// SYSTEM DESIGN PRINCIPLE
//   Thin controller, fat service. Decisions live in services (testable without a
//   web server); the controller only translates between web and services.
//
// RULES
//   1. Bad shape of request (missing phone or password): 400 'validation'.
//   2. Blocked by the brake: 429 'too_many_attempts' + Retry-After seconds.
//   3. Wrong credentials, disabled admin, unknown phone: 401 'invalid_credentials'.
//   4. Success: 200, cookie set, body { data: { admin: { id, name } }, error: null }.
//   5. Logout always answers 200 and always clears the cookie (even if you were
//      not signed in), so it can never reveal anything.
//
// PRACTICAL EXAMPLE
//   POST /v1/admin/auth/login  { "phone": "0712345678", "password": "..." }
//   -> 200 + Set-Cookie: admin_token=...; HttpOnly; SameSite=Strict
//
// DECISIONS
//   - The brake is keyed by the normalised phone (0712.. and +254712.. count as
//     the same person) and by the visitor's address (req.ip).
//   - Only { id, name } is returned. The phone is not echoed back.
//
// WHERE USED
//   routes/adminAuth.routes.js
//
// TRADEOFFS
//   + Very little code, easy to read.
//   - The brake is in memory (see adminLoginLimiter.js).
//
// HOW TO USE
//   import { loginAdmin, logoutAdmin, getAdminMe } from '../controllers/adminAuth.controller.js';
// =============================================================================

// PIECE BY PIECE
//   loginSchema   = the guard checking the visitor filled the form in.
//   limiterKey()  = writing the visitor's phone the same way every time.
//   loginAdmin    = the whole sign-in desk: brake, password, badge, cookie.
//   logoutAdmin   = hands the badge back at the desk.
//   getAdminMe    = "show me my own badge" (the guard already checked it).

// zod checks the shape of what the visitor sent.
import { z } from 'zod';
import { pool } from '../db/pool.js';
// Phone tidy-up (0712.. -> 254712..), reused so the brake counts one person once.
import { normalizePhone } from '../services/daraja.service.js';
// The brake: may they try, write down a failure, forgive after success.
import {
  checkAdminLoginAllowed,
  recordAdminLoginFailure,
  clearAdminLoginFailures,
} from '../services/adminLoginLimiter.js';
// The password check, the badge printer and the cookie settings.
import {
  ADMIN_COOKIE_NAME,
  verifyAdminLogin,
  signAdminToken,
  adminCookieOptions,
} from '../services/platformAdminAuth.service.js';

// The form must have a phone and a password, as text, with sane maximum sizes.
// We do NOT repeat the password rules here: a wrong-length password is simply a
// failed login, and the answer must not hint at the rules.
const loginSchema = z.object({
  phone: z.string().min(1).max(30),
  password: z.string().min(1).max(200),
});

// Write the phone the same way every time for the brake. If it is not even a
// phone, use the cleaned-up raw text so garbage still counts against the brake.
function limiterKey(phone) {
  try {
    return normalizePhone(phone);
  } catch {
    return `raw:${String(phone).trim().slice(0, 30)}`;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SIGN IN
// ═════════════════════════════════════════════════════════════════════════════
export async function loginAdmin(req, res) {
  // Step 1: did they fill the form in? If not, 400 (this does not reveal anything).
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      data: null,
      error: { code: 'validation', message: 'Phone and password are required' },
    });
  }
  const { phone, password } = parsed.data;

  // Step 2: ask the brake BEFORE doing any password work.
  const key = limiterKey(phone);
  const gate = checkAdminLoginAllowed(key, req.ip);
  if (!gate.allowed) {
    // Retry-After tells browsers and tools how many seconds to wait.
    res.set('Retry-After', String(gate.retryAfterSeconds));
    return res.status(429).json({
      data: null,
      error: { code: 'too_many_attempts', message: 'Too many attempts. Please try again later.' },
    });
  }

  // Step 3: check the password (the service always takes the same time).
  const admin = await verifyAdminLogin(pool, { phone, password });

  // Step 4: failed. Write it down on the brake's notepad, then answer vaguely.
  if (!admin) {
    recordAdminLoginFailure(key, req.ip);
    return res.status(401).json({
      data: null,
      error: { code: 'invalid_credentials', message: 'Invalid credentials' },
    });
  }

  // Step 5: success. Forgive this phone's earlier failures, print the badge and
  // hand it over in the cookie (never in the body).
  clearAdminLoginFailures(key);
  const token = signAdminToken(admin);
  res.cookie(ADMIN_COOKIE_NAME, token, adminCookieOptions());

  // Step 6: tell the web app who signed in (id and name only).
  return res.status(200).json({
    data: { admin: { id: admin.id, name: admin.name } },
    error: null,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SIGN OUT
// ═════════════════════════════════════════════════════════════════════════════
export function logoutAdmin(_req, res) {
  // To remove a cookie the browser needs the SAME settings it was set with
  // (path, sameSite, etc.). We reuse them, minus maxAge.
  const { maxAge: _ignored, ...settings } = adminCookieOptions();
  res.clearCookie(ADMIN_COOKIE_NAME, settings);
  // Always 200, even if nobody was signed in. Nothing to reveal.
  return res.status(200).json({ data: { signedOut: true }, error: null });
}

// ═════════════════════════════════════════════════════════════════════════════
// WHO AM I?
// requirePlatformAdmin already checked the badge and wrote req.admin.
// ═════════════════════════════════════════════════════════════════════════════
export function getAdminMe(req, res) {
  return res.status(200).json({
    data: { admin: { id: req.admin.id, name: req.admin.name } },
    error: null,
  });
}
