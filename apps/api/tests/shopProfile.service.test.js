// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/shopProfile.service.test.js   (Week 30 Day 3, Batch 4b)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Fast checks of the profile service with a pretend database (no real database
//   needed): a blank card for a shop with no row, the merge rule on save, and that the
//   public card never carries the WhatsApp number.
//
// WHY IMPORTANT
//   These run in milliseconds and pin down the rules that the route tests rely on.
//
// DANGER
//   The pretend database only answers what these tests ask. If the SQL in the service
//   changes shape, update the pretend answers too.
//
// WHAT IT SOLVES
//   Catches a broken merge (a save wiping other boxes) or a leak in readPublicCard.
//
// SYSTEM DESIGN PRINCIPLE
//   Unit tests for rules, route tests for wiring.
//
// RULES
//   1. No real database here.
//   2. One rule per test.
//
// PRACTICAL EXAMPLE
//   A shop with no row: readProfile gives a blank card with the marketplace OFF.
//
// WHERE USED
//   npm test -- shopProfile.service
//
// HOW TO USE
//   cd apps/api && npm test -- shopProfile.service   Expect: 4 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// fakeDb(rows)  = A PRETEND DRAWER that always answers with the rows we hand it and
//                 remembers the last question and answers it was given.
// ═══════════════════════════════════════════════════════════

import { jest } from '@jest/globals';
import { readProfile, saveProfile, readPublicCard } from '../src/services/shopProfile.service.js';

function fakeDb(rows) {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      return { rows };
    }),
  };
}

describe('shopProfile.service (Batch 4b)', () => {
  test('1. no row means a blank card, marketplace OFF', async () => {
    const card = await readProfile(fakeDb([]));
    expect(card.town).toBeNull();
    expect(card.list_in_marketplace).toBe(false);
  });

  test('2. saveProfile keeps the boxes that were not sent', async () => {
    const stored = {
      town: 'Kitengela', short_description: 'Hi', whatsapp_number: '254712345678',
      delivery_areas: null, list_in_marketplace: true,
    };
    const db = fakeDb([stored]);
    await saveProfile(db, 'tenant-1', { delivery_areas: 'Athi River' });
    const write = db.calls[db.calls.length - 1];
    // params: tenantId, town, description, whatsapp, areas, listed
    expect(write.params).toEqual(['tenant-1', 'Kitengela', 'Hi', '254712345678', 'Athi River', true]);
  });

  test('3. saveProfile only ever lists a shop when true was sent', async () => {
    const db = fakeDb([{ town: null, short_description: null, whatsapp_number: null,
      delivery_areas: null, list_in_marketplace: false }]);
    await saveProfile(db, 'tenant-1', { list_in_marketplace: 'true' });
    const write = db.calls[db.calls.length - 1];
    expect(write.params[5]).toBe(false);
  });

  test('4. readPublicCard returns town and description only', async () => {
    const card = await readPublicCard(fakeDb([{ town: 'Kitengela', short_description: 'Hi' }]));
    expect(card).toEqual({ town: 'Kitengela', description: 'Hi' });
    expect(Object.keys(card)).not.toContain('whatsapp_number');
  });
});
