# Replace smoothie images with the uploaded photos

Swap the 3 AI-generated smoothies I made with the real Storm Cafe product photos you just uploaded.

## Mapping
- **Image_1020.jpeg** (blue swirl w/ whip) → Coconut Cloud
- **Image_1026.jpeg** (pink strawberry + cream) → Hailey Bieber
- **Image_1021.jpeg** (orange creamy swirl) → Orange Creamsicle

## Steps
1. Copy the 3 uploads into `src/assets/cafe/` overwriting the current `smoothie-coconut-cloud.jpg`, `smoothie-hailey-bieber.jpg`, `smoothie-orange-creamsicle.jpg`.
2. Upload each to the `cafe-menu-images` storage bucket under new filenames (so the CDN cache doesn't serve the old versions).
3. Update `image_url` on the 3 `cafe_menu_items` rows to the new public URLs.
4. Delete the 3 old (AI-generated) files from the bucket so nothing is orphaned.

No code or layout changes — image swap only.
