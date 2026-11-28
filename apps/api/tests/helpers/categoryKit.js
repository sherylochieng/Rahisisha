// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/helpers/categoryKit.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The three category test files (Batch 4a-1) all needed the same four
//   chores: act as head office, open a fresh test shop, find an aisle id,
//   and read a shop's slug. They now share ONE copy of each.
//
// WHY IMPORTANT
//   If the way a test shop is opened or head office is switched on changes,
//   you change it here once, not in every test file.
//
// DANGER (what breaks without it)
//   Copies drift apart: one test file keeps an old way of signing up and
//   fails for a reason that has nothing to do with what it tests.
//
// WHAT IT SOLVES
//   asAdmin(sql, params)       run SQL as head office (transaction-local switch)
//   signupTestShop(label)      -> { cookie, tenantId } for a brand new shop
//   categoryIdBySlug(slug)     -> the id of a real aisle, via the public list
//   readShopSlug(tenantId)     -> the shop's public address word
//
// SYSTEM DESIGN PRINCIPLE
//   DRY and separation of concerns: test files say WHAT they check; this
//   file knows HOW to set the scene. It is not a test (no .test.js in the
//   name), so Jest does not run it on its own.
//
// RULES
//   1. Never export anything that changes a REAL category (other suites run
//      at the same time on the same database).
//   2. Phones are unique per call (clock plus a counter), never hard-coded.
//   3. Never log cookies or passwords.
//
// WHERE USED
//   categories.routes.test.js, products.category.test.js,
//   storefront.category.test.js
//
// TRADEOFFS
//   + One place to change. - A tiny shared module to read before a test.
//
// HOW TO USE
//   import { asAdmin, signupTestShop } from './helpers/categoryKit.js';
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// asAdmin     = THE HEAD-OFFICE KEY: set_config('app.platform_admin','on', true)
//               is switched on only inside this one transaction, then drops.
// counter     = TWO SHOPS IN ONE SECOND still get different phone numbers.
// readShopSlug = reading the shop's sign with the shop's own key
//               (app.current_tenant), exactly how withTenant does it.
// ═══════════════════════════════════════════════════════════

import request from 'supertest';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

let counter = 0;

// Run SQL as head office. The switch lives only inside this transaction.
export async function asAdmin(sql, params = []) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.platform_admin','on',true)");
    const r = await c.query(sql, params);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

// Open a brand new shop. Returns the staff cookie and the shop id.
export async function signupTestShop(label) {
  counter += 1;
  const res = await request(app)
    .post('/v1/signup')
    .send({
      phone: `07${String(Date.now() + counter).slice(-8)}`,
      name: `${label} Tester`,
      password: 'Test1234!',
      tenant_name: `${label} ${Date.now()}-${counter}`,
    });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status}`);
  return { cookie: res.headers['set-cookie'], tenantId: res.body.tenant_id };
}

// The id of a real aisle (read through the public list, like the website does).
export async function categoryIdBySlug(slug) {
  const res = await request(app).get('/v1/categories');
  return res.body.data.find((c) => c.slug === slug).id;
}

// A shop's public address word, read with the shop's own key.
export async function readShopSlug(tenantId) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const r = await c.query('SELECT slug FROM tenants WHERE id = $1', [tenantId]);
    await c.query('COMMIT');
    return r.rows[0].slug;
  } finally {
    c.release();
  }
}
