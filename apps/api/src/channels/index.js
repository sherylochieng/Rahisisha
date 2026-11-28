// =============================================================================
// FILE: apps/api/src/channels/index.js   (Week 30 Day 3, Batch 3b-2a: the sender, step 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The directory of channels: "give me the postman called 'whatsapp'". The
//   sender asks this file instead of importing each channel itself.
//
// WHY IMPORTANT
//   Adding WhatsApp later means: write whatsappChannel.js (same shape as
//   testChannel.js) and add ONE line here. The sender, the queue and the admin
//   actions do not change. That is the whole point of channels.
//
// DANGER
//   1. A channel that is NOT listed returns null. The sender then marks the line
//      FAILED ("channel_unavailable"). It must NEVER pretend such a line was sent.
//   2. Do not list a channel here until it really works.
//
// WHAT IT SOLVES
//   "Which code delivers a line whose channel is 'sms'?"
//
// SYSTEM DESIGN PRINCIPLE
//   Registry + adapter pattern. Open for extension (add a channel), closed for
//   modification (the sender stays untouched).
//
// RULES
//   1. Keys are the channel names allowed by the database (test, whatsapp, sms).
//   2. Every value has { name, send({to, text}) }.
//
// PRACTICAL EXAMPLE
//   const channel = getChannel('test');      // the pretend postman
//   const none = getChannel('whatsapp');     // null until it is built
//
// DECISIONS
//   - Today only 'test' is registered. whatsapp and sms are deliberately missing.
//
// WHERE USED
//   apps/api/src/services/notificationSender.service.js
//
// TRADEOFFS
//   + One tiny file to extend. - A forgotten registration shows up as failed lines
//     (loud, which is what we want).
//
// HOW TO USE
//   import { getChannel } from '../channels/index.js';
// =============================================================================

import { testChannel } from './testChannel.js';

// The channels that really work today. Add whatsapp / sms here when they are built.
const REGISTRY = Object.freeze({
  test: testChannel,
});

// Give back the channel with this name, or null when we have none.
export function getChannel(name) {
  return Object.prototype.hasOwnProperty.call(REGISTRY, name) ? REGISTRY[name] : null;
}
