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
//   - (Week 29 Day 1) Bad input showed ONE long message at the
//     top, or a browser pop-up, and the user had to guess which
//     box was wrong.
//
// WHAT IT SOLVES
//   Clear messages for every way signup can go wrong, using the
//   shared FormError and SubmitButton instead of copies. Field
//   problems now show UNDER the box that is wrong.
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
//      again. The checks in this file only save a wasted request.
//   5. NEVER paste the red box or button markup back in here.
//   6. NEVER change the limits below without changing the API.
//      They mirror signupSchema in routes/auth/signup.js:
//        name 2-100, phone 10-20, password 8-72, business 2-100.
//   7. (Week 29 Day 1) FIELD_RULES and FIELD_HELP below must say
//      the same thing as the limits in rule 6.
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
//   AFTER (how it worked at the end of Week 28)
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
// ───────────────────────────────────────────────────────────
// THE STORY: BEFORE AND AFTER (Week 29 Day 1, reviewer fix)
// ───────────────────────────────────────────────────────────
//   REVIEWER SAID
//     "Validation errors do not surface clearly in forms." The
//     assignment check was: type a bad phone number and look for a
//     message under the field.
//
//   BEFORE (end of Week 28)
//     - The browser's own pop-up bubble complained about the first
//       bad box (it is not under the field, and it looks different
//       on every browser).
//     - If a 400 reached us from the API, ONE long sentence at the
//       top listed every limit. The user had to work out which
//       box was wrong.
//     - A duplicate phone (409) also showed only at the top.
//
//   WHY WE CHANGED IT
//     lib/api.js already staples the API's field-by-field problems
//     onto the error (err.details), and the API already sends them.
//     Only this form ignored them. And the browser pop-up stopped
//     bad input before we could show our own words.
//
//   AFTER (now)
//     1. <form noValidate> switches the browser pop-up off.
//     2. validate() checks the four limits first (FIELD_RULES) and
//        shows kind words under each wrong box (FIELD_HELP). The
//        first wrong box also gets the cursor.
//     3. If a 400 still comes back from the API, we read
//        err.details and show the same words under the same boxes.
//     4. A 409 about the phone shows "already has an account"
//        under the phone box.
//     5. Each wrong box gets a red border, aria-invalid and
//        aria-describedby, so screen readers read the message.
//     6. The banner at the top stays, short: "Please fix the
//        highlighted fields." The old long 400 sentence stays as
//        the last fallback.
//     The look of the page did not change, except the red text and
//     border under a wrong box.
// ───────────────────────────────────────────────────────────
//
// PRACTICAL EXAMPLE
//   Amina types her business "Amina's Boutique" and a 6-digit
//   phone, then taps Create account. Nothing is sent. The phone
//   box turns red and says "Phone number must be 10 to 20
//   characters." under it, and the cursor jumps into it. She fixes
//   it, taps again, the button says "Creating account..." and then
//   the dashboard opens. If that phone is already registered she
//   reads "This phone number already has an account. Try logging
//   in." under the phone box.
//
// WHERE YOU WILL USE THIS PATTERN
//   Any future form: products, orders, settings.
//
// TRADEOFFS
//   + Same pattern as login, easy to maintain.
//   ❌ BEFORE: Errors show in one box at the top, not under each
//     field. Fine for four fields; a bigger form would need
//     per-field messages.
//   ✅ AFTER (Week 29 Day 1): per-field messages, as the bigger-form
//     note said we would need.
//   - The limits now live in two places (the API schema and
//     FIELD_RULES here). If they drift apart, the API still wins,
//     because it checks again and we show its field errors too.
//   - A wrong box stays red until the next submit (we do not clear
//     it while typing). Simple, and fine for a four-field form.
//
// HOW TO USE
//   Rendered by app/signup/page.js. No props.
// ═══════════════════════════════════════════════════════════

// ❌ BEFORE (Week 28): there was an import here:
//   import { useState } from 'react';
//   with a comment saying "we still import it because useFormState
//   uses it internally". That was wrong: the hook imports its own
//   useState, and this file never used it.
// ✅ AFTER (Week 28): removed. Fewer lines, no unused import.
// ✅ AFTER (Week 29 Day 1): it is back, and this time it is used:
//   fieldErrors below needs its own memory. (The hook keeps the
//   banner message and the loading flag; this file keeps the
//   per-field messages.)
import { useState } from 'react';

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

