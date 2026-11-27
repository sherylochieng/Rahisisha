
// =============================================================================
// FILE: apps/api/src/services/adminAudit.service.js   (Week 30 Day 3, Batch 1: admin core, step 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Every powerful thing the platform admin does to a shop (suspend it, bring it
//   back, verify it) must leave a RECEIPT: who did it, to which shop, what it
//   looked like before and after, and from which network address. This file is
//   the one place that writes that receipt into the `audit_logs` table.
//
// WHY IMPORTANT
//   Without receipts, nobody can answer "who closed Wanjiku's shop and why?".
//   With them, a dispute takes two minutes, and a stolen admin account can be
//   traced and undone. Licensed payment providers will also expect this trail.
//
// DANGER
//   1. The receipt is written on the caller's OPEN TRANSACTION (the `client`
//      passed in), never on its own connection. So the change and its receipt
//      either both happen or neither does. Do not "fix" this by using the pool:
//      a shop could then be suspended with no receipt, or a receipt written for
//      something that never happened.
//   2. Only a short list of fields is stored (ALLOWED_SNAPSHOT_KEYS). Anything
//      else is dropped on purpose, so a password hash, token or phone number can
//      never leak into the log by accident.
//   3. Only the actions in ADMIN_AUDIT_ACTIONS are accepted. A typo such as
//      "shop.suspnded" is refused instead of creating a receipt nobody can find.
//   4. This file never decides WHO may act. The admin guard and the admin lock
//      do that before this code runs.
//
// WHAT IT SOLVES
//   One safe, tested way to write an admin receipt. The shop service, and later
//   the marketplace and payment admin tools, all use the same function.
//
// SYSTEM DESIGN PRINCIPLE
//   Audit by design, and atomicity: the receipt is part of the same unit of work
//   as the action. One job per file: this file only writes receipts. The rules
//   about shops live in adminShops.service.js (next file).
//
// RULES
//   1. recordAdminAudit(client, { adminId, tenantId, action, before, after, ip }).
//   2. `client` must be a connection that is already inside BEGIN ... COMMIT.
//   3. action must be one of ADMIN_AUDIT_ACTIONS.
//   4. before and after are plain objects or null. Unknown keys are dropped.
//   5. Errors have a `.code`: bad_audit_input.
//
// PRACTICAL EXAMPLE
//   Sheryl suspends Wanjiku Fashions, reason "customers reported fake M-Pesa
//   messages". Inside the same transaction as the suspend, this writes:
//     action shop.suspended, before {status:'active'}, after {status:'suspended',
//     suspended_reason:'customers reported fake M-Pesa messages'}, actor = Sheryl.
//
// DECISIONS
//   - resource is always 'tenants' and resource_id is the shop id. Later admin
//     tools can add their own resources next to it.
//   - The reason text is saved inside `after` (and in suspended_reason on the
//     shop), so the receipt is complete even if the shop row changes later.
//   - audit_logs has no row level security (migration 028 only added the
//     actor_admin_id column), so no admin lock is needed to INSERT. The caller
//     already holds it for the shop update anyway.
//
// WHERE USED
//   apps/api/src/services/adminShops.service.js (next file of this batch).
//
// TRADEOFFS
//   + Very small, easy to test, hard to misuse.
//   - A new admin action needs one line added to ADMIN_AUDIT_ACTIONS. That is a
//     feature: a reviewer sees every new kind of receipt.
//
// HOW TO USE
//   import { recordAdminAudit, ADMIN_AUDIT_ACTIONS } from './adminAudit.service.js';
//   await withAdminLock(pool, async (client) => {
//     // ... change the shop with client.query(...) ...
//     await recordAdminAudit(client, {
//       adminId: req.admin.id, tenantId, action: ADMIN_AUDIT_ACTIONS.SHOP_SUSPENDED,
//       before: { status: 'active' }, after: { status: 'suspended', reason }, ip: req.ip,
//     });
//   });
// =============================================================================

// PIECE BY PIECE
//   ADMIN_AUDIT_ACTIONS     = the printed list of receipt types. A clerk can only
//                             tick a box on the form, never invent a new one.
//   ALLOWED_SNAPSHOT_KEYS   = the boxes allowed on the form. Real life: a bank
//                             slip has "amount" and "date" but never your PIN.
//   fail()                  = make an error with a short code the caller can read.
//   pickSnapshot()          = copy only the allowed boxes onto the receipt.
//   cleanIp()               = write the network address, trimmed and not too long.
//   recordAdminAudit()      = check the form, then stamp it into the receipt book
//                             (audit_logs) on the SAME transaction as the change.

