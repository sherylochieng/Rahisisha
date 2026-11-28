# adminSession.js (guide)

**File:** `apps/web/src/lib/admin/adminSession.js`

## What it is
One function, `redirectIfSignedOut(err, router)`. If the API said **401** (signed out), it sends the admin to `/admin/login` and returns `true`. For any other error it returns `false` and does nothing.

## Why it exists (DRY)
Every admin screen has to react to "your session ended". Written once here, fixed once here.

## Kenyan example
An M-Pesa agent leaves the till screen open overnight. In the morning the session has expired, so pressing any button takes them to the login screen instead of showing a confusing error. That is this file.

## Danger
Only 401 means signed out. A weak signal (status 0) or a server error (500) must NOT log the admin out.

## Reuse
Any project with cookie sessions: one small helper, called from every `catch`.

## LINE BY LINE
1. `if (err && err.status === 401)`: there is an error, and it is a 401.
2. `router.replace('/admin/login')`: go to sign in, and replace the history entry so Back does not return to the dead page.
3. `return true`: tells the caller "I handled it, stop".
4. `return false`: "not mine, you show the message".
