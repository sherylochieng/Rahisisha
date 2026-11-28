# src/jobs/notificationLoop.js

**FILE:** `apps/api/src/jobs/notificationLoop.js` (Week 30 Day 3, Batch 3b-2a, step 5)

## WHY THIS FILE EXISTS

The **alarm clock** for the postman. Every few seconds it calls `processDueNotifications()` so queued messages leave the tray without anyone pressing a button.

## WHY IMPORTANT

A loop that crashes, or two rounds running on top of each other, is worse than no loop. This file makes sure rounds never overlap and one bad round never kills the server.

## DANGER

1. It is started **only** from `src/index.js`, never from `app.js`, so tests that import `app.js` never start a timer.
2. It is **off** unless `NOTIFICATIONS_WORKER=on`. With only the test channel, turning it on marks lines `sent` without telling anyone.
3. The timer is `unref`'d so it never keeps the process alive by itself.
4. On a free Render instance the loop stops when the API sleeps.
5. Polling keeps a sleeping Neon database awake while the API is awake.

## WHAT IT SOLVES

"Run this job every N seconds, safely, and let me stop it."

## SYSTEM DESIGN PRINCIPLE

Polling worker with a **no-overlap guard** and **error isolation**.

## RULES

1. One round at a time. If a round is still running, the next tick is skipped.
2. An error in a round is logged (message only) and the loop carries on.
3. `stop()` prevents any further rounds.

## PRACTICAL EXAMPLE

```js
const loop = startNotificationLoop({ db: pool });
loop.stop();
```

## DECISIONS

- Default 15 seconds, limited to 5 to 600 (`NOTIFICATIONS_INTERVAL_SECONDS`).
- `run` can be replaced, so the loop is tested without a database.

## WHERE USED

`apps/api/src/index.js`.

## TRADEOFFS

+ No extra service to pay for. - Not a real scheduler: it runs only while the API process is awake.

## HOW TO USE

Set `NOTIFICATIONS_WORKER=on` (and optionally `NOTIFICATIONS_INTERVAL_SECONDS`) where the API runs.

**Reuse:** any periodic background job (nightly reports, reminders, cleanup). The guard against overlap is the part people forget.

---

## LINE BY LINE

**`intervalFromEnv(value)`** Reads the setting. Not a number: 15 seconds. Otherwise clamps between 5 and 600 seconds and returns milliseconds.

**`startNotificationLoop({ db, intervalMs, run })`**
- `busy` is true while a round runs. `stopped` is true after `stop()`.
- **`tick()`**: if busy or stopped, do nothing. Otherwise mark busy, run the job, and in `finally` mark not busy. An error is caught and only its message is printed (never a phone or text).
- `setInterval(tick, intervalMs)` starts the clock; `unref()` stops it from keeping the process alive.
- Returns `{ stop, tick }`. `tick` is exposed for tests and a future "run now" button.
