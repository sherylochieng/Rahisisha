# shop/[slug]/page.js: The Public Shop Window

**File:** `apps/web/src/app/shop/[slug]/page.js`
**Doc:** `apps/web/docs/src/app/shop.page.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

This is the shop window: the public page a customer sees when they open a shop's link (`brio-hardware.rahisishabiashara.com`). It shows the shop's name and the products it is selling, with prices.

## WHY IMPORTANT

This is the page the owner shares on WhatsApp. It is the first thing a customer sees, and the base the cart and checkout will grow from.

## DANGER

- Without it the shop link opens the main Rahisisha landing page.
- If this page ever called a private endpoint it would show private data to strangers. It only uses `publicApi.js`.

## WHAT IT SOLVES

Shows the shop name board, a product grid, "More products" paging, a friendly empty state, and a not-found screen for unknown shops.

## SYSTEM DESIGN PRINCIPLE

Server Component, public data only: the server asks the API and sends finished HTML, which is fast on a cheap phone and good for link previews. Paging works like the Orders page: the page reads `?cursor=` from the address and shows a link to the next page, so no client JavaScript is needed.

## RULES

1. Use `fetchStorefront` only (public, no cookie). Never `serverGet`.
2. Validate the cursor shape before sending it on.
3. Show only what the API sends: name, description, price.
4. Prices go through `formatKes`. No money maths in the page.
5. A missing shop is `notFound()`, never a blank page.

## THE CODE, PIECE BY PIECE

### CURSOR_PATTERN: is this bookmark shaped like ours?

Letters, numbers, `-` and `_` only, up to 300 characters. Anything else is ignored and the first page is shown.

### getPage(params, searchParams)

Next.js 16 gives `params` and `searchParams` as promises, so we `await` them. Both `generateMetadata` and the page need the same answer.

### generateMetadata: the sign over the door

Sets the browser tab and link-preview title to the shop's name. A WhatsApp preview then says "Brio Hardware".

### The header: the shop's name board

A navy band with the name in the display font and the line "Shop online. Pay with M-Pesa."

### The grid: the shelves

One card per product: a coloured tile with the product's first letter (there are no photos yet), the name, up to two lines of description, and the price in KES. Two columns on a phone, three and four on larger screens.

### The empty state: nothing in the window yet

"Nothing for sale yet" for a new shop, or "No more products" at the end of a long list.

### "More products" and "Back to the first products"

The first link only appears when the API gave a `nextCursor`; the second when you are on a later page.

## PRACTICAL EXAMPLES

| Address | What you see |
|---|---|
| `brio-hardware.localhost:3001` | `proxy.js` rewrites `/` to this page: the shop window |
| `localhost:3001/shop/brio-hardware` | The same page on the main address |
| `...?cursor=<bookmark>` | The next page of products |
| `localhost:3001/shop/nobody` | The not-found screen |

## DECISIONS (and WHY)

- No product photos yet (the database has none), so a letter tile stands in.
- No add-to-cart button yet. The cart is the next step.
- The title is the shop's name so link previews are useful.

## WHERE USED

Opened through `proxy.js` (a shop's own address) or directly at `/shop/<slug>`. Linked from the dashboard's shop link card.

## TRADEOFFS

+ Simple, fast, no client JavaScript. - No search, categories, photos or cart yet.

## HOW TO USE

Nothing to call. Open `/shop/<slug>` or a shop's own address. Only products with status "active" appear.

## COMMON MISTAKES

- Expecting drafts to show: they never do.
- Putting private data in this page "just for the owner": owners have the dashboard for that.

## AI AUDIT NOTE

Written by AI at Sheryl's request. Declared in `AI_AUDIT_week_29_day4.md` (follow-up section).

## TEST LOG

Checked on 18 November 2026: in the AI's sandbox (a shop with 30 products paged 24 + 6 with nothing skipped, the draft hidden, a garbage bookmark showing page one, unknown shop 404), and by Sheryl in the browser (`localhost:3001/shop/brio-hardware` and the shop's own address). No automated browser test yet.

## ADDED IN BATCH 4a-2 (Week 30 Day 3): AISLE BUTTONS

- Reads `?category=` from the address; the word is checked by `parseCategory` (`lib/shopParams.js`: lowercase words joined by dashes, up to 60 characters); anything else means All.
- Shows `<CategoryPills>` above the shelves (only aisles this shop uses).
- "More products" and "Back to the first products" use `shopHref`, so they keep the chosen aisle.
- An empty aisle shows "Nothing in this category" with a hint to try All (an old link never errors).
- Nothing removed.

## ADDED IN BATCH 4b (Week 30 Day 3): THE SHOP'S BUSINESS CARD

- The dark header now also shows the shop's **town** and its **one-line description**, but only when the owner has filled them in (`shop.town`, `shop.description` from the storefront API).
- The owner's WhatsApp number is never shown here. The public API does not send it.
- Nothing removed; an owner who has not filled in the card sees the page exactly as before.
