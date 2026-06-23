## Regenerate cafe photos with photorealistic quality

The 6 coffee/matcha images generated earlier used the `fast` tier (Flux), which produces stylized/cartoony output. I'll regenerate them using the **premium** tier (GPT-image / Gemini 3 Pro) with tightened photography-style prompts, then re-upload to CDN and re-point the menu items.

### Images to redo
1. Hot latte — `latte-hot.jpg`
2. Iced latte — `latte-iced.jpg`
3. Dalgona coffee — `dalgona.jpg`
4. Honeycomb matcha — `matcha-honeycomb.jpg`
5. Strawberry matcha — `matcha-strawberry.jpg`
6. Classic matcha latte — `matcha-classic.jpg`

### Prompt style
Each prompt will specify: "professional food photography, shot on 50mm, natural window light, shallow depth of field, marble or oak café surface, condensation/steam visible, no illustration, no 3D render, no cartoon — photorealistic only."

### Steps
1. Generate 6 images via `imagegen` with `model: "premium"` (premium GPT/Gemini handles realism + glassware/liquid much better than fast tier).
2. Upload each via `lovable-assets create`, capture new CDN URLs.
3. UPDATE `cafe_menu_items.image_url` for the 6 items with new URLs.
4. Delete the old asset pointers.

No code or schema changes — purely asset replacement.

### Optional
If you want, I can also redo the **functional smoothie** photos in the same pass. Let me know before I start, otherwise I'll only do the 6 coffee/matcha ones.
