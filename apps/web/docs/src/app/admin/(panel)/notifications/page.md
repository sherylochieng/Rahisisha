# app/admin/(panel)/notifications/page.js

**FILE:** `apps/web/src/app/admin/(panel)/notifications/page.js` (Week 30 Day 3, Batch 3b-2b, web step 4)

## WHY THIS FILE EXISTS

The address `/admin/notifications`. It only sets the page title and shows the browser component.

## WHY IMPORTANT

The page file stays tiny. The interactive work lives in `NotificationsBrowser.js` (a client component), exactly like the Shops page.

## DANGER

The admin guard is the `(panel)` layout around this page (`AdminShell`). Do not move this file outside the `(panel)` folder.

## WHAT IT SOLVES

"A page for the outbox inside the admin panel."

## SYSTEM DESIGN PRINCIPLE

Server page plus client component split.

## RULES

No data fetching here.

## PRACTICAL EXAMPLE

Visit `/admin/notifications` while signed in as an admin.

## DECISIONS / WHERE USED / TRADEOFFS / HOW TO USE

Same shape as `shops/page.js`. Linked from the admin menu in `AdminShell.js`.

---

## LINE BY LINE

**`import NotificationsBrowser ...`** The screen itself.

**`export const metadata = { title: 'Notifications' }`** The browser tab title.

**`export default function AdminNotificationsPage()`** Returns the browser component.
