// FILE: apps/api/tests/kms.test.js
//
// WHY THIS FILE EXISTS
//   kms.js protects every shop's WhatsApp token. If it breaks quietly (for
//   example it stores plain text, or reuses the same IV, or lets Brio read
//   Amina's token), nothing crashes. This test makes that kind of break loud.
//
// WHY IMPORTANT
//   Encryption bugs are invisible. A token that is "encrypted" with a bug
//   still looks like random text. Only a test can prove the lock really locks.
//
// DANGER (if this file does not exist)
//   - Someone "simplifies" kms.js to a fixed IV. Every token with the same
//     text now looks the same, and patterns leak.
//   - Someone removes the shop-id (AAD) lock. A copied row now decrypts.
//   - Someone adds console.log(token) while debugging and ships it.
//
// WHAT IT SOLVES (the 9 checks)
//   1  round trip: decrypt(encrypt(x)) is x
//   2  the stored text does not contain the secret
//   3  same secret twice gives two different stored texts (fresh IV)
//   4  another shop cannot decrypt it (AAD lock)
//   5  damaged text is refused (tamper check)
//   6  missing KMS_KEY throws
//   7  wrong-length KMS_KEY throws
//   8  an error message never contains the secret or the key
//   9  an empty shop id is refused
//
// SYSTEM DESIGN PRINCIPLE
//   Test the failure paths of security code, not only the happy path.
//
// RULES
//   1. The test makes its OWN random key. It never reads the real KMS_KEY.
//   2. Fake tokens only. Never put a real token in a test.
//   3. The real KMS_KEY is put back after the tests.
//
// DECISIONS (and WHY)
//   - No database: kms.js never touches one, so this test is fast and safe.
//   - Check 8 looks at error text because errors are what ends up in logs.
//
// WHERE USED
//   npm test, the Husky pre-push hook (full suite) and CI.
//
// TRADEOFFS
//   + Fast (no database), safe (fake data), runs anywhere.
//   - Proves our wrapper is correct, not that AES itself is strong (Node's
//     crypto library is trusted for that).
//
// HOW TO USE
//   cd apps/api
//   npm test -- tests/kms.test.js
//
// GUIDE DOC: apps/api/docs/tests/kms.test.md
//
// AI AUDIT NOTE
//   Test written by AI (allowed). Declared in AI_AUDIT_week_29_day2.md.

// crypto: Node's built-in toolbox. Here we only use it to make a random key.
import crypto from 'node:crypto';

// The two functions under test. This is a plain import (no mocking needed)
// because kms.js reads KMS_KEY when a function is CALLED, not when the file
// is loaded. So we can set the key in beforeAll, after this import.
import { encryptSecret, decryptSecret } from '../src/utils/kms.js';

// Two pretend shops. The ids are just fixed text, no database needed.
// Real life: Amina's Boutique and Brio Hardware.
const AMINA = '11111111-1111-1111-1111-111111111111';
const BRIO  = '22222222-2222-2222-2222-222222222222';

// A pretend token. Real Meta tokens look similar (long, starts with "EAA").
// This one is FAKE and must stay fake.
const FAKE_TOKEN = 'EAAG-fake-token-for-tests-only-123456';

let realKey;       // your own KMS_KEY from .env, saved so we can put it back
let testKey;       // the throw-away key used only by this file

// beforeAll: runs ONCE before the checks.
// We swap in a random key so the test never depends on your real one (and
// so CI, which has no KMS_KEY, still works).
beforeAll(() => {
  realKey = process.env.KMS_KEY;
  testKey = crypto.randomBytes(32).toString('base64');   // 32 bytes = 256 bits
  process.env.KMS_KEY = testKey;
});

// afterAll: runs ONCE after the checks. Put the real key back (or remove ours
// if there was none) so nothing leaks into other test files.
afterAll(() => {
  if (realKey === undefined) delete process.env.KMS_KEY;
  else process.env.KMS_KEY = realKey;
});

