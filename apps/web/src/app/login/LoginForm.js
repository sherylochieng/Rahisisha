'use client';
// Runs in the browser — we use hooks and form events here

// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/app/login/LoginForm.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The login form: the phone + password the shop owner types to
//   get into Rahisisha Biashara. It sends them to the API and,
//   if they are right, takes the owner to the dashboard.
//
// WHY IMPORTANT
//   It is the front door of the whole product. If it confuses
//   people or looks broken, nobody reaches the rest of the app.
//
// DANGER (what breaks without the polish in this version)
//   - The API is off: the user used to read "Failed to fetch".
//   - A phone that is too short: the user used to read
//     "Validation failed", which says nothing.
//   - Each form had its own copy of the error box and button, so
//     fixing one meant fixing every page.
//
// WHAT IT SOLVES
//   Clear messages for every way login can go wrong, using shared
//   building blocks (FormError, SubmitButton) instead of
//   copy-pasted markup.
//
// SYSTEM DESIGN PRINCIPLE
//   "Design for every state": normal, loading, wrong password,
//   invalid input, and server down. Also DRY: shared pieces live
//   in components/, so one fix improves every form.
//
// RULES (never do this)
//   1. NEVER call fetch() here. Use api.login() so errors are
//      translated in one place (lib/api.js).
//   2. NEVER show raw server or browser errors to the user.
//   3. NEVER remove e.preventDefault() or the page reloads and
//      the state is lost.
//   4. NEVER trust the browser checks alone. The API validates
//      again (minLength here only saves a wasted request).
//   5. NEVER paste the red box or button markup back in here.
//      Use <FormError> and <SubmitButton>.
//
// ───────────────────────────────────────────────────────────
// THE STORY: BEFORE AND AFTER (Week 28 Weekend, Task 3)
// ───────────────────────────────────────────────────────────
//   BEFORE (how we first designed it)
//     - The error box was written by hand inside this file.
//     - The button was written by hand inside this file.
//     - Any error text from the API was shown as it came.
//     - Inputs only had `required`.
//     So: API down -> "Failed to fetch". Short phone ->
//     "Validation failed". Same box and button copy-pasted on
//     the signup page too.
//
//   WHY WE CHANGED IT
//     The weekend assignment asked for loading states, clear
//     form errors and no confusing messages, on existing pages
//     only (no new features). We also now return a friendly 503
//     when Postgres is down (Task 2), and the page had to show it.
//
//   AFTER (how it works now)
//     1. lib/api.js turns every failure into a friendly Error
//        (network down, server trouble, bad input) and attaches
//        err.status so this form can tell them apart.
//     2. <FormError> draws the red box (shared, accessible).
//     3. <SubmitButton> draws the button and handles the
//        "Logging in..." state (shared).
//     4. Inputs have minLength/maxLength that match the API rules,
//        so the browser explains problems next to the field.
//     5. A 400 from login shows a message that says exactly
//        what to fix.
//     The look of the page did NOT change. Only the behaviour.
// ───────────────────────────────────────────────────────────
//
// PRACTICAL EXAMPLE
//   Mama Njeri types a 4-digit phone: the browser says it is too
//   short, no request is sent. She fixes it, logs in, and the
//   button says "Logging in..." until the dashboard opens. On a
//   day the database is down she reads "We're having trouble
//   right now. Please try again in a moment."
//
// WHERE YOU WILL USE THIS PATTERN
//   SignupForm.js (next), and any future form: products,
//   orders, settings.
//
// TRADEOFFS
//   + Simple and consistent with the other forms.
//   - Errors show in one box at the top, not under each field.
//     Good enough for a 2-field form; a bigger form would need
//     per-field messages.
//
// HOW TO USE
//   Rendered by app/login/page.js. No props.
// ═══════════════════════════════════════════════════════════

import { useRouter } from 'next/navigation';
// useRouter — navigation remote control
// We use router.push('/dashboard') after successful login
// No longer importing useState directly — useFormState handles that for us now

import Link from 'next/link';
// Link — Next.js client-side navigation
// Replaces <a> for internal pages — no full page reload

import { api } from '../../lib/api';
// Our centralised API client
// All fetch logic lives in one place — we never write fetch() directly in a form

import { useFormState } from '../../hooks/useFormState';
// Our custom hook replaces these two lines we had before:
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
// One import, one line — all form state handled in one place
// If we need to fix error/loading behaviour, we fix it in the hook — all forms benefit

// ✅ AFTER (NEW) — two shared building blocks
// ❌ BEFORE: this file had no imports for these. The red box and the
//            button were written by hand further down.
import FormError from '../../components/FormError';
// FormError: the red error box. Shows nothing when the message is empty

import SubmitButton from '../../components/SubmitButton';
// SubmitButton: the button that says "Logging in..." and locks itself while waiting

