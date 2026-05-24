# Memorial Day Hours — Instagram Flyer

Generate a single square 1080×1080 PNG saved to `/mnt/documents/memorial_day_hours_flyer.png`, on-brand with the existing Memorial Day email (cream `#DEDACE`, deep ink `#1C170F`, gold `#B8A068`, serif typography).

## Layout (top → bottom)

```
─────────────────────────────
   STORM WELLNESS CLUB        (small, gold, tracked)
   ───── gold rule ─────
   In Honor of                 (italic serif, small)
   MEMORIAL DAY               (large display serif)
   Weekend Hours
   ───── gold rule ─────

   SUNDAY · MAY 24
   8:00 AM – 5:00 PM

   MONDAY · MAY 25  (Memorial Day)
   7:00 AM – 5:00 PM

   Regular hours resume Tuesday, May 26

   ───── gold rule ─────

   Full holiday hours in the Member Portal.
   Turn on text notifications to stay
   up to date on Club updates.

   stormwellnessclub.com
─────────────────────────────
```

## Visual style
- Background: warm cream `#DEDACE` with subtle paper texture / faint gold corner ornaments (Art Deco–leaning, matches the brand's "Intentional Design" memory)
- Headline "MEMORIAL DAY" in large serif (Cormorant / Playfair), ink `#1C170F`
- Gold hairline rules and a small star or laurel accent above the headline
- Hours block centered, generous spacing, serif body
- Footer note about portal + SMS sign-up in smaller italic serif, ink color
- No photos — typographic editorial feel, museum-poster quality

## How it will be generated
- Python + Pillow script written to `/tmp/build_md_flyer.py`
- Uses serif fonts already available on the sandbox (Cormorant / EB Garamond / Playfair via Google Fonts download if needed)
- Output: `/mnt/documents/memorial_day_hours_flyer.png` (1080×1080, RGB, sRGB)
- QA pass: open the PNG, verify no clipped text, even margins, legible at Instagram thumbnail size; iterate if needed
- Deliver via `<presentation-artifact>` tag

No code changes to the app itself.
