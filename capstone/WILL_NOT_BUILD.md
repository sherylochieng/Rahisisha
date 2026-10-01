# Rahisisha — What We Will NOT Build for the MVP

1. **Native mobile apps (iOS or Android)**
   The storefront and dashboard are mobile-responsive web pages. No App Store submission, no React Native, no Expo. A browser is enough.

2. **Cross-business marketplace**
   Rahisisha is not Jumia or Jiji. Customers shop one business at a time. There is no shared product catalogue, no cross-tenant search, no aggregated discovery feed.

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

12. **A/B testing, advanced analytics, or a business intelligence dashboard**
    The owner dashboard shows the numbers that matter for daily operations (orders, revenue, stock, wallet). No cohort analysis, no funnel charts, no export to a BI tool.