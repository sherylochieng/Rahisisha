// =============================================================================
// FILE: apps/api/src/services/notificationMessages.js   (Week 30 Day 3, Batch 3b-2a: the sender, step 3)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The WORDS of every message live here, in one place. The outbox row stores a
//   template NAME ('shop.suspended') and blanks (shop name, reason). This file
//   turns them into the sentence the owner reads.
//
// WHY IMPORTANT
//   Wording changes often (tone, Swahili, length limits). Keeping it in one file
//   means a wording change never touches the queue, the sender or the channels.
//
// DANGER
//   1. The blanks come from people (a shop name, an admin's reason). They are
//      cleaned here: control characters removed, lengths limited.
//   2. Keep messages short. SMS charges per 160-character part, and WhatsApp
//      templates must be approved word for word later. Do not add long text.
//   3. Never put secrets, links with tokens or other customers' data in a message.
//
// WHAT IT SOLVES
//   "What exactly do we tell Mama Njeri when her shop is suspended?"
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: WHAT happened (outbox row) / WHAT WE SAY (this file)
//   / HOW it travels (channel).
//
// RULES
//   1. renderMessage(template, payload) returns plain text.
//   2. An unknown template throws an error with err.permanent = true (retrying
//      can never fix it).
//   3. Only the suspend message uses the admin's reason.
//
// PRACTICAL EXAMPLE
//   renderMessage('shop.suspended', { shopName: 'Mama Njeri Groceries', reason: 'fake M-Pesa messages' })
//   // 'Rahisisha Biashara: your shop "Mama Njeri Groceries" has been suspended. Reason: fake M-Pesa messages. If you think this is a mistake, please contact Rahisisha support.'
//
// DECISIONS
//   - English first. A Swahili version can be added later as a second table keyed
//     by language, without touching anything else.
//   - The text names the platform at the start so the owner knows who is writing
//     (a branded sender ID or WhatsApp business name will do the same later).
//
// WHERE USED
//   apps/api/src/services/notificationSender.service.js
//
// TRADEOFFS
//   + One place for all wording. - Wording is code, so changing it needs a deploy.
//
// HOW TO USE
//   import { renderMessage } from './notificationMessages.js';
// =============================================================================

// PIECE BY PIECE
//   clean()          = make one blank safe: text only, no hidden characters, limited length.
//   WORDING          = the table: template name -> function that builds the sentence.
//   renderMessage()  = look up the template and build the sentence.

import { NOTIFICATION_TEMPLATES } from './notifications.service.js';

// The platform name at the front of every message.
const BRAND = 'Rahisisha Biashara';

// Limits for the blanks (the same as the admin reason limit for the reason).
const SHOP_NAME_MAX = 80;
const REASON_MAX = 500;

// Make one blank safe. Real life: the clerk crosses out odd scribbles before
// copying a name onto the letter.
function clean(value, max, fallback) {
  const text = typeof value === 'string' ? value : '';
  // Remove hidden control characters, squash line breaks and spaces, trim.
  const tidy = text.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (tidy === '') return fallback;
  // Limit by real characters (an emoji counts as one).
  return Array.from(tidy).slice(0, max).join('');
}

// Template name -> sentence builder.
const WORDING = Object.freeze({
  [NOTIFICATION_TEMPLATES.SHOP_SUSPENDED]: (p) =>
    `${BRAND}: your shop "${clean(p.shopName, SHOP_NAME_MAX, 'your shop')}" has been suspended. `
    + `Reason: ${clean(p.reason, REASON_MAX, 'not given')}. `
    + 'If you think this is a mistake, please contact Rahisisha support.',

  [NOTIFICATION_TEMPLATES.SHOP_REINSTATED]: (p) =>
    `${BRAND}: good news, your shop "${clean(p.shopName, SHOP_NAME_MAX, 'your shop')}" is open again.`,

  [NOTIFICATION_TEMPLATES.SHOP_VERIFIED]: (p) =>
    `${BRAND}: your shop "${clean(p.shopName, SHOP_NAME_MAX, 'your shop')}" is now verified. `
    + 'Customers will see the Verified mark.',

  [NOTIFICATION_TEMPLATES.SHOP_UNVERIFIED]: (p) =>
    `${BRAND}: the Verified mark was removed from your shop "${clean(p.shopName, SHOP_NAME_MAX, 'your shop')}".`,
});

// Build the sentence for one outbox line.
export function renderMessage(template, payload = {}) {
  const build = Object.prototype.hasOwnProperty.call(WORDING, template) ? WORDING[template] : null;
  if (!build) {
    // No wording for this name: retrying can never fix it.
    const err = new Error(`No wording for template "${template}"`);
    err.permanent = true;
    throw err;
  }
  // A missing or odd payload is treated as empty (the blanks then use fallbacks).
  const safe = payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  return build(safe);
}
