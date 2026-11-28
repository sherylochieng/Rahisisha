# CategorySelect.js

**FILE:** `apps/web/src/components/CategorySelect.js` (Week 30 Day 3, Batch 4a-2 DRY pass)

## WHY THIS FILE EXISTS
The "Category (optional)" dropdown as its own piece. It fetches the aisle list itself (`useCategories`) and shows "No category" plus the aisles. Real life: the aisle-number box on the product slip.

## WHY IMPORTANT
ProductForm only says "put the category box here". Any future screen that needs an aisle picker reuses this instead of copying markup.

## DANGER
The dropdown markup, loading state and error line pasted into every form.

## WHAT IT SOLVES
`<CategorySelect value={categoryId} onChange={setCategoryId} disabled={loading} error={fieldErrors.categoryId} />`. `value` is the aisle id, or `''` for none.

## SYSTEM DESIGN PRINCIPLE
A controlled component: the parent owns the value; this file only draws and reports. Fetching (hook) and look (formParts) live in their own files.

## RULES
The parent keeps the value in state so the right option is selected when the list arrives late. If the list cannot load, still show "No category".

## WHERE USED
`components/ProductForm.js`.

## TRADEOFFS
+ Small and reusable. - Fixed wording for now.

## HOW TO USE
`import CategorySelect from './CategorySelect';`
