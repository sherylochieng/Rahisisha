# StatCard.js (guide)

**File:** `apps/web/src/components/admin/StatCard.js`

## What it is
One small card showing one number with its label, for example "Active: 8".

## Why it exists (DRY)
The Overview shows five numbers now and will show more later (orders, revenue). One card means they all look the same, and one change restyles them all.

## Kenyan example
The big board on a matatu sacco office wall: each box says what it counts ("Vehicles on the road") and the number in large print.

## Danger
It only draws. A missing value shows a dash, never "undefined" or "NaN". The highlight uses an orange border **and** the words, never colour alone.

## Reuse
Any dashboard in any project: `<StatCard label="Orders today" value={42} />`.

## LINE BY LINE
1. `typeof value === 'number' ? value.toLocaleString('en-KE') : '—'`: real numbers get separators (1,250), anything else shows a dash.
2. The outer `<div>`: a rounded white card; the border turns orange when `highlight` is true.
3. The small uppercase `<p>`: the label.
4. The large `<p>`: the number, the first thing the eye reads.
5. `hint &&`: an optional small line underneath.
