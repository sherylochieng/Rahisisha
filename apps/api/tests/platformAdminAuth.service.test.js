// =============================================================================
// FILE: apps/api/tests/platformAdminAuth.service.test.js   (Week 30, platform admin: step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the admin sign-in rules: right phone + password gets in, everything
//   else gets the same plain "no", a disabled admin is locked out at once, and
//   an admin badge can never be confused with a shop owner's badge.
//
// WHY IMPORTANT
//   This is the lock on the master key. Each check here is a way someone could
//   otherwise get into every shop.
//
// DANGER
//   Uses made-up phones and random passwords, and removes every admin it makes.
//   Never put a real admin phone or password here.
//
// WHAT IT SOLVES
//   Confidence in platformAdminAuth.service.js.
//
// SYSTEM DESIGN PRINCIPLE
//   Test each way in AND each way that must stay shut.
//
// RULES
//   1. Random phone and password for every admin made.
//   2. Clean up in afterAll through the same database lock the real code uses.
//   3. Never print passwords or tokens.
//
// PRACTICAL EXAMPLE
//   npm test -- platformAdminAuth
//
// DECISIONS
//   - Real database and real bcrypt (the slow part is a fraction of a second).
//   - Expired badges are made with signAdminToken(admin, '-1s').
//
// WHERE USED
//   Normal test run and the pre-push hook.
//
// TRADEOFFS
//   + Tests the real lock and the real hashing.
//   - The login ROUTE (cookie, 401, 429) is tested in the next sub-step.
//
// HOW TO USE
//   cd apps/api ; npm test -- platformAdminAuth
// =============================================================================

// PIECE BY PIECE
//   makeAdmin()   = "add a pretend staff member to the book" (and remember them
//                   so we can remove them at closing time).
//   lockedQuery() = "open the head-office drawer for one look" (like the real code).
//   afterAll      = at closing time, remove every pretend staff member.

// ── The tools this test borrows ─────────────────────────────────────────────
// crypto: makes random phones and passwords so tests never clash.
import crypto from 'node:crypto';
// jsonwebtoken: lets the test forge "wrong kind" badges on purpose (check 5).
import jwt from 'jsonwebtoken';
// pool: the real connection to the LOCAL test database.
import { pool } from '../src/db/pool.js';
// createPlatformAdmin: adds a pretend admin. withAdminLock: opens the head-office safe.
import { createPlatformAdmin, withAdminLock } from '../src/services/platformAdmin.service.js';
// The four jobs and the cookie settings we are testing.
import {
  verifyAdminLogin,
  signAdminToken,
  readAdminToken,
  loadActiveAdmin,
  adminCookieOptions,
  ADMIN_COOKIE_NAME,
} from '../src/services/platformAdminAuth.service.js';

// A made-up valid Kenyan number, new each time: '07' + 8 random digits.
// padStart(8, '0') keeps the length right when the random number is small.
const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
// A random password, long enough to pass the 12-character rule.
const randomPassword = () => `pw-${crypto.randomBytes(12).toString('hex')}`;

// Every admin we create goes on this list, so afterAll can remove them and leave
// the database as we found it.
const made = [];

// Make a pretend admin and return everything the tests need.
async function makeAdmin() {
  // Fresh phone and password for this pretend staff member.
  const phone = randomPhone();
  const password = randomPassword();
  // Write them into the staff book through the real creation function.
  const admin = await createPlatformAdmin(pool, { phone, name: 'Auth Test', password });
  // Remember the id for clean-up at closing time.
  made.push(admin.id);
  // The tests need the plain password too (the database only keeps the scramble).
  return { phone, password, admin };
}

// Run one query with the head-office lock open (like the real code does).
const lockedQuery = (sql, params = []) =>
  withAdminLock(pool, async (client) => (await client.query(sql, params)).rows);

// At closing time: delete every pretend admin, then close the database connection
// (otherwise the test run would hang waiting).
afterAll(async () => {
  if (made.length) await lockedQuery('DELETE FROM platform_admins WHERE id = ANY($1)', [made]);
  await pool.end();
});

