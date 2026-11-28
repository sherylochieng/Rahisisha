# FilterPills.js (guide)

**File:** `apps/web/src/components/admin/FilterPills.js`

## What it is
A row of buttons where exactly one is chosen, for example **All / Active / Suspended**.

## Why it exists
The status filter and the verified filter are the same control. One component builds both, and every filter on later admin lists.

## Architecture
A **controlled component**: the page owns `value`, this file only draws it and calls `onChange`. It never fetches.

## Reuse
Any "pick one" filter: order status, date range, payment method.

## LINE BY LINE
1. `role="group" aria-label={label}`: screen readers announce "Status, group".
2. The small uppercase `<span>`: the visible group name.
3. `options.map(...)`: one button per option.
4. `chosen = option.value === value`: is this the selected one?
5. `aria-pressed={chosen}`: tells assistive tech which is on.
6. `onClick={() => onChange(option.value)}`: report the choice to the page.
7. Class switch: chosen is navy with white text, others white with a border.
8. `key={option.value || 'all'}`: the empty value needs a key too.
