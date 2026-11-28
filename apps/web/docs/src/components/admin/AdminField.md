# apps/web/src/components/admin/AdminField.js

**Week 30 Day 3, Batch 2.** One labelled input box for the admin panel.

## WHY THIS FILE EXISTS
The label above, the box below, the orange focus ring: written once.

## WHY IMPORTANT
Every admin form (sign in now, shop search and reason boxes later) looks and behaves the same.

## DANGER
Always give an `id`. The label points at it, so screen readers work and a tap on the label focuses the box.

## WHAT IT SOLVES / SYSTEM DESIGN PRINCIPLE
Repeated input markup and forgotten labels. DRY and accessibility by default: you cannot make an unlabelled field with this.

## RULES
1. `id`, `name` and `label` are required.
2. Other input settings (`type`, `autoComplete`, `required`) pass straight through.

## PRACTICAL EXAMPLE (Kenya)
Like every field on a KRA form having a printed label above its box.

## DECISIONS / WHERE USED / TRADEOFFS
Uses `...inputProps` so we do not list every input setting. Used in `AdminLoginForm.js`, and the shop pages next.

## HOW TO USE
```jsx
<AdminField id="phone" name="phone" label="Phone" type="tel" autoComplete="username" required />
```

## LINE BY LINE
- `label htmlFor={id}`: ties the label to the box.
- `input id name className {...inputProps}`: the box, with the shared look and any extra settings.
