# adminStats.routes.test.js (guide)

**File:** `apps/api/tests/adminStats.routes.test.js`

## What it proves
The overview address is locked, and a signed-in admin gets the right, uncached reply, through the whole app with real cookies.

## The four checks
1. No cookie: 401, with the same envelope as every admin address.
2. A cookie signed with the **shop** secret instead of the admin key: 401. A shop owner is not an admin.
3. A signed-in admin: 200, `{ shops: { ...five integers } }`, `Cache-Control: no-store`.
4. Words added to the address (`?status=banana&q=anything&limit=1`) are ignored and the answer is unchanged.

## Mutation check I ran
With `router.use(requirePlatformAdmin)` removed, two checks failed (checks 1 and 2).

## Setup
Creates its own admin, signs in with `request.agent(app)` (a browser that keeps cookies), and deletes the admin afterwards.
