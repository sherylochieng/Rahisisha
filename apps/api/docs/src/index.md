# src/index.js

**FILE:** `apps/api/src/index.js` (updated in Week 30 Day 3, Batch 3b-2a)

## WHY THIS FILE EXISTS

The server's **entry point**: the only place `app.listen()` is called. Tests import `app.js` and never this file.

## WHAT CHANGED IN BATCH 3b-2a (nothing removed)

Two new imports (`pool` and `startNotificationLoop`) and one new block at the end:

```js
if (process.env.NOTIFICATIONS_WORKER === 'on') {
  startNotificationLoop({ db: pool });
  console.log('Notification sender is ON (checks the outbox regularly)');
}
```

## WHY HERE

The sender is a background timer, and only the real server should start timers. Because tests import `app.js`, they never start it. It is **off by default**, so nothing changes until `NOTIFICATIONS_WORKER=on` is set (for example in Render's environment settings).

## DANGER

With only the `test` channel, switching it on marks queued messages as `sent` without telling anyone. Switch it on to watch the outbox empty, not to expect real messages.

## LINE BY LINE (new lines only)

**`import { pool } from './db/pool.js'`** The shared database connection pool.

**`import { startNotificationLoop } ...`** The alarm clock from `jobs/notificationLoop.js`.

**`if (process.env.NOTIFICATIONS_WORKER === 'on')`** The switch. Anything other than the exact word `on` leaves it off.

**`startNotificationLoop({ db: pool })`** Starts checking the outbox every 15 seconds (or `NOTIFICATIONS_INTERVAL_SECONDS`).
