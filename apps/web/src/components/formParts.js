// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/formParts.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Two tiny pieces every box in a form shares: the look of a box
//   (inputClass) and the small red message under it (FieldError).
//   They used to live inside ProductForm.js. Now ProductForm and
//   CategorySelect (and any future form) use ONE copy.
//
// WHY IMPORTANT
//   Change the look of every form box, or the colour of every error,
//   in one place.
//
// DANGER (what breaks without it)
//   Each form copying the same class string: one gets the new look, the
//   others stay old, and the app looks careless.
//
// WHAT IT SOLVES
//   inputClass(hasError)      -> the Tailwind classes for a box
//   <FieldError id message /> -> the red note, or nothing when no message
//
// SYSTEM DESIGN PRINCIPLE
//   DRY and separation of concerns: look-and-feel lives apart from the
//   forms that use it. The code is exactly what ProductForm had before,
//   only moved.
//
// RULES
//   1. Keep the red outline on a box with a problem (accessibility).
//   2. FieldError draws nothing when the message is empty.
//
// WHERE USED
//   components/owner/ProductForm.js, components/owner/CategorySelect.js
//
// TRADEOFFS
//   + One place for form looks. - The login and signup forms still carry
//     their own look (a later, separate tidy-up).
//
// HOW TO USE
//   import { inputClass, FieldError } from './formParts';
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// inputClass = THE BOX STAMP: every box gets the same size, border and focus
//   ring; a box with a problem gets a red border.
// FieldError = THE RED STICKY NOTE under a box. No message, no note.
// ═══════════════════════════════════════════════════════════

// Same look for every box (red outline when that box has a problem)
export function inputClass(hasError) {
  return `w-full border ${hasError ? 'border-red-500' : 'border-gray-300'} rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent`;
}

// FieldError: the small red message under a box. Draws nothing when empty
export function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-600">
      {message}
    </p>
  );
}
