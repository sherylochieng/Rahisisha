# VerifiedMark.js (guide)

**File:** `apps/web/src/components/admin/VerifiedMark.js`

## What it is
Shows **Verified** with an orange tick, or **Not verified** in plain grey.

## Why it exists
"Verified" means an admin checked the shop is real. It must look identical in the list and the detail page.

## Kenyan example
Like the blue tick on a business page: one design, shown everywhere.

## Danger
"Not verified" is deliberately calm grey. Most new shops start that way. It is not a warning.

## LINE BY LINE
1. `if (!verified)`: not verified, return the grey word only.
2. The `<svg aria-hidden="true">`: a drawn tick. `aria-hidden` hides it from screen readers because the word "Verified" already says it.
3. The `<path d="M4 10.5l4 4 8-9" />`: the tick shape.
4. Navy bold text beside it: the word itself.
