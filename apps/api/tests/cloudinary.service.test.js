// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/cloudinary.service.test.js   (Week 30, product photos)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   It proves the two photo rules in services/cloudinary.service.js:
//   (1) the signed permit is built the way Cloudinary expects and never leaks
//   the secret, and (2) only a photo address from OUR cloud and THIS shop's
//   folder is accepted.
//
// WHY IMPORTANT
//   A wrong signature = every upload fails. A loose address check = a shop
//   can show another shop's photo or a harmful link on its product.
//
// DANGER (what breaks without it)
//   Someone "simplifies" the address check to startsWith("https://") and
//   look-alike or foreign addresses slip through, unnoticed.
//
// WHAT IT SOLVES
//   Locks both rules in with friendly AND attacker examples.
//
// SYSTEM DESIGN PRINCIPLE
//   Test security rules with the attacker's examples, not only friendly ones.
//   Pure functions (no database, no network) are the cheapest tests.
//
// RULES
//   1. NEVER delete a "REFUSED" test to make a change pass.
//   2. Use FAKE settings only (cloud "democloud", secret "test-secret").
//      Never put a real key or secret in a test.
//   3. Put the real settings back after each test (afterEach).
//
// PRACTICAL EXAMPLE
//   Shop abc, photo https://res.cloudinary.com/democloud/image/upload/v1/rahisisha/abc/x.jpg
//   -> accepted for shop abc, refused for shop ab and for shop xyz.
//
// DECISIONS
//   - The expected signature is computed in the test with Node crypto, written
//     out by hand, not by calling our own function (so the test is independent).
//   - No database, so it runs in milliseconds.
//
// HOW TO RUN
//   npm test -- tests/cloudinary.service.test.js      (from apps/api)
// ═══════════════════════════════════════════════════════════

// PIECE BY PIECE (the whole file, in plain words)
//
// 1. import { createHash } from 'node:crypto'
//    = "borrow Node's built-in scrambler (SHA-1)". We use it in the test to
//    work out the correct signature by hand, so the test does not just trust
//    our own code. Real life: a second shopkeeper re-counts the till.
//
// 2. import { makeUploadSignature, isShopImageUrl, shopFolder } ...
//    = "bring in the three things we are testing" from the service file.
//
// 3. describe('...', () => { ... })
//    = "a labelled group of tests". Real life: a page in the exercise book
//    titled "Permit rules" and another titled "Address rules".
//
// 4. test('sentence', () => { ... })
//    = "one check". The sentence says what must be true. If it fails, the name
//    alone tells you which rule broke. Real life: one tick-box on a checklist.
//
// 5. expect(actual).toBe(wanted)
//    = "what we got must equal what we wanted, otherwise shout". Real life:
//    the cashier counts the change and says "KES 150? yes, matches the receipt".
//
// 6. beforeEach / afterEach
//    = "set the table before each test and clear it after". We put FAKE
//    settings in, run the test, then put the real ones back so no test leaves
//    a mess for the next.
//
// 7. REFUSED tests
//    = the attacker's examples. Real life: you test the shop door by trying the
//    wrong key, not only the right one.

import { createHash } from 'node:crypto';
import {
  makeUploadSignature,
  isShopImageUrl,
  shopFolder,
} from '../src/services/cloudinary.service.js';

const KEYS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
let saved;

// PIECE BY PIECE
//   beforeEach = "before every test, put FAKE settings on the table"
//   afterEach  = "after every test, put the real ones back exactly as found"
// Real life: borrowing the till for a drill and returning it with the same cash.
beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  process.env.CLOUDINARY_CLOUD_NAME = 'democloud';
  process.env.CLOUDINARY_API_KEY = 'demo-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// GROUP 1: THE PERMIT. Real life: the stamped slip the security guard checks.
