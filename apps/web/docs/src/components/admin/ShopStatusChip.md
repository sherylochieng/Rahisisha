# ShopStatusChip.js (guide)

**File:** `apps/web/src/components/admin/ShopStatusChip.js`

## What it is
The small pill that says **Active**, **Suspended** or **Deleted**.

## Why it exists (DRY + accessibility)
The list and the detail page both show a status. One component = one colour rule. The word is always printed, so it works without colour (colour-blind users, black-and-white print).

## Reuse
Any status badge (order status, loan status). Change the `LOOKS` table and the labels.

## Danger
An unknown status still shows (grey, with its own word). Nothing silently disappears.

## LINE BY LINE
1. `LOOKS`: colour classes per known status. Active blue, suspended orange, deleted slate.
2. `LOOKS[status] || 'bg-slate-100 ...'`: unknown status falls back to grey.
3. `label`: capitalises the first letter ("active" becomes "Active"); empty becomes "Unknown".
4. The `<span>`: a rounded pill with the chosen colours and the label.
