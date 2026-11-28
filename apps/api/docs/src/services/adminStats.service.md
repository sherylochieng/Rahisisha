# adminStats.service.js (guide)

**File:** `apps/api/src/services/adminStats.service.js`

## What it is
One function, `getPlatformStats(db)`, that counts the shops for the admin's Overview page: total, active, suspended, verified, and new in the last 7 days.

## Why it exists
It is the first thing an admin sees after signing in. The numbers must be right, and they must be **only numbers**: no names, phones or ids.

## Kenyan example
The county office manager asks: "How many businesses are registered? How many are closed? How many did we verify? How many joined this week?" She gets one tally sheet, made in one pass down the register.

## Architecture
- **Service layer:** the counting rules live here, testable without a web server.
- **One query, one snapshot:** a single `SELECT` with `COUNT(*) FILTER (...)` counts all five numbers at once, so they always agree with each other.
- **Admin lock:** the query runs inside `withAdminLock`. On the plain pool, the locked shops table would answer zero.
- **Data minimisation:** only counts leave this file.

## Danger
1. Who may ask is decided by the route guard, never here.
2. Deleted shops must not count towards anything.
3. `COUNT` comes back from the database driver as text; we cast with `::int` so the screen receives real numbers.

## Reuse
Any dashboard of counts: orders per status, customers per month. Add counters to the same `SELECT`, not new queries.

## LINE BY LINE
1. `withAdminLock(db, async (client) => ...)`: opens the head-office lock for this one transaction and hands us a connection.
2. `COUNT(*) FILTER (WHERE status <> 'deleted')::int AS total`: every shop that is not deleted.
3. `... status = 'active'`: open shops. `... status = 'suspended'`: closed shops.
4. `... status <> 'deleted' AND verified_at IS NOT NULL`: verified, ignoring deleted shops.
5. `... created_at >= NOW() - INTERVAL '7 days'`: a rolling seven-day window.
6. `const r = rows[0]`: the single row of five numbers.
7. The returned object `{ shops: { total, active, suspended, verified, newThisWeek } }`: nested under `shops` so later batches can add `orders` or `revenue` beside it without renaming anything.
