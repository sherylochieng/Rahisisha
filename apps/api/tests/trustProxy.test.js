// =============================================================================
// FILE: apps/api/tests/trustProxy.test.js   (Week 30 Day 3, Batch 1: trust proxy)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the TRUST_PROXY setting in app.js does its one job: behind a proxy
//   (like Render), the API reads the REAL visitor's address from the proxy's
//   note (the X-Forwarded-For header), and a visitor cannot fake that address.
//
// WHY IMPORTANT
//   The admin login brake counts tries per address, and every audit receipt
//   records an address. If the setting is wrong, every visitor looks like the
//   same address (brake useless, receipts useless), or worse, a thief can write
//   any address he likes and dodge the brake.
//
// DANGER
//   Never set TRUST_PROXY to `true` in app.js. `true` believes the whole note,
//   including the part a visitor wrote himself. This test would catch that.
//
// WHAT IT SOLVES
//   Confidence that: nothing set = nothing trusted (safe default), a number =
//   believe exactly that many proxy doors, and a faked address is ignored.
//
// SYSTEM DESIGN PRINCIPLE
//   Trust boundary: only believe the doors you control or know. Test the
//   boundary with an attacker's header, not only with the happy path.
//
// RULES
//   1. No database needed here. It only reads how the app is configured.
//   2. Each case loads a FRESH copy of app.js with its own TRUST_PROXY value.
//   3. The real TRUST_PROXY is put back after the tests.
//
// PRACTICAL EXAMPLE
//   Render sends:  X-Forwarded-For: <what the visitor wrote>, <real visitor>
//   With TRUST_PROXY=1 we use the LAST name (the one Render added), not the first.
//
// DECISIONS
//   - The test copies the app's own 'trust proxy' value into a tiny test
//     server, so it checks exactly what app.js decided, with no fake route
//     added to the real app.
//
// WHERE USED
//   Normal test run (and the pre-push hook).
//
// TRADEOFFS
//   + Fast, no database.
//   - It cannot know how many doors Render really has. That is proved once on
//     the live server (the audit receipt must show your real address).
//
// HOW TO USE
//   cd apps/api ; npm test -- trustProxy
// =============================================================================

// PIECE BY PIECE
//   loadApp(value)  = load a fresh app.js with TRUST_PROXY set to `value`.
//   whoDoesItSee()  = a tiny server using the app's own setting, answering with req.ip.
//   REAL / FAKE     = the real visitor's address, and an address a thief wrote.

import express from 'express';
import request from 'supertest';

const REAL = '41.90.1.10';    // the real visitor (what Render adds to the note)
const FAKE = '9.9.9.9';       // an address a thief wrote himself, to dodge the brake

let realSetting;              // your own TRUST_PROXY, put back at the end
let counter = 0;              // makes each import a fresh copy of app.js

beforeAll(() => { realSetting = process.env.TRUST_PROXY; });

afterAll(() => {
  if (realSetting === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = realSetting;
});

// Load a brand-new copy of app.js (the ?n= makes Node treat it as a new file),
// with TRUST_PROXY set (or removed when value is undefined).
async function loadApp(value) {
  if (value === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = value;
  counter += 1;
  const mod = await import(`../src/app.js?trust=${counter}`);
  return mod.default;
}

// A tiny server that uses the SAME 'trust proxy' value app.js chose,
// and simply answers with the address Express worked out.
function whoDoesItSee(realApp) {
  const probe = express();
  probe.set('trust proxy', realApp.get('trust proxy'));
  probe.get('/ip', (req, res) => res.json({ ip: req.ip }));
  return probe;
}

describe('TRUST_PROXY (Week 30 Day 3, Batch 1)', () => {

  // CHECK 1. SAFE DEFAULT: nothing set = believe nobody.
  test('1. unset: the note is ignored (laptop and tests behave as before)', async () => {
    const app = await loadApp(undefined);
    const res = await request(whoDoesItSee(app)).get('/ip').set('X-Forwarded-For', `${FAKE}, ${REAL}`);
    expect(res.body.ip).not.toBe(REAL);
    expect(res.body.ip).not.toBe(FAKE);
  });

  // CHECK 2. ONE DOOR: believe the one proxy, read the real visitor.
  test('2. TRUST_PROXY=1: the real visitor address is used', async () => {
    const app = await loadApp('1');
    const res = await request(whoDoesItSee(app)).get('/ip').set('X-Forwarded-For', REAL);
    expect(res.body.ip).toBe(REAL);
  });

  // CHECK 3. THE THIEF: he writes a fake address; the proxy adds the real one after it.
  test('3. TRUST_PROXY=1: an address the visitor wrote himself is ignored', async () => {
    const app = await loadApp('1');
    const res = await request(whoDoesItSee(app)).get('/ip').set('X-Forwarded-For', `${FAKE}, ${REAL}`);
    expect(res.body.ip).toBe(REAL);
    expect(res.body.ip).not.toBe(FAKE);
  });

  // CHECK 4. BAD VALUES: nonsense or zero must NOT turn trust on.
  test.each(['0', '', 'abc', '-1', 'true'])('4. TRUST_PROXY=%p: trust stays off', async (value) => {
    const app = await loadApp(value);
    expect(app.get('trust proxy')).toBeFalsy();
  });
});
