// =============================================================================
// FILE: apps/api/src/services/cloudinary.service.js   (Week 30, product photos)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Product photos are stored at Cloudinary (an online photo store), not on our
//   server and not in our database. To let a shop owner's BROWSER send a photo
//   straight to Cloudinary, our API must first give the browser a "signed
//   permit": a short note that says "this upload is allowed, into THIS shop's
//   folder, right now". This file makes that permit, and it also checks that a
//   photo address we are asked to save really belongs to the shop.
//
// WHY IMPORTANT
//   Without a signature, anyone on the internet could fill our Cloudinary
//   account with photos. Without the address check, a shop could save
//   someone else's photo address (or a harmful link) as its product picture.
//
// DANGER
//   1. CLOUDINARY_API_SECRET must NEVER be sent to the browser, logged, or
//      committed. Only the finished signature leaves this file.
//   2. The folder is chosen HERE from the logged-in shop (tenantId). The browser
//      can never choose it. Otherwise shop A could upload into shop B's folder.
//   3. Never print the signature string that is built before hashing: it has
//      the secret glued to its end.
//
// WHAT IT SOLVES
//   1. makeUploadSignature(tenantId): the signed permit for one upload.
//   2. isShopImageUrl(url, tenantId): true only for an https Cloudinary photo
//      address inside THIS shop's folder.
//
// SYSTEM DESIGN PRINCIPLE
//   Keep big files off our server (direct upload), and keep the secret on the
//   server (signed permit). The browser carries the photo; we keep the key.
//
// RULES
//   1. Settings come from the environment (CLOUDINARY_CLOUD_NAME,
//      CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET), read when the function runs.
//   2. Cloudinary's signing rule: take the parameters, sort them by name, join
//      as "name=value&name=value", add the secret at the end, then SHA-1 it.
//      Only "folder" and "timestamp" are signed here.
//   3. No Cloudinary SDK: Node's built-in `crypto` is enough, one dependency
//      fewer to patch.
//   4. Missing settings => a clear error with code 'uploads_not_set_up'.
//
// PRACTICAL EXAMPLE
//   Mama Njeri (shop id 7f3a...) taps "Choose photo". The browser asks
//   POST /v1/uploads/sign. We answer:
//     { cloudName, apiKey, timestamp: 1790000000,
//       folder: "rahisisha/7f3a...", signature: "9c1d..." }
//   The browser sends the photo + those values to Cloudinary. Cloudinary
//   recomputes the signature with its own copy of the secret. Same answer =
//   permit is real = photo accepted.
//
// WHERE USED
//   apps/api/src/controllers/uploads.controller.js   (makeUploadSignature)
//   apps/api/src/controllers/products.controller.js  (isShopImageUrl)
//
// TRADEOFFS
//   + No file ever passes through our server (cheap, fast on Render's free plan).
//   + No SDK to maintain.
//   - Cloudinary decides the real limits (free plan: 10 MB per image). We also
//     check size and type in the browser, but that is only a kindness, not a
//     lock: the real lock is the signed folder + the address check.
//   - The permit is only checked for age by Cloudinary (it rejects very old
//     timestamps). We do not keep a list of permits we issued.
//
// HOW TO USE
//   import { makeUploadSignature, isShopImageUrl } from '../services/cloudinary.service.js';
//   const permit = makeUploadSignature(req.tenantId);
//   if (!isShopImageUrl(body.imageUrl, req.tenantId)) { /* refuse */ }
// =============================================================================

import { createHash } from 'node:crypto';

// The top folder name inside Cloudinary. Each shop gets its own sub-folder.
const ROOT_FOLDER = 'rahisisha';

// Read the three settings now (not when the file loads), so tests can change
// them and a missing setting fails only the feature that needs it.
function readSettings() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    const err = new Error('Photo uploads are not set up on this server');
    err.code = 'uploads_not_set_up';
    throw err;
  }
  return { cloudName, apiKey, apiSecret };
}

// The folder that belongs to one shop: "rahisisha/<tenantId>".
export function shopFolder(tenantId) {
  return `${ROOT_FOLDER}/${tenantId}`;
}

// PIECE BY PIECE
//   timestamp  = "what time is it now, in seconds" (Cloudinary rejects old permits)
//   toSign     = the signed parameters, ALPHABETICAL: folder first, then timestamp
//   signature  = SHA-1( toSign + secret ), written in hex letters/numbers
// Real life: the secret is the stamp in the bank's drawer. We stamp the permit
// and hand over the permit, never the stamp.
export function makeUploadSignature(tenantId, nowSeconds = Math.floor(Date.now() / 1000)) {
  const { cloudName, apiKey, apiSecret } = readSettings();

  const folder = shopFolder(tenantId);
  const toSign = `folder=${folder}&timestamp=${nowSeconds}`;
  const signature = createHash('sha1').update(toSign + apiSecret).digest('hex');

  // The secret is NOT in this answer. apiKey is public by design.
  return { cloudName, apiKey, timestamp: nowSeconds, folder, signature };
}

// PIECE BY PIECE
//   A photo address must look like:
//     https://res.cloudinary.com/<cloudName>/image/upload/.../rahisisha/<tenantId>/<file>
//   1. start with OUR cloud's address (not someone else's Cloudinary, not another site)
//   2. contain THIS shop's folder, so shop A cannot save shop B's photo
// Returns true/false, never throws (a bad address is just "no").
export function isShopImageUrl(url, tenantId) {
  if (typeof url !== 'string' || url.length > 500) return false;

  let cloudName;
  try {
    ({ cloudName } = readSettings());
  } catch {
    return false; // not set up => we cannot vouch for any address
  }

  const start = `https://res.cloudinary.com/${cloudName}/image/upload/`;
  if (!url.startsWith(start)) return false;

  // "/" on both sides so "rahisisha/abc" cannot match "rahisisha/abcdef".
  return url.includes(`/${shopFolder(tenantId)}/`);
}