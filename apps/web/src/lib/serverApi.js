// =============================================================================
// serverApi.js — call the API from a server page, carrying the login cookie
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Dashboard pages run on the website's server. To get data they must call the
//   API AND show it the visitor's login cookie, or the API answers 401
//
// WHY IMPORTANT:
// - It is the only way private pages get their data. The data always comes from
//   the API, which uses the tenant-scoped connection (req.db)
//
// DANGER (if this file does not exist):
// - Every page repeats the cookie-forwarding code, and one gets it wrong
// - Or a page is tempted to read the database directly and skip the tenant lock
//
// WHAT IT SOLVES:
// - serverGet('/dashboard') returns the data, or sends a logged-out visitor to /login
//
// SYSTEM DESIGN PRINCIPLE: One door to the API
// - Pages never talk to the database. They call the API through this helper
//
// RULES:
// - Server only (it uses next/headers). Never import it into a 'use client' file
// - 401 means "not logged in": redirect to /login. Any other failure THROWS, so
//   a broken API shows an error and never a fake empty page
// - Do not wrap redirect() in try/catch
//
// PRACTICAL EXAMPLE:
//   const data = await serverGet('/dashboard');
//   // data.ordersToday, data.balanceCents, data.latestProducts
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Every server-rendered page that needs private data from a separate API
//
// TRADEOFFS:
// + One place for cookie forwarding and error rules
// - Only handles GET for now. Add serverPost when a page needs to write
//
// HOW TO USE:
//   import { serverGet } from '../../../lib/serverApi';
// =============================================================================

// cookies: lets a server file read the cookie jar of the current visit
import { cookies } from 'next/headers';

// redirect: sends the visitor to another page
import { redirect } from 'next/navigation';

// The API address (it already ends in /v1)
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// -----------------------------------------------------------------------------
// serverGet — GET something from the API as the logged-in visitor
// path: for example '/dashboard'. Returns the "data" part of the API's answer
// -----------------------------------------------------------------------------
export async function serverGet(path) {

  // STEP 1: take the login note out of this visit's cookie jar
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  // STEP 2: no note at all means not logged in
  if (!token) redirect('/login');

  // STEP 3: call the API, showing the note exactly like a browser would
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Cookie: `token=${token}` },
    cache: 'no-store', // always fresh numbers, never an old copy
  });

  // STEP 4: the API says the note is not valid (expired, fake): go to login
  if (res.status === 401) redirect('/login');

  // STEP 5: any other failure is a real problem. Throw, so we never show a
  // page full of zeros that look real
  if (!res.ok) {
    throw new Error(`API ${path} failed with status ${res.status}`);
  }

  // STEP 6: the API answers { data: ... }. Hand back just the data
  const json = await res.json();
  return json.data;
}