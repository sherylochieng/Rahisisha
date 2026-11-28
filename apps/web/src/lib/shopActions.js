// =============================================================================
// FILE: apps/web/src/lib/shopActions.js   (Week 30 Day 3, Batch 2, part 3b)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   One printed list of the four things an admin can do to a shop (suspend, reinstate,
//   verify, remove verification): the button words, the question asked, the warning, the
//   "done" message, and which action fits which shop.
//
// WHY IMPORTANT
//   The buttons, the confirmation box and the success message all read from this one list.
//   Change a word here and it changes everywhere (DRY). Add a fifth action: add one entry.
//
// DANGER
//   - suspend is the only action whose reason the OWNER sees (the API sends it to the
//     owner when they try to change anything). warnsOwner: true makes the form say so.
//     Never remove that warning.
//   - availableActions decides what the admin is OFFERED. The API is the real lock: even a
//     forged request for a wrong action is refused there.
//
// WHAT IT SOLVES
//   Repeated button and dialog wording, and offering the wrong action for a shop's state.
//
// SYSTEM DESIGN PRINCIPLE
//   Data-driven UI: the screen is built from a table, not from copy-pasted code. DRY.
//
// RULES
//   1. Deleted shops get no actions (the API refuses them with shop_deleted).
//   2. An active shop offers Suspend, a suspended shop offers Reinstate.
//   3. A verified shop offers Remove verification, otherwise Verify.
//   4. apiMethod is the name of the function on adminApi.
//
// PRACTICAL EXAMPLE
//   availableActions({ status: 'active', verified: false })  ->  ['suspend', 'verify']
//
// DECISIONS
//   - Plain data and one small function, no React, so it is easy to test.
//
// WHERE USED
//   ShopActions.js (buttons) and ReasonDialog.js (the confirmation words).
//
// TRADEOFFS
//   + One place to read every admin action's wording.
//
// HOW TO USE
//   import { SHOP_ACTIONS, availableActions } from '../../lib/shopActions';
// =============================================================================

export const SHOP_ACTIONS = {
  suspend: {
    apiMethod: 'suspendShop',
    buttonLabel: 'Suspend shop',
    title: 'Suspend this shop?',
    explain: 'The shop closes everywhere. The owner can still sign in, but cannot change anything.',
    warnsOwner: true, // the owner sees this reason
    confirmLabel: 'Suspend shop',
    danger: true,
    doneMessage: 'Shop suspended.',
  },
  reinstate: {
    apiMethod: 'reinstateShop',
    buttonLabel: 'Reinstate shop',
    title: 'Reinstate this shop?',
    explain: 'The shop opens again. Your reason is kept in the receipts.',
    warnsOwner: false,
    confirmLabel: 'Reinstate shop',
    danger: false,
    doneMessage: 'Shop reinstated.',
  },
  verify: {
    apiMethod: 'verifyShop',
    buttonLabel: 'Verify shop',
    title: 'Verify this shop?',
    explain: 'Mark this shop as a checked, real business. Your reason is kept in the receipts.',
    warnsOwner: false,
    confirmLabel: 'Verify shop',
    danger: false,
    doneMessage: 'Shop verified.',
  },
  unverify: {
    apiMethod: 'unverifyShop',
    buttonLabel: 'Remove verification',
    title: 'Remove verification?',
    explain: 'The verified mark is removed. Your reason is kept in the receipts.',
    warnsOwner: false,
    confirmLabel: 'Remove verification',
    danger: false,
    doneMessage: 'Verification removed.',
  },
};

// Which actions fit this shop right now, as a list of keys.
export function availableActions(shop) {
  // A deleted shop cannot be changed.
  if (!shop || shop.status === 'deleted') return [];

  const keys = [];
  // Open or closed.
  keys.push(shop.status === 'suspended' ? 'reinstate' : 'suspend');
  // Checked or not.
  keys.push(shop.verified ? 'unverify' : 'verify');
  return keys;
}
