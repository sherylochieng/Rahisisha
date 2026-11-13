# kms.js — Locking Each Shop's WhatsApp Token

**File:** `apps/api/src/utils/kms.js`
**Doc:** `apps/api/docs/src/utils/kms.md`
**Added:** Week 29 Day 2, Task 1 (tokens encrypted at rest)
**Tests:** `apps/api/tests/kms.test.js` (9 checks)

---

## WHY THIS FILE EXISTS

Every shop has its own Meta (WhatsApp) access token. A token is a key to that
shop's WhatsApp number. It must not sit as plain text in the database. This file
is our small **local KMS** (key management service):

- `encryptSecret(plain, tenantId)` scrambles a secret before it is saved.
- `decryptSecret(stored, tenantId)` unscrambles it when we need to call Meta.

Real-life picture: a hotel safe. The guest's valuables (token) go in the safe
(database column). The safe's key (`KMS_KEY`) is kept in the manager's office
(environment), not taped to the safe.

## WHY IMPORTANT

If someone gets a copy of the database (a backup, a leaked dump, one careless
`SELECT`), plain tokens would let them send WhatsApp messages as every shop.
Scrambled tokens are useless without the key, and the key is NOT in the database.

## DANGER

- NEVER log the plain text, the stored text, or the key. Not even in errors.
- NEVER commit `KMS_KEY`. The repo is public. `.env.example` has a placeholder.
- If `KMS_KEY` is lost or changed, every stored token becomes unreadable (shops
  must paste their token again). Keep a safe copy of the key.
- Never reuse an IV (the random start value) with the same key.

## WHAT IT SOLVES

Task 1 of the sheet: "tokens encrypted at rest with a local KMS helper
(AES-GCM, key from env)".

## SYSTEM DESIGN PRINCIPLE

**Encryption at rest + key separation.** The lock (database) and the key
(environment) live in different places. Also **authenticated encryption**:
AES-GCM does not only hide data, it also detects if someone changed it.

## RULES

1. Key comes from `process.env.KMS_KEY`: 32 random bytes, base64 (44 characters).
2. Every encryption uses a NEW random 12-byte IV.
3. The shop's tenant id is bound in (`context`). A token only decrypts for the
   SAME shop it was saved for.
4. Stored format is versioned (`v1.`), so the method or key can change later.
5. Fail loudly if the key is missing or wrong. Never fall back to plain text.

---

## THE STORED FORMAT

```
v1.<iv>.<tag>.<ciphertext>      (each part is base64)
```

| Part | What it is | Real life |
|------|-----------|-----------|
| `v1` | format version | the edition number on a form |
| `iv` | random start value, new every time | a new random padlock number |
| `tag` | tamper seal made by AES-GCM | a wax seal: broken seal = someone opened it |
| `ciphertext` | the scrambled token | the locked contents |

## THE CODE, PIECE BY PIECE

```js
import crypto from 'node:crypto';
```
Node's built-in toolbox. No extra package to trust.

```js
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';
```
AES with a 256-bit key and the tamper seal (GCM). 12 bytes is the IV size GCM is
designed for. `v1` is written at the start of every stored value.

```js
function getKey() { ... }
```
Reads `KMS_KEY`, turns the 44 characters back into 32 raw bytes, and checks the
size. It throws "KMS_KEY is not set" or "must be 32 bytes". The error never shows
the key. *Real life:* the clerk checks you brought a key of the right size
before opening the safe, and never reads the key out loud.

```js
function checkContext(context) { ... }
```
The shop id must be a non-empty string. If it were empty, the shop lock would
silently do nothing, so we refuse instead.

```js
const iv = crypto.randomBytes(IV_BYTES);
const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
cipher.setAAD(Buffer.from(context, 'utf8'));
```
Make a fresh random IV, start the scrambler, and attach the shop id as
"additional authenticated data" (AAD). The shop id is not secret, but it becomes
part of the seal. *Real life:* the safe's slip has the room number written on it;
the safe refuses to open for a different room.

```js
const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
```
Scramble the token, then take the tamper seal.

```js
export function decryptSecret(stored, context) { ... }
```
Splits the 4 parts, checks the version, rebuilds the unscrambler with the same
IV, the same shop id and the seal, and returns the token. If ANYTHING is off
(wrong key, wrong shop, changed data), it throws one plain message: "Could not
decrypt the stored secret". It gives no details on purpose, because the real
reason could hint at the key or data.

---

## PRACTICAL EXAMPLES

- Amina pastes her Meta token in settings. We call `encryptSecret(token,
  aminaTenantId)` and save the `v1....` text in `whatsapp_configs`.
- A customer messages Amina's number. We load her row, call
  `decryptSecret(stored, aminaTenantId)`, and send the reply with it.
- A bug (or an attacker with database write access) copies Amina's stored value
  into Brio's row. `decryptSecret(stored, brioTenantId)` throws. The token is not
  sent anywhere.

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| AES-256-GCM from Node `crypto` | No extra package, tamper detection included |
| Shop id as AAD | Stops the "copy a row to another shop" attack |
| Key read at call time, not at import | Tests can set their own key; a missing key fails when used |
| `v1.` prefix | The hook for key rotation (stretch goal): a later `v2.` can use a newer key while `v1.` rows stay readable |
| One generic decrypt error | Never leak hints about key or data |

## WHERE USED / FUTURE USES

- `whatsapp_configs.access_token_encrypted` (this week).
- `sendWhatsApp()` decrypts the token only at the moment of calling Meta.
- Future per-shop secrets: M-Pesa keys, Telegram tokens.
- Production upgrade: a real cloud KMS (AWS KMS, GCP KMS).

## TRADEOFFS

| Good | Cost |
|------|------|
| Simple, no network call, no extra service | One key protects everything: if `KMS_KEY` leaks, all tokens are readable |
| Tamper detection and shop lock built in | Changing the key needs a rotation step |
| Fully tested without a database | Not a replacement for a cloud KMS at large scale |

## HOW TO USE

1. Make a key ONCE and put it in `apps/api/.env`:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   KMS_KEY=<the 44 characters>
   ```
2. On Render and GitHub, set `KMS_KEY` as a secret or environment variable.
3. In code:
   ```js
   import { encryptSecret, decryptSecret } from '../utils/kms.js';
   const stored = encryptSecret(token, tenantId);
   const token2 = decryptSecret(stored, tenantId);
   ```

## COMMON MISTAKES

- Committing a real `KMS_KEY` (the repo is public).
- Logging the token "just to debug".
- Using a different tenant id when decrypting (it will fail, on purpose).
- Setting a new `KMS_KEY` on the server and forgetting old rows were locked with
  the old one.

## AI AUDIT NOTE

Written by AI at Sheryl's request. The assignment says AI is NOT allowed for
token handling. This is declared in `apps/api/docs/AI_AUDIT_week_29_day2.md`.

## TEST LOG

| Run | Expected | Result |
|-----|----------|--------|
| `node --check src/utils/kms.js` | no output | passed |
| `npm test -- tests/kms.test.js` | 9 passing | 9 passed |