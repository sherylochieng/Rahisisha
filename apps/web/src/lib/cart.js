// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/lib/cart.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Holds ALL the rules of the customer's basket in one place: add a product,
//   change a quantity, remove a line, count items, add up the total, and
//   remember the basket (and the customer's name and phone) on their phone.
//   The screens (shop page, basket bar, checkout page) only call these small
//   functions. They never touch the browser's storage themselves.
//
// WHY IMPORTANT
//   The basket is what the customer is about to PAY for. If its rules are
//   scattered over five screens, one screen will add wrongly and the customer
//   will see a total that differs from the real one. One file, one truth.
//
// DANGER
//   1. The prices stored here are only for SHOWING the customer. The server
//      NEVER trusts them: checkout reads the real price from the database
//      (checkout.controller.js, test 1). Do not "improve" this by sending
//      these prices as the truth.
//   2. Browser storage can be full, blocked (private mode) or empty. Every
//      read and write is wrapped in try/catch so the shop never crashes.
//   3. Never store anything secret here. A name and a phone number only.
//
// WHAT IT SOLVES
//   - The basket survives a page refresh and a closed tab (the customer's
//     data bundle ran out and they come back later).
//   - Each shop has its OWN basket (a customer shopping at two shops does not
//     mix them).
//   - Next time, the name and phone are already filled in (impatient customer).
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns + pure functions. The basket functions take a list
//   and return a NEW list (they never change the old one). That makes them
//   easy to test and impossible to corrupt by accident. Only loadCart/saveCart
//   touch the browser's storage.
//
// RULES
//   1. Quantity per line is 1..MAX_QUANTITY (50), lines are at most MAX_LINES
//      (30). These are the SAME limits the server enforces on checkout.
//   2. A product appears once in the basket. Adding it again raises the
//      quantity.
//   3. Storage keys carry the shop's address word, so shops never mix.
//   4. Only call loadCart/saveCart/loadCustomer/saveCustomer from the browser
//      (inside useEffect or an event). They are safe on the server too: they
//      just return empty.
//
// PRACTICAL EXAMPLE
//   let basket = [];
//   basket = addItem(basket, { id: 'p1', name: 'Soda', price_cents: 8000, image_url: null });
//   basket = addItem(basket, { id: 'p1', name: 'Soda', price_cents: 8000, image_url: null });
//   cartCount(basket)       -> 2
//   cartTotalCents(basket)  -> 16000   (KES 160)
//
// DECISIONS
//   - localStorage (not cookies): the basket never needs to travel to the
//     server until checkout, and cookies would be sent with every request.
//   - We store only what is needed to SHOW the basket (name, price, photo
//     link, quantity), so the basket works even before the next page loads.
//   - The customer's phone is stored as typed. It is checked again by the
//     server at checkout.
//
// WHERE USED
//   Shop page "Add" buttons, the basket bar, the checkout page, the success
//   page (which clears the basket after payment).
//
// TRADEOFFS
//   + Works offline-ish, no account, no server cost.
//   - The basket lives on ONE phone only. A customer who starts on a phone and
//     continues on a laptop starts again. Acceptable for a Kenyan shop link
//     opened from WhatsApp.
//   - A price changed by the owner after the customer added the product is
//     fixed at checkout (the server's price wins and the receipt shows it).
//
// HOW TO USE
//   import { loadCart, saveCart, addItem, cartCount } from '../lib/cart';
//
// ═══════════════════════════════════════════════════════════
// PIECE BY PIECE — real life: the customer's basket at the market
// ═══════════════════════════════════════════════════════════
//   MAX_QUANTITY / MAX_LINES = the basket can only hold so much. Real life:
//                              the vendor says "50 sodas is the most I'll
//                              pack in one go".
//   cartKey(slug)            = the label on the basket: "Mama Njeri's basket".
//                              Each kiosk has its own label.
//   loadCart / saveCart      = taking the basket out of your bag / putting it
//                              back in. Wrapped in try/catch: if the bag has a
//                              hole (storage blocked) you just start with an
//                              empty basket.
//   addItem                  = putting a product in. Already there? Add one
//                              more to it, like stacking another soda.
//   setQuantity              = "make that 3 sodas". 0 or less takes it out.
//   removeItem               = taking it out of the basket.
//   cartCount                = how many things in total (the little number on
//                              the basket bar).
//   cartTotalCents           = adding up the prices, like the vendor with her
//                              calculator. In CENTS: 8000 = KES 80.
//   clearCart                = emptying the basket after you have paid.
//   loadCustomer/saveCustomer= the vendor remembering "Amina, 07..." so you do
//                              not repeat yourself next time.

// The same limits the server enforces (checkout.controller.js: quantity 1..50, lines 1..30).
export const MAX_QUANTITY = 50;
export const MAX_LINES = 30;

