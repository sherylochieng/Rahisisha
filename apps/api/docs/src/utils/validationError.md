# validationError.js

**FILE:** `apps/api/src/utils/validationError.js` (Week 30 Day 3, Batch 4b)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

Every controller that checks a form with Zod needs to answer a bad form in the
SAME way: HTTP 400, code "validation", and a "details" list that names each
broken field. This file writes that answer once.

## WHY IMPORTANT

The web forms read error.details.<field> to show the red message beside the
right box. If every controller built its own answer, one of them would drift
and a form would show nothing.

## DANGER

Do not change the shape of the answer: { error: { code, message, details } }.
The web app depends on exactly these three keys.

## WHAT IT SOLVES

One shared "your form has a problem here, and here" reply.

## SYSTEM DESIGN PRINCIPLE

DRY: one place for the error shape. (products.controller.js and
orders.controller.js still hold their own older copies; they can switch to this
one in a later clean-up, with no change in behaviour.)

## RULES

1. Call it with the response object and the error Zod gave you.
2. Never put the user's wrong value in the message (it may be private).

## PRACTICAL EXAMPLE

```
const parsed = Schema.safeParse(req.body);
if (!parsed.success) return validationError(res, parsed.error);
```

## WHERE USED

shopProfile.controller.js

## HOW TO USE

```
import { validationError } from '../utils/validationError.js';
```

## PIECE BY PIECE

```
issue.path.join('.')  = THE LABEL ON THE BROKEN BOX, e.g. "town".
issue.message         = WHAT IS WRONG WITH IT, e.g. "String must contain at most 60 character(s)".
res.status(400)       = "THE REQUEST WAS WRONG, NOT THE SERVER".
```