describe('platform admin sign-in rules (Week 30)', () => {

  // CHECK 1. The right phone and password get in, and the visit is recorded.
  // Real life: the guard checks your name and password, lets you in, and writes
  // the time you arrived.
  test('1. correct phone and password return the admin and record the last login', async () => {
    // Make a pretend admin, then try to sign in as them.
    const { phone, password, admin } = await makeAdmin();
    const got = await verifyAdminLogin(pool, { phone, password });
    // The answer is only the id, phone and name (no hash, no status).
    expect(got).toEqual({ id: admin.id, phone: admin.phone, name: 'Auth Test' });
    // last_login_at was filled in.
    const [row] = await lockedQuery('SELECT last_login_at FROM platform_admins WHERE id = $1', [admin.id]);
    expect(row.last_login_at).not.toBeNull();
  });

  // CHECK 2. Every kind of "no" looks the same (null).
  // Real life: the guard says only "not today" whether your name is wrong, your
  // password is wrong, or your number is not even written down.
  test('2. wrong password, unknown phone and badly shaped phone all give null', async () => {
    const { phone, password } = await makeAdmin();
    // Right phone, wrong password.
    expect(await verifyAdminLogin(pool, { phone, password: 'wrong-password-123' })).toBeNull();
    // Right password, but a phone that is not in the staff book.
    expect(await verifyAdminLogin(pool, { phone: randomPhone(), password })).toBeNull();
    // A phone that is not even a phone.
    expect(await verifyAdminLogin(pool, { phone: 'abc', password })).toBeNull();
    // Missing values do not crash it either.
    expect(await verifyAdminLogin(pool, { phone: undefined, password: undefined })).toBeNull();
  });

  // CHECK 3. A disabled admin is locked out even with the right password.
  // Real life: someone who left the company cannot use their old key.
  test('3. a disabled admin cannot sign in, and loadActiveAdmin stops returning them', async () => {
    const { phone, password, admin } = await makeAdmin();
    // While active, both work.
    expect(await verifyAdminLogin(pool, { phone, password })).not.toBeNull();
    expect(await loadActiveAdmin(pool, admin.id)).not.toBeNull();
    // Disable them (through the lock, like an admin tool would).
    await lockedQuery(`UPDATE platform_admins SET status = 'disabled' WHERE id = $1`, [admin.id]);
    expect(await verifyAdminLogin(pool, { phone, password })).toBeNull();
    expect(await loadActiveAdmin(pool, admin.id)).toBeNull();
  });

  // CHECK 4. The badge: made, read, and tied to one admin.
  // Real life: a printed badge that says "admin, valid 8 hours".
  test('4. a signed admin badge is read back and names the right admin', async () => {
    const { admin } = await makeAdmin();
    // Print a badge for this admin, then read it back.
    const token = signAdminToken(admin);
    expect(readAdminToken(token)).toEqual({ adminId: admin.id });
  });

  // CHECK 5. Badges that must NOT work: shop-owner badge, expired, forged, empty.
  // Real life: a shop kiosk badge does not open the head-office door, an old
  // badge is refused, and a photocopy with a fake stamp is refused.
  test('5. a shop owner badge, an expired badge, a forged badge and no badge are all refused', async () => {
    const { admin } = await makeAdmin();
    // (Each line below tries a different bad badge. All must come back null.)
    // A badge signed the way SHOP OWNERS are signed (with the plain JWT secret),
    // even if it claims to be an admin: the stamp is different, so it fails.
    const ownerStyle = jwt.sign({ admin_id: admin.id, typ: 'platform_admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    expect(readAdminToken(ownerStyle)).toBeNull();
    // A real owner token (user_id, tenant_id, role) is refused too.
    const ownerToken = jwt.sign({ user_id: 'u', tenant_id: 't', role: 'owner' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    expect(readAdminToken(ownerToken)).toBeNull();
    // Already expired (valid stamp, but too old).
    expect(readAdminToken(signAdminToken(admin, '-1s'))).toBeNull();
    // Tampered: change one character of a real badge.
    const real = signAdminToken(admin);
    expect(readAdminToken(`${real.slice(0, -2)}xx`)).toBeNull();
    // Nothing at all.
    expect(readAdminToken(undefined)).toBeNull();
    expect(readAdminToken('')).toBeNull();
  });

  // CHECK 6. How the badge is carried: safe cookie settings.
  // Real life: the badge goes in a pocket that page scripts cannot reach, and it
  // is not shared with shop sub-addresses.
  test('6. the admin cookie is httpOnly, same-site strict, 8 hours, with no shared domain', () => {
    // This test needs no database: it only reads the cookie settings.
    const o = adminCookieOptions();
    expect(ADMIN_COOKIE_NAME).toBe('admin_token');
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe('strict');
    expect(o.maxAge).toBe(8 * 60 * 60 * 1000);
    // No `domain`: it must never be shared with shop sub-addresses.
    expect(o.domain).toBeUndefined();
  });
});