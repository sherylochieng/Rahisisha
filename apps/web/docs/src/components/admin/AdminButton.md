# apps/web/src/components/admin/AdminButton.js

**Week 30 Day 3, Batch 2.** The main orange button of the admin panel.

## WHY THIS FILE EXISTS
Orange background, NAVY text, and a loading state that locks the button.

## WHY IMPORTANT
Every admin page needs it (sign in, retry, save, confirm). One change restyles them all. Navy on orange is readable, white on orange is not.

## DANGER
Do not use it for destructive actions like Suspend. Those need their own, more careful look and a confirmation step, so nobody clicks them by habit.

## WHAT IT SOLVES / SYSTEM DESIGN PRINCIPLE
Repeated button markup and an inconsistent loading state (DRY). Design for every state: normal, loading, disabled.

## RULES
1. Set `loading` while a call runs, so a double click cannot send it twice.
2. `type` is `button` by default. Use `type="submit"` inside a form.
3. `full` makes it as wide as its box.

## PRACTICAL EXAMPLE (Kenya)
Like the same green "Send" button in every M-Pesa screen: same look, same "wait" state.

## DECISIONS
A boolean `full` instead of width classes. Tailwind classes that fight each other are decided by the stylesheet, not by their order.

## WHERE USED / TRADEOFFS
`AdminLoginForm.js`, `AdminShell.js`, and the shop pages next. One look, one behaviour.

## HOW TO USE
```jsx
<AdminButton type="submit" full loading={loading} loadingText="Signing in...">Sign in</AdminButton>
```

## LINE BY LINE
- Props: `type`, `loading`, `loadingText`, `full`, `onClick`, `children`.
- `disabled={loading}` and `aria-busy={loading}`: lock it and tell screen readers.
- The classes: orange, navy bold text, darker orange on hover, faded when disabled.
- `{loading ? loadingText : children}`: shows "Signing in..." while waiting.
