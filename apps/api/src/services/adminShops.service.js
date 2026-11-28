// =============================================================================
// FILE: apps/api/src/services/adminShops.service.js   (Week 30 Day 3, Batch 1: admin core, step 3)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The platform admin's powers over shops live here: LIST the shops, OPEN one
//   shop, SUSPEND it, REINSTATE it, VERIFY it and UN-VERIFY it. Every power that
//   changes something needs a written reason, runs in ONE transaction together
//   with its receipt (adminAudit.service.js), and is checked against the shop's
//   current state first.
//
// WHY IMPORTANT
//   This is head office's remote control. A bug here can close an honest
//   trader's shop, or leave a cheating shop open. So every rule is strict and
//   every change leaves a trace that says who, when and why.
//
// DANGER
//   1. Nothing here decides WHO may act. The route's admin guard
//      (requirePlatformAdmin) does that BEFORE this code runs. Never call these
//      functions from a shop owner's route.
//   2. The admin lock (app.platform_admin = 'on') is opened only by withAdminLock,
//      inside a transaction. Do not run these queries on the plain pool.
//   3. The admin must NEVER read customer, order, payment or wallet data. This
//      file reads only: tenants, the owner's name and phone, and audit receipts.
//   4. The reason is saved word for word. Show it only as TEXT in the screen
//      (never as HTML), because an admin or an attacker could type markup in it.
//   5. Suspending marks the shop. It does not by itself log the owner out or
//      stop USSD and WhatsApp. The doors that obey the mark are the next steps
//      of this batch.
//
// WHAT IT SOLVES
//   "Show me all shops, find Wanjiku's, close it with a reason, and keep proof."
//
// SYSTEM DESIGN PRINCIPLE
//   Service layer: the rules live here, not in the route or the controller, so
//   they can be tested without a web server.
//   Atomicity: shop change + receipt = one transaction.
//   Pessimistic locking: SELECT ... FOR UPDATE stops two admins changing the
//   same shop at the same moment.
//   Keyset pagination: bookmarks, not page numbers, so the list stays fast and
//   stable with 100,000 shops.
//
// RULES
//   1. Reason is required for suspend, reinstate, verify and un-verify:
//      5 to 500 characters (the database also refuses more than 500).
//   2. suspend    only when status is 'active'.
//   3. reinstate  only when status is 'suspended'.
//   4. verify     only when the shop is not deleted and not already verified.
//   5. unverify   only when the shop is verified (and not deleted).
//   6. A deleted shop can never be changed.
//   7. Errors carry a .code: validation, shop_not_found, shop_deleted,
//      already_suspended, not_suspended, already_verified, not_verified.
//   8. (Batch 3b-1) Each of the four actions also QUEUES a message for the
//      owner in the notifications outbox, on the SAME transaction. Nothing is
//      sent here. Only the suspend message carries the admin's reason.
//
// PRACTICAL EXAMPLE
//   Customers report fake M-Pesa messages from "Wanjiku Fashions".
//   suspendShop(pool, { adminId, tenantId, reason: 'customers reported fake
//   M-Pesa messages', ip }) closes it and writes the receipt. When Wanjiku proves
//   she was hacked and fixed it, reinstateShop(...) opens it again, with its own
//   reason and its own receipt.
//
// DECISIONS
//   - Statuses reuse the existing tenants.status values (active, suspended,
//     deleted). resolveShopBySlug already shows only 'active' shops, so the
//     storefront closes the moment we set 'suspended'.
//   - The three suspended_* columns (migration 028) are filled on suspend and
//     CLEARED on reinstate. The history stays in the audit receipts.
//   - The list hides 'deleted' shops unless you ask for status=deleted.
//   - The owner's phone is shown to the admin (support must be able to call
//     the owner). The owner's password hash is never selected.
//   - Reason length is counted in real characters (Array.from), the same way
//     Postgres counts them, so an emoji cannot sneak past the 500 limit.
//   - (Batch 3b-1) The owner's message is queued, never sent, inside the action.
//     A shop with no owner row still gets a queued line with an empty phone, so
//     the action itself never fails because nobody can be told.
//   - Only the SUSPEND message includes the reason (the owner must know why the
//     shop closed). Reinstate, verify and un-verify reasons are internal notes
//     for head office and stay in the receipt only.
//
// WHERE USED
//   apps/api/src/controllers/adminShops.controller.js (next file).
//
// TRADEOFFS
//   + All rules in one place and tested against the real database.
//   - Locking the shop row means two admin actions on the SAME shop wait for
//     each other. That is exactly what we want. Different shops never wait.
//
// HOW TO USE
//   import { withAdminLock } from './platformAdmin.service.js' is handled inside;
//   callers just pass the pool:
//     const page = await listShops(pool, { status: 'active', q: 'wanjiku' });
//     await suspendShop(pool, { adminId: req.admin.id, tenantId, reason, ip: req.ip });
// =============================================================================

