// =============================================================================
// FILE: apps/api/tests/adminAuth.routes.test.js   (Week 30, platform admin: step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the admin sign-in DOOR works end to end, through the real web app
//   (supertest sends real requests, no browser needed): login, the cookie,
//   "who am I", logout, the brake, and refusal of every wrong kind of badge.
//
// WHY IMPORTANT
//   The service tests prove the rules. These prove the rules are actually wired
//   to the web addresses. A rule that is not wired in protects nobody.
//
// DANGER
//   Uses random made-up admins on your LOCAL database only. Every admin created
//   is deleted afterwards. No real secrets are printed.
//
// WHAT IT SOLVES
//   Confidence that /v1/admin/auth/* behaves exactly as designed.
//
// SYSTEM DESIGN PRINCIPLE
//   Test the door from the outside, the way a visitor would use it.
//
// RULES
//   1. Each test starts with an empty brake notepad (resetAdminLoginLimiter).
//   2. Every pretend admin is removed in afterAll.
//   3. A cookie jar (supertest agent) plays the part of the browser.
//
// PRACTICAL EXAMPLE
//   cd apps/api ; npm test -- adminAuth.routes
//
// DECISIONS
//   - Uses the real app and real database, not fakes, so wiring mistakes show up.
//
// WHERE USED
//   Normal test run.
//
// TRADEOFFS
//   + Catches wiring mistakes the service tests cannot.
//   - Slower (real bcrypt, real database): a few seconds.
//
// HOW TO USE
//   cd apps/api ; npm test -- adminAuth.routes
// =============================================================================

// PIECE BY PIECE
//   makeAdmin()    = add a pretend staff member to the book.
//   agent          = a pretend browser that remembers cookies.
//   cookieOf(res)  = read the admin cookie line out of a reply.

// ── Tools ───────────────────────────────────────────────────────────────────
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
// supertest sends fake web requests straight into the app (no real server/port).
import request from 'supertest';
import dotenv from 'dotenv';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { createPlatformAdmin, withAdminLock } from '../src/services/platformAdmin.service.js';
import { signAdminToken } from '../src/services/platformAdminAuth.service.js';
import { resetAdminLoginLimiter } from '../src/services/adminLoginLimiter.js';

// Make sure JWT_SECRET and database settings are loaded, same as the other tests.
dotenv.config();

// The door's addresses.
const LOGIN = '/v1/admin/auth/login';
const LOGOUT = '/v1/admin/auth/logout';
const ME = '/v1/admin/auth/me';

// Random made-up phone and password (same idea as the service tests).
const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const randomPassword = () => `pw-${crypto.randomBytes(12).toString('hex')}`;

// Every admin we create, so afterAll can remove them.
const made = [];
async function makeAdmin() {
  const phone = randomPhone();
  const password = randomPassword();
  const admin = await createPlatformAdmin(pool, { phone, name: 'Door Test', password });
  made.push(admin.id);
  return { phone, password, admin };
}

// Run one query with the head-office lock open.
const lockedQuery = (sql, params = []) =>
  withAdminLock(pool, async (client) => (await client.query(sql, params)).rows);

// Find the admin cookie line inside a reply's Set-Cookie headers (or undefined).
const cookieOf = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('admin_token='));

// Each test starts with a clean brake notepad.
beforeEach(() => resetAdminLoginLimiter());

// At closing time: remove pretend admins, close the database connection.
afterAll(async () => {
  if (made.length) await lockedQuery('DELETE FROM platform_admins WHERE id = ANY($1)', [made]);
  await pool.end();
});

