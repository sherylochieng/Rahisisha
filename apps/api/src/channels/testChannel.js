// =============================================================================
// FILE: apps/api/src/channels/testChannel.js   (Week 30 Day 3, Batch 3b-2a: the sender, step 1)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The first "channel": a pretend postman. It takes a message and says "sent",
//   but sends nothing to anyone. It lets us build and prove the whole sender
//   (pick up, retry, record) BEFORE WhatsApp or SMS exist.
//
// WHY IMPORTANT
//   Every channel (test, WhatsApp, SMS) must have the SAME shape:
//     send({ to, text }) -> { providerId }      (or throw an error)
//   This file is the example of that shape. A real channel is a drop-in copy.
//
// DANGER
//   1. It delivers NOTHING. A line marked 'sent' by this channel was NOT
//      received by a human. The row's channel column says 'test' so you can tell.
//   2. It logs the phone MASKED and never logs the message text (the text can
//      contain a shop's suspension reason).
//   3. Never put real keys or network calls in this file.
//
// WHAT IT SOLVES
//   "Let me see the whole sending machine work end to end without spending money
//   or messaging real people."
//
// SYSTEM DESIGN PRINCIPLE
//   Adapter pattern: one common plug shape, many devices behind it. The sender
//   talks to the plug, never to Meta or an SMS company directly.
//
// RULES
//   1. send() receives { to, text } and returns { providerId }.
//   2. To say "do not retry, it will never work" (for example a bad number),
//      throw an error with err.permanent = true.
//   3. Any other thrown error means "try again later".
//
// PRACTICAL EXAMPLE
//   const { providerId } = await testChannel.send({ to: '254712345678', text: 'Hi' });
//   // providerId looks like 'test-1f9c0a...'
//
// DECISIONS
//   - Returns a random providerId so the real channels' "message id from the
//     provider" has a place to go later.
//   - Logging can be silenced with NOTIFICATIONS_QUIET=on (used by tests).
//
// WHERE USED
//   apps/api/src/channels/index.js (the registry), then notificationSender.service.js.
//
// TRADEOFFS
//   + Free, instant, safe. - Proves our plumbing, not the real network.
//
// HOW TO USE
//   Not called directly. The registry hands it out: getChannel('test').
// =============================================================================

// PIECE BY PIECE
//   testChannel.name = the word stored in notifications.channel.
//   testChannel.send = the pretend delivery.

import crypto from 'node:crypto';
import { maskPhone } from '../services/notifications.service.js';

export const testChannel = Object.freeze({
  // The channel's name, matching the database CHECK (test, whatsapp, sms).
  name: 'test',

  // Pretend to deliver. `to` is the phone, `text` is the words.
  async send({ to, text } = {}) {
    // A message with nobody to send to or nothing to say can never work.
    if (typeof to !== 'string' || to === '' || typeof text !== 'string' || text === '') {
      const err = new Error('test channel needs a phone and a text');
      err.permanent = true;
      throw err;
    }
    // Say what would have happened, with the phone hidden and no message text.
    if (process.env.NOTIFICATIONS_QUIET !== 'on') {
      console.log(`[notifications] test channel: would send ${text.length} characters to ${maskPhone(to)}`);
    }
    // Hand back a made-up provider id.
    return { providerId: `test-${crypto.randomBytes(6).toString('hex')}` };
  },
});
