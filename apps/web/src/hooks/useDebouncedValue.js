// =============================================================================
// FILE: apps/web/src/hooks/useDebouncedValue.js   (Week 30 Day 3, Batch 2, part 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Gives you a value that only changes after the typing has paused. Used for search
//   boxes, so we ask the API once per pause, not once per key.
//
// WHY IMPORTANT
//   Typing "Mama Njeri" is 10 keystrokes. Without this, that is 10 API calls and 10
//   database searches, and the answers can arrive out of order.
//
// DANGER
//   - The delay must be short (about 300 to 400 ms), or the page feels broken.
//
// WHAT IT SOLVES
//   Wasted calls, flicker, and answers arriving in the wrong order.
//
// SYSTEM DESIGN PRINCIPLE
//   Debouncing: wait for the user to finish before doing expensive work. A reusable
//   hook, so every search box in the project can share it.
//
// RULES
//   1. The timer is cleared whenever the value changes again, and on unmount.
//   2. The first value is returned straight away (no delay on page load).
//
// PRACTICAL EXAMPLE
//   const q = useDebouncedValue(search, 350);   // q updates 350 ms after the last key
//
// DECISIONS
//   - Generic: it works for any value, not only search text.
//
// WHERE USED
//   ShopsBrowser.js now. Any future search box.
//
// TRADEOFFS
//   + One small hook, used everywhere.
//   - The results lag by the delay. That is the point.
//
// HOW TO USE
//   const debounced = useDebouncedValue(value, 350);
// =============================================================================

import { useEffect, useState } from 'react';

export function useDebouncedValue(value, delayMs = 350) {
  // The calm copy of the value. It starts equal to the real value.
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // Start a timer. If the value changes again, the cleanup cancels it.
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
