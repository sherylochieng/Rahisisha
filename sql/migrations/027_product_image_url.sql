-- =============================================================================
-- FILE: sql/migrations/027_product_image_url.sql   (Week 30, product photos)
-- =============================================================================
--
-- WHY THIS FILE EXISTS
--   A shop owner wants to show a PHOTO of each product (a dress, a bag of
--   maize flour). The photo itself is kept at Cloudinary (an online photo
--   store). Our database only needs to remember WHERE the photo lives: its
--   web address. This file adds one new column to `products` for that address.
--
-- WHY IMPORTANT
--   Without this column the API has nowhere to save the address, so a photo
--   uploaded today would be forgotten tomorrow.
--
-- DANGER
--   1. We store the ADDRESS (text), never the photo bytes. Photos inside the
--      database make backups huge and slow.
--   2. The column is optional (NULL allowed). Every product that exists today
--      has no photo, and must keep working.
--   3. Do NOT touch the RLS lines of `products`. Adding a column does not
--      change them, and they must stay ENABLED and FORCED.
--   4. Run as the owner of `products`. If you get "must be owner of table",
--      run it as postgres (same as migrations 023-025 sometimes needed).
--   5. The policy count does NOT change (still 21): no new policy here.
--
-- WHAT IT SOLVES
--   One address per product, empty when there is no photo.
--
-- SYSTEM DESIGN PRINCIPLE
--   Keep big files out of the database: store a pointer, not the thing.
--   Also: additive change. We only ADD; nothing is renamed or removed, so the
--   old code keeps working while the new code is rolled out.
--
-- RULES
--   1. ADD COLUMN IF NOT EXISTS: safe to run twice.
--   2. image_url may be NULL (no photo yet).
--   3. If set, it must start with https:// (a small safety net; the API checks
--      the stricter "must be our Cloudinary folder" rule).
--   4. sql/SCHEMA.sql gets the same column, so a fresh database matches.
--
-- PRACTICAL EXAMPLE
--   Mama Njeri uploads a photo of "Kitenge dress". Cloudinary returns
--   https://res.cloudinary.com/<cloud>/image/upload/v123/rahisisha/<shop>/dress.jpg
--   and that one line is saved in products.image_url for that dress.
--
-- WHERE USED
--   Written by: apps/api product create/update (after the upload)
--   Read by:    products list, storefront page, edit page
--
-- TRADEOFFS
--   + Tiny change, no new table, no new policy.
--   - One photo per product only. A gallery would use the existing
--     `product_media` table later.
--   - If Cloudinary is ever lost, the addresses point nowhere.
--
-- HOW TO USE
--   psql -U postgres -d rahisisha -f sql/migrations/027_product_image_url.sql
-- =============================================================================

-- BEGIN / COMMIT: all or nothing.
BEGIN;

-- PIECE BY PIECE
--   ALTER TABLE products          = "open the products cabinet to change it"
--   ADD COLUMN IF NOT EXISTS      = "add a new drawer, unless it is already there"
--   image_url TEXT                = "a drawer holding one line of text: the photo's address"
--   CONSTRAINT ... CHECK          = "the line must start with https:// or be empty"
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url TEXT
  CONSTRAINT products_image_url_https_chk
  CHECK (image_url IS NULL OR image_url LIKE 'https://%');

COMMIT;