// PIECE BY PIECE
//   fail()            = make an error with a short code the caller can read.
//   cleanReason()     = check the written reason: present, 5-500 real characters,
//                       no hidden control characters.
//   checkId()         = check an id looks like a real id before any SQL runs.
//   SHOP_COLUMNS_SQL  = the one list of fields we show for a shop (and the owner).
//   readShop()        = fetch ONE shop in that shape.
//   shapeShop()       = turn a database row into the clean answer for the screen.
//   listShops()       = the register of all shops, a page at a time, with search.
//   getShop()         = one shop's file, with its latest receipts.
//   lockShop()        = take the shop's file out of the cabinet so nobody else
//                       edits it at the same time.
//   queueOwnerNotice()= drop a message for the shop's owner into the outbox tray
//                       (same transaction; nothing is sent here).
//   suspendShop(), reinstateShop(), verifyShop(), unverifyShop()
//                     = the four powers. Each: check input, lock, check state,
//                       change, write the receipt, hand back the updated shop.

import { withAdminLock } from './platformAdmin.service.js';
import { recordAdminAudit, ADMIN_AUDIT_ACTIONS } from './adminAudit.service.js';
import { enqueueNotification, NOTIFICATION_TEMPLATES } from './notifications.service.js';
import { CURSOR_TS_SQL, decodeCursor, encodeCursor } from '../utils/keysetCursor.js';

// A UUID, like 5bc6d791-ad88-41ad-93c2-4663c1d0507f.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reason limits. 500 matches the database rule (tenants_suspended_reason_len_chk).
const REASON_MIN = 5;
const REASON_MAX = 500;

// Page size limits for the list (same style as the other lists in the project).
const LIST_DEFAULT = 25;
const LIST_MAX = 100;

// Statuses the list may be filtered by.
const STATUSES = ['active', 'suspended', 'deleted'];

// How long a search word may be.
const SEARCH_MAX = 80;

// Make an error with a short code, the same style as the other services.
function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Check a shop id looks real. Real life: the clerk checks the file number has
// the right shape before walking to the cabinet.
function checkId(id) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw fail('validation', 'Invalid shop id');
  }
  return id;
}

// Check and clean the written reason.
// Real life: the clerk will not file a form with an empty "why" box.
function cleanReason(reason) {
  // Must be text.
  if (typeof reason !== 'string') throw fail('validation', 'A reason is required');
  // Remove hidden control characters (the null character would crash Postgres),
  // then trim spaces at both ends.
  const clean = reason.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  // Count real characters (an emoji is ONE character, like Postgres counts it).
  const length = Array.from(clean).length;
  if (length < REASON_MIN) {
    throw fail('validation', `Reason must be at least ${REASON_MIN} characters`);
  }
  if (length > REASON_MAX) {
    throw fail('validation', `Reason must be at most ${REASON_MAX} characters`);
  }
  return clean;
}

