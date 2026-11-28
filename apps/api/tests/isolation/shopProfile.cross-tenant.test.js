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
// ═══════════════════════════════════════════════════════════

import request from 'supertest';
import dotenv from 'dotenv';
import app from '../../src/app.js';
import { signupTestShop } from '../helpers/categoryKit.js';

dotenv.config();

let a;
let b;
const put = (shop, body) => request(app).put('/v1/shop/profile').set('Cookie', shop.cookie).send(body);
const get = (shop) => request(app).get('/v1/shop/profile').set('Cookie', shop.cookie);

beforeAll(async () => {
  a = await signupTestShop('ProfA');
  b = await signupTestShop('ProfB');
  await put(a, { town: 'Nairobi', whatsappNumber: '0711111111', listInMarketplace: true });
  await put(b, { town: 'Mombasa', whatsappNumber: '0722222222' });
});

describe('shop profile isolation (Batch 4b)', () => {
  test('1. each shop reads only its own card', async () => {
    const ra = await get(a);
    const rb = await get(b);
    expect(ra.body.data.town).toBe('Nairobi');
    expect(ra.body.data.whatsapp_number).toBe('254711111111');
    expect(rb.body.data.town).toBe('Mombasa');
    expect(rb.body.data.whatsapp_number).toBe('254722222222');
  });

  test('2. shop B saving never changes shop A (and B starts unlisted)', async () => {
    const rb = await put(b, { town: 'Kisumu' });
    expect(rb.body.data.list_in_marketplace).toBe(false);
    const ra = await get(a);
    expect(ra.body.data.town).toBe('Nairobi');
    expect(ra.body.data.list_in_marketplace).toBe(true);
  });

  test('3. a shop id in the request is refused, so another shop can not be targeted', async () => {
    const res = await put(b, { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', town: 'Hacked' });
    expect(res.status).toBe(400);
    const ra = await get(a);
    expect(ra.body.data.town).toBe('Nairobi');
  });
});
