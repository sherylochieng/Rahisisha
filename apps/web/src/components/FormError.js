// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/FormError.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Forms fail for many reasons: wrong password, a field is too
//   short, the server is down. This one small component shows
//   ANY of those messages in the same clear red box.
//
// WHY IMPORTANT
//   A good error message tells the user WHAT went wrong and
//   WHERE. Bad errors ("Validation failed") make people give up.
//
// DANGER (what breaks without it)
//   - Every form invents its own error style, so the app feels
//     messy and some forms forget to show errors at all.
//   - Screen readers do not announce errors, so blind users
//     think nothing happened.
//
// WHAT IT SOLVES
//   One reusable error box, used on login, signup and any future
//   form. Change the look once here and every form updates.
//
// SYSTEM DESIGN PRINCIPLE
//   "Don't Repeat Yourself" (DRY) and "accessible by default".
//   Also: a component that has nothing to say renders NOTHING
//   (returns null), so callers do not need an if-statement.
//
// RULES (never do this)
//   1. NEVER show raw server or database errors here. Pass only
//      friendly text (the API already sends friendly text).
//   2. NEVER remove role="alert". It is what makes screen
//      readers announce the message.
//   3. NEVER put the message in colour alone. We also use text,
//      so colour-blind users still understand.
//   4. NEVER put logic about WHICH error to show in here. The
//      form decides, this file only displays.
//
// PRACTICAL EXAMPLE
//   Under the phone field:
//     <FormError message="Phone must be at least 10 digits" />
//   At the top of the form after a server outage:
//     <FormError message="We're having trouble right now.
//                         Please try again in a moment." />
//   When there is no error, message is empty and nothing shows.
//
// DECISIONS
//   - Props: message (text), id (so an input can point to it
//     with aria-describedby), className (extra spacing).
//   - Tailwind classes, to match the rest of the app.
//   - No 'use client': it holds no state and no clicks, so it
//     can be a plain server-friendly component.
//
// WHERE YOU WILL USE THIS
//   - LoginForm.js and SignupForm.js (next steps)
//   - Any future form: products, orders, settings
//
// TRADEOFFS
//   + Tiny, simple, reusable.
//   - It shows ONE message. For many field errors, use one
//     <FormError> per field.
//
// HOW TO USE
//   import FormError from '../../components/FormError';
//   <FormError message={error} />
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. function FormError({ message, id, className })
//    =  A WARNING SIGN THAT YOU HANG WHERE NEEDED
//    The props are the words you write on the sign.
//
// 2. if (!message) return null
//    =  NO PROBLEM, NO SIGN
//    Empty message means we draw nothing. Like a wall with no
//    sign when the floor is dry.
//
// 3. role="alert"
//    =  A SHOP ALARM BELL FOR SCREEN READERS
//    The browser announces the text out loud the moment it
//    appears. WHEN: any error that appears after a click.
//
// 4. id={id}
//    =  A NAME TAG ON THE SIGN
//    An input can say aria-describedby="phone-error" to point
//    to its sign, so screen readers read the error with it.
//
// 5. Tailwind classes
//    border-red-300 / bg-red-50 / text-red-700 = a soft red box
//    with dark red text, readable and not scary.
//    text-sm = small text. rounded = soft corners.
//    px-3 py-2 = padding inside. mt-1 = small gap above.
//
// 6. ${className}
//    =  EXTRA STICKERS
//    Lets a form add spacing, e.g. className="mb-4".
// ═══════════════════════════════════════════════════════════

export default function FormError({ message, id, className = '' }) {
  // Nothing to say, so draw nothing
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
            className={`rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${className}`}
    >
      {message}
    </p>
  );
}