// ─────────────────────────────────────────────
// FIELD RULES AND FIELD HELP  (Week 29 Day 1)
// ─────────────────────────────────────────────
// ✅ AFTER (NEW): two small tables, one row per box.
// ❌ BEFORE: they did not exist. The limits lived only in the minLength /
//            maxLength attributes and in one long sentence in the catch block.
//
// FIELD_RULES: [shortest, longest] number of characters. These are the SAME
//   numbers as signupSchema in apps/api/src/routes/auth/signup.js.
//   REAL LIFE: the height line at a fairground ride. The sign at the gate and
//   the one at the ride must say the same thing.
const FIELD_RULES = {
  name:        [2, 100],
  phone:       [10, 20],
  password:    [8, 72],
  tenant_name: [2, 100],
};

// FIELD_HELP: kind words shown UNDER the box that is wrong.
//   WHY not the server's own text: zod says things like "String must contain
//   at least 10 character(s)", which a shop owner cannot use.
const FIELD_HELP = {
  name:        'Your name must be 2 to 100 characters.',
  phone:       'Phone number must be 10 to 20 characters.',
  password:    'Password must be 8 to 72 characters.',
  tenant_name: 'Business name must be 2 to 100 characters.',
};

// validate(body): checks every box against FIELD_RULES.
//   Returns an object with ONLY the wrong boxes: { phone: 'words...' }.
//   An empty object {} means everything is fine.
//   EXAMPLE: phone "0712" -> { phone: 'Phone number must be 10 to 20 characters.' }
function validate(body) {
  const problems = {};
  for (const field of Object.keys(FIELD_RULES)) {
    const [min, max] = FIELD_RULES[field];
    const length = String(body[field] ?? '').length;
    if (length < min || length > max) {
      problems[field] = FIELD_HELP[field];
    }
  }
  return problems;
}

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

  // ✅ AFTER (Week 29 Day 1, NEW): which boxes are wrong right now.
  // Looks like { phone: 'words', password: 'words' }. An empty object means
  // nothing is wrong. Wiped at the start of every submit.
  // ❌ BEFORE: there was no per-field memory, only the one banner message.
  const [fieldErrors, setFieldErrors] = useState({});

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

    setFieldErrors({});
    // ✅ AFTER (Week 29 Day 1, NEW): forget the old red notes under the boxes
    // before trying again, the same way startSubmit() clears the banner.

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

    // ✅ AFTER (Week 29 Day 1, NEW): check the boxes BEFORE sending anything.
    // ❌ BEFORE: the browser's own pop-up did this job (and showed nothing
    //            under the field), and the API checked again.
    // WHY still send to the API when this passes: the API is the real guard.
    // These checks only save a wasted request and give nicer words.
    const problems = validate(body);
    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      failSubmit('Please fix the highlighted fields.');
      // Put the cursor in the FIRST wrong box. The ids below match the keys
      // of FIELD_RULES (name, phone, password, tenant_name).
      const firstWrong = Object.keys(problems)[0];
      document.getElementById(firstWrong)?.focus();
      return;
    }

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
      // ✅ AFTER (Week 29 Day 1, NEW): a 400 WITH details = the API told us
      // WHICH boxes are wrong. err.details looks like
      // { phone: ['...'], password: ['...'] } (lib/api.js staples it on).
      // We keep only the boxes we know and show OUR kind words under them.
      // WHEN this runs: if our own validate() above and the API ever disagree.
      // ❌ BEFORE: err.details was ignored.
      if (err.status === 400 && err.details) {
        const found = {};
        for (const field of Object.keys(FIELD_HELP)) {
          if (err.details[field]) found[field] = FIELD_HELP[field];
        }
        if (Object.keys(found).length > 0) {
          setFieldErrors(found);
          failSubmit('Please fix the highlighted fields.');
          document.getElementById(Object.keys(found)[0])?.focus();
          return;
        }
      }

      // ✅ AFTER (Week 29 Day 1, NEW): 409 about the phone = that number
      // already has an account. Show it UNDER the phone box.
      // ❌ BEFORE: it appeared only in the banner at the top.
      // The /phone/i test reads the API's own message
      // ("An account with that phone number already exists").
      if (err.status === 409 && /phone/i.test(err.message || '')) {
        setFieldErrors({ phone: 'This phone number already has an account. Try logging in.' });
        failSubmit('Please fix the highlighted fields.');
        document.getElementById('phone')?.focus();
        return;
      }

      // ✅ AFTER (Week 28): a 400 gets a message that says what to fix
      // ❌ BEFORE: every error went straight to failSubmit(err.message).
      //            A 400 from signup only says "Validation failed",
      //            which helps nobody.
      // err.status comes from lib/api.js (0 = never reached the server)
      // (Week 29 Day 1: this is now only the LAST fallback, for a 400 that
      //  has no field details.)
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
              and had no role="alert" (screen readers stayed silent).

              (Week 29 Day 1: the banner now says something short like
              "Please fix the highlighted fields." and the details sit under
              each box.) */}
          <FormError message={error} className="mb-5" />

          {/* ✅ AFTER (Week 29 Day 1, NEW): noValidate switches OFF the browser's
              own pop-up bubble, so OUR messages (under each box) are the ones
              the user sees. validate() above does the checking instead.
              ❌ BEFORE: <form onSubmit={handleSubmit} className="space-y-4">
              The browser stopped the submit with its own bubble, which is not
              under the field and looks different in every browser. */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                // required — kept for meaning and for screen readers. With
                // noValidate on the form, validate() does the real checking.
                // ✅ AFTER (NEW): 2 to 100 characters, same as the API rule.
                // ❌ BEFORE: only `required`, so a 1-letter name travelled to
                //            the API and came back as "Validation failed".
                minLength={2}
                maxLength={100}
                // ✅ AFTER (Week 29 Day 1, NEW): when this box is wrong it gets a
                // red border, aria-invalid (tells screen readers it is wrong) and
                // aria-describedby (points to the message below, so it is read
                // out loud). Otherwise they are off and the look is unchanged.
                // ❌ BEFORE: className was always the grey border below.
                aria-invalid={fieldErrors.name ? 'true' : 'false'}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                className={`w-full border ${fieldErrors.name ? 'border-red-500' : 'border-gray-300'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent`}
                placeholder="Sheryl Ochieng"
              />
              {/* ✅ AFTER (Week 29 Day 1, NEW): the message UNDER the box.
                  Draws nothing when the box is fine. */}
              {fieldErrors.name && (
                <p id="name-error" className="text-red-600 text-xs mt-1">
                  {fieldErrors.name}
                </p>
              )}
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
                // Week 29 Day 1: red border, aria-invalid and aria-describedby
                // when wrong (see the name box above for the full story).
                aria-invalid={fieldErrors.phone ? 'true' : 'false'}
                aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                className={`w-full border ${fieldErrors.phone ? 'border-red-500' : 'border-gray-300'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent`}
                placeholder="0712345678"
              />
              {fieldErrors.phone && (
                <p id="phone-error" className="text-red-600 text-xs mt-1">
                  {fieldErrors.phone}
                </p>
              )}
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
                // Week 29 Day 1: red border, aria-invalid and aria-describedby
                // when wrong (see the name box above for the full story).
                aria-invalid={fieldErrors.password ? 'true' : 'false'}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className={`w-full border ${fieldErrors.password ? 'border-red-500' : 'border-gray-300'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent`}
                placeholder="At least 8 characters"
              />
              {fieldErrors.password && (
                <p id="password-error" className="text-red-600 text-xs mt-1">
                  {fieldErrors.password}
                </p>
              )}
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
                // Week 29 Day 1: red border, aria-invalid and aria-describedby
                // when wrong (see the name box above for the full story).
                aria-invalid={fieldErrors.tenant_name ? 'true' : 'false'}
                aria-describedby={fieldErrors.tenant_name ? 'tenant_name-error' : undefined}
                className={`w-full border ${fieldErrors.tenant_name ? 'border-red-500' : 'border-gray-300'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent`}
                placeholder="Amina's Boutique"
              />
              {fieldErrors.tenant_name && (
                <p id="tenant_name-error" className="text-red-600 text-xs mt-1">
                  {fieldErrors.tenant_name}
                </p>
              )}
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