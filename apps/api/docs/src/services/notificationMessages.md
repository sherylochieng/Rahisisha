# src/services/notificationMessages.js

**FILE:** `apps/api/src/services/notificationMessages.js` (Week 30 Day 3, Batch 3b-2a, step 3)

## WHY THIS FILE EXISTS

The **words** of every message live here, in one place. The outbox row stores a template **name** (`shop.suspended`) and blanks (shop name, reason). This file turns them into the sentence the owner reads.

## WHY IMPORTANT

Wording changes often (tone, Swahili, length limits). In one file, a wording change never touches the queue, the sender or the channels.

## DANGER

1. The blanks come from people (a shop name, an admin's reason). They are cleaned here: control characters removed, lengths limited.
2. Keep messages short. SMS charges per 160-character part, and WhatsApp templates must be approved word for word later.
3. Never put secrets, tokens in links, or other customers' data in a message.

## WHAT IT SOLVES

"What exactly do we tell Mama Njeri when her shop is suspended?"

## SYSTEM DESIGN PRINCIPLE

**Separation of concerns:** what happened (outbox row) / what we say (this file) / how it travels (channel).

## RULES

1. `renderMessage(template, payload)` returns plain text.
2. An unknown template throws a **permanent** error.
3. Only the suspend message shows the admin's reason.

## PRACTICAL EXAMPLE

```js
renderMessage('shop.suspended', { shopName: 'Mama Njeri Groceries', reason: 'fake M-Pesa messages' });
// Rahisisha Biashara: your shop "Mama Njeri Groceries" has been suspended. Reason: fake M-Pesa messages. If you think this is a mistake, please contact Rahisisha support.
```

## DECISIONS

- English first. A Swahili version can be a second table keyed by language later.
- Every message starts with the platform name so the owner knows who is writing.

## WHERE USED

`notificationSender.service.js`.

## TRADEOFFS

+ All wording in one place. - Wording is code, so a change needs a deploy.

## HOW TO USE

```js
import { renderMessage } from './notificationMessages.js';
```

**Reuse:** any app with automatic messages (bank alerts, delivery updates, school reminders) keeps its wording table separate from the code that sends.

---

## LINE BY LINE

**`BRAND`** The platform name placed at the front of every message.

**`SHOP_NAME_MAX`, `REASON_MAX`** Limits (80 and 500 characters).

**`clean(value, max, fallback)`** Makes one blank safe: if it is not text, use empty; replace hidden control characters (including line breaks and tabs) with spaces; squash repeated spaces; trim; if nothing is left, use the fallback (`your shop`, `not given`); cut to `max` real characters (an emoji counts as one).

**`WORDING`** A table from template name to a function that builds the sentence. Four entries: suspended, reinstated, verified, unverified. The keys come from `NOTIFICATION_TEMPLATES`, so a typo is impossible.

**`renderMessage`** Looks up the template (using `hasOwnProperty` so names like `toString` are not mistaken for templates). Unknown name: throws an error with `permanent = true`. A missing or odd payload (null, a list) is treated as empty, so blanks use their fallbacks and `undefined` is never printed.
