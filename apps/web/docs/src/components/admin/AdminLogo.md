# apps/web/src/components/admin/AdminLogo.js

**Week 30 Day 3, Batch 2.** The small orange "R" square, drawn in one place.

## WHY THIS FILE EXISTS / WHY IMPORTANT
The sign-in card and the side menu both show it. Change the colour, the shape, or swap in a real logo image here, and both places follow.

## DANGER
None. It is only a picture.

## WHAT IT SOLVES / SYSTEM DESIGN PRINCIPLE
Repeated markup (DRY): one logo, used everywhere.

## RULES
1. Colours come from the brand tokens (`brand-orange`, `brand-navy`), never hex codes.
2. `size` is `md` (default, side menu) or `lg` (sign-in card).

## PRACTICAL EXAMPLE (Kenya)
Like the same stamp on every receipt of your shop: change the stamp once.

## DECISIONS / WHERE USED / TRADEOFFS
A plain "R" for now. Used in `AdminLoginForm.js` and `AdminShell.js`.

## HOW TO USE
`<AdminLogo />` or `<AdminLogo size="lg" />`

## LINE BY LINE
- `size === 'lg' ? ... : ...`: picks the box size.
- `aria-hidden="true"`: it is decoration, screen readers skip it.
- The classes: centred orange square with a bold navy letter.
