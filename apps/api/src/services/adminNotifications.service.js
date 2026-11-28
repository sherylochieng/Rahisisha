// =============================================================================
// FILE: apps/api/src/services/adminNotifications.service.js   (Week 30 Day 3, Batch 3b-2b: admin notifications, step 1)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Head office's window onto the outbox: "how many messages are waiting, sent or
//   failed, and which ones?" Read-only. It never queues, sends, retries or edits.
//
// WHY IMPORTANT
//   Without a window, a failing sender is invisible: owners are not told and
//   nobody knows. This is how a failed WhatsApp shows up on a screen instead of
//   in a customer complaint.
//
// DANGER
//   1. Runs only inside withAdminLock, behind requirePlatformAdmin. Never call it
//      from a shop owner's route.
//   2. It deliberately does NOT return the recipient phone or the payload (the
//      payload can hold a suspension reason). It returns only `hasPhone`. If head
//      office ever needs the number, it is already on the shop's page.
//   3. last_error is shown as saved. It is a short note and never contains the
//      phone or message text, but show it only as TEXT in the screen.
//
// WHAT IT SOLVES
//   "Is the sender working? What failed and why?"
//
// SYSTEM DESIGN PRINCIPLE
//   Read model separate from the write path (notifications.service.js writes,
//   notificationSender.service.js sends, this file only reads). Keyset
//   pagination, like the shops list.
//
// RULES
//   1. status filter is queued, sent or failed (or none).
//   2. Newest first (created_at, then id). Page size 1 to 100, default 25.
//   3. Errors carry .code = 'validation'.
//
// PRACTICAL EXAMPLE
//   const page = await listNotifications(pool, { status: 'failed' });
//   const counts = await getNotificationSummary(pool);   // { queued: 2, sent: 40, failed: 1 }
//
// DECISIONS
//   - A separate summary query (three counts in one pass) so the page can show
//     numbers on its filter buttons without loading every row.
//   - The shop's name is joined in (tenants has no row level security) so the
//     screen can say "Mama Njeri Groceries", not an id.
//
// WHERE USED
//   apps/api/src/controllers/adminNotifications.controller.js
//
// TRADEOFFS
//   + Fast (indexes from migration 031), safe (no personal data).
//   - The newest-first order uses created_at, so a retried line does not jump to the top.
//
// HOW TO USE
//   import { listNotifications, getNotificationSummary } from './adminNotifications.service.js';
// =============================================================================

// PIECE BY PIECE
//   fail()                   = make an error with a short code.
//   shapeNotification()      = database row -> clean answer for the screen.
//   listNotifications()      = one page of lines, optional status filter.
//   getNotificationSummary() = the three counts.

import { withAdminLock } from './platformAdmin.service.js';
import { CURSOR_TS_SQL, decodeCursor, encodeCursor } from '../utils/keysetCursor.js';

// The statuses the filter may use (matches the database CHECK).
const STATUSES = ['queued', 'sent', 'failed'];

// Page size limits (same style as the shops list).
const LIST_DEFAULT = 25;
const LIST_MAX = 100;

// Make an error with a short code, the same style as the other services.
function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Turn a database row into the clean answer. No phone, no payload.
function shapeNotification(r) {
  return {
    id: r.id,
    shopId: r.tenant_id,
    shopName: r.shop_name,
    template: r.template,
    channel: r.channel,
    status: r.status,
    attempts: r.attempts,
    lastError: r.last_error,
    // When it will be tried next (for queued lines) or was last borrowed.
    sendAfter: r.send_after,
    sentAt: r.sent_at,
    createdAt: r.created_at,
    // Only whether there was a number, never the number.
    hasPhone: r.has_phone,
  };
}

// ---------------------------------------------------------------------------
// LIST: one page of lines, newest first. options: { status, limit, cursor }
// ---------------------------------------------------------------------------
export async function listNotifications(db, options = {}) {
  const { status, cursor } = options;

  // Status filter must be one of the three known words (or not given).
  if (status !== undefined && status !== null && status !== '' && !STATUSES.includes(status)) {
    throw fail('validation', 'Invalid status filter');
  }
  const statusFilter = status ? status : null;

  // Page size: a number between 1 and 100, default 25.
  const parsed = parseInt(options.limit, 10);
  const limit = Math.min(Math.max(Number.isNaN(parsed) ? LIST_DEFAULT : parsed, 1), LIST_MAX);

  // Bookmark from the previous page, if any.
  let ts = null;
  let id = null;
  if (cursor) {
    const c = decodeCursor(String(cursor));
    if (!c) throw fail('validation', 'Invalid cursor');
    ts = c.ts;
    id = c.id;
  }

  return withAdminLock(db, async (client) => {
    // Ask for ONE more row than the page size, to know if another page exists.
    // $1 status, $2/$3 bookmark, $4 limit.
    const { rows } = await client.query(
      `SELECT n.id, n.tenant_id, t.name AS shop_name, n.template, n.channel, n.status,
              n.attempts, n.last_error, n.send_after, n.sent_at, n.created_at,
              (n.recipient_phone IS NOT NULL) AS has_phone,
              ${CURSOR_TS_SQL('n.created_at')} AS cursor_ts
         FROM notifications n
         JOIN tenants t ON t.id = n.tenant_id
        WHERE ($1::text IS NULL OR n.status = $1)
          AND ($2::timestamptz IS NULL OR (n.created_at, n.id) < ($2::timestamptz, $3::uuid))
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT $4`,
      [statusFilter, ts, id, limit + 1]
    );
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return {
      items: page.map(shapeNotification),
      nextCursor: hasMore ? encodeCursor(last.cursor_ts, last.id) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// SUMMARY: how many lines are queued, sent and failed. One query.
// ---------------------------------------------------------------------------
export async function getNotificationSummary(db) {
  return withAdminLock(db, async (client) => {
    // COUNT(*) FILTER counts only the rows that match, in a single pass.
    // ::int turns Postgres's big numbers (which arrive as text) into plain numbers.
    const { rows } = await client.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
              COUNT(*) FILTER (WHERE status = 'sent')::int   AS sent,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
         FROM notifications`
    );
    return { queued: rows[0].queued, sent: rows[0].sent, failed: rows[0].failed };
  });
}
