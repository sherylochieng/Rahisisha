// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/storefront.category.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Batch 4a-1: the public shop window can be filtered by category
//   (?category=<slug>) and lists the aisles the shop actually uses.
//
// WHY IMPORTANT
//   This is what shoppers see. A filter that leaks another shop's
//   products, or shows an empty aisle button, breaks trust.
//
// DANGER
//   - The filter subquery could ignore RLS and show other shops.
//   - A bad word could crash the SQL instead of a clean 400.
//
// WHAT IT SOLVES
//   Proves filter, aisle list, stale-link behaviour and 400 handling.
//
// SYSTEM DESIGN PRINCIPLE
//   "Each test file builds its own world": our own shop and products,
//   checked by NAME so sample products never confuse the result.
//
// RULES
//   1. NEVER count the whole list (sample products exist).
//   2. NEVER assume the shop slug: read it back after signup.
//
// PRACTICAL EXAMPLE
//   A shopper taps "Shoes" on Mama Njeri's page and sees only shoes.
//   An old link to ?category=gone just shows an empty shelf.
//
// DECISIONS
//   - Well-shaped unknown slug = empty list (200), not an error.
//   - Draft products never create an aisle button.
//
// WHERE USED
//   npm test -- storefront.category
//
// TRADEOFFS
//   + Real DB. - One test shop left behind (reset script clears it).
//
// HOW TO USE
//   cd apps/api && npm test -- storefront.category   Expect: 6 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// 1. slug lookup = READING THE SHOP SIGN: signup gives only tenant_id,
//    so we read the slug with the shop's own tenant setting.
// 2. names of products = OUR OWN PRICE TAGS, so we find ours by name.
// 3. ?category=Bad Word = a CLERK REFUSING A GARBLED REQUEST (400).
// ═══════════════════════════════════════════════════════════

import request from 'supertest';
import dotenv from 'dotenv';
import app from '../src/app.js';
import { signupTestShop, categoryIdBySlug, readShopSlug } from './helpers/categoryKit.js';

dotenv.config();

const rand = Date.now();
let cookie;
let slug;
let shoesId;
let beautyId;

async function addProduct(extra) {
  const res = await request(app)
    .post('/v1/products')
    .set('Cookie', cookie)
    .send({ priceCents: 5000, sku: `SF-${rand}-${Math.random().toString(36).slice(2, 7)}`, status: 'active', ...extra });
  expect(res.status).toBe(201);
  return res.body.data;
}

beforeAll(async () => {
  const shop = await signupTestShop('SF Cat');
  cookie = shop.cookie;
  slug = await readShopSlug(shop.tenantId);
  shoesId = await categoryIdBySlug('shoes');
  beautyId = await categoryIdBySlug('beauty-hair');

  await addProduct({ name: `SF Sandals ${rand}`, categoryId: shoesId });
  await addProduct({ name: `SF Lotion ${rand}`, categoryId: beautyId });
  await addProduct({ name: `SF Draft Shoe ${rand}`, categoryId: shoesId, status: 'draft' });
  await addProduct({ name: `SF Loose ${rand}` });
});

const names = (res) => res.body.data.products.map((p) => p.name);

describe('storefront category filter', () => {
  test('1. no filter: all our active products appear', async () => {
    const res = await request(app).get(`/v1/storefront/${slug}?limit=48`);
    expect(res.status).toBe(200);
    expect(names(res)).toEqual(expect.arrayContaining([`SF Sandals ${rand}`, `SF Lotion ${rand}`, `SF Loose ${rand}`]));
  });

  test('2. ?category=shoes shows only active shoes', async () => {
    const res = await request(app).get(`/v1/storefront/${slug}?category=shoes&limit=48`);
    expect(res.status).toBe(200);
    const ours = names(res).filter((n) => n.includes(String(rand)));
    expect(ours).toEqual([`SF Sandals ${rand}`]);
  });

  test('3. an unused but well-shaped slug gives an empty shelf', async () => {
    const res = await request(app).get(`/v1/storefront/${slug}?category=kids-baby&limit=48`);
    expect(res.status).toBe(200);
    expect(names(res).filter((n) => n.includes(String(rand)))).toEqual([]);
  });

  test('4. a garbled slug is a clean 400', async () => {
    for (const bad of ['Bad Word', "x'--", 'UPPER', 'a'.repeat(61)]) {
      const res = await request(app).get(`/v1/storefront/${slug}`).query({ category: bad });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('validation');
    }
  });

  test('5. categories list holds only aisles with active products, in order', async () => {
    const res = await request(app).get(`/v1/storefront/${slug}`);
    const slugs = res.body.data.categories.map((c) => c.slug);
    expect(slugs).toEqual(expect.arrayContaining(['shoes', 'beauty-hair']));
    expect(slugs.indexOf('shoes')).toBeLessThan(slugs.indexOf('beauty-hair'));
    expect(slugs).not.toContain('kids-baby');
    for (const c of res.body.data.categories) expect(Object.keys(c).sort()).toEqual(['name', 'slug']);
  });

  test('6. an aisle with only a draft product gets no button', async () => {
    const kids = await categoryIdBySlug('kids-baby');
    await addProduct({ name: `SF Draft Kid ${rand}`, categoryId: kids, status: 'draft' });
    const res = await request(app).get(`/v1/storefront/${slug}`);
    expect(res.body.data.categories.map((c) => c.slug)).not.toContain('kids-baby');
  });
});
