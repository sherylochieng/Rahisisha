# Rahisisha — One-Page Product Spec

## Who is a tenant?
A small business owner — a boutique, dress shop, photographer, beauty seller, or small
service provider — who signs up and gets their own branded online shop, AI team, and
WhatsApp channel. One account = one business. All their products, customers, orders,
conversations, and stock live under that account, completely isolated from every other
business on the platform.

## Who uses the app inside a tenant?

| User | Role |
| --- | --- |
| **Business owner** | Pays; manages products, brand settings, approvals, orders, dashboard and billing. The only user in the MVP. |
| **Customer** | Browses one business, chats with the AI, reserves a product, pays via M-Pesa, and rates a purchase after delivery. Never logs in; interacts only through the public storefront and WhatsApp. |
| **Platform admin** | The Rahisisha operator (founder at first). Manages tenants, usage caps, subscriptions, suspensions and platform health. |
| **Staff** | Out of scope for MVP. Schema is ready (memberships table) but no staff UI is built. |

## The three core actions

1. **Owner publishes a product** 
Uploads a real photo; Rahisisha enhances it in the
business's brand colours and style, adds price, name and logo as real text layers (never
AI-drawn text), and the owner reviews and approves before anything goes public. Once
approved, the storefront updates and a WhatsApp announcement goes out automatically.
Nothing AI-generated is ever published without explicit owner approval.

2. **Customer buys** 
Opens the storefront or messages the WhatsApp bot, asks about
size, price, stock or fit, gets an accurate answer grounded in the business's own catalog
data, selects a variant, taps Buy...inventory is reserved instantly to prevent double-selling
...receives an M-Pesa STK push, enters their PIN, and gets a WhatsApp confirmation.
Stock decrements only after Safaricom's server-side callback confirms payment. The owner
never needs to touch the conversation.

3. **Owner sees the business** 
Opens the dashboard and sees today's sales, revenue,
orders to pack, low-stock alerts, and an AI-written plain-language summary of how the
business is doing. Numbers are calculated in SQL; the AI only explains them in plain
language, never calculates them itself. Owner can also ask free-text questions like "how
many blue dresses are left?" and get an instant, accurate answer.

## Monetisation model

**Subscription** 
 monthly access to the storefront, AI chat, content tools and dashboard:

| Plan | AI messages/month | Price (KES/mo) |
| --- | --- | --- |
| Starter | 1,000 | 2,000 |
| Growth | 4,000 | 6,000 |
| Pro | 8,000 | 12,000 |

**Checkout commission** 
A small percentage per completed sale (proposed 2–3%,
to be validated with real pilot data).

**Payment model (open decision):** Plan A = business connects its own M-Pesa
Till/Paybill; Rahisisha bills commission separately (simpler; Rahisisha never holds
customer funds). Plan B = platform collects then pays out minus commission (automatic
but requires regulatory and accounting obligations). PRD direction: build for Plan A first;
get legal advice before handling real customer funds under either model.

*Final pricing and commission rate to be validated by interviewing at least 3 real business
owners before launch.*

## What is NOT in the MVP
See `WILL_NOT_BUILD.md` for the full list. The key exclusions: no cross-business
marketplace, no native mobile apps, no custom AI training, no live Instagram/Facebook/
TikTok auto-posting, no multi-language UI, no multi-currency, no custom tenant domains,
no ad management, no staff accounts UI, no automated refunds, no courier integrations.
USSD, Telegram and SMS are P2 stretch goals...only after the full P0 flow works
end-to-end.