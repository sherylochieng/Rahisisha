// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/products.category.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Batch 4a-1: a product can now be filed under ONE category.
//   This file proves create, change and clear work, and that bad
//   category ids are refused.
//
// WHY IMPORTANT
//   The shop page filter and the marketplace both group products by
//   category. A wrong id saved here means products in the wrong aisle.
//
// DANGER
//   - A typo in the CASE SQL could wipe the category on every price
//     edit (test 4 guards "not sent = keep").
//   - Accepting any uuid would point products at nothing (test 5-7).
//
// WHAT IT SOLVES
//   The three-way rule: missing = keep, id = set, null = clear.
//
// SYSTEM DESIGN PRINCIPLE
//   "Each test file builds its own world": a fresh shop, our own
//   products; we never count the shop's list (sample products exist).
//
// RULES
//   1. NEVER hard-code a phone. 2. NEVER count a whole list.
//   3. NEVER edit a test just to pass; decide if code or test is wrong.
//
// PRACTICAL EXAMPLE
//   Mama Njeri files "Sandals" under Shoes, later fixes the price (the
//   aisle stays Shoes), then removes the aisle (null).
//
// DECISIONS
//   - Unknown AND malformed ids both give 400 validation with
//     details.categoryId, so the form can show it beside the field.
//   - Tests run in order and share one product on purpose.
//
// WHERE USED
//   npm test -- products.category
//
// TRADEOFFS
//   + Real DB. - Leaves one test shop behind (reset script clears it).
//
// HOW TO USE
//   cd apps/api && npm test -- products.category   Expect: 9 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// 1. shoesId = THE AISLE NUMBER we got from the public list.
// 2. PATCH without categoryId = "CHANGE THE PRICE TAG ONLY": aisle kept.
// 3. PATCH categoryId:null = "TAKE IT OFF THE AISLE SIGN".
// 4. 400 with details = THE CLERK POINTING AT THE WRONG FIELD.
// 5. Other shop = ISOLATION: shop B cannot use our product, 404.
// ═══════════════════════════════════════════════════════════

import request from 'supertest';
import dotenv from 'dotenv';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';

dotenv.config();

const rand = Date.now();
const password = 'Test1234!';
let cookie;
let shoesId;
let beautyId;
let productId;
const hiddenSlug = `test-off-${rand}`;
let offId;

async function asAdmin(sql, params = []) {
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

const body = (extra = {}) => ({
  name: `Sandals ${rand}`,
  priceCents: 120000,
  sku: `SAN-${rand}-${Math.random().toString(36).slice(2, 6)}`,
  status: 'active',
  ...extra,
});

beforeAll(async () => {
  const s = await request(app)
    .post('/v1/signup')
    .send({ phone: `07${String(rand).slice(-8)}`, name: 'Cat Prod', password, tenant_name: `CatProd ${rand}` });
  expect(s.status).toBe(201);
  cookie = s.headers['set-cookie'];

  const list = await request(app).get('/v1/categories');
  shoesId = list.body.data.find((c) => c.slug === 'shoes').id;
  beautyId = list.body.data.find((c) => c.slug === 'beauty-hair').id;

  const off = await asAdmin(
    "INSERT INTO categories (slug, name, active) VALUES ($1, 'Off', false) RETURNING id",
    [hiddenSlug]
  );
  offId = off.rows[0].id;
});

afterAll(async () => {
  await asAdmin('DELETE FROM categories WHERE slug = $1', [hiddenSlug]);
});

describe('product category', () => {
  test('1. create without a category: category_id is null', async () => {
    const res = await request(app).post('/v1/products').set('Cookie', cookie).send(body({ name: `Plain ${rand}` }));
    expect(res.status).toBe(201);
    expect(res.body.data.category_id).toBeNull();
  });

  test('2. create with a category stores it', async () => {
    const res = await request(app).post('/v1/products').set('Cookie', cookie).send(body({ categoryId: shoesId }));
    expect(res.status).toBe(201);
    expect(res.body.data.category_id).toBe(shoesId);
    productId = res.body.data.id;
  });

  test('3. the list shows category_id', async () => {
    const res = await request(app).get('/v1/products').set('Cookie', cookie);
    const mine = res.body.data.find((p) => p.id === productId);
    expect(mine.category_id).toBe(shoesId);
  });

  test('4. PATCH without categoryId keeps the category', async () => {
    const res = await request(app).patch(`/v1/products/${productId}`).set('Cookie', cookie).send({ priceCents: 130000 });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.price_cents)).toBe(130000);
    expect(res.body.data.category_id).toBe(shoesId);
  });

  test('5. PATCH with another valid id moves it', async () => {
    const res = await request(app).patch(`/v1/products/${productId}`).set('Cookie', cookie).send({ categoryId: beautyId });
    expect(res.status).toBe(200);
    expect(res.body.data.category_id).toBe(beautyId);
  });

  test('6. unknown, switched-off and malformed ids are refused (400)', async () => {
    for (const bad of ['11111111-1111-4111-8111-111111111111', offId, 'not-a-uuid']) {
      const res = await request(app).patch(`/v1/products/${productId}`).set('Cookie', cookie).send({ categoryId: bad });
      expect(res.status).toBe(400);
    }
    const res = await request(app).post('/v1/products').set('Cookie', cookie).send(body({ categoryId: offId }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.categoryId).toBe('Unknown category');
  });

  test('7. a refused change leaves the old category in place', async () => {
    const res = await request(app).get(`/v1/products/${productId}`).set('Cookie', cookie);
    expect(res.body.data.category_id).toBe(beautyId);
  });

  test('8. PATCH categoryId:null clears it', async () => {
    const res = await request(app).patch(`/v1/products/${productId}`).set('Cookie', cookie).send({ categoryId: null });
    expect(res.status).toBe(200);
    expect(res.body.data.category_id).toBeNull();
  });

  test('9. another shop cannot change our product (404)', async () => {
    const o = await request(app)
      .post('/v1/signup')
      .send({ phone: `07${String(rand + 1).slice(-8)}`, name: 'Other', password, tenant_name: `CatOther ${rand}` });
    const res = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('Cookie', o.headers['set-cookie'])
      .send({ categoryId: shoesId });
    expect(res.status).toBe(404);
  });
});
