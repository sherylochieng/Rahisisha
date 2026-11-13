// FILE: apps/api/src/utils/kms.js
//
// WHY THIS FILE EXISTS
//   Week 29 Day 2 (WhatsApp per tenant). Every shop has its own Meta access
//   token. A token is a key to that shop's WhatsApp. We must not keep it as
//   plain text in the database. This file is our small LOCAL "KMS" (key
//   management service): encryptSecret() scrambles a secret before it is
//   saved, decryptSecret() unscrambles it when we need to call Meta.
//
// WHY IMPORTANT
//   If someone gets a copy of the database (a backup, a leaked dump, a
//   careless SELECT), plain tokens would let them send WhatsApp messages as
//   every shop. Encrypted tokens are useless without the key, and the key is
//   NOT in the database. It lives in an environment variable (KMS_KEY).
//
// DANGER
//   - NEVER log the plain text, the stored text, or the key. Not even in
//     error messages. This file's errors never include any of them.
//   - NEVER commit KMS_KEY. The repo is public. .env.example holds a
//     placeholder only.
//   - If KMS_KEY is lost or changed, every stored token becomes unreadable
//     (shops must paste their token again). Keep a safe copy of the key.
//   - Never reuse an IV (the random start value) with the same key. We make a
//     fresh random one for every encryption.
//
// WHAT IT SOLVES
//   Task 1 of Day 2: "tokens encrypted at rest with a local KMS helper
//   (AES-GCM, key from env)".
//
// SYSTEM DESIGN PRINCIPLE
//   Encryption at rest + key separation: the lock (database) and the key
//   (environment) live in different places. Also "authenticated encryption":
//   AES-GCM detects tampering, it does not only hide data.
//
// RULES
//   1. Key comes from process.env.KMS_KEY: 32 random bytes, base64.
//   2. Every encryption uses a NEW random 12-byte IV.
//   3. `context` (the shop's tenant id) is bound into the encryption. A stored
//      token only decrypts for the SAME shop it was saved for.
//   4. Stored format is versioned ("v1.") so we can change the method or the
//      key later without breaking old rows.
//   5. Fail loudly (throw) if the key is missing or wrong. Never fall back to
//      storing plain text.
//
// PRACTICAL EXAMPLE
//   const stored = encryptSecret('EAAG...meta-token', amina.tenantId);
//   // stored looks like: v1.<iv>.<tag>.<ciphertext>   (all base64)
//   // save `stored` in whatsapp_configs.access_token_encrypted
//   const token = decryptSecret(stored, amina.tenantId); // only for Amina
//   decryptSecret(stored, brio.tenantId);                // throws
//
// DECISIONS (and WHY)
//   - AES-256-GCM from Node's built-in `crypto`: no extra package to trust.
//   - The shop id is passed as "additional authenticated data" (AAD). It is
//     not secret, but it is checked on decrypt. This stops a row-swap attack
//     (copying one shop's scrambled token into another shop's row).
//   - Key is read at call time, not at import time, so tests can set it.
//   - The "v1." prefix is the hook for key rotation (stretch goal): a later
//     "v2." can mean "newer key" while "v1." rows are still readable.
//
// WHERE USED / FUTURE USES
//   - whatsapp_configs.access_token_encrypted (this week)
//   - Any future per-shop secret: M-Pesa shortcode keys, Telegram tokens.
//
// TRADEOFFS
//   + Simple, no network call, no extra service.
//   - One key protects everything: if KMS_KEY leaks, all tokens are readable.
//     A real cloud KMS (AWS KMS, GCP KMS) is the production upgrade.
//   - Changing the key needs a rotation step (re-encrypt rows or support
//     several keys).
//
// HOW TO USE
//   1. Make a key ONCE (it prints 44 characters, copy it into your .env):
//        node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//      Put it in apps/api/.env as:   KMS_KEY=<the 44 characters>
//      On GitHub CI and Render, set it as a secret / env var, never in a file.
//   2. import { encryptSecret, decryptSecret } from '../utils/kms.js';
//


import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm'; // 256-bit key, with built-in tamper check
const IV_BYTES = 12;             // the size GCM is designed for
const VERSION = 'v1';            // stored format version

// getKey: reads KMS_KEY and checks it. Errors never show the key itself.
function getKey() {
  const b64 = process.env.KMS_KEY;
  if (!b64) throw new Error('KMS_KEY is not set');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('KMS_KEY must be 32 bytes, base64 encoded');
  return key;
}

// checkContext: the shop id must be a non-empty string, or the lock to the
// shop would silently do nothing.
function checkContext(context) {
  if (typeof context !== 'string' || context.length === 0) {
    throw new Error('KMS context (tenant id) is required');
  }
}

// encryptSecret: plain text in, "v1.<iv>.<tag>.<ciphertext>" out.
export function encryptSecret(plain, context) {
  checkContext(context);
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('Nothing to encrypt');
  }
  const iv = crypto.randomBytes(IV_BYTES);                  // new every time
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  cipher.setAAD(Buffer.from(context, 'utf8'));              // lock to this shop
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();                          // the tamper seal
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

// decryptSecret: the reverse. Throws a plain error if the text is damaged,
// the key is wrong, or the shop is not the one it was saved for.
export function decryptSecret(stored, context) {
  checkContext(context);
  const parts = typeof stored === 'string' ? stored.split('.') : [];
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Stored secret has an unknown format');
  }
  try {
    const [, ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv(
      ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    // On purpose: no details. The real reason could hint at the key or data.
    throw new Error('Could not decrypt the stored secret');
  }
}