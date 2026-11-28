# tests/notificationLoop.test.js

**FILE:** `apps/api/tests/notificationLoop.test.js` (Week 30 Day 3, Batch 3b-2a, step 7)

## WHY THIS FILE EXISTS

Proves the alarm clock behaves: it ticks, never overlaps two rounds, survives an error in a round, and really stops.

## WHY IMPORTANT

A timer bug runs forever in the background: double sending, a crash loop, or a server that never exits.

## DANGER

Uses real timers with very short intervals (20 ms). No database. A fake `run` replaces the real sender, so nothing is ever sent.

## WHAT IT SOLVES

Confidence in the loop without needing a database.

## SYSTEM DESIGN PRINCIPLE

Inject the dependency (`run`) so the loop is tested alone.

## RULES

Always `stop()` the loop at the end of each test. Waits are generous so tests are not flaky.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- notificationLoop
```

## DECISIONS

`console.error` is muted inside the error test so the output stays clean.

## WHERE USED / TRADEOFFS / HOW TO USE

Normal test run. + No database. - Uses real time (a few hundred milliseconds). `npm test -- notificationLoop`.

---

## LINE BY LINE (the five checks)

1. **Runs repeatedly** with the db it was given (at least 3 calls in 150 ms at a 20 ms interval).
2. **Never overlaps:** a round that takes 80 ms with a 10 ms clock never runs twice at once (the highest number running at the same moment is 1).
3. **Survives an error:** the first round throws, the loop keeps going, and the error message was logged.
4. **`stop()` is final:** no calls after stopping, and even a manual `tick()` returns `null`.
5. **Interval setting:** missing or non-number gives 15 s; 1 becomes 5 s; 30 stays 30 s; 99999 becomes 600 s.
