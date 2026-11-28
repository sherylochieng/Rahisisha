// =============================================================================
// FILE: apps/web/src/lib/uploadPhoto.js   (Week 30, product photos)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Sends a product photo from the owner's phone or computer straight to
//   Cloudinary (our online photo store) and gives back the photo's web address.
//   It does two trips: (1) ask OUR API for a signed permit, (2) hand the photo
//   and the permit to Cloudinary.
//
// WHY IMPORTANT
//   The photo never passes through our API server, so uploads stay fast and
//   cheap. The permit makes sure only logged-in shops can fill our storage.
//
// DANGER
//   1. Never put the Cloudinary API SECRET in the web app. The browser only
//      ever sees the permit (signature), never the secret.
//   2. The checks here (size, type) are kindness, not security. The real lock is
//      the signed folder at Cloudinary and the address check in our API.
//   3. Never show a raw technical error ("Failed to fetch"). Every failure
//      becomes a friendly sentence.
//   4. Keep credentials: 'include' on the call to OUR API, or the login cookie
//      is not sent and the permit is refused.
//
// WHAT IT SOLVES
//   uploadProductPhoto(file) -> "https://res.cloudinary.com/.../photo.jpg"
//   checkPhotoFile(file)     -> a friendly message, or null when the file is fine
//
// SYSTEM DESIGN PRINCIPLE
//   Direct upload with a signed permit: the big thing (the photo) goes straight
//   to the store; our server only hands out the permit.
//
// RULES
//   1. Allowed types: JPEG, PNG, WebP. Largest size: 5 MB.
//   2. Check the file BEFORE any network trip (saves data bundles).
//   3. Return only the final https address (secure_url).
//   4. Every thrown Error has a message the owner can read.
//
// PRACTICAL EXAMPLE
//   Mama Njeri picks a 2 MB photo of a kitenge dress. checkPhotoFile says fine.
//   uploadProductPhoto asks our API for a permit, sends the photo to Cloudinary
//   and returns "https://res.cloudinary.com/<cloud>/image/upload/v17/rahisisha/<shop>/abc.jpg".
//   The form saves that line on the product.
//
// WHERE USED
//   apps/web/src/components/owner/ProductForm.js
//
// TRADEOFFS
//   + No Cloudinary library in the web app, and no file through our server.
//   - Uses fetch here, not lib/api.js: this file talks to TWO servers (ours and
//     Cloudinary), and the api.js wrapper is built for ours only. The call to
//     our API still follows the same rules (cookie sent, friendly errors).
//   - No upload progress bar yet.
//   - A photo uploaded but never saved on a product stays at Cloudinary
//     (clean-up job is future work).
//
// HOW TO USE
//   import { uploadProductPhoto, checkPhotoFile } from '../lib/uploadPhoto';
//   const problem = checkPhotoFile(file);        // show it if not null
//   const url = await uploadProductPhoto(file);  // then save url on the product
// =============================================================================

// PIECE BY PIECE
//
// API_URL
//   = "the address of OUR API" (ends in /v1), read from the web app's settings.
//
// MAX_BYTES / ALLOWED_TYPES
//   = the rules at the door: at most 5 MB, and only JPEG, PNG or WebP.
//   Real life: a matatu sticker says "maximum 14 passengers"; the conductor
//   checks before anyone boards, not after the road trip.
//
// checkPhotoFile(file)
//   = looks at the chosen file and returns a friendly sentence if it is wrong,
//   or null when it is fine. `file.type` is the kind of file, `file.size` is
//   how big it is in bytes.
//
// uploadProductPhoto(file)
//   Trip 1: POST our API /uploads/sign (cookie sent) -> the permit.
//     Real life: the shop owner first gets a stamped gate pass from the manager.
//   Trip 2: POST Cloudinary with the photo + the permit as a "form" (FormData).
//     Real life: she shows the gate pass at the photo store's gate and hands
//     over the photo.
//   Then we read `secure_url`: the final https address of the stored photo.
//
// FormData
//   = a parcel with labelled parts: file, api_key, timestamp, folder, signature.
//   Cloudinary checks that the signature matches the folder and timestamp.
//
// try / catch around fetch
//   = if the phone has no internet, fetch itself fails; we turn that into
//   "check your internet" instead of the scary "Failed to fetch".
//
// res.json().catch(() => null)
//   = open the answer carefully; if it is not valid JSON we get null, not a crash.

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const NETWORK_MESSAGE =
  "We couldn't reach the server. Check your internet connection and try again.";
const UPLOAD_FAILED_MESSAGE =
  "We couldn't upload the photo. Please try again, or choose a smaller photo.";

// Returns a friendly problem sentence, or null when the file is fine.
export function checkPhotoFile(file) {
  if (!file) return 'Choose a photo first.';
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Please choose a JPG, PNG or WebP photo.';
  }
  if (file.size > MAX_BYTES) {
    return 'That photo is too big. Please choose one under 5 MB.';
  }
  return null;
}

// Sends the photo to Cloudinary and returns its https address.
export async function uploadProductPhoto(file) {
  const problem = checkPhotoFile(file);
  if (problem) throw new Error(problem);

  // TRIP 1: ask our API for a signed permit (the login cookie goes along)
  let permit;
  try {
    const res = await fetch(`${API_URL}/uploads/sign`, {
      method: 'POST',
      credentials: 'include',
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        (body && body.error && typeof body.error.message === 'string' && body.error.message) ||
        (body && typeof body.error === 'string' && body.error) ||
        UPLOAD_FAILED_MESSAGE;
      throw new Error(message);
    }
    permit = body.data;
  } catch (err) {
    // A thrown Error we made above keeps its message; a network failure is a TypeError
    if (err instanceof TypeError) throw new Error(NETWORK_MESSAGE);
    throw err;
  }

  // TRIP 2: hand the photo + permit to Cloudinary
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', permit.apiKey);
  form.append('timestamp', String(permit.timestamp));
  form.append('folder', permit.folder);
  form.append('signature', permit.signature);

  let result;
  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${permit.cloudName}/image/upload`,
      { method: 'POST', body: form }
    );
    result = await res.json().catch(() => null);
    if (!res.ok || !result || typeof result.secure_url !== 'string') {
      throw new Error(UPLOAD_FAILED_MESSAGE);
    }
  } catch (err) {
    if (err instanceof TypeError) throw new Error(NETWORK_MESSAGE);
    throw err;
  }

  return result.secure_url;
}