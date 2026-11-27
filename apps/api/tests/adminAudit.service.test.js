// =============================================================================
// FILE: apps/api/tests/adminAudit.service.test.js   (Week 30 Day 3, Batch 1: admin core, step 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves that admin receipts (audit rows) are written correctly and safely:
//   the right fields, no secrets, no made-up actions, and, most important, that
//   the receipt disappears together with the change if the transaction fails.
//
// WHY IMPORTANT
//   The audit trail is only worth something if it is trustworthy. A receipt that
//   survives a failed change, or a missing receipt for a real change, would
//   make the trail useless in a dispute.
//
// DANGER
//   Uses made-up phones, random passwords and its own throw-away shop. It
//   removes everything it created. Never point it at a real database with real
//   shops that you care about (it only deletes rows it made itself).
//
// WHAT IT SOLVES
//   Confidence that adminAudit.service.js and the audit_logs table work
//   together as promised.
//
// SYSTEM DESIGN PRINCIPLE
//   Test the promise, not the code: "the receipt and the change stand or fall
//   together" is tested by really failing a transaction.
//
// RULES
//   1. Each run makes its own admin and shop with random names.
//   2. Clean up every row made (receipts first, then the shop, then the admin).
//   3. Never print passwords.
//
// PRACTICAL EXAMPLE
//   cd apps/api ; npm test -- adminAudit
//
// DECISIONS
//   - Uses the app's real pool, because the real admin code will use it.
//   - Reads the receipts back with a plain pool query (audit_logs has no row
//     level security), the way a support person would.
//
// WHERE USED
//   Part of the normal test run (and the pre-push hook).
//
// TRADEOFFS
//   + Fast: the only slow part is one bcrypt hash for the test admin.
//   - Does not test the shop actions yet (they come in the next files).
//
// HOW TO USE
//   cd apps/api ; npm test -- adminAudit
// =============================================================================

// PIECE BY PIECE (each test starts with a comment of its own, below)
//   randomPhone()    = a made-up valid Kenyan number, new for each run.
//   beforeAll        = hire a test admin and open a test shop.
//   afterAll         = remove the receipts, the shop and the admin we made.
//   receiptsFor()    = "open the receipt book and read this shop's lines".

import crypto from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { createPlatformAdmin, withAdminLock } from '../src/services/platformAdmin.service.js';
import {
  recordAdminAudit,
  ADMIN_AUDIT_ACTIONS,
} from '../src/services/adminAudit.service.js';

// A made-up valid Kenyan number: 07 + 8 digits, random each run.
const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
// A random long password, so no test ever uses a real one.
const randomPassword = () => `pw-${crypto.randomBytes(12).toString('hex')}`;

// The rows we create, so afterAll can remove them.
let adminId;
let tenantId;

// Read every receipt for our test shop, oldest first.
async function receiptsFor(id) {
  const { rows } = await pool.query(
    'SELECT * FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at, id',
    [id]
  );
  return rows;
}

// Before all tests: one test admin and one test shop.
beforeAll(async () => {
  // Hire a test admin (the real service, so the real rules apply).
  const admin = await createPlatformAdmin(pool, {
    phone: randomPhone(),
    name: 'Audit Test Admin',
    password: randomPassword(),
  });
  adminId = admin.id;
  // Open a throw-away shop. The slug is random so runs never collide.
  const slug = `audit-test-${crypto.randomBytes(6).toString('hex')}`;
  const { rows } = await pool.query(
    'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
    ['Audit Test Shop', slug]
  );
  tenantId = rows[0].id;
});

