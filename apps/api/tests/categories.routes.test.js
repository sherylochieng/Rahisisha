// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/categories.routes.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Batch 4a-1 added the head-office list of aisles (categories).
//   This file proves the public list works and that a shop cannot
//   change the list.
//
// WHY IMPORTANT
//   Every product form, shop page filter and (later) the marketplace
//   read this list. If it breaks, owners cannot file products.
//
// DANGER (what breaks without it)
//   - A route mounted behind login would hide the list from shoppers.
//   - A weakened RLS policy would let any shop add or rename aisles.
//
// WHAT IT SOLVES
//   Proves the doors (anyone can read) AND the lock (only head
//   office writes), in one short file.
//
// SYSTEM DESIGN PRINCIPLE
//   "Each test file builds its own world." We add our own hidden test
//   category with a random slug and remove it again, so we never
//   touch the 10 real aisles other test files may be reading.
//
// RULES
//   1. NEVER switch off a real category here (other suites run in
//      parallel on the same database).
//   2. NEVER leave the test category behind: afterAll removes it.
//   3. NEVER log cookies or passwords.
//
// PRACTICAL EXAMPLE
//   A shopper opens the shop page without logging in. The page asks
//   GET /v1/categories and gets "Shoes", "Beauty and hair", ... A
//   shop owner tries to INSERT "My own aisle" and the database says no.
//
// DECISIONS
//   - Read tests send NO cookie on purpose (the list is public).
//   - The write test uses a transaction pinned to a shop with
//     set_config('app.current_tenant', ...), exactly as withTenant does.
//
// WHERE USED
//   npm test -- categories.routes   (and CI on every push)
//
// TRADEOFFS
//   + Real database, real RLS.
//   - Needs migration 032 applied (reset script does it).
//
// HOW TO USE
//   cd apps/api
//   npm test -- categories.routes      Expect: 6 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// 1. hiddenSlug = a SWITCHED-OFF AISLE we invent. Head office would
//    do this with admin power, so we use set_config('app.platform_admin')
//    inside a transaction, the same key the admin API uses.
// 2. No .set('Cookie') = A STRANGER WALKING IN. Public means a stranger
//    gets the list too.
// 3. Cache-Control = A NOTICE ON THE DOOR "list valid for 5 minutes",
//    so browsers do not ask again on every click.
// 4. The INSERT as a shop = A CUSTOMER TRYING TO WRITE ON THE SIGNBOARD.
//    RLS has only the read policy for shops, so it throws.
// ═══════════════════════════════════════════════════════════

import request from 'supertest';
import dotenv from 'dotenv';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { asAdmin, signupTestShop } from './helpers/categoryKit.js';

dotenv.config();

const rand = Date.now();
const hiddenSlug = `test-hidden-${rand}`;

let tenantId;

beforeAll(async () => {
  ({ tenantId } = await signupTestShop('Cat Shop'));

  await asAdmin(
    "INSERT INTO categories (slug, name, sort_order, active) VALUES ($1, 'Hidden test', 500, false)",
    [hiddenSlug]
  );
});

afterAll(async () => {
  await asAdmin('DELETE FROM categories WHERE slug = $1', [hiddenSlug]);
});

describe('GET /v1/categories (public)', () => {
  test('1. a stranger (no cookie) gets the list', async () => {
    const res = await request(app).get('/v1/categories');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(10);
  });

  test('2. each row has only id, slug and name', async () => {
    const res = await request(app).get('/v1/categories');
    for (const c of res.body.data) {
      expect(Object.keys(c).sort()).toEqual(['id', 'name', 'slug']);
    }
  });

  test('3. ordered by head office order, "Other" last', async () => {
    const res = await request(app).get('/v1/categories');
    const slugs = res.body.data.map((c) => c.slug);
    expect(slugs[0]).toBe('womens-fashion');
    expect(slugs.indexOf('other')).toBeGreaterThan(slugs.indexOf('home-kitchen'));
  });

  test('4. a switched-off category is hidden', async () => {
    const res = await request(app).get('/v1/categories');
    expect(res.body.data.map((c) => c.slug)).not.toContain(hiddenSlug);
  });

  test('5. the answer may be cached for a few minutes', async () => {
    const res = await request(app).get('/v1/categories');
    expect(res.headers['cache-control']).toMatch(/max-age=300/);
  });
});

describe('categories are write-locked for shops', () => {
  test('6. a shop cannot insert a category (RLS)', async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      await expect(
        c.query("INSERT INTO categories (slug, name) VALUES ($1, 'Shop made')", [`shop-${rand}`])
      ).rejects.toThrow();
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  });
});
