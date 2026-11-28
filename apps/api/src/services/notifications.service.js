// =============================================================================
// FILE: apps/api/src/services/notifications.service.js   (Week 30 Day 3, Batch 3b-1: the outbox, step 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   One small door for "queue a message". Any part of the system that wants to
//   tell someone something (the admin actions today, order updates tomorrow)
//   calls enqueueNotification(). It WRITES A ROW in the notifications table
//   (migration 031). It sends nothing. A worker (next batch) sends later.
//
// WHY IMPORTANT
//   The row is written on the CALLER'S transaction. So "suspend the shop",
//   "write the receipt" and "queue the owner's message" all succeed together or
//   all roll back together. Like the clerk who writes the letter, stamps the
//   register and drops it in the tray in one go: no register entry without a
//   letter, no letter without a register entry.
//
// DANGER
//   1. It needs the caller's client already inside withAdminLock (head office
//      writes only). Called on the plain pool, the database refuses the insert.
//   2. It NEVER sends anything and NEVER talks to Meta or an SMS provider. Keep
//      it that way: network calls inside a transaction would hold the shop's row
//      locked while waiting for a slow internet.
//   3. recipient_phone and payload are personal data. Do not log them. Use
//      maskPhone() if you must mention a number.
//   4. Wording does NOT live here. Templates are names; the words are added by
//      the channel when it sends (next batch).
//
// WHAT IT SOLVES
//   "Remember to tell this person, reliably" without slowing or breaking the
//   action that caused it.
//
// SYSTEM DESIGN PRINCIPLE
//   Transactional outbox + separation of concerns: WHAT happened (template +
//   payload) is separate from HOW it is delivered (channel). Adding WhatsApp or
//   SMS later changes the worker, not the callers.
//
// RULES
//   1. template: a short name like 'shop.suspended' (1 to 80 characters).
//   2. channel: test (default), whatsapp or sms.
//   3. payload: a plain object, at most 2000 characters once written as JSON.
//   4. recipientPhone may be empty: the row is still written (status queued) so
//      head office can see there was nobody to tell.
//   5. Errors carry .code = 'validation'.
//
// PRACTICAL EXAMPLE
//   Inside suspendShop, after the receipt:
//     await enqueueNotification(client, {
//       tenantId, template: NOTIFICATION_TEMPLATES.SHOP_SUSPENDED,
//       recipientPhone: shop.owner?.phone,
//       payload: { shopName: shop.name, reason }, auditLogId: receipt.id,
//     });
//
// DECISIONS
//   - Takes a CLIENT (not the pool): the caller owns the transaction.
//   - DEFAULT_CHANNEL is 'test' until the real channels exist. Changing it is a
//     one-line change in one place (DRY).
//   - Payload size is capped here AND the template names are a fixed list, so a
//     bug cannot fill the table with huge or random rows.
//
// WHERE USED
//   apps/api/src/services/adminShops.service.js (four admin actions).
//
// TRADEOFFS
//   + Atomic and simple. - Nothing is delivered until the worker exists.
//
// HOW TO USE
//   import { enqueueNotification, NOTIFICATION_TEMPLATES } from './notifications.service.js';
// =============================================================================

// PIECE BY PIECE
//   NOTIFICATION_TEMPLATES = the fixed list of message names we know.
//   CHANNELS / DEFAULT_CHANNEL = the ways a message can travel, and today's choice.
//   fail()                 = make an error with a short code.
//   maskPhone()            = hide the middle of a number for logs.
//   enqueueNotification()  = check the input, insert the row, return it.

// The messages the platform can queue. A name here = one wording in the channel later.
export const NOTIFICATION_TEMPLATES = Object.freeze({
  SHOP_SUSPENDED: 'shop.suspended',
  SHOP_REINSTATED: 'shop.reinstated',
  SHOP_VERIFIED: 'shop.verified',
  SHOP_UNVERIFIED: 'shop.unverified',
});

// The ways a message can travel (matches the database CHECK in migration 031).
export const CHANNELS = Object.freeze(['test', 'whatsapp', 'sms']);

// Today everything goes to the 'test' channel (sends nothing real).
// Real life: the dress rehearsal before the real show.
export const DEFAULT_CHANNEL = 'test';

// A UUID, like 5bc6d791-ad88-41ad-93c2-4663c1d0507f.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Biggest payload we accept, in characters of JSON.
const PAYLOAD_MAX = 2000;

// Make an error with a short code, the same style as the other services.
function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Hide the middle of a phone number: 254712345678 -> 2547*****678.
// Use this whenever a number must appear in a log line.
export function maskPhone(phone) {
  if (typeof phone !== 'string' || phone.length < 8) return '****';
  return `${phone.slice(0, 4)}${'*'.repeat(phone.length - 7)}${phone.slice(-3)}`;
}

// ---------------------------------------------------------------------------
// ENQUEUE: write one line in the outbox, on the caller's transaction.
// input: { tenantId, template, recipientPhone, payload, channel, auditLogId }
// returns: the new row's { id, status, channel, template, recipient_phone }
// ---------------------------------------------------------------------------
export async function enqueueNotification(client, input = {}) {
  const {
    tenantId,
    template,
    recipientPhone = null,
    payload = {},
    channel = DEFAULT_CHANNEL,
    auditLogId = null,
  } = input;

  // The shop id must look real before any SQL runs.
  if (typeof tenantId !== 'string' || !UUID_RE.test(tenantId)) {
    throw fail('validation', 'Invalid shop id');
  }
  // The template must be one we know (so a typo cannot create a message nobody can word).
  if (!Object.values(NOTIFICATION_TEMPLATES).includes(template)) {
    throw fail('validation', 'Unknown notification template');
  }
  // The channel must be one we know.
  if (!CHANNELS.includes(channel)) {
    throw fail('validation', 'Unknown notification channel');
  }
  // The payload must be a plain object (not a list, not text, not null).
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw fail('validation', 'Payload must be an object');
  }
  const payloadJson = JSON.stringify(payload);
  if (payloadJson.length > PAYLOAD_MAX) {
    throw fail('validation', 'Payload is too large');
  }
  // A missing or blank phone is stored as NULL ("nobody to tell").
  const phone = typeof recipientPhone === 'string' && recipientPhone.trim() !== ''
    ? recipientPhone.trim()
    : null;
  // The receipt id, if given, must also look real.
  if (auditLogId !== null && (typeof auditLogId !== 'string' || !UUID_RE.test(auditLogId))) {
    throw fail('validation', 'Invalid receipt id');
  }

  // Insert on the CALLER'S connection, so it joins the caller's transaction.
  const { rows } = await client.query(
    `INSERT INTO notifications
       (tenant_id, channel, template, recipient_phone, payload, audit_log_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING id, tenant_id, channel, template, recipient_phone, payload, status, audit_log_id`,
    [tenantId, channel, template, phone, payloadJson, auditLogId]
  );
  return rows[0];
}
