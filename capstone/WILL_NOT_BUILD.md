# Rahisisha — What We Will NOT Build for the MVP

1. **Native mobile apps (iOS or Android)**
   The storefront and dashboard are mobile-responsive web pages. No App Store submission, no React Native, no Expo. A browser is enough.

2. **Cross-business marketplace**
   Rahisisha is not Jumia or Jiji. Customers shop one business at a time. There is no shared product catalogue, no cross-tenant search, no aggregated discovery feed.

   **UPDATE 27 Nov 2026 (this decision changed):** a read-only marketplace window is now planned, so shoppers can browse products from many shops in one place. It only shows things. Buying, payment and orders stay inside each shop: one shop is one order and one payment. There is still no shared cart, no one payment across many shops and no shared checkout (see items 13 and 14 below). The plan is in `docs/PENDING_TASKS.md` (Batches 5 and 6).

3. **Custom AI training or fine-tuning**
   The AI assistant uses a foundation model (Claude) grounded on each tenant's own catalog data via tool functions. There is no custom model training, no fine-tuning pipeline, no embedding store per tenant.

4. **Multi-language UI**
   The interface is in English for the MVP. Swahili support is a future iteration, not a Week 27–30 deliverable.

5. **Multi-currency**
   All prices and wallets are in Kenyan Shillings (KES). No currency conversion, no USD pricing, no Stripe international.

6. **Ad management or sponsored listings**
   No paid promotion, no boosted products, no ad analytics dashboard. Anthropic products are ad-free; so is Rahisisha for the MVP.

7. **Custom tenant websites or custom domains**
   Every tenant gets a subdomain under the Rahisisha domain (e.g. `aminas-boutique.rahisisha.co.ke`). No custom domain mapping, no white-label deployment, no tenant-controlled DNS.

8. **Staff accounts and role management UI**
   The database schema uses a `memberships` table ready for staff users, but the MVP UI only supports the owner role. No invite flow, no staff dashboard, no permission matrices for the capstone demo.

9. **USSD channel** *(except as a stretch goal — only after all P0 features work end-to-end)*
   WhatsApp and the web storefront are the two customer-facing channels. USSD is a P2 stretch that may be added if time permits after the demo is stable.

10. **Telegram, Instagram, Facebook, TikTok auto-posting**
    WhatsApp is the only social/messaging channel in the MVP. Auto-posting to other platforms is a future channel that can be added using the same channel-adapter pattern.

11. **Subscription billing infrastructure (Stripe, card payments)**
    Platform billing (charging tenants for their subscription) is tracked in the schema but not wired up for the capstone demo. The demo runs on the Starter plan for all tenants, no payment collected from tenants during the build.

    **UPDATE 27 Nov 2026:** the money model is commission only for now, so subscription billing is postponed even further. See items 14 and 16 below.

12. **A/B testing, advanced analytics, or a business intelligence dashboard**
    The owner dashboard shows the numbers that matter for daily operations (orders, revenue, stock, wallet). No cohort analysis, no funnel charts, no export to a BI tool.


---

**Added 27 Nov 2026 (hybrid marketplace and money decisions)**

13. **One basket paid once across many shops**
    A shopper who wants things from two shops pays each shop separately. One shop is one order and one payment. A shared cart and a single payment split across shops are left until real sellers show they matter.

14. **Collecting Rahisisha's commission automatically (for now)**
    The commission is only calculated and recorded per order. It is not collected yet. Automatic collection needs a licensed payment provider that splits each payment, and its fees and licence must be confirmed first. Until then no real money is split by Rahisisha, and Rahisisha does not hold customers' money.

15. **Paid boosts, reviews and ratings on the marketplace**
    Featured placement, shopper reviews and ratings are ideas for after the pilot with real sellers.

16. **Automatic plan billing and a registration fee**
    A one-time registration fee (about KES 300, when a shop goes live on the marketplace) and monthly plan billing are Phase 2 ideas. They are not built and not part of the first version.