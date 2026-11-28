# apps/web/src/app/admin/login/AdminLoginForm.js

**Week 30 Day 3, Batch 2, part 1.** The admin's phone + password form.

## WHY THIS FILE EXISTS
On success the API sets the admin cookie and we take the admin to `/admin`.

## WHY IMPORTANT
It is the only way into the panel that can suspend any shop.

## DANGER
- Never say which part was wrong: "Wrong phone or password" every time.
- Never log or show the password.
- Never remove `e.preventDefault()`.

## WHAT IT SOLVES
A clear message for each failure: empty fields (400), wrong login (401), too many attempts (429, the API brake), server down.

## SYSTEM DESIGN PRINCIPLE
Design for every state, and share building blocks (`FormError`, `useFormState`).

## RULES
1. Call `adminApi.login()`, never `fetch()`.
2. Show the API's "too many attempts" message as it is.
3. Use `replace()`, not `push()`, so Back does not return to the form.

## PRACTICAL EXAMPLE (Kenya)
Like a bank door with a limited number of PIN tries: a thief gets locked out, and the real manager waits and tries again.

## DECISIONS
Same navy and orange as the owner login but one plain card. The logo, the input boxes and the orange button come from `components/admin/` (`AdminLogo`, `AdminField`, `AdminButton`), so no look is written twice (DRY). The form stays beside its page, like your owner `LoginForm.js`.

## WHERE USED / TRADEOFFS / HOW TO USE
Rendered by `page.js`. Errors show in one box at the top, fine for two fields.

## LINE BY LINE
- `'use client'`: it runs in the browser.
- `useRouter`: to go to `/admin` after login.
- `useFormState`: gives `error`, `loading`, `startSubmit`, `failSubmit`.
- `handleSubmit`: stops the reload, locks the button, reads phone and password, calls `adminApi.login`, then `router.replace('/admin')`. In `catch`: 400 means "Enter your phone number and password.", 401 means "Wrong phone or password.", anything else shows the friendly message from `adminApi`.
- The markup: navy full-screen background, white card, `AdminLogo`, the `FormError` box, two `AdminField` inputs (`autoComplete` helps password managers), and an `AdminButton` that says "Signing in..." while waiting.