describe('kms.js (encrypt tokens at rest)', () => {
  // CHECK 1: the basic promise. Lock it, unlock it, same thing comes back.
  // Real life: put a letter in a safe, open the safe, the letter is intact.
  test('1. round trip returns the original secret', () => {
    const stored = encryptSecret(FAKE_TOKEN, AMINA);
    expect(decryptSecret(stored, AMINA)).toBe(FAKE_TOKEN);
  });

  // CHECK 2: what goes into the database must not contain the token.
  // "v1." proves the stored text uses our versioned format.
  test('2. the stored text does not contain the secret', () => {
    const stored = encryptSecret(FAKE_TOKEN, AMINA);
    expect(stored).not.toContain(FAKE_TOKEN);
    expect(stored.startsWith('v1.')).toBe(true);
  });

  // CHECK 3: a fresh random IV every time. If the IV were fixed, locking the
  // same token twice would give the same result, and an attacker could spot
  // repeats. Real life: a new random padlock number each time.
  test('3. same secret twice gives different stored texts (fresh IV)', () => {
    const a = encryptSecret(FAKE_TOKEN, AMINA);
    const b = encryptSecret(FAKE_TOKEN, AMINA);
    expect(a).not.toBe(b);
  });

  // CHECK 4: the shop lock (AAD). Amina's scrambled token is handed to Brio's
  // code path. It must refuse. This is the "copy a row to another shop" attack.
  test('4. another shop cannot decrypt it', () => {
    const stored = encryptSecret(FAKE_TOKEN, AMINA);
    expect(() => decryptSecret(stored, BRIO)).toThrow('Could not decrypt');
  });

  // CHECK 5: tampering. We flip ONE bit of the scrambled data. AES-GCM must
  // notice and refuse (that is the "tag", a tamper seal).
  // Second half: text that is not our format at all is refused with a clear
  // message, instead of crashing in a strange place.
  test('5. damaged text is refused', () => {
    const [v, iv, tag, data] = encryptSecret(FAKE_TOKEN, AMINA).split('.');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;                                   // change one bit
    const damaged = [v, iv, tag, flipped.toString('base64')].join('.');
    expect(() => decryptSecret(damaged, AMINA)).toThrow('Could not decrypt');
    expect(() => decryptSecret('not-a-stored-secret', AMINA)).toThrow('unknown format');
  });

  // CHECK 6: no key = loud failure. The dangerous alternative would be
  // "no key, so store plain text". We prove that never happens.
  // try/finally puts the key back even if the check fails, so the next
  // checks are not affected.
  test('6. a missing KMS_KEY throws', () => {
    delete process.env.KMS_KEY;
    try {
      expect(() => encryptSecret(FAKE_TOKEN, AMINA)).toThrow('KMS_KEY is not set');
    } finally {
      process.env.KMS_KEY = testKey;
    }
  });

  // CHECK 7: a key of the wrong size (a typo, a half-pasted key) is refused.
  test('7. a wrong-length KMS_KEY throws', () => {
    process.env.KMS_KEY = Buffer.from('too-short').toString('base64');
    try {
      expect(() => encryptSecret(FAKE_TOKEN, AMINA)).toThrow('32 bytes');
    } finally {
      process.env.KMS_KEY = testKey;
    }
  });

  // CHECK 8: errors end up in logs. So an error must never contain the
  // token, the key or the stored text. We trigger a real error (Brio tries
  // Amina's token) and look inside its message.
  test('8. error messages never contain the secret or the key', () => {
    const stored = encryptSecret(FAKE_TOKEN, AMINA);
    let message = '';
    try { decryptSecret(stored, BRIO); } catch (err) { message = String(err.message); }
    expect(message).not.toContain(FAKE_TOKEN);
    expect(message).not.toContain(testKey);
    expect(message).not.toContain(stored);
  });

  // CHECK 9: an empty or missing shop id would silently remove the shop lock.
  // So it is refused, for both functions.
  test('9. an empty shop id is refused', () => {
    expect(() => encryptSecret(FAKE_TOKEN, '')).toThrow('context');
    expect(() => decryptSecret('v1.a.b.c', undefined)).toThrow('context');
  });
});