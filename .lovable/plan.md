# Multi-Image Support: Cafe & Storm Shop

## Current state
- **Storm Shop**: `merch_products.image_urls` is already `text[]`. Customer Merch page already renders a thumbnail strip. **Admin Manager only supports adding ONE image per save** — each edit appends a single uploaded file. No reorder, no multi-file picker.
- **Cafe**: `cafe_menu_items.image_url` is a single `text` column. Admin manager and customer cart use only one image.

## Goal
Both admins can upload **multiple images** per item, reorder them, and remove any. First image is the primary/cover. Customer views show a gallery.

---

## 1. Storm Shop (MerchManager)
No DB changes needed.

**`src/pages/admin/MerchManager.tsx`**
- Replace single-file `<Input type="file">` with a multi-file picker (`multiple` attribute) + state `imageFiles: File[]`.
- On save: upload all selected files to `merch-images` bucket in parallel, append all returned URLs to `image_urls`.
- Existing-images grid: add drag handles (or up/down arrow buttons) to reorder, plus the existing remove × button. Persist reorder via `updateProduct({ image_urls: newOrder })`.
- Show count "(3 images)" next to label.

**`src/pages/Merch.tsx`** (customer)
- Product detail dialog: keep main image, make thumbnail strip clickable to swap main image (local `activeImageIdx` state). Already iterates `image_urls`, just needs onClick.

## 2. Cafe (CafeMenuManager)
**DB migration** (`cafe_menu_items`):
- Add `image_urls text[] not null default '{}'`.
- Backfill: `update cafe_menu_items set image_urls = array[image_url] where image_url is not null and (image_urls is null or array_length(image_urls,1) is null);`
- Keep `image_url` column for backwards compat; a trigger (or app-level write) keeps `image_url = image_urls[1]` so existing customer code (`CafeOrderContent`, POS cart, receipts, Stripe descriptions) continues working with zero churn.

**`src/hooks/useCafeMenu.ts`**
- Add `image_urls: string[]` to `CafeMenuItem` + section types.
- Extend update/create mutation payloads to accept `image_urls`.

**`src/pages/admin/CafeMenuManager.tsx`**
- Both edit and create forms: swap single image input for a multi-image uploader matching the Storm Shop pattern (multi-file select, thumbnail grid with remove + reorder).
- On save: write `image_urls` array; also write `image_url = image_urls[0] ?? null` for compat.
- List row thumbnail (line 274) keeps using `image_url` (= first).

**`src/components/cafe/CafeOrderContent.tsx`** (customer)
- Optional enhancement: if `image_urls.length > 1`, render small thumbnail strip in the item detail/modify view; otherwise unchanged. (Cart/line items stay single-image.)

## 3. Out of scope
- No changes to POS receipts, Stripe product images, cafe sales report, or any reporting code — they continue to read `image_url`.
- No reordering UX library added; use simple ↑ ↓ buttons (no new deps).
- Spa / classes / equipment images untouched.

## Technical notes
- Reuse existing `merch-images` and `cafe-menu` storage buckets — no new buckets, no RLS changes.
- File limit per item: soft cap of 8 images in UI (just to avoid runaway uploads); no DB constraint.
- Uploads run in `Promise.all` with the existing `uploading` flag; on partial failure, surface a toast and keep the successful uploads.