describe('platform admin sign-in door (Week 30)', () => {

  // CHECK 1. Right phone and password: signed in, cookie set safely, "me" works.
  // Real life: the guard checks your name, hands you a badge in a sealed pocket,
  // and next time you show it, he knows who you are.
  test('1. correct login sets a safe cookie and /me then names the admin', async () => {
    const { phone, password, admin } = await makeAdmin();
    // `agent` remembers cookies between requests, like a browser.
    const agent = request.agent(app);

    const login = await agent.post(LOGIN).send({ phone, password });
    expect(login.status).toBe(200);
    // Only id and name come back: no hash, no phone, no token in the body.
    expect(login.body).toEqual({ data: { admin: { id: admin.id, name: 'Door Test' } }, error: null });
    expect(JSON.stringify(login.body)).not.toMatch(/hash|token|password/i);

    // The cookie must be httpOnly + SameSite=Strict, and must NOT carry a Domain.
    const cookie = cookieOf(login);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).not.toMatch(/Domain=/i);
    // The reply must not be cached by browsers or proxies.
    expect(login.headers['cache-control']).toMatch(/no-store/);

    // The cookie jar now carries the badge, so /me works.
    const me = await agent.get(ME);
    expect(me.status).toBe(200);
    expect(me.body.data.admin).toEqual({ id: admin.id, name: 'Door Test' });
  });

  // CHECK 2. Wrong password and unknown phone get the SAME answer.
  // Real life: the guard says only "not today", never which part was wrong.
  test('2. wrong password and unknown phone give identical 401 answers', async () => {
    const { phone, password } = await makeAdmin();
    const wrongPassword = await request(app).post(LOGIN).send({ phone, password: 'wrong-password-123' });
    const unknownPhone = await request(app).post(LOGIN).send({ phone: randomPhone(), password });
    expect(wrongPassword.status).toBe(401);
    expect(unknownPhone.status).toBe(401);
    // Exactly the same body, word for word.
    expect(wrongPassword.body).toEqual(unknownPhone.body);
    expect(wrongPassword.body.error.code).toBe('invalid_credentials');
    // No cookie is set on a failure.
    expect(cookieOf(wrongPassword)).toBeUndefined();
  });

  // CHECK 3. A form with missing parts is a 400, not a crash.
  test('3. missing phone or password gives 400 validation', async () => {
    const empty = await request(app).post(LOGIN).send({});
    const noPassword = await request(app).post(LOGIN).send({ phone: '0712345678' });
    expect(empty.status).toBe(400);
    expect(noPassword.status).toBe(400);
    expect(empty.body.error.code).toBe('validation');
  });

  // CHECK 4. /me with no badge, a garbage badge, or a shop owner's badge: 401.
  // Real life: a shop kiosk badge does not open the head-office door.
  test('4. /me refuses no cookie, a fake badge and a shop owner badge', async () => {
    const { admin } = await makeAdmin();
    // No cookie at all.
    const none = await request(app).get(ME);
    expect(none.status).toBe(401);
    expect(none.body).toEqual({ data: null, error: { code: 'unauthorized', message: 'Not signed in' } });
    // A garbage admin cookie.
    const garbage = await request(app).get(ME).set('Cookie', 'admin_token=not-a-real-badge');
    expect(garbage.status).toBe(401);
    // A shop owner's cookie ('token') with a real shop-owner style badge.
    const ownerBadge = jwt.sign({ user_id: 'u', tenant_id: 't', role: 'owner' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const owner = await request(app).get(ME).set('Cookie', `token=${ownerBadge}`);
    expect(owner.status).toBe(401);
    // A badge signed the shop-owner way but placed in the ADMIN cookie, claiming to be admin.
    const forged = jwt.sign({ admin_id: admin.id, typ: 'platform_admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const forgedRes = await request(app).get(ME).set('Cookie', `admin_token=${forged}`);
    expect(forgedRes.status).toBe(401);
    // An expired real admin badge.
    const expired = signAdminToken(admin, '-1s');
    const expiredRes = await request(app).get(ME).set('Cookie', `admin_token=${expired}`);
    expect(expiredRes.status).toBe(401);
  });

  // CHECK 5. The brake: after 5 wrong tries even the RIGHT password is refused.
  // Real life: after five wrong tries the guard says "come back later", even if
  // the sixth key is correct.
  test('5. five wrong tries block the phone with 429 and a Retry-After header', async () => {
    const { phone, password } = await makeAdmin();
    for (let i = 0; i < 5; i += 1) {
      const bad = await request(app).post(LOGIN).send({ phone, password: 'wrong-password-123' });
      expect(bad.status).toBe(401);
    }
    // The sixth try uses the CORRECT password but is still refused.
    const blocked = await request(app).post(LOGIN).send({ phone, password });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('too_many_attempts');
    // The wait time is a whole number of seconds, 1 to 900.
    const wait = Number(blocked.headers['retry-after']);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(15 * 60);
    expect(cookieOf(blocked)).toBeUndefined();
  });

  // CHECK 6. A disabled admin with a still-valid badge is locked out at once.
  // Real life: someone is dismissed at 10 a.m.; their badge says it is valid
  // until 6 p.m., but the guard phones the staff book and refuses them.
  test('6. disabling an admin locks out their existing badge immediately', async () => {
    const { phone, password, admin } = await makeAdmin();
    const agent = request.agent(app);
    await agent.post(LOGIN).send({ phone, password });
    expect((await agent.get(ME)).status).toBe(200);
    // Disable them through the lock (like an admin tool would).
    await lockedQuery(`UPDATE platform_admins SET status = 'disabled' WHERE id = $1`, [admin.id]);
    // The same cookie, still unexpired, no longer works.
    expect((await agent.get(ME)).status).toBe(401);
  });

  // CHECK 7. Logout clears the cookie, and /me stops working.
  // Real life: you hand the badge back at the desk.
  test('7. logout clears the cookie and /me then refuses', async () => {
    const { phone, password } = await makeAdmin();
    const agent = request.agent(app);
    await agent.post(LOGIN).send({ phone, password });
    expect((await agent.get(ME)).status).toBe(200);

    const out = await agent.post(LOGOUT);
    expect(out.status).toBe(200);
    // The reply tells the browser to delete the cookie (empty value, in the past).
    expect(cookieOf(out)).toMatch(/admin_token=;/);
    expect(cookieOf(out)).toMatch(/Expires=/i);

    expect((await agent.get(ME)).status).toBe(401);
    // Logging out when nobody is signed in is still a harmless 200.
    expect((await request(app).post(LOGOUT)).status).toBe(200);
  });
});