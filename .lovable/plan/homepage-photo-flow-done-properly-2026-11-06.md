# Homepage: photo flow done properly

## What's wrong today (measured, not guessed)
- **Photos are forced into frames that don't fit their shape.** Wide room photos (gym, cycling, aerobics, ZeroBody, red light) are cropped into tall frames, so the room gets cut off. The tall reformer photo is squeezed into a wide frame on desktop.
- **Some photos are too small for the size they're shown at.** Red Light (702px wide) and Matcha (610px) look soft when large.
- **Sizes jump around with no rhythm.** Every section uses a different grid, frame shape and gap, so the eye never settles. Life at Storm mixes tall and wide shots at one size.
- **The same idea repeats.** The lobby appears in the hero and again in Life at Storm. The salt room opens Recover and is also in the spa pair.
- **One sauna file is 14,000px wide.** It slows the page on phones.

## The fix: one photo system for the whole page
Three frame shapes only, each matched to how the photo was actually shot:
- **Tall (2:3):** lobby, stairs, reformer, cold plunge, spa door, treatment room, lockers.
- **Wide (3:2):** cycling, gym, aerobics, sauna, ZeroBody, showers.
- **Full-bleed:** one per dark chapter only (Recover).

There are three sizes (large, medium, small) on a fixed grid. Gaps and the space between chapters are the same everywhere. Every photo keeps its subject in frame, with the focus point set per photo rather than centred by default.

## Chapter-by-chapter layout
```text
Arrival     full screen lobby, one line, one link
01 Idea     text left | tall stairs right (medium)
02 Move     tall reformer (large) + two stacked wide (cycling, gym) — tops and bottoms aligned
            Classes · Personal training links directly under
03 Recover  full-bleed salt room → two rows of pairs, alternating tall/wide so heights match:
            [Cold Plunge tall | Sauna wide]  [ZeroBody wide | Red Light — replaced or smaller]
            name only under each
04 Spa      tall door (large) + tall treatment room (medium), bottoms aligned; "Visit Spa Aella"
05 Café     one photo + "The café menu" (use the sharpest café shot; matcha only if shown small)
06 Life     horizontal strip, every frame the same height; tall and wide shots keep their true shape
            Training floor · Aerobics · Steam Room · Lockers · Showers · Kids Care (if a real photo exists) · Café
07 Membership  unchanged text, one link
```
- Remove repeats: the lobby leaves the strip, and the salt room is used once.

## Phone is designed separately
- One photo per row, full width. Pairs stack in a set order. Tall photos are capped so a single image never fills more than one screen.
- The strip swipes with one and a bit photos showing, so people can tell it scrolls.

## Quality pass before I show you
- Screenshot every chapter on phone (402px) and desktop (1440px). Check alignment lines, matching heights and even spacing, and that nothing is cut off.
- Shrink oversized files. Flag any photo that's too soft to show large instead of quietly using it.
- Send you the screenshots side by side, with the list of photos I need from you: a sharper red light shot, café interior, Kids Care, people training.

## Technical details
- `src/pages/Index.tsx` layout rewrite, plus small additions to `components/editorial/Editorial.tsx`: a frame-ratio prop (`tall` | `wide`) and a per-image `focus` (object-position).
- Downscale `sauna-interior-wide.jpg` to about 2400px wide.
- No copy changes beyond what you already approved.
