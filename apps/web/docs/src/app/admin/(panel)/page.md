# apps/web/src/app/admin/(panel)/page.js

**Week 30 Day 3, Batch 2, part 1.** The first admin page, `/admin`.

## WHY THIS FILE EXISTS
A first landing spot to prove the sign-in and guard work before we build the bigger pages.

## WHY IMPORTANT
We test the door end to end before building rooms on top.

## DANGER
None. It shows no data.

## WHAT IT SOLVES
A place to land after sign-in.

## SYSTEM DESIGN PRINCIPLE
Build in small testable steps: door first, rooms after.

## RULES
Keep it data-free until the shop pages exist. No invented numbers.

## PRACTICAL EXAMPLE
After signing in you see "You are signed in", with the menu on the left.

## DECISIONS / WHERE USED / TRADEOFFS / HOW TO USE
A plain placeholder. Served at `/admin`. The shops list replaces it next.

## LINE BY LINE
- `AdminOverviewPage`: a heading and one sentence. Nothing else.

---

## Addition (Week 30 Day 3, Batch 2, part 2)

The Overview text now points to the shops list and adds a "Go to shops" link (`next/link`). Nothing was removed except the old "arrives in the next step" sentence for the list.

---

## Addition (Week 30 Day 3, Batch 3a)

The Overview page now shows real numbers.

- It renders `OverviewStats` (five number cards) between the intro sentence and the "Go to shops" link.
- The page stays a thin server page. The browser component does the fetching, because the admin cookie cannot be read on the server.
- The header comment was updated: it no longer calls the page a placeholder and now says the page shows counts only.
- The link and the heading are unchanged.
