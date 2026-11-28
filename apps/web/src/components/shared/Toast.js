'use client';
// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/shared/Toast.js   (Week 30 Day 3, Batch 4b)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   A small pop-up note that tells the person something just happened, such as
//   "Changes saved", and then goes away by itself. It floats at the corner of the
//   screen, so it is seen even when the page is scrolled.
//
// WHY IMPORTANT
//   A note placed at the top of a long form is easy to miss: the person presses Save
//   at the bottom and sees nothing change. A floating note answers "did that work?" at
//   once, wherever they are on the page.
//
// DANGER
//   1. A CLIENT file ('use client'): it uses a timer to hide itself.
//   2. It must not block the screen or the buttons (it is small and sits in a corner).
//   3. role="status" (polite) for good news and role="alert" for errors, so screen
//      readers announce it without taking over.
//
// WHAT IT SOLVES
//   One reusable "it worked" or "it failed" pop-up for any screen.
//
// SYSTEM DESIGN PRINCIPLE
//   DRY and "feedback for every action": the same pop-up for every screen that saves
//   something, so people learn one signal.
//
// RULES
//   1. Show it by giving `message` text; hide it by giving an empty message.
//   2. The parent owns the message; the toast calls onClose() when its time is up, so
//      the parent clears the message.
//   3. Keep the text short: "Changes saved".
//
// PRACTICAL EXAMPLE
//   const [note, setNote] = useState('');
//   <Toast message={note} onClose={() => setNote('')} />
//   After a good save:  setNote('Changes saved');
//
// DECISIONS
//   - Disappears after 4 seconds (5 for errors) unless the person closes it first.
//   - Fixed to the bottom corner, above the phone's basket bars and menus (high z-index).
//
// WHERE USED
//   components/owner/ShopProfileForm.js
//
// TRADEOFFS
//   + Tiny and clear. - One message at a time (a new one replaces the old).
//
// HOW TO USE
//   import Toast from '../shared/Toast';
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// message      = THE WORDS ON THE NOTE; empty means no note.
// tone         = 'success' (green) or 'error' (red).
// useEffect    = THE KITCHEN TIMER: starts when a message appears, takes the note down after a few seconds.
// clearTimeout = TURNING THE TIMER OFF if the message changes or the screen goes away.
// the X button = THE PERSON TAKING THE NOTE DOWN THEMSELVES.
// ═══════════════════════════════════════════════════════════

// useEffect = React's "do something after the screen changes" tool. We use it as a kitchen timer.
import { useEffect } from 'react';

// Toast props (the things the parent gives us):
//   message = the words to show (empty = show nothing)
//   tone    = 'success' (green, default) or 'error' (red)
//   onClose = what to call when the note should go away (the parent clears the message)
//   seconds = optional: how long to stay before going away
export default function Toast({ message, tone = 'success', onClose, seconds }) {
  // How long it stays: errors a little longer so they can be read
  // lifetime = how many milliseconds the note stays. ?? means "use seconds if given, else 5 for errors, 4 for good news".
  const lifetime = (seconds ?? (tone === 'error' ? 5 : 4)) * 1000;

  // The kitchen timer: starts when a message appears.
  useEffect(() => {
    // No message, no timer needed.
    if (!message) return undefined;
    // After `lifetime`, tell the parent to clear the message (onClose?.() = call it only if it exists).
    const timer = setTimeout(() => onClose?.(), lifetime);
    // Cleanup: if the message changes or the screen closes first, cancel the old timer so it cannot fire late.
    return () => clearTimeout(timer);
  }, [message, lifetime, onClose]);

  // Nothing to say, so draw nothing.
  if (!message) return null;

  // Green for good news, red for errors.
  const colours =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-green-200 bg-green-50 text-green-800';

  // The note itself. fixed bottom-6 right-6 = stuck to the corner of the screen even when scrolling.
  // role alert/status = screen readers announce it (urgent for errors, polite for good news).
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`fixed bottom-6 right-6 z-[60] flex max-w-sm items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg ${colours}`}
    >
      <span>{message}</span>
      {/* The little x so the person can close the note early. */}
      <button
        type="button"
        onClick={() => onClose?.()}
        aria-label="Close message"
        className="text-lg leading-none opacity-60 hover:opacity-100"
      >
        &times;
      </button>
    </div>
  );
}