// After all tests: remove what we made (receipts first, then shop, then admin).
afterAll(async () => {
  if (tenantId) {
    await pool.query('DELETE FROM audit_logs WHERE tenant_id = $1', [tenantId]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  }
  if (adminId) {
    await withAdminLock(pool, (client) =>
      client.query('DELETE FROM platform_admins WHERE id = $1', [adminId])
    );
  }
  await pool.end();
});

describe('admin audit receipts (Week 30 Day 3, Batch 1)', () => {

  // CHECK 1. A receipt is written with every field in the right place.
  // Real life: the clerk stamps "Sheryl suspended shop X, status active ->
  // suspended" into the receipt book, with the time and the network address.
  test('1. writes a receipt with who, what, which shop, before, after and address', async () => {
    const receipt = await withAdminLock(pool, (client) =>
      recordAdminAudit(client, {
        adminId,
        tenantId,
        action: ADMIN_AUDIT_ACTIONS.SHOP_SUSPENDED,
        before: { status: 'active' },
        after: { status: 'suspended', reason: 'customers reported fake M-Pesa messages' },
        ip: '  41.90.1.1  ',
      })
    );
    // We get back a receipt number and a time.
    expect(receipt.id).toBeTruthy();
    expect(receipt.created_at).toBeInstanceOf(Date);

    // Read it back from the book.
    const rows = await receiptsFor(tenantId);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.actor_admin_id).toBe(adminId);       // who (an admin, not a shop user)
    expect(row.actor_id).toBeNull();                // no shop user involved
    expect(row.tenant_id).toBe(tenantId);           // which shop
    expect(row.action).toBe('shop.suspended');      // what
    expect(row.resource).toBe('tenants');           // what kind of thing
    expect(row.resource_id).toBe(tenantId);         // which thing
    expect(row.before).toEqual({ status: 'active' });
    expect(row.after).toEqual({
      status: 'suspended',
      reason: 'customers reported fake M-Pesa messages',
    });
    expect(row.ip_address).toBe('41.90.1.1');       // trimmed
  });

  // CHECK 2. Fields that are not on the allowed list never reach the book.
  // Real life: a bank slip shows "amount" and "date" but never your PIN, even
  // if someone tries to write it on.
  test('2. drops fields that are not on the allowed list (no secrets in the log)', async () => {
    await withAdminLock(pool, (client) =>
      recordAdminAudit(client, {
        adminId,
        tenantId,
        action: ADMIN_AUDIT_ACTIONS.SHOP_VERIFIED,
        before: null,
        after: {
          verified_at: '2026-11-27T18:40:00.000Z',
          password_hash: 'should-never-be-stored',
          phone: '254700000000',
        },
      })
    );
    const rows = await pool.query(
      `SELECT before, after, ip_address FROM audit_logs
        WHERE tenant_id = $1 AND action = 'shop.verified'`,
      [tenantId]
    );
    expect(rows.rows).toHaveLength(1);
    // Only the allowed field survived. The hash and the phone were dropped.
    expect(rows.rows[0].after).toEqual({ verified_at: '2026-11-27T18:40:00.000Z' });
    // No "before" picture was given, so it is NULL. No address was given either.
    expect(rows.rows[0].before).toBeNull();
    expect(rows.rows[0].ip_address).toBeNull();
  });

  // CHECK 3. Bad input is refused and NOTHING is written.
  // Real life: a clerk who tries to tick a box that is not on the form, or who
  // forgets the shop number, gets the form handed back.
  test('3. refuses a made-up action, bad ids and a non-object picture, and writes nothing', async () => {
    const before = (await receiptsFor(tenantId)).length;
    const good = { adminId, tenantId, action: ADMIN_AUDIT_ACTIONS.SHOP_REINSTATED };

    // Each bad call must fail with our own code (and must not touch the book).
    const bad = [
      { ...good, action: 'shop.suspnded' },          // typo, not on the list
      { ...good, action: undefined },                // no action
      { ...good, adminId: 'not-a-uuid' },            // bad admin id
      { ...good, tenantId: '123' },                  // bad shop id
      { ...good, before: 'a string' },               // picture must be an object
      { ...good, after: ['a', 'list'] },             // a list is not an object either
    ];
    for (const args of bad) {
      await expect(
        withAdminLock(pool, (client) => recordAdminAudit(client, args))
      ).rejects.toMatchObject({ code: 'bad_audit_input' });
    }
    // No connection at all is refused too.
    await expect(recordAdminAudit(null, good)).rejects.toMatchObject({ code: 'bad_audit_input' });
    // The book has exactly as many lines as before.
    expect((await receiptsFor(tenantId)).length).toBe(before);
  });

  // CHECK 4. THE BIG PROMISE: the receipt stands or falls with the change.
  // Real life: if the bank reverses a transfer, the receipt for that transfer
  // disappears too. Here we write a receipt and then make the transaction fail.
  test('4. the receipt disappears if the surrounding transaction fails', async () => {
    const before = (await receiptsFor(tenantId)).length;
    await expect(
      withAdminLock(pool, async (client) => {
        await recordAdminAudit(client, {
          adminId,
          tenantId,
          action: ADMIN_AUDIT_ACTIONS.SHOP_UNVERIFIED,
          after: { status: 'active' },
        });
        // Something else in the same unit of work goes wrong.
        throw new Error('simulated failure after the receipt was written');
      })
    ).rejects.toThrow('simulated failure');
    // The transaction was rolled back, so the receipt is gone.
    expect((await receiptsFor(tenantId)).length).toBe(before);
  });

  // CHECK 5. A very long or empty network address is handled safely.
  // Real life: a strange header cannot fill the book with junk.
  test('5. cuts a very long address at 64 characters and stores an empty one as NULL', async () => {
    await withAdminLock(pool, async (client) => {
      await recordAdminAudit(client, {
        adminId, tenantId, action: ADMIN_AUDIT_ACTIONS.SHOP_REINSTATED, ip: 'x'.repeat(500),
      });
      await recordAdminAudit(client, {
        adminId, tenantId, action: ADMIN_AUDIT_ACTIONS.SHOP_REINSTATED, ip: '   ',
      });
    });
    const { rows } = await pool.query(
      `SELECT ip_address FROM audit_logs
        WHERE tenant_id = $1 AND action = 'shop.reinstated'`,
      [tenantId]
    );
    // Both receipts were written in ONE transaction, so they share the same time
    // and their order is not guaranteed. We therefore check the pair, not the order.
    const addresses = rows.map((r) => r.ip_address);
    expect(addresses).toHaveLength(2);
    expect(addresses.filter((a) => a === null)).toHaveLength(1);       // the blank one
    expect(addresses.filter((a) => a && a.length === 64)).toHaveLength(1); // the cut one
  });
});
