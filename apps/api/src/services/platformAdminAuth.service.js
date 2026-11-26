// =============================================================================
// FILE: apps/api/src/services/platformAdminAuth.service.js   (Week 30, platform admin: step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The brains of the ADMIN login. It does four small jobs:
//     1. verifyAdminLogin   check a phone + password, return the admin or null
//     2. signAdminToken     make the admin's login badge (a signed token)
//     3. readAdminToken     check a badge and return who it belongs to, or null
//     4. loadActiveAdmin    on every admin request, confirm the admin still
//                           exists and is still active
//   The login route, the guard (middleware) and the tests all use this file, so
//   the rules live in one place.
//
// WHY IMPORTANT
//   This is the lock on the master key. A weak check here (a shop owner's badge
//   accepted as an admin badge, a disabled admin still getting in, a login that
//   reveals which phone numbers are admins) would expose every shop.
//
// DANGER
//   1. Every failure looks the SAME to the caller (null). The caller must answer
//      with one vague message ("Invalid credentials"), never "no such admin" or
//      "wrong password", so an attacker learns nothing.
//   2. When the phone is NOT an admin we still run a password check against a
//      dummy hash. Otherwise "unknown phone" answers faster than "wrong
//      password", and the speed difference reveals which numbers are admins.
//   3. Admin badges are signed with a DIFFERENT key from shop-owner badges
//      (derived from JWT_SECRET), and carry typ = 'platform_admin'. A shop
//      owner's badge can never pass as an admin badge, and the other way round.
//   4. Admin badges last 8 hours (shop owners get 7 days).
//   5. NEVER log the password, the hash, or the token.
//
// WHAT IT SOLVES
//   Safe admin sign-in that cannot be confused with shop-owner sign-in.
//
// SYSTEM DESIGN PRINCIPLE
//   Separate identities need separate keys. And re-check on every request: a
//   badge is a claim, the database is the truth, so a disabled admin is locked
//   out immediately, not when the badge expires.
//
// RULES
//   1. Phone is normalised (0712.. -> 254712..). A badly shaped phone is just a
//      failed login (null), not an error that reveals anything.
//   2. Only admins with status 'active' can sign in.
//   3. A successful sign-in updates last_login_at.
//   4. Reading the admin table always goes through withAdminLock (the database
//      lock), because platform_admins is locked by row level security.
//
// PRACTICAL EXAMPLE
//   const admin = await verifyAdminLogin(pool, { phone, password });
//   if (!admin) return res.status(401)...        // vague on purpose
//   const token = signAdminToken(admin);          // put it in the admin cookie
//
// DECISIONS
//   - Signing key = HMAC-SHA256(JWT_SECRET, 'platform-admin-v1'). No new secret
//     to manage, yet cryptographically different from the shop-owner key.
//   - Cookie name 'admin_token' (shop owners use 'token').
//   - The cookie has NO shared domain: it stays on the API's own address and is
//     never sent to shop sub-addresses.
//
// WHERE USED
//   controllers/adminAuth.controller.js, middleware/requirePlatformAdmin.js
//   (next sub-step), tests/platformAdminAuth.service.test.js
//
// TRADEOFFS
//   + Stolen shop-owner badges are useless at the admin door.
//   - Checking the database on every admin request costs one tiny query. Admin
//     traffic is very low, so that is fine.
//
// HOW TO USE
//   import { verifyAdminLogin, signAdminToken, readAdminToken, loadActiveAdmin,
//            ADMIN_COOKIE_NAME, adminCookieOptions } from './platformAdminAuth.service.js';
// =============================================================================

// PIECE BY PIECE
//   DUMMY_HASH               = a pretend staff member's scrambled password. When
//                              nobody matches the phone, we still check against
//                              it, so the guard takes the same time either way.
//   adminSigningKey()        = the head-office stamp. A different stamp from the
//                              shop kiosks' stamp, made from the same master
//                              secret.
//   verifyAdminLogin         = the guard at the head-office door: checks name
//                              and password, and says only "yes" or "no".
//   signAdminToken           = prints a badge that says "admin, valid 8 hours".
//   readAdminToken           = a quick look at the badge: real stamp? head-office
//                              type? not expired?
//   loadActiveAdmin          = phoning the staff book to ask "is this person
//                              still working here?" on every visit.
//   adminCookieOptions       = how the badge is carried: out of reach of page
//                              scripts, only same-site, secure when live.

// ── The tools this file borrows ──────────────────────────────────────────────
// crypto: Node's built-in toolbox for secrets (random ids, HMAC stamps).
import crypto from 'node:crypto';
// bcrypt: scrambles and checks passwords (slow on purpose, so guessing is slow).
import bcrypt from 'bcrypt';
// jsonwebtoken: prints and checks the signed badges (tokens).
import jwt from 'jsonwebtoken';
// normalizePhone: turns 0712... into 254712... (one agreed shape for phones).
import { normalizePhone } from './daraja.service.js';
// withAdminLock: opens the head-office safe (the RLS lock) for one transaction.
import { withAdminLock } from './platformAdmin.service.js';

// ── Settings ────────────────────────────────────────────────────────────────
// The name of the cookie that carries the admin's badge. Shop owners use a
// different name ('token'), so the two can never be mixed up in the browser.
export const ADMIN_COOKIE_NAME = 'admin_token';

// How long a badge lives. The jwt library wants "8h"; the cookie wants
// milliseconds. 8 hours x 60 minutes x 60 seconds x 1000 ms.
const TOKEN_LIFETIME = '8h';
const TOKEN_LIFETIME_MS = 8 * 60 * 60 * 1000;

