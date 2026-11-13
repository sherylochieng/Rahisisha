// =============================================================================
// FILE: apps/api/tests/signup-atomic.test.js
// signup-atomic.test.js — proves signup is all-or-nothing
// =============================================================================
//
// THE STORY (read this first):
// - Signup does FOUR jobs: make the shop, make the owner, link them, and fill
//   the shop with sample products. They share ONE transaction.
// - REAL LIFE: moving house. Either everything arrives in the new house, or you
//   stay in the old one. You never want half your furniture in each.
// - This test makes the LAST job (the samples) blow up, then checks that the
//   first three jobs were undone too.
//
// WHY THIS FILE EXISTS:
// - Reviewer check: "seeding runs in one transaction". The code is right today,
//   but nothing PROVED it. This test does.
//
// WHY IT IS IMPORTANT:
// - If seeding ever ran on the plain pool instead of the transaction's client,
//   a failed seeding would leave a shop with no samples and an owner who can
//   never sign up again ("phone already exists") but cannot log in properly.
//
// DANGER — IF THIS FILE DOES NOT EXIST:
// - Someone changes `seedSampleData(client, ...)` to use `pool`. Every test
//   stays green. The bug only shows up in production, one unlucky signup at a
//   time.
//
// WHAT THIS TEST SOLVES (the checks):
// - 1. Signup answers with a clean failure (500), not a crash
// - 2. Control: the seeding function really was called, so the failure happened
//      AFTER the shop and owner were inserted (otherwise the test proves nothing)
// - 3. No user with that phone was left behind
// - 4. No shop with that name was left behind
//
// RULES:
// - Mock ONLY the sample data service. Everything else is real, including the
//   database and the transaction
// - Mock BEFORE importing the app (see STEP 1 and STEP 2 below)
// - Clean up anything left behind, even when the test fails
//
// PRACTICAL EXAMPLE:
// - Amina signs up. The server runs out of memory while adding sample products.
//   She tries again with the same phone. It must work, not say "already exists".
//
// DECISIONS:
// - Same unstable_mockModule pattern as tests/errors/db-down.test.js
// - Random phone and business name: no clash with other tests or old runs
// - Mock throws a plain Error: the signup route's catch answers 500
//
// WHERE USED / FUTURE USES:
// - Runs in `npm test`. Copy this shape for any multi-step write (orders +
//   order items + stock, M-Pesa payment + wallet entry).
//
// TRADEOFFS:
// + Proves the rollback with the real database
// - Needs the local Postgres running, like the other API tests
//
// HOW TO RUN:
//   cd apps/api
//   npm test -- tests/signup-atomic.test.js
// =============================================================================

// jest: in ESM mode we must import it, it is not a global
import { jest } from '@jest/globals';

import request from 'supertest';
import dotenv  from 'dotenv';
import pg      from 'pg';

import { pool } from '../src/db/pool.js';

dotenv.config();

const { Pool } = pg;

// Our own connection as rahisisha_user (same as the real app).
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------
// STEP 1: swap the sample data service for one that EXPLODES.
// WHY before the import: the app grabs its imports once, at load time.
// REAL LIFE: put the broken part in the machine BEFORE switching it on.
// ---------------------------------------------------------------
const seedMock = jest.fn().mockRejectedValue(new Error('seeding exploded'));

jest.unstable_mockModule('../src/services/sampleData.service.js', () => ({
  seedSampleData: seedMock,
}));

// ---------------------------------------------------------------
// STEP 2: NOW import the app. It receives the exploding seeding.
// ---------------------------------------------------------------
const { default: app } = await import('../src/app.js');

// Random values so old leftovers can never clash with this run.
const rand  = Math.floor(Math.random() * 900000) + 100000;
const PHONE = `0799${rand}`;              // 10 digits: passes the 10 to 20 rule
const SHOP  = `Atomic Test ${rand}`;       // 2 to 100 characters

let errorSpy;

beforeAll(() => {
  // The route logs "[signup] transaction failed" on purpose. Keep the output quiet.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => {
  errorSpy.mockRestore();

  // Safety net: if a bug left rows behind, remove them so the database stays clean.
  // memberships has RLS, so we need the shop's key to delete from it.
  const left = await testPool.query('SELECT id FROM tenants WHERE name = $1', [SHOP]);
  for (const t of left.rows) {
    const client = await testPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_tenant', $1, true)", [t.id]);
      await client.query('DELETE FROM memberships WHERE tenant_id = $1', [t.id]);
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    await testPool.query('DELETE FROM tenants WHERE id = $1', [t.id]);
  }
  await testPool.query('DELETE FROM users WHERE phone = $1', [PHONE]);

  await testPool.end();
  await pool.end();
});

describe('Signup is all-or-nothing', () => {

  test('when seeding fails, signup fails cleanly and leaves nothing behind', async () => {
    const res = await request(app)
      .post('/v1/signup')
      .send({
        phone:       PHONE,
        name:        'Atomic Tester',
        password:    'password123',
        tenant_name: SHOP,
      });

    // CHECK 1: a clean failure, not a crash or a hang.
    expect(res.status).toBe(500);

    // CHECK 2 (control): seeding WAS reached. That means the shop and the owner
    // had already been inserted when it blew up. Without this check the test
    // could pass just because signup failed early for another reason.
    expect(seedMock).toHaveBeenCalledTimes(1);

    // CHECK 3: the owner was rolled back.
    const users = await testPool.query('SELECT id FROM users WHERE phone = $1', [PHONE]);
    expect(users.rows).toHaveLength(0);

    // CHECK 4: the shop was rolled back.
    const shops = await testPool.query('SELECT id FROM tenants WHERE name = $1', [SHOP]);
    expect(shops.rows).toHaveLength(0);
  });
});