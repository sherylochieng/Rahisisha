'use client';
// Runs in the browser: we need form events and the admin cookie travels from here.

// =============================================================================
// FILE: apps/web/src/app/admin/login/AdminLoginForm.js   (Week 30 Day 3, Batch 2, part 1)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The admin's sign-in form: phone + password. On success the API sets the admin
//   cookie and we take the admin to /admin.
//
// WHY IMPORTANT
//   It is the only way into the platform admin panel, which can suspend any shop.
//
// DANGER
//   - Never say WHICH part was wrong. "Wrong phone or password" for every failed
//     login, so an attacker learns nothing.
//   - Never log or show the password.
//   - Never remove e.preventDefault() or the page reloads.
//
// WHAT IT SOLVES
//   A clear message for every way sign-in can go wrong: empty fields, wrong login,
//   too many attempts (the API brake), server down.
//
// SYSTEM DESIGN PRINCIPLE
//   Design for every state (normal, loading, wrong password, too many tries,
//   server down) and share building blocks (FormError, useFormState).
//
// RULES
//   1. Call adminApi.login(), never fetch() directly.
//   2. Show the API's "too many attempts" message as it is (it is friendly).
//   3. Use replace(), not push(), after login so Back does not return to the form.
//
// PRACTICAL EXAMPLE
//   A thief tries 20 wrong passwords: the API brake answers 429 and this form shows
//   "Too many attempts. Please try again later." The real admin waits and signs in.
//
// DECISIONS
//   - Same look as the owner login (navy and orange) but a plain single card. No
//     marketing panel: this is a tool, not a shop front.
//   - The logo, the input boxes and the orange button come from components/admin/
//     (AdminLogo, AdminField, AdminButton), so no look is written twice (DRY).
//
// WHERE USED
//   Rendered by app/admin/login/page.js. No props.
//
// TRADEOFFS
//   + Simple and consistent.
//   - Errors show in one box at the top (fine for two fields).
//
// HOW TO USE
//   Rendered by the page. Nothing to call.
// =============================================================================

import { useRouter } from 'next/navigation';
// useRouter: the navigation remote control. We use it to go to /admin after login.

import { adminApi } from '../../../lib/adminApi';
// The one place that talks to the admin API.

import { useFormState } from '../../../hooks/useFormState';
// Shared error + loading state for forms.

import FormError from '../../../components/shared/FormError';
// The shared red error box. Shows nothing when the message is empty.

import AdminLogo from '../../../components/admin/AdminLogo';
import AdminField from '../../../components/admin/AdminField';
import AdminButton from '../../../components/admin/AdminButton';
// The admin building blocks: logo, labelled input, orange button. One copy each, shared.

export default function AdminLoginForm() {
  const router = useRouter();

  const { error, loading, startSubmit, failSubmit } = useFormState();
  // error = text in the red box. loading = true while the call is running.

  async function handleSubmit(e) {
    e.preventDefault(); // stop the page from reloading
    startSubmit();      // clear any old error, lock the button

    const formData = new FormData(e.target);
    const body = {
      phone: formData.get('phone'),
      password: formData.get('password'),
    };

    try {
      await adminApi.login(body);
      // Signed in. The browser now holds the admin cookie by itself.
      router.replace('/admin');
    } catch (err) {
      if (err.status === 400) {
        failSubmit('Enter your phone number and password.');
        return;
      }
      if (err.status === 401) {
        failSubmit('Wrong phone or password.'); // never say which one
        return;
      }
      // 429 (too many attempts), network down, server trouble: the message is already friendly.
      failSubmit(err.message || 'Could not connect to the server.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy px-4 py-8">
      {/* Full screen navy background, card in the middle. */}
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <AdminLogo size="lg" />
          <div>
            <h1 className="text-xl font-bold text-brand-navy">Admin sign in</h1>
            <p className="text-sm text-slate-600">Rahisisha Biashara platform</p>
          </div>
        </div>

        <FormError message={error} className="mb-5" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <AdminField id="phone" name="phone" label="Phone" type="tel" autoComplete="username" required />
          <AdminField id="password" name="password" label="Password" type="password" autoComplete="current-password" required />

          {/* The orange button with NAVY text: readable. Locks itself while loading. */}
          <AdminButton type="submit" full loading={loading} loadingText="Signing in...">
            Sign in
          </AdminButton>
        </form>
      </div>
    </div>
  );
}
