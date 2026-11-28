// =============================================================================
// FILE: apps/api/src/services/notificationSender.service.js   (Week 30 Day 3, Batch 3b-2a: the sender, step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The POSTMAN. It takes queued lines out of the notifications outbox, writes the
//   words, hands each one to its channel, and records what happened (sent, retry
//   later, or failed for good).
//
// WHY IMPORTANT
//   Without it the outbox is a tray nobody empties. With it, an owner is told
//   about a suspension even if the network was down at the moment of the action.
//
// DANGER
//   1. SENDING HAPPENS OUTSIDE ANY DATABASE TRANSACTION. A slow WhatsApp call must
//      never hold rows locked. Pick-up and result-writing are two short
//      transactions with the send between them.
//   2. A line is "borrowed" for 5 minutes when picked up (send_after is pushed
//      forward). If the server dies mid-send, the line comes back by itself.
//      The price: after a crash a message could be sent twice. Real channels
//      should send an idempotency key later.
//   3. A line whose channel has no working code is FAILED, never marked sent.
//   4. Never log the message text or the full phone number.
//   5. A line marked 'sent' with channel 'test' was NOT delivered to a human.
//
// WHAT IT SOLVES
//   "Send what is waiting, retry what failed, never lose or double-pick a line."
//
// SYSTEM DESIGN PRINCIPLE
//   Transactional outbox consumer: claim (FOR UPDATE SKIP LOCKED) -> do the slow
//   work outside the transaction -> record the result. Retries with backoff.
//   At-least-once delivery.
//
// RULES
//   1. Only lines with status 'queued' and send_after <= now are picked.
//   2. Each pick-up counts as one attempt.
//   3. Failure waits 1, 5, 15, then 60 minutes. After 5 attempts the line is
//      'failed'.
//   4. A permanent error (err.permanent) or a missing phone fails the line at once.
//   5. Two senders at the same moment never take the same line (SKIP LOCKED).
//
// PRACTICAL EXAMPLE
//   const result = await processDueNotifications(pool);
//   // { claimed: 3, sent: 2, retried: 1, failed: 0 }
//
// DECISIONS
//   - The 5-minute loan ("lease") is stored in send_after, so no new column is needed.
//   - last_error keeps only a short reason (max 500 characters), never the phone
//     or the text.
//   - `channels` and `tenantId` options exist so tests can plug in fake channels
//     and look at one shop only. `tenantId` can also power a "retry this shop's
//     messages now" button later.
//
// WHERE USED
//   apps/api/src/jobs/notificationLoop.js (every few seconds)
//
// TRADEOFFS
//   + Simple, restart-safe, no extra servers. - Polling the database every few
//     seconds keeps a sleeping Neon database awake while the API is awake.
//
// HOW TO USE
//   import { processDueNotifications } from './notificationSender.service.js';
//   await processDueNotifications(pool, { batchSize: 10 });
// =============================================================================

// PIECE BY PIECE
//   constants         = the rules in numbers (attempts, waiting times, loan time).
//   backoffMinutes()  = how long to wait after failure number N.
//   shortError()      = turn any error into a short safe note.
//   claimDue()        = TRANSACTION 1: write a shortlist (CTE), then borrow exactly those lines.
//   deliverOne()      = OUTSIDE a transaction: words + channel.send, never throws.
//   recordResult()    = TRANSACTION 2: write sent / retry / failed.
//   processDueNotifications() = run the three phases for one batch.

import { withAdminLock } from './platformAdmin.service.js';
import { renderMessage } from './notificationMessages.js';
import { getChannel } from '../channels/index.js';

// After 5 picked-up attempts, a failing line is given up on.
export const MAX_ATTEMPTS = 5;
// Wait after failed attempt 1, 2, 3, 4 (in minutes). Attempt 5 gives up.
const BACKOFF_MINUTES = [1, 5, 15, 60];
// How long a picked-up line is "on loan" to one sender (minutes).
export const LEASE_MINUTES = 5;
// Default and largest batch.
const BATCH_DEFAULT = 10;
const BATCH_MAX = 50;

// A UUID shape, used to validate the optional tenantId filter.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// How long to wait after failed attempt number `attempts` (1-based).
export function backoffMinutes(attempts) {
  return BACKOFF_MINUTES[Math.min(Math.max(attempts, 1), BACKOFF_MINUTES.length) - 1];
}

// Turn any error into a short note for last_error: no phone, no message text.
function shortError(err) {
  const raw = err && err.message ? String(err.message) : 'unknown error';
  return raw.replace(/[\u0000-\u001F\u007F]+/g, ' ').slice(0, 300);
}

