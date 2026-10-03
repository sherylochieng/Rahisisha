# Rahisisha - Index Reference

Every index in the database, the query it supports, and why it exists.
The rule: every query that filters by tenant_id must hit an index.
A sequential scan on a large table is a performance bug.

---

## tenants

| Index | Columns | Query it supports |
| --- | --- | --- |
| `tenants_slug_unique` | `(slug)` UNIQUE | `SELECT * FROM tenants WHERE slug = $1` — runs on every request to identify the tenant from the subdomain |
| `tenants_slug_idx` | `(slug)` | Same as above — fast lookup by subdomain |

---

## users

| Index | Columns | Query it supports |
| --- | --- | --- |
| `users_phone_unique` | `(phone)` UNIQUE | `SELECT * FROM users WHERE phone = $1` — login lookup |

---

## memberships

| Index | Columns | Query it supports |
| --- | --- | --- |
| `memberships_tenant_user_unique` | `(tenant_id, user_id)` UNIQUE | Prevents duplicate memberships; also supports `WHERE tenant_id = $1 AND user_id = $2` |
| `memberships_user_idx` | `(user_id)` | `SELECT * FROM memberships WHERE user_id = $1` — which tenants does this user belong to? |
| `memberships_tenant_idx` | `(tenant_id)` | `SELECT * FROM memberships WHERE tenant_id = $1` — which users belong to this tenant? |

---

## brand_profiles

| Index | Columns | Query it supports |
| --- | --- | --- |
| `brand_profiles_tenant_idx` | `(tenant_id)` | `SELECT * FROM brand_profiles WHERE tenant_id = $1` — load brand settings for the AI assistant |

---

## products

| Index | Columns | Query it supports |
| --- | --- | --- |
| `products_tenant_sku_unique` | `(tenant_id, sku)` UNIQUE WHERE sku IS NOT NULL | Prevents duplicate SKUs per tenant |
| `products_tenant_status_idx` | `(tenant_id, status)` WHERE deleted_at IS NULL | `WHERE tenant_id = $1 AND status = 'active'` — storefront product listing |
| `products_tenant_created_idx` | `(tenant_id, created_at DESC)` | `WHERE tenant_id = $1 ORDER BY created_at DESC` — dashboard recent products |

---

## product_variants

| Index | Columns | Query it supports |
| --- | --- | --- |
| `variants_product_size_colour_unique` | `(product_id, size, colour)` UNIQUE WHERE deleted_at IS NULL | Prevents duplicate size/colour combos per product |
| `variants_product_idx` | `(product_id)` WHERE deleted_at IS NULL | `WHERE product_id = $1` — load all variants for a product page |
| `variants_tenant_idx` | `(tenant_id)` WHERE deleted_at IS NULL | `WHERE tenant_id = $1` — inventory dashboard, all variants for this tenant |
| `variants_tenant_stock_idx` | `(tenant_id, stock)` WHERE deleted_at IS NULL | `WHERE tenant_id = $1 AND stock < 3` — low stock alerts on dashboard |

---

## product_media

| Index | Columns | Query it supports |
| --- | --- | --- |
| `product_media_product_idx` | `(product_id, position)` | `WHERE product_id = $1 ORDER BY position` — load photos for a product in display order |
| `product_media_tenant_idx` | `(tenant_id)` | `WHERE tenant_id = $1 AND approved = FALSE` — approval queue for the owner dashboard |

---

## customers

| Index | Columns | Query it supports |
| --- | --- | --- |
| `customers_tenant_phone_unique` | `(tenant_id, phone)` UNIQUE | Find or create a customer by phone per tenant — runs on every inbound message |
| `customers_tenant_idx` | `(tenant_id)` | `WHERE tenant_id = $1` — customer list on dashboard |

---

## conversations

| Index | Columns | Query it supports |
| --- | --- | --- |
| `conversations_tenant_idx` | `(tenant_id, last_message_at DESC)` | `WHERE tenant_id = $1 ORDER BY last_message_at DESC` — unified inbox, most recent first |
| `conversations_customer_idx` | `(customer_id)` | `WHERE customer_id = $1` — load conversation history for a returning customer |

---

## messages

