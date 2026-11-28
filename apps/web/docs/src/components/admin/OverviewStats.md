# OverviewStats.js (guide)

**File:** `apps/web/src/components/admin/OverviewStats.js`

## What it is
The row of overview numbers on the admin home page: All shops, Active, Suspended, Verified, New this week.

## Architecture
`useAdminLoad` fetches, `StatCard` draws, this file arranges the cards and chooses what to show for each state (loading, error with Try again, ready). The cards come from one list, `CARDS`, so adding a number is one line. The numbers come from `GET /v1/admin/stats` and are counts only.

## Kenyan example
The manager walks into head office and sees the tally board first: how many shops, how many closed, how many checked, how many new this week.

## Decisions
- The Suspended card is highlighted only when the count is above zero, so a quiet platform looks quiet.
- No auto-refresh: the numbers are as of page load. Real-time numbers are not worth the extra load.

## Danger
Counts only. Never add names or phone numbers here. A 401 sends the admin to sign in (handled inside `useAdminLoad`).

## Reuse
Add a number: add the counter to the API's `SELECT`, then one line to `CARDS`.

## LINE BY LINE
1. `CARDS`: key (the name in the API answer), label and hint for each card.
2. `useAdminLoad(() => adminApi.getStats(), 'overview-stats')`: load the numbers once on arrival.
3. `if (loading)`: the "Loading numbers..." line.
4. `if (!data)`: the error message and a Try again button (the hook's `retry`).
5. `const shops = data.shops`: the five numbers.
6. The grid: one column on a phone, two on a small tablet, five on a wide screen.
7. `CARDS.map(...)`: one `StatCard` per entry; `highlight` only for suspended when above zero.
