Remove the pilot style preview from the member-facing cafe page so members never see unconfirmed work. Move the 4 pilot images to an admin-only review route instead.

## Changes

1. **Remove** `<CafeStylePreview />` from `src/pages/member/Cafe.tsx` so `/member/cafe` goes back to the normal ordering UI immediately.
2. **Create** a new admin-only route `/admin/cafe-style-preview` that renders the same `CafeStylePreview` component. Gated behind the existing admin auth so only you can view it.
3. **Keep** the 4 pilot image files in `src/assets/cafe/` and the `CafeStylePreview` component — just relocate where it renders.

## Result

- Members visiting `/member/cafe`: see only the normal cafe, no pilot panel, no "do you like this?" question.
- You visit `/admin/cafe-style-preview`: see the 4 pilot images to approve or reject.
- Once you approve, I'll delete the preview route entirely and apply the locked style to real menu item photos.