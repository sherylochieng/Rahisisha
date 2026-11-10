'use client';
// ↑ This tells Next.js: "this file runs in the BROWSER, not on the server"
// Browser-only things like useRouter and form events need this directive
// Without it, Next.js tries to render this on the server and crashes

// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/app/signup/SignupForm.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The signup form. A new shop owner types their name, phone,
//   password and business name. We send them to the API, which
//   creates the shop, the owner and the login cookie in one go.
//
// WHY IMPORTANT
//   This is where every new customer starts. A confusing or
//   frozen signup page means we lose them before they ever see
//   the product.
//
// DANGER (what breaks without the polish in this version)
//   - Server down: the user used to read "Failed to fetch".
//   - Bad input: the user used to read "Validation failed".
//   - Double click: two requests, and the second fails with
//     "phone already exists", which confuses the user.
//   - The box and the button were copy-pasted from the login
//     page, so fixes had to be made twice.
//
// WHAT IT SOLVES
//   Clear messages for every way signup can go wrong, using the
//   shared FormError and SubmitButton instead of copies.
//
// SYSTEM DESIGN PRINCIPLE
//   "Design for every state" (normal, loading, invalid input,
//   duplicate, server down) and DRY (shared building blocks).
//
// RULES (never do this)
//   1. NEVER call fetch() here. Use api.signup().
//   2. NEVER show raw server or browser errors to the user.
//   3. NEVER remove e.preventDefault().
//   4. NEVER trust the browser checks alone. The API checks
//      again. minLength here only saves a wasted request.
//   5. NEVER paste the red box or button markup back in here.
//   6. NEVER change the limits below without changing the API.
//      They mirror signupSchema in routes/auth/signup.js:
//        name 2-100, phone 10-20, password 8-72, business 2-100.
//
// ───────────────────────────────────────────────────────────
// THE STORY: BEFORE AND AFTER (Week 28 Weekend, Task 3)
// ───────────────────────────────────────────────────────────
//   BEFORE (how we first designed it)
//     - Red box and button written by hand in this file.
//     - Every error shown exactly as it came from the API.
//     - Inputs only had `required`.
//     - An unused useState import and an unused resetSubmit.
//     So: API down -> "Failed to fetch". Short phone ->
//     "Validation failed". Same markup as login, copy-pasted.
//
//   WHY WE CHANGED IT
//     The weekend assignment asked for loading states, clear
//     form errors and no confusing messages, on existing pages
//     only (no new features). The API now returns a friendly 503
//     when Postgres is down (Task 2), and signup had to show it.
//     We did login first, then copied the same pattern here.
//
//   AFTER (how it works now)
//     1. lib/api.js turns every failure into a friendly Error and
//        sets err.status (0 = never reached the server).
//     2. <FormError> draws the red box.
//     3. <SubmitButton> draws the button and the
//        "Creating account..." state.
//     4. Inputs mirror the API limits, so the browser explains
//        problems next to the field.
//     5. A 400 from signup says exactly what to fix. A 409
//        (phone or shop name taken) already has a clear message
//        from the API, so we show it as is.
//     6. Removed the unused useState import and resetSubmit.
//     The look of the page did NOT change. Only the behaviour.
// ───────────────────────────────────────────────────────────
//
// PRACTICAL EXAMPLE
//   Amina types her business "Amina's Boutique" and a 6-digit
//   phone: the browser says the phone is too short and sends
//   nothing. She fixes it, taps Create account, the button says
//   "Creating account..." and then the dashboard opens. If that
//   phone is already registered she reads "An account with that
//   phone number already exists".
//
// WHERE YOU WILL USE THIS PATTERN
//   Any future form: products, orders, settings.
//
// TRADEOFFS
//   + Same pattern as login, easy to maintain.
//   - Errors show in one box at the top, not under each field.
//     Fine for four fields; a bigger form would need per-field
//     messages.
//
// HOW TO USE
//   Rendered by app/signup/page.js. No props.
// ═══════════════════════════════════════════════════════════

// ❌ BEFORE: there was an import here:
//   import { useState } from 'react';
//   with a comment saying "we still import it because useFormState
//   uses it internally". That was wrong: the hook imports its own
//   useState, and this file never used it.
// ✅ AFTER: removed. Fewer lines, no unused import.

import { useRouter } from 'next/navigation';
// useRouter — gives us the ability to navigate programmatically
// Example: after signup succeeds → push user to /dashboard without a full page reload
// It's like a remote control for the browser's URL bar

import Link from 'next/link';
// Link — Next.js's smart navigation component
// Replaces <a> for internal pages (pages inside this same app)
// Why: <a> does a full page reload (downloads everything again)
// Link does client-side navigation — only swaps what changed, instant

