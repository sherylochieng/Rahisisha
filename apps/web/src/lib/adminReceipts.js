// =============================================================================
// FILE: apps/web/src/lib/adminReceipts.js   (Week 30 Day 3, Batch 2, part 3a)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Turns a raw audit receipt from the API (action: 'shop.suspended', after: {...}) into
//   words an admin can read: a title and the reason.
//
// WHY IMPORTANT
//   The shop page and the Receipts page (built later) both list receipts. One translator
//   means "shop.suspended" is always called "Suspended", everywhere.
//
// DANGER
//   - The reason is written by a person. Always show it as plain TEXT (React does this for
//     you). Never put it inside dangerouslySetInnerHTML.
//   - An unknown action must still show (its raw code), never vanish or crash.
//
// WHAT IT SOLVES
//   Repeated label tables, and receipts showing computer codes instead of words.
//
// SYSTEM DESIGN PRINCIPLE
//   DRY: one lookup table. A new action in the API is one new line here.
//
// RULES
//   1. receiptTitle(action) always returns a string.
//   2. receiptReason(receipt) returns the reason text, or '' when there is none.
//
// PRACTICAL EXAMPLE
//   receiptTitle('shop.suspended')  -> 'Shop suspended'
//   receiptReason({ after: { reason: 'Fake M-Pesa messages' } })  -> 'Fake M-Pesa messages'
//
// DECISIONS
//   - Plain functions with no React, so they are easy to test.
//
// WHERE USED
//   components/admin/ReceiptsList.js.
//
// TRADEOFFS
//   + Tiny and safe.
//   - A new API action shows its raw code until a line is added here (safe, visible).
//
// HOW TO USE
//   import { receiptTitle, receiptReason } from '../../lib/adminReceipts';
// =============================================================================

// The printed list of receipt names. Keys match the API's ADMIN_AUDIT_ACTIONS.
const TITLES = {
  'shop.suspended': 'Shop suspended',
  'shop.reinstated': 'Shop reinstated',
  'shop.verified': 'Shop verified',
  'shop.unverified': 'Verification removed',
};

// A readable title for a receipt. Unknown actions show their raw code.
export function receiptTitle(action) {
  return TITLES[action] || String(action || 'Unknown action');
}

// The written reason, or '' when there is none.
export function receiptReason(receipt) {
  const reason = receipt && receipt.after && receipt.after.reason;
  return typeof reason === 'string' ? reason : '';
}
