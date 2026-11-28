# src/channels/testChannel.js

**FILE:** `apps/api/src/channels/testChannel.js` (Week 30 Day 3, Batch 3b-2a, step 1)

## WHY THIS FILE EXISTS

The first "channel": a **pretend postman**. It takes a message and says "sent", but sends nothing to anyone. It lets us build and prove the whole sender (pick up, retry, record) before WhatsApp or SMS exist.

## WHY IMPORTANT

Every channel must have the **same shape**: `send({ to, text })` returns `{ providerId }`, or throws. This file is the example. A real channel is a drop-in copy.

## DANGER

1. It delivers **nothing**. A line marked `sent` by this channel was not received by a human. The row's `channel` column says `test` so you can tell.
2. It logs the phone **masked** and never the message text (the text can contain a suspension reason).
3. Never put real keys or network calls in this file.

## WHAT IT SOLVES

"Let me see the whole sending machine work without spending money or messaging real people."

## SYSTEM DESIGN PRINCIPLE

**Adapter pattern.** One common plug shape, many devices behind it. The sender talks to the plug, never to Meta or an SMS company.

## RULES

1. `send()` receives `{ to, text }` and returns `{ providerId }`.
2. To say "never retry, it cannot work" (a bad number), throw an error with `err.permanent = true`.
3. Any other thrown error means "try again later".

## PRACTICAL EXAMPLE

```js
const { providerId } = await testChannel.send({ to: '254712345678', text: 'Hi' });
// providerId is like 'test-1f9c0a...'
```

## DECISIONS

- A random `providerId` is returned so the real channels' "message id from the provider" has a place to go.
- Logging can be silenced with `NOTIFICATIONS_QUIET=on` (tests do this).

## WHERE USED

`channels/index.js` (the registry), then `notificationSender.service.js`.

## TRADEOFFS

+ Free, instant, safe. - Proves our plumbing, not the real network.

## HOW TO USE

Not called directly. The registry hands it out: `getChannel('test')`.

**Reuse in future projects:** keep this file as the "fake" in every project that sends email, SMS or push. Developers run the whole system on a laptop with the fake, and only production uses the real one.

---

## LINE BY LINE

**`name: 'test'`** The word stored in the `notifications.channel` column.

**`Object.freeze({...})`** Nobody can change the channel by accident while the server runs.

**The first `if`** If there is no phone or no text, throw a **permanent** error. Retrying can never fix that. Real life: a letter with no address is returned to sender at once, not tried again tomorrow.

**The `console.log` line** Says how many characters would be sent and to which masked number (`2547*****678`). It never prints the text. `NOTIFICATIONS_QUIET=on` silences it.

**`return { providerId: ... }`** A made-up receipt number, like a courier's tracking number.
