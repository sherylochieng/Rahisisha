# Web Basket (cart) and Checkout Screens

**FILE:** `docs/guides/web-cart-and-basket.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Explains how the customer's basket works in the browser (where it is stored, which files show it, how it reaches checkout) and how the checkout screens decide what to show.

## WHY IMPORTANT

The basket is the first thing a customer touches. If it is hard to find, loses items, or empties at the wrong moment, sales are lost. After a first design review, the checkout button was made much more visible (a bar at the bottom of the screen plus a chip in the header).

## DANGER (what breaks without it)

1. The basket is emptied **only** when the server says PAID. Emptying it earlier would lose a customer's items after a failed payment.
2. Basket data lives in the customer's own browser. It is **not trusted**: the server re-reads names and prices from its database and ignores anything else.
3. `localStorage` can be blocked or full (private browsing). All reads and writes are wrapped in try/catch so the shop never crashes.
4. A saved basket for one shop must never appear in another shop. The keys include the shop's address word (slug).

## WHAT IT SOLVES

A basket that survives page refreshes, works for each shop separately, is easy to see on a phone, and flows into checkout in one tap.

## SYSTEM DESIGN PRINCIPLE

Server components for the page shell (fast, good for search engines), small client components ("islands") only where interaction is needed. One provider (`CartProvider`) is the single owner of basket state; everything else reads from it.

## RULES

1. At most 50 of one product and 30 different lines (`MAX_QUANTITY`, `MAX_LINES`).
2. Keys in the browser: `rahisisha-cart:<slug>` (basket), `rahisisha-customer` (name and phone remembered on this device), and in session memory `rahisisha-order:<slug>` (the order being paid: `{orderId, phoneDisplay, done, basketKey}`).
3. The basket bar is hidden until the page is ready and the basket has items, so there is no flash of "0 items".
4. Colours: white page, navy text, orange actions, solid colours only (no gradients), gentle hover effects.

## PRACTICAL EXAMPLE

Wanjiru taps **Add** on a dress card. The button becomes a navy `- 1 +` stepper. A solid navy bar appears at the bottom: item count in a white badge, the total, and a big orange **Checkout** button. The header also shows a **Basket (1)** chip. She taps Checkout and lands on `/shop/aminas-boutique/checkout`.

## DECISIONS

- Bottom bar plus header chip, because a small chip alone was too easy to miss.
- Basket in `localStorage` (survives closing the tab), but the order being paid in `sessionStorage` (belongs to this visit).
- If the basket changes after an order was started, `basketKey` notices and starts a fresh order, so a customer never pays for yesterday's basket by accident.

## WHERE USED

`apps/web/src/lib/cart.js`, `components/CartProvider.js`, `AddToBasket.js`, `BasketBar.js`, `BasketLink.js`, `CheckoutForm.js`, `PaymentStatus.js`, `CheckoutFlow.js`, `app/shop/[slug]/page.js` and `app/shop/[slug]/checkout/page.js`.

## TRADEOFFS

+ No account needed, quick, works on slow networks.
- The basket does not follow the customer to another phone or browser.
- Prices shown in the basket are from when the item was added. The server's total at checkout is the one that counts, and could differ if the shop changed a price in between.

## HOW TO USE

Wrap any page that needs the basket in `<CartProvider slug="...">` and call `useCart()` inside it. Do not read `localStorage` directly from components; go through `lib/cart.js`.

---

## PIECE BY PIECE (real life, in simple terms)

**cart.js**  
The shopkeeper's notebook rules: how to add an item, change a quantity, remove one, and total it. It knows nothing about screens.

**CartProvider**  
The notebook on the counter that everyone in the shop can read. If it changes, every screen that shows it updates.

**AddToBasket**  
The Add button on a product card that turns into - 1 + once the item is in.

**BasketBar**  
A bright sign at the bottom saying 'You have 2 items. Checkout here.' You cannot miss it.

**BasketLink**  
A small basket tag in the header, as a second way to find checkout.

**CheckoutForm**  
The slip where you write only your name and M-Pesa number.

**PaymentStatus**  
The waiting counter: 'check your phone', then the receipt or a kind explanation if it failed.

**CheckoutFlow**  
The manager who decides which of those screens you should see, including after a refresh.

---

## Screens the customer can see after tapping Pay

| Screen | When | Main action |
|---|---|---|
| Form | No order started yet, or the basket changed | Pay with M-Pesa |
| Waiting ("Check your phone") | Prompt sent, no answer yet | After 15 s: I've paid, check my payment |
| Failed (kind reason) | Safaricom said no, or a check found nothing paid | Try again, or Use a different number |
| Paid (green tick) | The server says paid | Optional delivery note, Back to the shop |
