# Rahisisha — 3-Minute Pitch Script

> Capstone Week 27 · Mctaba Labs · Sheryl Ochieng

---

## [0:00 — The problem] *(30 seconds)*

"I run a dress shop. And for a long time, every sale looked like this: a customer messages me on WhatsApp — 'iko stock?' — I reply by hand, send my M-Pesa number, wait for the screenshot, check my notebook, update the stock. For every. single. order.

I'm the marketer, the customer service rep, the accountant, and the shop owner. All at once. And I know I'm not the only one."

---

## [0:30 — The product] *(45 seconds)*

"Rahisisha replaces that entire loop with one signup.

The owner uploads a product photo. The AI enhances it in the business's own brand colours, adds the price and product name as real text layers, and automatically announces it on WhatsApp.

When a customer messages asking about size or price, the AI answers  from the real catalog, not generic responses. When the customer is ready to buy, an M-Pesa STK push goes to their phone. They enter their PIN. Stock updates. Order created. WhatsApp confirmation sent.

The owner opens the dashboard and sees the sale. They never touched the chat."

---

## [1:15 — The architecture] *(45 seconds)*

"This is a multi-tenant platform  meaning many businesses run on one system, completely isolated from each other. I enforce that isolation at two independent layers: application code and PostgreSQL Row-Level Security. A bug in one layer cannot leak Business A's data to Business B, because the database itself refuses to return the wrong rows.

Three tests must pass on every single push to the repo: tenant isolation, last-item concurrency  so two buyers can't claim the same last dress  and payment idempotency, so a duplicate M-Pesa callback can't create a duplicate order. If any of those fail, the deploy is blocked."

---

## [2:00 — What's built] *(30 seconds)*

"Week 27 is complete. I have a full 20-table schema with RLS live on PostgreSQL, 35 API endpoints fully designed and documented, a scaffolded monorepo, demo data seeded for Amina's Boutique, GitHub milestones set up for Weeks 28 through 30, and everything tagged at v0.27.0.

No production code yet  that was intentional. Week 27 was architecture week. I reach Monday of Week 28 knowing exactly what I'm building and why."

---

## [2:30 — The close] *(30 seconds)*

"The first test business is my own dress shop. I've lived every one of these problems directly. That's the founder-market fit.

By Week 30 demo day, Rahisisha will have two live tenants, isolated, tested, and deployed  with WhatsApp, M-Pesa, and an AI assistant that knows what's actually in stock.

Make business easy."

---

## Delivery notes

- Speak slowly at the architecture section - that's the technical proof, don't rush it
- "Make business easy" at the end: say it, pause, done - no filler after
- If cut off at 3 minutes, drop the **What's built** section - the close matters more