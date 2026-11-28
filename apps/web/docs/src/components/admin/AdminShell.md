# apps/web/src/components/admin/AdminShell.js

**Week 30 Day 3, Batch 2, part 1.** The frame and the guard for every admin page.

## WHY THIS FILE EXISTS
It draws the navy menu and the sign-out button, and sends a signed-out visitor to `/admin/login`.

## WHY IMPORTANT
One guard in one place: no admin page can forget to check the sign-in.

## DANGER
- This guard only decides what the PAGE shows. The real lock is the API (`requirePlatformAdmin`). Never move security into the browser.
- Never show children until the check says signed in.

## WHAT IT SOLVES
Signed-out visitors see the sign-in page. Network trouble shows a message and a Retry button, not a bounce to login.

## SYSTEM DESIGN PRINCIPLE
Defence in depth: the API is the lock, the shell is the friendly doorman. Fail safe: while we do not know yet, show nothing private.

## RULES
1. 401 from `/admin/auth/me` means go to `/admin/login`.
2. Any other failure shows a message and Retry. It does not sign the admin out.
3. Clean up the effect (`cancelled`) so a late answer cannot update a page that is gone.

## PRACTICAL EXAMPLE (Kenya)
Like the guard at a bank: he checks your badge before you reach the counter, but the vault door has its own lock.

## DECISIONS
The menu lists only pages that exist (Overview for now). Navy menu, orange active item: option C.

## WHERE USED / TRADEOFFS / HOW TO USE
`app/admin/(panel)/layout.js` wraps every admin page in it. A short "Checking..." flash on first load.

## LINE BY LINE
- `NAV`: the menu entries. Add one when a new page exists.
- `state` / `attempt`: what we know (`checking`, `ready`, `error`), and a counter to run the check again.
- `useEffect`: calls `adminApi.me()`. On success it stores the admin. On 401 it redirects. On other errors it shows the message. The returned function sets `cancelled`.
- `handleSignOut`: calls logout (ignoring failure) and goes to the sign-in page.
- The logo and the Retry button are the shared `AdminLogo` and `AdminButton`.
- Three returns: checking (plain text), error (message + "Try again"), ready (navy side menu with the signed-in name and a sign-out button, and the page on the right).

---

## Addition (Week 30 Day 3, Batch 2, part 2)

- **Menu:** `NAV` now has **Shops** (`/admin/shops`) beside Overview.
- **Active item:** Overview lights only on its exact page; other items stay lit on their sub-pages (`pathname.startsWith`), so `/admin/shops/123` keeps "Shops" lit.
- **DRY:** the "401 means go to sign in" rule now comes from `lib/admin/adminSession.js` instead of being typed here.
- Nothing else changed: the checking / ready / error states, sign out and Retry are as before.


---

## ADDED IN BATCH 3b-2b: the Notifications menu item

One line was added to the `NAV` list: `{ href: '/admin/notifications', label: 'Notifications' }`, after Shops. The highlight rule (`pathname.startsWith`) already works for it, so nothing else changed. Real life: one more door sign in the corridor.
