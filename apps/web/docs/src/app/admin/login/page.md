# apps/web/src/app/admin/login/page.js

**Week 30 Day 3, Batch 2, part 1.** The address `/admin/login`.

## WHY THIS FILE EXISTS
It sets the tab title, tells search engines to stay away, and shows the sign-in form.

## WHY IMPORTANT
The admin door must never appear in Google and must be a separate door from the owner's `/login`.

## DANGER
Do not link to it from public pages. It is not a secret (the password and the API are the real protection), but there is no reason to advertise it.

## WHAT IT SOLVES
A clear, separate sign-in address for the platform admin.

## SYSTEM DESIGN PRINCIPLE
Thin page, fat component: the page frames, `AdminLoginForm.js` works.

## RULES
1. Keep `robots: { index: false }`.
2. No data fetching here.

## PRACTICAL EXAMPLE
Type `rahisishabiashara.com/admin/login`, sign in, land on `/admin`.

## DECISIONS
It lives OUTSIDE the `(panel)` folder, so the guard does not wrap it. Otherwise you could never reach it while signed out.

## WHERE USED / TRADEOFFS / HOW TO USE
Next.js serves it. Nothing to call. Tiny and obvious.

## ALSO IN THIS STEP: robots.js
`/admin` was added to the `disallow` list in `apps/web/src/app/robots.js`, one added line, nothing removed. It asks search engines not to list any admin page.

## LINE BY LINE
- `import AdminLoginForm`: the client form.
- `metadata`: title "Admin sign in" and noindex.
- `AdminLoginPage`: wraps the form in `<main>`.
