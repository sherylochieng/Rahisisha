// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/shopProfile.routes.test.js   (Week 30 Day 3, Batch 4b)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Proves the owner's Shop profile works end to end: reading a blank card, saving,
//   partial saves, the Kenyan phone check, the marketplace switch (off by default),
//   refusal of bad input, and what a stranger can see on the public shop page.
//
// WHY IMPORTANT
//   The marketplace will trust list_in_marketplace. If a shop could be listed
//   without saying yes, or if a private WhatsApp number leaked to the public page,
//   owners would lose trust on day one.
//
// DANGER
//   Needs the real database (migration 033 applied). Creates throw-away test shops
//   and leaves them behind; the reset script clears them.
//
// WHAT IT SOLVES
//   Catches a broken save, a missing default, a wrong phone shape, an unknown field
//   being ignored, and a public leak of the private number.
//
// SYSTEM DESIGN PRINCIPLE
//   Test the behaviour a user would see, through the real HTTP door, with a real
//   database. The tests share one shop and run in order on purpose.
//
// RULES
//   1. Never read the database directly to "prove" a save; ask the API.
//   2. A public page test must check the PRIVATE number is absent.
//
// PRACTICAL EXAMPLE
//   Mama Njeri saves town "Kitengela" and 0712 345 678. Her card shows 254712345678.
//   A stranger opening her shop page sees "Kitengela" and no number.
//
// DECISIONS
//   - Unknown fields give 400 (the form is strict), with details.
//   - The wrong phone gives details.whatsappNumber so the form can mark that box.
//
// WHERE USED
//   npm test -- shopProfile.routes
//
// TRADEOFFS
//   + Real DB. - Leaves one test shop behind.
//
// HOW TO USE
//   cd apps/api && npm test -- shopProfile.routes   Expect: 10 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// 1. no cookie            = A STRANGER AT THE BACK DOOR: refused (401).
// 2. blank card           = A NEW SHOP: everything empty, marketplace OFF.
// 3. save + read back     = WRITE THE CARD, THEN LOOK AT IT AGAIN.
// 4. partial save         = CHANGING ONE BOX LEAVES THE REST ALONE.
// 5. phone shapes         = 0712..., +254712... and 712... all become 254712345678.
// 6. bad phone / too long / unknown box = THE CLERK POINTING AT THE WRONG BOX.
// 7. clearing a box       = EMPTY TEXT BECOMES "NOTHING WRITTEN".
// 8. public page          = THE SHOP WINDOW: town and line shown, number never.
// ═══════════════════════════════════════════════════════════

import request from 'supertest';
import dotenv from 'dotenv';
import app from '../src/app.js';
import { signupTestShop, readShopSlug } from './helpers/categoryKit.js';

dotenv.config();

let cookie;
let slug;

beforeAll(async () => {
  const shop = await signupTestShop('Profile');
  cookie = shop.cookie;
  slug = await readShopSlug(shop.tenantId);
});

const put = (body) => request(app).put('/v1/shop/profile').set('Cookie', cookie).send(body);
const get = () => request(app).get('/v1/shop/profile').set('Cookie', cookie);

describe('shop profile (Batch 4b)', () => {
  test('1. no login gives 401', async () => {
    const res = await request(app).get('/v1/shop/profile');
    expect(res.status).toBe(401);
  });

  test('2. a new shop has a blank card, and is NOT listed in the marketplace', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      town: null,
      short_description: null,
      whatsapp_number: null,
      delivery_areas: null,
      list_in_marketplace: false,
    });
  });

  test('3. saving creates the card, and reading it back shows the same', async () => {
    const res = await put({
      town: 'Kitengela',
      shortDescription: 'Fresh vegetables, delivered the same day.',
      whatsappNumber: '0712 345 678',
      deliveryAreas: 'Kitengela, Athi River',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.town).toBe('Kitengela');
    expect(res.body.data.whatsapp_number).toBe('254712345678');
    expect(res.body.data.list_in_marketplace).toBe(false);
    const back = await get();
    expect(back.body.data).toEqual(res.body.data);
  });

  test('4. a partial save changes only what was sent', async () => {
    const res = await put({ deliveryAreas: 'Athi River' });
    expect(res.status).toBe(200);
    expect(res.body.data.delivery_areas).toBe('Athi River');
    // what was saved in test 3 is still there
    expect(res.body.data.short_description).toBe('Fresh vegetables, delivered the same day.')
    expect(res.body.data.town).toBe('Kitengela');
    expect(res.body.data.whatsapp_number).toBe('254712345678');
  });

  test('5. the owner can switch the marketplace on, and off again', async () => {
    const on = await put({ listInMarketplace: true });
    expect(on.body.data.list_in_marketplace).toBe(true);
    const off = await put({ listInMarketplace: false });
    expect(off.body.data.list_in_marketplace).toBe(false);
  });

  test('6. every normal way of writing a Kenyan number is stored the same way', async () => {
    for (const written of ['+254712345678', '254712345678', '712345678', '0712-345-678']) {
      const res = await put({ whatsappNumber: written });
      expect(res.status).toBe(200);
      expect(res.body.data.whatsapp_number).toBe('254712345678');
    }
  });

  test('7. a bad number, a too-long line and an unknown box are each refused with details', async () => {
    const badPhone = await put({ whatsappNumber: '12345' });
    expect(badPhone.status).toBe(400);
    expect(badPhone.body.error.details.whatsappNumber).toBeDefined();

    const tooLong = await put({ shortDescription: 'x'.repeat(161) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.details.shortDescription).toBeDefined();

    const unknown = await put({ listInMarketplce: true });
    expect(unknown.status).toBe(400);

    const notBoolean = await put({ listInMarketplace: 'yes' });
    expect(notBoolean.status).toBe(400);
    expect(notBoolean.body.error.details.listInMarketplace).toBeDefined();
  });

  test('8. empty text clears a box (saved as nothing, not as an empty string)', async () => {
    const res = await put({ town: '   ', whatsappNumber: '' });
    expect(res.status).toBe(200);
    expect(res.body.data.town).toBeNull();
    expect(res.body.data.whatsapp_number).toBeNull();
  });

  test('9. the public shop page shows town and description, and NEVER the WhatsApp number', async () => {
    await put({ town: 'Kitengela', whatsappNumber: '0712 345 678', shortDescription: 'Fresh veg.' });
    const res = await request(app).get(`/v1/storefront/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.shop.town).toBe('Kitengela');
    expect(res.body.data.shop.description).toBe('Fresh veg.');
    expect(JSON.stringify(res.body)).not.toContain('254712345678');
    expect(JSON.stringify(res.body)).not.toContain('whatsapp');
  });

  test('10. a shop with no card shows null town and description on the public page', async () => {
    const other = await signupTestShop('NoCard');
    const otherSlug = await readShopSlug(other.tenantId);
    const res = await request(app).get(`/v1/storefront/${otherSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.shop.town).toBeNull();
    expect(res.body.data.shop.description).toBeNull();
  });
});
