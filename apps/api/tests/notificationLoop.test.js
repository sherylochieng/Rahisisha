// =============================================================================
// FILE: apps/api/tests/notificationLoop.test.js   (Week 30 Day 3, Batch 3b-2a, step 7)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the alarm clock behaves: it ticks, never overlaps two rounds, survives
//   an error in a round, and really stops.
//
// WHY IMPORTANT
//   A timer bug runs forever in the background: double sending, a crash loop or a
//   server that never exits.
//
// DANGER
//   Uses real timers with very short intervals (20 ms). No database. The fake
//   "run" function replaces the real sender, so nothing is ever sent.
//
// WHAT IT SOLVES
//   Confidence in the loop without needing a database.
//
// SYSTEM DESIGN PRINCIPLE
//   Inject the dependency (run) so the loop is tested alone.
//
// RULES
//   1. Always stop() the loop at the end of each test.
//   2. Waits are short but generous so the test is not flaky.
//
// PRACTICAL EXAMPLE
//   cd apps/api ; npm test -- notificationLoop
//
// DECISIONS
//   Console errors are muted inside the error test so the output stays clean.
//
// WHERE USED
//   Normal test run.
//
// TRADEOFFS
//   + No database. - Uses real time, so a few hundred milliseconds per test.
//
// HOW TO USE
//   npm test -- notificationLoop
// =============================================================================

import { jest } from '@jest/globals';
import { startNotificationLoop, intervalFromEnv } from '../src/jobs/notificationLoop.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('notification loop (Week 30 Day 3, Batch 3b-2a)', () => {

  // CHECK 1. It calls run() again and again with the db it was given.
  test('1. runs the job repeatedly with the given db', async () => {
    const run = jest.fn(async () => ({}));
    const loop = startNotificationLoop({ db: 'DB', intervalMs: 20, run });
    await wait(150);
    loop.stop();
    expect(run.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(run).toHaveBeenCalledWith('DB');
  });

  // CHECK 2. A slow round is never overlapped by the next tick.
  test('2. never runs two rounds at the same time', async () => {
    let active = 0;
    let maxActive = 0;
    const run = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await wait(80);
      active -= 1;
    };
    const loop = startNotificationLoop({ db: null, intervalMs: 10, run });
    await wait(300);
    loop.stop();
    await wait(100);
    expect(maxActive).toBe(1);
  });

  // CHECK 3. An error in a round is swallowed and the loop carries on.
  test('3. survives an error and keeps going', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let calls = 0;
    const run = async () => {
      calls += 1;
      if (calls === 1) throw new Error('database blinked');
    };
    const loop = startNotificationLoop({ db: null, intervalMs: 20, run });
    await wait(150);
    loop.stop();
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // CHECK 4. After stop() nothing runs, even a manual tick.
  test('4. stop() ends the loop for good', async () => {
    const run = jest.fn(async () => ({}));
    const loop = startNotificationLoop({ db: null, intervalMs: 20, run });
    await wait(80);
    loop.stop();
    const before = run.mock.calls.length;
    await wait(120);
    expect(await loop.tick()).toBeNull();
    expect(run.mock.calls.length).toBe(before);
  });

  // CHECK 5. The interval setting is read and limited.
  test('5. the interval setting defaults to 15 s and is limited to 5..600 s', () => {
    expect(intervalFromEnv(undefined)).toBe(15000);
    expect(intervalFromEnv('abc')).toBe(15000);
    expect(intervalFromEnv('1')).toBe(5000);
    expect(intervalFromEnv('30')).toBe(30000);
    expect(intervalFromEnv('99999')).toBe(600000);
  });
});
