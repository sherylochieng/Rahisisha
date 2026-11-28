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