// The only kinds of admin receipt that exist today.
// Real life: the printed tick-boxes at the top of a receipt book.
export const ADMIN_AUDIT_ACTIONS = Object.freeze({
  SHOP_SUSPENDED: 'shop.suspended',
  SHOP_REINSTATED: 'shop.reinstated',
  SHOP_VERIFIED: 'shop.verified',
  SHOP_UNVERIFIED: 'shop.unverified',
});

// Only these fields may be copied into the before/after pictures.
// Real life: the receipt shows the shop's status and the reason, never secrets.
const ALLOWED_SNAPSHOT_KEYS = Object.freeze([
  'status',
  'suspended_at',
  'suspended_reason',
  'suspended_by',
  'verified_at',
  'verified_by',
  'reason',
]);

// A UUID, like 5bc6d791-ad88-41ad-93c2-4663c1d0507f (checked before any SQL runs).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Make an error with a short code, the same style as platformAdmin.service.js.
function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Copy ONLY the allowed fields. null/undefined means "no picture" (stored as NULL).
function pickSnapshot(snapshot, label) {
  // No picture given: store nothing, which is fine (for example before a first verify).
  if (snapshot === null || snapshot === undefined) return null;
  // Must be a plain object (not a list, text or number), or the receipt makes no sense.
  if (typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw fail('bad_audit_input', `${label} must be an object or null`);
  }
  // Start with an empty receipt box and copy across only the allowed fields.
  const picked = {};
  for (const key of ALLOWED_SNAPSHOT_KEYS) {
    // Only copy a field that was really given (even an empty value counts).
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) picked[key] = snapshot[key];
  }
  return picked;
}

// Network address as text: trimmed, at most 64 characters, or NULL if none.
function cleanIp(ip) {
  // Nothing given (a script or a test): store NULL.
  if (ip === null || ip === undefined) return null;
  // Trim spaces and cut at 64 characters so a strange header cannot fill the table.
  const text = String(ip).trim().slice(0, 64);
  // An empty address is stored as NULL, not as an empty text.
  return text === '' ? null : text;
}

// Write ONE receipt on the caller's open transaction.
// Returns { id, created_at } of the new receipt.
export async function recordAdminAudit(client, { adminId, tenantId, action, before, after, ip } = {}) {
  // A real connection is required, so the receipt joins the caller's transaction.
  if (!client || typeof client.query !== 'function') {
    throw fail('bad_audit_input', 'A database connection (inside a transaction) is required');
  }
  // Who did it: must be a real admin id shape.
  if (typeof adminId !== 'string' || !UUID_RE.test(adminId)) {
    throw fail('bad_audit_input', 'adminId must be a UUID');
  }
  // Which shop: must be a real shop id shape.
  if (typeof tenantId !== 'string' || !UUID_RE.test(tenantId)) {
    throw fail('bad_audit_input', 'tenantId must be a UUID');
  }
  // What was done: must be on the printed list of receipt types.
  if (!Object.values(ADMIN_AUDIT_ACTIONS).includes(action)) {
    throw fail('bad_audit_input', 'Unknown audit action');
  }

  // Stamp the receipt into the receipt book. $1..$7 are filled safely by the
  // driver (no SQL injection). JSON.stringify turns the picture into JSON text
  // for the JSONB columns; NULL stays NULL.
  const beforePicked = pickSnapshot(before, 'before');
  const afterPicked = pickSnapshot(after, 'after');
  const { rows } = await client.query(
    `INSERT INTO audit_logs
       (tenant_id, actor_admin_id, action, resource, resource_id, before, after, ip_address)
     VALUES ($1, $2, $3, 'tenants', $1, $4, $5, $6)
     RETURNING id, created_at`,
    [
      tenantId,
      adminId,
      action,
      beforePicked === null ? null : JSON.stringify(beforePicked),
      afterPicked === null ? null : JSON.stringify(afterPicked),
      cleanIp(ip),
    ]
  );
  // Hand back the receipt number and time.
  return rows[0];
}
