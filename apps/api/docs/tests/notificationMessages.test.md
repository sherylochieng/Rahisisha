# tests/notificationMessages.test.js

**FILE:** `apps/api/tests/notificationMessages.test.js` (Week 30 Day 3, Batch 3b-2a, step 6)

## WHY THIS FILE EXISTS

Proves the wording file builds the right sentence for each message and keeps unsafe or oversized blanks under control.

## WHY IMPORTANT

These sentences go to real phones. A missing shop name, a leaked internal reason or a 5,000-character reason would embarrass the platform.

## DANGER

None. Pure functions: no database, no network.

## WHAT IT SOLVES

Confidence that each template says what we mean, only the suspend message shows the reason, and odd input is cleaned.

## SYSTEM DESIGN PRINCIPLE

Pure functions are the easiest thing to test: input in, text out.

## RULES

No database, no random values, one promise per test.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- notificationMessages
```

## DECISIONS

Checks use "contains" for the important words, not the whole sentence, so a small wording polish does not break the tests.

## WHERE USED / TRADEOFFS / HOW TO USE

Normal test run. + Instant. - Does not prove delivery (the sender tests do). `npm test -- notificationMessages`.

---

## LINE BY LINE (the six checks)

1. **Suspend** names the shop (in quotes), says "suspended", and shows `Reason: ...`.
2. **Reinstate, verify, un-verify** each name the shop and have their own key words ("open again", "now verified", "removed"), and none shows "Reason" or the internal note.
3. **Hidden characters and line breaks** (null character, newline, tab) are cleaned to single spaces, and no control character remains.
4. **Long blanks are cut:** a 300-letter shop name becomes 80, a 2,000-letter reason becomes 500.
5. **Missing blanks** use the fallbacks (`your shop`, `not given`) and never print `undefined`, even for `null` or a list payload.
6. **Unknown template** throws an error with `permanent = true`, and a name like `toString` is not mistaken for a template.
