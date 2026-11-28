# adminStats.controller.js (guide)

**File:** `apps/api/src/controllers/adminStats.controller.js`

## What it is
The front desk for `GET /v1/admin/stats`: it calls the stats service and writes the reply.

## Why it is so small
There are no rules here and no known refusals. It reads **nothing** from the request (no query words, no body), so there is nothing to attack. A failure is a real fault, so it goes to the global error handler (a plain 500 or 503) and no database detail leaks.

## Reply
`200 { "data": { "shops": { "total", "active", "suspended", "verified", "newThisWeek" } }, "error": null }`

## Danger
Only reachable through `adminStats.routes.js`, where `requirePlatformAdmin` runs first.

## LINE BY LINE
1. `import { pool }`: the shared database pool.
2. `import { getPlatformStats }`: the counting service.
3. `getStatsHandler(_req, res)`: `_req` is unused on purpose.
4. `await getPlatformStats(pool)`: get the five numbers.
5. `res.status(200).json({ data: stats, error: null })`: the same envelope as the rest of your API.
