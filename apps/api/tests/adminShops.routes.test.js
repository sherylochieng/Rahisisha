// =============================================================================
// FILE: apps/api/tests/adminShops.routes.test.js   (Week 30 Day 3, Batch 1: admin core, step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the admin shop DOORS (web addresses) work and are locked: nobody
//   without an admin cookie gets in, a signed-in admin can list, open, suspend,
//   reinstate, verify and un-verify, and every refusal has the right status.
//
// WHY IMPORTANT
//   The service rules are tested elsewhere. THIS file proves the door itself:
//   that the guard really covers every address, that the admin id comes from
//   the cookie and not from the body, and that errors never leak details.
//
// DANGER
//   Makes its own throw-away admin, owner and shops with random names and
//   removes them afterwards. Never put a real phone or password here.
//
// WHAT IT SOLVES
//   Confidence that app.js, the guard, the router, the controller and the
//   service fit together.
//
// SYSTEM DESIGN PRINCIPLE
//   Test at every layer: the service tests prove the rules, this file proves
//   the wiring. A rule that is correct but not connected protects nobody.
//
// RULES
//   1. Each run makes its own admin, owner and shops with random names.
//   2. Clean up everything made (receipts, shops, owner, admin).
//   3. Never print passwords.
//
// PRACTICAL EXAMPLE
//   cd apps/api ; npm test -- adminShops.routes
//
// DECISIONS
//   - Uses supertest with a cookie jar (request.agent), which plays the part of
//     the admin's browser.
//   - Signs in through the real login door, so the real cookie is used.
//
// WHERE USED
//   Part of the normal test run (and the pre-push hook).
//
// TRADEOFFS
//   + Tests the real wiring end to end without opening a port.
//   - Needs the database (same as the other route tests).
//
// HOW TO USE
//   cd apps/api ; npm test -- adminShops.routes
// =============================================================================

// PIECE BY PIECE
//   BASE                = the start of every address we test.
//   beforeAll           = hire an admin, open a shop with an owner, sign in.
//   afterAll            = remove everything we made.
//   anonymous           = a visitor with NO cookie (supertest without an agent).
//   admin               = a browser that has signed in as the admin.

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import dotenv from 'dotenv';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { createPlatformAdmin, withAdminLock } from '../src/services/platformAdmin.service.js';
import { resetAdminLoginLimiter } from '../src/services/adminLoginLimiter.js';

dotenv.config();

const BASE = '/v1/admin/shops';
const LOGIN = '/v1/admin/auth/login';

const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const randomPassword = () => `pw-${crypto.randomBytes(12).toString('hex')}`;
const tag = `rt${crypto.randomBytes(4).toString('hex')}`;

let adminId;
let shopId;
let userId;
let admin;   // the signed-in browser

