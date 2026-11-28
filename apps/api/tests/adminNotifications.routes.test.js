// =============================================================================
// FILE: apps/api/tests/adminNotifications.routes.test.js   (Week 30 Day 3, Batch 3b-2b, step 5)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the doors of the notifications window: no cookie means no entry, a
//   forged cookie is refused, a signed-in admin gets the right shape, and the
//   answer is never cached.
//
// WHY IMPORTANT
//   The list shows how the platform talks to shop owners. It must never be open
//   to the public or to a shop owner.
//
// DANGER
//   Makes its own throw-away admin and removes it. Never use a real admin here.
//
// WHAT IT SOLVES
//   Confidence in the HTTP layer: guard, envelope, headers, error answers.
//
// SYSTEM DESIGN PRINCIPLE
//   Test the lock first, then the contents.
//
// RULES
//   1. Random phone and password per run. 2. Remove the admin afterwards.
//
// PRACTICAL EXAMPLE
//   cd apps/api ; npm test -- adminNotifications.routes
//
// DECISIONS
//   Same layout as adminStats.routes.test.js so the admin tests read alike.
//
// WHERE USED
//   Normal test run.
//
// TRADEOFFS
//   + End to end through Express. - One bcrypt login per run.
//
// HOW TO USE
//   npm test -- adminNotifications.routes
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

const BASE = '/v1/admin/notifications';
const LOGIN = '/v1/admin/auth/login';

const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const randomPassword = () => `pw-${crypto.randomBytes(12).toString('hex')}`;

let adminId;
let admin;

beforeAll(async () => {
  resetAdminLoginLimiter();
  const phone = randomPhone();
  const password = randomPassword();
  const made = await createPlatformAdmin(pool, { phone, name: 'Notifications Routes Admin', password });
  adminId = made.id;
  admin = request.agent(app);
  const login = await admin.post(LOGIN).send({ phone, password });
  expect(login.status).toBe(200);
});

afterAll(async () => {
  await withAdminLock(pool, (c) => c.query('DELETE FROM platform_admins WHERE id = $1', [adminId]));
  await pool.end();
});

describe('admin notifications door (Week 30 Day 3, Batch 3b-2b)', () => {

  // CHECK 1. No cookie, no entry, on both addresses.
  test('1. a visitor with no admin cookie is refused (401) on both addresses', async () => {
    for (const path of [BASE, `${BASE}/summary`]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ data: null, error: { code: 'unauthorized', message: 'Not signed in' } });
    }
  });

  // CHECK 2. A cookie signed with the shop secret is not an admin cookie.
  test('2. a cookie signed with the shop secret is refused', async () => {
    const forged = jwt.sign({ admin_id: adminId, typ: 'platform_admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app).get(BASE).set('Cookie', `admin_token=${forged}`);
    expect(res.status).toBe(401);
  });

  // CHECK 3. The list: right envelope, never cached, no private fields.
  test('3. a signed-in admin gets a list in the usual envelope, never cached', async () => {
    const res = await admin.get(`${BASE}?limit=5`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.body.error).toBeNull();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect('nextCursor' in res.body).toBe(true);
    for (const item of res.body.data) {
      expect(item).not.toHaveProperty('recipient_phone');
      expect(item).not.toHaveProperty('recipientPhone');
      expect(item).not.toHaveProperty('payload');
    }
  });

  // CHECK 4. A bad filter is a polite 400.
  test('4. an unknown status filter or a bad bookmark answers 400', async () => {
    const a = await admin.get(`${BASE}?status=banana`);
    expect(a.status).toBe(400);
    expect(a.body.error.code).toBe('validation');
    const b = await admin.get(`${BASE}?cursor=nonsense`);
    expect(b.status).toBe(400);
  });

  // CHECK 5. The status filter works through the door.
  test('5. the status filter only returns that status', async () => {
    const res = await admin.get(`${BASE}?status=failed&limit=100`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((i) => i.status === 'failed')).toBe(true);
  });

  // CHECK 6. The summary has exactly the three counts.
  test('6. the summary has the three counts as whole numbers', async () => {
    const res = await admin.get(`${BASE}/summary`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(Object.keys(res.body.data).sort()).toEqual(['failed', 'queued', 'sent']);
    for (const value of Object.values(res.body.data)) expect(Number.isInteger(value)).toBe(true);
  });
});
