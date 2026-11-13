// =============================================================================
// FILE: apps/api/tests/errors/not-found.test.js
// not-found.test.js — proves unknown URLs answer in JSON, not HTML
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Reviewer feedback (Best Practices): a URL that matches no route got
//   Express's default HTML page ("Cannot GET /..."), while every other error
//   in our API is JSON. We added a catch-all 404 handler in app.js. This test
//   keeps it there.
//
// WHY IT IS IMPORTANT:
// - The website calls res.json() on every reply. HTML would crash it with
//   "Unexpected token <". A clean JSON 404 lets the page show a nice message.
//
// DANGER — IF THIS FILE DOES NOT EXIST:
// - Someone moves the catch-all ABOVE the routes "to tidy up". Real routes
//   now answer 404 and nothing warns us. Or someone deletes it, and HTML
//   errors come back silently.
//
// WHAT THIS TEST SOLVES (the 4 checks):
// - 1. GET on an unknown URL: 404 with the standard JSON error shape
// - 2. POST on an unknown URL: same (the handler covers every method)
// - 3. The answer is JSON (content-type), not HTML
// - 4. A real route (/health) still works, so the catch-all is not too greedy
//
// RULES:
// - No database needed. These routes never touch Postgres
// - Never copy the URL into the expected message (the handler must not echo it)
//
// PRACTICAL EXAMPLE:
// - A typo like GET /v1/prodcuts answers
//   { data: null, error: { code: 'not_found', message: 'Route not found' } }
//
// DECISIONS:
// - Test through supertest, like the other API tests: it exercises the real
//   app, with the real order of middleware
//
// WHERE USED / FUTURE USES:
// - Runs in `npm test`. If you add a new top-level router in app.js, this test
//   protects you from placing it below the catch-all.
//
// TRADEOFFS:
// + Very fast, no setup
// - Only proves the handler's shape, not every possible URL
//
// HOW TO RUN:
//   cd apps/api
//   npm test -- tests/errors/not-found.test.js
//
// GUIDE: apps/api/docs/tests/not-found.test.md (to be added)
// =============================================================================

import request from 'supertest';

import app      from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

// Close the app's pool so Jest can exit cleanly.
afterAll(async () => {
  await pool.end();
});

describe('Unknown routes answer in JSON', () => {

  // CHECK 1 — the main one.
  // WHAT SHOULD HAPPEN: no route matches, the catch-all answers 404 in JSON.
  // WHAT MUST NOT HAPPEN: Express's default HTML "Cannot GET ..." page.
  test('GET an unknown URL gives 404 with the standard error shape', async () => {
    const res = await request(app).get('/v1/this-route-does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      data: null,
      error: { code: 'not_found', message: 'Route not found' },
    });
  });

  // CHECK 2 — the handler uses app.use with no path, so it covers every method.
  test('POST an unknown URL gives the same 404', async () => {
    const res = await request(app).post('/v1/this-route-does-not-exist').send({});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  // CHECK 3 — the content type is JSON. This is the part the website relies on.
  test('The answer is JSON, not HTML', async () => {
    const res = await request(app).get('/nothing-here');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  // CHECK 4 — control. The catch-all must be LAST. If it were above the
  // routes, even /health would answer 404.
  test('A real route still works (the catch-all is not too greedy)', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});