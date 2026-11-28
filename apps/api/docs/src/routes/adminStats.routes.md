# adminStats.routes.js (guide)

**File:** `apps/api/src/routes/adminStats.routes.js`

## What it is
The address book for the overview numbers: one address, `GET /v1/admin/stats`, behind the admin guard.

## Why the guard is on the whole router
`router.use(requirePlatformAdmin)` sits above every route. A route added later is protected automatically, so nobody can forget the guard.

## Danger
1. Keep `router.use(requirePlatformAdmin)` above every route line.
2. No `withTenant`: the admin works across shops with the admin lock the service opens.
3. `Cache-Control: no-store`: a browser or proxy never keeps a copy after sign-out.

## Reuse
Copy this file for any new admin area (receipts, admins): change the controller import and the route lines.

## LINE BY LINE
1. Imports: `Router`, `asyncHandler`, the guard, and the handler.
2. `router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); })`: stamp every reply "do not keep a copy".
3. `router.use(requirePlatformAdmin)`: the lock on the door.
4. `router.get('/', asyncHandler(getStatsHandler))`: one address. `asyncHandler` sends a crash to the global error handler instead of hanging the request.
5. `export default router`: `app.js` mounts it at `/v1/admin/stats`.
