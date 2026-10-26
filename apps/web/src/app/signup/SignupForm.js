'use client';
// ↑ This tells Next.js: "this file runs in the BROWSER, not on the server"
// Browser-only things like useState, useRouter, form events — they need this directive
// Without it, Next.js tries to render this on the server and crashes

import { useState } from 'react';
// useState — lets a component remember things between renders
// Example: when user types in a field, React re-renders the page
// useState keeps the values alive across those re-renders
// We still import it here because useFormState uses it internally

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
// Every form needs: error message, loading spinner, reset on submit
// Without this hook we'd copy those 2 useState lines into every form file
// DRY: fix a bug here once, all forms get the fix

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
  const { error, loading, startSubmit, failSubmit, resetSubmit } = useFormState();
  // error   — the error message string to display (empty string = no error shown)
  // loading — boolean: true while API call is in flight (disables button, shows spinner text)
  // startSubmit() — call at the TOP of every submit: clears error, sets loading=true
  // failSubmit(msg) — call in catch block: sets error message, sets loading=false
  // resetSubmit() — call in finally if needed: sets loading=false without changing error

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
      failSubmit(err.message);
      // Something went wrong (wrong phone, weak password, server error)
      // failSubmit: sets the error message so it shows on screen, stops the spinner
      // err.message comes from api.js — we throw new Error(data.error) there
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

          {/* Error banner — only renders when error is not an empty string */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
              {error}
            </div>
          )}
          {/* {error && (...)} — conditional rendering
              If error is empty string → falsy → nothing shows
              If error has text → truthy → red banner appears
              This is the React pattern for "show this only when there's a problem" */}

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
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Amina's Boutique"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              // disabled={loading} — when loading is true, button cannot be clicked
              // Prevents double-submits: user clicks once, button locks until API responds
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
            >
              {loading ? 'Creating account...' : 'Create account'}
              {/* Ternary: if loading is true show spinner text, else show normal label */}
              {/* This is the React pattern for dynamic button text */}
            </button>
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