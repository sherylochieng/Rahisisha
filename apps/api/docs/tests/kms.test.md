# kms.test.js — Proof That the Token Lock Really Locks

**File:** `apps/api/tests/kms.test.js`
**Doc:** `apps/api/docs/tests/kms.test.md`
**Protects:** `apps/api/src/utils/kms.js`
**Run with:** `cd apps/api` then `npm test -- tests/kms.test.js`

---

## WHY THIS FILE EXISTS

`kms.js` protects every shop's WhatsApp token. If it breaks quietly (stores plain
text, reuses an IV, lets Brio read Amina's token), nothing crashes. This test
makes that kind of break loud.

Real-life picture: a bank tests its vault door every morning by trying to open it
the wrong ways, not only the right way.

## WHY IMPORTANT

Encryption bugs are invisible. A token "encrypted" with a bug still looks like
random text. Only a test can prove the lock really locks.

## DANGER (if this file does not exist)

- Someone "simplifies" `kms.js` to a fixed IV. Every identical token now looks
  identical, and patterns leak.
- Someone removes the shop-id (AAD) lock. A copied row now decrypts.
- Someone adds `console.log(token)` while debugging and ships it.

## WHAT IT SOLVES (the 9 checks)

| # | Check | What it proves |
|---|-------|----------------|
| 1 | Round trip | Lock then unlock returns the same token |
| 2 | Stored text hides the secret | The database never holds the plain token; format starts with `v1.` |
| 3 | Same secret twice differs | A fresh random IV is used every time |
| 4 | Another shop cannot decrypt | The shop lock (AAD) works: row-swap attack fails |
| 5 | Damaged text is refused | One flipped bit is detected (tamper seal); non-format text gives a clear error |
| 6 | Missing `KMS_KEY` throws | We never silently store plain text |
| 7 | Wrong-length `KMS_KEY` throws | A half-pasted key is caught |
| 8 | Errors never contain the secret or key | Error text is what ends up in logs |
| 9 | Empty shop id refused | The shop lock cannot be silently skipped |

## SYSTEM DESIGN PRINCIPLE

**Test the failure paths of security code, not only the happy path.**

## RULES

1. The test makes its OWN random key. It never uses your real `KMS_KEY`.
2. Fake tokens only. Never put a real token in a test.
3. The real `KMS_KEY` is put back after the tests.

---

## THE CODE, PIECE BY PIECE

```js
beforeAll(() => { realKey = process.env.KMS_KEY; testKey = randomBytes(32)...; process.env.KMS_KEY = testKey; });
afterAll(() => { put the real key back, or remove ours });
```
Swap in a throw-away key, then restore. This is why CI (which has no `KMS_KEY`)
still passes. *Real life:* borrow a spare key for the test, give your own back.

```js
const AMINA = '1111...'; const BRIO = '2222...';
const FAKE_TOKEN = 'EAAG-fake-token-for-tests-only-123456';
```
Two pretend shops and one pretend token. No database needed.

```js
flipped[0] ^= 1;
```
Change one single bit of the scrambled data (check 5). If AES-GCM's tamper seal
works, decrypting must fail.

```js
try { expect(...).toThrow(...) } finally { process.env.KMS_KEY = testKey; }
```
Checks 6 and 7 break the key on purpose. `finally` always puts the good key back,
even if the check fails, so later checks are not affected.

```js
try { decryptSecret(stored, BRIO); } catch (err) { message = String(err.message); }
expect(message).not.toContain(FAKE_TOKEN);
```
Check 8 triggers a real error and reads its text. Errors are what ends up in log
files, so they must never contain the token, the key or the stored value.

---

## PRACTICAL EXAMPLES

- A developer changes `kms.js` to reuse one IV. Check 3 fails the same minute.
- A developer removes `setAAD`. Check 4 fails: Brio can now read Amina's token.
- A developer puts the token in an error message. Check 8 fails.

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| No database | `kms.js` never touches one; the test stays fast and safe |
| Own random key per run | Works on CI and never depends on secrets |
| Test error text | Errors are what gets logged |
| `try/finally` around key changes | One failing check cannot break the others |

## WHERE USED / FUTURE USES

- `npm test`, the Husky pre-push hook (full suite) and CI.
- Key rotation (stretch): add checks that `v1.` rows still decrypt after a `v2.`
  key is introduced.

## TRADEOFFS

| Good | Cost |
|------|------|
| Fast, no database, safe fake data | Proves our wrapper, not AES itself (Node's crypto is trusted for that) |

## COMMON MISTAKES

- Using a real token in a test.
- Forgetting to restore `KMS_KEY` (other test files then see the wrong key).
- Checking only the happy path.

## AI AUDIT NOTE

Test written by AI (allowed). The code it checks (`kms.js`) was AI-written at
Sheryl's request and declared in `AI_AUDIT_week_29_day2.md`.

## TEST LOG

| Run | Expected | Result |
|-----|----------|--------|
| `node --check tests/kms.test.js` | no output | passed |
| `npm test -- tests/kms.test.js` | 9 passing | 9 passed |
| Full `npm test` | all pass | (fill in) |