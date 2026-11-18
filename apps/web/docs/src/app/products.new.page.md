# products/new/page.js: The Add Product Page

**File:** `apps/web/src/app/(authed)/products/new/page.js`
**Doc:** `apps/web/docs/src/app/products.new.page.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

Puts a back link, a title, a hint and `ProductForm` on the address `/products/new`.

## WHY IMPORTANT

It is the front door for adding a product. The form does the work; this file only arranges the page.

## DANGER

- Sits inside `(authed)`, so a logged-out visitor is sent to `/login` first.
- Holds no logic: all checking and sending is in `ProductForm`.
- Never tells the API which shop the product belongs to.
- Lesson from building it: this file once held a copy of the form's 305 lines by mistake and the page failed to build. The correct file is 86 lines.

## WHAT IT SOLVES

A tidy page around the form.

## SYSTEM DESIGN PRINCIPLE

Pages arrange, components work.

## RULES

- Server Component with `metadata.title`.

## PRACTICAL EXAMPLE

Amina clicks Add product, lands here, fills the form and returns to her list.

## TRADEOFFS

+ Tiny. - Nothing to show if the form changes shape; both files must be kept in step.

## PIECE BY PIECE (simple words, real-life examples)

### The imports

Four `../` climb from `app/(authed)/products/new` up to `src/`, then into `components`.

### The back link

A door marked Exit on a form counter.

### The form

`<ProductForm />` handles typing, checking and sending.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`, follow-up section). Last updated 18 November 2026.*
