// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/SubmitButton.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   After you click "Log in", the server takes a moment to
//   answer. This button shows "Please wait..." and switches
//   itself OFF during that moment.
//
// WHY IMPORTANT
//   Without feedback people think nothing happened and click
//   again and again. That sends the same request many times.
//
// DANGER (what breaks without it)
//   - Double signup: two clicks create two requests. The second
//     fails with "phone already exists", which confuses the user.
//   - The page feels frozen, so users leave.
//
// WHAT IT SOLVES
//   One reusable submit button with a built-in loading state,
//   used on every form.
//
// SYSTEM DESIGN PRINCIPLE
//   "Give feedback for every action" and "prevent double
//   submits". The button blocks repeat clicks on the front end.
//   (The back end still must protect itself. Never trust the
//   button alone.)
//
// RULES (never do this)
//   1. NEVER rely on this button alone to stop duplicate
//      requests. The API must also reject duplicates (it does,
//      e.g. duplicate phone returns 409).
//   2. NEVER change the button's WIDTH when loading starts. We
//      only change the words, so the layout does not jump.
//   3. NEVER hide the button while loading. Keep it visible but
//      disabled.
//   4. NEVER put form logic in here. The form decides when it
//      is loading, this file only displays it.
//
// PRACTICAL EXAMPLE
//   <SubmitButton loading={loading}>Log in</SubmitButton>
//   Not loading: shows "Log in", can be clicked.
//   Loading:     shows "Please wait...", greyed out, cannot be clicked.
//
// DECISIONS
//   - Props: loading (true/false), children (the normal label),
//     loadingText (the label while loading), className.
//   - type="submit": it submits the form it sits inside.
//   - No 'use client' needed: it holds no state of its own. The
//     form that uses it is the client component.
//
// WHERE YOU WILL USE THIS
//   - LoginForm.js and SignupForm.js (next steps)
//   - Any future form
//
// TRADEOFFS
//   + Tiny and reusable.
//   - It does not know when the request ends by itself. The
//     parent must pass loading={true/false}.
//
// HOW TO USE
//   import SubmitButton from '../../components/SubmitButton';
//   <SubmitButton loading={loading}>Create account</SubmitButton>
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. loading  =  THE "TILL IS BUSY" LIGHT
//    true while the request is travelling to the server.
//
// 2. disabled={loading}  =  THE TILL REFUSES MORE TAPS
//    A disabled button ignores clicks. Like the card machine
//    saying "Processing, do not remove card".
//
// 3. aria-busy={loading}
//    =  TELLING SCREEN READERS "STILL WORKING"
//    Blind users hear that the action is in progress.
//
// 4. {loading ? loadingText : children}
//    =  SWAPPING THE WORDS ON THE BUTTON
//    "?" means: if loading, show this, else show that.
//    children is whatever you wrote between the tags.
//
// 5. disabled:opacity-60 disabled:cursor-not-allowed
//    =  GREYED OUT + "NO ENTRY" CURSOR
//    Tailwind styles that apply ONLY while disabled.
//
// 6. type="submit"  =  THE BUTTON THAT SENDS THE FORM
//    Pressing Enter in a field also triggers it.
// ═══════════════════════════════════════════════════════════

export default function SubmitButton({
  loading = false,
  loadingText = 'Please wait...',
  children,
  className = '',
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
            className={`w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300 ${className}`}
    >
      {loading ? loadingText : children}
    </button>
  );
}