| Index | Columns | Query it supports |
| --- | --- | --- |
| `messages_conversation_idx` | `(conversation_id, created_at DESC)` | `WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 20` — load recent messages for AI context |
| `messages_tenant_idx` | `(tenant_id, created_at DESC)` | `WHERE tenant_id = $1 ORDER BY created_at DESC` — message volume dashboard |
| `messages_channel_dedup` | `(tenant_id, channel_message_id)` UNIQUE WHERE NOT NULL | Prevents the same WhatsApp message being inserted twice |

---

## stock_reservations

| Index | Columns | Query it supports |
| --- | --- | --- |
| `stock_reservations_variant_idx` | `(variant_id, status)` | `WHERE variant_id = $1 AND status = 'pending'` — calculate available stock before reserving |
| `stock_reservations_expires_idx` | `(expires_at)` WHERE status = 'pending' | BullMQ job: `WHERE expires_at < NOW() AND status = 'pending'` — find and release expired reservations |
| `stock_reservations_tenant_idx` | `(tenant_id)` | `WHERE tenant_id = $1` — reservation list for the tenant |

---

## inventory_movements

| Index | Columns | Query it supports |
| --- | --- | --- |
| `inventory_movements_variant_idx` | `(variant_id, created_at DESC)` | `WHERE variant_id = $1 ORDER BY created_at DESC` — stock history for one variant |
| `inventory_movements_tenant_idx` | `(tenant_id, created_at DESC)` | `WHERE tenant_id = $1 ORDER BY created_at DESC` — full inventory audit trail on dashboard |

---

## orders

| Index | Columns | Query it supports |
| --- | --- | --- |
| `orders_tenant_status_idx` | `(tenant_id, status, created_at DESC)` | `WHERE tenant_id = $1 AND status = 'paid'` — orders to pack; dashboard order counts by status |
| `orders_customer_idx` | `(customer_id)` | `WHERE customer_id = $1` — order history for a returning customer |
| `orders_tenant_created_idx` | `(tenant_id, created_at DESC)` | `WHERE tenant_id = $1 ORDER BY created_at DESC` — recent orders on dashboard |

---

## order_items

| Index | Columns | Query it supports |
| --- | --- | --- |
| `order_items_order_idx` | `(order_id)` | `WHERE order_id = $1` — load line items for an order |
| `order_items_tenant_idx` | `(tenant_id)` | `WHERE tenant_id = $1` — revenue calculation across all items |

---

## webhook_events

| Index | Columns | Query it supports |
| --- | --- | --- |
| `webhook_events_provider_event_unique` | `(provider, event_id)` UNIQUE | The idempotency key — INSERT fails silently on duplicate |
| `webhook_events_unprocessed_idx` | `(processed, created_at)` WHERE processed = FALSE | Background job: find unprocessed webhooks to retry |

---

## wallet_entries

| Index | Columns | Query it supports |
| --- | --- | --- |
| `wallet_entries_tenant_idx` | `(tenant_id, created_at DESC)` | `WHERE tenant_id = $1 ORDER BY created_at DESC` — wallet statement on dashboard; `SUM(amount_cents)` for balance |

---

## content_posts

| Index | Columns | Query it supports |
| --- | --- | --- |
| `content_posts_tenant_status_idx` | `(tenant_id, status, created_at DESC)` | `WHERE tenant_id = $1 AND status = 'draft'` — approval queue; `AND status = 'published'` — published posts list |

---

## subscriptions

| Index | Columns | Query it supports |
| --- | --- | --- |
| `subscriptions_tenant_idx` | `(tenant_id)` | `WHERE tenant_id = $1` — load current plan for usage cap checks |

---

## usage_counters

| Index | Columns | Query it supports |
| --- | --- | --- |
| `usage_counters_tenant_month_unique` | `(tenant_id, month)` UNIQUE | `WHERE tenant_id = $1 AND month = date_trunc('month', NOW())` — current month AI usage |

---

## audit_logs

| Index | Columns | Query it supports |
| --- | --- | --- |
| `audit_logs_tenant_idx` | `(tenant_id, created_at DESC)` | `WHERE tenant_id = $1 ORDER BY created_at DESC` — audit trail per tenant for platform admin |
| `audit_logs_resource_idx` | `(resource, resource_id)` | `WHERE resource = 'orders' AND resource_id = $1` — full history of changes to one record |