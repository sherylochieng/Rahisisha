<!-- FILE: docs/polish-checklist.md -->
<!-- WHY: Week 29 Day 4 Task 5. Eight polish items, ticked only for what was actually checked, with the evidence next to each. -->

# Polish Checklist (Week 29 Day 4)

**Date:** 17 November 2026
**How to read this:** `[x]` means it was checked and the evidence is written beside it. `[ ]` means it is NOT done or NOT true yet, with the reason. Nothing is ticked on hope.

**Who checked what:** the pages were opened in a real browser (Chromium) at desktop width (1280px) and phone width (390px), with an empty shop and a shop with data. That check was run by the AI in a throw-away test setup, not on Sheryl's machine. **Sheryl should look at the pages herself before submitting and un-tick anything she disagrees with.** So far Sheryl has confirmed on her own machine: login works, the phone menu is in the layout, and the Inbox page shows the empty state text for the "Brio Hardware" shop. She has not yet reported on the Payments page or on the phone width.

---

- [x] **1. Consistent typography and spacing.**
  The new Inbox and Payments pages use the same building blocks as the Dashboard: `font-display text-2xl font-bold text-brand-navy` for the page title, white `rounded-2xl border border-gray-100` cards, `space-y-6` between blocks, the shared `EmptyState` box, and money/time formatting from one file (`lib/format.js`). Checked by eye in screenshots.
  *Limit:* the Dashboard still has its own private `formatKes` (same output for positive amounts). Not unified yet.

- [x] **2. All buttons have loading states.**
  The buttons that exist in the web app are the login and signup submit buttons (`SubmitButton`, shows "...ing" and locks while waiting) and the error page's "Try again" (`PageError`, shows "Trying again..." and locks). The new pages contain **no buttons**, only links ("Older messages", "Back to newest"), and each page has a `loading.js` placeholder for the wait.
  *Limit:* when more forms and buttons are built (products, orders), this must be checked again.

- [ ] **3. All destructive actions confirm.**
  **Not ticked, because there is nothing to check yet.** The API can soft-delete a product, but the web app has no delete or cancel button anywhere. When the first one is built it needs a confirm step; tick this then.

- [x] **4. 404 for cross-tenant access.**
  Asking for another shop's order or product by id answers **404** (tests `orders.isolation.test.js` and `products.cross-tenant.test.js`, part of the isolation suite). The two new endpoints (`/v1/inbox`, `/v1/wallet/entries`) are lists with no id in the address, so they have nothing to 404; they return only the caller's own rows, proven by `inbox.test.js` and `wallet.entries.test.js` (shop B never sees shop A's rows, even with shop A's cursor).
  *Limit:* the web app has no detail pages yet (`/orders/123`), so there is no web page to test for a 404.

- [x] **5. Inbox paginates.**
  20 per page, "Older messages" link, "Back to newest" link. Keyset cursor on (created_at, id). In the browser a 25-message inbox showed 20 on page one and 5 on page two. `inbox.test.js` walks the whole list by 1, 2 and 3 and proves nothing is skipped or repeated.
  *Limit:* only "older" direction, no jump to a page number.

- [x] **6. Payments grouped by day.**
  One card per **Nairobi** day, a day total in each header, a balance after every entry. `wallet.entries.test.js` proves the grouping (including an entry at 21:30 UTC counting as the next Nairobi day) and that the running total is right on every page.

- [x] **7. Mobile layout works.**
  Checked at 390px wide: Inbox, Payments, Dashboard, Login and Signup have **no sideways scrolling**. The Sidebar is hidden on small screens, so a new `MobileNav` bar was added; Inbox and Payments are reachable by phone. Page padding is smaller on phones.
  *Limits:* checked only in Chromium at 390px, not on a real phone or in Safari. The phone menu is a scrolling row, not a drawer. The signup page (long form) was checked for overflow only, not for every field.

- [x] **8. Empty states on every list.**
  Inbox: "No messages yet. Share your USSD code or WhatsApp number." Payments: "No payments yet." with a hint. Dashboard latest products: "No products yet" (Week 28). Each was seen in the browser with an empty shop. The Inbox empty state was also seen on Sheryl's own machine (shop "Brio Hardware", 17 November 2026).
  *Limit:* no Products or Orders list page exists in the web app yet, so there is nothing to check there.

---

## Score

7 of 8 ticked. Item 3 is left open on purpose and says why.

## Known gaps (not hidden)

1. A hand-typed bad `?cursor=` shows the general error page ("We're having trouble right now"), not a friendlier message.
2. A production build (`next build`) could not be run in the test setup because it cannot reach Google Fonts. The pages were checked in the dev server. CI or Sheryl's machine will show the build result.
3. Stretch goals (inbox channel filter, CSV export of payments, keyboard shortcuts) were **not** built.
4. A USSD request is logged as one inbox row per tap, so one call can create several rows.