// ── The pretend staff member (timing defence) ───────────────────────────────
// Starts empty. Made the first time it is needed, then reused (bcrypt at cost 12
// is slow, so we do not want to make a new one on every login).
let dummyHash = null;
async function getDummyHash() {
  // `crypto.randomUUID()` makes a random text, so nobody can ever know the
  // "password" behind this hash. 12 = the same slowness as real admin hashes.
  if (!dummyHash) dummyHash = await bcrypt.hash(`dummy-${crypto.randomUUID()}`, 12);
  return dummyHash;
}

// ── The head-office stamp ───────────────────────────────────────────────────
// Real life: the shop kiosks stamp badges with stamp A (JWT_SECRET). Head office
// has stamp B, made from stamp A plus a private word ('platform-admin-v1').
// A badge stamped with A is rejected by B and the other way round.
function adminSigningKey() {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET) // mix the master secret ...
    .update('platform-admin-v1')                  // ... with the private word ...
    .digest('hex');                               // ... and keep the result as text.
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 1: CHECK A PHONE AND PASSWORD
// Returns { id, phone, name } or null. Never says WHY it failed.
// ═════════════════════════════════════════════════════════════════════════════
export async function verifyAdminLogin(db, { phone, password }) {
  // Step 1: tidy the phone. A badly shaped phone makes normalizePhone throw; we
  // catch that and treat it as a failed login (we do not reveal why).
  let msisdn = null;
  try {
    msisdn = normalizePhone(phone);
  } catch {
    msisdn = null;
  }

  // Step 2: look the admin up inside the database lock. No phone, no lookup.
  // `rows[0] || null` = the first match, or null if there is none.
  const admin = msisdn
    ? await withAdminLock(db, async (client) => {
        const { rows } = await client.query(
          `SELECT id, phone, name, password_hash, status
             FROM platform_admins WHERE phone = $1`,
          [msisdn] // $1 is filled safely by the driver (no SQL injection)
        );
        return rows[0] || null;
      })
    : null;

  // Step 3: ALWAYS do one password check, so the time taken does not reveal
  // whether the phone belongs to an admin. No admin found? Check the dummy hash.
  // String(password ?? '') turns a missing password into empty text, not a crash.
  const hash = admin ? admin.password_hash : await getDummyHash();
  const passwordOk = await bcrypt.compare(String(password ?? ''), hash);

  // Step 4: all three must be true: the admin exists, is active, and the
  // password is right. Anything else is the same plain `null`.
  if (!admin || admin.status !== 'active' || !passwordOk) return null;

  // Step 5: remember when they last came in (useful to spot a visit at 3 a.m.).
  await withAdminLock(db, (client) =>
    client.query('UPDATE platform_admins SET last_login_at = NOW() WHERE id = $1', [admin.id])
  );

  // Step 6: hand back only the safe fields. The password hash never leaves here.
  return { id: admin.id, phone: admin.phone, name: admin.name };
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 2: MAKE THE BADGE
// `lifetime` can be changed by tests (for example '-1s' = already expired).
// ═════════════════════════════════════════════════════════════════════════════
export function signAdminToken(admin, lifetime = TOKEN_LIFETIME) {
  // The badge says two things: WHO (admin_id) and WHAT KIND (typ). It is stamped
  // with the head-office stamp and expires after `lifetime`.
  return jwt.sign({ admin_id: admin.id, typ: 'platform_admin' }, adminSigningKey(), {
    expiresIn: lifetime,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 3: LOOK AT A BADGE
// Returns { adminId } or null (fake, expired, wrong type, or made for a shop owner).
// ═════════════════════════════════════════════════════════════════════════════
export function readAdminToken(token) {
  // No badge at all: not allowed.
  if (!token) return null;
  try {
    // jwt.verify checks the stamp AND the expiry. A wrong stamp or an old badge
    // makes it throw, and the catch below turns that into null.
    const decoded = jwt.verify(token, adminSigningKey());
    // Second check: the badge must say it is an admin badge and name an admin.
    if (decoded.typ !== 'platform_admin' || !decoded.admin_id) return null;
    return { adminId: decoded.admin_id };
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 4: IS THIS ADMIN STILL ALLOWED IN?
// Returns { id, phone, name } or null (deleted or disabled).
// ═════════════════════════════════════════════════════════════════════════════
export async function loadActiveAdmin(db, adminId) {
  // A badge is only a claim. Ask the staff book: does this person still exist and
  // is their status 'active'? A disabled admin is locked out at once, even if
  // their badge has hours left.
  return withAdminLock(db, async (client) => {
    const { rows } = await client.query(
      `SELECT id, phone, name FROM platform_admins WHERE id = $1 AND status = 'active'`,
      [adminId]
    );
    return rows[0] || null;
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// HOW THE BADGE IS CARRIED (the cookie settings)
// ═════════════════════════════════════════════════════════════════════════════
export function adminCookieOptions() {
  return {
    // Page scripts cannot read it (protects against stolen badges).
    httpOnly: true,
    // Only over https when live (on your own laptop, http is fine).
    secure: process.env.NODE_ENV === 'production',
    // Sent only for requests that start on our own site.
    sameSite: 'strict',
    // NO `domain`: the cookie stays on the API's own address and is never sent to
    // shop sub-addresses (unlike the shop owner's cookie).
    // Browser forgets the cookie after 8 hours, matching the badge itself.
    maxAge: TOKEN_LIFETIME_MS,
    // Valid for every path on the API.
    path: '/',
  };
}