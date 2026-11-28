// =============================================================================
// FILE: apps/api/tests/adminNotifications.service.test.js   (Week 30 Day 3, Batch 3b-2b, step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves head office's window onto the outbox works: the list, the status
//   filter, paging, the counts, and that no phone number or message text ever
//   leaks into the answer.
//
// WHY IMPORTANT
//   This is how a failing sender becomes visible. And it is a place where a careless
//   change could leak an owner's phone or a suspension reason.
//
// DANGER
//   Makes its own throw-away shops and lines and removes them afterwards. Other
//   lines may exist in the database (your own testing), so every check looks only
//   at OUR lines (or compares counts before and after).
//
// WHAT IT SOLVES
//   Confidence in listNotifications and getNotificationSummary.
//
// SYSTEM DESIGN PRINCIPLE
//   Test by difference against a shared database, and test the privacy promise.
//
// RULES
//   1. Random names per run. 2. Our lines get created_at far in the future, so
//   they come first in a newest-first list. 3. Clean up everything.
//
// PRACTICAL EXAMPLE
//   cd apps/api ; npm test -- adminNotifications.service
//
// DECISIONS
//   created_at is set directly (year 2099) so ordering and paging are predictable
//   no matter what else is in the table.
//
// WHERE USED
//   Normal test run.
//
// TRADEOFFS
//   + Real database. - Needs migration 031.
//
// HOW TO USE
//   npm test -- adminNotifications.service
// =============================================================================

import crypto from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { withAdminLock } from '../src/services/platformAdmin.service.js';
import { enqueueNotification, NOTIFICATION_TEMPLATES as T } from '../src/services/notifications.service.js';
import { listNotifications, getNotificationSummary } from '../src/services/adminNotifications.service.js';