// The one list of fields we read for a shop and its owner.
// The owner is the oldest 'owner' membership. LATERAL means "for each shop,
// look up its owner". memberships is readable here only because the admin lock
// is on (migration 029). We never select the owner's password hash.
const SHOP_COLUMNS_SQL = `
  t.id, t.name, t.slug, t.plan, t.status, t.created_at,
  t.suspended_at, t.suspended_reason, t.suspended_by,
  t.verified_at, t.verified_by,
  o.name AS owner_name, o.phone AS owner_phone`;

const SHOP_FROM_SQL = `
  FROM tenants t
  LEFT JOIN LATERAL (
    SELECT u.name, u.phone
      FROM memberships m
      JOIN users u ON u.id = m.user_id
     WHERE m.tenant_id = t.id AND m.role = 'owner'
     ORDER BY m.created_at ASC
     LIMIT 1
  ) o ON TRUE`;

// Turn a database row into the clean answer for the screen (camelCase).
function shapeShop(r) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    plan: r.plan,
    status: r.status,
    createdAt: r.created_at,
    suspendedAt: r.suspended_at,
    suspendedReason: r.suspended_reason,
    suspendedBy: r.suspended_by,
    verifiedAt: r.verified_at,
    verifiedBy: r.verified_by,
    verified: r.verified_at !== null,
    // The owner may be missing (a shop with no owner row), so allow null.
    owner: r.owner_name === null || r.owner_name === undefined
      ? null
      : { name: r.owner_name, phone: r.owner_phone },
  };
}

// Fetch ONE shop in the shape above, on the caller's connection.
async function readShop(client, tenantId) {
  const { rows } = await client.query(
    `SELECT ${SHOP_COLUMNS_SQL} ${SHOP_FROM_SQL} WHERE t.id = $1`,
    [tenantId]
  );
  return rows[0] ? shapeShop(rows[0]) : null;
}

