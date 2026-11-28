# formParts.js

**FILE:** `apps/web/src/components/shared/formParts.js` (Week 30 Day 3, Batch 4a-2 DRY pass)

## WHY THIS FILE EXISTS
The two small pieces every form box shares: the look of a box (`inputClass`) and the red note under it (`FieldError`). They moved here from `ProductForm.js`, code unchanged.

## WHY IMPORTANT
Change the look of every form box, or the colour of every error, in one place.

## DANGER
Each form copying the class string: one gets the new look, the others stay old.

## WHAT IT SOLVES
`inputClass(hasError)` returns the Tailwind classes (red border when there is a problem). `<FieldError id message />` draws the red note, or nothing when empty.

## SYSTEM DESIGN PRINCIPLE
DRY and separation of concerns: look-and-feel lives apart from the forms that use it.

## RULES
Keep the red outline on a box with a problem. FieldError draws nothing when empty.

## WHERE USED
`ProductForm.js`, `CategorySelect.js`.

## TRADEOFFS
+ One place for form looks. - Login and signup forms still carry their own look (a later, separate tidy-up).

## HOW TO USE
`import { inputClass, FieldError } from './formParts';`