export default function LoginForm() {
  const router = useRouter();

  const { error, loading, startSubmit, failSubmit } = useFormState();
  // error        — the message shown in the red box (empty = box hidden)
  // loading      — true while API call is in flight (button locked)
  // startSubmit  — call at top of submit: clears error, sets loading=true
  // failSubmit   — call in catch: sets error message, sets loading=false

  async function handleSubmit(e) {
    e.preventDefault();
    // Stops browser default: no page refresh, no URL query string
    // Without this the whole page reloads and all state is lost

    startSubmit();
    // Clears any old error from a previous failed attempt
    // Locks the button and shows "Logging in..."

    const formData = new FormData(e.target);
    // Reads all input values by their name= attribute
    // e.target is the <form> element itself

    const body = {
      phone:    formData.get('phone'),     // reads <input name="phone">
      password: formData.get('password'),  // reads <input name="password">
    };
    // This is the JSON object sent to POST /v1/login

    try {
      await api.login(body);
      // Send login request to our Express API
      // If API returns an error status, api.login throws — jumps to catch
      // If it succeeds, we fall through to the next line

      router.push('/dashboard');
      // Login worked — navigate to dashboard
      // Client-side: instant, no full page reload

    } catch (err) {
      // ✅ AFTER (NEW) — a 400 gets a message that says what to fix
      // ❌ BEFORE: every error, including 400, went straight to
      //            failSubmit(err.message). A 400 from login only says
      //            "Validation failed", which helps nobody.
      // err.status comes from lib/api.js (0 = never reached the server)
      if (err.status === 400) {
        failSubmit('Please check your details: phone must be 10 to 20 characters and password at least 8.');
        return;
      }

      // Everything else already has a friendly message from lib/api.js:
      //   401 -> "Invalid credentials"
      //   0   -> "We couldn't reach the server..."
      //   503 -> "We're having trouble right now..."
      failSubmit(err.message || 'Could not connect to server');
      // Shows the message in the red box
      // Unlocks the button so the user can try again
    }
    // Note: no finally needed here
    // Success → user navigates away (loading state irrelevant)
    // Failure → failSubmit already sets loading=false
  }

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center px-4 py-8">
      {/* Full screen wrapper — dark navy background, centres the card */}

      <div className="w-full max-w-4xl flex rounded-2xl shadow-2xl overflow-hidden">
        {/* Card — max width 4xl, rounded corners, drop shadow */}

        {/* ── LEFT PANEL — orange brand panel (desktop only) ── */}
        <div className="hidden md:flex flex-col justify-between bg-orange-500 text-white w-1/2 p-10">
          {/* hidden md:flex — invisible on mobile, visible on medium screens and up */}
          {/* justify-between — pushes logo to top, signup link to bottom */}

          <div>
            {/* Logo mark */}
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                <span className="text-orange-500 font-bold text-lg">R</span>
              </div>
              <span className="font-bold text-lg">Rahisisha Biashara</span>
            </div>

            <h2 className="text-3xl font-bold leading-tight mb-4">
              Welcome back.
            </h2>
            <p className="text-orange-100 text-sm leading-relaxed mb-8">
              Log in to manage your business, track your sales,
              and keep growing with Rahisisha Biashara.
            </p>

            {/* Feature checklist */}
            <ul className="space-y-3 text-sm text-orange-100">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs text-orange-500">✓</span>
                Your customers are waiting
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs text-orange-500">✓</span>
                Your sales dashboard is ready
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs text-orange-500">✓</span>
                Your business never sleeps
              </li>
            </ul>
          </div>

          {/* Bottom of left panel — signup link for desktop */}
          {/* Using Link for instant client-side navigation (was <a href>, a full reload) */}
          <p className="text-orange-100 text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-white hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>

        {/* ── RIGHT PANEL — the actual form ── */}
        <div className="bg-white w-full md:w-1/2 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-blue-950">Log in</h1>
            <p className="text-gray-500 text-sm mt-1">Enter your phone and password</p>
          </div>

          {/* ✅ AFTER (NEW) — the shared FormError component draws the red box.
              It draws NOTHING when `error` is empty, so no `&&` is needed here.
              mb-5 is the same gap below the box that we had before.
              `error` comes from the useFormState hook.

              ❌ BEFORE: the box was written by hand right here:
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700
                                  rounded-lg px-4 py-3 mb-5 text-sm">
                    {error}
                  </div>
                )}
              It looked the same, but the signup page had its own copy, and
              the copy had no role="alert" (screen readers stayed silent). */}
          <FormError message={error} className="mb-5" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* onSubmit wires the form's submit event to our handleSubmit function */}

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone number
              </label>
              <input
                id="phone"
                name="phone"
                // name="phone" is what formData.get('phone') reads in handleSubmit
                type="tel"
                required
                // ✅ AFTER (NEW): minLength/maxLength match the API rule (10 to 20).
                // The browser blocks a too-short phone BEFORE any request is
                // sent and explains it right next to the field.
                // ❌ BEFORE: only `required`. A short phone travelled to the API
                // and came back as "Validation failed".
                minLength={10}
                maxLength={20}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="0712345678"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                // ✅ AFTER (NEW): the API wants 8 to 72 characters
                // ❌ BEFORE: only `required`
                minLength={8}
                maxLength={72}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Your password"
              />
            </div>

            {/* ✅ AFTER (NEW) — the shared SubmitButton component.
                It disables itself while `loading` is true and swaps its words
                to "Logging in...". It has the same orange look and size as
                before. mt-2 keeps the same gap above it.

                ❌ BEFORE: the button was written by hand right here:
                  <button type="submit" disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600
                               disabled:bg-orange-300 text-white font-semibold
                               rounded-lg py-2.5 text-sm transition-colors mt-2">
                    {loading ? 'Logging in...' : 'Log in'}
                  </button>
                Same behaviour, but the signup page had a second copy. */}
            <SubmitButton loading={loading} loadingText="Logging in..." className="mt-2">
              Log in
            </SubmitButton>
          </form>

          {/* Mobile only — signup link */}
          {/* md:hidden — shows on mobile, hidden on medium screens and up */}
          {/* The left orange panel handles this link on desktop */}
          <p className="text-center text-sm text-gray-500 mt-5 md:hidden">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-orange-500 hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}