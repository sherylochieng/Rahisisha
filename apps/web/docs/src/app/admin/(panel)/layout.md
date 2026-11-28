# apps/web/src/app/admin/(panel)/layout.js

**Week 30 Day 3, Batch 2, part 1.** Wraps every admin page in the guard and menu.

## WHY THIS FILE EXISTS
Everything inside the `(panel)` folder gets `AdminShell` once.

## WHY IMPORTANT
A new admin page gets the guard for free by living in this folder.

## DANGER
Do not put the sign-in page inside `(panel)`. The guard would wrap it and you could never reach it while signed out.

## WHAT IT SOLVES
"Every admin page is guarded" without repeating code.

## SYSTEM DESIGN PRINCIPLE
Route groups: a folder name in brackets groups pages under one layout without changing the address (`/admin`, not `/admin/(panel)`).

## RULES
1. Keep `robots` noindex for the whole panel.
2. It only wraps. It fetches nothing.

## PRACTICAL EXAMPLE (Kenya)
Like one security desk at the entrance of a building instead of a guard at every office door.

## DECISIONS / WHERE USED / TRADEOFFS / HOW TO USE
It stays a server component (only metadata and wrapping). Add new admin pages under `app/admin/(panel)/`.

## LINE BY LINE
- `import AdminShell`: the client frame.
- `metadata`: title "Admin", noindex.
- `AdminPanelLayout`: returns the shell around `children`.
