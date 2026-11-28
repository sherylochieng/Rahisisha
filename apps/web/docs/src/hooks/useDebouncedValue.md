# useDebouncedValue.js (guide)

**File:** `apps/web/src/hooks/useDebouncedValue.js`

## What it is
A hook that returns a value only after it has stopped changing for a short time (default 350 ms).

## Why it exists
Typing "Mama Njeri" is 10 key presses. Without it: 10 API calls and 10 database searches, with answers possibly arriving out of order. With it: one call after the pause.

## Kenyan example
A waiter does not run to the kitchen after each word you say. They wait until you finish your order, then go once.

## Reuse
Any search box in any React project: `const q = useDebouncedValue(text, 350);` then fetch when `q` changes.

## Danger
Keep the delay about 300 to 400 ms. Longer feels broken.

## LINE BY LINE
1. `useState(value)`: the calm copy, starts equal to the real value (so page load has no delay).
2. `useEffect(..., [value, delayMs])`: runs whenever the value changes.
3. `setTimeout(() => setDebounced(value), delayMs)`: after the pause, update the calm copy.
4. `return () => clearTimeout(timer)`: if the value changes again before the timer fires (or the page closes), cancel it. This is the whole trick.
5. `return debounced`: the caller uses the calm copy.
