// =============================================================================
// session.js — the bouncer: "show me your login badge"
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Pages inside the dashboard must only be seen by logged-in people. Every
//   one of them asks this bouncer first
//
// WHY IMPORTANT:
// - A page that forgets the check shows private shop data to anyone
//
// DANGER (if this file does not exist):
// - Each page writes its own check. One page forgets, and that page leaks
//
// WHAT IT SOLVES:
// - One function, requireSession(): returns who is logged in, or sends the
//   visitor to /login
//
// SYSTEM DESIGN PRINCIPLE: One bouncer, one place
// - The website never checks the badge itself. It asks the API (/me), which
//   already knows how. The secret key never leaves the API
//
// RULES:
// - Never decide "logged in" by only checking that a cookie EXISTS. A fake
//   cookie exists too. Always ask the API
// - Do not wrap redirect() in try/catch: it works by throwing, and catching it
//   would cancel the redirect
// - Runs on the server only (it uses next/headers)
//
// PRACTICAL EXAMPLES:
// - The staff-room layout calls it first:  const { user, tenant } = await requireSession();
// - Logged out, or a fake or expired cookie  -> the visitor lands on /login
// - Logged in -> user is { id, name, phone } and tenant is { id, name, slug }
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Every app with a private area. The pattern: read the cookie on the server,
//   ask the backend who it belongs to, redirect if nobody
//
// TRADEOFFS:
// + The secret key stays in the API only. One check, one place
// - One extra API call per page load (can be cached later)
//
// HOW TO USE:
//   const { user, tenant } = await requireSession();
// =============================================================================

// cookies: lets a server file read the cookie jar of the current visit
import { cookies } from 'next/headers';

// redirect: sends the visitor to another page
import { redirect } from 'next/navigation';

// The API address (it already ends in /v1)
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function requireSession() {

  // STEP 1: open this visit's cookie jar
  const cookieStore = await cookies();

  // STEP 2: take out the note called "token"
  // (the name you gave the cookie in signup.js and login.js)
  const token = cookieStore.get('token')?.value;

  // STEP 3: no note at all means not logged in
  if (!token) redirect('/login');

  // STEP 4: show the note to the API. We pass it along as a Cookie header,
  //