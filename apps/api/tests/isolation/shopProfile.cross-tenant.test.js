// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/isolation/shopProfile.cross-tenant.test.js   (Week 30 Day 3, Batch 4b)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Proves one shop can never read or change another shop's business card.
//
// WHY IMPORTANT
//   The card holds a private WhatsApp number. A leak between shops would be a
//   privacy failure, the worst kind for a platform that serves many owners.
//
// DANGER
//   Needs the real database. Leaves two throw-away shops behind (the reset script
//   clears them). Part of the pre-push isolation suite.
//
// WHAT IT SOLVES
//   Catches a missing tenant lock on brand_profiles or a controller that trusts an
//   id from the request.
//
// SYSTEM DESIGN PRINCIPLE
//   Defence in depth: the database lock (forced row level security) is the wall; this
//   test proves the wall is really there.
//
// RULES
//   1. Both shops save a card. Each must see only its own, and saving must never touch
//      the other's.
//   2. Sending another shop's id in the body must change nothing (the form is strict).
//
// PRACTICAL EXAMPLE
//   Shop A saves "Nairobi". Shop B saves "Mombasa". A reads Nairobi. B reads Mombasa.
//
// WHERE USED
//   npm run test:isolation
//
// HOW TO USE
//   cd apps/api && npm test -- isolation/shopProfile   Expect: 3 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// 1. A saves, B saves     = TWO SHOPS WRITE THEIR OWN CARDS.
// 2. each reads its own   = EACH DRAWER HOLDS ONLY ITS OWN CARD.
// 3. tenantId in body     = TRYING TO WRITE ON SOMEONE ELSE'S CARD: refused or ignored.
// 4. afterAll pool.end()  = LOCKING THE DOOR ON THE WAY OUT, so the test run can finish.
// ═══════════════════════════════════════════════════════════

import request from 'supertest';
import dotenv from 'dotenv';
import app from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { signupTestShop } from '../helpers/categoryKit.js';

dotenv.config();

// a and b = two different throw-away shops (two owners) that we log in as.
let a;
let b;
// Helpers: put(shop, body) saves a card as that shop; get(shop) reads it. The cookie is the login pass.
const put = (shop, body) => request(app).put('/v1/shop/profile').set('Cookie', shop.cookie).send(body);
const get = (shop) => request(app).get('/v1/shop/profile').set('Cookie', shop.cookie);

// beforeAll = runs ONCE first: create both shops and let each save its own card.
// Only A switches the marketplace on.
beforeAll(async () => {
  a = await signupTestShop('ProfA');
  b = await signupTestShop('ProfB');
  await put(a, { town: 'Nairobi', whatsappNumber: '0711111111', listInMarketplace: true });
  await put(b, { town: 'Mombasa', whatsappNumber: '0722222222' });
});

// afterAll: runs ONCE after all the checks. Closing the database connection lets the test run
// finish, so the pre-push check (and CI) never wait forever. Every isolation test does this.
afterAll(async () => {
  await pool.end();
});

describe('shop profile isolation (Batch 4b)', () => {
  // Each owner reads back ONLY their own town and number. A seeing Mombasa would be a leak.
  test('1. each shop reads only its own card', async () => {
    const ra = await get(a);
    const rb = await get(b);
    expect(ra.body.data.town).toBe('Nairobi');
    expect(ra.body.data.whatsapp_number).toBe('254711111111');
    expect(rb.body.data.town).toBe('Mombasa');
    expect(rb.body.data.whatsapp_number).toBe('254722222222');
  });

  // B saves again. A's card must stay exactly as it was (town and switch).
  test('2. shop B saving never changes shop A (and B starts unlisted)', async () => {
    const rb = await put(b, { town: 'Kisumu' });
    expect(rb.body.data.list_in_marketplace).toBe(false);
    const ra = await get(a);
    expect(ra.body.data.town).toBe('Nairobi');
    expect(ra.body.data.list_in_marketplace).toBe(true);
  });

  // B tries to send A's shop id inside the form. The strict form refuses it with 400,
  // and A's card is still untouched.
  test('3. a shop id in the request is refused, so another shop can not be targeted', async () => {
    const res = await put(b, { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', town: 'Hacked' });
    expect(res.status).toBe(400);
    const ra = await get(a);
    expect(ra.body.data.town).toBe('Nairobi');
  });
});
