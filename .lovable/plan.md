

# Merch System: POS Tab + Public Preorder Store

## Overview
Create a dedicated merch product catalog (separate from cafe menu items) with full admin management, a "Merch" tab in both POS terminals, and a public-facing merch store page where members and non-members can browse and preorder.

## Database

### New table: `merch_products`
- `id` (uuid, PK)
- `name` (text, not null) — e.g. "Storm Haven Hoodie"
- `description` (text)
- `price` (numeric, not null)
- `image_urls` (text[]) — array of image URLs for gallery
- `sizes` (text[]) — e.g. ["S","M","L","XL","2XL"]
- `colors` (text[]) — e.g. ["Black","Gray","White"]
- `category` (text) — e.g. "Hoodies", "T-Shirts", "Hats"
- `is_active` (boolean, default true)
- `allow_preorder` (boolean, default true)
- `display_order` (int, default 0)
- `created_at`, `updated_at`
- `created_by` (uuid, references auth.users)

### New table: `merch_inventory`
- `id` (uuid, PK)
- `product_id` (uuid, FK → merch_products)
- `size` (text)
- `color` (text)
- `quantity` (int, default 0)
- Unique constraint on (product_id, size, color)

### New table: `merch_orders`
- `id` (uuid, PK)
- `user_id` (uuid, nullable — for logged-in users)
- `customer_name` (text)
- `customer_email` (text)
- `customer_phone` (text)
- `order_items` (jsonb) — [{product_id, name, size, color, quantity, price}]
- `total_amount` (numeric)
- `payment_method` (text) — "card", "cash", "preorder_card", "member_account"
- `status` (text, default "pending") — pending, confirmed, ready_for_pickup, picked_up, cancelled
- `is_preorder` (boolean, default false)
- `member_id` (uuid, nullable)
- `stripe_payment_intent_id` (text, nullable)
- `notes` (text)
- `created_at`, `updated_at`

### Storage bucket: `merch-images` (public)

### RLS:
- `merch_products`: public read for active items; admin write
- `merch_inventory`: public read; admin write
- `merch_orders`: users can read own orders; admins can read/write all

## Admin: POS Merch Tab

Add a **"Merch"** tab to both `CafePOS.tsx` and `FrontDeskPOS.tsx` (alongside existing Order Queue / POS Terminal tabs). This tab will:

1. Show a grid of merch products with images, grouped by category
2. Clicking a product opens a selector for size + color (filtered by what's in inventory)
3. Adds to the existing POS cart (reuses `CafePOSCart`)
4. On sale, decrements inventory for the selected size/color variant

### Admin Merch Manager
New page at `/admin/merch` — full CRUD for products:
- Add/edit product: name, description, price, category, sizes, colors, images (multi-upload), preorder toggle
- Manage inventory per size/color variant (quantity grid)
- Toggle active/inactive

## Public Merch Store Page

New page at `/merch` (or `/shop`):
- Grid of active products with images, price, description
- Click to view product detail with size/color picker
- "Preorder" button — for logged-in users, charges card on file or creates a Stripe checkout; for guests, collects email/name and creates checkout session
- Creates a `merch_orders` row with `is_preorder = true`
- Confirmation page after payment

## Hooks & Components

- `src/hooks/useMerchProducts.ts` — CRUD queries for products + inventory
- `src/components/admin/MerchManager.tsx` — admin product CRUD + inventory grid
- `src/components/admin/MerchPOSTab.tsx` — POS merch browsing + size/color selection, adds to cart
- `src/pages/Merch.tsx` — public store page
- `src/components/merch/MerchProductCard.tsx` — product card for public store
- `src/components/merch/MerchProductDetail.tsx` — detail view with size/color/preorder

## Implementation Order

1. Create database tables + storage bucket + RLS
2. Build hooks for merch products/inventory/orders
3. Build admin merch manager page
4. Build MerchPOSTab and integrate into both POS pages
5. Build public merch store + preorder flow
6. Add routes to App.tsx and sidebar links