// The label under which ONE shop's basket is kept on this phone.
// "rahisisha-cart:mama-mboga" and "rahisisha-cart:skirt-shirt" never mix.
const cartKey = (slug) => `rahisisha-cart:${slug}`;

// The label for the remembered name and phone (one for all shops: it is the same person).
const CUSTOMER_KEY = 'rahisisha-customer';

// Is browser storage available? On the server (while Next.js builds the page)
// there is no "window", so we say no and everything returns empty.
function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // Some browsers throw just for LOOKING at storage (blocked cookies).
    return null;
  }
}

// ── SAVING AND LOADING ───────────────────────────────────────────────────────

// Take this shop's basket out of the phone's memory. Always returns a list,
// even when nothing is saved or the saved text is damaged.
export function loadCart(slug) {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(cartKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Keep only well-formed lines; throw away anything odd (an old format,
    // or someone playing with the storage). Never trust what we read back.
    return Array.isArray(parsed)
      ? parsed
          .filter((l) => l && typeof l.productId === 'string' && Number.isInteger(l.quantity))
          .map((l) => ({
            productId: l.productId,
            name: String(l.name || ''),
            priceCents: Number.isInteger(l.priceCents) ? l.priceCents : 0,
            imageUrl: typeof l.imageUrl === 'string' ? l.imageUrl : null,
            quantity: Math.min(MAX_QUANTITY, Math.max(1, l.quantity)),
          }))
          .slice(0, MAX_LINES)
      : [];
  } catch {
    return [];
  }
}

// Put this shop's basket back into the phone's memory.
export function saveCart(slug, items) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(cartKey(slug), JSON.stringify(items));
  } catch {
    // Storage full or blocked: the basket still works on this screen, it just
    // will not survive a refresh. Not worth crashing the shop for.
  }
}

// Empty this shop's basket (after a successful payment).
export function clearCart(slug) {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(cartKey(slug));
  } catch {
    // Nothing to do: if we cannot clear it, the next load starts from what it was.
  }
}

// ── THE BASKET RULES (pure: they return a NEW list, never change the old) ────

// Put one product in. `product` is a product as the shop page has it
// ({ id, name, price_cents, image_url }).
export function addItem(items, product) {
  // Is it already in the basket?
  const existing = items.find((l) => l.productId === product.id);
  if (existing) {
    // Yes: one more (but never past the limit).
    return items.map((l) =>
      l.productId === product.id
        ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + 1) }
        : l,
    );
  }
  // The basket is full of different things: do not add a 31st line.
  if (items.length >= MAX_LINES) return items;
  // New product: a new line of 1.
  return [
    ...items,
    {
      productId: product.id,
      name: product.name,
      priceCents: product.price_cents,
      imageUrl: product.image_url || null,
      quantity: 1,
    },
  ];
}

// "Make that N". N of 0 or less takes the line out. N above the limit stops at the limit.
export function setQuantity(items, productId, quantity) {
  if (!Number.isFinite(quantity) || quantity <= 0) return removeItem(items, productId);
  const q = Math.min(MAX_QUANTITY, Math.floor(quantity));
  return items.map((l) => (l.productId === productId ? { ...l, quantity: q } : l));
}

// Take one product out of the basket completely.
export function removeItem(items, productId) {
  return items.filter((l) => l.productId !== productId);
}

// How many things in total (2 sodas + 1 dress = 3). The number on the basket bar.
export function cartCount(items) {
  return items.reduce((sum, l) => sum + l.quantity, 0);
}

// The total in cents (8000 = KES 80). For SHOWING only: the server recalculates.
export function cartTotalCents(items) {
  return items.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
}

// How many of this product are in the basket right now (0 if none).
// The shop page uses it to show "1 in basket" on the card.
export function quantityOf(items, productId) {
  const line = items.find((l) => l.productId === productId);
  return line ? line.quantity : 0;
}

// The shape the checkout API wants: only the product id and the quantity.
// Notice: NO price. The server reads prices from the database.
export function toCheckoutItems(items) {
  return items.map((l) => ({ productId: l.productId, quantity: l.quantity }));
}

// ── REMEMBERING THE CUSTOMER ─────────────────────────────────────────────────

// Take the remembered name and phone out of the phone's memory.
export function loadCustomer() {
  const s = storage();
  if (!s) return { name: '', phone: '' };
  try {
    const parsed = JSON.parse(s.getItem(CUSTOMER_KEY) || '{}');
    return {
      name: typeof parsed.name === 'string' ? parsed.name.slice(0, 80) : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone.slice(0, 20) : '',
    };
  } catch {
    return { name: '', phone: '' };
  }
}

// Remember the name and phone for next time.
export function saveCustomer(name, phone) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(CUSTOMER_KEY, JSON.stringify({ name, phone }));
  } catch {
    // Same as the basket: not worth crashing the shop for.
  }
}