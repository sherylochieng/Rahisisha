# tests/notificationSender.service.test.js

**FILE:** `apps/api/tests/notificationSender.service.test.js` (Week 30 Day 3, Batch 3b-2a, step 8)

## WHY THIS FILE EXISTS

Proves the postman works against the real database: it sends queued lines, records the result, retries failures with waiting times, gives up at the right moment, never double-picks a line, and never calls a missing channel "sent".

## WHY IMPORTANT

This code decides whether an owner is told. A bug can silently drop a message, send it twice, or mark an undelivered message as delivered.

## DANGER

Makes its own throw-away shop and lines and removes them. Uses **fake** channels, so nothing is ever sent. Always passes `tenantId`, so it never touches other shops' queued lines in the same database.

## WHAT IT SOLVES

Confidence in claim, send, record, retry, give-up and concurrency.

## SYSTEM DESIGN PRINCIPLE

Test the promises: "at least once", "never two senders on one line", "an unsent message is never called sent", "waiting grows after each failure".

## RULES

Random shop name per run, clean up everything, fake channels only.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- notificationSender
```

## DECISIONS

- Fake channels are plain objects with a `send()` function, plugged in through the `channels` option.
- Waiting times are checked as "about N minutes from now", not exact seconds.

## WHERE USED / TRADEOFFS / HOW TO USE

Normal test run. + Real database rules (SKIP LOCKED, RLS, CHECKs). - Needs migration 031. `npm test -- notificationSender`.

---

## LINE BY LINE

**Helpers.** `queueLine` puts a line in the outbox like an admin action would. `readLine` and `setLine` look at or change a line (head-office view). `fakeChannel` is a pretend postman that records its calls and can be told to fail. `round` runs one sender round for our shop only.

**The ten checks**

1. **Happy path:** one line is sent with the right phone and words, status `sent`, 1 attempt, `sent_at` set, no error.
2. **A sent line is not picked again.**
3. **Failure:** the line stays `queued`, keeps the error note, waits about 1 minute, and is not picked again straight away.
4. **Waiting grows (1, 5, 15, 60) and the last attempt gives up:** a line that already failed 4 times becomes `failed` on the 5th.
5. **No phone:** failed at once as `no_recipient`, and the channel is never called.
6. **Permanent error:** failed on the first attempt.
7. **No code for the channel** (`whatsapp`): failed as `channel_unavailable`, `sent_at` empty. It is never called sent.
8. **The real test channel** works through the real registry.
9. **Loan and sharing:** while one sender holds a line (it is slow), the loan is about 5 minutes, and a second sender starting at the same moment gets nothing. Exactly one send happens.
10. **Batch size:** with 3 lines and a batch of 2, the first round takes 2 and the second takes 1. This check caught a real bug in the first version of the query (it took 3 lines).

**How I know the checks have teeth:** treating `channel_unavailable` as success made check 7 fail, and removing the 5-minute loan made check 9 fail. Both were put back.
