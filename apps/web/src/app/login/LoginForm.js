'use client';
// Runs in the browser — we use hooks and form events here

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
// ✅ NEW — our custom hook replaces these two lines we had before:
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
// One import, one line — all form state handled in one place
// If we need to fix error/loading behaviour, we fix it in the hook — all forms benefit

export default function LoginForm() {
  const router = useRouter();

  // ✅ CHANGED — previously we had:
  //   const [error, setError] = useState('');
  //   const [loading, setLoading] = useState(false);
  // Now replaced with one line from our custom hook
  const { error, loading, startSubmit, failSubmit } = useFormState();
  // error        — the message shown in the red banner (empty = banner hidden)
  // loading      — true while API call is in flight (button locked)
  // startSubmit  — call at top of submit: clears error, sets loading=true
  // failSubmit   — call in catch: sets error message, sets loading=false

  async function handleSubmit(e) {
    e.preventDefault();
    // Stops browser default: no page refresh, no URL query string
    // Without this the whole page reloads and all state is lost

    // ✅ CHANGED — previously:
    //   setError('');
    //   setLoading(true);
    // Now one clean call does both
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
      // ✅ CHANGED — previously:
      //   setError(err.message || 'Could not connect to server');
      //   setLoading(false);
      // Now one clean call does both
      failSubmit(err.message || 'Could not connect to server');
      // Shows the error in the red banner
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
          {/* ✅ CHANGED — was <a href="/signup"> which caused a full page reload */}
          {/* Now using Link for instant client-side navigation */}
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

          {/* Error banner — only renders when error string is not empty */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
              {error}
            </div>
          )}
          {/* {error && (...)} — conditional rendering
              empty string = falsy = banner hidden
              any text = truthy = red banner appears
              error value comes from useFormState hook */}

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
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              // disabled={loading} — button cannot be clicked while API call is in flight
              // Prevents double submits — user clicks once, button locks until response
              // disabled:bg-orange-300 — Tailwind shows faded orange when disabled
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
            >
              {loading ? 'Logging in...' : 'Log in'}
              {/* Ternary — switches button text based on loading state
                  loading=true  → 'Logging in...' (user knows something is happening)
                  loading=false → 'Log in' (normal state) */}
            </button>
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