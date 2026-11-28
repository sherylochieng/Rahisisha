// =============================================================================
// FILE: apps/api/tests/notificationSender.service.test.js   (Week 30 Day 3, Batch 3b-2a, step 8)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the postman works against the real database: it sends queued lines,
//   records the result, retries failures with waiting times, gives up at the
//   right moment, never double-picks a line, and never calls a missing channel
//   "sent".
//
// WHY IMPORTANT
//   This code decides whether an owner is told. A bug can silently drop a
//   message, send it twice, or mark an undelivered message as delivered.
//
// DANGER
//   Makes its own throw-away shop and lines, and removes them afterwards. Uses
//   FAKE channels, so nothing is ever sent. Always passes tenantId so it never
//   touches other shops' queued lines in the same database.
//
// WHAT IT SOLVES
//   Confidence in claim, send, record, retry, give-up and concurrency.
//
// SYSTEM DESIGN PRINCIPLE
//   Test the promises: "at least once", "never two senders on one line", "an
//   unsent message is never called sent", "waiting grows after each failure".
//
// RULES
//   1. Random shop name per run. 2. Clean up everything made. 3. Fake channels only.
//
// PRACTICAL EXAMPLE
//   cd apps/api ; npm test -- notificationSender
//
// DECISIONS
//   - Fake channels are plain objects with a send() function, injected through the
//     `channels` option.
//   - Waiting times are checked as "about N minutes from now" (a small margin), not
//     exact seconds.
//
// WHERE USED
//   Normal test run.
//
// TRADEOFFS
//   + Real database rules (SKIP LOCKED, RLS, CHECKs). - Needs migration 031.
//
// HOW TO USE
//   npm test -- notificationSender
// =============================================================================

// PIECE BY PIECE
//   queueLine()   = put one line in the outbox (like an admin action would).
//   readLine()    = look at a line (head-office view).
//   fakeChannel() = a pretend postman that records calls, or fails on demand.
//   Checks 1-10   = the promises above.

import crypto from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { createPlatformAdmin, withAdminLock } from '../src/services/platformAdmin.service.js';
import { enqueueNotification, NOTIFICATION_TEMPLATES as T } from '../src/services/notifications.service.js';
import {
  processDueNotifications, backoffMinutes, MAX_ATTEMPTS, LEASE_MINUTES,
} from '../src/services/notificationSender.service.js';

process.env.NOTIFICATIONS_QUIET = 'on';