describe('makeUploadSignature', () => {
  // Check 1: the permit is the stamp Cloudinary expects. We rebuild the stamp
  // by hand (same ingredients, same order) and compare. Same = correct recipe.
  test('signs "folder=...&timestamp=..." plus the secret with SHA-1', () => {
    const out = makeUploadSignature('abc', 1700000000);
    const expected = createHash('sha1')
      .update('folder=rahisisha/abc&timestamp=1700000000test-secret')
      .digest('hex');
    expect(out.signature).toBe(expected);
  });

  // Check 2: the slip names THIS shop's own shelf. Real life: Mama Njeri's
  // photos go on Mama Njeri's shelf, never on the shared one.
  test('puts the permit in this shop\'s own folder', () => {
    const out = makeUploadSignature('abc', 1700000000);
    expect(out.folder).toBe('rahisisha/abc');
    expect(shopFolder('abc')).toBe('rahisisha/abc');
  });

  // Check 3: two shops never get the same slip. Different shelf, different stamp.
  test('two shops get different folders and different signatures', () => {
    const a = makeUploadSignature('shop-a', 1700000000);
    const b = makeUploadSignature('shop-b', 1700000000);
    expect(a.folder).not.toBe(b.folder);
    expect(a.signature).not.toBe(b.signature);
  });

  // Check 4: the secret stamp stays in the drawer. We turn the whole answer into
  // text and make sure the secret word is nowhere inside it.
  test('never contains the API secret anywhere in the answer', () => {
    const out = makeUploadSignature('abc', 1700000000);
    expect(JSON.stringify(out)).not.toContain('test-secret');
  });

  // Check 5: the slip carries what the browser needs to knock on Cloudinary's
  // door: which cloud, which public key, and the time it was issued.
  test('returns what the browser needs: cloudName, apiKey, timestamp', () => {
    const out = makeUploadSignature('abc', 1700000000);
    expect(out.cloudName).toBe('democloud');
    expect(out.apiKey).toBe('demo-key');
    expect(out.timestamp).toBe(1700000000);
  });

  // Check 6: if the server has no Cloudinary settings, it must fail with a clear
  // code, not crash. Real life: "till closed" sign instead of a locked door.
  // We catch the error ourselves with try/catch so the test can look at its code.
  test('missing settings -> error with code uploads_not_set_up', () => {
    delete process.env.CLOUDINARY_API_SECRET;
    let err;
    try { makeUploadSignature('abc'); } catch (e) { err = e; }
    expect(err).toBeDefined();
    expect(err.code).toBe('uploads_not_set_up');
  });
});

// GROUP 2: THE ADDRESS GUARD. Real life: only delivery slips with OUR shop's
// name on them get accepted at the stall.
describe('isShopImageUrl', () => {
  // `ok` = a perfect address for shop "abc". Every REFUSED test below changes
  // exactly ONE thing in it, so you can see which change gets caught.
  const ok = 'https://res.cloudinary.com/democloud/image/upload/v1/rahisisha/abc/dress.jpg';

  // Friendly case first: the right address for the right shop is accepted.
  test('ACCEPTED: our cloud, this shop\'s folder', () => {
    expect(isShopImageUrl(ok, 'abc')).toBe(true);
  });

  // Shop xyz tries to use shop abc's photo. Must be refused.
  test('REFUSED: another shop\'s folder', () => {
    expect(isShopImageUrl(ok, 'xyz')).toBe(false);
  });

  // "ab" is the beginning of "abc". A sloppy check would say yes. Ours looks for
  // the whole folder name between slashes, so it says no.
  test('REFUSED: shop id that is only the START of the real folder name', () => {
    expect(isShopImageUrl(ok, 'ab')).toBe(false);
  });

  // Someone else's Cloudinary account (a stranger's photo store). Refused.
  test('REFUSED: a different Cloudinary cloud', () => {
    expect(isShopImageUrl(ok.replace('democloud', 'othercloud'), 'abc')).toBe(false);
  });

  // A random website that only COPIES our folder pattern. Refused.
  test('REFUSED: a random website', () => {
    expect(isShopImageUrl('https://evil.example.com/rahisisha/abc/x.jpg', 'abc')).toBe(false);
  });

  // http (not https) can be tampered with on the way. Refused.
  test('REFUSED: plain http (not https)', () => {
    expect(isShopImageUrl(ok.replace('https://', 'http://'), 'abc')).toBe(false);
  });

  // Garbage in: nothing, null, a number, empty text, or a 600-character address.
  // None of these may crash the check; each must just answer "no".
  test('REFUSED: not text, empty, or far too long', () => {
    expect(isShopImageUrl(undefined, 'abc')).toBe(false);
    expect(isShopImageUrl(null, 'abc')).toBe(false);
    expect(isShopImageUrl(42, 'abc')).toBe(false);
    expect(isShopImageUrl('', 'abc')).toBe(false);
    expect(isShopImageUrl(ok + 'a'.repeat(600), 'abc')).toBe(false);
  });

  // If we do not know our own cloud name, we cannot vouch for any address.
  test('REFUSED: when uploads are not set up (we cannot vouch for anything)', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(isShopImageUrl(ok, 'abc')).toBe(false);
  });
});