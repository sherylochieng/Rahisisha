// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/pool.error-handler.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   It proves the database pool survives a dropped connection instead of
//   crashing the whole API.
//
// WHY IMPORTANT
//   On 23 November 2026 the chaos test cut the API's database connections
//   with pg_terminate_backend. The API crashed ("Unhandled 'error' event")
//   and stayed down until someone restarted it. The fix is one listener in
//   src/db/pool.js. This test makes sure nobody removes it.
//
// DANGER (what breaks without it)
//   A cleanup deletes the "unused" pool.on('error') lines. Everything keeps
//   working in every normal test. The first time the database restarts or a
//   connection blips in real life, the whole API goes offline.
//
// WHAT IT SOLVES
//   Locks in the fix with the exact situation that crashed it: a pool that
//   reports an error while no request is using it.
//
// SYSTEM DESIGN PRINCIPLE
//   "Turn every real failure into a test." The bug was found by breaking
//   the system on purpose. The test makes sure it stays fixed.
//
// RULES
//   1. NEVER delete this test to make a change pass.
//   2. No real database needed: the test only asks the pool object.
//
// PRACTICAL EXAMPLE
//   Real life: the phone line to the filing cabinet goes dead for a second.
//   Before: the whole shop closes. Now: a note is written in the log and the
//   next customer is served on a fresh line.
//
// DECISIONS
//   - Two tests: one asks "is someone listening for errors?", the other
//     does the dangerous thing (reports an error) and checks nothing crashes.
//   - console.error is silenced during the test so the output stays clean,
//     but we still check that a message was logged.
//
// WHERE USED
//   npm test (and the GitHub robot, on every push).
//
// TRADEOFFS
//   + Fast and needs no database.
//   - It does not cut a real connection. The real cut is the chaos test
//     described in RUNBOOK.md.
//
// HOW TO USE
//   npm test -- pool.error-handler
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
//
// 1. import { pool }  =  THE PHONE LINE TO THE DATABASE
//    The same shared pool the whole API uses. Creating it does not open a
//    connection, so no database is needed.
//
// 2. pool.listenerCount('error')  =  "IS ANYONE LISTENING?"
//    Real life: is there someone by the phone who will react if the line
//    goes dead? Without one, Node treats the report as fatal.
//
// 3. pool.emit('error', ...)  =  THE DEAD LINE
//    We make the pool report a dropped connection, the same report the real
//    database sent. If nobody listens, emit() throws and the test fails.
//    If the listener is there, it logs and carries on.
//
// 4. jest.spyOn(console, 'error')  =  A NOTE-TAKER
//    Catches the log line so it does not clutter the test output, and lets
//    us check that the problem was written down.

import { describe, test, expect, jest } from '@jest/globals';
import { pool } from '../src/db/pool.js';

describe('database pool: a dropped connection must not crash the API', () => {
  test('someone is listening for pool errors', () => {
    expect(pool.listenerCount('error')).toBeGreaterThan(0);
  });

  test('a dropped connection is logged and does not throw', () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      pool.emit('error', new Error('terminating connection due to administrator command'));
    }).not.toThrow();

    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});