// ---------------------------------------------------------------------------
// TRANSACTION 1: pick up due lines and borrow them for LEASE_MINUTES.
// FOR UPDATE SKIP LOCKED = "take only lines nobody else is holding right now".
// ---------------------------------------------------------------------------
async function claimDue(db, { batchSize, tenantId }) {
  return withAdminLock(db, async (client) => {
    // WITH picked AS MATERIALIZED = "write the shortlist down first, then work only
    // from that list". Without MATERIALIZED, Postgres may re-run the shortlist
    // while updating and take MORE lines than the limit (a known trap; test 10
    // caught it).
    const { rows } = await client.query(
      `WITH picked AS MATERIALIZED (
         SELECT id FROM notifications
          WHERE status = 'queued'
            AND send_after <= now()
            AND ($3::uuid IS NULL OR tenant_id = $3::uuid)
          ORDER BY send_after, id
          LIMIT $1
          FOR UPDATE SKIP LOCKED)
       UPDATE notifications n
          SET attempts = n.attempts + 1,
              send_after = now() + make_interval(mins => $2),
              updated_at = now()
         FROM picked
        WHERE n.id = picked.id
        RETURNING n.id, n.channel, n.template, n.recipient_phone, n.payload, n.attempts`,
      [batchSize, LEASE_MINUTES, tenantId]
    );
    return rows;
  });
}

// ---------------------------------------------------------------------------
// OUTSIDE ANY TRANSACTION: write the words and hand the line to its channel.
// Never throws. Returns { ok: true } or { ok: false, permanent, error }.
// ---------------------------------------------------------------------------
async function deliverOne(line, channels) {
  try {
    // Nobody to tell: no retry can fix that.
    if (!line.recipient_phone) {
      return { ok: false, permanent: true, error: 'no_recipient' };
    }
    // Find the channel's code. None (e.g. whatsapp not built yet) = failed, never "sent".
    const channel = channels(line.channel);
    if (!channel) {
      return { ok: false, permanent: true, error: 'channel_unavailable' };
    }
    // The words.
    const text = renderMessage(line.template, line.payload);
    // The slow part (network, in real channels).
    await channel.send({ to: line.recipient_phone, text });
    return { ok: true };
  } catch (err) {
    return { ok: false, permanent: err && err.permanent === true, error: shortError(err) };
  }
}

// ---------------------------------------------------------------------------
// TRANSACTION 2: write what happened for each line of the batch.
// ---------------------------------------------------------------------------
async function recordResult(client, line, outcome) {
  if (outcome.ok) {
    await client.query(
      `UPDATE notifications
          SET status = 'sent', sent_at = now(), last_error = NULL, updated_at = now()
        WHERE id = $1`,
      [line.id]
    );
    return 'sent';
  }
  // Give up now (permanent error) or after the last allowed attempt.
  if (outcome.permanent || line.attempts >= MAX_ATTEMPTS) {
    await client.query(
      `UPDATE notifications
          SET status = 'failed', last_error = $2, updated_at = now()
        WHERE id = $1`,
      [line.id, outcome.error]
    );
    return 'failed';
  }
  // Otherwise: stay queued and try again after the waiting time.
  await client.query(
    `UPDATE notifications
        SET last_error = $2, send_after = now() + make_interval(mins => $3), updated_at = now()
      WHERE id = $1`,
    [line.id, outcome.error, backoffMinutes(line.attempts)]
  );
  return 'retried';
}

// ---------------------------------------------------------------------------
// ONE ROUND: pick up, deliver, record. Returns the counts.
// options: { batchSize, tenantId, channels } (channels = function name -> channel)
// ---------------------------------------------------------------------------
export async function processDueNotifications(db, options = {}) {
  const parsed = parseInt(options.batchSize, 10);
  const batchSize = Math.min(Math.max(Number.isNaN(parsed) ? BATCH_DEFAULT : parsed, 1), BATCH_MAX);
  // Optional: look at one shop only.
  const tenantId = options.tenantId && UUID_RE.test(options.tenantId) ? options.tenantId : null;
  const channels = typeof options.channels === 'function' ? options.channels : getChannel;

  // 1. Pick up (short transaction).
  const lines = await claimDue(db, { batchSize, tenantId });
  const result = { claimed: lines.length, sent: 0, retried: 0, failed: 0 };
  if (lines.length === 0) return result;

  // 2. Deliver each line OUTSIDE any transaction, one after another.
  const outcomes = [];
  for (const line of lines) {
    outcomes.push(await deliverOne(line, channels));
  }

  // 3. Record every result in one short transaction.
  await withAdminLock(db, async (client) => {
    for (let i = 0; i < lines.length; i += 1) {
      const kind = await recordResult(client, lines[i], outcomes[i]);
      result[kind] += 1;
    }
  });
  return result;
}
