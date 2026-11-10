# Pending tasks: Rahisisha Biashara

> **Written:** 10 November 2026 (after Week 28 Weekend, Task 8)
> **Where the live site is:** see `capstone/STAGING.md`

---

## WHY THIS FILE EXISTS

The weekend work is done and the site is live, but a few things are still loose.
This file keeps them in one place so nothing is forgotten and nothing is
fixed in a rush.

## HOW TO USE

1. Pick one item. Start with the top of the list.
2. Tell Claude: **"Let's do P2"** (the code in the first column).
3. Tick the box (`[x]`) here when it is done and pushed, and write the date.

Order matters: **P1 to P3 first**, because they make the live site safe to show.

---

## A. Make the live site safe to show (do first)

- [ ] **P1. Delete the public demo accounts** (password `Demo1234!`)
  Why: the password is written in `STAGING.md`, so anyone can log in.
  Done when: those accounts no longer exist on staging and `STAGING.md` no longer lists the password.

- [ ] **P2. Delete the leftover test shops** (like `jojo-shop`)
  Why: clutter, and confusing in a demo.
  Done when: only shops you want to show remain.

- [ ] **P3. Refuse reserved shop names (`api`, `www`) at signup**
  Why: login already ignores them as shops, but signup still lets someone register them. That shop would never work.
  Done when: signup returns a clear error for those names, and a test proves it.
  Note: write this one yourself. It counts toward your manual share.

---

## B. Security tightening (before real customers)

- [ ] **P4. Match the shop in the address against the login token on every request**
  Why: today only login checks the address. Later requests trust the token alone. The database locks still protect data, so the risk is low.

- [ ] **P5. Add a lock (RLS) to `audit_logs`, and stop the app user owning the tables**
  Why: it is the only tenant table without a lock, and an owner can switch locks off.

- [ ] **P6. Set the database SSL mode to `verify-full`**
  Why: the app does not check the database's identity yet. This also removes the `pg` warning in the logs.

- [ ] **P7. New passwords and a new `JWT_SECRET` for production**
  Why: staging values are not for real customers, and one password was seen in chat once.
  Never reuse staging values.

---

## C. Reliability

- [ ] **P8. Give `pool.js` a connection timeout**
  Why: a stuck database makes requests wait forever. With a timeout they fail fast and show the friendly 503.

- [ ] **P9. Move off Render's free plan when real users arrive**
  Why: the free API sleeps after 15 minutes and the first visit takes about a minute.
  Until then: open the site once before any demo.

---

## D. Tidiness

- [ ] **P10. Fix slugify:** cut the name first, then trim leading and trailing dashes.
- [ ] **P11. Make the dashboard answer match the others** (add `error: null`).
- [ ] **P12. Make login errors use the standard shape** (`{ error: { code, message, details } }`) instead of `{ error: "text" }`.
- [ ] **P13. Make `session.js` treat an API outage like `serverApi.js` does.**
- [ ] **P14. Add a customers page and endpoint** (none exist yet).
- [ ] **P15. Fix two stale comments in `orders.controller.js`** (a `FOR UPDATE` mention in `createOrder`, and `?status`/`?channel` filters on `listOrders` that do not exist).
- [ ] **P16. Check `updateOrderStatus` with an unknown status** (for example `"banana"`). The check may never fire and return 500 instead of 400. Test first, then fix.

---

## E. Proof and paperwork

- [ ] **P17. Add an end-to-end test for the real login endpoint.**
  Today the pieces are tested separately (the database rule and the shop lookup), but nothing runs login from start to finish.
- [ ] **P18. Add a test for `GET /v1/dashboard`.**
- [ ] **P19. Write the missing guides:** friendly 503 handler (`dbDown.js`), sample data on signup (`sampleData.service.js`), the happy-path tests, the database-down test, the signup sample-data test, and the web layout, sidebar and dashboard page.
- [ ] **P20. Fill in the "understood" rows in `AI_AUDIT_week_28_weekend.md`** in your own words. Fix the task numbers and the "Who" cells for Tasks 3 to 6.
- [ ] **P21. Closed-book rewrite** of the wallet functions and of `isAllowedOrigin`, to raise the manual share.

---

## F. Things outside the code

- [ ] **P22. Tell your instructor the staging address:** https://rahisishabiashara.com
- [ ] **P23. Set a reminder to renew the domain** (due 9 November 2027, about KES 2,030 a year).
- [ ] **P24. Check the sleeping API before any demo:** open the site, wait a minute, then show it.

---

## Done log

| Code | Date finished | Commit |
|------|---------------|--------|
|      |               |        |