import { api } from '../../lib/api';
// Our centralised API client (apps/web/src/lib/api.js)
// All fetch logic lives there — signup, login, me
// We never write fetch() directly in a form — that would scatter API logic everywhere
// DRY: one place to change the URL or headers, all forms benefit automatically

import { useFormState } from '../../hooks/useFormState';
// Our custom hook — extracts repeated form state logic
// Every form needs: error message, loading state, reset on submit
// DRY: fix a bug here once, all forms get the fix

// ✅ AFTER (NEW) — two shared building blocks
// ❌ BEFORE: this file had no imports for these. The red box and the
//            button were written by hand further down.
import FormError from '../../components/FormError';
// FormError: the red error box. Shows nothing when the message is empty

import SubmitButton from '../../components/SubmitButton';
// SubmitButton: the button that says "Creating account..." and locks itself while waiting

export default function SignupForm() {
  // ─────────────────────────────────────────────
  // ROUTER
  // ─────────────────────────────────────────────
  const router = useRouter();
  // router is now our navigation remote control
  // We use router.push('/dashboard') after a successful signup

  // ─────────────────────────────────────────────
  // FORM STATE (from our custom hook)
  // ─────────────────────────────────────────────
  // ❌ BEFORE: const { error, loading, startSubmit, failSubmit, resetSubmit } = useFormState();
  //            resetSubmit was never used in this file.
  // ✅ AFTER: only what we use.
  const { error, loading, startSubmit, failSubmit } = useFormState();
  // error   — the error message string to display (empty string = no error shown)
  // loading — boolean: true while API call is in flight (locks the button)
  // startSubmit() — call at the TOP of every submit: clears error, sets loading=true
  // failSubmit(msg) — call in catch block: sets error message, sets loading=false

  // ─────────────────────────────────────────────
  // SUBMIT HANDLER
  // ─────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    // e.preventDefault() — stops the browser's default form behaviour
    // Default behaviour: refresh the whole page and send data as a URL query string
    // We don't want that — we want to send JSON to our API and stay on the page
    // Without this line: page reloads, all state is lost, nothing works

    startSubmit();
    // Tell the form: "we're busy, clear any old error, show the loading state"
    // This must be the FIRST thing — before any async work begins

    const formData = new FormData(e.target);
    // e.target is the <form> element
    // FormData reads all the input values by their name= attribute
    // Clean and native — no need to track each field with individual useState

    const body = {
      phone:       formData.get('phone'),       // reads <input name="phone">
      name:        formData.get('name'),         // reads <input name="name">
      password:    formData.get('password'),     // reads <input name="password">
      tenant_name: formData.get('tenant_name'),  // reads <input name="tenant_name">
    };
    // body is the JSON object we send to POST /v1/signup

    try {
      await api.signup(body);
      // Send the signup request to our Express API
      // await means: pause here, wait for the response before continuing
      // If the API returns an error status, api.signup throws — jumps to catch
      // If it succeeds, we continue to the next line

      router.push('/dashboard');
      // Signup worked — send the user to the dashboard
      // Client-side navigation — instant, no full reload

    } catch (err) {
      // ✅ AFTER (NEW) — a 400 gets a message that says what to fix
      // ❌ BEFORE: every error went straight to failSubmit(err.message).
      //            A 400 from signup only says "Validation failed",
      //            which helps nobody.
      // err.status comes from lib/api.js (0 = never reached the server)
      if (err.status === 400) {
        failSubmit(
          'Please check your details: name and business name need at least 2 characters, ' +
          'phone must be 10 to 20 characters and password at least 8.'
        );
        return;
      }

      // Everything else already has a friendly message from lib/api.js:
      //   409 -> "An account with that phone number already exists"
      //   0   -> "We couldn't reach the server..."
      //   503 -> "We're having trouble right now..."
      failSubmit(err.message || 'Could not connect to server');
      // Sets the message so it shows on screen, and unlocks the button
    }
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-blue-900 flex items-center justify-center px-4 py-8">
      {/* Outer wrapper — full screen, dark blue background, centres the card */}

      <div className="w-full max-w-4xl flex rounded-2xl shadow-2xl overflow-hidden">
        {/* Card — max width 4xl, rounded corners, drop shadow, clips children to rounded shape */}

        {/* ── LEFT PANEL — brand messaging (desktop only) ── */}
        <div className="hidden md:flex flex-col justify-between bg-blue-900 text-white w-1/2 p-10">
          {/* hidden md:flex — invisible on mobile, shows as flex on medium screens and up */}
          {/* justify-between — pushes logo to top, login link to bottom */}

          <div>
            {/* Logo mark */}
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                <span className="text-orange-500 font-bold text-lg">R</span>
              </div>
              <span className="font-bold text-lg">Rahisisha Biashara</span>
            </div>

            <h2 className="text-3xl font-bold leading-tight mb-4">
              Simplify your business.
            </h2>
            <p className="text-orange-100 text-sm leading-relaxed mb-8">
              Rahisisha Biashara gives small businesses in Kenya the tools
              to manage customers, track sales, and grow all in one place.
            </p>

            {/* Feature checklist */}
            <ul className="space-y-3 text-sm text-orange-100">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-900 flex items-center justify-center text-xs">✓</span>
                Manage your customers
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-900 flex items-center justify-center text-xs">✓</span>
                Track your sales and revenue
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-900 flex items-center justify-center text-xs">✓</span>
                Grow your business with AI
              </li>
            </ul>
          </div>

          {/* Bottom of left panel — login link for desktop */}
          <p className="text-blue-300 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-white hover:underline font-medium">
              Log in
            </Link>
            {/* Link not <a> — internal page, client-side navigation */}
          </p>
        </div>

        {/* ── RIGHT PANEL — the actual form ── */}
        <div className="bg-white w-full md:w-1/2 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-blue-950">Create account</h1>
            <p className="text-gray-500 text-sm mt-1">Get started in less than a minute</p>
          </div>

          {/* ✅ AFTER (NEW) — the shared FormError component draws the red box.
              It draws NOTHING when `error` is empty, so no `&&` is needed here.
              mb-5 is the same gap below the box that we had before.

              ❌ BEFORE: the box was written by hand right here:
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700
                                  rounded-lg px-4 py-3 mb-5 text-sm">
                    {error}
                  </div>
                )}
              It looked the same, but it was a copy of the login page's box
              and had no role="alert" (screen readers stayed silent). */}
          <FormError message={error} className="mb-5" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* onSubmit wires the form's submit event to our handleSubmit function */}
            {/* space-y-4 — adds vertical gap between each form field */}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Your name
              </label>
              <input
                id="name"
                name="name"
                // name="name" is what FormData.get('name') reads above
                type="text"
                required
                // required — browser-level validation, won't submit if empty
                // ✅ AFTER (NEW): 2 to 100 characters, same as the API rule.
                // ❌ BEFORE: only `required`, so a 1-letter name travelled to
                //            the API and came back as "Validation failed".
                minLength={2}
                maxLength={100}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Sheryl Ochieng"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                // ✅ AFTER (NEW): 10 to 20 characters, same as the API rule
                // ❌ BEFORE: only `required`
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
                // ✅ AFTER (NEW): 8 to 72 characters, same as the API rule
                // (72 is the most bcrypt can use, so longer passwords are cut off)
                // ❌ BEFORE: only `required`. The placeholder promised
                //            "At least 8 characters" but nothing enforced it.
                minLength={8}
                maxLength={72}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label htmlFor="tenant_name" className="block text-sm font-medium text-gray-700 mb-1">
                Business name
              </label>
              <input
                id="tenant_name"
                name="tenant_name"
                type="text"
                required
                // ✅ AFTER (NEW): 2 to 100 characters, same as the API rule
                // ❌ BEFORE: only `required`
                minLength={2}
                maxLength={100}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Amina's Boutique"
              />
            </div>

            {/* ✅ AFTER (NEW) — the shared SubmitButton component.
                It disables itself while `loading` is true and swaps its words
                to "Creating account...". Same orange look and size as before.
                mt-2 keeps the same gap above it.

                ❌ BEFORE: the button was written by hand right here:
                  <button type="submit" disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600
                               disabled:bg-orange-300 text-white font-semibold
                               rounded-lg py-2.5 text-sm transition-colors mt-2">
                    {loading ? 'Creating account...' : 'Create account'}
                  </button>
                Same behaviour, but a copy of the login page's button. */}
            <SubmitButton loading={loading} loadingText="Creating account..." className="mt-2">
              Create account
            </SubmitButton>
          </form>

          {/* Mobile only — login link (left panel is hidden on mobile so we repeat it here) */}
          <p className="text-center text-sm text-gray-500 mt-5 md:hidden">
            Already have an account?{' '}
            <Link href="/login" className="text-orange-500 hover:underline font-medium">
              Log in
            </Link>
          </p>
          {/* md:hidden — shows on mobile, hidden on medium screens and up */}
          {/* The left panel handles this link on desktop */}
        </div>

      </div>
    </div>
  );
}