const tag = `an${crypto.randomBytes(4).toString('hex')}`;
const PHONE = `2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
const REASON = `secret-reason-${tag}`;
let tenantId;
const lines = {};   // name -> line id

// Put one line in the outbox, with a chosen status and a far-future created_at.
async function makeLine(name, { status = 'queued', minute, phone = PHONE, error = null } = {}) {
  return withAdminLock(pool, async (c) => {
    const row = await enqueueNotification(c, {
      tenantId,
      template: T.SHOP_SUSPENDED,
      recipientPhone: phone,
      payload: { shopName: `${tag} Fashions`, reason: REASON },
    });
    await c.query(
      `UPDATE notifications
          SET status = $2, last_error = $3,
              created_at = '2099-01-01T00:00:00Z'::timestamptz + make_interval(mins => $4)
        WHERE id = $1`,
      [row.id, status, error, minute]
    );
    lines[name] = row.id;
    return row.id;
  });
}

beforeAll(async () => {
  const { rows } = await pool.query(
    "INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id",
    [`${tag} Fashions`, `${tag}-${crypto.randomBytes(3).toString('hex')}`]
  );
  tenantId = rows[0].id;
  // Newest first will be: d (queued, no phone), c (failed), b (sent), a (queued).
  await makeLine('a', { status: 'queued', minute: 1 });
  await makeLine('b', { status: 'sent', minute: 2 });
  await makeLine('c', { status: 'failed', minute: 3, error: 'no_recipient' });
  await makeLine('d', { status: 'queued', minute: 4, phone: null });
});

afterAll(async () => {
  // Deleting the shop removes its lines too (ON DELETE CASCADE).
  if (tenantId) await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  await pool.end();
});

describe('admin notifications service (Week 30 Day 3, Batch 3b-2b)', () => {

  // CHECK 1. Newest first, with the right fields.
  test('1. lists lines newest first with the shop name and the status fields', async () => {
    const page = await listNotifications(pool, { limit: 4 });
    expect(page.items.map((i) => i.id)).toEqual([lines.d, lines.c, lines.b, lines.a]);
    const c = page.items.find((i) => i.id === lines.c);
    expect(c).toMatchObject({
      shopId: tenantId,
      shopName: `${tag} Fashions`,
      template: 'shop.suspended',
      channel: 'test',
      status: 'failed',
      attempts: 0,
      lastError: 'no_recipient',
      hasPhone: true,
    });
    expect(typeof c.createdAt).toBe('object');
    expect(Object.keys(c).sort()).toEqual([
      'attempts', 'channel', 'createdAt', 'hasPhone', 'id', 'lastError', 'sendAfter',
      'sentAt', 'shopId', 'shopName', 'status', 'template',
    ]);
  });

  // CHECK 2. Privacy: no phone number, no payload, no reason anywhere.
  test('2. never returns the phone number, the payload or the reason', async () => {
    const page = await listNotifications(pool, { limit: 4 });
    const text = JSON.stringify(page);
    expect(text).not.toContain(PHONE);
    expect(text).not.toContain(REASON);
    expect(text).not.toContain('payload');
    // The only hint about the phone is a yes or no.
    expect(page.items.find((i) => i.id === lines.d).hasPhone).toBe(false);
    expect(page.items.find((i) => i.id === lines.a).hasPhone).toBe(true);
  });

  // CHECK 3. The status filter.
  test('3. the status filter returns only that status and refuses unknown words', async () => {
    const failed = await listNotifications(pool, { status: 'failed', limit: 100 });
    expect(failed.items.length).toBeGreaterThan(0);
    expect(failed.items.every((i) => i.status === 'failed')).toBe(true);
    expect(failed.items.map((i) => i.id)).toContain(lines.c);
    const sent = await listNotifications(pool, { status: 'sent', limit: 100 });
    expect(sent.items.every((i) => i.status === 'sent')).toBe(true);
    expect(sent.items.map((i) => i.id)).toContain(lines.b);
    await expect(listNotifications(pool, { status: 'banana' })).rejects.toMatchObject({ code: 'validation' });
    // An empty status means "all".
    const all = await listNotifications(pool, { status: '', limit: 4 });
    expect(all.items).toHaveLength(4);
  });

  // CHECK 4. Paging with a bookmark: no repeats, no gaps.
  test('4. pages with a bookmark and refuses a bad bookmark', async () => {
    const first = await listNotifications(pool, { limit: 2 });
    expect(first.items.map((i) => i.id)).toEqual([lines.d, lines.c]);
    expect(first.nextCursor).toBeTruthy();
    const second = await listNotifications(pool, { limit: 2, cursor: first.nextCursor });
    expect(second.items.slice(0, 2).map((i) => i.id)).toEqual([lines.b, lines.a]);
    await expect(listNotifications(pool, { cursor: 'not-a-cursor' })).rejects.toMatchObject({ code: 'validation' });
  });

  // CHECK 5. Page size is limited.
  test('5. the page size is kept between 1 and 100', async () => {
    expect((await listNotifications(pool, { limit: 0 })).items).toHaveLength(1);
    expect((await listNotifications(pool, { limit: 5000 })).items.length).toBeLessThanOrEqual(100);
    expect((await listNotifications(pool, { limit: 'abc' })).items.length).toBeLessThanOrEqual(25);
  });

  // CHECK 6. The counts, by difference.
  test('6. the summary counts lines by status (checked by difference)', async () => {
    const before = await getNotificationSummary(pool);
    for (const value of Object.values(before)) expect(Number.isInteger(value)).toBe(true);
    await makeLine('e', { status: 'queued', minute: 5 });
    await makeLine('f', { status: 'failed', minute: 6, error: 'x' });
    await makeLine('g', { status: 'sent', minute: 7 });
    await makeLine('h', { status: 'sent', minute: 8 });
    const after = await getNotificationSummary(pool);
    expect(after.queued - before.queued).toBe(1);
    expect(after.failed - before.failed).toBe(1);
    expect(after.sent - before.sent).toBe(2);
    expect(Object.keys(after).sort()).toEqual(['failed', 'queued', 'sent']);
  });
});
