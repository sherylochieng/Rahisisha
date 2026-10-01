# Capstone Vertical: Rahisisha

**Chosen vertical:** A Saas Product for Small product-based businesses in Kenya for example boutiques, dress shops, photographers, beauty sellers  who sell through WhatsApp and Instagram but have no affordable way to run their marketing, handle customer chats, and take payments all in one place.

Small business owners in Kenya do the work of three people they cannot afford to hire: a marketer to make content look good, a social media manager to post consistently across every channel, and a sales or customer-service person to answer every "how much?" and "do you have size 12?" message at all hours. The result is inconsistent posts, slow replies, double-selling the last item to two buyers at once, and no clear view of what is actually selling.

Rahisisha ("make it easy" in Swahili) is a multi-tenant SaaS where a business owner signs up once and gets:

- **A branded storefront** — their own online shop, instantly live, no web developer needed

- **AI-generated product visuals** — the owner uploads a photo; Rahisisha enhances it in the business's own brand colours and style, adds real text layers (price, name, logo), and the owner approves before anything goes public

- **Automatic social posting** — approved products are announced on WhatsApp, Instagram, Telegram and other connected channels automatically, maintaining a consistent brand voice the owner never has to think about

-**An AI chat assistant** — a chatbot that answers customer questions on WhatsApp and the storefront using only the business's real catalog data (prices, sizes, stock, policies), so answers are always accurate and on-brand; the bot handles the full conversation in the business's own tone

- **In-chat checkout** — the chatbot can share a secure M-Pesa payment link directly in the conversation, completing the entire sale from question to paid order without the customer leaving WhatsApp

- **Stock that never oversells** — inventory is tracked per variant across every channel; stock only drops after payment is confirmed, so the same last dress can never be sold to two people at once

- **One owner dashboard** — orders, revenue, low-stock alerts, customer messages, and an AI-written plain-language summary of how the business is doing, all in one place; with a USSD channel for owners who want to check their business from a basic phone without data

- **Social replies handled automatically** — comments and DMs on connected social platforms are answered by the AI assistant in the business's voice, so the owner stays low-profile while customers always get a fast, accurate response

## Why this vertical is defensible

**1. The founder has lived the problem personally.**
The founder,Sheryl, runs a dress shop and a design and branding business and has experienced every pain Rahisisha targets ... sizing questions coming in at midnight, slow replies losing sales to faster sellers, accidentally double-selling the last item, spending hours making posts look consistent while trying to stay behind the scenes. The first test tenant is the founder's own shop from day one, which means the product is validated against a real business before any other customer signs up. You cannot fake founder-market fit.

**2. The market is large, underserved, and already using the tools Rahisisha connects.**
Millions of small businesses in Kenya already sell through WhatsApp and pay through M-Pesa. They are not waiting to be convinced to adopt new behaviour ... they are already doing the behaviour, just across five disconnected tools with no automation, no stock control, and no dashboard. Rahisisha meets them where they already are and removes the friction they already feel. The addressable market is every small seller who uses WhatsApp to sell and M-Pesa to collect  which in Kenya is most of them.

**3. The technical scope fits the four-week capstone timeline and uses every major concept from the course.**
The stack is exactly what Weeks 1–26 covered: Postgres with row-level security for multi-tenancy, Next.js for the dashboard and storefront, Express for the API, BullMQ for async jobs, M-Pesa Daraja for payments, WhatsApp Cloud API for messaging, and the Anthropic SDK for the AI assistant. Nothing here requires learning new technology. The capstone is an integration project, not a research project ... and Rahisisha is the most natural integration of everything already built because it is a real product idea, not a demo for its own sake.