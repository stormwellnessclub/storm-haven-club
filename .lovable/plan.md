

## Plan: Update Studios Section on Homepage

### Image Note
You uploaded 4 images but referenced "Image_867.jpeg" for the Aerobics Room — that file wasn't included in the uploads. The colorful mat studio image (`Still_2025-12-12_173713_1.42.1.jpg`) appears to be the intended aerobics room photo. I'll use that unless you correct me.

### Changes to `src/pages/Index.tsx`

1. **Copy 3 uploaded images** into `src/assets/`:
   - `DSC09855.jpg` → `src/assets/reformer-pilates-hero.jpg`
   - `cycling_studio_2.jpg` → `src/assets/cycling-studio-hero.jpg`
   - `Still_2025-12-12_173713_1.42.1.jpg` → `src/assets/aerobics-studio-hero.jpg`
   - `pilates_reformer_community.png` → `src/assets/community-banner.png`

2. **Add imports** for the 4 new images

3. **Update `SectionHeading`** (line 155):
   - title: "Where you train matters as much as how you train."
   - subtitle: "Three purpose-built studios. Each one designed to feel as intentional as the rest of this space."

4. **Update `classStudios` array** (lines 27-53):
   - Reformer Pilates: new image + new description
   - Cycling Studio: new image + new description
   - Aerobics Room: new image + new description

5. **Add full-width community image** after the `StaggerContainer` (after line 195), before the "View Full Schedule" button:
   - Full-width `<img>` using `community-banner.png`, no text overlay, no caption

### Files changed
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Update heading, descriptions, images, add community banner |
| `src/assets/` | 4 new image files copied from uploads |

