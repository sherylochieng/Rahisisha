// =============================================================================
// FILE: apps/api/src/jobs/notificationLoop.js   (Week 30 Day 3, Batch 3b-2a: the sender, step 5)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The alarm clock for the postman. Every few seconds it calls
//   processDueNotifications() so queued messages leave the tray without anyone
//   pressing a button.
//
// WHY IMPORTANT
//   A loop that crashes, or two rounds that run on top of each other, would be
//   worse than no loop. This file makes sure a round never overlaps another and
//   one bad round never kills the server.
//
// DANGER
//   1. It is started ONLY from src/index.js (never from app.js), so tests that
//      import app.js never start a background timer.
//   2. It is OFF unless NOTIFICATIONS_WORKER=on. Turning it on with only the test
//      channel marks lines 'sent' without telling anyone.
//   3. The timer is unref'd so it never keeps the process alive by itself.
//   4. On a free Render instance the loop stops when the API sleeps.
//   5. Polling keeps a sleeping Neon database awake while the API is awake.
//
// WHAT IT SOLVES
//   "Run this job every N seconds, safely, and let me stop it."
//
// SYSTEM DESIGN PRINCIPLE
//   Polling worker with a no-overlap guard and error isolation.
//
// RULES
//   1. One round at a time. If a round is still running, the next tick is skipped.
//   2. An error in a round is logged (message only) and the loop carries on.
//   3. stop() prevents any further rounds.
//
// PRACTICAL EXAMPLE
//   const loop = startNotificationLoop({ db: pool });
//   ...
//   loop.stop();
//
// DECISIONS
//   - Default 15 seconds: quick enough for "you were suspended" messages, gentle on
//     the database. Change with NOTIFICATIONS_INTERVAL_SECONDS (5 to 600).
//   - `run` can be replaced, so the loop is tested without a database.
//
// WHERE USED
//   apps/api/src/index.js
//
// TRADEOFFS
//   + No extra service to pay for. - Not a real scheduler: it only runs while the
//     API process is awake.
//
// HOW TO USE
//   Set NOTIFICATIONS_WORKER=on (and optionally NOTIFICATIONS_INTERVAL_SECONDS).
// =============================================================================

// PIECE BY PIECE
//   intervalFromEnv()        = read and clamp the interval setting.
//   startNotificationLoop()  = start the timer; returns { stop, tick }.

import { processDueNotifications } from '../services/notificationSender.service.js';

// 15 seconds unless the setting says otherwise (limited to 5..600).
export function intervalFromEnv(value = process.env.NOTIFICATIONS_INTERVAL_SECONDS) {
  const seconds = parseInt(value, 10);
  if (Number.isNaN(seconds)) return 15000;
  return Math.min(Math.max(seconds, 5), 600) * 1000;
}

// Start the timer. options: { db, intervalMs, run }
export function startNotificationLoop({ db, intervalMs = intervalFromEnv(), run = processDueNotifications } = {}) {
  let busy = false;      // true while a round is running
  let stopped = false;   // true after stop()

  // One round, never overlapping, never throwing.
  async function tick() {
    if (busy || stopped) return null;
    busy = true;
    try {
      return await run(db);
    } catch (err) {
      // Only the message: it never contains the phone or the text.
      console.error('[notifications] round failed:', err && err.message ? err.message : err);
      return null;
    } finally {
      busy = false;
    }
  }

  const timer = setInterval(tick, intervalMs);
  // Do not keep the process alive just for this timer.
  if (typeof timer.unref === 'function') timer.unref();

  return {
    // Stop the loop for good.
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    // Exposed so tests (and a future "run now" button) can trigger one round.
    tick,
  };
}
