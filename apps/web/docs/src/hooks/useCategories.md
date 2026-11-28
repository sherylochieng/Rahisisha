# useCategories.js

**FILE:** `apps/web/src/hooks/useCategories.js` (Week 30 Day 3, Batch 4a-2)

## WHY THIS FILE EXISTS
A hook that fetches the head-office aisle list once and remembers it for the browser tab. Real life: copying the aisle map onto the noticeboard so nobody has to ask the desk again.

## WHY IMPORTANT
Add product and Edit product are different pages. Without a memory each visit would ask the API again.

## DANGER
Each screen fetching on its own means repeated code and different failure handling.

## WHAT IT SOLVES
`const { categories, loading } = useCategories();` Gives `[{id, slug, name}]`. If the API cannot be reached the list stays empty and the form still works, because the category is optional.

## SYSTEM DESIGN PRINCIPLE
One hook per shared piece of data, like useFormState for forms. A module-level `cached` variable lives as long as the tab.

## RULES
Never cache a failure (only a real answer is remembered). Never set state after the screen is gone (the `alive` flag).

## WHERE USED
`components/owner/ProductForm.js`.

## TRADEOFFS
+ No extra library. - A head-office change shows after a page refresh (the API also caches for 5 minutes).

## HOW TO USE
Call it at the top of a client component and map `categories` into `<option>`s.