// Escape the three characters that mean something special inside ILIKE, so a
// search for "50%" looks for the text "50%" and not "50 and anything".
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// LIST: the register of shops, newest first, one page at a time.
// options: { status, q, verified, limit, cursor }
// ---------------------------------------------------------------------------
export async function listShops(db, options = {}) {
  const { status, q, verified, cursor } = options;

  // Status filter must be one of the three known words (or not given).
  if (status !== undefined && status !== null && status !== '' && !STATUSES.includes(status)) {
    throw fail('validation', 'Invalid status filter');
  }
  const statusFilter = status ? status : null;

  // Search word: trimmed, limited, special characters escaped, wrapped in %...%.
  let pattern = null;
  if (q !== undefined && q !== null && String(q).trim() !== '') {
    const word = String(q).trim().slice(0, SEARCH_MAX);
    pattern = `%${escapeLike(word)}%`;
  }

  // Verified filter: true, false or not given.
  let verifiedFilter = null;
  if (verified === true || verified === 'true') verifiedFilter = true;
  else if (verified === false || verified === 'false') verifiedFilter = false;
  else if (verified !== undefined && verified !== null && verified !== '') {
    throw fail('validation', 'Invalid verified filter');
  }

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
    // $1 status, $2 search pattern, $3 verified, $4/$5 bookmark, $6 limit.
    const { rows } = await client.query(
      `SELECT ${SHOP_COLUMNS_SQL}, ${CURSOR_TS_SQL('t.created_at')} AS cursor_ts
         ${SHOP_FROM_SQL}
        WHERE ($1::text IS NULL OR t.status = $1)
          AND ($1::text IS NOT NULL OR t.status <> 'deleted')
          AND ($2::text IS NULL OR t.name ILIKE $2 ESCAPE '\\' OR t.slug ILIKE $2 ESCAPE '\\')
          AND ($3::boolean IS NULL OR (t.verified_at IS NOT NULL) = $3)
          AND ($4::timestamptz IS NULL OR (t.created_at, t.id) < ($4::timestamptz, $5::uuid))
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT $6`,
      [statusFilter, pattern, verifiedFilter, ts, id, limit + 1]
    );
    // More rows than the page size means there is a next page.
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return {
      items: page.map(shapeShop),
      // The bookmark for the next page (null when this is the last page).
      nextCursor: hasMore ? encodeCursor(last.cursor_ts, last.id) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// DETAIL: one shop's file, with its latest receipts (newest first, up to 20).
// ---------------------------------------------------------------------------
export async function getShop(db, tenantId) {
  checkId(tenantId);
  return withAdminLock(db, async (client) => {
    const shop = await readShop(client, tenantId);
    if (!shop) throw fail('shop_not_found', 'Shop not found');
    // The receipts for this shop, with the admin's name (platform_admins is
    // readable because the admin lock is on).
    const { rows } = await client.query(
      `SELECT a.id, a.action, a.before, a.after, a.ip_address, a.created_at,
              pa.name AS admin_name
         FROM audit_logs a
         LEFT JOIN platform_admins pa ON pa.id = a.actor_admin_id
        WHERE a.tenant_id = $1 AND a.resource = 'tenants'
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT 20`,
      [tenantId]
    );
    return {
      ...shop,
      receipts: rows.map((r) => ({
        id: r.id,
        action: r.action,
        before: r.before,
        after: r.after,
        ipAddress: r.ip_address,
        createdAt: r.created_at,
        adminName: r.admin_name,
      })),
    };
  });
}

// Take the shop's file out of the cabinet so nobody else can edit it until we
// finish (FOR UPDATE). Throws if the shop does not exist or is deleted.
async function lockShop(client, tenantId) {
  const { rows } = await client.query(
    `SELECT id, status, suspended_at, suspended_reason, suspended_by,
            verified_at, verified_by
       FROM tenants WHERE id = $1 FOR UPDATE`,
    [tenantId]
  );
  if (!rows[0]) throw fail('shop_not_found', 'Shop not found');
  if (rows[0].status === 'deleted') throw fail('shop_deleted', 'This shop was deleted');
  return rows[0];
}

// Queue the owner's message for an admin action (Batch 3b-1).
// Real life: after the clerk stamps the register, a slip "tell the owner" goes
// in the tray. `shop` is the updated shop from readShop(), `receipt` is what
// recordAdminAudit returned. `extra` adds blanks to the payload (the suspend
// reason). The owner may be missing: then the phone is empty and the slip says
// so, but the action still succeeds.
async function queueOwnerNotice(client, { shop, template, receipt, extra = {} }) {
  return enqueueNotification(client, {
    tenantId: shop.id,
    template,
    recipientPhone: shop.owner ? shop.owner.phone : null,
    payload: { shopName: shop.name, ...extra },
    auditLogId: receipt.id,
  });
}

// ---------------------------------------------------------------------------
// SUSPEND: close the shop everywhere that obeys status. Needs a reason.
// ---------------------------------------------------------------------------
export async function suspendShop(db, { adminId, tenantId, reason, ip } = {}) {
  checkId(tenantId);
  const cleanText = cleanReason(reason);
  return withAdminLock(db, async (client) => {
    const shop = await lockShop(client, tenantId);
    if (shop.status === 'suspended') throw fail('already_suspended', 'This shop is already suspended');
    // Change the shop: mark it suspended, with who, when and why.
    await client.query(
      `UPDATE tenants
          SET status = 'suspended', suspended_at = NOW(), suspended_reason = $2,
              suspended_by = $3, updated_at = NOW()
        WHERE id = $1`,
      [tenantId, cleanText, adminId]
    );
    // Write the receipt on the SAME transaction.
    const receipt = await recordAdminAudit(client, {
      adminId, tenantId, ip,
      action: ADMIN_AUDIT_ACTIONS.SHOP_SUSPENDED,
      before: { status: shop.status },
      after: { status: 'suspended', reason: cleanText },
    });
    // Queue the owner's message (same transaction). The reason goes in, so the
    // owner knows why the shop was closed.
    const updated = await readShop(client, tenantId);
    await queueOwnerNotice(client, {
      shop: updated, receipt, template: NOTIFICATION_TEMPLATES.SHOP_SUSPENDED,
      extra: { reason: cleanText },
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// REINSTATE: open a suspended shop again. Needs a reason.
// ---------------------------------------------------------------------------
export async function reinstateShop(db, { adminId, tenantId, reason, ip } = {}) {
  checkId(tenantId);
  const cleanText = cleanReason(reason);
  return withAdminLock(db, async (client) => {
    const shop = await lockShop(client, tenantId);
    if (shop.status !== 'suspended') throw fail('not_suspended', 'This shop is not suspended');
    // Open the shop and clear the three suspended fields. The history stays in
    // the receipts (the earlier suspend receipt keeps the old reason).
    await client.query(
      `UPDATE tenants
          SET status = 'active', suspended_at = NULL, suspended_reason = NULL,
              suspended_by = NULL, updated_at = NOW()
        WHERE id = $1`,
      [tenantId]
    );
    const receipt = await recordAdminAudit(client, {
      adminId, tenantId, ip,
      action: ADMIN_AUDIT_ACTIONS.SHOP_REINSTATED,
      before: {
        status: shop.status,
        suspended_at: shop.suspended_at,
        suspended_reason: shop.suspended_reason,
        suspended_by: shop.suspended_by,
      },
      after: { status: 'active', reason: cleanText },
    });
    // Queue the owner's message. No reason in it: that note is for head office.
    const updated = await readShop(client, tenantId);
    await queueOwnerNotice(client, {
      shop: updated, receipt, template: NOTIFICATION_TEMPLATES.SHOP_REINSTATED,
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// VERIFY: stamp the shop as a checked, real business. Needs a reason.
// ---------------------------------------------------------------------------
export async function verifyShop(db, { adminId, tenantId, reason, ip } = {}) {
  checkId(tenantId);
  const cleanText = cleanReason(reason);
  return withAdminLock(db, async (client) => {
    const shop = await lockShop(client, tenantId);
    if (shop.verified_at !== null) throw fail('already_verified', 'This shop is already verified');
    // RETURNING gives back the exact time the database stamped.
    const { rows } = await client.query(
      `UPDATE tenants
          SET verified_at = NOW(), verified_by = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING verified_at`,
      [tenantId, adminId]
    );
    const receipt = await recordAdminAudit(client, {
      adminId, tenantId, ip,
      action: ADMIN_AUDIT_ACTIONS.SHOP_VERIFIED,
      before: { verified_at: null, verified_by: null },
      after: { verified_at: rows[0].verified_at, verified_by: adminId, reason: cleanText },
    });
    // Queue the owner's message (good news: your shop is verified).
    const updated = await readShop(client, tenantId);
    await queueOwnerNotice(client, {
      shop: updated, receipt, template: NOTIFICATION_TEMPLATES.SHOP_VERIFIED,
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// UNVERIFY: take the verified stamp away (for example, it was a mistake).
// ---------------------------------------------------------------------------
export async function unverifyShop(db, { adminId, tenantId, reason, ip } = {}) {
  checkId(tenantId);
  const cleanText = cleanReason(reason);
  return withAdminLock(db, async (client) => {
    const shop = await lockShop(client, tenantId);
    if (shop.verified_at === null) throw fail('not_verified', 'This shop is not verified');
    await client.query(
      `UPDATE tenants
          SET verified_at = NULL, verified_by = NULL, updated_at = NOW()
        WHERE id = $1`,
      [tenantId]
    );
    const receipt = await recordAdminAudit(client, {
      adminId, tenantId, ip,
      action: ADMIN_AUDIT_ACTIONS.SHOP_UNVERIFIED,
      before: { verified_at: shop.verified_at, verified_by: shop.verified_by },
      after: { verified_at: null, verified_by: null, reason: cleanText },
    });
    // Queue the owner's message (the verified mark was removed).
    const updated = await readShop(client, tenantId);
    await queueOwnerNotice(client, {
      shop: updated, receipt, template: NOTIFICATION_TEMPLATES.SHOP_UNVERIFIED,
    });
    return updated;
  });
}