beforeAll(async () => {
  resetAdminLoginLimiter();
  // Hire the admin and sign in through the real door.
  const phone = randomPhone();
  const password = randomPassword();
  const made = await createPlatformAdmin(pool, { phone, name: 'Routes Test Admin', password });
  adminId = made.id;
  admin = request.agent(app);
  const login = await admin.post(LOGIN).send({ phone, password });
  expect(login.status).toBe(200);

  // One throw-away shop with an owner.
  const { rows: t } = await pool.query(
    'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
    [`${tag} Routes Fashions`, `${tag}-routes`]
  );
  shopId = t[0].id;
  const { rows: u } = await pool.query(
    'INSERT INTO users (phone, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [`2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`, 'Routes Owner', 'not-a-real-hash']
  );
  userId = u[0].id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [shopId]);
    await client.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')", [shopId, userId]);
    await client.query('COMMIT');
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await pool.query('DELETE FROM audit_logs WHERE tenant_id = $1', [shopId]);
  await pool.query('DELETE FROM tenants WHERE id = $1', [shopId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await withAdminLock(pool, (c) => c.query('DELETE FROM platform_admins WHERE id = $1', [adminId]));
  await pool.end();
});

describe('admin shops doors (Week 30 Day 3, Batch 1)', () => {

  // CHECK 1. THE LOCK: every address refuses a visitor without the admin cookie.
  // Real life: the door of head office is locked, whichever window you try.
  test('1. all six addresses refuse a visitor with no admin cookie (401)', async () => {
    const calls = [
      request(app).get(BASE),
      request(app).get(`${BASE}/${shopId}`),
      request(app).post(`${BASE}/${shopId}/suspend`).send({ reason: 'trying to sneak in' }),
      request(app).post(`${BASE}/${shopId}/reinstate`).send({ reason: 'trying to sneak in' }),
      request(app).post(`${BASE}/${shopId}/verify`).send({ reason: 'trying to sneak in' }),
      request(app).post(`${BASE}/${shopId}/unverify`).send({ reason: 'trying to sneak in' }),
    ];
    for (const call of calls) {
      const res = await call;
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ data: null, error: { code: 'unauthorized', message: 'Not signed in' } });
    }
    // And the shop was not touched.
    const { rows } = await pool.query('SELECT status FROM tenants WHERE id = $1', [shopId]);
    expect(rows[0].status).toBe('active');
  });

  // CHECK 2. A forged badge does not work.
  // Real life: a badge printed at home, signed with the wrong stamp, is refused.
  test('2. a cookie signed with the shop secret instead of the admin key is refused', async () => {
    const forged = jwt.sign({ admin_id: adminId, typ: 'platform_admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app).get(BASE).set('Cookie', `admin_token=${forged}`);
    expect(res.status).toBe(401);
  });

  // CHECK 3. The list and one shop, with the right envelope and no-store.
  test('3. a signed-in admin lists shops and opens one (and nothing is cached)', async () => {
    const list = await admin.get(`${BASE}?q=${tag}`);
    expect(list.status).toBe(200);
    expect(list.headers['cache-control']).toMatch(/no-store/);
    expect(list.body.error).toBeNull();
    expect(list.body.nextCursor).toBeNull();
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ id: shopId, status: 'active', verified: false });
    expect(list.body.data[0].owner).toMatchObject({ name: 'Routes Owner' });
    expect(JSON.stringify(list.body)).not.toContain('not-a-real-hash');

    const one = await admin.get(`${BASE}/${shopId}`);
    expect(one.status).toBe(200);
    expect(one.body.data.id).toBe(shopId);
    expect(one.body.data.receipts).toEqual([]);
  });

  // CHECK 4. Bad addresses and bad words get clean refusals, not crashes.
  test('4. bad id, unknown shop, bad filter and bad bookmark get clean refusals', async () => {
    const badId = await admin.get(`${BASE}/not-an-id`);
    expect(badId.status).toBe(400);
    expect(badId.body.error.code).toBe('validation');

    const unknown = await admin.get(`${BASE}/${crypto.randomUUID()}`);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('shop_not_found');

    const badStatus = await admin.get(`${BASE}?status=banana`);
    expect(badStatus.status).toBe(400);
    const badCursor = await admin.get(`${BASE}?cursor=zzz`);
    expect(badCursor.status).toBe(400);
    // A list-like query value (?status=a&status=b) is refused too, not a crash.
    const twice = await admin.get(`${BASE}?status=active&status=suspended`);
    expect(twice.status).toBe(400);
  });

  // CHECK 5. The reason is required at the door.
  test('5. a missing or too short reason is refused (400) and the shop is unchanged', async () => {
    for (const body of [undefined, {}, { reason: '' }, { reason: 'abcd' }, { reason: 123 }, { reason: 'x'.repeat(501) }]) {
      const req = admin.post(`${BASE}/${shopId}/suspend`);
      const res = body === undefined ? await req : await req.send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('validation');
    }
    const { rows } = await pool.query('SELECT status FROM tenants WHERE id = $1', [shopId]);
    expect(rows[0].status).toBe('active');
  });

  // CHECK 6. Suspend, then the same again, then reinstate.
  // Real life: close the shop, try to close it again (refused), open it again.
  test('6. suspend (200), suspend again (409), reinstate (200), reinstate again (409)', async () => {
    const s1 = await admin.post(`${BASE}/${shopId}/suspend`).send({ reason: 'customers reported fake M-Pesa messages' });
    expect(s1.status).toBe(200);
    expect(s1.body.data.status).toBe('suspended');
    expect(s1.body.data.suspendedBy).toBe(adminId);

    const s2 = await admin.post(`${BASE}/${shopId}/suspend`).send({ reason: 'customers reported fake M-Pesa messages' });
    expect(s2.status).toBe(409);
    expect(s2.body.error.code).toBe('already_suspended');

    const r1 = await admin.post(`${BASE}/${shopId}/reinstate`).send({ reason: 'owner fixed it and proved it' });
    expect(r1.status).toBe(200);
    expect(r1.body.data.status).toBe('active');

    const r2 = await admin.post(`${BASE}/${shopId}/reinstate`).send({ reason: 'owner fixed it and proved it' });
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe('not_suspended');
  });

  // CHECK 7. Verify and un-verify through the door.
  test('7. verify (200), verify again (409), un-verify (200), un-verify again (409)', async () => {
    const v1 = await admin.post(`${BASE}/${shopId}/verify`).send({ reason: 'business permit checked' });
    expect(v1.status).toBe(200);
    expect(v1.body.data.verified).toBe(true);
    const v2 = await admin.post(`${BASE}/${shopId}/verify`).send({ reason: 'business permit checked' });
    expect(v2.status).toBe(409);
    expect(v2.body.error.code).toBe('already_verified');
    const u1 = await admin.post(`${BASE}/${shopId}/unverify`).send({ reason: 'verified by mistake' });
    expect(u1.status).toBe(200);
    expect(u1.body.data.verified).toBe(false);
    const u2 = await admin.post(`${BASE}/${shopId}/unverify`).send({ reason: 'verified by mistake' });
    expect(u2.status).toBe(409);
    expect(u2.body.error.code).toBe('not_verified');
  });

  // CHECK 8. The admin id comes from the COOKIE, never from the body, and the
  // receipts show the history. Real life: you cannot sign a form in someone
  // else's name just by writing their name on it.
  test('8. a fake adminId in the body is ignored, and the receipts name the real admin', async () => {
    const stranger = crypto.randomUUID();
    const res = await admin
      .post(`${BASE}/${shopId}/suspend`)
      .send({ reason: 'testing that the body cannot pick the admin', adminId: stranger, tenantId: crypto.randomUUID() });
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(shopId);            // the address decided the shop
    expect(res.body.data.suspendedBy).toBe(adminId);  // the cookie decided the admin

    const file = await admin.get(`${BASE}/${shopId}`);
    const actions = file.body.data.receipts.map((r) => r.action);
    // Newest first: suspended, unverified, verified, reinstated, suspended.
    expect(actions).toEqual(['shop.suspended', 'shop.unverified', 'shop.verified', 'shop.reinstated', 'shop.suspended']);
    expect(file.body.data.receipts.every((r) => r.adminName === 'Routes Test Admin')).toBe(true);
    // The receipt carries a network address from the request.
    expect(file.body.data.receipts[0].ipAddress).toBeTruthy();
  });
});
