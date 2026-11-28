// =============================================================================
// FILE: apps/api/tests/adminStats.routes.test.js   (Week 30 Day 3, Batch 3a: admin overview numbers)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the overview address is locked, and gives the right reply to a signed-in admin:
//   through the whole app, with real cookies, like a browser does.
//
// WHY IMPORTANT
//   These numbers describe the whole platform. A visitor, or a shop owner, must never get them.
//
// DANGER
//   - Creates its own admin and removes it afterwards. Never touches other admins.
//
// WHAT IT SOLVES
//   "Is the door locked, does the right key work, and is the reply safe?"
//
// SYSTEM DESIGN PRINCIPLE
//   Test the locks as well as the features. A feature that works for everybody is a bug.
//
// RULES
//   1. No cookie = 401, same envelope as every admin address.
//   2. A cookie signed with the shop-owner secret = 401 (a shop owner is not an admin).
//   3. A signed-in admin gets 200, the five numbers, and a no-store header.
//   4. Anything sent in the address is ignored.
//
// PRACTICAL EXAMPLE
//   GET /v1/admin/stats with no cookie -> 401. With the admin cookie -> 200 and the tally.
//
// DECISIONS
//   - Same style and setup as adminShops.routes.test.js, so both read alike.
//
// WHERE USED
//   Run by `npm test` and by GitHub CI.
//
// TRADEOFFS
//   + Real login, real cookie, real app.
//
// HOW TO USE
//   npm test -- tests/adminStats.routes.test.js
// =============================================================================

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import dotenv from 'dotenv';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { createPlatformAdmin, withAdminLock } from '../src/services/platformAdmin.service.js';
import { resetAdminLoginLimiter } from '../src/services/adminLoginLimiter.js';

dotenv.config();

const BASE = '/v1/admin/stats';
const LOGIN = '/v1/admin/auth/login';

const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const randomPassword = () => `pw-${crypto.randomBytes(12).toString('hex')}`;

let adminId;
let admin; // the signed-in browser

beforeAll(async () => {
  resetAdminLoginLimiter();
  const phone = randomPhone();
  const password = randomPassword();
  const made = await createPlatformAdmin(pool, { phone, name: 'Stats Routes Admin', password });
  adminId = made.id;
  admin = request.agent(app);
  const login = await admin.post(LOGIN).send({ phone, password });
  expect(login.status).toBe(200);
});

afterAll(async () => {
  await withAdminLock(pool, (c) => c.query('DELETE FROM platform_admins WHERE id = $1', [adminId]));
  await pool.end();
});

describe('admin stats door (Week 30 Day 3, Batch 3a)', () => {

  // CHECK 1. THE LOCK: no cookie, no numbers.
  test('1. a visitor with no admin cookie is refused (401)', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: { code: 'unauthorized', message: 'Not signed in' } });
  });

  // CHECK 2. A shop owner's kind of cookie is not an admin cookie.
  test('2. a cookie signed with the shop secret instead of the admin key is refused', async () => {
    const forged = jwt.sign({ admin_id: adminId, typ: 'platform_admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app).get(BASE).set('Cookie', `admin_token=${forged}`);
    expect(res.status).toBe(401);
  });

  // CHECK 3. The right key opens the door, the reply has the right shape and is never cached.
  test('3. a signed-in admin gets the five numbers, and nothing is cached', async () => {
    const res = await admin.get(BASE);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.body.error).toBeNull();
    expect(Object.keys(res.body.data)).toEqual(['shops']);
    expect(Object.keys(res.body.data.shops).sort()).toEqual(['active', 'newThisWeek', 'suspended', 'total', 'verified']);
    for (const value of Object.values(res.body.data.shops)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  // CHECK 4. Whatever is sent in the address changes nothing.
  test('4. words added to the address are ignored', async () => {
    const plain = await admin.get(BASE);
    const noisy = await admin.get(`${BASE}?status=banana&q=anything&limit=1`);
    expect(noisy.status).toBe(200);
    expect(noisy.body.data).toEqual(plain.body.data);
  });
});