const tag = `ns${crypto.randomBytes(4).toString('hex')}`;
const PHONE = `2547${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
let tenantId;
let adminId;

// Put one line in the outbox. `override` can change any field of the call.
async function queueLine(override = {}) {
  return withAdminLock(pool, (c) => enqueueNotification(c, {
    tenantId,
    template: T.SHOP_SUSPENDED,
    recipientPhone: PHONE,
    payload: { shopName: `${tag} Fashions`, reason: 'testing the sender' },
    ...override,
  }));
}

// Look at one line.
async function readLine(id) {
  return withAdminLock(pool, async (c) => {
    const { rows } = await c.query('SELECT * FROM notifications WHERE id = $1', [id]);
    return rows[0];
  });
}

// Change a line directly (to set up a situation).
async function setLine(id, sql, params = []) {
  return withAdminLock(pool, (c) => c.query(`UPDATE notifications SET ${sql} WHERE id = $1`, [id, ...params]));
}

// A pretend postman. `behaviour` runs inside send(); it may throw.
function fakeChannel(behaviour) {
  const calls = [];
  const channel = {
    name: 'test',
    calls,
    async send(message) {
      calls.push(message);
      if (behaviour) return behaviour(message, calls.length);
      return { providerId: 'fake' };
    },
  };
  return channel;
}

// Make the sender use the fake channel for any channel name.
const using = (channel) => () => channel;

// Run one round for our shop only.
const round = (channel, extra = {}) =>
  processDueNotifications(pool, { tenantId, channels: using(channel), ...extra });

beforeAll(async () => {
  const { rows } = await pool.query(
    "INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id",
    [`${tag} Fashions`, `${tag}-${crypto.randomBytes(3).toString('hex')}`]
  );
  tenantId = rows[0].id;
  // An admin is needed only so the shop looks like a real one; the sender itself needs none.
  const admin = await createPlatformAdmin(pool, {
    phone: `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`,
    name: 'Sender Test Admin',
    password: `pw-${crypto.randomBytes(12).toString('hex')}`,
  });
  adminId = admin.id;
});

afterAll(async () => {
  // Deleting the shop removes its lines too (ON DELETE CASCADE).
  if (tenantId) await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  if (adminId) await withAdminLock(pool, (c) => c.query('DELETE FROM platform_admins WHERE id = $1', [adminId]));
  await pool.end();
});

describe('notification sender (Week 30 Day 3, Batch 3b-2a)', () => {

  // CHECK 1. The happy path.
  // Real life: the postman collects the letter, delivers it, ticks "delivered".
  test('1. sends a queued line with the right words and marks it sent', async () => {
    const line = await queueLine();
    const channel = fakeChannel();
    const result = await round(channel);
    expect(result).toEqual({ claimed: 1, sent: 1, retried: 0, failed: 0 });
    expect(channel.calls).toHaveLength(1);
    expect(channel.calls[0].to).toBe(PHONE);
    expect(channel.calls[0].text).toContain(`"${tag} Fashions"`);
    expect(channel.calls[0].text).toContain('Reason: testing the sender');
    const row = await readLine(line.id);
    expect(row.status).toBe('sent');
    expect(row.attempts).toBe(1);
    expect(row.sent_at).not.toBeNull();
    expect(row.last_error).toBeNull();
  });

  // CHECK 2. A sent line is never picked again.
  test('2. a sent line is not picked up again', async () => {
    const channel = fakeChannel();
    const result = await round(channel);
    expect(result.claimed).toBe(0);
    expect(channel.calls).toHaveLength(0);
  });

  // CHECK 3. A failing channel: the line waits and is retried later.
  test('3. a failing channel keeps the line queued and waits before the next try', async () => {
    const line = await queueLine();
    const channel = fakeChannel(() => { throw new Error('network is down'); });
    const result = await round(channel);
    expect(result).toEqual({ claimed: 1, sent: 0, retried: 1, failed: 0 });
    const row = await readLine(line.id);
    expect(row.status).toBe('queued');
    expect(row.attempts).toBe(1);
    expect(row.last_error).toBe('network is down');
    // It must wait about backoffMinutes(1) = 1 minute.
    const waitMs = new Date(row.send_after).getTime() - Date.now();
    expect(waitMs).toBeGreaterThan(30 * 1000);
    expect(waitMs).toBeLessThan((backoffMinutes(1) + 1) * 60 * 1000);
    // And it is NOT picked again straight away.
    const again = await round(fakeChannel());
    expect(again.claimed).toBe(0);
    await setLine(line.id, "status = 'failed'");
  });

  // CHECK 4. The waiting grows, then the line is given up on.
  test('4. waiting grows after each failure and the last attempt marks it failed', async () => {
    expect([1, 2, 3, 4].map(backoffMinutes)).toEqual([1, 5, 15, 60]);
    const line = await queueLine();
    // Pretend it already failed 4 times and is due now.
    await setLine(line.id, "attempts = $2, send_after = now() - interval '1 minute'", [MAX_ATTEMPTS - 1]);
    const result = await round(fakeChannel(() => { throw new Error('still down'); }));
    expect(result).toEqual({ claimed: 1, sent: 0, retried: 0, failed: 1 });
    const row = await readLine(line.id);
    expect(row.status).toBe('failed');
    expect(row.attempts).toBe(MAX_ATTEMPTS);
    expect(row.last_error).toBe('still down');
  });

  // CHECK 5. No phone: failed at once, the channel is never called.
  test('5. a line with no phone fails at once without calling the channel', async () => {
    const line = await queueLine({ recipientPhone: null });
    const channel = fakeChannel();
    const result = await round(channel);
    expect(result).toEqual({ claimed: 1, sent: 0, retried: 0, failed: 1 });
    expect(channel.calls).toHaveLength(0);
    const row = await readLine(line.id);
    expect(row.status).toBe('failed');
    expect(row.last_error).toBe('no_recipient');
  });

  // CHECK 6. A permanent error is not retried.
  test('6. a permanent error fails the line on the first attempt', async () => {
    const line = await queueLine();
    const channel = fakeChannel(() => {
      const err = new Error('number is not on WhatsApp');
      err.permanent = true;
      throw err;
    });
    const result = await round(channel);
    expect(result.failed).toBe(1);
    const row = await readLine(line.id);
    expect(row.status).toBe('failed');
    expect(row.attempts).toBe(1);
  });

  // CHECK 7. A channel we have no code for is FAILED, never sent.
  // Real life: a letter addressed "by pigeon" when we have no pigeons.
  test('7. a line for a channel with no code fails and is never marked sent', async () => {
    const line = await queueLine({ channel: 'whatsapp' });
    // Real registry (no `channels` override): whatsapp is not built yet.
    const result = await processDueNotifications(pool, { tenantId });
    expect(result).toEqual({ claimed: 1, sent: 0, retried: 0, failed: 1 });
    const row = await readLine(line.id);
    expect(row.status).toBe('failed');
    expect(row.last_error).toBe('channel_unavailable');
    expect(row.sent_at).toBeNull();
  });

  // CHECK 8. The real test channel works through the real registry.
  test('8. the built-in test channel marks a line sent', async () => {
    const line = await queueLine({ template: T.SHOP_VERIFIED, payload: { shopName: `${tag} Fashions` } });
    const result = await processDueNotifications(pool, { tenantId });
    expect(result).toEqual({ claimed: 1, sent: 1, retried: 0, failed: 0 });
    expect((await readLine(line.id)).status).toBe('sent');
  });

  // CHECK 9. While a line is being sent, it is on loan, and two senders never share it.
  test('9. a picked-up line is on loan and two senders never take the same line', async () => {
    const line = await queueLine();
    let seenSendAfter;
    const slow = fakeChannel(async () => {
      // Inside send(): the claim is already committed. Look at the loan.
      seenSendAfter = (await readLine(line.id)).send_after;
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { providerId: 'slow' };
    });
    const other = fakeChannel();
    // Two senders start together.
    const [a, b] = await Promise.all([round(slow), round(other)]);
    // Exactly one of them got the line.
    expect(a.claimed + b.claimed).toBe(1);
    expect(slow.calls.length + other.calls.length).toBe(1);
    // The loan was about LEASE_MINUTES long while it was being sent.
    if (slow.calls.length === 1) {
      const loanMs = new Date(seenSendAfter).getTime() - Date.now();
      expect(loanMs).toBeGreaterThan((LEASE_MINUTES - 1) * 60 * 1000);
    }
    expect((await readLine(line.id)).status).toBe('sent');
  });

  // CHECK 10. The batch size is respected.
  test('10. only batchSize lines are taken in one round', async () => {
    await queueLine(); await queueLine(); await queueLine();
    const first = await round(fakeChannel(), { batchSize: 2 });
    expect(first.claimed).toBe(2);
    const second = await round(fakeChannel(), { batchSize: 2 });
    expect(second.claimed).toBe(1);
  });
});
