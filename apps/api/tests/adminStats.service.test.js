// =============================================================================
// FILE: apps/api/tests/adminStats.service.test.js   (Week 30 Day 3, Batch 3a: admin overview numbers)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the overview counts are right against the REAL database: the five numbers move by
//   exactly the amounts they should when shops of each kind are added, and deleted shops
//   never count.
//
// WHY IMPORTANT
//   A wrong number on the first screen the admin sees erodes trust in every other screen.
//
// DANGER
//   - The test database may already hold other shops, so we never assert absolute numbers.
//     We take a reading BEFORE, add our shops, take a reading AFTER, and check the DIFFERENCE.
//   - It creates and then deletes its own shops, owners and admin. It must never touch others.
//
// WHAT IT SOLVES
//   "Do the numbers add up, and do they ignore deleted shops?"
//
// SYSTEM DESIGN PRINCIPLE
//   Test against the real database (not mocks), because the counting is SQL. Test by
//   difference so the test works on any database.
//
// RULES
//   1. Add: two new active shops (one verified), one new suspended shop, one OLD active shop
//      (30 days ago), one deleted shop, and one deleted AND verified shop.
//   2. Expected change: total +4, active +3, suspended +1, verified +1, newThisWeek +3.
//
// PRACTICAL EXAMPLE
//   Before: total 7. We open 4 live shops and 2 deleted ones. After: total 11, not 13.
//
// DECISIONS
//   - Old and deleted shops are made with direct SQL, because the service has no way to
//     make a shop 30 days old or deleted. Suspend and verify use the real services.
//
// WHERE USED
//   Run by `npm test` and by GitHub CI.
//
// TRADEOFFS
//   + Real database, real rules.
//   - Needs the test database running, like the other admin tests.
//
// HOW TO USE
//   npm test -- tests/adminStats.service.test.js
// =============================================================================

import crypto from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { createPlatformAdmin, withAdminLock } from '../src/services/platformAdmin.service.js';
import { suspendShop, verifyShop } from '../src/services/adminShops.service.js';
import { getPlatformStats } from '../src/services/adminStats.service.js';

const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const randomPassword = () => `pw-${crypto.randomBytes(12).toString('hex')}`;
const tag = `st${crypto.randomBytes(4).toString('hex')}`;

let adminId;
const shopIds = [];
let before;
let after;

// Open a throw-away shop. Real life: a new trader signs up. The optional SQL pieces let us
// make an old shop or a deleted one, which the real services cannot.
async function makeShop(label, { status = 'active', daysOld = 0 } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO tenants (name, slug, status, created_at)
     VALUES ($1, $2, $3, NOW() - ($4 || ' days')::interval) RETURNING id`,
    [`${tag} ${label}`, `${tag}-${label}-${crypto.randomBytes(3).toString('hex')}`, status, String(daysOld)]
  );
  shopIds.push(rows[0].id);
  return rows[0].id;
}

beforeAll(async () => {
  const admin = await createPlatformAdmin(pool, {
    phone: randomPhone(), name: 'Stats Test Admin', password: randomPassword(),
  });
  adminId = admin.id;

  // The reading BEFORE we add anything.
  before = await getPlatformStats(pool);

  // Our shops.
  await makeShop('fresh-a');                                     // active, new
  const verifiedId = await makeShop('fresh-b');                  // active, new, then verified
  const suspendedId = await makeShop('fresh-c');                 // new, then suspended
  await makeShop('old', { daysOld: 30 });                        // active, joined a month ago
  await makeShop('gone', { status: 'deleted' });                 // deleted
  const goneVerified = await makeShop('gone-verified', { status: 'deleted' }); // deleted AND verified

  await verifyShop(pool, { adminId, tenantId: verifiedId, reason: 'checked in person for the test' });
  await suspendShop(pool, { adminId, tenantId: suspendedId, reason: 'suspended for the test' });
  // A deleted shop that still carries a verified stamp: it must NOT be counted as verified.
  await withAdminLock(pool, (c) => c.query('UPDATE tenants SET verified_at = NOW() WHERE id = $1', [goneVerified]));

  // The reading AFTER.
  after = await getPlatformStats(pool);
});

afterAll(async () => {
  if (shopIds.length) {
    await pool.query('DELETE FROM audit_logs WHERE tenant_id = ANY($1)', [shopIds]);
    await pool.query('DELETE FROM tenants WHERE id = ANY($1)', [shopIds]);
  }
  if (adminId) {
    await withAdminLock(pool, (c) => c.query('DELETE FROM platform_admins WHERE id = $1', [adminId]));
  }
  await pool.end();
});

describe('admin stats service (Week 30 Day 3, Batch 3a)', () => {

  // CHECK 1. Every number moves by exactly the right amount.
  // Real life: after the office registers six files, the tally sheet changes by the right marks.
  test('1. each number changes by exactly the right amount, and deleted shops count for nothing', () => {
    expect(after.shops.total - before.shops.total).toBe(4);        // fresh-a, fresh-b, fresh-c, old
    expect(after.shops.active - before.shops.active).toBe(3);      // fresh-a, fresh-b, old
    expect(after.shops.suspended - before.shops.suspended).toBe(1);// fresh-c
    expect(after.shops.verified - before.shops.verified).toBe(1);  // fresh-b only (deleted one ignored)
    expect(after.shops.newThisWeek - before.shops.newThisWeek).toBe(3); // the old shop is outside 7 days
  });

  // CHECK 2. The answer is only real numbers, in the agreed shape.
  // Real life: the screen can draw it directly, and no text like "12" sneaks in.
  test('2. the answer is exactly five real numbers and nothing else', () => {
    expect(Object.keys(after)).toEqual(['shops']);
    expect(Object.keys(after.shops).sort()).toEqual(['active', 'newThisWeek', 'suspended', 'total', 'verified']);
    for (const value of Object.values(after.shops)) {
      expect(typeof value).toBe('number');
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  // CHECK 3. No personal data can leak: no names, phones or ids.
  test('3. nothing about any one shop or person is in the answer', () => {
    const text = JSON.stringify(after);
    expect(text).not.toContain(tag);
    expect(text).not.toMatch(/phone|name|slug|reason|owner/i);
  });

  // CHECK 4. The numbers agree with each other.
  test('4. active plus suspended equals total', () => {
    expect(after.shops.active + after.shops.suspended).toBe(after.shops.total);
  });
});
