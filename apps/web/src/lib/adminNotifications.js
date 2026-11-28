// =============================================================================
// FILE: apps/web/src/lib/adminNotifications.js   (Week 30 Day 3, Batch 3b-2b, web step 1)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The plain-words dictionary for the notifications screen: what to call each
//   message, how to describe each line's situation, and the filter choices. No
//   screen code, no network, just words and small rules.
//
// WHY IMPORTANT
//   The API speaks in codes ('shop.suspended', 'no_recipient'). A tired admin
//   should read "Shop suspended" and "No phone number on file". Keeping the
//   words here means one place to change them (DRY) and easy tests later.
//
// DANGER
//   1. An unknown template or error code must still show something (its own
//      code). Nothing may disappear from the screen.
//   2. last_error is shown as plain text only (React escapes it). Never put it
//      into HTML by hand.
//   3. A line on the 'test' channel was NOT sent to a phone. The note says so.
//
// WHAT IT SOLVES
//   "What does this row mean, in one friendly line?"
//
// SYSTEM DESIGN PRINCIPLE
//   Data-driven UI and separation of concerns: words in a table, screen code stays short.
//
// RULES
//   1. Pure functions, no side effects.
//   2. Unknown values fall back to the raw code.
//
// PRACTICAL EXAMPLE
//   templateLabel('shop.suspended')   // 'Shop suspended'
//   describeNote({ status: 'failed', lastError: 'no_recipient' }) // 'No phone number on file'
//
// DECISIONS
//   - The status filter options are built here so the page and any future widget
//     (for example the Overview) use the same choices.
//
// WHERE USED
//   NotificationsTable.js and NotificationsBrowser.js
//
// TRADEOFFS
//   + One dictionary. - A new template on the API needs a label here (it falls back to its code meanwhile).
//
// HOW TO USE
//   import { templateLabel, describeNote, statusOptions } from '../../lib/adminNotifications';
// =============================================================================

import { formatNairobiTime } from './format';

// Template code -> plain words.
const TEMPLATE_LABELS = {
  'shop.suspended': 'Shop suspended',
  'shop.reinstated': 'Shop reinstated',
  'shop.verified': 'Shop verified',
  'shop.unverified': 'Verified mark removed',
};

// Error code saved by the sender -> plain words.
const ERROR_LABELS = {
  no_recipient: 'No phone number on file',
  channel_unavailable: 'No sender is set up for this channel yet',
};

// The friendly name of a message.
export function templateLabel(template) {
  return TEMPLATE_LABELS[template] || template;
}

// One short line describing the situation of a row.
// `n` is one item from the API list.
export function describeNote(n) {
  if (n.status === 'sent') {
    const when = n.sentAt ? `Sent ${formatNairobiTime(n.sentAt)}` : 'Sent';
    // The pretend channel delivers nothing: say so.
    return n.channel === 'test' ? `${when} (practice channel, nothing reached a phone)` : when;
  }
  if (n.status === 'failed') {
    return ERROR_LABELS[n.lastError] || n.lastError || 'Failed';
  }
  // Queued: never tried yet, or waiting for the next try after a failure.
  if (n.attempts > 0) {
    const why = ERROR_LABELS[n.lastError] || n.lastError;
    const next = `Next try ${formatNairobiTime(n.sendAfter)}`;
    return why ? `${next}. Last problem: ${why}` : next;
  }
  return 'Waiting to be sent';
}

// The filter buttons, with the counts when we have them.
// `counts` looks like { queued: 2, sent: 40, failed: 1 } or null.
export function statusOptions(counts) {
  const withCount = (label, key) => (counts && Number.isInteger(counts[key]) ? `${label} (${counts[key]})` : label);
  return [
    { value: '', label: 'All' },
    { value: 'queued', label: withCount('Queued', 'queued') },
    { value: 'sent', label: withCount('Sent', 'sent') },
    { value: 'failed', label: withCount('Failed', 'failed') },
  ];
}
