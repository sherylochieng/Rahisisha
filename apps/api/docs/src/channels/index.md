# src/channels/index.js

**FILE:** `apps/api/src/channels/index.js` (Week 30 Day 3, Batch 3b-2a, step 2)

## WHY THIS FILE EXISTS

The **directory of channels**: "give me the postman called `whatsapp`". The sender asks this file instead of importing every channel itself.

## WHY IMPORTANT

Adding WhatsApp later means: write `whatsappChannel.js` (same shape as `testChannel.js`) and add **one line here**. The sender, the queue and the admin actions do not change.

## DANGER

1. A channel that is **not listed** returns `null`. The sender then marks the line **failed** (`channel_unavailable`). It must never pretend such a line was sent.
2. Do not list a channel here until it really works.

## WHAT IT SOLVES

"Which code delivers a line whose channel is `sms`?"

## SYSTEM DESIGN PRINCIPLE

**Registry + adapter.** Open for extension (add a channel), closed for modification (the sender stays untouched).

## RULES

1. Keys are the names the database allows: `test`, `whatsapp`, `sms`.
2. Every value has `{ name, send({to, text}) }`.

## PRACTICAL EXAMPLE

```js
getChannel('test');       // the pretend postman
getChannel('whatsapp');   // null until it is built
```

## DECISIONS

Only `test` is registered today. `whatsapp` and `sms` are missing on purpose.

## WHERE USED

`notificationSender.service.js`.

## TRADEOFFS

+ One tiny file to extend. - A forgotten registration shows up as failed lines (loud, which is what we want).

## HOW TO USE

```js
import { getChannel } from '../channels/index.js';
```

**Reuse:** any "many providers, one job" problem: payment gateways (M-Pesa, card), file storage (disk, Cloudinary, S3), maps.

---

## LINE BY LINE

**`const REGISTRY = Object.freeze({ test: testChannel })`** The list of working channels, locked so it cannot change at runtime.

**`getChannel(name)`** Returns the channel only if `name` is a key that **belongs to our list**. The `hasOwnProperty` check matters: without it, asking for a name like `toString` would return a function that every object has, and the sender would try to use it as a channel.
